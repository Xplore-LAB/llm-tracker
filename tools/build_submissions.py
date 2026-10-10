#!/usr/bin/env python3
"""Build submission pages and the existing encoded conference data from readable sources."""
import base64
import html
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'docs' / 'submissions'
KEY = b'XploreLAB#2026$Chronicle'


def esc(value):
    return html.escape(str(value), quote=True)


def link(url, label):
    if url.startswith('http://'):
        url = 'https://' + url[7:]
    if not url.startswith('https://'):
        raise ValueError(f'Expected HTTPS official source: {url}')
    return f'<a href="{esc(url)}" target="_blank" rel="noopener noreferrer">{esc(label)} ↗</a>'


def card(key, name, full, field, grade, kind, note, dates, guide, classification=None, checked=None, mode='conference'):
    rank = 'CCF-' + grade if grade else '领域投稿参考'
    verification = f'细则核验 {checked}' if checked else '官方入口 · 细则待复核'
    if kind == 'conference':
        verification = '节点核验日期见各条来源'
    return f'''<article class="venue" id="venue-{esc(key)}" data-kind="{kind}" data-grade="{esc(grade or '')}" data-field="{esc(field)}" data-mode="{mode}">
      <div class="venue-top"><span class="rank {'rank-a' if grade == 'A' else ''}">{esc(rank)}</span><span class="status">{'按节点查看' if kind == 'conference' else '月度投稿' if mode == 'monthly' else '滚动投稿'}</span></div>
      <h3>{esc(name)}</h3><p class="full">{esc(full)}</p><p class="field">{esc(field)}</p>
      <p class="note">{esc(note)}</p><ul class="dates">{dates}</ul>
      <div class="links">{link(guide, '官方投稿指南 / 官网')}{(' · ' + link(classification, 'CCF 来源')) if classification else ''}</div>
      <p class="verification">{esc(verification)}</p></article>'''


def build():
    conferences = json.loads((SOURCE / 'conferences.json').read_text())
    journals = json.loads((SOURCE / 'journals.json').read_text())
    raw = json.dumps(conferences, ensure_ascii=False, indent=2) + '\n'
    encoded = base64.b64encode(bytes(v ^ KEY[i % len(KEY)] for i, v in enumerate(raw.encode()))).decode()
    (ROOT / 'conferences.json').write_text(encoded)
    cards = []
    for key, venue in conferences['series'].items():
        if key == 'arr':
            continue  # ARR is a review mechanism rather than a publication venue.
        grade = venue.get('tag', {}).get('tier', '').removeprefix('CCF-')
        if grade not in ('A', 'B', 'C'):
            grade = None
        events = [e for e in conferences['events'] if e['s'] == key]
        dates = ''
        for event in events:
            dates += f'''<li data-type="{esc(event['t'])}" data-date="{esc(event['d'])}" data-zone="{'aoe' if 'AoE' in event.get('note', '') else 'other'}">
              <time datetime="{event['d']}">{event['d']}{(' — ' + event['e']) if event.get('e') else ''}</time> {esc(event['label'])}
              <small>{esc(event.get('note', ''))} · 核验 {esc(event.get('checkedAt', '2026-09-01'))} · {link(event['url'], '来源')}</small></li>'''
        for watch in conferences['watch']:
            if watch['s'] == key:
                dates += f'<li class="pending">待公布 / 待复核：{esc(watch["item"])} · {link(watch["url"], "官方入口")}</li>'
        if not dates:
            dates = '<li class="pending">本届投稿日期待核实</li>'
        cards.append(card(key, venue['name'], venue['full'], venue.get('tag', {}).get('focus', ''), grade,
                          'conference', venue.get('about', {}).get('intro', ''), dates,
                          next((e['url'] for e in events if e['t'] == 'sub'), venue.get('about', {}).get('url') or events[0]['url']), venue.get('classificationSource')))
    for journal in journals['journals']:
        dates = '<li>普通稿件：滚动投稿；特刊按各自 CFP 截止。</li>'
        if journal['mode'] == 'monthly':
            dates = '<li>每月 1 日 23:59 Honolulu（UTC-10）截止。<small class="monthly-next"></small></li>'
        cards.append(card(journal['key'], journal['name'], journal['full'], journal['field'], journal['ccf'],
                          'journal', journal['note'], dates, journal['guide'], journal['classificationSource'],
                          journal['checkedAt'], journal['mode']))
    template = (SOURCE / 'index.template.html').read_text()
    output = template.replace('<!-- VENUE_CARDS -->', '\n'.join(cards)).replace('{{UPDATED}}', journals['meta']['updated'])
    destination = ROOT / 'research' / 'submissions' / 'index.html'
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(output)
    # Add an idempotent entry to the published legacy pages without changing their inline scripts.
    for name in ('index.html', 'research/index.html', 'research/conf/index.html'):
        path = ROOT / name
        content = path.read_text()
        if 'id="submission-nav"' not in content:
            content = content.replace('<div class="tabs">', '<div class="tabs">\n<a id="submission-nav" class="tab" href="/llm-tracker/research/submissions/">📝 投稿指南</a>', 1)
        marker = 'id="submission-entry"'
        if marker not in content:
            entry = '<div id="submission-entry" style="position:relative;z-index:1;max-width:1160px;margin:16px auto;padding:12px 18px;border:1px solid #8a8270;border-radius:10px;font:inherit"><a style="color:inherit;font-weight:600" href="/llm-tracker/research/submissions/">📝 论文投稿 · 顶会、CCF-A 与高水平期刊 →</a></div>'
            content = content.replace('<footer>', entry + '\n<footer>', 1)
        path.write_text(content)
    # Include the new page in the existing encoded global search index.
    index_path = ROOT / 'site-index.json'
    encrypted = base64.b64decode(index_path.read_text())
    index = json.loads(bytes(v ^ KEY[i % len(KEY)] for i, v in enumerate(encrypted)))
    if isinstance(index, dict) and 'items' in index:
        items = index['items']
        prefix = 'research/submissions/'
        items[:] = [item for item in items if not str(item.get('u', '')).startswith(prefix)]
        for key, venue in conferences['series'].items():
            if key == 'arr':
                continue
            events = [e for e in conferences['events'] if e['s'] == key]
            items.append(dict(t='submission', h=venue['name'] + ' · 投稿节点', e=venue['full'],
                              s='投稿指南 · ' + venue.get('tag', {}).get('tier', ''),
                              u=prefix + '#venue-' + key,
                              x=venue.get('tag', {}).get('focus', '') + ' ' + ' '.join(e['d'] + ' ' + e['label'] for e in events)))
        for journal in journals['journals']:
            item = dict(t='submission', h=journal['name'] + ' · 论文投稿', e=journal['full'],
                        s='投稿指南 · ' + journal['field'], u=prefix + '#venue-' + journal['key'],
                        x=journal['note'] + ' ' + ('CCF-' + journal['ccf'] if journal['ccf'] else '领域投稿参考'))
            items.append(item)
        index['meta']['count'] = len(items)
        index['meta']['updated'] = journals['meta']['updated']
        data = json.dumps(index, ensure_ascii=False).encode()
        index_path.write_text(base64.b64encode(bytes(v ^ KEY[i % len(KEY)] for i, v in enumerate(data))).decode())
    print(f'Built {len(cards)} venues; updated conference timeline and submission entries.')


if __name__ == '__main__':
    build()
