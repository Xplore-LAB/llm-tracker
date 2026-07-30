#!/usr/bin/env python3
"""Download arXiv PDFs for company papers (the 'gems') into pdfs/.

Keeps only the newest KEEP papers (company-papers.json is newest-first) so
the Pages site stays within size limits. Writes pdfs-index.json with the
list of ids that have a local PDF.
"""
import json, os, time, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# Site data lives at the repo root (no llm-tracker/ subdirectory)
TRACKER = ROOT
PDF_DIR = os.path.join(TRACKER, "pdfs")
KEEP = 400
UA = "XploreLAB-PaperTracker/1.0 (contact: github.com/Xplore-LAB)"


def main():
    cp = json.load(open(os.path.join(TRACKER, "company-papers.json"), encoding="utf-8"))
    keep_ids = [p["id"] for p in cp[:KEEP]]
    keep_set = set(keep_ids)
    os.makedirs(PDF_DIR, exist_ok=True)

    # prune PDFs that fell out of the keep window
    pruned = 0
    for fn in os.listdir(PDF_DIR):
        if fn.endswith(".pdf") and fn[:-4] not in keep_set:
            os.remove(os.path.join(PDF_DIR, fn))
            pruned += 1
    if pruned:
        print(f"Pruned {pruned} old PDFs")

    downloaded, failed = 0, 0
    for pid in keep_ids:
        dest = os.path.join(PDF_DIR, pid + ".pdf")
        if os.path.exists(dest) and os.path.getsize(dest) > 10000:
            continue
        url = f"https://arxiv.org/pdf/{pid}"
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=90) as r:
                data = r.read()
            if not data.startswith(b"%PDF"):
                raise ValueError("not a PDF (rate limited?)")
            if len(data) > 15 * 1024 * 1024:
                print(f"  SKIP {pid}: {len(data) // 1024 // 1024} MB over 15MB cap")
                failed += 1
                continue
            with open(dest, "wb") as f:
                f.write(data)
            downloaded += 1
            print(f"  [{downloaded}] {pid}.pdf ({len(data) // 1024} KB)")
        except Exception as e:
            failed += 1
            print(f"  FAILED {pid}: {e}")
        time.sleep(3)

    index = sorted(fn[:-4] for fn in os.listdir(PDF_DIR) if fn.endswith(".pdf"))
    with open(os.path.join(TRACKER, "pdfs-index.json"), "w", encoding="utf-8") as f:
        json.dump(index, f)
    total_mb = sum(os.path.getsize(os.path.join(PDF_DIR, fn))
                   for fn in os.listdir(PDF_DIR)) / 1024 / 1024
    print(f"PDFs: {len(index)} files, {total_mb:.0f} MB "
          f"(+{downloaded} new, {failed} failed)")


if __name__ == "__main__":
    main()
