#!/usr/bin/env python3
"""Leaderboard auto-updater for llm-tracker (Artificial Analysis official API).

Data source: GET https://artificialanalysis.ai/api/v2/data/llms/models
- Free tier, 1000 req/day, header `x-api-key: $AA_API_KEY`.
- No key -> graceful skip (exit 0), workflow stays green.
- Attribution to artificialanalysis.ai is required by their ToS; the
  leaderboard page footer already carries it.

What it does:
1. Decodes repo-root leaderboard.json (XOR+base64, same convention as
   build_protect.js / discover_agent_news.py, key XploreLAB#2026$Chronicle).
2. Fetches AA model list, matches entries to our models by normalized
   (company, model) key. Multiple AA reasoning variants of one model
   (e.g. "(max)" / "(high)") collapse to the highest Intelligence Index,
   matching the site convention "AA 多档位取最高档".
3. Updates only these AA-sourced fields: aa, aa_variant, price_in,
   price_out, speed, ttft. Arena Elo has no public API (site 403s direct
   fetches) and is left untouched. Nothing else is modified.
4. Re-encodes and writes leaderboard.json only when something changed,
   so the workflow commit step can no-op on quiet days.

NOTE: the plaintext source lives OUTSIDE this repo at
_llm-tracker-src/data/leaderboard.json. After this script lands changes
in CI, sync the decoded JSON back to the plaintext source before the next
local build, or the build will overwrite CI updates (same convention as
the agents pipeline).

Usage:
    AA_API_KEY=... python3 scripts/update_leaderboard.py [--dry-run]
"""
import json
import os
import re
import sys
import base64
import urllib.request
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LB_JSON = os.path.join(ROOT, "leaderboard.json")
XOR_KEY = "XploreLAB#2026$Chronicle"
API_URL = "https://artificialanalysis.ai/api/v2/data/llms/models"

# AA model_creator.slug -> site company name (leaderboard.json "company")
CREATOR_MAP = {
    "openai": "OpenAI",
    "anthropic": "Anthropic",
    "google": "Google",
    "google-deepmind": "Google",
    "x-ai": "xAI",
    "meta": "Meta",
    "meta-llama": "Meta",
    "deepseek": "DeepSeek",
    "alibaba": "Qwen",
    "qwen": "Qwen",
    "moonshotai": "Moonshot",
    "moonshot": "Moonshot",
    "z-ai": "Zhipu",
    "minimax": "MiniMax",
    "mistral": "Mistral",
    "mistralai": "Mistral",
    "microsoft": "Microsoft",
    "nvidia": "Nvidia",
    "ibm": "IBM",
    "tencent": "Tencent",
    "bytedance": "ByteDance",
    "baidu": "Baidu",
    "xiaomi": "Xiaomi",
    "inclusionai": "AntGroup",
    "lg-ai": "LG",
    "lg": "LG",
    "stepfun-ai": "StepFun",
    "amazon": "Amazon",
    "cohere": "Cohere",
    "ai21": "AI21",
    "allenai": "AllenAI",
    "perplexity": "Perplexity",
    "meituan": "Meituan",
}

_VARIANT_RE = re.compile(r"\s*\(([^)]*)\)\s*$")


def decode_json(path):
    raw = open(path, "rb").read().strip()
    data = base64.b64decode(raw)
    k = XOR_KEY.encode()
    plain = bytes(b ^ k[i % len(k)] for i, b in enumerate(data))
    return json.loads(plain.decode("utf-8"))


