"""Single version source and synchronized header badges for all pages."""
import json
import re
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

BASE = Path(__file__).resolve().parents[1]


def next_version(published):
    if published is None:
        return '1.0'
    if not re.fullmatch(r'\d+\.\d+', published):
        raise ValueError('版本号必须采用 主版本.次版本 格式')
    major, minor = map(int, published.split('.'))
    return f'{major}.{minor + 1}'


def describe_changes(paths):
    areas = []
    rules = [
        ('项目首页与使用说明', lambda p: p == 'README.md' or p.startswith('docs/')),
        ('隔板排布', lambda p: 'divider' in p),
        ('三维装配与尺寸展示', lambda p: 'assembly' in p or 'stack-' in p or 'measurement' in p),
        ('模型打包', lambda p: 'export' in p or 'kit_service' in p),
        ('工作台交互', lambda p: p in ('dist/app.mjs', 'dist/core.mjs', 'dist/workbench.html')),
        ('版本发布流程', lambda p: p.startswith('tools/') and any(s in p for s in ('publish', 'version'))),
    ]
    for label, matches in rules:
        if any(matches(p) for p in paths):
            areas.append(label)
    return '更新' + '、'.join(areas) if areas else '项目更新'


def _display_time(stamp):
    return datetime.fromisoformat(stamp).astimezone(ZoneInfo('Asia/Shanghai')).strftime('%Y-%m-%d %H:%M:%S')


def _replace_section(text, name, content):
    pattern = rf'(<!-- {name}:start -->).*?(<!-- {name}:end -->)'
    return re.sub(pattern, lambda m: m[1] + '\n' + content + '\n' + m[2], text, flags=re.S)


def set_version(version, base=BASE, summary=None):
    if not re.fullmatch(r'\d+\.\d+', version):
        raise ValueError('版本号必须采用 主版本.次版本 格式')
    updates = []
    for name in ('index.html', 'workbench.html', 'dividers.html'):
        path = base / 'dist' / name
        if name == 'dividers.html' and not path.exists():
            continue
        text, count = re.subn(
            r'(<span class="site-version"[^>]*>)V\d+\.\d+(</span>)',
            lambda match: match[1] + 'V' + version + match[2],
            path.read_text(),
        )
        if count != 1:
            raise ValueError(f'{name} 的版本标记缺失或重复')
        updates.append((path, text))
    release_file = base / 'RELEASES.json'
    history = json.loads(release_file.read_text()) if release_file.exists() else {'timezone': 'Asia/Shanghai', 'releases': []}
    records = history['releases']
    entry = next((r for r in records if r['version'] == version), None)
    if entry is None:
        entry = {'version': version, 'released_at': datetime.now(ZoneInfo('Asia/Shanghai')).isoformat(timespec='seconds'),
                 'summary': summary or '项目更新', 'changes': [summary or '项目更新'], 'timestamp_source': 'publish-script'}
        records.append(entry)
    elif summary is not None and entry['summary'] != summary:
        entry.update(summary=summary, changes=[summary])
    records.sort(key=lambda r: tuple(map(int, r['version'].split('.'))), reverse=True)
    history['timezone'] = 'Asia/Shanghai'
    readme = base / 'README.md'
    if readme.exists():
        text = _replace_section(readme.read_text(), 'release-status',
            f"**当前版本：V{version}** · **更新时间：{_display_time(entry['released_at'])}（北京时间）**")
        lines = ['| 版本 | 发布时间（北京时间） | 更新内容 |', '| --- | --- | --- |']
        for r in records[:3]:
            short = r['summary'].replace('|', '\\|').replace('\n', ' ')
            lines.append(f"| V{r['version']} | {_display_time(r['released_at'])} | {short} |")
        lines.append('\n[查看全部版本记录 →](CHANGELOG.md)')
        updates.append((readme, _replace_section(text, 'release-history', '\n'.join(lines))))
    changelog = ['# 版本记录', '', '时间统一为北京时间（UTC+08:00）。V1.0 / V1.1 的历史时间按发布提交回填，后续版本由上传脚本自动记录。', '']
    for r in records:
        changelog += [f"## V{r['version']} · {_display_time(r['released_at'])}", '', r['summary'], '']
        changelog += ['- ' + note for note in r.get('changes', []) if note != r['summary']]
        if r.get('commit'):
            changelog += ['', f"[发布提交](https://github.com/jingv006/VAULT_na/commit/{r['commit']})"]
        changelog.append('')
    updates += [(base / 'CHANGELOG.md', '\n'.join(changelog).rstrip() + '\n'),
                (release_file, json.dumps(history, ensure_ascii=False, indent=2) + '\n'),
                (base / 'VERSION.json', json.dumps({'version': version, 'released_at': entry['released_at'],
                                                   'timezone': 'Asia/Shanghai'}, ensure_ascii=False, indent=2) + '\n')]
    for path, text in updates:
        path.write_text(text)
