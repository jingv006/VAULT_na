# -*- coding: utf-8 -*-
"""Check JS/Python parity and actual ZIP containing one complete print-3 project."""
from pathlib import Path
from unittest.mock import patch
import io,json,sys,tempfile,zipfile,xml.etree.ElementTree as E
BASE=Path(__file__).resolve().parents[1];sys.path.insert(0,str(BASE))
import server as s
import workbench_export as w
fixtures=json.loads((BASE/'tmp/module-export-fixtures.json').read_text())
for payload in fixtures:
    groups,extras=w.validate(payload)
    assert sum(g['qty'] for g in groups)==len(payload['plan']['items'])
bad=json.loads(json.dumps(fixtures[0]));bad['parts'][0]['qty']-=1
try:w.validate(bad)
except ValueError:pass
else:raise AssertionError('Mismatched quantities accepted')
names=[w.filename(g['spec'],g['qty']) for g in w.validate(fixtures[2])[0]]
assert len(names)==len(set(names)),'different accessories need different filenames'
with tempfile.TemporaryDirectory(prefix='vault-module-export-') as folder:
    with patch.object(s,'EXPORT',Path(folder)):
        payload=fixtures[0];s.JOBS['kits-test']={};s.run_export('kits-test',payload)
        assert s.JOBS['kits-test']['status']=='done',s.JOBS['kits-test']
        with zipfile.ZipFile(Path(folder)/'kits-test.zip') as z:
            assert z.testzip() is None
            projects=[n for n in z.namelist() if n.endswith('.3mf')]
            assert len(projects)==1 and projects[0].endswith('__print-3.3mf'),projects
            assert not any(n.endswith('.stl') for n in z.namelist()),'module STL must not be duplicated'
            entries=json.loads(z.read('模块工程.json'));assert entries[0]['qty']==3
            with zipfile.ZipFile(io.BytesIO(z.read(projects[0]))) as project:
                assert project.testzip() is None
                manifest=json.loads(project.read('Metadata/vault_manifest.json'))
                expected=sum(p['qty'] for p in w.kits.recipe(w.kits.specification(payload['kitGroups'][0]['spec'])))
                assert sum(len(p['objects']) for p in manifest['plates'])==expected,'project contains one set, not three'
                settings=json.loads(project.read('Metadata/project_settings.config'))
                assert settings['filament_colour']==list(payload['kitGroups'][0]['spec']['colours'].values())
                assert settings['wall_loops']=='2' and settings['sparse_infill_density']=='15%'
                E.fromstring(project.read('Metadata/model_settings.config'))
            assert any(n.startswith('装配说明/') for n in z.namelist())
        # The first option still keeps one original STL named print-N, byte-for-byte.
        row=next(f for f in s.CAT['files'] if f['path'].endswith('/Runner Stopper.stl'))
        s.JOBS['unique-test']={};s.run_export('unique-test',{'parts':[{'path':row['path'],'qty':4}], 'plan':{'version':1}})
        assert s.JOBS['unique-test']['status']=='done'
        with zipfile.ZipFile(Path(folder)/'unique-test.zip') as z:
            stls=[n for n in z.namelist() if n.endswith('.stl')]
            assert len(stls)==1 and stls[0].endswith('__print-4.stl')
            assert z.read(stls[0])==s.secure_file(row['path']).read_bytes()
print('Module ZIP export passed: JS/Python recipe parity, one real print-3 3MF, single-set objects, colours/profile, PDFs, and unchanged unique STL mode')
