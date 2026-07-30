#!/usr/bin/env python3
"""One-off history backfill: page through arXiv for every company to recover
older official reports that were published before daily tracking started.

Usage: python scripts/backfill_history.py
"""
import sys, os, json, time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fetch_papers import fetch_arxiv, verify_company, auto_tag, COMPANY_CONFIG

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# Site data lives at the repo root (no llm-tracker/ subdirectory)
TRACKER = ROOT
PAGES = [(0, 50), (50, 50), (100, 50)]  # up to 150 per company


def main():
    papers = json.load(open(os.path.join(ROOT, "papers.json"), encoding="utf-8"))
    existing_map = {p["id"]: p for p in papers}
    cp_path = os.path.join(TRACKER, "company-papers.json")
    company_map = {p["id"]: p for p in json.load(open(cp_path, encoding="utf-8"))}

    added_co = added_main = 0
    for co, cfg in COMPANY_CONFIG.items():
        before = len(company_map)
        for start, n in PAGES:
            results = fetch_arxiv(f"({cfg['query']})", f"{co}@{start}", max_results=n, start=start)
            for p in results:
                if not verify_company(p, co, cfg["author_keywords"]):
                    continue
                p["company"] = co
                p["tags"] = auto_tag(p["title"], p.get("abstract", ""))
                p.pop("author_list", None)
                p.pop("affiliations", None)
                if p["id"] not in existing_map:
                    existing_map[p["id"]] = p
                    added_main += 1
                else:
                    existing_map[p["id"]]["company"] = co
                if p["id"] not in company_map:
                    company_map[p["id"]] = p
                    added_co += 1
            time.sleep(8)
        print(f"{co}: +{len(company_map) - before}")

    all_papers = sorted(existing_map.values(), key=lambda p: p.get("date", ""), reverse=True)
    json.dump(all_papers, open(os.path.join(ROOT, "papers.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=2)

    company_list = sorted(company_map.values(), key=lambda p: p.get("date", ""), reverse=True)
    out = [{"id": p["id"], "title": p["title"], "title_zh": p.get("title_zh", ""),
            "company": p["company"], "date": p.get("date", ""),
            "tags": p.get("tags", [])} for p in company_list[:1200]]
    json.dump(out, open(cp_path, "w", encoding="utf-8"), ensure_ascii=False)
    print(f"\nBackfill done: +{added_co} company entries (total {len(out)}), "
          f"+{added_main} new papers (total {len(all_papers)})")


if __name__ == "__main__":
    main()
