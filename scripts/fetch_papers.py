#!/usr/bin/env python3
"""Fetch LLM papers from arXiv with full accumulation and proper company classification.

Key improvements:
- Correct arXiv query syntax: (cat:cs.CL OR cat:cs.AI) AND (query)
- Company papers validated by author/affiliation only (not abstract)
- max_results=100 per topic, 50 per company
- Generates timeline-data.json
- Accumulates all data across runs

Usage: python3 fetch_papers.py
"""
import urllib.request, urllib.parse, json, os, re, time
from datetime import datetime, timedelta, timezone

# ── Topic queries (for general papers) ─────────────────────
QUERIES = [
    ("RAG",         '(ti:"retrieval augmented generation" OR abs:"retrieval augmented generation" OR (ti:RAG AND abs:RAG) OR (ti:RAG AND ti:LLM))'),
    ("Agent",       '(ti:"LLM agent" OR abs:"LLM agent" OR ti:"language model agent" OR abs:"language model agent" OR (ti:agent AND abs:"large language model"))'),
    ("MCP",         '(ti:"model context protocol" OR abs:"model context protocol" OR (abs:"tool use" AND abs:"language model"))'),
    ("Reasoning",   '(ti:"chain of thought" OR abs:"chain of thought" OR (abs:reasoning AND abs:"large language model"))'),
    ("Multimodal",  '(ti:multimodal OR abs:multimodal) AND (abs:"language model" OR abs:LLM OR abs:VLM)'),
    ("Fine-tuning", '(ti:LoRA OR abs:LoRA OR ti:QLoRA OR abs:QLoRA OR abs:RLHF OR (abs:"instruction tuning" AND abs:LLM))'),
    ("Safety",      '(ti:"AI safety" OR abs:"AI safety" OR (abs:alignment AND abs:"language model"))'),
    ("LLM",         '(ti:"large language model" OR abs:"large language model" OR ti:"foundation model" OR abs:"foundation model" OR abs:"large models")'),
]

# ── Company queries (title-based + author validation) ─────
# Each company has: (query, author_keywords)
# author_keywords: list of strings that MUST appear in author names or affiliations
COMPANY_CONFIG = {
    "OpenAI": {
        "query": 'ti:gpt-4o OR ti:"o1" OR ti:"o3" OR ti:o4-mini OR ti:sora OR ti:chatgpt OR ti:codex',
        "author_keywords": ["openai"],
    },
    "Google": {
        "query": 'ti:gemini OR ti:gemma OR ti:palm OR ti:bard',
        "author_keywords": ["google", "deepmind", "google research", "google deepmind"],
    },
    "Anthropic": {
        "query": 'ti:claude',
        "author_keywords": ["anthropic"],
    },
    "Meta": {
        "query": 'ti:llama OR ti:"llama-" OR ti:fairseq',
        "author_keywords": ["meta ai", "meta platforms", "fair", "facebook ai", "meta research", "facebook ai research"],
    },
    "DeepSeek": {
        "query": 'ti:deepseek',
        "author_keywords": ["deepseek"],
    },
    "Qwen": {
        "query": 'ti:qwen OR ti:"tongyi qianwen"',
        "author_keywords": ["alibaba", "qwen", "tongyi", "damo"],
    },
    "Mistral": {
        "query": 'ti:mistral OR ti:mixtral OR ti:pixtral',
        "author_keywords": ["mistral"],
    },
    "Baidu": {
        "query": 'ti:ernie OR ti:"wenxin" OR ti:paddleocr',
        "author_keywords": ["baidu"],
    },
    "Xiaomi": {
        "query": 'ti:mimo OR ti:xiaomi',
        "author_keywords": ["xiaomi"],
    },
    "MiniMax": {
        "query": 'ti:minimax OR ti:"MiniMax-01" OR ti:"MiniMax-V"',
        "author_keywords": ["minimax"],
    },
    "Zhipu": {
        "query": 'ti:glm-4 OR ti:chatglm OR ti:zhipu OR ti:codegeex OR ti:cogvlm',
        "author_keywords": ["zhipu", "tsinghua", "chatglm"],
    },
    # ── Open-weights model companies ──────────────────────
    "Moonshot": {
        "query": 'ti:kimi OR ti:moonshot',
        "author_keywords": ["moonshot", "kimi"],
    },
    "Tencent": {
        "query": 'ti:hunyuan',
        "author_keywords": ["tencent", "hunyuan"],
    },
    "Microsoft": {
        "query": 'ti:"phi-2" OR ti:"phi-3" OR ti:"phi-4"',
        "author_keywords": ["microsoft"],
    },
    "Nvidia": {
        "query": 'ti:nemotron',
        "author_keywords": ["nvidia", "nemotron"],
    },
    "IBM": {
        "query": 'ti:granite',
        "author_keywords": ["ibm", "granite"],
    },
    "AllenAI": {
        "query": 'ti:olmo',
        "author_keywords": ["allen institute", "allenai", "ai2", "olmo"],
    },
    "TII": {
        "query": 'ti:falcon',
        "author_keywords": ["technology innovation institute", "tii", "falcon"],
    },
    "xAI": {
        "query": 'ti:grok',
        "author_keywords": ["xai", "grok"],
    },
    "01.AI": {
        "query": 'ti:"yi-34b" OR ti:"yi-6b" OR ti:"yi-9b" OR ti:"yi-1.5" OR ti:"yi-large" OR ti:"yi-coder" OR ti:"yi-vl" OR ti:"yi-lightning"',
        "author_keywords": ["01.ai", "lingyi", "yi-"],
    },
    "Baichuan": {
        "query": 'ti:baichuan',
        "author_keywords": ["baichuan"],
    },
    "InternLM": {
        "query": 'ti:internlm OR ti:internvl OR ti:internvideo',
        "author_keywords": ["shanghai ai laboratory", "internlm", "pjlab", "opengvlab"],
    },
    "Databricks": {
        "query": 'ti:dbrx',
        "author_keywords": ["databricks", "mosaic"],
    },
    "AI21": {
        "query": 'ti:jamba',
        "author_keywords": ["ai21", "jamba"],
    },
    "LG": {
        "query": 'ti:exaone',
        "author_keywords": ["lg ai", "lg research", "exaone"],
    },
    "Cohere": {
        "query": 'ti:cohere OR ti:"command a" OR ti:"command r"',
        "author_keywords": ["cohere"],
    },
    # ── More Chinese model companies ─────────────────
    "ByteDance": {
        "query": 'ti:"seed-oss" OR ti:"seed1.5" OR ti:"seed-vl" OR ti:"seed2.0"',
        "author_keywords": ["bytedance", "seed team"],
    },
    "StepFun": {
        "query": 'ti:"step-3" OR ti:"step-2" OR ti:"step-audio" OR ti:"step-1x"',
        "author_keywords": ["stepfun", "step fun"],
    },
    "Meituan": {
        "query": 'ti:longcat',
        "author_keywords": ["meituan", "longcat"],
    },
    "AntGroup": {
        "query": 'ti:"ling-1t" OR ti:"ring-1t" OR ti:"ling-flash" OR ti:"ling-lite" OR ti:"ming-lite"',
        "author_keywords": ["ant group", "antgroup", "inclusionai", "bailing"],
    },
    "ModelBest": {
        "query": 'ti:minicpm',
        "author_keywords": ["modelbest", "openbmb", "thunlp", "minicpm"],
    },
    "Huawei": {
        "query": 'ti:pangu',
        "author_keywords": ["huawei", "pangu"],
    },
    "Skywork": {
        "query": 'ti:skywork',
        "author_keywords": ["skywork", "kunlun"],
    },
    "SenseTime": {
        "query": 'ti:sensenova OR ti:sensechat',
        "author_keywords": ["sensetime", "sense time"],
    },
}

