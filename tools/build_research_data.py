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
        grade = 'CCF-' + journal['ccf'] if journal['ccf'] else '领域高水平期刊参考'
        mode = '每月 1 日 23:59 Honolulu（UTC-10）截止' if journal['mode'] == 'monthly' else '普通稿件滚动投稿，特刊另看 CFP'
        checked = '投稿细则核验 ' + journal['checkedAt'] if journal['checkedAt'] else '官方入口已收录，投稿细则待复核'
        source = f'<a href="{esc(journal["classificationSource"])}" target="_blank" rel="noopener noreferrer">CCF 分级来源 ↗</a>' if journal['classificationSource'] else ''
        metric = journal.get('impactFactor')
        impact = (f'<a href="{esc(metric["source"])}" target="_blank" rel="noopener noreferrer">JIF {metric["value"]} · {metric["year"]} ↗</a>' if metric else 'JIF 待核验')
        value = str(metric['value']) if metric else ''
        year = str(metric['year']) if metric else ''
        cards.append(f'''<article class="journal-card" data-name="{esc(journal['name'])}" data-field="{esc(journal['field'])}" data-ccf="{esc(journal['ccf'] or 'unknown')}" data-if="{value}" data-year="{year}"><div class="journal-grade">{esc(grade)} · {esc(journal['field'])}</div>
<h3>{esc(journal['name'])}</h3><p class="journal-impact">{impact}</p><p class="journal-full">{esc(journal['full'])}</p>
<p>{esc(journal['note'])}</p><p class="journal-mode">{esc(mode)}</p>
<p><a href="{esc(journal['guide'])}" target="_blank" rel="noopener noreferrer">官方投稿指南 / 官网 ↗</a> {source}</p>
<small>{esc(checked)}</small></article>''')
    section = '<!-- JOURNALS_START -->\n<section id="conference-journals" hidden><h2>期刊投稿 · CCF-A 与领域高水平期刊</h2><p class="journal-intro">更新 ' + esc(data['meta']['updated']) + ' · ' + str(len(cards)) + ' 本期刊。CCF 分级与领域定位分别展示；高水平期刊参考不表示与 CCF-A 等价。普通稿件滚动投稿，特刊按官方 CFP；逐条保留核验口径。</p><div class="journal-grid">' + '\n'.join(cards) + '</div></section>\n<!-- JOURNALS_END -->'
    page = ROOT / 'research/index.html'
    content = page.read_text()
    if '<!-- JOURNALS_START -->' in content:
        content = re.sub(r'<!-- JOURNALS_START -->.*?<!-- JOURNALS_END -->', lambda _: section, content, flags=re.S)
    else:
        content = content.replace('<footer>', section + '\n<footer>', 1)
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
