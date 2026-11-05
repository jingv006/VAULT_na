# -*- coding: utf-8 -*-
"""Validate a divider layout and package its exact official parts as a print 3MF."""
from collections import OrderedDict
from pathlib import Path
import hashlib, json, math, re, threading
import kit_service as kits

DATA=json.loads((kits.BASE/'dist/dividers-data.json').read_text())
VERSION=1

def integer(value):
    return type(value) in (int,float) and math.isfinite(value) and value==int(value)

def fits(a,items,grid):
    x,y,n=a['x'],a['y'],a['n'];horizontal=a['axis']=='h'
    if not integer(x) or not integer(y) or x<0 or y<0:return False
    if horizontal and not 0<y<grid[1] or not horizontal and not 0<x<grid[0]:return False
    if x+(n if horizontal else 0)>grid[0] or y+(0 if horizontal else n)>grid[1]:return False
    for b in items:
        if b['id']==a['id']:continue
        if a['axis']==b['axis']:
            k,q=('x','y') if horizontal else ('y','x')
            if a[q]==b[q] and max(a[k],b[k])<min(a[k]+n,b[k]+b['n']):return False
        else:
            h,v=(a,b) if horizontal else (b,a)
            if h['x']<v['x']<h['x']+h['n'] and v['y']<h['y']<v['y']+v['n']:return False
    return True

def specification(payload):
    if not isinstance(payload,dict):raise ValueError('请求需为对象')
    plan=payload.get('plan')
    if not isinstance(plan,dict) or plan.get('version')!=1:raise ValueError('隔板方案版本无效')
    spec=plan.get('spec');height=plan.get('height');pin=plan.get('pin');items=plan.get('items')
    if not isinstance(spec,dict) or spec.get('family') not in DATA['widthNumbers']:raise ValueError('抽屉规格无效')
    family,depth,floor=spec['family'],spec.get('depth'),spec.get('floor')
    if type(depth) is not int or depth not in (3,4,5,6,7) or type(floor) is not int or floor not in (1,2,4) or family=='XL' and floor!=1:raise ValueError('抽屉规格无效')
    if type(height) not in (int,float) or height not in (20,34.5,82.5) or height>(34.5 if floor==1 else 82.5):raise ValueError('隔板高度无效')
    if pin not in ('loose','tight') or not isinstance(items,list) or not 1<=len(items)<=100:raise ValueError('请先排布 1–100 片隔板')
    clean=[];ids=set()
    for item in items:
        if not isinstance(item,dict):raise ValueError('隔板数据无效')
        ident=item.get('id');axis=item.get('axis');border=item.get('border');n=item.get('n')
        if not isinstance(ident,str) or not ident or len(ident)>100 or ident in ids or axis not in ('h','v') or border not in ('none','straight','rounded'):raise ValueError('隔板数据无效')
        if not integer(n) or not any(p['role']=='divider' and p['height']==height and p['number']==n for p in DATA['parts']):raise ValueError('官方隔板型号不存在')
        ids.add(ident);clean.append({'id':ident,'axis':axis,'border':border,'n':int(n),'x':item.get('x'),'y':item.get('y')})
    grid=(DATA['widthNumbers'][family],DATA['depthNumbers'][str(depth)])
    # Validate all coordinates before the pairwise overlap checks.
    if any(not integer(i[k]) for i in clean for k in ('x','y')) or any(not fits(i,clean,grid) for i in clean):raise ValueError('隔板越界、重叠或交叉，请先调整排布')
    colours=payload.get('colours',{})
    if not isinstance(colours,dict) or any(k not in [s['id'] for s in kits.PALETTE['slots']] for k in colours) or any(not isinstance(v,str) or not re.fullmatch(r'#[0-9a-fA-F]{6}',v) for v in colours.values()):raise ValueError('配色无效')
    return {'plan':{'version':1,'spec':{'family':family,'depth':depth,'floor':floor},'height':height,'pin':pin,'items':clean},
            'colours':{s['id']:colours.get(s['id'],s['hex']).upper() for s in kits.PALETTE['slots']}}

def recipe(spec):
    plan=spec['plan'];height=plan['height'];grid=(DATA['widthNumbers'][plan['spec']['family']],DATA['depthNumbers'][str(plan['spec']['depth'])]);rows=OrderedDict()
    def add(role,qty,number=None):
        if not qty:return
        part=next(p for p in DATA['parts'] if p['role']==role and (p.get('height')==height if role not in ('loose','tight') else True) and (number is None or p.get('number')==number))
        path=part['path']
        if path in rows:rows[path]['qty']+=qty;return
        name=(str(number)+'号隔板' if role=='divider' else {'straight':'直边端部件','rounded':'圆角端部件','loose':'松配插销','tight':'紧配插销'}[role])+(f' · {height:g} mm' if role not in ('loose','tight') else '')
        slot='orange' if role in ('loose','tight') else 'light'
        rows[path]={**part,'qty':qty,'name':name,'slot':slot,'colour':spec['colours'][slot],'size':kits.GEO[path]['size']}
    for item in plan['items']:
        add('divider',1,item['n'])
        if item['border']!='none':
            k,limit=('x',grid[0]) if item['axis']=='h' else ('y',grid[1])
            add(item['border'],int(item[k]==0)+int(item[k]+item['n']==limit))
        add(plan['pin'],2)
    return list(rows.values())

def code(spec):
    s=spec['plan']['spec'];return f"{s['family']}{s['depth']}F{s['floor']}"

def generate(job,spec,rows):
    try:
        with kits.GENERATOR:
            meshes={};job.update(status='working',current='准备隔板网格')
            for index,row in enumerate(rows):
                job['current']=row['name']
                meshes[row['path']]=kits.mesh_cache(row['path'],lambda text:job.update(current=text))
                job['done']=index+1
            result=kits.write_project(Path(job['target']),spec,rows,meshes,lambda text:job.update(current=text),
                context={'code':code(spec)+' 隔板分区','module':'divider-layout','hardware':[],'layout':spec['plan']})
            job.update(status='done',current='隔板 3MF 已整理完成',download='/api/kit-download/'+job['id'],size=Path(job['target']).stat().st_size,**result)
    except Exception as exc:job.update(status='error',error=str(exc))

def request(payload):
    spec=specification(payload);rows=recipe(spec)
    ident='dividers-'+hashlib.sha256(json.dumps([VERSION,kits.VERSION,spec,kits.cache_key(spec,rows)],sort_keys=True).encode()).hexdigest()[:24]
    folder=kits.ROOT/'cache';folder.mkdir(parents=True,exist_ok=True);target=folder/(ident+'.3mf')
    with kits.LOCK:
        if ident in kits.JOBS and kits.JOBS[ident]['status']!='error':return kits.JOBS[ident]
        job={'id':ident,'status':'queued','done':0,'total':len(rows),'current':'等待整理隔板',
             'filename':f'VAULT_{code(spec)}_隔板分区_整合.3mf','target':str(target)}
        kits.JOBS[ident]=job
        if target.exists():job.update(status='done',done=len(rows),download='/api/kit-download/'+ident,size=target.stat().st_size)
        else:threading.Thread(target=generate,args=(job,spec,rows),daemon=True).start()
    return job