TAG_RULES = [
    ('RAG',        r'retrieval|rag\b|knowledge base'),
    ('Agent',      r'agent|tool use|react\b|planning|autonomous'),
    ('Reasoning',  r'reasoning|chain.of.thought|cot\b|math|logic'),
    ('Multimodal', r'multimodal|vision|image|visual|vlm|video'),
    ('Fine-tuning',r'lora|rlhf|fine.tun|instruction tun|sft\b|dpo\b'),
    ('Safety',     r'safety|alignment|red.team|harmful|jailbreak'),
    ('LLM',        r'large language model|llm\b|foundation model'),
    ('MCP',        r'model context protocol|mcp\b|tool integration'),
]

MAX_RESULTS_TOPIC = 120
MAX_RESULTS_COMPANY = 50

# ── Affiliation sweep config ─────────────────────────────
# arXiv's Atom API does not expose author affiliations, but the LaTeXML HTML
# rendering (arxiv.org/html/<id>) shows them. The sweep fetches recent
# LLM-related papers (cs.CL + cs.AI + cs.LG), checks each paper's author
# block once against per-company affiliation keywords, and claims matched
# papers into company-papers.json. Catches vendor papers whose titles lack
# brand names (e.g. Hunyuan's "When Do Larger Batches Help Scale LLM RL?").
SWEEP_QUERY = (
    'ti:LLM OR abs:LLM OR ti:"language model" OR abs:"language model" '
    'OR ti:"language models" OR abs:"language models" '
    'OR ti:GPT OR abs:GPT OR abs:"foundation model"'
)
SWEEP_CATS = "(cat:cs.CL OR cat:cs.AI OR cat:cs.LG)"
SWEEP_DAYS_DEFAULT = 7
SWEEP_PAGE = 400            # arXiv API page size for the sweep
SWEEP_MAX_TOTAL = 1200      # newest-first hard cap per run
SWEEP_STATE = "papers-affil-checked.json"
SWEEP_STATE_PRUNE_DAYS = 45

