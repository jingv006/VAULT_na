#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Local, lossless mesh packaging for complete, pre-coloured VAULT kits."""
from pathlib import Path
from collections import OrderedDict
from xml.sax.saxutils import escape, quoteattr
import csv, gzip, hashlib, io, json, math, re, shutil, struct, threading, time, zipfile

BASE = Path(__file__).resolve().parent
LIB = BASE.parent / '261021_VAULT_USSA_S'
CAT = json.loads((BASE / 'dist/catalog.json').read_text())
MODULES = {m['id']: m for m in CAT['modules']}
FILES = {f['path']: f for f in CAT['files']}
GEO = json.loads((BASE / 'dist/geometry.json').read_text())['records']
PALETTE = json.loads((BASE / 'dist/palette.json').read_text())
NAMES = json.loads((BASE / 'dist/part-names.json').read_text())
ESTIMATES = json.loads((BASE / 'dist/estimates.json').read_text())['records']
VERSION = 3
MESH_VERSION = 1
ROOT = BASE / 'kits'
JOBS = {}
LOCK = threading.Lock()
GENERATOR = threading.Semaphore(1)
CORE = 'http://schemas.microsoft.com/3dmanufacturing/core/2015/02'

def specification(payload):
    if not isinstance(payload, dict):raise ValueError('请求需为对象')
    model = payload.get('model')
    if model not in MODULES:
        raise ValueError('未知箱子型号')
    m = MODULES[model]
    if m['kind']=='drawer':
        roof=payload.get('roof','Table')
        if roof not in ('none',*m['roofs'].keys()):raise ValueError('顶盖选项无效')
    else:
        requested=payload.get('roof','none')
        available=m.get('lidRoofs',{})
        if requested not in ('none','Table',*available.keys()):raise ValueError('翻盖选项无效')
        # Preserve existing default 3MF caches and saved workbench plans.
        roof='none' if requested in ('none','Table',m.get('defaultLid')) else requested
    for key in ('grid', 'rails'):
        if key in payload and type(payload[key]) is not bool:
            raise ValueError('配件选项无效')
    colours = payload.get('colours', {})
    if not isinstance(colours, dict) or any(k not in [s['id'] for s in PALETTE['slots']] for k in colours):
        raise ValueError('颜色配置无效')
    if any(not isinstance(v, str) or not re.fullmatch(r'#[0-9A-Fa-f]{6}', v) for v in colours.values()):
        raise ValueError('颜色需为六位十六进制色值')
    return {'model': model, 'roof': roof, 'grid': payload.get('grid', False),
            'rails': payload.get('rails', False) if m['kind'] == 'drawer' else False,
            'colours': {s['id']: colours.get(s['id'], s['hex']).upper() for s in PALETTE['slots']}}

def recipe(spec):
    m = MODULES[spec['model']]
    candidates = list(m['parts'])
    if m['kind']=='sustainer' and m.get('lidRoofs') and spec['roof']!='none':
        replacement=m['lidRoofs'][spec['roof']];candidates=[];inserted=False
        for part in m['parts']:
            if part['role'] in ['翻盖','翻盖分件','翻盖连接件']:
                if not inserted:candidates+=replacement;inserted=True
            else:candidates.append(part)
    elif spec['roof'] != 'none': candidates += m['roofs'][spec['roof']]
    if spec['grid']: candidates += m['gridParts']
    if spec['rails']: candidates += m['railParts']
    rows = OrderedDict()
    for p in candidates:
        if p['path'] in rows: rows[p['path']]['qty'] += p['qty']
        else:
            slot = PALETTE['roleSlots'].get(p['role'])
            if slot is None: raise ValueError('缺少部件配色规则：' + p['role'])
            rows[p['path']] = {**p, 'name': NAMES[p['path']], 'slot': slot,
                                'colour': spec['colours'][slot], 'size': GEO[p['path']]['size']}
    return list(rows.values())

