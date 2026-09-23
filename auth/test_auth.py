#!/usr/bin/env python3
"""Integration checks against a real PocketBase with an isolated temporary database."""
from pathlib import Path
import http.client
import json
import os
import secrets
import socket
import subprocess
import tempfile
import time
import unittest

ROOT = Path(__file__).resolve().parent

class AuthTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory(prefix='tracker-auth-test-')
        cls.log = open(Path(cls.temp.name) / 'server.log', 'w+')
        with socket.socket() as sock:
            sock.bind(('127.0.0.1', 0))
            cls.port = sock.getsockname()[1]
        cls.origin = f'http://127.0.0.1:{cls.port}'
        cls.password = secrets.token_urlsafe(24)
        env = dict(os.environ, TRACKER_ORIGIN=cls.origin,
                   TRACKER_ADMIN_EMAIL='admin@example.test', TRACKER_ADMIN_PASSWORD=cls.password)
        cls.proc = subprocess.Popen([str(ROOT / 'bin/pocketbase'), 'serve', f'--http=127.0.0.1:{cls.port}',
            f'--dir={cls.temp.name}/data', f'--hooksDir={ROOT}/pb_hooks',
            f'--migrationsDir={ROOT}/pb_migrations', '--automigrate=false', '--hooksWatch=false',
            f'--publicDir={ROOT}/site', '--indexFallback=false', f'--origins={cls.origin}'],
            env=env, stdout=cls.log, stderr=cls.log)
        cls.addClassCleanup(cls.cleanup)
        for _ in range(100):
            if cls.proc.poll() is not None:
                cls.log.seek(0)
                raise RuntimeError(cls.log.read())
            try:
                if cls.call('/api/health')[0] == 200:
                    break
            except OSError:
                pass
            time.sleep(.1)
        else:
            raise RuntimeError('Server did not become ready')
        status, _, body = cls.call('/api/collections/_superusers/auth-with-password', 'POST',
                                  {'identity': 'admin@example.test', 'password': cls.password})
        assert status == 200, (status, body)
        cls.admin = json.loads(body)['token']
        status, _, body = cls.call('/api/settings', token=cls.admin)
        assert status == 200
        cls.rate_limits = json.loads(body)['rateLimits']
        assert cls.rate_limits['enabled'] is True
        # Exercise authorization without timing dependence, then restore and test limits.
        assert cls.call('/api/settings', 'PATCH', {'rateLimits': dict(cls.rate_limits, enabled=False)}, token=cls.admin)[0] == 200
        cls.members = {}
        for username in ['alice', 'bob', 'disabled', 'resetuser', 'logoutuser', 'rateuser']:
            status, _, body = cls.call('/api/collections/members/records', 'POST',
                {'username': username, 'password': cls.password, 'passwordConfirm': cls.password,
                 'name': username, 'disabled': username == 'disabled'}, token=cls.admin)
            assert status == 200, (status, body)
            cls.members[username] = json.loads(body)['id']

    @classmethod
    def cleanup(cls):
        cls.proc.terminate()
        cls.proc.wait(timeout=10)
        cls.log.close()
        cls.temp.cleanup()

    @classmethod
    def call(cls, path, method='GET', data=None, token=None, cookie=None, headers=None):
        conn = http.client.HTTPConnection('127.0.0.1', cls.port, timeout=10)
        hdr = {'Origin': cls.origin}
        if data is not None:
            hdr['Content-Type'] = 'application/json'
        if token:
            hdr['Authorization'] = token
        if cookie:
            hdr['Cookie'] = cookie
        hdr.update(headers or {})
        conn.request(method, path, json.dumps(data) if data is not None else None, hdr)
        res = conn.getresponse()
        result = res.status, dict(res.getheaders()), res.read()
        conn.close()
        return result

    @classmethod
    def login(cls, username='alice', password=None):
        return cls.call('/api/collections/members/auth-with-password', 'POST',
                        {'identity': username, 'password': password or cls.password})

    def session(self, username='alice'):
        status, headers, body = self.login(username)
        self.assertEqual(status, 200, body)
        return headers['Set-Cookie'].split(';')[0], json.loads(body)['token']

    def test_01_guest_gate(self):
        for path in ['/', '/index.html', '/models/', '/qiuzhao/pm/', '/papers.json',
                     '/api/index.json', '/api/papers/page-001.json', '/assets/ai-assistant.js',
                     '/auth/session.js', '/api/tracker/me']:
            with self.subTest(path=path):
                self.assertEqual(self.call(path)[0], 401)
        status, headers, _ = self.call('/models/?tab=one', headers={'Accept': 'text/html'})
        self.assertEqual(status, 303)
        self.assertIn('/auth/login?next=', headers['Location'])
        self.assertIn('no-store', headers['Cache-Control'])

    def test_02_public_entrypoints(self):
        for path in ['/auth/login', '/auth/login.js', '/auth/style.css', '/_/']:
            self.assertEqual(self.call(path)[0], 200)

    def test_03_no_self_registration(self):
        self.assertEqual(self.call('/api/collections/members/records', 'POST',
            {'username': 'intruder', 'password': self.password, 'passwordConfirm': self.password})[0], 403)
        self.assertEqual(self.call('/api/collections/users/records', 'POST',
            {'email': 'intruder@example.test', 'password': self.password, 'passwordConfirm': self.password})[0], 403)

    def test_04_invalid_login(self):
        self.assertEqual(self.login('alice', 'wrong-password')[0], 400)
        self.assertEqual(self.login('nonexistent')[0], 400)
        self.assertIn(self.login('disabled')[0], [400, 403])

    def test_05_login_and_profile(self):
        status, headers, body = self.login()
        self.assertEqual(status, 200, body)
        self.assertIn('HttpOnly', headers['Set-Cookie'])
        self.assertIn('SameSite=Lax', headers['Set-Cookie'])
        self.assertIn('Max-Age=28800', headers['Set-Cookie'])
        cookie = headers['Set-Cookie'].split(';')[0]
        self.assertEqual(json.loads(self.call('/api/tracker/me', cookie=cookie)[2])['id'], self.members['alice'])
        for path in ['/', '/models/', '/api/index.json', '/auth/session.js']:
            result = self.call(path, cookie=cookie)
            self.assertEqual(result[0], 200, (path, result[2][:100]))
            self.assertIn('no-store', result[1]['Cache-Control'])

    def test_06_cannot_manage_or_read_others(self):
        cookie, token = self.session()
        self.assertEqual(self.call('/api/collections/members/records', token=token)[0], 403)
        self.assertEqual(self.call('/api/collections/members/records/' + self.members['bob'], token=token)[0], 404)
        self.assertEqual(self.call('/api/collections/members/records/' + self.members['alice'], 'PATCH',
                                  {'disabled': False}, cookie=cookie)[0], 403)
        self.assertIn(self.call('/api/settings', cookie=cookie)[0], [401, 403])
        self.assertEqual(self.call('/api/collections/members/records', 'POST',
            {'username': 'newmember', 'password': self.password, 'passwordConfirm': self.password}, cookie=cookie)[0], 403)

    def test_07_disabled_existing_session(self):
        cookie, token = self.session('bob')
        self.assertEqual(self.call('/api/collections/members/records/' + self.members['bob'], 'PATCH',
                                  {'disabled': True}, token=self.admin)[0], 200)
        self.assertEqual(self.call('/', cookie=cookie)[0], 401)
        self.assertEqual(self.call('/api/tracker/me', token=token)[0], 401)

    def test_08_logout_revokes_token(self):
        cookie, token = self.session('logoutuser')
        status, headers, body = self.call('/api/tracker/logout', 'POST', cookie=cookie)
        self.assertEqual(status, 204, body)
        self.assertIn('Max-Age=0', headers['Set-Cookie'])
        self.assertEqual(self.call('/', cookie=cookie)[0], 401)
        self.assertEqual(self.call('/api/tracker/me', token=token)[0], 401)

    def test_09_reset_revokes_old_session(self):
        cookie, token = self.session('resetuser')
        new_password = secrets.token_urlsafe(24)
        status, _, body = self.call('/api/collections/members/records/' + self.members['resetuser'], 'PATCH',
            {'password': new_password, 'passwordConfirm': new_password}, token=self.admin)
        self.assertEqual(status, 200, body)
        self.assertEqual(self.call('/', cookie=cookie)[0], 401)
        self.assertEqual(self.login('resetuser', new_password)[0], 200)

    def test_10_csrf_and_forged_token(self):
        cookie, _ = self.session()
        self.assertEqual(self.call('/api/tracker/logout', 'POST', cookie=cookie,
                                  headers={'Origin': 'https://evil.example'})[0], 403)
        self.assertEqual(self.call('/api/tracker/logout', 'POST', cookie=cookie, headers={'Origin': ''})[0], 403)
        self.assertEqual(self.call('/', cookie='tracker_session=forged')[0], 401)

    def test_11_sensitive_files_not_served(self):
        cookie, _ = self.session()
        for path in ['/.git/config', '/auth/pb_data/data.db', '/auth/local-accounts.txt',
                     '/auth/pb_hooks/main.pb.js', '/worker/index.js', '/scripts/fetch_papers.py', '/README.md']:
            self.assertEqual(self.call(path, cookie=cookie)[0], 404, path)

    def test_12_users_have_different_storage_identity(self):
        alice, _ = self.session()
        other, _ = self.session('logoutuser')
        alice_profile = json.loads(self.call('/api/tracker/me', cookie=alice)[2])
        other_profile = json.loads(self.call('/api/tracker/me', cookie=other)[2])
        self.assertNotEqual(alice_profile['id'], other_profile['id'])
        self.assertIn(alice_profile['id'].encode(), self.call('/auth/session.js', cookie=alice)[2])
        self.assertNotIn(alice_profile['id'].encode(), self.call('/auth/session.js', cookie=other)[2])
        status, _, body = self.call('/api/collections/members/records/' + self.members['alice'], token=self.admin)
        self.assertEqual(status, 200)
        self.assertNotIn(b'"password"', body)

    def test_99_rate_limit(self):
        self.assertEqual(self.call('/api/settings', 'PATCH', {'rateLimits': self.rate_limits}, token=self.admin)[0], 200)
        cookie, _ = self.session()
        for _ in range(310):
            self.assertEqual(self.call('/api/papers/page-001.json', cookie=cookie)[0], 200)
        statuses = [self.login('rateuser', 'bad-password')[0] for _ in range(30)]
        self.assertIn(429, statuses)

if __name__ == '__main__':
    unittest.main(verbosity=2)
