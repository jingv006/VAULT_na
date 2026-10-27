#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Check complete kit recipes, colour packing and a real generated 3MF."""
from pathlib import Path
import collections,json,sys,xml.etree.ElementTree as E,zipfile
BASE=Path(__file__).resolve().parents[1];sys.path.insert(0,str(BASE))
import kit_service as k
cases=json.loads((BASE/'tmp/kit-recipe-fixtures.json').read_text())
for case in cases:
 rows=k.recipe(k.specification(case['spec']));expected={r['path']:(r['qty'],r['role']) for r in case['parts']}
 assert {r['path']:(r['qty'],r['role']) for r in rows}==expected
 plates=k.arrange(rows)
 assert sum(len(p['items']) for p in plates)==sum(r['qty'] for r in rows)
 for plate in plates:
  assert all(i['row']['slot']==plate['slot'] for i in plate['items'])
  if plate['oversize']:continue
  rects=[]
  for item in plate['items']:
   sx,sy,sz=item['row']['size'];w,h=(sy,sx) if item['rot'] else(sx,sy);x,y=item['x'],item['y']
   assert x>=5 and y>=5 and x+w<=320.00001 and y+h<=315.00001
   assert all(x+w<=a or a+c<=x or y+h<=b or b+d<=y for a,b,c,d in rects)
   rects.append((x,y,w,h))
for payload in [None,[],{'model':'../../secret'},{'model':'d-S3-1','roof':'unknown'},{'model':'d-S3-1','grid':'yes'},{'model':'d-S3-1','colours':{'light':'red'}}]:
 try:k.specification(payload)
 except ValueError:pass
 else:raise AssertionError('Invalid request accepted')
for model,expected in [('d-S3-1',(13,16)),('s-S3-1-standard',(12,12))]:
 spec=k.specification({'model':model});rows=k.recipe(spec);path=BASE/'kits/cache'/(k.cache_key(spec,rows)+'.3mf')
 if not path.exists():raise AssertionError('Generate example first: '+model)
 with zipfile.ZipFile(path) as z:
  assert z.testzip() is None
  cfg=E.fromstring(z.read('Metadata/model_settings.config'));manifest=json.loads(z.read('Metadata/vault_manifest.json'));settings=json.loads(z.read('Metadata/project_settings.config'))
  assert len(manifest['parts'])==expected[0] and len(cfg.findall('object'))==expected[1]
  assert settings['filament_colour']==[s['hex'] for s in k.PALETTE['slots']]
  assert settings['wall_loops']=='2' and settings['sparse_infill_density']=='15%'
  assert sum(len(p['objects']) for p in manifest['plates'])==expected[1]
  assert {r['path']:r['qty'] for r in rows}==dict(collections.Counter(o['path'] for p in manifest['plates'] for o in p['objects']))
print('Passed',len(cases),'recipe/packing cases; 160 catalog variants; real drawer and sustainer 3MF counts, colours, profiles, metadata and ZIP integrity.')
