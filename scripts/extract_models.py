#!/usr/bin/env python3
"""Model registry pipeline for llm-tracker (rewritten 2026-08-27).

The original extract_models.py was lost as a 0-byte file (root commit
ac82739 already had it empty), so the daily pipeline silently skipped
model extraction via fetch_papers.py's non-fatal try/except. This rewrite
restores the functionality with an append-only, non-destructive design:

1. Scan recent arXiv papers for NEW model-release papers of known companies.
2. Merge models-extra.json (manual channel) into models.json.
3. Rebuild models_with_size.json (carry over HF size data, look up new models).

Red lines (never violated):
- Existing entries in models.json are never modified or removed.
- The "groups" section of models.json is left untouched.
- model-tech.json (hand-curated tech profiles) is never touched.

Usage:
    python3 scripts/extract_models.py [--backfill-days 14] [--no-llm]
"""
import json
import os
import re
import sys
import time
import urllib.request
import urllib.parse
from datetime import datetime, timedelta

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

MODELS_JSON = os.path.join(ROOT, "models.json")
EXTRA_JSON = os.path.join(ROOT, "models-extra.json")
SIZE_JSON = os.path.join(ROOT, "models_with_size.json")
PAPERS_JSON = os.path.join(ROOT, "papers.json")

# ── Shared helpers (also used by discover_models.py) ──────────────────────

def dkey(name):
    """Canonical dedupe key for a model name (must match the site's nkey)."""
    return re.sub(r"[\s\-.]", "", name or "").lower()


def mkey(company, model):
    return f"{company}|{dkey(model)}"


# HuggingFace organization -> site company name (canonical mapping)
HF_ORGS = {
    "openai": "OpenAI",
    "google": "Google",
    "google-deepmind": "Google",
    "meta-llama": "Meta",
    "anthropic": "Anthropic",
    "deepseek-ai": "DeepSeek",
    "Qwen": "Qwen",
    "mistralai": "Mistral",
    "XiaomiMiMo": "Xiaomi",
    "MiniMaxAI": "MiniMax",
    "zai-org": "Zhipu",
    "THUDM": "Zhipu",
    "moonshotai": "Moonshot",
    "tencent-ai": "Tencent",
    "Tencent-Hunyuan": "Tencent",
    "microsoft": "Microsoft",
    "nvidia": "Nvidia",
    "ibm-granite": "IBM",
    "allenai": "AllenAI",
    "tiiuae": "TII",
    "xai-org": "xAI",
    "01-ai": "01.AI",
    "baichuan-inc": "Baichuan",
    "internlm": "InternLM",
    "databricks": "Databricks",
    "ai21labs": "AI21",
    "CohereLabs": "Cohere",
    "CohereForAI": "Cohere",
    "ByteDance-Seed": "ByteDance",
    "stepfun-ai": "StepFun",
    "Meituan-AI": "Meituan",
    "inclusionAI": "AntGroup",
    "OpenBMB": "ModelBest",
    "OpenPangu": "Huawei",
    "SkyworkAI": "Skywork",
    "exaone-ai": "LG",
    "LGAI-EXAONE": "LG",
}

# Reverse map: site company -> list of HF orgs
COMPANY_TO_ORGS = {}
for _org, _co in HF_ORGS.items():
    COMPANY_TO_ORGS.setdefault(_co, []).append(_org)

# Variant suffixes stripped to collapse size/format variants into series
_STRIP_TOKENS = re.compile(
    r"-(?:instruct|chat|base|it|latest|exp|preview|preview2|next|thinking"
    r"|fp8|fp16|fp32|bf16|fp6|tf32|int4|int8|awq|gptq|gguf|bnb|exl2|mlx|onnx"
    r"|4bit|8bit|quantized|quant|terminus|systemcard|contributor"
    r"|standard|proflagship|midtrain|assistant|tiny|small|sft|hf"
    r"|qat|w4a16|w8a16|w4a8|a16|w4|ct|ol|openlicense|nvfp4|mxfp4)$",
    re.IGNORECASE,
)
# Size markers: 12B, 170M, 2.4T, 235B-A22B, 2x7B, E4B ...
_STRIP_SIZE = re.compile(
    r"-(?:E?\d+(?:\.\d+)?(?:x\d+(?:\.\d+)?)?[BMT])(?:[-x]A?\d+(?:\.\d+)?[BMT])*$",
    re.IGNORECASE)
