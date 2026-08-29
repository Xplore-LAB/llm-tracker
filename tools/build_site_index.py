#!/usr/bin/env python3
"""Build site-index.json: cross-page keyword search index for the whole site.

Reads hand-curated data sources (plain JSON) from _llm-tracker-src/data/ and
writes _llm-tracker-src/data/site-index.json (plain, will be XOR+base64
encoded by tools/build_protect.js like the other DATA files).

Sources covered:
  - glossary.json   -> 术语馆词条
  - model-tech.json -> 技术档案的 arch/decode/infra 条目
  - chronicle.json  -> 编年史事件
  - agents.json     -> Agent 前线动态
  - hardware.json   -> 硬件志术语 + 时间线
  - deploy.json     -> 部署实战章节 + docs 长文档

Usage: python3 tools/build_site_index.py   (run from repo root or anywhere)
"""
import json, os, re, sys
from datetime import date
from urllib.parse import quote

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(os.path.dirname(ROOT), "_llm-tracker-src", "data")
# fallback: sibling layout (GitHub/llm-tracker + GitHub/_llm-tracker-src)
if not os.path.isdir(SRC):
    SRC = os.path.join(ROOT, "..", "_llm-tracker-src", "data")

MAX_TEXT = 200  # 截断长度


def load(name):
    with open(os.path.join(SRC, name), encoding="utf-8") as f:
        return json.load(f)


def cut(s, n=MAX_TEXT):
    s = re.sub(r"<[^>]+>", "", str(s or "")).replace("\n", " ").strip()
    return s[:n] + ("…" if len(s) > n else "")


def dkey(model):
    return re.sub(r"[\s\-.]", "", model).lower()


def term_slug(en, term):
    src = (en or term or "").lower()
    src = re.sub(r"[^a-z0-9\u4e00-\u9fff]+", "-", src).strip("-")
    return src or "term"


# era spans must stay in sync with chronicle/index.html ERAS
ERAS = [
    ("pre", 1957, 2011), ("e1", 2012, 2016), ("e2", 2017, 2019),
    ("e3", 2020, 2021), ("e4", 2022, 2022), ("e5", 2023, 2023),
    ("e6", 2024, 2024), ("e7", 2025, 2025), ("e8", 2026, 2026),
]


def era_of(year):
    for key, lo, hi in ERAS:
        if lo <= year <= hi:
            return key
    return "e8"


