#!/usr/bin/env python3
"""Fetch specific canonical papers by arXiv id (id_list API) and tag their
company. Used to recover official reports that keyword queries miss
(different category, or buried beyond the paging window).

Usage: python scripts/fetch_by_ids.py
"""
import sys, os, json, re, time, urllib.request, urllib.parse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fetch_papers import auto_tag

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# Site data lives at the repo root (no llm-tracker/ subdirectory)
TRACKER = ROOT
UA = "XploreLAB-PaperTracker/1.0 (contact: github.com/Xplore-LAB)"

# company -> arXiv ids of canonical official reports
MANUAL = {
    "Qwen": ["2412.15115"],       # Qwen2.5 Technical Report
    "Meta": ["2307.09288", "2302.13971"],  # Llama 2, LLaMA
    "Baidu": ["2510.14528"],      # PaddleOCR-VL (cs.CV, missed by CL/AI filter)
    "Huawei": ["2505.21411"],     # Pangu Pro MoE
    "Moonshot": ["2501.12599"],   # Kimi k1.5
    "AllenAI": ["2501.00656"],    # OLMo 2
}


def extras_ids():
    out = {}
    path = os.path.join(TRACKER, "models-extra.json")
    for e in json.load(open(path, encoding="utf-8")):
        m = re.search(r'arxiv\.org/abs/([\d.]+)', e.get("url", ""))
        if m:
            out.setdefault(e["company"], []).append(m.group(1))
    return out


def fetch_ids(ids):
    url = "https://export.arxiv.org/api/query?" + urllib.parse.urlencode({
        "id_list": ",".join(ids), "max_results": len(ids)})
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        content = r.read().decode()
    papers = []
    for entry in re.findall(r'<entry>(.*?)</entry>', content, re.DOTALL):
        def get(f):
            m = re.search(rf'<{f}[^>]*>(.*?)</{f}>', entry, re.DOTALL)
            return m.group(1).strip() if m else ""
        m = re.search(r'<id>.*?/abs/([^v<\n]+)', entry)
        if not m:
            continue
        title = re.sub(r'\s+', ' ', get('title'))
        authors_raw = re.findall(r'<name>(.*?)</name>', entry)
        published = get('published')[:10]
        papers.append({
            "id": m.group(1).strip(), "title": title,
            "authors": ', '.join(authors_raw[:3]) + (' et al.' if len(authors_raw) > 3 else ''),
            "year": int(published[:4]) if published else 2025,
            "date": published, "cite": 0,
            "abstract": re.sub(r'\s+', ' ', get('summary'))[:500],
        })
    return papers


def main():
    want = extras_ids()
    for co, ids in MANUAL.items():
        want.setdefault(co, [])
        want[co] = list(dict.fromkeys(want[co] + ids))

    papers = json.load(open(os.path.join(ROOT, "papers.json"), encoding="utf-8"))
    existing_map = {p["id"]: p for p in papers}
    cp_path = os.path.join(TRACKER, "company-papers.json")
    company_map = {p["id"]: p for p in json.load(open(cp_path, encoding="utf-8"))}

    added = 0
    for co, ids in want.items():
        missing = [i for i in ids if i not in company_map]
        if not missing:
            continue
        try:
            fetched = fetch_ids(missing)
        except Exception as e:
            print(f"{co}: fetch failed {e}")
            continue
        for p in fetched:
            p["company"] = co
            p["tags"] = auto_tag(p["title"], p.get("abstract", ""))
            if p["id"] not in existing_map:
                existing_map[p["id"]] = p
            else:
                existing_map[p["id"]]["company"] = co
            company_map[p["id"]] = p
            added += 1
            print(f"  + [{co}] {p['id']} {p['title'][:50]}")
        time.sleep(3)

    all_papers = sorted(existing_map.values(), key=lambda p: p.get("date", ""), reverse=True)
    json.dump(all_papers, open(os.path.join(ROOT, "papers.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=2)
    company_list = sorted(company_map.values(), key=lambda p: p.get("date", ""), reverse=True)
    out = [{"id": p["id"], "title": p["title"], "title_zh": p.get("title_zh", ""),
            "company": p["company"], "date": p.get("date", ""),
            "tags": p.get("tags", [])} for p in company_list[:1200]]
    json.dump(out, open(cp_path, "w", encoding="utf-8"), ensure_ascii=False)
    print(f"Done: +{added} canonical papers, company entries {len(out)}")


if __name__ == "__main__":
    main()
