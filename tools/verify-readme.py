# -*- coding: utf-8 -*-
"""Check the concise GitHub landing page, local assets and release records."""
from pathlib import Path
from datetime import datetime, timedelta
import json, re
BASE=Path(__file__).resolve().parents[1]
text=(BASE/'README.md').read_text()
assert len(text.splitlines())<=100, 'Keep the project landing page concise'
for section in ('核心功能','功能展示','开始使用','版本迭代'):
    assert '## '+section in text
for marker in ('release-status','release-history'):
    assert text.count('<!-- '+marker+':start -->')==1
    assert text.count('<!-- '+marker+':end -->')==1
paths=re.findall(r'\]\(([^)]+)\)|src="([^"]+)"',text)
for a,b in paths:
    target=a or b
    if '://' not in target and not target.startswith('#'):
        assert (BASE/target).is_file(),target
version=json.loads((BASE/'VERSION.json').read_text())
records=json.loads((BASE/'RELEASES.json').read_text())['releases']
assert len({r['version'] for r in records})==len(records)
assert records[0]['version']==version['version']
assert records[0]['released_at']==version['released_at']
assert '**当前版本：V'+version['version']+'**' in text
for record in records:
    assert datetime.fromisoformat(record['released_at']).utcoffset()==timedelta(hours=8)
    assert '## V'+record['version']+' · ' in (BASE/'CHANGELOG.md').read_text()
print('GitHub landing page passed: concise sections, feature screenshots/links, release history and UTC+08 timestamps')
