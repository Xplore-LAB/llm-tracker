#!/usr/bin/env python3
"""llm-tracker 每周摘要邮件管线

每周五 18:00（北京，UTC 10:00）由 GitHub Actions 触发：
  1. 解码仓内受保护数据（XOR+base64，与 build_protect.js 一致）
     agents.json / models.json / leaderboard.json / learning-path.json
  2. 汇总三块内容：
     - 前沿动态：近 7 天 Agent 前线新增事件（每日管线自动合入，置信度 >= 0.85）
     - 新模型与榜单：近 7 天新发布模型 + AA/Arena 双榜 top（口径不同，仅并列展示）
     - 学习清单：learning-path 七阶段按 ISO 周轮换，概念链术语馆 ?q= 深链
  3. 组 HTML 邮件经 SMTP SSL 发送；任一 secret 缺失时降级 dry-run
     （打印摘要 + 写 weekly_digest_preview.html），退出码 0

环境变量：
  DIGEST_TO            收件邮箱（必填才发信）
  DIGEST_SMTP_HOST     SMTP 主机（如 smtp.qq.com）
  DIGEST_SMTP_USER     发件账号
  DIGEST_SMTP_PASS     SMTP 授权码（非登录密码）
  DIGEST_SMTP_PORT     可选，默认 465（SSL）

零第三方依赖。
"""
import base64
import json
import os
import smtplib
import sys
from datetime import date, datetime, timedelta
from email.mime.text import MIMEText
from email.header import Header
from urllib.parse import quote

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KEY = b'XploreLAB#2026$Chronicle'
SITE = 'https://xplore-lab.github.io/llm-tracker/'
WINDOW_DAYS = 7
MAX_EVENTS = 10
MAX_CONCEPTS = 3
MAX_PAPERS = 2

# 大地色系（与站点 parchment 一致）
INK = '#37414f'
INK_SOFT = '#6d6552'
PAPER = '#faf6ea'
PAPER_DEEP = '#f0e9d6'
LINE = '#d9cfae'


# ── XOR+base64 解码（与 build_protect.js / discover_agent_news.py 字节级一致） ──
def dec(path):
    raw = open(path, 'rb').read()
    try:
        return json.loads(raw)          # 明文优先（兼容直维护文件）
    except Exception:
        pass
    data = base64.b64decode(raw.strip())
    return json.loads(bytes(b ^ KEY[i % len(KEY)] for i, b in enumerate(data)))


def esc(s):
    return (str(s or '').replace('&', '&amp;').replace('<', '&lt;')
            .replace('>', '&gt;').replace('"', '&quot;'))


def trim(s, n):
    s = str(s or '').strip()
    return s if len(s) <= n else s[:n - 1] + '…'


# ── 数据装配 ───────────────────────────────────────────────
def load_sections(today):
    cut = (today - timedelta(days=WINDOW_DAYS)).isoformat()

    # 1) 前沿动态：近 7 天 Agent 事件
    events = dec(os.path.join(ROOT, 'agents.json')).get('events', [])
    recent = sorted((e for e in events if (e.get('date') or '') >= cut),
                    key=lambda e: e.get('date', ''), reverse=True)
    more_events = max(0, len(recent) - MAX_EVENTS)

    # 2a) 新模型：近 7 天发布
    models = dec(os.path.join(ROOT, 'models.json')).get('models', [])
    new_models = sorted((m for m in models if (m.get('date') or '') >= cut),
                        key=lambda m: m.get('date', ''), reverse=True)

    # 2b) 榜单双 top（AA 能力 / Arena 偏好，口径不同不可比）
    lb = dec(os.path.join(ROOT, 'leaderboard.json')).get('models', [])
    top_aa = sorted((x for x in lb if x.get('aa')),
                    key=lambda x: -x['aa'])[:5]
    top_arena = sorted((x for x in lb if x.get('arena')),
                       key=lambda x: -x['arena'])[:3]

    # 3) 学习清单：七阶段按 ISO 周轮换
    stages = dec(os.path.join(ROOT, 'learning-path.json')).get('stages', [])
    stage = stages[today.isocalendar()[1] % len(stages)] if stages else None

    return recent[:MAX_EVENTS], more_events, new_models, top_aa, top_arena, stage


# ── HTML 组装 ──────────────────────────────────────────────
def row(label, value):
    return (f'<tr><td style="padding:5px 14px 5px 0;color:{INK_SOFT};'
            f'font-size:12px;white-space:nowrap;vertical-align:top;">{esc(label)}</td>'
            f'<td style="padding:5px 0;color:{INK};font-size:13px;">{value}</td></tr>')


