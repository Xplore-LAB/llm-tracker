#!/usr/bin/env python3
"""Create local preview credentials once; keep them out of source control and logs."""
from pathlib import Path
import http.client
import json
import os
import secrets
import socket
import subprocess
import tempfile
import time

ROOT = Path(__file__).resolve().parent

def setup():
    credentials = ROOT / 'local-accounts.txt'
    if credentials.exists():
        print(f'Local accounts already initialized. See {credentials}')
        return
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        port = sock.getsockname()[1]
    origin = f'http://127.0.0.1:{port}'
    admin_email = 'local-admin@example.com'
    admin_password = secrets.token_urlsafe(24)
    member_password = secrets.token_urlsafe(18)
    env = dict(os.environ, TRACKER_ORIGIN=origin, TRACKER_ADMIN_EMAIL=admin_email,
               TRACKER_ADMIN_PASSWORD=admin_password)
    def call(path, data=None, token=None):
        conn = http.client.HTTPConnection('127.0.0.1', port, timeout=10)
        headers = {'Content-Type': 'application/json', 'Origin': origin}
        if token:
            headers['Authorization'] = token
        conn.request('POST' if data is not None else 'GET', path,
                     json.dumps(data) if data is not None else None, headers)
        response = conn.getresponse()
        body = response.read()
        conn.close()
        if response.status != 200:
            raise RuntimeError(f'{path}: HTTP {response.status}; if a database already exists, use its existing admin account.')
        return json.loads(body)
    with tempfile.TemporaryFile(mode='w+') as log:
        proc = subprocess.Popen([str(ROOT / 'bin/pocketbase'), 'serve', f'--http=127.0.0.1:{port}',
            f'--dir={ROOT}/pb_data', f'--hooksDir={ROOT}/pb_hooks',
            f'--migrationsDir={ROOT}/pb_migrations', '--automigrate=false', '--hooksWatch=false',
            f'--publicDir={ROOT}/site', '--indexFallback=false', f'--origins={origin}'],
            env=env, stdout=log, stderr=log)
        try:
            for _ in range(100):
                if proc.poll() is not None:
                    raise RuntimeError('PocketBase could not start')
                try:
                    call('/api/health')
                    break
                except OSError:
                    time.sleep(.1)
            admin = call('/api/collections/_superusers/auth-with-password',
                         {'identity': admin_email, 'password': admin_password})['token']
            call('/api/collections/members/records', {'username': 'learner', 'name': '学习账号',
                'password': member_password, 'passwordConfirm': member_password}, admin)
            fd = os.open(credentials, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            with os.fdopen(fd, 'w') as file:
                file.write('本地预览账号（随机生成，请勿提交到 Git 或对外分享）\n\n'
                    '登录页：http://127.0.0.1:8090/auth/login\n'
                    f'用户名：learner\n密码：{member_password}\n\n'
                    '管理后台：http://127.0.0.1:8090/_/\n'
                    f'管理员邮箱：{admin_email}\n管理员密码：{admin_password}\n')
            print(f'Local accounts created. Credentials: {credentials}')
        finally:
            proc.terminate()
            proc.wait(timeout=10)

if __name__ == '__main__':
    setup()
