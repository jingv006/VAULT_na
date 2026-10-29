"""Exterior preview recipes must never schedule internal display meshes."""
import json,sys,time
from pathlib import Path
BASE=Path(__file__).resolve().parents[1];sys.path.insert(0,str(BASE))
import preview_service as preview
import kit_service as kits
excluded={'抽屉盒','抽屉盒分件','抽屉背板','导轨','滑轨','双抽屉中间连接件','弹簧套件','加强齿条套件','网格收纳底板','网格收纳底板分件','密封隔板','密封侧隔板','密封中隔板','翻盖连接件'}
cases=0
for m in kits.CAT['modules']:
 roofs=['none',*m['roofs']] if m['kind']=='drawer' else list(m['lidRoofs'])
 for roof in roofs:
  full,original=preview.preview_recipe({'model':m['id'],'roof':roof,'grid':True,'rails':True})
  exterior,rows=preview.preview_recipe({'model':m['id'],'roof':roof,'grid':True,'rails':True,'detail':'exterior'})
  assert exterior['detail']=='exterior' and not exterior['grid'] and not exterior['rails']
  assert rows and not any(p['role'] in excluded for p in rows)
  assert all(p['role'] in preview.EXTERIOR_ROLES for p in rows)
  assert any(p['role'] in ['柜体','箱体'] for p in rows)
  assert full['detail']=='full' and original==kits.recipe(full),'full kit/preview recipes unchanged'
  if m['kind']=='drawer':assert any(p['role']=='抽屉盒' or p['role']=='抽屉盒分件' for p in original)
  else:assert all(any(p['role']==role for p in rows) for role in ['下铰链套件','锁扣座','锁扣内件','锁扣外件'])
  cases+=1
try:preview.preview_recipe({'model':'d-S3-1','detail':'invalid'});raise AssertionError('invalid detail accepted')
except ValueError:pass
# Run the real request scheduler with an asset reader that refuses internal parts.
original_info=preview.asset_info
calls=[]
def guarded(part):
 assert part['role'] not in excluded,'internal asset scheduled'
 calls.append(part['role']);return original_info(part)
preview.asset_info=guarded
for model in ['d-S3-1','s-S6-2-standard']:
 j=preview.request({'model':model,'detail':'exterior','grid':True,'rails':True})
 deadline=time.monotonic()+90
 while j['status'] not in ['done','error'] and time.monotonic()<deadline:
  time.sleep(.1);j=preview.public(preview.JOBS[j['id']])
 assert j['status']=='done',j
 assert j['data']['detail']=='exterior'
 assert all(p['role'] in preview.EXTERIOR_ROLES for p in j['data']['parts'])
preview.asset_info=original_info
print('%d recipe/style cases plus real drawer/flip scheduler: exterior filtering before asset access, no internals, full view preserved passed'%cases)