def build_html(today, events, more_events, new_models, top_aa, top_arena, stage):
    week = today.isocalendar()[1]
    rng = f"{(today - timedelta(days=6)).strftime('%m-%d')} ~ {today.strftime('%m-%d')}"
    h = []
    h.append(f'''<div style="background:{PAPER};border:1px solid {LINE};border-radius:10px;
      padding:28px 30px;font-family:-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;
      max-width:640px;margin:0 auto;">
      <div style="border-bottom:2px solid {LINE};padding-bottom:14px;margin-bottom:18px;">
        <div style="font-size:20px;font-weight:700;color:{INK};letter-spacing:2px;">📮 情报局周报</div>
        <div style="font-size:12px;color:{INK_SOFT};margin-top:4px;">
          第 {week} 周 · {rng} · <a href="{SITE}" style="color:{INK};">llm-tracker</a></div>
      </div>''')

    # ── 前沿动态 ──
    h.append(f'<div style="font-size:15px;font-weight:700;color:{INK};margin:16px 0 8px;">📡 前沿动态<span style="font-size:11px;font-weight:400;color:{INK_SOFT};"> · 近 7 天 Agent 前线 {len(events) + more_events} 条</span></div>')
    if events:
        h.append(f'<table style="border-collapse:collapse;width:100%;">')
        for e in events:
            title = esc(trim(e.get('title'), 46))
            link = esc(e.get('url') or SITE + 'agents/')
            h.append(row(e.get('date', '')[5:],
                         f'<a href="{link}" style="color:{INK};text-decoration:none;border-bottom:1px solid {LINE};">{title}</a>'
                         f' <span style="color:{INK_SOFT};font-size:11px;">{esc(trim(e.get("company"), 14))}</span>'))
        h.append('</table>')
        if more_events:
            h.append(f'<div style="font-size:12px;color:{INK_SOFT};margin:6px 0;">'
                     f'另有 {more_events} 条，见 <a href="{SITE}agents/" style="color:{INK};">Agent 前线</a></div>')
    else:
        h.append(f'<div style="font-size:13px;color:{INK_SOFT};">本周无自动合入事件，可逛 <a href="{SITE}agents/" style="color:{INK};">Agent 前线</a> 存量 121+ 条</div>')

    # ── 新模型与榜单 ──
    h.append(f'<div style="font-size:15px;font-weight:700;color:{INK};margin:22px 0 8px;">🧬 新模型与榜单</div>')
    if new_models:
        h.append(f'<div style="font-size:12px;color:{INK_SOFT};margin-bottom:4px;">近 7 天新发布 {len(new_models)} 个</div><table style="border-collapse:collapse;width:100%;">')
        for m in new_models[:8]:
            extra = f' · <span style="font-size:11px;color:{INK_SOFT};">{esc(trim(m.get("note"), 40))}</span>' if m.get('note') else ''
            h.append(row(m.get('date', '')[5:], f'<b style="color:{INK};">{esc(m.get("model"))}</b>（{esc(m.get("company"))}）{extra}'))
        h.append('</table>')
    else:
        h.append(f'<div style="font-size:13px;color:{INK_SOFT};margin-bottom:4px;">本周无新模型入档</div>')
    if top_aa:
        h.append(f'<div style="font-size:12px;color:{INK_SOFT};margin:10px 0 4px;">AA Intelligence Index Top 5（能力口径）</div><table style="border-collapse:collapse;width:100%;">')
        for i, x in enumerate(top_aa, 1):
            h.append(row(f'Top {i}', f'<b style="color:{INK};">{esc(x["model"])}</b> '
                         f'<span style="font-size:11px;color:{INK_SOFT};">{esc(x.get("company") or "")}</span> · AA {x["aa"]}'))
        h.append('</table>')
    if top_arena:
        h.append(f'<div style="font-size:12px;color:{INK_SOFT};margin:10px 0 4px;">Arena Elo Top 3（人类偏好口径）</div><table style="border-collapse:collapse;width:100%;">')
        for i, x in enumerate(top_arena, 1):
            h.append(row(f'Top {i}', f'<b style="color:{INK};">{esc(x["model"])}</b> · Elo {x["arena"]}'))
        h.append('</table>')
    h.append(f'<div style="font-size:11px;color:{INK_SOFT};margin:8px 0;">双榜口径不同不可互相换算；'
             f'完整 50 模型见 <a href="{SITE}leaderboard/" style="color:{INK};">排行榜</a>，'
             f'模型时序见 <a href="{SITE}models/" style="color:{INK};">模型页</a></div>')

    # ── 学习清单 ──
    if stage:
        h.append(f'<div style="background:{PAPER_DEEP};border:1px solid {LINE};border-radius:8px;padding:14px 16px;margin:22px 0 8px;">')
        h.append(f'<div style="font-size:15px;font-weight:700;color:{INK};">📚 本周学习主题 · {esc(stage.get("icon", ""))} {esc(stage.get("title", ""))}</div>')
        h.append(f'<div style="font-size:12px;color:{INK_SOFT};margin:6px 0 10px;line-height:1.7;">{esc(trim(stage.get("intro"), 110))}</div>')
        h.append('<table style="border-collapse:collapse;width:100%;">')
        for c in stage.get('concepts', [])[:MAX_CONCEPTS]:
            term = esc(c.get('term'))
            qlink = f'{SITE}glossary/?q={quote(c.get("term") or "")}'
            h.append(row('概念', f'<a href="{qlink}" style="color:{INK};font-weight:600;">{term}</a>'
                         f' <span style="font-size:11px;color:{INK_SOFT};">{esc(trim(c.get("desc"), 44))}</span>'))
        for p in stage.get('papers', [])[:MAX_PAPERS]:
            pid = p.get('id', '')
            plink = f'https://arxiv.org/abs/{esc(pid)}' if pid else SITE + 'chronicle/'
            venue = p.get('venue', {})
            vtxt = f' · {venue.get("name", "")}' if isinstance(venue, dict) and venue.get('name') else ''
            h.append(row('论文', f'<a href="{plink}" style="color:{INK};font-weight:600;">{esc(p.get("title"))}</a>'
                         f'<span style="font-size:11px;color:{INK_SOFT};">{esc(vtxt)} · {esc(trim(p.get("note"), 36))}</span>'))
        h.append('</table></div>')
        h.append(f'<div style="font-size:11px;color:{INK_SOFT};">七阶段按周轮换，本周主题由 '
                 f'<a href="{SITE}museum/" style="color:{INK};">LLM 博物馆</a> 与学习路径数据驱动；'
                 f'动手实验见 <a href="{SITE}lab/" style="color:{INK};">实验室</a></div>')

    h.append(f'''<div style="border-top:1px solid {LINE};margin-top:20px;padding-top:10px;
      font-size:11px;color:{INK_SOFT};line-height:1.8;">
      事件由每日 Agent 管线自动合入（置信度 ≥ 0.85，候选池见 agents-inbox）；榜单分数以页面口径为准。<br>
      <a href="{SITE}timeline/" style="color:{INK};">时间轴</a> ·
      <a href="{SITE}chronicle/" style="color:{INK};">编年史</a> ·
      <a href="{SITE}blogs/" style="color:{INK};">博客志</a> ·
      <a href="{SITE}qiuzhao/" style="color:{INK};">秋招</a>
      每周五 18:00 自动发送</div></div>''')
    return ''.join(h)