def cache_key(spec, rows):
    sources = []
    for row in rows:
        stat = (LIB / row['path']).stat()
        sources.append([row['path'], row['qty'], row['slot'], stat.st_size, stat.st_mtime_ns])
    return hashlib.sha256(json.dumps([VERSION, spec, sources], sort_keys=True).encode()).hexdigest()[:24]

def code(m):
    return f"{m['family']}{m['depth']}F{m['floor']}"

def filename(spec):
    m = MODULES[spec['model']]
    kind = '抽屉柜' if m['kind'] == 'drawer' else '翻盖箱'
    variant={'single':'标准','twin':'双抽屉','standard':'标准','flat':'平底','dividers':'分隔','sealed':'密封'}[m['variant']]
    lid="_一体翻盖" if m["kind"]=="sustainer" and spec["roof"]=="Whole" else ""
    return f"VAULT_{code(m)}_{kind}_{variant}{lid}_预分色.3mf"

def organised_folder(spec):
    m=MODULES[spec['model']]
    kind='抽屉柜' if m['kind']=='drawer' else '翻盖箱'
    variant={'single':'标准','twin':'双抽屉','standard':'标准','flat':'平底','dividers':'分隔','sealed':'密封'}[m['variant']]
    return ROOT/'按尺寸整理'/kind/code(m)/variant

def link_default_project(spec,target):
    default=specification({'model':spec['model']})
    if spec!=default:return
    folder=organised_folder(spec);folder.mkdir(parents=True,exist_ok=True)
    link=folder/filename(spec)
    if link.is_symlink():link.unlink()
    elif link.exists():return
    import os
    link.symlink_to(os.path.relpath(target,folder))

def mesh_cache(path, update):
    # A deduplicated float32 vertex table retains all original facets and winding.
    import numpy as np
    source = LIB / path
    stat = source.stat()
    key = hashlib.sha256(f'{MESH_VERSION}:{path}:{stat.st_size}:{stat.st_mtime_ns}'.encode()).hexdigest()[:24]
    folder = ROOT / 'meshes'; folder.mkdir(parents=True, exist_ok=True)
    target, meta = folder / (key + '.xml.gz'), folder / (key + '.json')
    if target.exists() and meta.exists(): return target, json.loads(meta.read_text())
    update('读取网格：' + NAMES[path])
    with source.open('rb') as stream:
        header = stream.read(84)
    count = struct.unpack('<I', header[80:84])[0]
    if stat.st_size != 84 + count * 50:
        raise ValueError('暂不支持的 STL 编码：' + path)
    dtype = np.dtype([('n','<f4',(3,)),('v','<f4',(3,3)),('a','<u2')])
    raw = np.memmap(source, mode='r', dtype=dtype, offset=84, shape=(count,))
    points = raw['v'].reshape(-1, 3).copy()
    if not np.isfinite(points).all(): raise ValueError('STL 包含无效顶点')
    update('整理顶点：' + NAMES[path])
    vertices, inverse = np.unique(points, axis=0, return_inverse=True)
    facets = inverse.reshape(-1, 3)
    info = {'vertices': len(vertices), 'triangles': count,
            'sourceSHA256': hashlib.sha256(source.read_bytes()).hexdigest()}
    partial = target.with_suffix('.part')
    try:
        with gzip.open(partial, 'wb', compresslevel=2) as out:
            out.write(b'<mesh><vertices>\n')
            for start in range(0, len(vertices), 10000):
                out.write(''.join('<vertex x="%.9g" y="%.9g" z="%.9g"/>\n' % tuple(v)
                                  for v in vertices[start:start+10000]).encode())
            out.write(b'</vertices><triangles>\n')
            for start in range(0, count, 15000):
                out.write(''.join('<triangle v1="%d" v2="%d" v3="%d"/>\n' % tuple(f)
                                  for f in facets[start:start+15000]).encode())
            out.write(b'</triangles></mesh>\n')
        partial.replace(target); meta.write_text(json.dumps(info))
    finally:
        partial.unlink(missing_ok=True)
    return target, info

