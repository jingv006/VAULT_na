"""Measure all drawer-facade counterbores for assembly and print quantities."""
import json,re,sys,subprocess
from pathlib import Path
BASE=Path(__file__).resolve().parents[1];sys.path.insert(0,str(BASE))
import preview_service as preview
parts={}
for m in preview.kits.CAT['modules']:
 if m['kind']!='drawer':continue
 for p in m['parts']:
  if p['role']=='面板':parts[p['path']]=p
plan={'output':str(preview.ASSETS),'progress':str(BASE/'tmp/alignment/facades-progress.json'),'parts':[]}
for p in parts.values():
 ident,source=preview.asset_info(p);family=re.match('(XL|S|M|L)',source.name)[1]
 plan['parts'].append({'id':ident,'path':p['path'],'source':str(source),'name':source.name,'role':'面板','width':{'S':164.8,'M':254,'L':329.6,'XL':418.8}[family]})
request=BASE/'tmp/alignment/facades-plan.json';request.write_text(json.dumps(plan))
subprocess.run(['/usr/bin/python3',str(BASE/'tools/build_preview_assets.py'),str(request)],check=True)
records={}
for p in plan['parts']:
 a=json.loads((preview.ASSETS/(p['id']+'.json')).read_text());holes=a['landmarks']['holes'];assert len(holes)>=2,p
 records[p['path']]={'holes':holes,'capQuantity':len(holes)-1,'asset':a['url'],'sourceBytes':a['sourceBytes'],'sourceMtimeNs':a['sourceMtimeNs']}
 print(p['name'],len(holes),'round holes ->',len(holes)-1,'caps',flush=True)
(BASE/'tools/facade-datums.json').write_text(json.dumps(records,ensure_ascii=False,indent=2))