# Conservative affiliation keywords (word-boundary matched for single words,
# substring matched for phrases). Tighter than COMPANY_CONFIG author_keywords
# on purpose: an affiliation sweep must not claim academic papers that merely
# collaborate with or mention a vendor.
AFFILIATION_KEYWORDS = {
    "OpenAI":   ["openai"],
    "Google":   ["google deepmind", "deepmind", "google research", "google brain",
                 "google llc", "google cloud"],
    "Anthropic": ["anthropic"],
    "Meta":     ["meta platforms", "meta ai", "meta fair", "meta reality labs", "facebook"],
    "DeepSeek": ["deepseek"],
    "Qwen":     ["qwen", "tongyi", "alibaba", "damo academy", "aliyun"],
    "Mistral":  ["mistral ai", "mistral"],
    "Baidu":    ["baidu"],
    "Xiaomi":   ["xiaomi"],
    "MiniMax":  ["minimax"],
    "Zhipu":    ["zhipu", "chatglm"],
    "Moonshot": ["moonshot"],
    "Tencent":  ["tencent", "hunyuan"],
    "Microsoft": ["microsoft"],
    "Nvidia":   ["nvidia"],
    "IBM":      ["ibm"],
    "AllenAI":  ["allen institute", "allenai", "ai2"],
    "TII":      ["technology innovation institute", "advanced technology research council"],
    "xAI":      ["xai", "x.ai"],
    "01.AI":    ["01.ai", "lingyi"],
    "Baichuan": ["baichuan"],
    "InternLM": ["shanghai artificial intelligence laboratory", "shanghai ai laboratory",
                 "shanghai ai lab", "internlm", "shanghai innovation institute"],
    "Databricks": ["databricks", "mosaicml"],
    "AI21":     ["ai21"],
    "LG":       ["lg ai research", "lg electronics"],
    "Cohere":   ["cohere"],
    "ByteDance": ["bytedance", "byte dance"],
    "StepFun":  ["stepfun", "step fun"],
    "Meituan":  ["meituan"],
    "AntGroup": ["ant group", "antgroup", "inclusionai"],
    "ModelBest": ["modelbest", "openbmb"],
    "Huawei":   ["huawei", "noah's ark"],
    "Skywork":  ["skywork"],
    "SenseTime": ["sensetime", "sense time"],
}


def fetch_arxiv(query, tag, max_results=30, start=0, cats="(cat:cs.CL OR cat:cs.AI)"):
    """Fetch papers from arXiv API with correct query syntax and 429 retry."""
    import http.client
    params = urllib.parse.urlencode({
        "search_query": f"{cats} AND ({query})",
        "start": start,
        "max_results": max_results,
        "sortBy": "submittedDate",
        "sortOrder": "descending"
    })
    url = "https://export.arxiv.org/api/query?" + params
    max_retries = 3
    for attempt in range(max_retries):
        try:
            with urllib.request.urlopen(url, timeout=60) as r:
                content = r.read().decode()
                break
        except urllib.error.HTTPError as e:
            if e.code == 429:
                wait = (attempt + 1) * 30
                print(f"  Rate limited [{tag}] attempt {attempt+1}/{max_retries}, waiting {wait}s...")
                time.sleep(wait)
            else:
                print(f"  HTTP Error [{tag}]: {e.code} {e.reason}")
                return []
        except Exception as e:
            print(f"  Error [{tag}]: {e}")
            return []
    else:
        print(f"  Failed [{tag}]: max retries exceeded")
        return []

    papers = []
    for entry in re.findall(r'<entry>(.*?)</entry>', content, re.DOTALL):
        def get(f):
            m = re.search(rf'<{f}[^>]*>(.*?)</{f}>', entry, re.DOTALL)
            return m.group(1).strip() if m else ""

        m = re.search(r'<id>.*?/abs/([^v<\n]+)', entry)
        if not m:
            continue
        pid = m.group(1).strip()
        title = re.sub(r'\s+', ' ', get('title'))
        abstract = re.sub(r'\s+', ' ', get('summary'))[:500]
        authors_raw = re.findall(r'<name>(.*?)</name>', entry)
        authors = ', '.join(authors_raw[:3]) + (' et al.' if len(authors_raw) > 3 else '')
        affiliations = re.findall(r'<arxiv:affiliation[^>]*>(.*?)</arxiv:affiliation>', entry)
        published = get('published')[:10]
        year = int(published[:4]) if published else 2025

        papers.append({
            "id": pid, "title": title, "authors": authors,
            "author_list": authors_raw,
            "affiliations": affiliations,
            "year": year, "date": published, "cite": 0,
            "tags": [tag], "abstract": abstract
        })
    return papers