def arrange(rows):
    """Shelf pack by colour, original Z, optional XY90; oversize remains unscaled."""
    plates = []
    slot_order = [s['id'] for s in PALETTE['slots']]
    for slot in slot_order:
        instances = [(row, n) for row in rows if row['slot'] == slot for n in range(row['qty'])]
        instances.sort(key=lambda x: -x[0]['size'][0]*x[0]['size'][1])
        for row, copy in instances:
            sx, sy, sz = row['size']
            choices = [(sx, sy, False), (sy, sx, True)]
            oversize = sz > 325 or not any(w <= 315 and h <= 310 for w,h,_ in choices)
            placed = False
            if not oversize:
                for plate in plates:
                    if plate['slot'] != slot or plate['oversize']: continue
                    for shelf in plate['shelves']:
                        for w,h,rot in choices:
                            if h <= shelf['height'] and shelf['x']+w <= 320:
                                plate['items'].append({'row':row,'copy':copy,'x':shelf['x'],'y':shelf['y'],'rot':rot})
                                shelf['x'] += w+5; placed = True; break
                        if placed: break
                    if placed: break
                    y = max((s['y']+s['height']+5 for s in plate['shelves']), default=5)
                    for w,h,rot in choices:
                        if w <= 315 and y+h <= 315:
                            plate['shelves'].append({'x':w+10,'y':y,'height':h})
                            plate['items'].append({'row':row,'copy':copy,'x':5,'y':y,'rot':rot})
                            placed=True;break
                    if placed:break
            if not placed:
                w,h,rot = next((c for c in choices if c[0] <=315 and c[1]<=310),choices[0])
                plates.append({'slot':slot,'oversize':oversize,'shelves':[{'x':w+10,'y':5,'height':h}],
                               'items':[{'row':row,'copy':copy,'x':5 if not oversize else (350-w)/2,
                                         'y':5 if not oversize else (320-h)/2,'rot':rot}]})
    return plates

def project_settings(spec):
    settings=json.loads((BASE/'tools/three_mf_settings.json').read_text())
    colours=[spec['colours'][s['id']] for s in PALETTE['slots']]
    settings['filament_extruder_variant']=settings.get('filament_extruder_variant',[])[:8]
    settings['filament_self_index']=[str(n) for n in range(1,5) for _ in range(2)]
    settings['different_settings_to_system']=['']*6
    settings.update({'filament_colour':colours,'filament_type':['PLA']*4,
                     'filament_diameter':['1.75']*4,'filament_density':['1.26']*4,
                     'filament_settings_id':['Bambu PLA Basic @BBL H2D']*4,
                     'filament_ids':['GFA00']*4,'filament_vendor':['Bambu Lab']*4,
                     'filament_map':['1']*4, 'filament_map_mode':'Manual',
                     'filament_multi_colour':colours, 'filament_multi_colour_type':['0']*4})
    return settings

