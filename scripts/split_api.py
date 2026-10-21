#!/usr/bin/env python3
"""Split monolithic JSON data files into paginated API chunks.

Reads papers.json, company-papers.json, timeline-data.json, models.json
and writes paginated chunks + search index to api/ directory.

Usage: python scripts/split_api.py [--page-size 100]
"""
import argparse
import json, os, sys, shutil, tempfile
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


def split_papers(page_size, output_dir):
    """Split papers.json into pages + search index."""
    src = os.path.join(ROOT, "papers.json")
    if not os.path.exists(src):
        raise FileNotFoundError(f"Required source not found: {src}")

    with open(src, "r", encoding="utf-8") as f:
        papers = json.load(f)
    if not isinstance(papers, list) or any(not isinstance(p, dict) for p in papers):
        raise ValueError("papers.json must contain a list of paper objects")

    total = len(papers)
    total_pages = (total + page_size - 1) // page_size

    # Write index
    write_json(os.path.join(output_dir, "index.json"), {
        "total": total,
        "pageSize": page_size,
        "totalPages": total_pages,
        "updated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    })

    # Write pages
    pages_dir = os.path.join(output_dir, "papers")
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
    write_json(os.path.join(output_dir, "search-index.json"), search_index)

    print(f"  Papers: {total} → {total_pages} pages ({page_size}/page)")


def copy_json(filename, output_dir):
    """Copy a JSON file to api/ unchanged."""
    src = os.path.join(ROOT, filename)
    dst = os.path.join(output_dir, filename)
    if os.path.exists(src):
        # Validate the same bytes that will be published, preserving formatting.
        with open(src, "rb") as f:
            content = f.read()
        json.loads(content)
        with open(dst, "wb") as f:
            f.write(content)
        size_kb = os.path.getsize(dst) / 1024
        print(f"  ✓ api/{filename} ({size_kb:.0f} KB)")
    else:
        print(f"  ⚠ {filename} not found, skipping")


def build_api(page_size):
    """Build in isolation; preserve the previous API if generation fails.

    The lock excludes simultaneous splitters. Publication uses two directory
    renames with rollback, not an atomic directory exchange. An interrupted
    publication may leave the previous API in .api-build-*/previous-api.
    """
    if not isinstance(page_size, int) or page_size <= 0:
        raise ValueError("page size must be a positive integer")

    lock_dir = os.path.join(ROOT, ".split-api.lock")
    try:
        os.mkdir(lock_dir)
    except FileExistsError:
        raise RuntimeError(
            f"API build already locked: {lock_dir}. If a previous process was "
            "interrupted, recover any .api-build-*/previous-api before removing "
            "the stale lock."
        ) from None

    workspace = None
    published = False
    try:
        # Keep staging on the destination filesystem for directory renames.
        workspace = tempfile.mkdtemp(prefix=".api-build-", dir=ROOT)
        staged = os.path.join(workspace, "api")
        backup = os.path.join(workspace, "previous-api")
        os.mkdir(staged)

        split_papers(page_size, staged)
        for filename in (
            "company-papers.json", "models.json", "models-extra.json",
            "models-figures.json", "learning-path.json", "pdfs-index.json",
            "timeline-data.json",
        ):
            copy_json(filename, staged)

        had_api = os.path.exists(API)
        if had_api:
            os.replace(API, backup)
        try:
            os.replace(staged, API)
        except BaseException:
            if had_api:
                os.replace(backup, API)
            raise
        published = True
    finally:
        try:
            if workspace is not None:
                backup = os.path.join(workspace, "previous-api")
                if published or not os.path.exists(backup):
                    shutil.rmtree(workspace)
                else:
                    # A failed rollback must never delete the only old copy.
                    print(f"Previous API retained for recovery: {backup}", file=sys.stderr)
        finally:
            os.rmdir(lock_dir)


def positive_int(value):
    try:
        parsed = int(value)
    except ValueError:
        raise argparse.ArgumentTypeError("page size must be a positive integer") from None
    if parsed <= 0:
        raise argparse.ArgumentTypeError("page size must be a positive integer")
    return parsed


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("page_size", nargs="?", type=positive_int,
                        help="papers per page (legacy positional form)")
    parser.add_argument("--page-size", dest="named_page_size", type=positive_int,
                        help=f"papers per page (default: {PAGE_SIZE})")
    args = parser.parse_args(argv)
    if args.page_size is not None and args.named_page_size is not None:
        parser.error("use either page_size or --page-size, not both")
    page_size = args.named_page_size or args.page_size or PAGE_SIZE

    print(f"🔪 Splitting API data (page size: {page_size})...")

    build_api(page_size)

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