def verify_company(paper, company, author_keywords):
    """Verify paper is actually from the company.

    Strategy 1: Check if company model name appears as a title prefix
    (e.g., "DeepSeek-V3: ..." is almost certainly from DeepSeek)
    Strategy 2: Check authors/affiliations for company keywords
    """
    title = paper.get('title', '').lower()
    title_orig = paper.get('title', '')

    # Title prefix check: most reliable for model release papers
    # Models are named like "DeepSeek-V3", "Qwen2.5", "Llama-3", "Claude 3", etc.
    company_prefixes = {
        'OpenAI': ['gpt-4', 'gpt-5', 'chatgpt', 'o1 ', 'o3 ', 'o1-', 'o3-', 'o4-', 'sora', 'codex', 'gpt-oss'],
        'Google': ['gemini', 'gemma', 'palm ', 'palm-'],
        'Anthropic': ['claude'],
        'Meta': ['llama', 'llama-', 'fairseq'],
        'DeepSeek': ['deepseek'],
        'Qwen': ['qwen', 'tongyi'],
        'Mistral': ['mistral', 'mixtral', 'pixtral', 'lesstral'],
        'Baidu': ['ernie', 'wenxin', 'paddleocr'],
        'Xiaomi': ['mimo', 'xiaomi'],
        'MiniMax': ['minimax'],
        'Zhipu': ['glm-4', 'glm-3', 'chatglm', 'codegeex', 'cogvlm', 'cogview'],
        'Moonshot': ['kimi', 'moonshot'],
        'Tencent': ['hunyuan'],
        'Microsoft': ['phi-'],
        'Nvidia': ['nemotron'],
        'IBM': ['granite'],
        'AllenAI': ['olmo'],
        'TII': ['falcon'],
        'xAI': ['grok'],
        '01.AI': ['yi-'],
        'Baichuan': ['baichuan'],
        'InternLM': ['internlm', 'internvl', 'internvideo'],
        'Databricks': ['dbrx'],
        'AI21': ['jamba'],
        'LG': ['exaone'],
        'Cohere': ['cohere', 'command a', 'command r'],
        'ByteDance': ['seed-oss-', 'seed1.5', 'seed-vl', 'seed2.0'],
        'StepFun': ['step-3', 'step-2', 'step-audio', 'step-1x'],
        'Meituan': ['longcat'],
        'AntGroup': ['ling-1t', 'ring-1t', 'ling-flash', 'ling-lite', 'ming-lite'],
        'ModelBest': ['minicpm'],
        'Huawei': ['pangu'],
        'Skywork': ['skywork'],
        'SenseTime': ['sensenova', 'sensechat'],
    }
    # Companies whose model names collide with common words use strict
    # CASE-SENSITIVE title regexes (brand capitalization: MiMo/MiniMax/Grok)
    # instead of the loose prefix list below.
    strict_title_patterns = {
        'Xiaomi':   r'(^|[\s:])MiMo[-:]|(^|[\s:])Xiaomi(?![a-zA-Z])',
        'MiniMax':  r'(^|[\s:])MiniMax(-|:|\s+sparse|\s+Sparse)',
        'TII':      r'(^|[\s:])[Ff]alcon(-?[hH]\d[rR]?|[- ]?\d| [Mm]amba| [Ss]eries| [Ll][Ll][Mm])(?![a-zA-Z])',
        'xAI':      r'(^|[\s:])Grok(?![a-zA-Z])',
        'IBM':      r'(^|[\s:])Granite(?![a-zA-Z])(?!.*(?:[Bb]yzantine|gossip|geology|batholith|quarry))',
        'Moonshot': r'(^|[\s:])Kimi(?![a-zA-Z])|(^|[\s:])Moonshot(?![a-zA-Z])(?!.*(?:mathematics|math|factory|initiative|project))',
    }
    if company in strict_title_patterns:
        if re.search(strict_title_patterns[company], title_orig):
            return True
    else:
        prefixes = company_prefixes.get(company, [])
        for prefix in prefixes:
            # Model name must stand on its own: preceded by start/space/colon.
            # A prefix ending in a letter must NOT be followed by another
            # letter (kills grokking/coherence/paddles); a prefix ending in
            # '-' or a digit is followed by the version string (gpt-4o,
            # yi-lightning), so no lookahead there.
            pat = r'(^|[\s:])' + re.escape(prefix)
            if prefix[-1].isalpha():
                pat += r'(?![a-z])'
            if re.search(pat, title):
                return True

    # Fallback: check author/affiliation text
    author_text = ' '.join(paper.get('author_list', []) + paper.get('affiliations', [])).lower()
    return any(kw in author_text for kw in author_keywords)


def auto_tag(title, abstract=''):
    """Auto-tag paper based on title and abstract."""
    text = (title + ' ' + abstract).lower()
    return [t for t, p in TAG_RULES if re.search(p, text)] or ['LLM']


