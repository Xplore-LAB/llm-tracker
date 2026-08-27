#!/usr/bin/env python3
"""Agent 前线 · 候选池审核合并工具（本地使用）

对 agents-inbox.json 中每日管线攒下的候选条目做人工裁决，合入正式数据。

用法:
  python3 scripts/merge_agent_news.py                    # 列出候选池
  python3 scripts/merge_agent_news.py --all              # 全部合入
  python3 scripts/merge_agent_news.py --pick 1,3,5       # 合入指定编号
  python3 scripts/merge_agent_news.py --drop 2           # 丢弃指定编号
  python3 scripts/merge_agent_news.py --prune 30         # 清理入库超 30 天的候选

合入动作会同步：
  1. 线上密文 agents.json（页面立即生效）
  2. 本地明文源 _llm-tracker-src/data/agents.json（防止下次构建回退）
之后如需混淆产物对齐，手动跑 tools/build_protect.js 即可。
"""
import json
import os
import sys
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from discover_agent_news import load_agents, save_agents, sync_src, INBOX_JSON

def load_inbox():
    if not os.path.exists(INBOX_JSON):
        print('候选池为空（agents-inbox.json 不存在）')
        return None
    return json.load(open(INBOX_JSON))

def save_inbox(d):
    json.dump(d, open(INBOX_JSON, 'w'), ensure_ascii=False, indent=2)

def show(events):
    print(f'候选池共 {len(events)} 条：\n')
    for i, e in enumerate(events, 1):
        print(f"  {i:2d}. [{e['date']}] [{e.get('confidence', '?')}] {e.get('company', '?')}")
        print(f"      {e['title']}")
        print(f"      {e['note'][:80]}{'...' if len(e['note']) > 80 else ''}")
        print(f"      来源: {e.get('source', '?')} | {e['url'][:70]}")
    print('\n操作: --all 全合入 | --pick 编号合入 | --drop 编号丢弃 | --prune 天数清理')

def merge_indices(events, idx):
    agents = load_agents()
    kept, merged = [], []
    for i, e in enumerate(events, 1):
        if i in idx:
            merged.append({k: e[k] for k in ('date', 'company', 'cat', 'title', 'note', 'url')})
        else:
            kept.append(e)
    if not merged:
        print('未选择任何条目')
        return
    agents['events'].extend(merged)
    agents['events'].sort(key=lambda x: x['date'], reverse=True)
    save_agents(agents)
    sync_src(agents)
    print(f'已合入 {len(merged)} 条，正式 events 总数 {len(agents["events"])}')
    print('线上 agents.json 已更新；如需产物页对齐可跑 tools/build_protect.js')
    return kept

def main():
    args = sys.argv[1:]
    inbox = load_inbox()
    if inbox is None:
        return
    events = inbox.get('events', [])
    if not events:
        print('候选池为空')
        return

    if not args:
        show(events)
        return

    if args[0] == '--all':
        kept = merge_indices(events, set(range(1, len(events) + 1)))
        if kept is not None:
            inbox['events'] = kept or []
            save_inbox(inbox)
    elif args[0] == '--pick':
        idx = {int(x) for x in args[1].split(',') if x.strip().isdigit()}
        kept = merge_indices(events, idx)
        if kept is not None:
            inbox['events'] = kept
            save_inbox(inbox)
    elif args[0] == '--drop':
        idx = {int(x) for x in args[1].split(',') if x.strip().isdigit()}
        inbox['events'] = [e for i, e in enumerate(events, 1) if i not in idx]
        save_inbox(inbox)
        print(f'已丢弃 {len(idx)} 条，剩余 {len(inbox["events"])} 条')
    elif args[0] == '--prune':
        days = int(args[1]) if len(args) > 1 else 30
        cutoff = (datetime.now(timezone.utc) - __import__('datetime').timedelta(days=days)).date().isoformat()
        before = len(events)
        inbox['events'] = [e for e in events if e.get('found', '9999') >= cutoff]
        save_inbox(inbox)
        print(f'清理入库超 {days} 天的候选：{before} -> {len(inbox["events"])}')
    else:
        show(events)

if __name__ == '__main__':
    main()
