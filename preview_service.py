# -*- coding: utf-8 -*-
"""Generate STL-derived display meshes locally on demand; leave print sources intact."""
from pathlib import Path
import hashlib,json,threading,subprocess
import kit_service as kits
BASE=kits.BASE;ASSETS=BASE/'dist/preview-assets';TEMP=BASE/'tmp/preview';JOBS={};LOCK=threading.Lock();WORKER=threading.Semaphore(1)

def asset_info(part):
    source=kits.LIB/part['path'];s=source.stat()
    version=(15 if part['role'] in ['翻盖','翻盖分件'] else 14 if part['role']=='箱体' else 13) if part['path'].startswith('02. SUSTAINERS/') else (10 if part['role'] in ['面板','旋钮帽'] else 9)
    ident=hashlib.sha256(f"{version}:{part['path']}:{s.st_size}:{s.st_mtime_ns}".encode()).hexdigest()[:24]
    return ident,source

def run(ident,spec,rows,plan):
    job=JOBS[ident]
    try:
        with WORKER:
            missing=[p for p in plan['parts'] if not (ASSETS/(p['id']+'.json')).exists() or not (ASSETS/(p['id']+'.bin')).exists()]
            if missing:
                job.update(status='working',current='准备真实 STL 三维网格')
                request=TEMP/(ident+'.json');request.write_text(json.dumps(plan,ensure_ascii=False))
                with (TEMP/(ident+'.log')).open('w') as log:
                    result=subprocess.run(['/usr/bin/python3',str(BASE/'tools/build_preview_assets.py'),str(request)],stdout=log,stderr=subprocess.STDOUT,timeout=240)
                if result.returncode:raise ValueError('三维网格转换失败，日志已保存在本地')
            parts=[]
            for row,source in zip(rows,plan['parts']):
                asset=json.loads((ASSETS/(source['id']+'.json')).read_text())
                parts.append({**row,'asset':asset})
            job.update(status='done',done=len(rows),total=len(rows),current='真实三维模型已载入',data={'model':spec['model'],'parts':parts,'source':'original-STL display meshes','placement':'display assembly; not a mechanical interference check'})
    except Exception as exc:job.update(status='error',error=str(exc))

def request(payload):
    spec=kits.specification(payload);rows=kits.recipe(spec);m=kits.MODULES[spec['model']]
    ident=hashlib.sha256(json.dumps([spec['model'],spec['roof'],spec['grid'],spec['rails'],[[asset_info(p)[0],p['qty']] for p in rows]]).encode()).hexdigest()[:24]
    TEMP.mkdir(parents=True,exist_ok=True);ASSETS.mkdir(parents=True,exist_ok=True)
    with LOCK:
        if ident in JOBS and JOBS[ident]['status']!='error':return public(JOBS[ident])
        progress=TEMP/(ident+'-progress.json')
        plan={'output':str(ASSETS),'progress':str(progress),'parts':[]}
        for part in rows:
            aid,path=asset_info(part)
            # Width belongs to the source family, which may be smaller than its twin module.
            import re
            match=re.match(r'(XL|S|M|L)\d',path.name)
            width={'S':164.8,'M':254,'L':329.6,'XL':418.8}.get(match[1],m['width']) if match else m['width']
            plan['parts'].append({'id':aid,'path':part['path'],'source':str(path),'name':part['name'],'role':part['role'],'width':width,'height':m['height']})
        job={'id':ident,'status':'queued','done':0,'total':len(rows),'current':'等待准备三维零件','progress':str(progress)};JOBS[ident]=job
        threading.Thread(target=run,args=(ident,spec,rows,plan),daemon=True).start()
    return public(job)

def public(job):
    result={k:v for k,v in job.items() if k!='progress'}
    if job['status']=='working':
        try:result.update(json.loads(Path(job['progress']).read_text()))
        except (FileNotFoundError,ValueError):pass
    return result

if __name__=='__main__':
    import sys,time
    j=request({'model':sys.argv[1]})
    while j['status'] not in ['done','error']:
        print(j.get('current'),flush=True);time.sleep(2);j=public(JOBS[j['id']])
    print(json.dumps({k:v for k,v in j.items() if k!='data'},ensure_ascii=False),flush=True)