def classify_existing_by_title(all_papers):
    """Classify existing papers by title patterns (fallback when arXiv queries fail).

    Only matches when model name is the SUBJECT of the paper (title prefix),
    not when it's merely mentioned or compared against.
    """
    RULES = {
        'OpenAI': {
            'match': [r'^gpt-?\d', r'^gpt-oss', r'^chatgpt\b', r'^openai\b',
                      r'gpt-4o[\s\-:]', r'^o1[\s\-:] system card', r'^o3[\s\-:]'],
            'exclude': [r'comparative study', r'vs\.?\s', r'benchmarking.*gpt'],
        },
        'Google': {
            'match': [r'^gemini\b', r'^gemma\b', r'^palm[\s\-2]', r'^google (?:gemini|deepmind)'],
            'exclude': [r'vs\.?\s*gemini', r'compared.*gemini'],
        },
        'Anthropic': {
            'match': [r'^claude\b', r'^anthropic\b', r'constitutional ai'],
            'exclude': [r'vs\.?\s*claude', r'better call claude'],
        },
        'Meta': {
            'match': [r'^llama[\s\-23]', r'^llama\b.*(?:open|foundation|chat)'],
            'exclude': [r'meta-reasoning', r'meta-learning', r'meta-lo?ra', r'meta-analysis'],
        },
        'DeepSeek': {
            'match': [r'^deepseek[\s\-v]', r'^deepseek\b.*(?:pushing|technical|report|incentivizing)'],
            'exclude': [r'vs\.?\s*deepseek', r'deepseek performs better'],
        },
        'Qwen': {
            'match': [r'^qwen[\s\-2]', r'^qwen\b.*(?:technical report|developing)'],
            'exclude': [r'qwen vs', r'qwen it detect', r'from bert to qwen'],
        },
        'Mistral': {
            'match': [r'^mistral 7b', r'^mistral\b.*(?:model|release)', r'^mixtral\b'],
            'exclude': [r'mistral-splade', r'mistral-c2f'],
        },
        'Baidu': {
            'match': [r'^ernie\b', r'^ernie-?\d', r'^wenxin\b'],
            'exclude': [],
        },
        'Xiaomi': {
            'match': [r'^mimo[-:]', r'^xiaomi'],
            'exclude': [],
        },
        'MiniMax': {
            'match': [r'^minimax[-:]', r'^minimax sparse'],
            'exclude': [],
        },
        'Zhipu': {
            'match': [r'^glm-?\d', r'^chatglm[\s\-23]', r'^codegeex[\s\-2]', r'^cogvlm\b', r'^cogview\b'],
            'exclude': [],
        },
        'Moonshot': {
            'match': [r'^kimi[\s\-:]', r'^moonshot[\s\-:]'],
            'exclude': [r'moonshot (?:mathematics|math|factory|initiative|project)'],
        },
        'Tencent': {
            'match': [r'^hunyuan[\s\-:]'],
            'exclude': [],
        },
        'Microsoft': {
            'match': [r'^phi[\s\-]'],
            'exclude': [],
        },
        'Nvidia': {
            'match': [r'^nemotron[\s\-:]'],
            'exclude': [],
        },
        'IBM': {
            'match': [r'^granite[\s\-:]'],
            'exclude': [r'granite (?:rock|stone|quarry|belt|batholith)', r'byzantine|gossip'],
        },
        'AllenAI': {
            'match': [r'^olmo[\s\-:]'],
            'exclude': [],
        },
        'TII': {
            'match': [r'^falcon(-?h\dr?|[- ]?\d| mamba| series| llm)'],
            'exclude': [r'falcon (?:9|heavy|rocket)', r'^falcon-x'],
        },
        'xAI': {
            'match': [r'^grok[\s\-:]'],
            'exclude': [r'^grokking'],
        },
        '01.AI': {
            'match': [r'^yi[\-\s]'],
            'exclude': [r'^yi et al', r'yield'],
        },
        'Baichuan': {
            'match': [r'^baichuan[\s\-:]'],
            'exclude': [],
        },
        'InternLM': {
            'match': [r'^internlm[\s\-:]', r'^internvl[\s\-:]', r'^internvideo[\s\-:]'],
            'exclude': [],
        },
        'Databricks': {
            'match': [r'^dbrx[\s\-:]'],
            'exclude': [],
        },
        'AI21': {
            'match': [r'^jamba[\s\-:]'],
            'exclude': [],
        },
        'LG': {
            'match': [r'^exaone[\s\-:]'],
            'exclude': [],
        },
        'Cohere': {
            'match': [r'^cohere[\s\-:]', r'^command [ra][\s\-:+]'],
            'exclude': [r'^coherence'],
        },
        'ByteDance': {
            'match': [r'^seed-oss', r'^seed1\.5', r'^seed-vl', r'^seed2\.0'],
            'exclude': [],
        },
        'StepFun': {
            'match': [r'^step-[123][\s\-:]', r'^step-audio', r'^step-1x'],
            'exclude': [r'step-by-step', r'step-?up'],
        },
        'Meituan': {
            'match': [r'^longcat[\s\-:]'],
            'exclude': [],
        },
        'AntGroup': {
            'match': [r'^ling-1t', r'^ring-1t', r'^ling-flash', r'^ling-lite', r'^ming-lite'],
            'exclude': [],
        },
        'ModelBest': {
            'match': [r'^minicpm[\s\-:\d]'],
            'exclude': [],
        },
        'Huawei': {
            'match': [r'^pangu[\s\-:]'],
            'exclude': [],
        },
        'Skywork': {
            'match': [r'^skywork[\s\-:]'],
            'exclude': [],
        },
        'SenseTime': {
            'match': [r'^sensenova[\s\-:]', r'^sensechat[\s\-:]'],
            'exclude': [],
        },
    }

    classified = {}
    for p in all_papers:
        title = p.get('title', '').lower().strip()
        for company, rules in RULES.items():
            for pat in rules['match']:
                if re.search(pat, title, re.IGNORECASE):
                    excluded = any(re.search(ex, title, re.IGNORECASE) for ex in rules['exclude'])
                    if not excluded:
                        classified.setdefault(company, []).append(p)
                    break
            else:
                continue
            break
    return classified


def load_sweep_state():
    if os.path.exists(SWEEP_STATE):
        try:
            with open(SWEEP_STATE) as f:
                return json.load(f)
        except Exception:
            pass
    return {}


def save_sweep_state(state):
    cutoff = (datetime.now(timezone.utc)
              - timedelta(days=SWEEP_STATE_PRUNE_DAYS)).strftime("%Y-%m-%d")
    state = {pid: d for pid, d in state.items() if d >= cutoff}
    with open(SWEEP_STATE, "w") as f:
        json.dump(state, f, ensure_ascii=False)


def _kw_hit(text, kw):
    """Case-insensitive keyword hit: substring for phrases, word-boundary for tokens."""
    if " " in kw or "." in kw:
        return kw in text
    return re.search(r"\b" + re.escape(kw) + r"\b", text) is not None


