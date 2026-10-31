#!/usr/bin/env python3
"""Commit and push a numbered release; retrying a failed push keeps its version."""
import argparse
import json
import subprocess
import sys
from versioning import BASE, next_version, set_version, describe_changes


def git(*args, check=True):
    return subprocess.run(['git', *args], cwd=BASE, text=True, capture_output=True, check=check)


def publish(message=None):
    remote = git('remote', 'get-url', 'origin').stdout.strip().removesuffix('.git')
    if remote not in ('git@github.com:jingv006/VAULT_na', 'https://github.com/jingv006/VAULT_na'):
        raise RuntimeError('origin 不是 jingv006/VAULT_na，已停止上传。')
    if git('branch', '--show-current').stdout.strip() != 'main':
        raise RuntimeError('请在 main 分支执行上传，当前分支未改动。')
    print('正在检查 GitHub 最新版本…', flush=True)
    git('fetch', 'origin', 'main')
    if git('merge-base', '--is-ancestor', 'origin/main', 'HEAD', check=False).returncode:
        raise RuntimeError('GitHub 有本地尚未包含的提交，请先合并远程改动。')
    pending = git('status', '--porcelain').stdout.strip()
    ahead = int(git('rev-list', '--count', 'origin/main..HEAD').stdout)
    if not pending and not ahead:
        print('没有待上传的改动，版本号保持不变。')
        return
    previous = git('show', 'origin/main:VERSION.json', check=False)
    published = json.loads(previous.stdout)['version'] if previous.returncode == 0 else None
    version = next_version(published)
    if not message and pending:
        paths = git('diff', '--name-only', '-z', 'origin/main').stdout.split('\0')
        paths += git('ls-files', '--others', '--exclude-standard', '-z').stdout.split('\0')
        message = describe_changes(paths)
    set_version(version, summary=message)
    git('add', '-A')
    if git('diff', '--cached', '--quiet', check=False).returncode:
        git('commit', '-m', f'Release V{version}' + (f': {message}' if message else ''))
    print(f'正在上传 V{version}…', flush=True)
    result = git('push', 'origin', 'HEAD:main')
    print(result.stdout + result.stderr)
    print(f'已上传 V{version}：https://github.com/jingv006/VAULT_na', flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--message', help='本次更新说明')
    args = parser.parse_args()
    try:
        publish(args.message)
    except (OSError, ValueError, RuntimeError, subprocess.CalledProcessError) as error:
        print(getattr(error, 'stderr', '') or str(error), file=sys.stderr)
        print('上传未完成；修复问题后再次运行，不会跳过版本号。', file=sys.stderr)
        sys.exit(1)
