"""Index the real model library and assemble file-level recipes. No mesh copies."""
from pathlib import Path
import json,re,sys
ROOT=Path(__file__).resolve().parents[2]
LIB=ROOT/'261021_VAULT_USSA_S'
OUT=ROOT/'vault-workbench/dist/catalog.json'
files=[]
for p in sorted(LIB.rglob('*')):
 if p.suffix.lower() in ['.stl','.pdf','.png','.jpg','.txt']:
  files.append({'path':p.relative_to(LIB).as_posix(),'name':p.name,'bytes':p.stat().st_size})
def norm(s): return re.sub(r'\s+',' ',s.strip().lower()).replace(' .stl','.stl')
def find(name,area=None,contains=None):
 a=[f for f in files if norm(f['name'])==norm(name) and (not area or f['path'].startswith(area)) and (not contains or contains in f['path'])]
 if len(a)!=1: raise ValueError((name,area,contains,len(a)))
 return a[0]['path']
D='01. DRAWERS';S='02. SUSTAINERS';U=D+'/07. Universal';SU=S+'/05. Universal'
mods=[]
FACADE_DATUMS=json.loads((Path(__file__).parent/'facade-datums.json').read_text())
widths={'S':164.8,'M':254,'L':329.6,'XL':418.8}
def part(p,q=1,role='',note=''):return {'path':p,'qty':q,'role':role,'note':note}
def drawer_parts(fam,depth,floor,split=False):
 code=f'{fam}{depth}'; base=[]
 base.append(part(find(f'{code}{"²" if split else ""} Module {floor}F.stl',D),1,'柜体'))
 if split:
  for stage in ['1st','2nd']:
   base.append(part(find(f'x{depth} Accessory {stage}.stl',U),1,'双抽屉中间连接件'))
 subfams=(['S','S'] if fam=='L' else ['S','M']) if split else [fam]
 for sub in subfams:
  subcode=f'{sub}{depth}'; isxl=sub=='XL'
  if isxl and depth>=6:
   for n in [1,2]:base.append(part(find(f'{subcode} Box 1F Part {n}.stl',D),1,'抽屉盒分件'))
  else:
   base.append(part(find(f'{subcode} Box {floor}F.stl',D),1,'抽屉盒'))
   if isxl:base.append(part(find(f'{subcode} Back Panel.stl',D),1,'抽屉背板'))
  facade=find('XL Facade 1F.stl' if isxl else f'{sub}{floor}F (Turn On Supports).stl',D, None if isxl else 'Facades')
  caps=FACADE_DATUMS[facade]['capQuantity']
  base.append(part(facade,1,'面板','按原文件提示开启支撑'))
  for nm,qty,role in [(f'x{depth} Runner Guide'+(' XL' if isxl else '')+'.stl',2*floor,'导轨'),(f'x{depth} Runner Slide'+(' XL' if isxl else '')+'.stl',2*floor,'滑轨'),('Runner Stopper.stl',2*floor,'限位件'),('Key (Turn On Supports).stl',1,'旋钮锁芯'),('Key Cap.stl',1,'旋钮帽'),('Springs.stl',1,'弹簧套件'),('Facade Cap.stl',caps,'面板端盖'),('Label.stl',1,'标签'),('Latch.stl',1,'堆叠锁扣')]:
   base.append(part(find(nm,U),qty,role,'文件已包含两只弹簧' if nm=='Springs.stl' else ('按 STL 实测面板圆孔数，扣除标签遮盖的一个孔' if nm=='Facade Cap.stl' else '')))
 return base,subfams
for fam in ['S','M','L','XL']:
 for depth in range(3,8):
  for floor in ([1] if fam=='XL' else [1,2,4]):
   for split in ([False,True] if fam in ['L','XL'] else [False]):
    code=f'{fam}{depth}';parts,sub=drawer_parts(fam,depth,floor,split)
    roofs={}
    for style in ['Table','Grid','Bowl','Under Table Mount']:
     roofs[style]=[part(find(f'{code} {style} Roof.stl',D),1,'顶盖')]
    grid=[];rails=[]
    for sf in sub:
     sc=f'{sf}{depth}'
     if sf=='XL' and depth>=6:
      for n in [1,2]:grid.append(part(find(f'{sc} Baseplate Part {n}.stl',D),1,'网格收纳底板分件'))
     else:grid.append(part(find(f'{sc} Baseplate.stl',D),1,'网格收纳底板'))
     rails.append(part(find(f'{sf} Rails.stl',U),1,'加强齿条套件','每文件含一对齿条'))
    mods.append({'id':f'd-{code}-{floor}'+('-twin' if split else ''),'kind':'drawer','family':fam,'depth':depth,'floor':floor,'variant':'twin' if split else 'single','name':f'{code}{"²" if split else ""} · {floor}F','subtitle':('双抽屉 · '+('S + S' if fam=='L' else 'S + M')) if split else '标准抽屉','width':widths[fam],'height':floor*48,'nominalDepth':depth*42,'parts':parts,'roofs':roofs,'gridParts':grid,'railParts':rails,'hardware':[{'name':'M4 × 14mm 螺丝','qty':4*floor*len(sub)}]})
