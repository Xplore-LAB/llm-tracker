#!/usr/bin/env python3
"""Agent 前线 · 每日动态自动发现管线

抓取三源（官方 RSS / Google News 关键词矩阵 / Hacker News），经 LLM 精编后分级合入：
  - confidence >= 0.85  → 自动解码合入线上 agents.json（页面立即可见）
  - 其余 relevant 条目  → 追加到 agents-inbox.json 候选池（待人工审核）
  - 不相关 / 与现有事件重复 → 丢弃

零第三方依赖（标准库实现 RSS/Atom 解析与 XOR+base64 编解码）。
编解码与 tools/build_protect.js 字节级一致，本地构建不会覆盖 Actions 写入的数据。

用法:
  python3 scripts/discover_agent_news.py            # 完整管线（需 LLM_API_KEY，否则降级 raw 模式）
  python3 scripts/discover_agent_news.py --dry-run  # 只抓取打印候选，不写任何文件
"""
import base64
import json
import os
import re
import sys
import time
import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta
from email.utils import parsedate_to_datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KEY = b'XploreLAB#2026$Chronicle'
AGENTS_JSON = os.path.join(ROOT, 'agents.json')
INBOX_JSON = os.path.join(ROOT, 'agents-inbox.json')
SUMMARY_TXT = os.path.join(ROOT, 'daily_summary_agents.txt')
AUTO_CONF = 0.85          # 高于此置信度自动合入
LOOKBACK_DAYS = 3         # 抓取回看窗口
HN_MIN_POINTS = 60        # HN 热度阈值
LLM_BATCH = 8

# ── 抓取源 ────────────────────────────────────────────────
OFFICIAL_RSS = [
    ('OpenAI News',        'https://openai.com/news/rss.xml'),
    ('NVIDIA Blog',        'https://blogs.nvidia.com/feed/'),
    ('NVIDIA Developer',   'https://developer.nvidia.com/blog/rss/'),
    ('Hugging Face Blog',  'https://huggingface.co/blog/feed.xml'),
    ('AWS ML Blog',        'https://aws.amazon.com/blogs/machine-learning/feed/'),
]

GNEWS_QUERIES = [
    # (query, lang)
    ('Anthropic Claude agent',          'en'),
    ('OpenAI Codex agent',              'en'),
    ('Google Gemini agent',             'en'),
    ('Microsoft Copilot agent',         'en'),
    ('Meta AI agent Llama',             'en'),
    ('Salesforce Agentforce',           'en'),
    ('Siemens Industrial Copilot',      'en'),
    ('Schneider Electric AI agent',     'en'),
    ('agentic AI platform launch',      'en'),
    ('MCP protocol agent',              'en'),
    ('西门子 工业智能体',                'zh'),
    ('中控技术 智能体',                  'zh'),
    ('华为 盘古 智能体',                 'zh'),
    ('阿里 通义 智能体',                 'zh'),
    ('字节 扣子 智能体',                 'zh'),
    ('智谱 AutoGLM',                    'zh'),
    ('腾讯 混元 智能体',                 'zh'),
    ('Manus 智能体',                    'zh'),
]

CATS = ['coding', 'consumer', 'enterprise', 'infra', 'industry']

# ── XOR+base64 编解码（与 build_protect.js 字节级一致） ──
def enc_text(raw: bytes) -> str:
    out = bytes(b ^ KEY[i % len(KEY)] for i, b in enumerate(raw))
    return base64.b64encode(out).decode('ascii')

def dec_text(b64: str) -> bytes:
    data = base64.b64decode(b64.strip())
    return bytes(b ^ KEY[i % len(KEY)] for i, b in enumerate(data))

def load_agents():
    raw = dec_text(open(AGENTS_JSON).read())
    return json.loads(raw.decode('utf-8'))

def save_agents(d):
    text = json.dumps(d, ensure_ascii=False, indent=2)
    open(AGENTS_JSON, 'w').write(enc_text(text.encode('utf-8')))

def sync_src(d):
    """把最新数据同步回本地可读源码目录（若存在），防止下次本地构建回退。"""
    src = os.path.join(ROOT, '..', '_llm-tracker-src', 'data', 'agents.json')
    if os.path.isdir(os.path.dirname(os.path.abspath(src))):
        open(os.path.abspath(src), 'w').write(json.dumps(d, ensure_ascii=False, indent=2))
        print('  synced -> _llm-tracker-src/data/agents.json')

# ── 抓取 ─────────────────────────────────────────────────
def http_get(url, timeout=15):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (llm-tracker bot)'})
    return urllib.request.urlopen(req, timeout=timeout).read()

