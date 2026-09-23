#!/usr/bin/env python3
"""Build public Pages by default; explicitly enable the optional login gate."""
import argparse
import base64
import json
import os
from pathlib import Path
import posixpath
import re
import shutil
import subprocess
from urllib.parse import urlparse
from build import ROOT, DIRECTORIES, EXTENSIONS

def public_config(preview=False, test=False):
    url = os.environ.get('TRACKER_SUPABASE_URL', '').rstrip('/')
    key = os.environ.get('TRACKER_SUPABASE_PUBLISHABLE_KEY', '')
    if not url or not key:
        if preview:
            return {'url': '', 'key': '', 'testMode': False}
        raise ValueError('Set TRACKER_SUPABASE_URL and TRACKER_SUPABASE_PUBLISHABLE_KEY. Use --preview only for an unconfigured preview.')
    parsed = urlparse(url)
    if parsed.scheme != 'https' and not (test and parsed.scheme == 'http' and parsed.hostname in {'127.0.0.1', 'localhost'}):
        raise ValueError('Auth URL must use HTTPS (local fixture allowed only with --test).')
    if not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment or parsed.path:
        raise ValueError('Auth URL must be an origin without credentials, path, query or fragment.')
    valid = key.startswith('sb_publishable_')
    if not valid and not key.startswith('sb_secret_'):
        try:
            payload = key.split('.')[1]
            valid = json.loads(base64.urlsafe_b64decode(payload + '=' * (-len(payload) % 4)))['role'] == 'anon'
        except (ValueError, KeyError, IndexError):
            pass
    if not valid:
        raise ValueError('Only publishable/anon keys are allowed in Pages. Never use a secret/service_role key.')
    return {'url': url, 'key': key, 'testMode': test}

def resolve_auth_mode(mode=None, preview=False, test=False):
    if mode is not None:
        return mode == 'login'
    # Preview/test preserve the explicit account-development workflow.
    value = os.environ.get('TRACKER_AUTH_ENABLED', 'true' if preview or test else 'false').strip().lower()
    if value not in {'true', 'false'}:
        raise ValueError('TRACKER_AUTH_ENABLED must be true or false.')
    return value == 'true'

def build(preview=False, test=False, mode=None):
    enabled = resolve_auth_mode(mode, preview, test)
    if test and not enabled:
        raise ValueError('--test is only for login-mode fixtures.')
    config = public_config(preview, test) if enabled else None
    folder = 'pages-test-dist' if test else 'pages-preview' if preview else 'pages-dist'
    out = ROOT / 'auth' / folder
    if out.exists():
        shutil.rmtree(out)
    account = out / 'account'
    out.mkdir(parents=True)
    if enabled:
        account.mkdir()
    pages = []
    for name in subprocess.check_output(['git', 'ls-files', '-z'], cwd=ROOT).decode().split('\0'):
        if not name:
            continue
        path = Path(name)
        if (path.suffix not in EXTENSIONS and name != 'robots.txt') or any(part.startswith('.') for part in path.parts):
            continue
        if len(path.parts) > 1 and path.parts[0] not in DIRECTORIES:
            continue
        if path.name in {'llm-proxy-server.js', 'llm-proxy-worker.js', 'package.json', 'package-lock.json'} or (enabled and path.name == 'favorites.json'):
            continue
        source = ROOT / path
        if source.is_symlink() or not source.is_file():
            continue
        target = out / path
        target.parent.mkdir(parents=True, exist_ok=True)
        if path.suffix != '.html' or not enabled:
            shutil.copyfile(source, target)
            if path.suffix == '.html':
                pages.append(name)
            continue
        original = source.read_text()
        # Keep the original static-site code unchanged in the repository.
        original = original.replace('function syncFavsURL(){', 'function syncFavsURL(){return null;')
        original = original.replace('https://llm-tracker-api.llm-tracker-api.workers.dev', '')
        relative = posixpath.relpath('account', path.parent.as_posix())
        original, count = re.subn(r'<head(?:\s[^>]*)?>', lambda m: m[0] +
            f'\n<link rel="stylesheet" href="{relative}/toolbar.css">', original, count=1, flags=re.I)
        if count != 1:
            raise ValueError(f'Missing head element: {path}')
        payload = json.dumps(base64.b64encode(original.encode()).decode())
        target.write_text(f'''<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="referrer" content="same-origin"><title>大模型情报局</title>
<link rel="stylesheet" href="{relative}/style.css"><script type="module" src="{relative}/guard.js"></script></head>
<body><main class="account-main"><section class="card"><h1>正在检查登录状态</h1><p class="description">请稍候。</p>
<a href="{relative}/login.html">前往登录</a><noscript><p>请启用 JavaScript 后使用本站。</p></noscript></section></main>
<script id="tracker-source" type="application/json">{payload}</script></body></html>''')
        pages.append(name)
    if enabled:
        shell = (ROOT / 'auth/pages/shell.html').read_text()
        for name in ['login', 'reset', 'callback', 'password', 'profile', 'status', 'admin']:
            (account / f'{name}.html').write_text(shell.replace('{{PAGE}}', name))
        for name in ['style.css', 'toolbar.css']:
            shutil.copyfile(ROOT / 'auth/pages' / name, account / name)
        (account / 'config.js').write_text('export const config = ' + json.dumps(config) + ';\n')
        for name in ['forms', 'guard']:
            subprocess.run([str(ROOT / 'node_modules/.bin/esbuild'), f'auth/pages/{name}.js', '--bundle',
                            '--format=esm', '--platform=browser', '--target=es2022', '--minify',
                            '--external:./config.js', '--legal-comments=linked',
                            f'--outfile={account / (name + ".js")}'], cwd=ROOT, check=True)
        # Preserve notices for bundled runtime dependencies (including transitive ones).
        notices = []
        lock = json.loads((ROOT / 'package-lock.json').read_text())
        for name, info in lock['packages'].items():
            if not name or info.get('dev') or not (ROOT / name).is_dir():
                continue
            package = ROOT / name
            texts = [file.read_text() for file in sorted(package.iterdir()) if file.is_file()
                     and file.name.lower().startswith(('license', 'licence', 'copyrightnotice', 'copying'))]
            if not texts:
                raise ValueError(f'Missing bundled dependency license: {name}')
            notices.append(name + ' @ ' + info['version'] + '\n\n' + '\n'.join(texts))
        (account / 'third-party-notices.txt').write_text('\n\n'.join(notices))
    (out / '.nojekyll').touch()
    (out / '404.html').write_text('''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>页面不存在</title><body><h1>页面不存在</h1><p>请检查链接，或返回原页面。</p><button onclick="history.back()">返回</button></body></html>''')
    manifest = {'pages': pages, 'mode': 'login' if enabled else 'public', 'accountPages': 7 if enabled else 0, 'configured': bool(config and config['url']), 'testMode': test}
    (out / 'build-manifest.json').write_text(json.dumps(manifest, indent=2))
    print(f'Pages artifact: {out} ({len(pages)} site pages, {manifest["accountPages"]} account pages; mode={manifest["mode"]}; configured={manifest["configured"]})')
    return out

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    modes = parser.add_mutually_exclusive_group()
    modes.add_argument('--preview', action='store_true', help='Allow an unconfigured, nonfunctional account preview')
    modes.add_argument('--test', action='store_true', help='Local fixture build; never publish this output')
    parser.add_argument('--mode', choices=['public', 'login'], help='Override TRACKER_AUTH_ENABLED for this build only')
    args = parser.parse_args()
    build(args.preview, args.test, args.mode)