def fetch_author_block(pid):
    """Fetch the author/affiliation block from arXiv's LaTeXML HTML page.

    Returns (text, permanent): text is the lowercased plain-text author block
    (or None); permanent=True means the paper has been definitively checked
    (404 / no author block / parsed OK) and should not be re-fetched.
    Transient network failures return (None, False) so the next run retries.
    """
    url = f"https://arxiv.org/html/{pid}"
    for attempt in range(2):
        try:
            req = urllib.request.Request(
                url, headers={"User-Agent": "llm-tracker-papers/1.0 (affiliation sweep)"})
            with urllib.request.urlopen(req, timeout=30) as r:
                html = r.read().decode("utf-8", "ignore")
            i = html.find("ltx_authors")
            if i < 0:
                return None, True   # HTML exists but no author block (rare)
            j = html.find("ltx_abstract", i)
            block = html[i:j if j > 0 else i + 12000]
            return re.sub(r"<[^>]+>", " ", block).lower(), True
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None, True   # no HTML rendering for this paper
            time.sleep(3)
        except Exception:
            time.sleep(3)
    return None, False


def match_affiliation(text):
    """Return (company, hits) with the most affiliation keyword hits."""
    best = (None, 0)
    for company, kws in AFFILIATION_KEYWORDS.items():
        hits = sum(1 for kw in kws if _kw_hit(text, kw))
        if hits > best[1]:
            best = (company, hits)
    return best


def affiliation_sweep(existing_map, existing_company_map, all_papers,
                      days=SWEEP_DAYS_DEFAULT):
    """Claim recent vendor papers via author-affiliation matching.

    Mutates existing_map / existing_company_map / all_papers in place and
    returns the list of newly claimed company papers. Each paper's HTML page
    is fetched at most once ever (state in papers-affil-checked.json).
    """
    state = load_sweep_state()
    now = datetime.now(timezone.utc)
    lo = (now - timedelta(days=days)).strftime("%Y%m%d%H%M")
    hi = now.strftime("%Y%m%d%H%M")
    query = f"({SWEEP_QUERY}) AND submittedDate:[{lo} TO {hi}]"

    seen, candidates = set(), []
    start = 0
    while start < SWEEP_MAX_TOTAL:
        page = fetch_arxiv(query, "Sweep", max_results=SWEEP_PAGE,
                           start=start, cats=SWEEP_CATS)
        if not page:
            break
        for p in page:
            if p["id"] not in seen:
                seen.add(p["id"])
                candidates.append(p)
        if len(page) < SWEEP_PAGE:
            break
        start += SWEEP_PAGE
        time.sleep(3)
    cutoff = (now - timedelta(days=days)).strftime("%Y-%m-%d")
    candidates = [p for p in candidates if p.get("date", "") >= cutoff]
    todo = [p for p in candidates
            if p["id"] not in state and p["id"] not in existing_company_map]
    print(f"\nAffiliation sweep: {len(candidates)} papers in last {days}d, "
          f"{len(todo)} to check")

    new_company = []
    for n, p in enumerate(todo, 1):
        block, permanent = fetch_author_block(p["id"])
        if permanent:
            state[p["id"]] = now.strftime("%Y-%m-%d")
        if block:
            company, _hits = match_affiliation(block)
            if company:
                p["company"] = company
                p["tags"] = auto_tag(p["title"], p.get("abstract", ""))
                if p["id"] not in existing_map:
                    existing_map[p["id"]] = p
                    all_papers.append(p)
                elif "company" not in existing_map[p["id"]]:
                    existing_map[p["id"]]["company"] = company
                existing_company_map[p["id"]] = p
                new_company.append(p)
                print(f"  [{n}/{len(todo)}] {company}: {p['title'][:65]}")
        if n % 50 == 0:
            save_sweep_state(state)
            print(f"  ... {n}/{len(todo)} checked, {len(new_company)} claimed")
        time.sleep(1.0)
    save_sweep_state(state)
    print(f"Sweep done: {len(new_company)} vendor papers claimed")
    return new_company