def strip_html(s):
    return re.sub(r'<[^>]+>', ' ', s or '').replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>').replace('&quot;', '"').replace('&#39;', "'").strip()

def parse_date(s):
    if not s:
        return None
    try:
        return parsedate_to_datetime(s).astimezone(timezone.utc).date().isoformat()
    except Exception:
        pass
    try:
        return s[:10]
    except Exception:
        return None

def parse_feed(xml_bytes, feed_name):
    """兼容 RSS 2.0 与 Atom，返回 [{title,url,date,snippet,source}]"""
    try:
        root = ET.fromstring(xml_bytes)
    except ET.ParseError:
        return []
    ns = {'a': 'http://www.w3.org/2005/Atom'}
    items = []
    # RSS 2.0
    for it in root.iter('item'):
        title = (it.findtext('title') or '').strip()
        link = (it.findtext('link') or '').strip()
        date = parse_date(it.findtext('pubDate'))
        snippet = strip_html(it.findtext('description') or '')[:300]
        src_el = it.find('source')
        source = (src_el.text or '').strip() if src_el is not None and src_el.text else feed_name
        # Google News 标题尾部 " - 媒体名"
        if source and title.endswith(' - ' + source):
            title = title[: -len(source) - 3]
        if title and link:
            items.append({'title': title, 'url': link, 'date': date, 'snippet': snippet, 'source': source})
    # Atom
    if not items:
        for it in root.iter('{http://www.w3.org/2005/Atom}entry'):
            title = (it.findtext('a:title', default='', namespaces=ns) or '').strip()
            link = ''
            for l in it.findall('a:link', ns):
                link = l.get('href') or link
                if l.get('rel') in (None, 'alternate'):
                    break
            date = (it.findtext('a:updated', default='', namespaces=ns) or it.findtext('a:published', default='', namespaces=ns) or '')[:10]
            snippet = strip_html(it.findtext('a:summary', default='', namespaces=ns) or '')[:300]
            if title and link:
                items.append({'title': title, 'url': link, 'date': date or None, 'snippet': snippet, 'source': feed_name})
    return items

def fetch_hn():
    """HN Algolia：近 LOOKBACK_DAYS 天含 AI agent 的 story"""
    since = int((datetime.now(timezone.utc) - timedelta(days=LOOKBACK_DAYS)).timestamp())
    q = urllib.parse.quote(f'AI agent')
    url = f'https://hn.algolia.com/api/v1/search_by_date?query={q}&tags=story&numericFilters=created_at_i>{since},points>{HN_MIN_POINTS}&hitsPerPage=30'
    try:
        d = json.loads(http_get(url).decode('utf-8'))
    except Exception:
        return []
    out = []
    for h in d.get('hits', []):
        title = (h.get('title') or '').strip()
        link = h.get('url') or f"https://news.ycombinator.com/item?id={h.get('objectID')}"
        if not title:
            continue
        out.append({'title': title, 'url': link,
                    'date': datetime.fromtimestamp(h.get('created_at_i', 0), tz=timezone.utc).date().isoformat(),
                    'snippet': (strip_html(h.get('story_text') or ''))[:300] or f"Hacker News {h.get('points', 0)} points / {h.get('num_comments', 0)} comments",
                    'source': 'Hacker News'})
    return out

def fetch_all():
    cands = []
    for name, url in OFFICIAL_RSS:
        try:
            cands += parse_feed(http_get(url), name)
            print(f'  [rss] {name}: ok')
        except Exception as e:
            print(f'  [rss] {name}: FAIL {e}')
        time.sleep(0.3)
    for q, lang in GNEWS_QUERIES:
        hl = 'en-US&gl=US&ceid=US:en' if lang == 'en' else 'zh-CN&gl=CN&ceid=CN:zh-Hans'
        u = f"https://news.google.com/rss/search?q={urllib.parse.quote(q)}+when:{LOOKBACK_DAYS}d&hl={hl}"
        try:
            got = parse_feed(http_get(u), 'Google News')
            cands += got
            print(f'  [gnews] {q}: {len(got)}')
        except Exception as e:
            print(f'  [gnews] {q}: FAIL {e}')
        time.sleep(0.5)
    hn = fetch_hn()
    cands += hn
    print(f'  [hn] {len(hn)}')
    return cands

# ── 预筛：日期窗口 + 关键词 + 每源限量 ────────────────────
AGENT_KW = re.compile(
    r'agent|agentic|copilot|智能体|MCP\b|model context|a2a\b|claude|codex|operator|'
    r'manus|autoglm|agentforce|devin|cursor|computer use|盘古|扣子|混元',
    re.I)
