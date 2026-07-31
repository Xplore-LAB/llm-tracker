#!/usr/bin/env python3
"""Split monolithic JSON data files into paginated API chunks.

Reads papers.json, company-papers.json, timeline-data.json, models.json
and writes paginated chunks + search index to api/ directory.

Usage: python scripts/split_api.py [--page-size 100]
"""
import json, os, sys, shutil
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
API = os.path.join(ROOT, "api")
PAGE_SIZE = 100


def write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    size_kb = os.path.getsize(path) / 1024
    print(f"  ✓ {os.path.relpath(path, ROOT)} ({size_kb:.0f} KB)")


def split_papers(page_size):
    """Split papers.json into pages + search index."""
    src = os.path.join(ROOT, "papers.json")
    if not os.path.exists(src):
        print("  ⚠ papers.json not found, skipping")
        return

    with open(src, "r", encoding="utf-8") as f:
        papers = json.load(f)

    total = len(papers)
    total_pages = (total + page_size - 1) // page_size

    # Write index
    write_json(os.path.join(API, "index.json"), {
        "total": total,
        "pageSize": page_size,
        "totalPages": total_pages,
        "updated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    })

    # Write pages
    pages_dir = os.path.join(API, "papers")
    for p in range(total_pages):
        start = p * page_size
        end = min(start + page_size, total)
        page_data = papers[start:end]
        write_json(os.path.join(pages_dir, f"page-{p+1:03d}.json"), page_data)

    # Write search index (lightweight: id, title, title_zh, year, tags, cite)
    search_index = []
    for paper in papers:
        search_index.append({
            "id": paper.get("id", ""),
            "t": paper.get("title", ""),
            "tz": paper.get("title_zh", ""),
            "y": paper.get("year", 0),
            "tg": paper.get("tags", []),
            "c": paper.get("cite", 0),
        })
    write_json(os.path.join(API, "search-index.json"), search_index)

    print(f"  Papers: {total} → {total_pages} pages ({page_size}/page)")


def copy_json(filename):
    """Copy a JSON file to api/ unchanged."""
    src = os.path.join(ROOT, filename)
    dst = os.path.join(API, filename)
    if os.path.exists(src):
        shutil.copy2(src, dst)
        size_kb = os.path.getsize(dst) / 1024
        print(f"  ✓ api/{filename} ({size_kb:.0f} KB)")
    else:
        print(f"  ⚠ {filename} not found, skipping")


def main():
    page_size = int(sys.argv[1]) if len(sys.argv) > 1 else PAGE_SIZE

    print(f"🔪 Splitting API data (page size: {page_size})...")

    # Clean and recreate api/
    if os.path.exists(API):
        shutil.rmtree(API)

    split_papers(page_size)
    copy_json("company-papers.json")
    copy_json("models.json")
    copy_json("models-extra.json")
    copy_json("models-figures.json")
    copy_json("learning-path.json")
    copy_json("pdfs-index.json")
    copy_json("timeline-data.json")

    # Count total files
    file_count = sum(1 for _ in os.walk(API) for f in _[2])
    total_size = sum(
        os.path.getsize(os.path.join(r, f))
        for r, _, fs in os.walk(API)
        for f in fs
    )
    print(f"\n✅ api/ ready: {file_count} files, {total_size/1024/1024:.1f} MB total")


if __name__ == "__main__":
    main()
