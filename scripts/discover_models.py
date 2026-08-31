#!/usr/bin/env python3
"""Daily model discovery for llm-tracker (Strategy A: high-confidence auto-merge).

Free sources, no API key required:
- HuggingFace org whitelist (open-weight flagships)
- OpenRouter model catalog (proprietary + open, with official descriptions)

Outputs:
- models.json:            appends auto-merged high-confidence models (cap 10/run)
- models-discovered.json: full candidate pool with status, for human review
- daily_summary.txt:      appends a discovery summary (feeds Feishu notification)

Strategy A rules:
- AUTO-MERGE (high confidence): canonical org/slug match + flagship-looking
  series name + release date + passes quant/variant filters + dedupe.
- PENDING (medium/low): unknown companies, no-digit names not on the allowlist,
  or missing dates. Recorded in models-discovered.json for manual promotion
  via models-extra.json.
- Never modifies existing entries; never touches groups or model-tech.json.

Usage:
    python3 scripts/discover_models.py [--no-llm] [--dry-run]
"""
import json
import os
import re
import sys
import time
import urllib.request
import urllib.parse
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from extract_models import (  # noqa: E402
    dkey, mkey, normalize_series, QUANT_BLACKLIST, NO_DIGIT_OK, NOISE_FAMILIES,
    load_json, save_json, insert_sorted, llm_notes, FALLBACK_NOTE,
    rebuild_size_file,
    MODELS_JSON, SIZE_JSON,
)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DISCOVERED_JSON = os.path.join(ROOT, "models-discovered.json")
SUMMARY_TXT = os.path.join(ROOT, "daily_summary.txt")

MAX_AUTO_MERGE = 10          # per run; overflow stays pending for humans
MAX_CANDIDATES = 150         # cap the review pool
HF_PAGE_LIMIT = 100          # repos per org (sorted by createdAt desc)

# OpenRouter slug prefix -> site company (canonical first-party providers)
OR_SLUGS = {
    "openai": "OpenAI",
    "google": "Google",
    "anthropic": "Anthropic",
    "meta-llama": "Meta",
    "deepseek": "DeepSeek",
    "qwen": "Qwen",
    "mistralai": "Mistral",
    "z-ai": "Zhipu",
    "moonshotai": "Moonshot",
    "minimax": "MiniMax",
    "x-ai": "xAI",
    "microsoft": "Microsoft",
    "nvidia": "Nvidia",
    "ibm": "IBM",
    "allenai": "AllenAI",
    "ai21": "AI21",
    "cohere": "Cohere",
    "microsoft/phi": "Microsoft",
    "perplexity": "Perplexity",
    "tencent": "Tencent",
    "baichuan": "Baichuan",
    "stepfun-ai": "StepFun",
    "inclusionai": "AntGroup",
    "openbmb": "ModelBest",
    "ai21labs": "AI21",
    "google-deepmind": "Google",
    "meta": "Meta",
    "amazon": "Amazon",
    "xiaomi": "Xiaomi",
}

# OpenRouter variant suffixes on model ids (":free", ":extended", ":thinking")
_OR_VARIANT_RE = re.compile(r":[a-z]+$", re.IGNORECASE)

# HF pipeline tags we consider LLM releases
ALLOWED_TAGS = {"text-generation", "text2text-generation", "image-text-to-text",
                "any-to-any", "visual-question-answering"}

ARXIV_TAG_RE = re.compile(r"arxiv:(\d{4}\.\d{4,5})", re.IGNORECASE)