def encode_json(obj, path):
    plain = json.dumps(obj, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    k = XOR_KEY.encode()
    enc = bytes(b ^ k[i % len(k)] for i, b in enumerate(plain))
    with open(path, "wb") as f:
        f.write(base64.b64encode(enc))


def dkey(name):
    """Match the site's dkey: strip spaces/dots/dashes, lowercase."""
    return re.sub(r"[\s.\-]", "", name).lower()


def norm_model(name):
    """Strip trailing reasoning-variant suffix like '(max)' / '(high)'."""
    m = _VARIANT_RE.search(name or "")
    variant = m.group(1).strip().lower() if m else ""
    base = _VARIANT_RE.sub("", name or "").strip()
    return dkey(base), variant


def fetch_aa(api_key):
    req = urllib.request.Request(
        API_URL,
        headers={"x-api-key": api_key, "Accept": "application/json",
                 "User-Agent": "llm-tracker-pipeline/1.0"})
    with urllib.request.urlopen(req, timeout=90) as r:
        body = json.loads(r.read().decode())
    return body.get("data", [])


def build_aa_index(aa_models):
    """{(creator_slug, dkey): best variant record} by Intelligence Index."""
    best = {}
    for m in aa_models:
        creator = (m.get("model_creator") or {}).get("slug", "")
        mk, variant = norm_model(m.get("name") or m.get("slug") or "")
        if not creator or not mk:
            continue
        ev = m.get("evaluations") or {}
        ii = ev.get("artificial_analysis_intelligence_index")
        key = (creator, mk)
        rec = {
            "ii": ii,
            "variant": variant,
            "price_in": (m.get("pricing") or {}).get("price_1m_input_tokens"),
            "price_out": (m.get("pricing") or {}).get("price_1m_output_tokens"),
            "speed": m.get("median_output_tokens_per_second"),
            "ttft": m.get("median_time_to_first_token_seconds"),
            "aa_name": m.get("name"),
        }
        cur = best.get(key)
        if cur is None or (ii is not None and (cur["ii"] is None or ii > cur["ii"])):
            best[key] = rec
    return best


def main(argv=None):
    argv = argv if argv is not None else sys.argv[1:]
    dry_run = "--dry-run" in argv

    api_key = os.environ.get("AA_API_KEY") or os.environ.get("ARTIFICIAL_ANALYSIS_API_KEY") or ""
    if not api_key:
        print("[update_leaderboard] AA_API_KEY not set, skipping (get one free at "
              "https://artificialanalysis.ai/api-reference then add repo secret AA_API_KEY)")
        return 0

    print("[update_leaderboard] fetching AA model list...")
    try:
        aa_models = fetch_aa(api_key)
    except Exception as e:
        print(f"[update_leaderboard] AA fetch failed: {e}")
        return 1
    print(f"  AA models: {len(aa_models)}")
    aa_index = build_aa_index(aa_models)

    lb = decode_json(LB_JSON)
    models = lb.get("models", [])
    slug_by_company = {}
    for comp in {m.get("company", "") for m in models}:
        slug_by_company.setdefault(comp, None)
    # reverse map: site company -> set of AA creator slugs
    company_to_slugs = {}
    for slug, comp in CREATOR_MAP.items():
        company_to_slugs.setdefault(comp, set()).add(slug)

    changes = []
    for m in models:
        comp = m.get("company", "")
        mk = dkey(m.get("model", ""))
        rec = None
        for slug in company_to_slugs.get(comp, ()):
            if (slug, mk) in aa_index:
                rec = aa_index[(slug, mk)]
                break
        if not rec:
            continue
        diff = {}

        def upd(field, new, cast=None):
            if new is None:
                return
            if cast:
                try:
                    new = cast(new)
                except (TypeError, ValueError):
                    return
            if m.get(field) != new:
                diff[field] = (m.get(field), new)
                m[field] = new

        upd("aa", rec["ii"], lambda v: int(round(v)))
        if rec["variant"]:
            upd("aa_variant", rec["variant"], str)
        upd("price_in", rec["price_in"], lambda v: round(float(v), 2))
        upd("price_out", rec["price_out"], lambda v: round(float(v), 2))
        upd("speed", rec["speed"], lambda v: int(round(v)))
        upd("ttft", rec["ttft"], lambda v: round(float(v), 2))
        if diff:
            changes.append((comp, m.get("model"), diff))
            print(f"  ~ {comp} {m.get('model')}: " +
                  ", ".join(f"{k} {a}->{b}" for k, (a, b) in diff.items()))

    if not changes:
        print("[update_leaderboard] no changes, leaderboard.json untouched")
        return 0

    lb.setdefault("_schema", {})["snapshot"] = \
        "AA API " + datetime.now(timezone.utc).strftime("%Y-%m-%d")
    if dry_run:
        print(f"[update_leaderboard] dry-run: {len(changes)} model(s) would change, file not written")
        return 0
    encode_json(lb, LB_JSON)
    print(f"[update_leaderboard] done: {len(changes)} model(s) updated, leaderboard.json re-encoded")

    # Local dev convenience: when the plaintext source tree exists next to the
    # repo, write it back in the same pretty format build_protect.js consumes,
    # so the next local build cannot overwrite CI updates.
    src = os.path.join(os.path.dirname(ROOT), "_llm-tracker-src", "data", "leaderboard.json")
    if os.path.isfile(src):
        with open(src, "w", encoding="utf-8") as f:
            json.dump(lb, f, ensure_ascii=False, indent=1)
            f.write("\n")
        print(f"  plaintext source synced: {src}")
    else:
        print("  REMINDER: plaintext source not found locally; sync decoded JSON back to "
              "_llm-tracker-src/data/leaderboard.json before the next local build")
    return 0


if __name__ == "__main__":
    sys.exit(main())
