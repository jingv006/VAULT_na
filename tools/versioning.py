"""Single version source and synchronized header badges for all pages."""
import json
import re
from pathlib import Path

BASE = Path(__file__).resolve().parents[1]


def next_version(published):
    if published is None:
        return '1.0'
    if not re.fullmatch(r'\d+\.\d+', published):
        raise ValueError('版本号必须采用 主版本.次版本 格式')
    major, minor = map(int, published.split('.'))
    return f'{major}.{minor + 1}'


def set_version(version, base=BASE):
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
    for path, text in updates:
        path.write_text(text)
    (base / 'VERSION.json').write_text(json.dumps({'version': version}, indent=2) + '\n')