def http_get_json(url, timeout=60):
    req = urllib.request.Request(url, headers={"User-Agent": "llm-tracker-pipeline/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode())


# ── Source 1: OpenRouter catalog ──────────────────────────────────────────

def fetch_openrouter():
    """Return {mkey: candidate} from the OpenRouter catalog (canonical slugs)."""
    out = {}
    try:
        data = http_get_json("https://openrouter.ai/api/v1/models", timeout=60)
    except Exception as e:
        print(f"  OpenRouter fetch failed: {e}")
        return out
    for m in data.get("data", []):
        mid = _OR_VARIANT_RE.sub("", m.get("id", ""))
        if "/" not in mid:
            continue
        slug, _, rest = mid.partition("/")
        company = OR_SLUGS.get(slug)
        if not company:
            continue  # aggregators (deepinfra/fireworks/...) & unknowns skipped
        # Display name: "Qwen: Qwen3.8 Flash" -> "Qwen3.8 Flash";
        # drop pricing-tier/variant qualifiers, hyphenate, collapse to series.
        disp = (m.get("name") or "").strip()
        if ": " in disp:
            disp = disp.split(": ", 1)[1]
        disp = re.sub(r"\s*\((?:batch|new|preview|free|extended|thinking"
                      r"|offline|latest|contributor|standard)\)",
                      "", disp, flags=re.IGNORECASE)
        name = normalize_series(disp.replace(" ", "-")) if disp else ""
        if not name:
            continue
        created = m.get("created")
        try:
            date = datetime.fromtimestamp(int(created), tz=timezone.utc).strftime("%Y-%m-%d")
        except (TypeError, ValueError):
            date = ""
        out[mkey(company, name)] = {
            "model": name,
            "company": company,
            "date": date,
            "desc": (m.get("description") or "")[:400],
            "url": "",
            "source": "openrouter",
        }
    return out


# ── Source 2: HuggingFace org whitelist ───────────────────────────────────

def fetch_huggingface():
    """Return {mkey: candidate} from whitelisted HF orgs."""
    from extract_models import HF_ORGS
    out = {}
    for org, company in HF_ORGS.items():
        try:
            q = urllib.parse.quote(org)
            res = http_get_json(
                f"https://huggingface.co/api/models?author={q}"
                f"&sort=createdAt&direction=-1&limit={HF_PAGE_LIMIT}", timeout=60)
        except Exception as e:
            print(f"  HF org fetch failed ({org}): {e}")
            continue
        if not isinstance(res, list):
            continue
        for r in res:
            if r.get("pipeline_tag") not in ALLOWED_TAGS:
                continue
            repo_name = r["id"].split("/")[-1]
            if repo_name.lower().startswith(NOISE_FAMILIES):
                continue  # e.g. Microsoft Dayhoff protein checkpoints
            if QUANT_BLACKLIST.search(repo_name):
                continue
            name = normalize_series(repo_name)
            if not name or len(name) > 30:
                continue
            created = (r.get("createdAt") or "")[:10]
            arxiv_m = ARXIV_TAG_RE.search(" ".join(r.get("tags", [])))
            k = mkey(company, name)
            cand = {
                "model": name,
                "company": company,
                "date": created,
                "desc": "",
                "url": "https://huggingface.co/" + r["id"],
                "source": "huggingface",
                "repo": r["id"],
                "downloads": r.get("downloads", 0),
            }
            if arxiv_m:
                cand["arxiv"] = arxiv_m.group(1)
            if k not in out or (cand["date"] and not out[k]["date"]):
                out[k] = cand
        time.sleep(0.5)
    return out


# ── Classification & merge ────────────────────────────────────────────────

def looks_flagship(name):
    n = dkey(name)
    if not n:
        return False
    if QUANT_BLACKLIST.search(name):
        return False
    if re.search(r"\d", name):
        return True
    return n in NO_DIGIT_OK


def classify(cands, existing_keys):
    """Split candidates into auto-merge (high) and pending pools."""
    auto, pending = [], []
    for k, c in cands.items():
        if k in existing_keys:
            continue
        if not looks_flagship(c["model"]):
            pending.append({**c, "confidence": "medium",
                            "reason": "名称不像旗舰系列（无版本号）"})
            continue
        if not c.get("date"):
            pending.append({**c, "confidence": "medium", "reason": "缺少发布日期"})
            continue
        c["confidence"] = "high"
        auto.append(c)
    auto.sort(key=lambda c: c.get("date", ""), reverse=True)
    return auto, pending


def build_entry(c, note):
    entry = {
        "model": c["model"],
        "company": c["company"],
        "date": c["date"],
        "id": c.get("arxiv", ""),
        "title": "",
        "note": note,
        "papers": 0,
        "url": c.get("url") or "",
        "source": c["source"],
        "discovered": True,
    }
    if not entry["url"] and c.get("repo"):
        entry["url"] = "https://huggingface.co/" + c["repo"]
    return entry


def append_summary(text):
    try:
        with open(SUMMARY_TXT, "a", encoding="utf-8") as f:
            f.write(text)
    except OSError:
        pass


# ── Main ───────────────────────────────────────────────────────────────────

def main(argv=None):
    argv = argv if argv is not None else sys.argv[1:]
    dry_run = "--dry-run" in argv
    use_llm = "--no-llm" not in argv

    print("[discover_models] fetching sources...")
    or_cands = fetch_openrouter()
    hf_cands = fetch_huggingface()
    print(f"  OpenRouter candidates: {len(or_cands)}, HF candidates: {len(hf_cands)}")

    # merge both sources (HF wins on url/repo, OR contributes descriptions)
    cands = dict(or_cands)
    for k, c in hf_cands.items():
        if k in cands:
            cands[k]["model"] = c["model"]  # HF repo name is the official one
            cands[k]["url"] = c["url"]
            cands[k]["repo"] = c.get("repo")
            cands[k]["source"] = "hf+openrouter"
            if not cands[k].get("date"):
                cands[k]["date"] = c["date"]
            if c.get("arxiv"):
                cands[k].setdefault("arxiv", c["arxiv"])
        else:
            cands[k] = c

    data = load_json(MODELS_JSON, {"models": [], "groups": []})
    existing_keys = {mkey(m["company"], m["model"]) for m in data["models"]}
    auto, pending = classify(cands, existing_keys)

    merged = auto[:MAX_AUTO_MERGE]
    overflow = auto[MAX_AUTO_MERGE:]
    for c in overflow:
        pending.append({**c, "confidence": "high",
                        "reason": f"超出单次自动合并上限（>{MAX_AUTO_MERGE}），待下次或人工"})

    print(f"  auto-merge: {len(merged)}, pending: {len(pending)}")

    if merged and not dry_run:
        if use_llm:
            notes = llm_notes([{"key": mkey(c["company"], c["model"]),
                                "name": c["model"],
                                "context": c.get("desc", "")}
                               for c in merged])
        else:
            notes = {}
        new_keys = set()
        for c in merged:
            note = notes.get(mkey(c["company"], c["model"])) or \
                (c.get("desc", "")[:60] if c.get("desc") else FALLBACK_NOTE)
            entry = build_entry(c, note)
            insert_sorted(data["models"], entry)
            new_keys.add(mkey(c["company"], c["model"]))
            print(f"  + merged: {c['company']} {c['model']} ({c['date']}) "
                  f"[{c['source']}]")
        save_json(MODELS_JSON, data)
        rebuild_size_file(new_keys)
    elif merged:
        for c in merged:
            print(f"  (dry-run) would merge: {c['company']} {c['model']} "
                  f"({c['date']}) [{c['source']}]")

    # candidate pool file (both merged log & pending review items)
    pool = [
        {**{k2: v for k2, v in c.items() if k2 != "desc"},
         "status": "auto_merged"}
        for c in merged
    ] + [
        {k2: v for k2, v in c.items() if k2 != "desc"}
        for c in pending
    ]
    pool = pool[:MAX_CANDIDATES]
    if not dry_run:
        prev = load_json(DISCOVERED_JSON, {})
        payload = {
            "updated": datetime.now().strftime("%Y-%m-%d"),
            "strategy": "A (high-confidence auto-merge, cap %d/run)" % MAX_AUTO_MERGE,
            "auto_merged_today": [c["model"] for c in merged],
            "candidates": pool,
        }
        # skip write when only the date would change (avoid daily churn)
        if prev.get("candidates") == payload["candidates"] and \
           prev.get("auto_merged_today") == payload["auto_merged_today"]:
            print("  models-discovered.json unchanged, skipping write")
        else:
            save_json(DISCOVERED_JSON, payload)

    # daily summary for Feishu notification
    if merged:
        lines = ["", "🆕 模型自动发现（策略A）:"]
        for c in merged:
            lines.append(f"  + {c['company']} {c['model']}（{c['date']}，{c['source']}）")
        if pending:
            lines.append(f"  另有 {len(pending)} 个候选待人工确认（models-discovered.json）")
        if not dry_run:
            append_summary("\n".join(lines) + "\n")

    print(f"[discover_models] done: {len(merged)} merged, {len(pending)} pending")


if __name__ == "__main__":
    main()