def build():
    items = []

    # 1) glossary terms
    g = load("glossary.json")
    cats = g.get("cats", {})
    for t in g["terms"]:
        cat_label = (cats.get(t.get("cat")) or {}).get("label", "")
        items.append({
            "t": "term", "h": t["term"], "e": t.get("en", ""),
            "s": "术语馆 · " + cat_label,
            "x": cut(t.get("def", "") + " " + (t.get("detail") or "")),
            "u": "glossary/#term-" + term_slug(t.get("en"), t["term"]),
        })

    # 2) model-tech entries (per technique row)
    tech = load("model-tech.json")
    # original model display names from pipeline models.json (public data)
    display = {}
    try:
        with open(os.path.join(ROOT, "models.json"), encoding="utf-8") as f:
            mdata = json.load(f)
        for m in mdata["models"]:
            display[m["company"] + "|" + dkey(m["model"])] = (m["company"], m["model"])
    except Exception:
        pass
    grp_label = {"arch": "架构", "decode": "解码与推理", "infra": "训练基建"}
    for key, prof in tech.items():
        co, model = display.get(key, (key.split("|")[0], key.split("|")[-1]))
        for grp in ("arch", "decode", "infra"):
            for r in (prof.get(grp) or []):
                items.append({
                    "t": "tech", "h": r.get("k", ""),
                    "s": "技术档案 · %s（%s · %s）" % (model, co, grp_label[grp]),
                    "x": cut(r.get("v", "")),
                    "u": "models/?open=" + quote(key, safe=""),
                })

    # 3) chronicle events
    c = load("chronicle.json")
    cat_labels = {k: v.get("label", "") for k, v in c.get("categories", {}).items()}
    for e in c["events"]:
        det = e.get("detail") or {}
        text = e.get("note", "")
        if det.get("bg"):
            text += " " + det["bg"]
        for p in (det.get("points") or [])[:4]:
            text += " " + p
        items.append({
            "t": "event", "h": e["title"],
            "s": "编年史 · %s · %s" % (e.get("year"), cat_labels.get(e.get("cat"), "")),
            "x": cut(text),
            "u": "chronicle/?era=%s#ev-%s" % (era_of(e["year"]), e["date"].replace("-", "")),
        })

    # 4) agent front-line events
    a = load("agents.json")
    acats = {k: v.get("label", "") for k, v in a.get("categories", {}).items()}
    for e in a["events"]:
        items.append({
            "t": "agent", "h": e.get("title", ""),
            "s": "Agent 前线 · %s · %s" % (e.get("company", ""), acats.get(e.get("cat"), "")),
            "x": cut(e.get("note", "") or e.get("summary", "")),
            "u": "agents/?q=" + quote(e.get("title", ""), safe=""),
        })

    # 5) leaderboard models
    lb = load("leaderboard.json")
    for m in lb.get("models", []):
        bits = []
        if m.get("aa") is not None:
            bits.append("AA Index %s" % m["aa"])
        if m.get("arena") is not None:
            bits.append("Arena Elo %s" % m["arena"])
        text = " ".join(bits)
        if m.get("params"):
            text += " " + m["params"]
        if m.get("license"):
            text += " " + m["license"]
        for n in (m.get("notes") or [])[:2]:
            text += " " + n
        dk = re.sub(r"[\s.\-]", "", m["model"]).lower()
        items.append({
            "t": "rank", "h": m["model"],
            "s": "排行榜 · %s · %s" % (
                m.get("company", ""),
                "开放权重" if m.get("open") == "open" else "闭源"),
            "x": cut(text),
            "u": "leaderboard/?open=" + quote("%s|%s" % (m.get("company", ""), dk), safe=""),
        })

    # 6) hardware terms + timeline
    h = load("hardware.json")
    for t in h.get("terms", []):
        items.append({
            "t": "hard", "h": t.get("term", ""), "e": t.get("full", ""),
            "s": "硬件志 · 术语速查",
            "x": cut(t.get("desc", "")),
            "u": "hardware/",
        })
    for e in h.get("timeline", []):
        items.append({
            "t": "hard", "h": e.get("title", ""),
            "s": "硬件志 · %s · %s" % (e.get("year", ""), e.get("org", "")),
            "x": cut(e.get("note", "")),
            "u": "hardware/",
        })

    # 7) deploy sections + docs
    d = load("deploy.json")
    secmap = {"frameworks": "", "quant": "quant", "serving": "serving",
              "parallel": "parallel", "checklist": "checklist"}
    for key, sec in d.items():
        if not isinstance(sec, dict) or "title" not in sec:
            continue
        param = secmap.get(key, "")
        url = "deploy/" + ("?section=" + param if param else "")
        rows_text = " ".join(
            " ".join(str(cell) for cell in r) for r in (sec.get("rows") or [])
        )
        items.append({
            "t": "deploy", "h": sec["title"],
            "s": "部署实战 · 章节",
            "x": cut((sec.get("intro") or "") + " " + rows_text, 300),
            "u": url,
        })
    for doc in d.get("docs", []):
        items.append({
            "t": "doc", "h": doc.get("title", ""),
            "s": "部署实战 · 实操手册 · " + ", ".join(doc.get("tags", [])[:3]),
            "x": cut(doc.get("summary", "")),
            "u": "deploy/?section=docs",
        })

    out = {
        "meta": {
            "updated": date.today().isoformat(),
            "count": len(items),
            "note": "全站关键词搜索索引：术语馆 / 技术档案 / 编年史 / Agent 前线 / 硬件志 / 部署实战。由 tools/build_site_index.py 从 _llm-tracker-src/data/ 生成，改内容后重跑再构建。",
        },
        "items": items,
    }
    dst = os.path.join(SRC, "site-index.json")
    with open(dst, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    size_kb = os.path.getsize(dst) / 1024
    from collections import Counter
    stat = Counter(i["t"] for i in items)
    print("✅ site-index.json: %d 条 · %.0f KB · %s" % (len(items), size_kb, dict(stat)))
    print("   -> " + dst)


if __name__ == "__main__":
    build()
