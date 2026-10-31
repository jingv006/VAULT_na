"""Gather already measured original mesh metadata, without exporting mesh content."""
import json,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import preview_service as p
base=p.BASE
records=[]
for m in p.kits.MODULES.values():
 choices=list(m.get('roofs',{}))+['none'] if m['kind']=='drawer' else ['Whole','Split'] if m['depth']>=6 else ['Whole']
 for roof in choices:
  for detail in ['full','exterior']:
   try:spec,rows=p.preview_recipe({'model':m['id'],'roof':roof,'detail':detail})
   except (ValueError,KeyError):continue
   parts=[]
   for r in rows:
    file=p.ASSETS/(p.asset_info(r)[0]+'.json')
    if not file.exists():break
    a=json.loads(file.read_text())
    parts.append({**r,'asset':{k:a[k] for k in ['size','components','landmarks'] if k in a}})
   else:
    records.append({'model':m,'roof':spec['roof'],'parts':parts})
    break
Path('/tmp/vault-dimension-metadata.json').write_text(json.dumps(records,ensure_ascii=False))
print(len(records),'available model/roof combinations')
