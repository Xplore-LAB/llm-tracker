#!/usr/bin/env python3
"""Download a pinned official release and verify its SHA256 before extracting."""
from pathlib import Path
import hashlib
import io
import platform
import tempfile
import urllib.request
import zipfile

VERSION = '0.40.4'
ROOT = Path(__file__).resolve().parent

def install():
    system = {'Darwin': 'darwin', 'Linux': 'linux', 'Windows': 'windows'}[platform.system()]
    arch = {'arm64': 'arm64', 'aarch64': 'arm64', 'x86_64': 'amd64', 'AMD64': 'amd64'}[platform.machine()]
    name = f'pocketbase_{VERSION}_{system}_{arch}.zip'
    base = f'https://github.com/pocketbase/pocketbase/releases/download/v{VERSION}/'
    checksums = urllib.request.urlopen(base + 'checksums.txt', timeout=60).read().decode()
    expected = next(line.split()[0] for line in checksums.splitlines() if line.split()[-1].lstrip('*') == name)
    archive = urllib.request.urlopen(base + name, timeout=120).read()
    if hashlib.sha256(archive).hexdigest() != expected:
        raise RuntimeError('PocketBase checksum mismatch')
    executable = 'pocketbase.exe' if system == 'windows' else 'pocketbase'
    target = ROOT / 'bin' / executable
    target.parent.mkdir(exist_ok=True)
    with zipfile.ZipFile(io.BytesIO(archive)) as bundle:
        binary = bundle.read(executable)
    with tempfile.NamedTemporaryFile(dir=target.parent, delete=False) as file:
        staged = Path(file.name)
        file.write(binary)
    staged.chmod(0o755)
    staged.replace(target)
    print(f'Installed and verified PocketBase {VERSION}: {target}')

if __name__ == '__main__':
    install()
