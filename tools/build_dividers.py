import json,re,shutil
from pathlib import Path
base=Path(__file__).resolve().parents[1]
c=json.loads((base/'dist/catalog.json').read_text());g=json.loads((base/'dist/geometry.json').read_text())['records']
parts=[]
for f in c['files']:
 p=f['path']
 if '/Grid Dividers/' not in p or not p.lower().endswith('.stl'):continue
 name=p.split('/')[-1];height=20 if '/20MM TALL/' in p else 34.5 if '/34.5MM' in p else 82.5 if '/82.5MM' in p else None
 number=re.match(r'^(\d+)',name)
 role='divider' if number else 'rounded' if 'Rounded' in name else 'straight' if 'Straight' in name else 'tight' if 'tight' in name else 'loose'
 parts.append(dict(path=p,bytes=f['bytes'],height=height,number=int(number[1]) if number else None,role=role,size=g[p]['size']))
(base/'dist/dividers-data.json').write_text(json.dumps({'pitch':10.5,'widthNumbers':{'S':10,'M':18,'L':26,'XL':32},'depthNumbers':{'3':10,'4':14,'5':18,'6':22,'7':26},'parts':parts},ensure_ascii=False,indent=2)+'\n')
folder=base/'dist/references/dividers';folder.mkdir(exist_ok=True)
shutil.copyfile(base.parent/'261021_VAULT_USSA_S/01. DRAWERS/07. Universal/Grid Dividers/01. INSTRUCTIONS/01. instructions.jpg',folder/'instructions.jpg')
print(len(parts),'official divider files indexed')