OFFICIAL_KW = re.compile(r'agent|agentic|copilot|智能体|codex|claude|mcp\b', re.I)

def prefilter(cands, per_feed_cap=12):
    """日期窗口内 + 标题/摘要含 Agent 相关词；官方源用严格关键词档"""
    cutoff = (datetime.now(timezone.utc) - timedelta(days=LOOKBACK_DAYS)).date().isoformat()
    official_names = {n for n, _ in OFFICIAL_RSS}
    by_feed = {}
    for c in cands:
        official = c['source'] in official_names
        if c.get('date') and c['date'] < cutoff:
            continue
        kw = OFFICIAL_KW if official else AGENT_KW
        if not kw.search((c['title'] or '') + ' ' + (c['snippet'] or '')):
            continue
        by_feed.setdefault(c['source'], []).append(c)
    out = []
    for feed, lst in by_feed.items():
        out.extend(lst[:per_feed_cap])
    return out

# ── 去重 ─────────────────────────────────────────────────
def norm_url(u):
    u = (u or '').strip().split('#')[0]
    for tok in ('?utm_', '&utm_', '?hl=', '&hl='):
        i = u.find(tok)
        if i > 0:
            u = u[:i]
    return u.rstrip('/')

def dedup(cands, existing_urls, inbox_urls):
    seen, out = set(), []
    for c in cands:
        k = norm_url(c['url'])
        if k in seen or k in existing_urls or k in inbox_urls:
            continue
        seen.add(k)
        if not c.get('date'):
            c['date'] = datetime.now(timezone.utc).date().isoformat()
        out.append(c)
    return out

# ── LLM 精编 ─────────────────────────────────────────────
SYSTEM_PROMPT = """你在为中文网站「Agent 前线」栏目精编工业界大模型 Agent 动态。对输入的每条新闻候选做判定与编写，输出 JSON 数组，每项含：
- id: 原样返回
- relevant: 是否为工业界大模型 Agent 动态（公司/组织发布的产品、重大更新、融资并购、协议标准；排除纯学术论文、招聘、课程、泛观点评论、与 agent 无关的模型发布）
- dup: 是否与「已知事件列表」中的事件重复（同一事件的后续报道不算重复，但同一产品同一发布算重复）
- confidence: 0~1 把握度（信息不足、标题模糊、来源可信度低时降低）
- cat: 五选一 "coding"=AI编程智能体 / "consumer"=通用消费级Agent / "enterprise"=企业级Agent平台 / "infra"=Agent基础设施与协议 / "industry"=工业Agent落地
- company: 主体公司中文名（参考已知公司名保持一致；合作主体用「 × 」连接）
- title_cn: 中文标题，不超过 22 字，电讯风格，不用破折号
- note_cn: 中文摘要 60~110 字，客观陈述，绝不编造任何数字、日期、参数；只依据输入标题与摘要片段，信息不足就写得更笼统
只输出 JSON 数组，不要其他文字。"""

def llm_curate(items, known_titles):
    api_key = os.environ.get('LLM_API_KEY', '')
    if not api_key:
        print('  LLM_API_KEY not set -> raw 模式（全部进候选池）')
        return None
    base = os.environ.get('LLM_BASE_URL', 'https://api.moonshot.cn/v1').rstrip('/')
    if base.endswith('/chat/completions'):        # 兼容传入完整 endpoint（如 ai-assistant.js 的配置）
        base = base[:-len('/chat/completions')].rstrip('/')
    model = os.environ.get('LLM_MODEL', 'moonshot-v1-8k')
    origin = os.environ.get('LLM_ORIGIN', 'https://xplore-lab.github.io')  # llm-proxy 有来源校验
    results = []
    for i in range(0, len(items), LLM_BATCH):
        batch = items[i:i + LLM_BATCH]
        payload = [{'id': j, 'title': c['title'], 'source': c['source'],
                    'snippet': c['snippet'][:200], 'date': c['date']}
                   for j, c in enumerate(batch)]
        body = json.dumps({
            'model': model, 'temperature': 0.2,
            'messages': [
                {'role': 'system', 'content': SYSTEM_PROMPT},
                {'role': 'user', 'content': json.dumps(
                    {'已知事件列表(近期)': known_titles, '候选新闻': payload},
                    ensure_ascii=False)},
            ],
        }).encode()
        req = urllib.request.Request(base + '/chat/completions', data=body,
                                     headers={'Content-Type': 'application/json',
                                              'Authorization': 'Bearer ' + api_key,
                                              'Origin': origin})
        try:
            resp = json.loads(urllib.request.urlopen(req, timeout=180).read().decode('utf-8'))
            txt = resp['choices'][0]['message']['content'].strip()
            txt = re.sub(r'<think>.*?</think>', '', txt, flags=re.S).strip()  # 剥离推理模型的思考块
            m = re.search(r'\[.*\]', txt, re.S)
            arr = json.loads(m.group(0)) if m else []
            for r in arr:
                if isinstance(r, dict) and 'id' in r and 0 <= r['id'] < len(batch):
                    results.append((batch[r['id']], r))
            print(f'  [llm] batch {i // LLM_BATCH + 1}: {len(arr)}/{len(batch)}')
        except Exception as e:
            print(f'  [llm] batch {i // LLM_BATCH + 1}: FAIL {e}')
        time.sleep(1)
    return results