# Trailing date / checkpoint-step suffixes: -05-06, -122000, -0613
_STRIP_DATE = re.compile(r"-(?:\d{2}-\d{2}|\d{4,})$")
# Trailing parenthetical qualifiers: "-(Gemini-3.1-Flash-Lite-Image)"
_STRIP_PAREN = re.compile(r"[-\s]?\([^)]*\)$")


def normalize_series(name):
    """Collapse 'Qwen2.5-72B-Instruct' -> 'Qwen2.5' (series-level name)."""
    n = (name or "").strip()
    prev = None
    while prev != n:
        prev = n
        n = _STRIP_PAREN.sub("", n)
        n = _STRIP_TOKENS.sub("", n)
        n = _STRIP_SIZE.sub("", n)
        n = _STRIP_DATE.sub("", n)
        n = n.rstrip("-")
    if n and n[0].islower():
        n = n[0].upper() + n[1:]  # display nicety: granite-4.2 -> Granite-4.2
    return n


# Repo families that flood the org with non-LLM/checkpoint noise
NOISE_FAMILIES = ("dayhoff",)


QUANT_BLACKLIST = re.compile(
    r"(gguf|awq|gptq|int4|int8|fp8|fp16|bf16|fp32|bnb|exl2|mlx|onnx"
    r"|4bit|8bit|quant|compressed|dpo|grpo|ortho|nvfp4|mxfp4|\bfp4\b)",
    re.IGNORECASE
)

# Model names without digits that are still legitimate flagship series
NO_DIGIT_OK = {"aya", "jamba", "sora", "codex", "grok", "falcon",
               "minicpm", "longcat", "sensenova", "minimax-text"}


def load_json(path, default=None):
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return default


def save_json(path, data, indent=1):
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=indent)
        f.write("\n")
    os.replace(tmp, path)


def insert_sorted(models, entry):
    """Insert entry keeping models sorted by date ascending (stable)."""
    lo, hi = 0, len(models)
    while lo < hi:
        mid = (lo + hi) // 2
        if models[mid].get("date", "") <= entry.get("date", ""):
            lo = mid + 1
        else:
            hi = mid
    models.insert(lo, entry)


# ── LLM note generation (mirrors fetch_papers.generate_notes) ─────────────

def llm_notes(items):
    """Generate one-line Chinese notes via an OpenAI-compatible API.

    items: [{"key": str, "name": str, "context": str}] -> {key: note}
    Returns {} when LLM_API_KEY is not set or all batches fail.
    """
    if not items:
        return {}
    api_key = os.environ.get("LLM_API_KEY", "")
    if not api_key:
        print("  LLM_API_KEY not set, skipping note generation")
        return {}
    base_url = os.environ.get("LLM_BASE_URL", "https://api.moonshot.cn/v1").rstrip("/")
    model = os.environ.get("LLM_MODEL", "moonshot-v1-8k")

    sys_prompt = (
        "你在为大模型追踪网站生成模型条目的一句话中文介绍。"
        "对每个模型写一条不超过50个汉字的编辑式点评：说清模型定位与核心亮点；"
        "参考提供的官方介绍（可能为空），绝不臆造任何具体数字、基准成绩或参数规模；"
        "没有把握就写模型的公司与已知定位。"
        "只输出一个 JSON 对象，键是条目 key，值是介绍字符串。"
    )
    out = {}
    batch_size = 8
    for i in range(0, len(items), batch_size):
        batch = items[i:i + batch_size]
        body = json.dumps({
            "model": model,
            "temperature": 0.3,
            "messages": [
                {"role": "system", "content": sys_prompt},
                {"role": "user", "content": json.dumps(batch, ensure_ascii=False)},
            ],
        }).encode()
        req = urllib.request.Request(
            base_url + "/chat/completions", data=body,
            headers={"Content-Type": "application/json",
                     "Authorization": "Bearer " + api_key})
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                resp = json.loads(r.read().decode())
            content = resp["choices"][0]["message"]["content"]
            m = re.search(r"\{.*\}", content, re.DOTALL)
            notes = json.loads(m.group(0)) if m else {}
            for it in batch:
                note = notes.get(it["key"])
                if isinstance(note, str) and note.strip():
                    out[it["key"]] = note.strip()[:80]
        except Exception as e:
            print(f"  Note generation failed for batch {i // batch_size + 1}: {e}")
        time.sleep(2)
    return out


FALLBACK_NOTE = "（自动发现收录，待人工补注）"


# ── Step 1: arXiv scan for new model-release papers ───────────────────────

