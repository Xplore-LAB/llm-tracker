#!/usr/bin/env python3
"""Build the authenticated static site without exposing source/config/database files."""
from pathlib import Path
import re
import shutil
import subprocess

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'auth' / 'site'
DIRECTORIES = {'agents', 'api', 'assets', 'blogs', 'chronicle', 'deploy', 'dgx-spark',
               'docs', 'glossary', 'hardware', 'lab', 'leaderboard', 'models', 'museum',
               'qiuzhao', 'research', 'timeline', 'tools'}
EXTENSIONS = {'.html', '.json', '.js', '.css', '.png', '.svg', '.jpg', '.webp', '.ico', '.woff2'}

def build():
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir()
    count = 0
    for name in subprocess.check_output(['git', 'ls-files', '-z'], cwd=ROOT).decode().split('\0'):
        if not name:
            continue
        relative = Path(name)
        if relative.suffix not in EXTENSIONS or any(p.startswith('.') for p in relative.parts):
            continue
        if len(relative.parts) > 1 and relative.parts[0] not in DIRECTORIES:
            continue
        if relative.name in {'llm-proxy-server.js', 'llm-proxy-worker.js', 'favorites.json'}:
            continue
        source = ROOT / relative
        if source.is_symlink() or not source.is_file():
            continue
        target = OUT / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        if source.suffix == '.html':
            text = source.read_text()
            text, injected = re.subn(r'<head(?:\s[^>]*)?>', lambda m: m[0] + '\n<script src="/auth/session.js"></script>', text, count=1, flags=re.I)
            if injected != 1:
                raise ValueError(f'Missing head element in {relative}')
            # The legacy Worker stores everyone's favorites in one shared GitHub file.
            text = text.replace('function syncFavsURL(){', 'function syncFavsURL(){return null;')
            # Keep data fallback same-origin as well; all JSON must pass the server gate.
            text = text.replace('https://llm-tracker-api.llm-tracker-api.workers.dev', '')
            target.write_text(text)
            count += 1
        else:
            shutil.copyfile(source, target)
    print(f'Built {count} protected pages in {OUT}')

if __name__ == '__main__':
    build()
