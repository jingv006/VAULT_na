#!/usr/bin/env python3
"""Repair completed failures while the primary sweep continues; cache writes only."""
from pathlib import Path
import json,time
from batch_slice import RUN,BASE,prepare,slice_one,atomic_json
profile=prepare();cat=json.loads((BASE/'dist/catalog.json').read_text());files={f['path']:f for f in cat['files'] if f['path'].lower().endswith('.stl')}
attempted=set()
while True:
 candidates=[]
 for p in (RUN/'records').glob('*.json'):
  r=json.loads(p.read_text())
  if r.get('status')!='ok' and r.get('profileFingerprint')==profile['fingerprint'] and r['path'] not in attempted and time.time()-p.stat().st_mtime>4:candidates.append(r)
 for previous in candidates:
  path=previous['path'];attempted.add(path)
  print('RETRY '+path,flush=True)
  result=slice_one(files[path],profile,300,retry=True)
  print(json.dumps({'path':path,'status':result['status'],'grams':result.get('grams'),'seconds':result.get('seconds'),'estimateOnly':result.get('estimateOnly',False),'error':result.get('error','')[-150:]},ensure_ascii=False),flush=True)
  atomic_json(RUN/'repairs.json',{'attempted':len(attempted),'last':path,'lastStatus':result['status']})
 progress=json.loads((RUN/'progress.json').read_text())
 if progress.get('complete') and not candidates:break
 time.sleep(3)
print('REPAIRS DONE',len(attempted),flush=True)