def write_project(target, spec, rows, meshes, update):
    m=MODULES[spec['model']]; plates=arrange(rows); columns=math.ceil(math.sqrt(len(plates)))
    slots={s['id']: i for i,s in enumerate(PALETTE['slots'])}
    meshes_by_path={row['path']:1000+i for i,row in enumerate(rows)}
    build=[]; wrappers=[]; config=['<?xml version="1.0" encoding="UTF-8"?><config>']
    manifest={'version':VERSION,'code':code(m),'module':m['id'],'specification':spec,'parts':rows,
              'hardware':m['hardware'],'palette':PALETTE,'plates':[],
              'notes':['原始尺寸不缩放；只做平面90度旋转和位置平移。','这是未切片的模型工程，不含打印G-code。',
                       '按同色分盘；超界零件单独保留并标记，仍需在切片器调整方向或拆分。',
                       '需支撑的零件已设置开启支撑；支撑位置、打印朝向和材料槽映射请在切片器核对。']}
    object_id=2
    for index,plate in enumerate(plates):
        px=index%columns*420;py=-(index//columns)*384
        instances=[];plate_manifest={'index':index+1,'slot':plate['slot'],'needsReview':plate['oversize'],'objects':[]}
        slot=slots[plate['slot']]
        for item in plate['items']:
            row=item['row'];oid=object_id;object_id+=1;mid=meshes_by_path[row['path']]
            name=row['name']+f" [{item['copy']+1}/{row['qty']}]"
            wrappers.append(f'<object id="{oid}" type="model" name={quoteattr(name)}><components><component objectid="{mid}"/></components></object>')
            low,high=GEO[row['path']]['min'],GEO[row['path']]['max']
            if item['rot']:
                transform=f"0 1 0 -1 0 0 0 0 1 {px+item['x']+high[1]:.9g} {py+item['y']-low[0]:.9g} {-low[2]:.9g}"
            else:
                transform=f"1 0 0 0 1 0 0 0 1 {px+item['x']-low[0]:.9g} {py+item['y']-low[1]:.9g} {-low[2]:.9g}"
            build.append(f'<item objectid="{oid}" transform="{transform}" printable="1"/>')
            support='Turn On Supports' in row['path'] or ESTIMATES.get(row['path'],{}).get('generatedSupports',False)
            info=meshes[row['path']][1]
            config.append(f'<object id="{oid}"><metadata key="name" value={quoteattr(name)}/><metadata key="extruder" value="{slot+1}"/>'
                          +('<metadata key="enable_support" value="1"/>' if support else '')
                          +f'<part id="{mid}" subtype="normal_part"><metadata key="name" value={quoteattr(name)}/><metadata key="extruder" value="{slot+1}"/>'
                          +f'<metadata key="source_file" value={quoteattr(row["path"])}/><mesh_stat face_count="{info["triangles"]}" edges_fixed="0" degenerate_facets="0" facets_removed="0" facets_reversed="0" backwards_edges="0"/></part></object>')
            instances.append(f'<model_instance><metadata key="object_id" value="{oid}"/><metadata key="instance_id" value="0"/><metadata key="identify_id" value="{oid}"/></model_instance>')
            plate_manifest['objects'].append({'objectId':oid,'path':row['path'],'copy':item['copy']+1,'transform':transform,'supportEnabled':support})
        title=f"{index+1:02d} {PALETTE['slots'][slot]['name']}"+(' · 需检查尺寸' if plate['oversize'] else '')
        config.append(f'<plate><metadata key="plater_id" value="{index+1}"/><metadata key="plater_name" value={quoteattr(title)}/><metadata key="locked" value="false"/><metadata key="filament_map_mode" value="Manual"/><metadata key="filament_maps" value="1 1 1 1"/>'+''.join(instances)+'</plate>')
        manifest['plates'].append(plate_manifest)
    config.append('</config>')
    for row in rows: row['mesh']=meshes[row['path']][1]
    partial=target.with_suffix('.part')
    try:
        with zipfile.ZipFile(partial,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=2,allowZip64=True) as z:
            z.writestr('[Content_Types].xml','<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/><Default Extension="config" ContentType="application/octet-stream"/><Default Extension="json" ContentType="application/json"/><Default Extension="csv" ContentType="text/csv"/></Types>')
            z.writestr('_rels/.rels','<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>')
            with z.open('3D/3dmodel.model','w',force_zip64=True) as out:
                # Bambu requires its version-formatted Application marker to load colours/config.
                # Generator records the actual authoring tool, separately from that compatibility marker.
                out.write(f'<?xml version="1.0" encoding="UTF-8"?><model unit="millimeter" xml:lang="zh-CN" xmlns="{CORE}" xmlns:BambuStudio="http://schemas.bambulab.com/package/2021"><metadata name="Application">BambuStudio-02.00.02.01</metadata><metadata name="Generator">VAULT Local Workbench</metadata><metadata name="BambuStudio:3mfVersion">1</metadata><metadata name="Title">{escape(code(m))} complete pre-coloured kit</metadata><resources><basematerials id="1">'.encode())
                for s in PALETTE['slots']: out.write(f'<base name={quoteattr(s["name"])} displaycolor="{spec["colours"][s["id"]]}FF"/>'.encode())
                out.write(b'</basematerials>')
                for row in rows:
                    update('写入模型：'+row['name'])
                    out.write(f'<object id="{meshes_by_path[row["path"]]}" type="model" name={quoteattr(row["name"])} pid="1" pindex="{slots[row["slot"]]}">'.encode())
                    with gzip.open(meshes[row['path']][0],'rb') as stream: shutil.copyfileobj(stream,out,1024*1024)
                    out.write(b'</object>')
                out.write((''.join(wrappers)+'</resources><build>'+''.join(build)+'</build></model>').encode())
            z.writestr('Metadata/model_settings.config',''.join(config))
            z.writestr('Metadata/project_settings.config',json.dumps(project_settings(spec),ensure_ascii=False))
            z.writestr('Metadata/vault_manifest.json',json.dumps(manifest,ensure_ascii=False,indent=2))
            buf=io.StringIO();writer=csv.writer(buf);writer.writerow(['中文部件','原始路径','打印份数','用途','颜色','色槽','实际尺寸mm','单份耗材g','单份时间秒'])
            for row in rows:
                estimate=ESTIMATES.get(row['path'],{})
                writer.writerow([row['name'],row['path'],row['qty'],row['role'],row['colour'],slots[row['slot']]+1,' × '.join(map(str,row['size'])),estimate.get('grams',''),estimate.get('seconds','')])
            z.writestr('Metadata/打印清单.csv',buf.getvalue().encode('utf-8-sig'))
        partial.replace(target)
    finally:
        partial.unlink(missing_ok=True)
    return {'plates':len(plates),'copies':len(build),'files':len(rows),
            'needsReviewPlates':sum(p['oversize'] for p in plates)}

def generate(jobid,spec,rows,target):
    job=JOBS[jobid]
    try:
        with GENERATOR:
            if target.exists():
                link_default_project(spec,target)
                job.update(status='done',done=len(rows),current='已读取缓存',download='/api/kit-download/'+jobid,size=target.stat().st_size);return
            job.update(status='working',current='准备零件网格')
            meshes={}
            for index,row in enumerate(rows):
                job['current']=f"{index+1}/{len(rows)} · {row['name']}"
                meshes[row['path']]=mesh_cache(row['path'],lambda text:job.update(current=text))
                job['done']=index+1
            result=write_project(target,spec,rows,meshes,lambda text:job.update(current=text))
            link_default_project(spec,target)
            job.update(status='done',current='3MF 已整理完成',download='/api/kit-download/'+jobid,size=target.stat().st_size,**result)
    except Exception as exc:
        job.update(status='error',error=str(exc))

def request(payload):
    spec=specification(payload);rows=recipe(spec);ident=cache_key(spec,rows)
    folder=ROOT/'cache';folder.mkdir(parents=True,exist_ok=True);target=folder/(ident+'.3mf')
    with LOCK:
        if ident in JOBS and JOBS[ident]['status']!='error':return JOBS[ident]
        job={'id':ident,'status':'queued','done':0,'total':len(rows),'current':'等待生成','filename':filename(spec),'target':str(target)}
        JOBS[ident]=job
        if target.exists():
            link_default_project(spec,target)
            job.update(status='done',done=len(rows),download='/api/kit-download/'+ident,size=target.stat().st_size)
        else:threading.Thread(target=generate,args=(ident,spec,rows,target),daemon=True).start()
    return job

def public_job(job):return {k:v for k,v in job.items() if k!='target'}

if __name__=='__main__':
    import argparse
    parser=argparse.ArgumentParser();parser.add_argument('model');args=parser.parse_args()
    job=request({'model':args.model})
    while job['status'] not in ('done','error'):
        print(job['current'],flush=True);time.sleep(2)
    print(json.dumps(public_job(job),ensure_ascii=False),flush=True)