for fam in ['S','M','L','XL']:
 for depth in range(3,8):
  for floor in ([1] if fam=='XL' else [1,2,4]):
   for variant in (['Flat','Dividers','Sealed'] if fam in ['L','XL'] else ['Standard']):
    code=f'{fam}{depth}';parts=[]
    module=f'{code} {floor}F '+('Module' if variant=='Standard' else f'{variant} Module')+'.stl'
    parts.append(part(find(module,S),1,'箱体'))
    if depth>=6:
     for n in [1,2]:parts.append(part(find(f'{code} Roof Part {n}.stl',S),1,'翻盖分件'))
     parts.append(part(find('Connector For Split Roof.stl',S,f'/{code}/'),1,'翻盖连接件'))
    else:parts.append(part(find(f'{code} Roof.stl',S),1,'翻盖'))
    default_lid='Split' if depth>=6 else 'Lid'
    lid_roofs={default_lid:[p for p in parts if p['role'] in ['翻盖','翻盖分件','翻盖连接件']]}
    if depth>=6:lid_roofs['Whole']=[part(find(f'{code} Roof Whole.stl',S),1,'翻盖')]
    facade=f'{"L" if fam=="XL" else fam}{floor}F.stl'
    parts.append(part(find('XL1F Facade.stl',S) if fam=='XL' else find(facade,SU,'Facades'),1,'前面板'))
    hingegrp='S-M' if fam in ['S','M'] else 'L-XL'
    hingebot=f'{hingegrp} 1F Hinge.stl' if floor==1 else ('S-M 2-4F Hinge.stl' if fam in ['S','M'] else 'L 2-4F Hinge.stl')
    parts.append(part(find(hingebot,SU),1,'下铰链套件','每文件为一对'))
    parts.append(part(find(f'{fam if fam in ["S","M"] else "L-XL"} Hinge Top.stl',SU),1,'上铰链套件','单件中央铰链' if fam in ['S','M'] else '每文件为一对'))
    parts.append(part(find(f'{hingegrp} Rods.stl',SU),1,'铰链轴套件','每文件为一对'))
    locks=1 if fam in ['S','M'] else 2
    for nm,qty,role in [('LOCK HOLDER.stl',locks,'锁扣座'),('LOCK INNER PART.stl',locks,'锁扣内件'),('LOCK OUTER PART '+('1F' if floor==1 else '2-4F')+'.stl',locks,'锁扣外件'),('1 SET OF PINS FOR 1 LOCK.stl',locks,'锁扣插销套件'),('Label for Sustainers.stl',locks,'箱体标签')]:parts.append(part(find(nm,SU),qty,role))
    if fam=='L' and variant=='Sealed':parts.append(part(find(f'L-{floor}F Seal Divider.stl',SU),3,'密封隔板'))
    if fam=='XL' and variant=='Sealed':
     parts.append(part(find('XL Seal Divider (Sides).stl',SU),2,'密封侧隔板'))
     parts.append(part(find('XL Seal Divider (Center).stl',SU),1,'密封中隔板'))
    parts.append(part(find('Label for Sustainers.stl',SU) if fam=='XL' else find('Label.stl',U),1,'锁扣标签','前面板标签凹槽'))
    # Dividers modules include the required housing; removable divider layouts are chosen separately.
    grid=[]
    if fam=='XL':
     if depth>=6:
      for n in [1,2]:grid.append(part(find(f'{code} Part {n} Gridfinity Baseplate.stl',SU),1,'网格收纳底板分件'))
     else:grid.append(part(find(f'{code} Gridfinity Baseplate.stl',SU),1,'网格收纳底板'))
    else:grid.append(part(find(f'{code} Baseplate.stl',SU),1,'网格收纳底板'))
    mods.append({'id':f's-{code}-{floor}-{variant.lower()}','kind':'sustainer','family':fam,'depth':depth,'floor':floor,'variant':variant.lower(),'name':f'{code} · {floor}F','subtitle':{'Standard':'翻盖箱','Flat':'翻盖箱 · 平底','Dividers':'翻盖箱 · 分隔接口','Sealed':'翻盖箱 · 密封分隔'}[variant],'width':widths[fam],'height':floor*48,'nominalDepth':depth*42,'parts':parts,'roofs':{},'defaultLid':default_lid,'lidRoofs':lid_roofs,'gridParts':grid,'railParts':[],'hardware':[{'name':'M4 × 10mm 螺丝','qty':8},{'name':'M4 × 14mm 螺丝','qty':16},{'name':'M4 × 20mm 螺丝','qty':7}],'notes':['分隔款默认不添加可选隔板，可在配件库按需要添加。'] if variant=='Dividers' else []})
assert len(mods)==160,len(mods)
result={'version':1,'libraryName':LIB.name,'source':'本地原版 STL 与 01_Instructions Manual、02_Drawer Assembly','widthNote':'名义拼接宽度；1F 堆叠节距 48mm，图示不含锁扣突出与装配间隙。','files':files,'modules':mods,'totalBytes':sum(f['bytes'] for f in files),'stlCount':sum(f['path'].lower().endswith('.stl') for f in files)}
OUT.write_text(json.dumps(result,ensure_ascii=False,separators=(',',':')))
print(f'{len(files)} files / {len(mods)} integrated modules / {OUT.stat().st_size:,} bytes')