# ── Markdown 组装（发 GitHub Issue，@提及触发官方邮件提醒） ──
def build_markdown(today, events, more_events, new_models, top_aa, top_arena, stage):
    week = today.isocalendar()[1]
    rng = f"{(today - timedelta(days=6)).strftime('%m-%d')} ~ {today.strftime('%m-%d')}"
    m = ["@Xplore-LAB\n",
         f"> 📮 情报局周报 · 第 {week} 周 · {rng} · [llm-tracker]({SITE})\n"]

    m.append(f"## 📡 前沿动态（近 7 天 {len(events) + more_events} 条）")
    if events:
        for e in events:
            m.append(f"- **{e.get('date', '')[5:]}** [{trim(e.get('title'), 46)}]({e.get('url') or SITE + 'agents/'}) · {trim(e.get('company'), 14)}")
        if more_events:
            m.append(f"\n另有 {more_events} 条，见 [Agent 前线]({SITE}agents/)")
    else:
        m.append(f"本周无自动合入事件，可逛 [Agent 前线]({SITE}agents/) 存量 121+ 条")
    m.append("")

    m.append("## 🧬 新模型与榜单")
    if new_models:
        m.append(f"近 7 天新发布 **{len(new_models)}** 个：")
        for x in new_models[:8]:
            note = f" — {trim(x.get('note'), 40)}" if x.get('note') else ''
            m.append(f"- **{x.get('model')}**（{x.get('company')}）· {x.get('date', '')[5:]}{note}")
    else:
        m.append("本周无新模型入档")
    m.append("")
    if top_aa:
        m.append("**AA Intelligence Index Top 5**（能力口径）\n")
        m.append("| # | 模型 | 厂商 | AA |")
        m.append("|---|---|---|---|")
        for i, x in enumerate(top_aa, 1):
            m.append(f"| {i} | {x['model']} | {x.get('company') or ''} | {x['aa']} |")
        m.append("")
    if top_arena:
        m.append("**Arena Elo Top 3**（人类偏好口径）\n")
        m.append("| # | 模型 | Elo |")
        m.append("|---|---|---|")
        for i, x in enumerate(top_arena, 1):
            m.append(f"| {i} | {x['model']} | {x['arena']} |")
        m.append("")
    m.append(f"> 双榜口径不同不可互相换算；完整 50 模型见 [排行榜]({SITE}leaderboard/)，模型时序见 [模型页]({SITE}models/)\n")

    if stage:
        m.append(f"## 📚 本周学习主题 · {stage.get('icon', '')} {stage.get('title', '')}")
        m.append(f"{trim(stage.get('intro'), 110)}\n")
        for c in stage.get('concepts', [])[:MAX_CONCEPTS]:
            qlink = quote(c.get('term') or '')
            m.append(f"- 概念：[{c.get('term')}]({SITE}glossary/?q={qlink}) — {trim(c.get('desc'), 44)}")
        for p in stage.get('papers', [])[:MAX_PAPERS]:
            pid = p.get('id', '')
            plink = f"https://arxiv.org/abs/{pid}" if pid else SITE + 'chronicle/'
            venue = p.get('venue', {})
            vtxt = f" · {venue.get('name', '')}" if isinstance(venue, dict) and venue.get('name') else ''
            m.append(f"- 论文：[{p.get('title')}]({plink}){vtxt} · {trim(p.get('note'), 36)}")
        m.append(f"\n七阶段按周轮换；顺路逛 [LLM 博物馆]({SITE}museum/)，动手见 [实验室]({SITE}lab/)\n")

    m.append("---")
    m.append(f"事件由每日 Agent 管线自动合入（置信度 ≥ 0.85）；每周五 18:00 由 GitHub Actions 自动发布本 Issue，"
             f"@提及 即触发 GitHub 官方邮件提醒。")
    return "\n".join(m)


