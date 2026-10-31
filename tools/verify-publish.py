#!/usr/bin/env python3
"""Exercise real commits/push retries against a temporary local bare repository."""
import json
from datetime import datetime, timedelta
from pathlib import Path
import subprocess
import tempfile
from unittest.mock import patch
import publish_github as release
from versioning import next_version, set_version

assert next_version(None) == '1.0'
assert next_version('1.9') == '1.10'

with tempfile.TemporaryDirectory(prefix='vault-release-') as folder:
    root = Path(folder)
    remote, work = root / 'remote.git', root / 'work'
    subprocess.run(['git', 'init', '--bare', '-q', str(remote)], check=True)
    work.mkdir()

    def real_git(*args, check=True):
        return subprocess.run(['git', *args], cwd=work, text=True, capture_output=True, check=check)

    real_git('init', '-q', '-b', 'main')
    real_git('config', 'user.name', 'VAULT Release Test')
    real_git('config', 'user.email', 'release-test@example.invalid')
    real_git('remote', 'add', 'origin', str(remote))
    def readme(title):
        (work / 'README.md').write_text(title + '\n<!-- release-status:start --><!-- release-status:end -->\n<!-- release-history:start --><!-- release-history:end -->\n')

    readme('Initial backup')
    real_git('add', '-A')
    real_git('commit', '-qm', 'Initial backup')
    real_git('push', '-u', 'origin', 'main')
    (work / 'dist').mkdir()
    for name in ('index.html', 'workbench.html', 'dividers.html'):
        (work / 'dist' / name).write_text('<span class="site-version">V1.0</span>')
    (work / 'VERSION.json').write_text('{"version":"1.0"}\n')
    fail_push = False

    def test_git(*args, check=True):
        global fail_push
        if args == ('remote', 'get-url', 'origin'):
            return subprocess.CompletedProcess(args, 0, 'git@github.com:jingv006/VAULT_na.git\n', '')
        if args[0] == 'push' and fail_push:
            fail_push = False
            raise subprocess.CalledProcessError(1, args, stderr='Simulated push failure')
        return real_git(*args, check=check)

    def published():
        return json.loads(real_git('show', 'origin/main:VERSION.json').stdout)['version']

    with patch.object(release, 'git', test_git), patch.object(release, 'set_version', lambda v, **kwargs: set_version(v, work, **kwargs)):
        release.publish('First release')
        assert published() == '1.0'
        for name in ('index.html', 'workbench.html', 'dividers.html'):
            assert '>V1.0<' in (work / 'dist' / name).read_text()
        first = json.loads((work / 'VERSION.json').read_text())
        assert datetime.fromisoformat(first['released_at']).utcoffset() == timedelta(hours=8)
        assert first['released_at'] in (work / 'RELEASES.json').read_text()
        assert '**当前版本：V1.0**' in (work / 'README.md').read_text()
        assert 'First release' in (work / 'CHANGELOG.md').read_text()
        readme('Second release')
        release.publish()
        assert published() == '1.1'
        assert '更新项目首页与使用说明' in (work / 'CHANGELOG.md').read_text()
        readme('Third release')
        fail_push = True
        try:
            release.publish()
            raise AssertionError('Push failure was not propagated')
        except subprocess.CalledProcessError:
            pass
        assert published() == '1.1'
        pending_head = real_git('rev-parse', 'HEAD').stdout
        pending_version = (work / 'VERSION.json').read_text()
        pending_history = (work / 'RELEASES.json').read_text()
        release.publish()
        assert published() == '1.2'
        assert real_git('rev-parse', 'HEAD').stdout == pending_head
        assert (work / 'VERSION.json').read_text() == pending_version
        assert (work / 'RELEASES.json').read_text() == pending_history
        records = json.loads(pending_history)['releases']
        assert [r['version'] for r in records] == ['1.2', '1.1', '1.0']
        assert 'V1.2' in (work / 'README.md').read_text()
        release.publish()
        assert published() == '1.2'
        assert real_git('rev-parse', 'HEAD').stdout == pending_head
        assert (work / 'VERSION.json').read_text() == pending_version
        assert (work / 'RELEASES.json').read_text() == pending_history
        records = json.loads(pending_history)['releases']
        assert [r['version'] for r in records] == ['1.2', '1.1', '1.0']
        assert 'V1.2' in (work / 'README.md').read_text()
print('Passed: V1.0 first release; automatic increment; failed-push retry; unchanged upload; synchronized pages/README/changelog; timestamp retention and unique history.')
