#!/usr/bin/env python3
"""Backfill canonical learning-path papers (and new RL papers) into papers.json.

Many classic papers in learning-path.json (Attention, BERT, GPT-3, DPO, ...)
are outside the LLM-topic arXiv query and never enter the main dataset. This
script fetches them by id_list API, queries Semantic Scholar for citation
counts (with backoff), merges into papers.json + company-papers.json, and
re-splits api/ so the learning path shows citation counts.

Usage: python scripts/backfill_learning_path.py
"""
import sys, os, json, re, time, urllib.request, urllib.parse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fetch_papers import auto_tag

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UA = "XploreLAB-PaperTracker/1.0 (contact: github.com/Xplore-LAB)"

# Papers to backfill: id -> (title hint for sanity check)
WANT = {
    # Classic papers missing from the main dataset
    "1706.03762": "Attention Is All You Need",
    "1810.04805": "BERT",
    "2005.14165": "Language Models are Few-Shot Learners",
    "2104.09864": "RoFormer",
    "2205.14135": "FlashAttention",
    "2305.13245": "GQA",
    "2101.03961": "Switch Transformers",
    "2001.08361": "Scaling Laws",
    "2305.18290": "DPO",
    "2203.11171": "Self-Consistency",
    # New RL / reasoning papers for the learning path
    "2402.03300": "DeepSeekMath",
    "2305.20050": "Let's Verify Step by Step",
    "2502.14768": "Logic-RL",
    "2504.13837": "Does RL Really Incentivize",
    "2506.14245": "RLVR Implicitly",
}


def fetch_arxiv(ids):
    """Fetch papers from arXiv id_list API."""
    url = "https://export.arxiv.org/api/query?" + urllib.parse.urlencode({
        "id_list": ",".join(ids), "max_results": len(ids)})
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        content = r.read().decode()
    papers = {}
    for entry in re.findall(r'<entry>(.*?)</entry>', content, re.DOTALL):
        def get(f):
            m = re.search(rf'<{f}[^>]*>(.*?)</{f}>', entry, re.DOTALL)
            return m.group(1).strip() if m else ""
        m = re.search(r'<id>.*?/abs/([^v<\n]+)', entry)
        if not m:
            continue
        pid = m.group(1).strip()
        title = re.sub(r'\s+', ' ', get('title'))
        authors_raw = re.findall(r'<name>(.*?)</name>', entry)
        published = get('published')[:10]
        papers[pid] = {
            "id": pid, "title": title,
            "authors": ', '.join(authors_raw[:3]) + (' et al.' if len(authors_raw) > 3 else ''),
            "year": int(published[:4]) if published else 2025,
            "date": published, "cite": 0,
            "abstract": re.sub(r'\s+', ' ', get('summary'))[:500],
        }
    return papers


def s2_citations(ids):
    """Query Semantic Scholar Graph API for citation counts, no heavy backoff."""
    out = {}
    for pid in ids:
        try:
            url = (f"https://api.semanticscholar.org/graph/v1/paper/arXiv:{pid}"
                   f"?fields=citationCount")
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=8) as r:
                data = json.loads(r.read())
            out[pid] = data.get("citationCount", 0)
        except Exception as e:
            code = getattr(e, "code", None)
            if code == 429:
                time.sleep(5)  # light backoff, skip on next failure
                try:
                    with urllib.request.urlopen(req, timeout=8) as r:
                        data = json.loads(r.read())
                    out[pid] = data.get("citationCount", 0)
                except Exception:
                    print(f"  ! S2 rate-limited for {pid}, cite=0")
            else:
                print(f"  ! S2 failed for {pid}: {code or e}")
    return out


def main():
    papers = json.load(open(os.path.join(ROOT, "papers.json"), encoding="utf-8"))
    existing_map = {p["id"]: p for p in papers}
    cp_path = os.path.join(ROOT, "company-papers.json")
    company_map = {p["id"]: p for p in json.load(open(cp_path, encoding="utf-8"))}

    missing = [i for i in WANT if i not in existing_map]
    if not missing:
        print("All papers already present. Skipping fetch.")
        return

    print(f"Fetching {len(missing)} papers from arXiv...")
    fetched = fetch_arxiv(missing)
    print(f"Fetched {len(fetched)}. Querying Semantic Scholar for citations...")
    cites = s2_citations(list(fetched.keys()))

    added = 0
    for pid, p in fetched.items():
        p["cite"] = cites.get(pid, 0)
        p["tags"] = auto_tag(p["title"], p.get("abstract", ""))
        if pid not in existing_map:
            existing_map[pid] = p
            added += 1
        # do NOT add company tag — these are general papers, not company reports
        print(f"  + {pid} cite={p['cite']:>7}  {p['title'][:55]}")

    all_papers = sorted(existing_map.values(), key=lambda p: p.get("date", ""), reverse=True)
    json.dump(all_papers, open(os.path.join(ROOT, "papers.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=2)
    print(f"papers.json: {len(all_papers)} entries (+{added})")

    # Re-split api/ so the frontend serves updated chunks
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from split_api import main as split_main
    split_main()


if __name__ == "__main__":
    main()