# Company -> title prefix families (lowercase), reused from fetch_papers.
COMPANY_PREFIXES = {
    "OpenAI": ["gpt-4", "gpt-5", "chatgpt", "o1", "o3", "o4", "sora", "codex", "gpt-oss"],
    "Google": ["gemini", "gemma", "palm"],
    "Anthropic": ["claude"],
    "Meta": ["llama"],
    "DeepSeek": ["deepseek"],
    "Qwen": ["qwen", "qwq"],
    "Mistral": ["mistral", "mixtral", "pixtral"],
    "Baidu": ["ernie", "wenxin"],
    "Xiaomi": ["mimo"],
    "MiniMax": ["minimax"],
    "Zhipu": ["glm", "chatglm", "codegeex", "cogvlm", "cogview"],
    "Moonshot": ["kimi"],
    "Tencent": ["hunyuan"],
    "Microsoft": ["phi"],
    "Nvidia": ["nemotron"],
    "IBM": ["granite"],
    "AllenAI": ["olmo"],
    "TII": ["falcon"],
    "xAI": ["grok"],
    "01.AI": ["yi"],
    "Baichuan": ["baichuan"],
    "InternLM": ["internlm"],
    "Databricks": ["dbrx"],
    "AI21": ["jamba"],
    "LG": ["exaone"],
    "Cohere": ["command"],
    "ByteDance": ["seed"],
    "StepFun": ["step"],
    "Meituan": ["longcat"],
    "AntGroup": ["ling", "ring"],
    "ModelBest": ["minicpm"],
    "Huawei": ["pangu"],
    "Skywork": ["skywork"],
    "SenseTime": ["sensenova", "sensechat"],
}

# Words that indicate a paper is a model release (not an analysis/benchmark)
RELEASE_MARKERS = re.compile(
    r"(technical report|system card|announcing|introducing|"
    r"releasing|the release of|meet )", re.IGNORECASE)

# Tokens that may follow the base name ("Claude 3.5 Sonnet", "GPT-4o mini")
_EXT_WORDS = {
    "sonnet", "opus", "haiku", "pro", "flash", "max", "mini", "nano", "air",
    "turbo", "vl", "omni", "coder", "vision", "thinking", "terminus", "exp",
    "instruct", "chat", "base", "latest", "preview", "next", "moe",
}


def extract_model_name_from_title(title):
    """Extract a model series name from a release-paper title."""
    # Prefer the part before ':' (e.g. "DeepSeek-V3.2: Advancing ...")
    head = title.split(":")[0] if ":" in title[:60] else title
    tokens = head.split()
    if not tokens:
        return None
    name = tokens[0].strip(",")
    # Greedily append version / variant tokens: "Claude 3.5 Sonnet"
    for tok in tokens[1:4]:
        t = tok.strip(",")
        if re.fullmatch(r"\d+(\.\d+)*[A-Za-z]{0,2}", t):
            name += " " + t
        elif t.lower() in _EXT_WORDS and len(name) + len(t) + 1 < 30:
            name += " " + t
        else:
            break
    return name or None


def scan_arxiv(window_days=14):
    """Scan recent papers for new model-release papers. Returns new entries."""
    papers = load_json(PAPERS_JSON, [])
    if not papers:
        print("  papers.json not found/empty, skipping arXiv scan")
        return []
    cutoff = (datetime.now() - timedelta(days=window_days)).strftime("%Y-%m-%d")
    data = load_json(MODELS_JSON, {"models": [], "groups": []})
    existing = {mkey(m["company"], m["model"]) for m in data["models"]}

    found = {}  # mkey -> entry draft
    for p in papers:
        date = p.get("date", "")
        if date < cutoff:
            continue
        title = p.get("title", "")
        if not title or not RELEASE_MARKERS.search(title):
            continue
        name = extract_model_name_from_title(title)
        if not name:
            continue
        low = name.lower()
        for company, prefixes in COMPANY_PREFIXES.items():
            if any(low.startswith(pf) for pf in prefixes):
                break
        else:
            continue
        series = normalize_series(name)
        sk = mkey(company, series)
        if sk in existing or sk in found:
            continue
        if not (re.search(r"\d", series) or dkey(series) in NO_DIGIT_OK):
            continue
        if QUANT_BLACKLIST.search(series):
            continue
        found[sk] = {
            "model": series,
            "company": company,
            "date": date,
            "id": p.get("id", ""),
            "title": title,
            "note": "",
            "papers": 1,
            "source": "arxiv",
            "discovered": True,
        }
    return list(found.values())