def generate_notes(papers, batch_size=10):
    """Generate one-line Chinese notes for papers via an OpenAI-compatible LLM API.

    Enabled only when LLM_API_KEY is set (otherwise skipped silently).
    Optional env: LLM_BASE_URL (default Moonshot), LLM_MODEL.
    """
    if not papers:
        return
    api_key = os.environ.get("LLM_API_KEY", "")
    if not api_key:
        print("LLM_API_KEY not set, skipping note generation")
        return
    base_url = os.environ.get("LLM_BASE_URL", "https://api.moonshot.cn/v1").rstrip("/")
    model = os.environ.get("LLM_MODEL", "moonshot-v1-8k")

    sys_prompt = (
        "你在为大模型论文追踪网站生成中文一句话介绍。"
        "对每篇论文写一条不超过60个汉字的编辑式点评：以方法名或动词开头，"
        "说清这篇论文做了什么以及亮点/价值；综述类论文注明是综述；"
        "不要用'本文'开头，不要臆造摘要中没有的具体数字。"
        "只输出一个 JSON 对象，键是论文 id，值是介绍字符串。"
    )
    total = 0
    for i in range(0, len(papers), batch_size):
        batch = papers[i:i + batch_size]
        items = [{"id": p["id"], "title": p["title"],
                  "abstract": (p.get("abstract") or "")[:350]} for p in batch]
        body = json.dumps({
            "model": model,
            "temperature": 0.3,
            "messages": [
                {"role": "system", "content": sys_prompt},
                {"role": "user", "content": json.dumps(items, ensure_ascii=False)},
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
            m = re.search(r'\{.*\}', content, re.DOTALL)
            notes = json.loads(m.group(0)) if m else {}
            for p in batch:
                note = notes.get(p["id"])
                if isinstance(note, str) and note.strip():
                    p["note"] = note.strip()[:80]
                    total += 1
            print(f"  Notes batch {i // batch_size + 1}: {total} notes so far")
        except Exception as e:
            print(f"  Note generation failed for batch {i // batch_size + 1}: {e}")
        time.sleep(2)
    print(f"Generated notes for {total}/{len(papers)} papers")


def generate_timeline(all_papers):
    """Generate timeline-data.json as individual paper list (for heatmap calendar)."""
    timeline = []
    for p in all_papers:
        date = p.get('date', '')
        if not date or len(date) < 10:
            year = str(p.get('year', ''))
            if year and len(year) == 4:
                date = year + '-01-01'
            else:
                continue
        timeline.append({
            'id': p.get('id', ''),
            'title': p.get('title', ''),
            'date': date,
            'year': p.get('year', 2025),
            'cite': p.get('cite', 0),
            'tags': p.get('tags', []),
        })
    timeline.sort(key=lambda p: p.get('date', ''), reverse=True)
    return timeline


def main(days=SWEEP_DAYS_DEFAULT):
    print(f"[{datetime.now().isoformat()}] Starting paper fetch...")

    # ── Load existing papers ─────────────────────────────
    existing = []
    if os.path.exists("papers.json"):
        with open("papers.json") as f:
            existing = json.load(f)
    existing_map = {p["id"]: p for p in existing}
    new_papers = []

    # ── Fetch topic papers ──────────────────────────────
    for tag, query in QUERIES:
        print(f"Fetching topic [{tag}]...")
        results = fetch_arxiv(query, tag, max_results=MAX_RESULTS_TOPIC)
        for p in results:
            p.pop('author_list', None)
            p.pop('affiliations', None)
            if p["id"] not in existing_map:
                new_papers.append(p)
                existing_map[p["id"]] = p
            else:
                existing_tags = existing_map[p["id"]].get("tags", [])
                if tag not in existing_tags:
                    existing_map[p["id"]]["tags"] = existing_tags + [tag]
        print(f"  Got {len(results)} (total unique: {len(existing_map)})")
        time.sleep(8)

    all_papers = sorted(existing_map.values(), key=lambda p: p.get("date", ""), reverse=True)
    with open("papers.json", "w") as f:
        json.dump(all_papers, f, ensure_ascii=False, indent=2)
    print(f"\nTopic papers: {len(all_papers)} total, {len(new_papers)} new")

    with open("daily_summary.txt", "w") as f:
        f.write(f"今日新增 {len(new_papers)} 篇论文，共收录 {len(all_papers)} 篇\n\n")
        for p in new_papers[:5]:
            f.write(f"• [{p['tags'][0]}] {p['title'][:60]}\n  https://arxiv.org/abs/{p['id']}\n\n")

    # ── Company papers (with author verification) ────────
    existing_company = []
    if os.path.exists("company-papers.json"):
        with open("company-papers.json") as f:
            existing_company = json.load(f)
    existing_company_map = {p["id"]: p for p in existing_company}
    company_new = []

    for company, config in COMPANY_CONFIG.items():
        query = config["query"]
        keywords = config["author_keywords"]
        print(f"Fetching company [{company}]...")
        raw_results = fetch_arxiv(f"({query})", company, max_results=MAX_RESULTS_COMPANY)

        confirmed = 0
        for p in raw_results:
            if not verify_company(p, company, keywords):
                continue  # Skip - not actually from this company
            confirmed += 1
            p['company'] = company
            p['tags'] = auto_tag(p['title'], p.get('abstract', ''))
            p.pop('author_list', None)
            p.pop('affiliations', None)

            if p['id'] not in existing_map:
                existing_map[p['id']] = p
                all_papers.append(p)
                company_new.append(p)
            else:
                existing_map[p['id']]['company'] = company

            if p['id'] not in existing_company_map:
                existing_company_map[p['id']] = p
            else:
                existing_company_map[p['id']]['company'] = company

        print(f"  Got {len(raw_results)} raw, {confirmed} confirmed")
        time.sleep(8)

    # ── Affiliation sweep (catch vendor papers without brand names) ──
    sweep_new = affiliation_sweep(existing_map, existing_company_map,
                                  all_papers, days=days)
    if sweep_new:
        company_new.extend(sweep_new)
        with open("daily_summary.txt", "a") as f:
            f.write(f"\n机构扫描新增 {len(sweep_new)} 篇厂商论文：\n")
            for p in sweep_new[:10]:
                f.write(f"• [{p['company']}] {p['title'][:60]}\n"
                        f"  https://arxiv.org/abs/{p['id']}\n\n")

    # Save company papers (accumulated, newest first)
    company_list = sorted(existing_company_map.values(),
                          key=lambda p: p.get("date", ""), reverse=True)
    company_out = [{"id": p["id"], "title": p["title"],
                     "title_zh": p.get("title_zh", ""),
                     "company": p["company"], "date": p.get("date", ""),
                     "tags": p.get("tags", [])} for p in company_list[:1200]]

    # ── Offline classification fallback ─────────────────
    # If arXiv queries returned too few company papers, classify from existing data
    if len(company_out) < 20:
        print(f"\nFew company papers ({len(company_out)}), running offline title classification...")
        classified = classify_existing_by_title(all_papers)
        for company, items in classified.items():
            for p in items:
                pid = p['id']
                if pid not in existing_company_map:
                    entry = {"id": pid, "title": p.get("title", ""),
                              "title_zh": p.get("title_zh", ""),
                              "company": company, "date": p.get("date", ""),
                              "tags": p.get("tags", ["LLM"])}
                    existing_company_map[pid] = entry
                    if 'company' not in existing_map.get(pid, {}):
                        existing_map[pid]['company'] = company
                print(f"  {company}: +{len(items)} from offline classification")

        company_list = sorted(existing_company_map.values(),
                              key=lambda p: p.get("date", ""), reverse=True)
        company_out = [{"id": p["id"], "title": p["title"],
                         "title_zh": p.get("title_zh", ""),
                         "company": p["company"], "date": p.get("date", ""),
                         "tags": p.get("tags", [])} for p in company_list[:1200]]

    with open("company-papers.json", "w") as f:
        json.dump(company_out, f, ensure_ascii=False)
    print(f"Company papers: {len(company_out)}")

    # ── Chinese one-line notes for today's new papers ────
    note_targets = [p for p in new_papers + company_new if not p.get("note")]
    if note_targets:
        print(f"\nGenerating notes for {len(note_targets)} new papers...")
        generate_notes(note_targets)
        # Re-save main data so notes are persisted
        all_with_notes = sorted(existing_map.values(),
                                key=lambda p: p.get("date", ""), reverse=True)
        with open("papers.json", "w") as f:
            json.dump(all_with_notes, f, ensure_ascii=False, indent=2)
        print("Saved papers.json with notes")

    # ── Timeline data ───────────────────────────────────
    all_papers_final = sorted(existing_map.values(),
                               key=lambda p: p.get("date", ""), reverse=True)
    timeline_data = generate_timeline(all_papers_final)
    with open("timeline-data.json", "w") as f:
        json.dump(timeline_data, f, ensure_ascii=False)
    print(f"Timeline: {len(timeline_data)} months")

    # ── Model release timeline ──────────────────────
    try:
        import extract_models
        extract_models.main()
    except Exception as e:
        print(f"Model extraction failed (non-fatal): {e}")

    # ── Download company paper PDFs (the gems) ──────
    try:
        import download_pdfs
        download_pdfs.main()
    except Exception as e:
        print(f"PDF download failed (non-fatal): {e}")

    # ── Extract architecture figures from reports ───
    try:
        import extract_figures
        extract_figures.main()
    except Exception as e:
        print(f"Figure extraction failed (non-fatal): {e}")

    print(f"\n✅ Done! {len(all_papers_final)} total, {len(new_papers)} new today")


def sweep_only_main(days):
    """Run only the affiliation sweep + save data files (backfill / hotfix mode)."""
    print(f"[{datetime.now().isoformat()}] Sweep-only mode, lookback {days}d")
    existing = []
    if os.path.exists("papers.json"):
        with open("papers.json") as f:
            existing = json.load(f)
    existing_map = {p["id"]: p for p in existing}
    all_papers = list(existing_map.values())

    existing_company = []
    if os.path.exists("company-papers.json"):
        with open("company-papers.json") as f:
            existing_company = json.load(f)
    existing_company_map = {p["id"]: p for p in existing_company}

    sweep_new = affiliation_sweep(existing_map, existing_company_map,
                                  all_papers, days=days)

    def dump_papers():
        with open("papers.json", "w") as f:
            json.dump(sorted(existing_map.values(),
                             key=lambda p: p.get("date", ""), reverse=True),
                      f, ensure_ascii=False, indent=2)

    dump_papers()
    company_list = sorted(existing_company_map.values(),
                          key=lambda p: p.get("date", ""), reverse=True)
    company_out = [{"id": p["id"], "title": p["title"],
                    "title_zh": p.get("title_zh", ""),
                    "company": p["company"], "date": p.get("date", ""),
                    "tags": p.get("tags", [])} for p in company_list[:1200]]
    with open("company-papers.json", "w") as f:
        json.dump(company_out, f, ensure_ascii=False)

    timeline_data = generate_timeline(list(existing_map.values()))
    with open("timeline-data.json", "w") as f:
        json.dump(timeline_data, f, ensure_ascii=False)

    with open("daily_summary.txt", "w") as f:
        f.write(f"机构扫描：新增 {len(sweep_new)} 篇厂商论文（回填 {days} 天窗口）\n\n")
        for p in sweep_new[:15]:
            f.write(f"• [{p['company']}] {p['title'][:60]}\n"
                    f"  https://arxiv.org/abs/{p['id']}\n\n")

    print(f"\n✅ Sweep-only done: {len(sweep_new)} claimed, "
          f"papers={len(existing_map)}, company={len(company_out)}, "
          f"timeline={len(timeline_data)}")


if __name__ == '__main__':
    import argparse
    ap = argparse.ArgumentParser(description="LLM paper fetcher")
    ap.add_argument("--sweep-only", action="store_true",
                    help="run only the affiliation sweep and save data files")
    ap.add_argument("--days", type=int, default=SWEEP_DAYS_DEFAULT,
                    help="sweep lookback window in days")
    args = ap.parse_args()
    if args.sweep_only:
        sweep_only_main(args.days)
    else:
        main(args.days)
