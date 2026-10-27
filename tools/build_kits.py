#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Persist a default complete-file manifest for every size/variant."""
from pathlib import Path
import csv,io,json,sys,os
BASE=Path(__file__).resolve().parents[1];sys.path.insert(0,str(BASE))
import kit_service as k
entries=[];out=io.StringIO();w=csv.writer(out)
w.writerow(['尺寸代号','类型','款式','模块ID','中文部件','原始STL文件','原始路径','打印份数','用途','材料槽','参考颜色'])
for m in k.CAT['modules']:
 spec=k.specification({'model':m['id']});parts=k.recipe(spec);plates=k.arrange(parts)
 folder=k.organised_folder(spec);folder.mkdir(parents=True,exist_ok=True)
 folder_rows=io.StringIO();fw=csv.writer(folder_rows);fw.writerow(['中文部件','打印份数','用途','颜色','源文件路径'])
 for part in parts:
  link=folder/(part['name']+'__print-'+str(part['qty'])+'.stl')
  for obsolete in folder.glob(part['name']+'__print-*.stl'):
   if obsolete!=link and obsolete.is_symlink() and obsolete.resolve()==(k.LIB/part['path']).resolve():obsolete.unlink()
  if not link.exists() and not link.is_symlink():link.symlink_to(os.path.relpath(k.LIB/part['path'],folder))
  fw.writerow([part['name'],part['qty'],part['role'],part['colour'],part['path']])
 (folder/'打印清单.csv').write_bytes(folder_rows.getvalue().encode('utf-8-sig'))
 (folder/'配方与配色.json').write_text(json.dumps({'module':m['id'],'specification':spec,'parts':parts,'hardware':m['hardware']},ensure_ascii=False,indent=2))
 target=k.ROOT/'cache'/(k.cache_key(spec,parts)+'.3mf')
 default_link=folder/k.filename(spec)
 if default_link.is_symlink() and default_link.resolve().parent==(k.ROOT/'cache').resolve() and default_link.resolve()!=target.resolve():default_link.unlink()
 if target.exists():k.link_default_project(spec,target)
 entry={'code':k.code(m),'id':m['id'],'kind':m['kind'],'subtitle':m['subtitle'],'specification':spec,'parts':parts,'copies':sum(p['qty'] for p in parts),'plates':len(plates),'filename':k.filename(spec)};entries.append(entry)
 for p in parts:w.writerow([entry['code'],'抽屉柜' if m['kind']=='drawer' else '翻盖箱',m['subtitle'],m['id'],p['name'],Path(p['path']).name,p['path'],p['qty'],p['role'],[s['id'] for s in k.PALETTE['slots']].index(p['slot'])+1,p['colour']])
(BASE/'dist/kits-index.json').write_text(json.dumps({'version':1,'palette':k.PALETTE,'kits':entries},ensure_ascii=False,separators=(',',':')))
(BASE/'dist/全部箱子文件索引.csv').write_bytes(out.getvalue().encode('utf-8-sig'))
print('Indexed',len(entries),'complete kits;',len(out.getvalue().splitlines())-1,'part rows')