# ── Step 2: merge models-extra.json (manual channel) ──────────────────────

ARXIV_URL_RE = re.compile(r"arxiv\.org/abs/([0-9]{4}\.[0-9]{4,5})", re.IGNORECASE)


def merge_extra():
    """Merge models-extra.json entries missing from models.json."""
    extra = load_json(EXTRA_JSON, [])
    if not extra:
        return []
    data = load_json(MODELS_JSON, {"models": [], "groups": []})
    existing = {mkey(m["company"], m["model"]) for m in data["models"]}
    added = []
    for e in extra:
        k = mkey(e.get("company", ""), e.get("model", ""))
        if k in existing:
            continue
        m = re.search(ARXIV_URL_RE, e.get("url", "") or "")
        entry = {
            "model": e["model"],
            "company": e["company"],
            "date": e.get("date", ""),
            "id": m.group(1) if m else "",
            "title": "",
            "note": e.get("note", ""),
            "papers": 0,
            "url": e.get("url", ""),
            "extra": True,
        }
        insert_sorted(data["models"], entry)
        existing.add(k)
        added.append(entry)
    if added:
        save_json(MODELS_JSON, data)
    return added


# ── Step 3: rebuild models_with_size.json ─────────────────────────────────

HF_HOSTS = ["https://hf-mirror.com", "https://huggingface.co"]


def _hf_get(path):
    """GET an HF API path, trying mirror hosts in order."""
    last = None
    for host in HF_HOSTS:
        try:
            req = urllib.request.Request(host + path,
                                         headers={"User-Agent": "llm-tracker-pipeline/1.0"})
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.loads(r.read().decode())
        except Exception as e:
            last = e
    print(f"  HF GET failed: {path[:80]} ({last})")
    return None


def find_hf_repo(company, model):
    """Locate the HF repo for a model by searching the company's orgs.

    Resolution order: exact repo path -> exact name match in search ->
    shortest prefix match (so 'Qwen3.8' prefers 'Qwen/Qwen3.8' over
    'Qwen/Qwen3.8-Flash-Next').
    """
    orgs = COMPANY_TO_ORGS.get(company, [])
    target = dkey(model)
    for org in orgs:
        # 1) direct repo path (deterministic, no search ranking involved)
        direct = _hf_get(f"/api/models/{urllib.parse.quote(org)}/{urllib.parse.quote(model)}")
        if isinstance(direct, dict) and direct.get("id"):
            return direct["id"]
    for org in orgs:
        q = urllib.parse.quote(model)
        res = _hf_get(f"/api/models?search={q}&author={urllib.parse.quote(org)}&limit=20")
        if not isinstance(res, list):
            continue
        for r in res:
            if dkey(r["id"].split("/")[-1]) == target:
                return r["id"]
        # 2) variant fallback: repo must NORMALIZE to exactly the target
        #    ('Qwen3.8-27B' -> 'Qwen3.8' OK; 'GLM-5.3-Flash' -> 'GLM-5.3' NOT)
        for r in res:
            if dkey(normalize_series(r["id"].split("/")[-1])) == target:
                return r["id"]
    return None


def hf_repo_size_gb(repo_id):
    """Sum safetensors/bin bytes via the tree API (recursive, paginated)."""
    cursor = ""
    total = 0
    pages = 0
    while pages < 30:
        path = f"/api/models/{repo_id}/tree/main?recursive=true"
        if cursor:
            path += "&cursor=" + urllib.parse.quote(cursor)
        items = None
        link = ""
        for host in HF_HOSTS:
            try:
                req = urllib.request.Request(host + path,
                                             headers={"User-Agent": "llm-tracker-pipeline/1.0"})
                with urllib.request.urlopen(req, timeout=60) as r:
                    items = json.loads(r.read().decode())
                    link = r.headers.get("Link", "")
                break
            except Exception:
                continue
        if items is None:
            return None
        for it in items:
            if isinstance(it, dict) and it.get("type") == "file":
                if it.get("path", "").endswith((".safetensors", ".bin", ".pt", ".pth")):
                    total += it.get("size") or 0
        m = re.search(r"cursor=([^&>]+)", link)
        if not m:
            break
        cursor = urllib.parse.unquote(m.group(1))
        pages += 1
        time.sleep(0.3)
    if total <= 0:
        return None
    return round(total / 1024 ** 3, 2)


def _same_sizes(a, b):
    ka = {mkey(m["company"], m["model"]): (m.get("hf_repo"), m.get("size_total_gb"))
          for m in a}
    kb = {mkey(m["company"], m["model"]): (m.get("hf_repo"), m.get("size_total_gb"))
          for m in b}
    return ka == kb