def main():
    today = date.today()
    events, more, new_models, top_aa, top_arena, stage = load_sections(today)
    html = build_html(today, events, more, new_models, top_aa, top_arena, stage)
    subject = f'📮 情报局周报 · 第 {today.isocalendar()[1]} 周（{today.strftime("%m-%d")}）'

    # Markdown 版恒定产出：供 weekly-digest workflow 发 Issue（GitHub 官方提醒）
    md = build_markdown(today, events, more, new_models, top_aa, top_arena, stage)
    with open(os.path.join(ROOT, 'weekly_digest.md'), 'w', encoding='utf-8') as f:
        f.write(md)
    with open(os.path.join(ROOT, 'weekly_digest_title.txt'), 'w', encoding='utf-8') as f:
        f.write(subject)

    to = os.environ.get('DIGEST_TO', '').strip()
    host = os.environ.get('DIGEST_SMTP_HOST', '').strip()
    user = os.environ.get('DIGEST_SMTP_USER', '').strip()
    pwd = os.environ.get('DIGEST_SMTP_PASS', '').strip()
    port = int(os.environ.get('DIGEST_SMTP_PORT', '465'))

    if not all([to, host, user, pwd]):
        print(f'[dry-run] 缺 SMTP 配置，未发邮件。weekly_digest.md / weekly_digest_title.txt 已产出')
        print(f'[dry-run] 主题: {subject}')
        print(f'[dry-run] 近7天: Agent事件 {len(events) + more} 条 / 新模型 {len(new_models)} 个 / '
              f'学习主题 {stage.get("title") if stage else "无"}')
        return

    msg = MIMEText(html, 'html', 'utf-8')
    msg['Subject'] = Header(subject, 'utf-8')
    msg['From'] = f'llm-tracker 周报 <{user}>'
    msg['To'] = to
    with smtplib.SMTP_SSL(host, port, timeout=30) as s:
        s.login(user, pwd)
        s.sendmail(user, [to], msg.as_string())
    print(f'[sent] {subject} -> {to}')


if __name__ == '__main__':
    sys.exit(main())
