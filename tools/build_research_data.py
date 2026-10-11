#!/usr/bin/env python3
"""Update existing conference data and embed journal data in the conference view."""
import base64
import html
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
KEY = b'XploreLAB#2026$Chronicle'


def build():
    raw = (ROOT / 'docs/submissions/conferences.json').read_text()
    data = json.loads(raw)
    encoded = bytes(v ^ KEY[i % len(KEY)] for i, v in enumerate(raw.encode()))
    (ROOT / 'conferences.json').write_text(base64.b64encode(encoded).decode())
    esc = html.escape
    cards = []
    for journal in data['journals']:
        grade = 'CCF-' + journal['ccf'] if journal['ccf'] else '领域期刊 · CCF 未核定'
        mode = '每月 1 日 23:59 Honolulu（UTC-10）截止' if journal['mode'] == 'monthly' else '普通稿件滚动投稿，特刊另看 CFP'
        checked = '投稿细则核验 ' + journal['checkedAt'] if journal['checkedAt'] else '官方入口已收录，投稿细则待复核'
        source = f'<a href="{esc(journal["classificationSource"])}" target="_blank" rel="noopener noreferrer">CCF 分级来源 ↗</a>' if journal['classificationSource'] else ''
        metric = journal.get('impactFactor')
        impact = (f'<a href="{esc(metric["source"])}" target="_blank" rel="noopener noreferrer">JIF {metric["value"]} · {metric["year"]} ↗</a>' if metric else 'JIF 待核验')
        value = str(metric['value']) if metric else ''
        year = str(metric['year']) if metric else ''
        cards.append(f'''<article class="journal-card" data-name="{esc(journal['name'])}" data-field="{esc(journal['field'])}" data-ccf="{esc(journal['ccf'] or 'unknown')}" data-if="{value}" data-year="{year}" data-topics="{esc(" ".join(journal.get("priorityTopics", [])))}"><div class="journal-grade">{esc(grade)} · {esc(journal['field'])}</div>
<h3>{esc(journal['name'])}</h3><p class="journal-impact">{impact}</p><p class="journal-full">{esc(journal['full'])}</p>
<p>{esc(journal['note'])}</p><p class="journal-fit">匹配建议：{esc(journal.get('submissionFit', ''))}</p><p class="journal-mode">{esc(mode)}</p>
<p><a href="{esc(journal['guide'])}" target="_blank" rel="noopener noreferrer">官方投稿指南 / 官网 ↗</a> {source}</p>
<small>{esc(checked)}</small></article>''')
    section = '<!-- JOURNALS_START -->\n<section id="conference-journals" hidden><h2>期刊投稿 · CCF-A 与领域期刊</h2><p class="journal-intro">更新 ' + esc(data['meta']['updated']) + ' · ' + str(len(cards)) + ' 本期刊。CCF 分级与领域定位分别展示；高水平期刊参考不表示与 CCF-A 等价。普通稿件滚动投稿，特刊按官方 CFP；逐条保留核验口径。</p><div class="journal-grid">' + '\n'.join(cards) + '</div></section>\n<!-- JOURNALS_END -->'
    page = ROOT / 'research/index.html'
    content = page.read_text()
    if '<!-- JOURNALS_START -->' in content:
        content = re.sub(r'<!-- JOURNALS_START -->.*?<!-- JOURNALS_END -->', lambda _: section, content, flags=re.S)
    else:
        content = content.replace('<footer>', section + '\n<footer>', 1)
    # The research panorama includes communities with no confirmed dates.
    domains = []
    for domain in data.get('frontierDomains', []):
        venues = []
        for key in domain['series']:
            series = data['series'][key]
            venues.append(f'''<article class="frontier-venue" data-series="{esc(key)}" data-domain="{esc(domain['key'])}"><h4>{esc(series['name'])}</h4><p class="frontier-tier">{esc(series.get('tag', {}).get('tier', 'CCF 未核定'))}</p><p>{esc(series.get('submissionFit', ''))}</p><p class="frontier-state">日期状态待核验</p><a href="{esc(series.get('fitSource') or series['about']['url'])}" target="_blank" rel="noopener noreferrer">官方范围 / 入口 ↗</a></article>''')
        journals = [journal for journal in data['journals'] if journal['key'] in domain['journals']]
        links = ' · '.join(f'<a href="{esc(journal["guide"])}" target="_blank" rel="noopener noreferrer">{esc(journal["name"])}</a>' for journal in journals)
        domains.append(f'''<details class="frontier-domain" data-domain="{esc(domain['key'])}"><summary>{esc(domain['name'])} · {len(venues)} 个社区</summary><p class="frontier-questions">关注问题：{esc(domain['questions'])}</p><div class="frontier-grid">{''.join(venues)}</div><p class="frontier-journals">相关期刊：{links}</p></details>''')
    sources = ''.join(f'<li><a href="{esc(source["url"])}" target="_blank" rel="noopener noreferrer">{esc(source["name"])}</a><span>{esc(source["focus"])}</span></li>' for source in data.get('frontierSources', []))
    panorama = f'''<!-- FRONTIER_START -->
<section id="conference-frontier" hidden><h2>研究视野 · Agent、LLM 与工业控制</h2><p class="journal-intro">核对 {esc(data['coverageAudit']['updated'])} · {len(data['series'])} 个会议 / 评审社区 · {len(data['journals'])} 本期刊 · 6 个交叉方向。社区目录包含已截稿与日期待核验的目标；不代表所有条目现在可投。CCF 分级与领域定位分别呈现。</p>
<div class="journal-controls"><label>视野关键词<input id="frontier-query" type="search" placeholder="Agent、LLM、控制、社区名称"></label><label>研究分支<select id="frontier-domain"><option value="">全部分支</option>{''.join(f'<option value="{esc(domain["key"])}">{esc(domain["name"])}</option>' for domain in data.get('frontierDomains', []))}</select></label><label>初次论文投稿状态<select id="frontier-status"><option value="">全部状态</option><option value="upcoming">已核验 · 截止未到</option><option value="closed">已核验 · 本轮已截稿</option><option value="unknown">日期待核验 / 观察</option></select></label><button id="frontier-reset" type="button">重置视野筛选</button></div><p id="frontier-results" class="journal-results" role="status"></p>{''.join(domains)}
<details class="frontier-sources"><summary>官方研究与行业社区 · 6 个入口</summary><p class="journal-intro">用于持续追踪论文和技术报告；本页不自动同步这些机构的最新文章，也不将厂商自报结果当作独立验证。</p><ul>{sources}</ul></details></section>
<!-- FRONTIER_END -->'''
    if '<!-- FRONTIER_START -->' in content:
        content = re.sub(r'<!-- FRONTIER_START -->.*?<!-- FRONTIER_END -->', lambda _: panorama, content, flags=re.S)
    else:
        content = content.replace('<!-- JOURNALS_START -->', panorama + '\n<!-- JOURNALS_START -->', 1)
    if 'research-journals.css' not in content:
        content = content.replace('</head>', '<link rel="stylesheet" href="../assets/research-journals.css">\n</head>', 1)
        content = content.replace('</body>', '<script src="../assets/research-journals.js"></script>\n</body>', 1)
    # A content version prevents returning visitors from reusing an older tab script.
    version = hashlib.sha256((ROOT / 'assets/research-journals.js').read_bytes()).hexdigest()[:12]
    content = re.sub(r'../assets/research-journals\.js(?:\?v=[^"\s]*)?',
                     '../assets/research-journals.js?v=' + version, content)
    css_version = hashlib.sha256((ROOT / 'assets/research-journals.css').read_bytes()).hexdigest()[:12]
    content = re.sub(r'../assets/research-journals\.css(?:\?v=[^"\s]*)?',
                     '../assets/research-journals.css?v=' + css_version, content)
    page.write_text(content)
    print('Updated existing conference view:', len(data['series']), 'series and', len(cards), 'journals')


if __name__ == '__main__':
    build()
