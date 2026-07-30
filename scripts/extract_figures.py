#!/usr/bin/env python3
"""Extract the main architecture diagram from each model's technical report.

Heuristic: find the first figure caption (first 12 pages) whose text mentions
architecture/structure/overview/pipeline/framework/diagram, then render the
graphics region right above that caption. Falls back to the Figure 1 caption.

Input:  models.json (nodes with arXiv id)
        pdfs/<id>.pdf when present, else downloaded from arXiv
Output: models/img/<Company>-<modelkey>.png
        models-figures.json  {"Company|modelkey": "img/<file>.png"}
"""
import json, os, re, time, urllib.request

import fitz  # PyMuPDF

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# Site data lives at the repo root (no llm-tracker/ subdirectory)
TRACKER = ROOT
PDF_DIR = os.path.join(TRACKER, "pdfs")
IMG_DIR = os.path.join(TRACKER, "models", "img")
UA = "XploreLAB-PaperTracker/1.0 (contact: github.com/Xplore-LAB)"

CAP = re.compile(r'^(Figure|Fig\.?)\s*\d+', re.I)
KW = re.compile(r'architect|structure|overview|pipeline|framework|diagram', re.I)


def dedupe_key(model):
    return re.sub(r'[\s\-.]', '', model).lower()


def find_clip(page, captions):
    """Given candidate caption blocks on a page, return the graphics clip
    above the first usable one, or None."""
    pr = page.rect
    for cap in captions:
        band_top = max(50, cap[1] - 0.6 * pr.height)
        rects = []
        for d in page.get_drawings():
            r = d['rect']
            if r.height < 20 or r.width < 60:
                continue
            if r.y1 > band_top and r.y0 < cap[1] + 2:
                rects.append(r)
        for img in page.get_image_info():
            r = fitz.Rect(img['bbox'])
            if r.height < 20 or r.width < 60:
                continue
            if r.y1 > band_top and r.y0 < cap[1] + 2:
                rects.append(r)
        if not rects:
            continue
        u = rects[0]
        for r in rects[1:]:
            u |= r
        u = u & pr
        if u.width < 200 or u.height < 80:
            continue
        return fitz.Rect(max(pr.x0, u.x0 - 6), max(50, u.y0 - 6),
                         min(pr.x1, u.x1 + 6), min(cap[1] - 2, u.y1 + 6))
    return None


def extract_figure(pdf_path, out_path):
    doc = fitz.open(pdf_path)
    kw_fallback, fig1_fallback = None, None
    for pno in range(min(12, len(doc))):
        page = doc[pno]
        kw_caps, fig1_caps = [], []
        for b in page.get_text('blocks'):
            text = b[4].strip().replace('\n', ' ')
            if not CAP.match(text):
                continue
            if KW.search(text):
                kw_caps.append(b)
            if re.match(r'^Figure\s*1\b', text, re.I):
                fig1_caps.append(b)
        clip = find_clip(page, kw_caps)
        if clip:
            pix = page.get_pixmap(clip=clip, dpi=160)
            pix.save(out_path)
            return f"keyword p{pno}"
        if not fig1_fallback and fig1_caps:
            fig1_fallback = (page, fig1_caps)
    if fig1_fallback:
        page, caps = fig1_fallback
        clip = find_clip(page, caps)
        if clip:
            pix = page.get_pixmap(clip=clip, dpi=160)
            pix.save(out_path)
            return "figure1"
    return None


def get_pdf(pid, tmp_dir):
    """Return (path, is_tmp) to the paper's PDF, downloading if necessary.
    In FIGS_LOCAL_ONLY mode, returns (None, False) when not already local."""
    local = os.path.join(PDF_DIR, pid + ".pdf")
    if os.path.exists(local):
        return local, False
    if os.environ.get("FIGS_LOCAL_ONLY"):
        return None, False
    tmp = os.path.join(tmp_dir, pid + ".pdf")
    if not os.path.exists(tmp):
        req = urllib.request.Request(f"https://arxiv.org/pdf/{pid}",
                                     headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=90) as r:
            data = r.read()
        if not data.startswith(b"%PDF"):
            raise ValueError("not a PDF")
        with open(tmp, "wb") as f:
            f.write(data)
        time.sleep(3)
    return tmp, True


def main():
    data = json.load(open(os.path.join(TRACKER, "models.json"), encoding="utf-8"))
    models = data["models"]
    # candidate papers per series, official-sounding titles first
    series_map = {}
    for g in data.get("groups", []):
        for s in g["series"]:
            key = f"{g['company']}|{dedupe_key(s['model'])}"
            mkey = dedupe_key(s["model"])

            def ck(p, mkey=mkey):
                t = p.get("title", "").lower()
                norm = re.sub(r'[\s\-.]', '', t)
                starts = norm.startswith(mkey) or norm.startswith("the" + mkey)
                return (-bool(starts),
                        -("technical report" in t),
                        -(mkey in norm),
                        len(t),
                        p.get("date", ""))
            papers = sorted(s["papers"], key=ck)
            series_map[key] = papers
    os.makedirs(IMG_DIR, exist_ok=True)
    tmp_dir = os.path.join(TRACKER, "models", ".tmp_pdf")
    os.makedirs(tmp_dir, exist_ok=True)

    figures = {}
    done = skipped = failed = 0
    for m in models:
        if not m.get("id"):
            continue  # extra nodes have no arXiv paper
        key = f"{m['company']}|{dedupe_key(m['model'])}"
        fname = f"{m['company']}-{dedupe_key(m['model'])}.png".replace('/', '_')
        out_path = os.path.join(IMG_DIR, fname)
        if os.path.exists(out_path):
            figures[key] = f"img/{fname}"
            skipped += 1
            continue
        candidates = ([{"id": m["id"], "title": m.get("title", ""), "date": ""}]
                      + [p for p in series_map.get(key, []) if p["id"] != m["id"]])
        how = None
        for cand in candidates[:4]:
            if not cand.get("id"):
                continue
            try:
                pdf, is_tmp = get_pdf(cand["id"], tmp_dir)
                if not pdf:
                    continue
                how = extract_figure(pdf, out_path)
                if is_tmp:
                    os.remove(pdf)
                if how:
                    break
            except Exception as e:
                print(f"  FAILED {key} [{cand['id']}]: {e}")
        if how:
            figures[key] = f"img/{fname}"
            done += 1
            print(f"  [{done}] {key} ({how})")
        else:
            failed += 1
            print(f"  no-figure {key}")

    with open(os.path.join(TRACKER, "models-figures.json"), "w", encoding="utf-8") as f:
        json.dump(figures, f, ensure_ascii=False)
    try:
        os.rmdir(tmp_dir)
    except OSError:
        pass
    print(f"Figures: {len(figures)} total ({done} new, {skipped} cached, {failed} none)")


if __name__ == "__main__":
    main()
