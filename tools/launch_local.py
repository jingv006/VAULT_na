#!/usr/bin/env python3
"""Start or reuse this VAULT checkout and open its workbench on macOS."""
import fcntl
import json
import socket
import subprocess
import sys
import time
import urllib.request
import webbrowser
from pathlib import Path

BASE = Path(__file__).resolve().parents[1]
RUNTIME = BASE / 'tmp' / 'launcher'
OPENER = urllib.request.build_opener(urllib.request.ProxyHandler({}))


def is_vault(port):
    try:
        with OPENER.open(f'http://127.0.0.1:{port}/api/status', timeout=1) as response:
            status = json.load(response)
        with OPENER.open(f'http://127.0.0.1:{port}/workbench.html', timeout=1) as response:
            page = response.read().decode('utf-8')
        return (status.get('local') is True and status.get('libraryName') == '261021_VAULT_USSA_S'
                and 'VAULT · 收纳工作台' in page)
    except (OSError, ValueError):
        return False


def available(port):
    with socket.socket() as sock:
        try:
            sock.bind(('127.0.0.1', port))
            return True
        except OSError:
            return False


def main():
    RUNTIME.mkdir(parents=True, exist_ok=True)
    with (RUNTIME / 'startup.lock').open('w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        ports = list(range(8766, 8776)) + [8765]
        port = next((p for p in ports if is_vault(p)), None)
        if port is None:
            for candidate in ports:
                if not available(candidate):
                    continue
                with (RUNTIME / 'server.log').open('ab') as log:
                    process = subprocess.Popen(
                        [sys.executable, '-u', str(BASE / 'server.py'), '--port', str(candidate)],
                        cwd=BASE, stdin=subprocess.DEVNULL, stdout=log, stderr=subprocess.STDOUT,
                        start_new_session=True,
                    )
                for _ in range(60):
                    if process.poll() is not None:
                        break
                    if is_vault(candidate):
                        port = candidate
                        break
                    time.sleep(0.25)
                if port is not None:
                    break
                if process.poll() is None:
                    process.terminate()
            if port is None:
                raise RuntimeError(f'服务未能启动，请查看日志：{RUNTIME / "server.log"}')
        url = f'http://127.0.0.1:{port}/workbench.html'
        print(f'VAULT 工作台已就绪：{url}')
        print('服务在后台运行，可以关闭此终端窗口；再次双击入口即可打开。')
        if not webbrowser.open(url):
            print('请在浏览器中打开上面的地址。')


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(f'无法打开 VAULT：{error}', file=sys.stderr)
        input('按回车关闭窗口…')
        sys.exit(1)