def rebuild_size_file(new_keys=None):
    """Regenerate models_with_size.json from models.json.

    Existing size data is carried over verbatim; models in new_keys get a
    fresh HF lookup. Skips writing when nothing but metadata would change.
    """
    data = load_json(MODELS_JSON, None)
    if not data:
        print("  models.json missing, skipping size rebuild")
        return
    old = load_json(SIZE_JSON, {"models": []})
    old_map = {mkey(m["company"], m["model"]): m for m in old.get("models", [])}

    out_models = []
    with_size = 0
    for m in data["models"]:
        k = mkey(m["company"], m["model"])
        prev = old_map.get(k) or {}
        entry = dict(m)
        entry["hf_repo"] = prev.get("hf_repo")
        entry["size_total_gb"] = prev.get("size_total_gb")
        entry["source"] = prev.get("source", "no_mapping")

        if entry["size_total_gb"] is None and (new_keys is None or k in new_keys):
            repo = entry["hf_repo"] or find_hf_repo(m["company"], m["model"])
            if repo:
                entry["hf_repo"] = repo
                size = hf_repo_size_gb(repo)
                if size:
                    entry["size_total_gb"] = size
                    entry["source"] = "hf_tree"
                    print(f"  size: {m['model']} -> {size} GB ({repo})")
            time.sleep(0.5)

        if entry["size_total_gb"] is not None:
            with_size += 1
        out_models.append(entry)

    total = len(out_models)
    # Skip rewrite when nothing changed (avoid fetch_time churn in git)
    if old and old.get("models") == out_models:
        print(f"  models_with_size.json unchanged ({total} models, "
              f"{with_size} with size), skipping write")
        return

    out = {
        "version": "3.1",
        "schema_note": "基于 Xplore-LAB/llm-tracker/models.json 增强,新增 hf_repo + 存储字节",
        "fetch_time": datetime.now().strftime("%Y-%m-%d"),
        "total_models": total,
        "with_real_size": with_size,
        "coverage": f"{with_size * 100 / total:.1f}%" if total else "0%",
        "data_sources": {
            "models_json": "https://github.com/Xplore-LAB/llm-tracker/blob/master/models.json",
            "hf_size": "https://hf-mirror.com/api/models/{repo_id}/tree/main?recursive=true",
        },
        "models": out_models,
    }
    save_json(SIZE_JSON, out, indent=2)
    print(f"  models_with_size.json: {total} models, {with_size} with size "
          f"({out['coverage']})")


# ── Main ───────────────────────────────────────────────────────────────────

def main(argv=None):
    argv = argv if argv is not None else sys.argv[1:]
    backfill_days = 14
    use_llm = True
    if "--backfill-days" in argv:
        backfill_days = int(argv[argv.index("--backfill-days") + 1])
    if "--no-llm" in argv:
        use_llm = False

    print(f"[extract_models] backfill window: {backfill_days} days")

    # Step 1: arXiv scan
    candidates = scan_arxiv(backfill_days)
    new_keys = set()
    if candidates:
        if use_llm:
            notes = llm_notes([{"key": mkey(c["company"], c["model"]),
                                "name": c["model"],
                                "context": c.get("title", "")}
                               for c in candidates])
            for c in candidates:
                c["note"] = notes.get(mkey(c["company"], c["model"])) or FALLBACK_NOTE
        data = load_json(MODELS_JSON, {"models": [], "groups": []})
        existing = {mkey(m["company"], m["model"]) for m in data["models"]}
        added = 0
        for c in candidates:
            k = mkey(c["company"], c["model"])
            if k in existing:
                continue
            insert_sorted(data["models"], c)
            existing.add(k)
            new_keys.add(k)
            added += 1
            print(f"  + arXiv: {c['company']} {c['model']} ({c['date']})")
        if added:
            save_json(MODELS_JSON, data)
    else:
        print("  arXiv scan: no new models")

    # Step 2: merge manual channel
    extra_added = merge_extra()
    for e in extra_added:
        print(f"  + extra: {e['company']} {e['model']} ({e['date']})")
        new_keys.add(mkey(e["company"], e["model"]))

    # Step 3: size file
    rebuild_size_file(new_keys or None)

    total = len(load_json(MODELS_JSON, {"models": []})["models"])
    print(f"[extract_models] done, models.json now has {total} models")


if __name__ == "__main__":
    main()