def raw_fallback(items):
    """无 LLM key 时：全部进候选池，标题原文、摘要取片段截断"""
    return [(c, {'relevant': True, 'dup': False, 'confidence': 0.5,
                 'cat': 'enterprise', 'company': c['source'],
                 'title_cn': c['title'][:40],
                 'note_cn': (c['snippet'] or c['title'])[:110]}) for c in items]

# ── 主流程 ───────────────────────────────────────────────
def main():
    dry = '--dry-run' in sys.argv
    agents = load_agents()
    events = agents['events']
    inbox = json.load(open(INBOX_JSON)) if os.path.exists(INBOX_JSON) else {'updated': '', 'events': []}

    print(f'[1/4] 抓取 {LOOKBACK_DAYS} 天窗口 ...')
    cands = fetch_all()
    print(f'  原始候选: {len(cands)}')
    cands = prefilter(cands)
    print(f'  预筛后(关键词+窗口+限量): {len(cands)}')

    existing_urls = {norm_url(e.get('url', '')) for e in events}
    inbox_urls = {norm_url(e.get('url', '')) for e in inbox['events']}
    cands = dedup(cands, existing_urls, inbox_urls)
    print(f'  去重后: {len(cands)}')
    if dry:
        for c in cands[:20]:
            print(f"   - [{c['date']}] {c['title'][:60]} ({c['source']})")
        print('dry-run 结束，未写任何文件')
        return

    print('[2/4] LLM 精编 ...')
    known_titles = [f"{e['date'][:7]} {e['title']}" for e in events[:60]]
    curated = llm_curate(cands, known_titles)
    if curated is None:
        curated = raw_fallback(cands)

    auto, hold = [], []
    for c, r in curated:
        if not r.get('relevant') or r.get('dup'):
            continue
        ev = {'date': c['date'],
              'company': (r.get('company') or c['source'])[:40],
              'cat': r.get('cat') if r.get('cat') in CATS else 'enterprise',
              'title': r.get('title_cn') or c['title'][:40],
              'note': r.get('note_cn') or (c['snippet'] or '')[:110],
              'url': c['url']}
        try:
            conf = float(r.get('confidence', 0))
        except (TypeError, ValueError):
            conf = 0.0
        if conf >= AUTO_CONF:
            auto.append(ev)
        else:
            ev.update({'confidence': round(conf, 2), 'source': c['source'],
                       'found': datetime.now(timezone.utc).date().isoformat()})
            hold.append(ev)

    print(f'  自动上线: {len(auto)}  候选池: {len(hold)}')

    print('[3/4] 写入 ...')
    if auto:
        events.extend(auto)
        events.sort(key=lambda x: x['date'], reverse=True)
        agents['meta'] = agents.get('meta', {})
        save_agents(agents)
        sync_src(agents)
        print(f'  agents.json 已更新（events={len(events)}）')
    if hold:
        inbox['events'].extend(hold)
        inbox['events'].sort(key=lambda x: x['date'], reverse=True)
        inbox['updated'] = datetime.now(timezone.utc).isoformat(timespec='seconds')
        json.dump(inbox, open(INBOX_JSON, 'w'), ensure_ascii=False, indent=2)
        print(f'  agents-inbox.json: {len(inbox["events"])} 条待审')

    print('[4/4] 日报 ...')
    lines = []
    if auto:
        lines.append(f'自动上线 {len(auto)} 条：')
        lines += [f"  · {e['date']} {e['company']} {e['title']}" for e in auto]
    if hold:
        lines.append(f'待审核 {len(hold)} 条（置信度不足 {AUTO_CONF}）：')
        lines += [f"  ○ {e['date']} [{e['confidence']}] {e['title']}" for e in hold]
    if not lines:
        lines = ['今日无新增动态']
    summary = f'📡 Agent 前线每日搜寻 {datetime.now(timezone.utc).date()}\n' + '\n'.join(lines)
    open(SUMMARY_TXT, 'w').write(summary)
    print(summary)

if __name__ == '__main__':
    main()
