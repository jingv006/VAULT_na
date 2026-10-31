#!/usr/bin/env python3
"""Loopback-only VAULT workbench. No third-party packages or model uploads."""
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse,unquote
import argparse,json,threading,uuid,zipfile,csv,io,time,shutil,os
import kit_service
import workbench_export
import preview_service
BASE=Path(__file__).resolve().parent
LIB=BASE.parent/'261021_VAULT_USSA_S'
CAT=json.loads((BASE/'dist/catalog.json').read_text())
FILES={f['path']:f for f in CAT['files']}
JOBS={}; LOCK=threading.Lock()
EXPORT=BASE/'exports'
def secure_file(rel):
 if rel not in FILES:raise ValueError('Unknown library file')
 p=(LIB/rel).resolve()
 if not p.is_relative_to(LIB.resolve()) or not p.is_file():raise ValueError('Library file unavailable')
 return p

def run_export(jobid,payload):
 job=JOBS[jobid];target=EXPORT/(jobid+'.zip');partial=target.with_suffix('.part')
 try:
  EXPORT.mkdir(exist_ok=True)
  # Keep exports for one day, never delete model source files.
  for old in EXPORT.glob('*'):
   if old.is_file() and time.time()-old.stat().st_mtime>86400:old.unlink()
  rows=payload['parts'];copies=payload.get('copies',False)
  projects=[];stl_rows=rows
  if payload.get('mode')=='kits':
   groups,stl_rows=workbench_export.validate(payload)
   projects=workbench_export.prepare(groups,job);copies=False
  total=sum(FILES[r['path']]['bytes']*(r['qty'] if copies else 1) for r in stl_rows)+sum(p['target'].stat().st_size for p in projects)
  job.update(total=total,done=0,status='writing',phase='zip',unit='bytes')
  with zipfile.ZipFile(partial,'w',compression=zipfile.ZIP_STORED,allowZip64=True) as z:
   z.writestr('layout.vault.json',json.dumps(payload['plan'],ensure_ascii=False,indent=2))
   out=io.StringIO();writer=csv.writer(out);writer.writerow(['部件','打印份数','每份字节','源文件相对路径','备注'])
   for r in rows:writer.writerow([Path(r['path']).name,r['qty'],FILES[r['path']]['bytes'],r['path'],r.get('note','')])
   manifest=payload.get('manifestCSV')
   z.writestr('打印清单.csv',manifest.encode('utf-8') if isinstance(manifest,str) else out.getvalue().encode('utf-8-sig'))
   if isinstance(payload.get('estimate'),dict):
    z.writestr('耗材时间估算.json',json.dumps(payload['estimate'],ensure_ascii=False,indent=2))
    if isinstance(payload['estimate'].get('printerCompatibility'),dict):z.writestr('打印机适配.json',json.dumps(payload['estimate']['printerCompatibility'],ensure_ascii=False,indent=2))
   z.writestr('hardware.json',json.dumps(payload.get('hardware',[]),ensure_ascii=False,indent=2))
   z.writestr('README.txt','VAULT 工作台导出\nprint-N 为该 STL 所需打印份数，不是三角网格数量。\n源文件可能包含多个零件（例如 Springs 为一对）。\n名义尺寸与二维布局仅用于规划，不验证承重、公差或锁扣连接。\n请对照原版装配说明核对打印方向、支撑与紧固件。\n配方数量可在网页打印清单中调整。\n')
   if payload.get('svg'):z.writestr('组合预览.svg',payload['svg'])
   if projects:
    z.writestr('模块打印清单.csv',workbench_export.manifest(projects))
    z.writestr('模块工程.json',json.dumps([{k:v for k,v in p.items() if k!='target'} for p in projects],ensure_ascii=False,indent=2))
    z.writestr('3MF打印说明.txt','每份 3MF 只含一套模块所需零件；文件名 __print-N 表示整份工程要打印 N 套。\n相同型号的顶盖、配件配置不同，会分别输出。被上层覆盖的抽屉不含顶盖。\n3MF 使用工作台自定义配色（与尺寸总览同步），浅色预览不影响导出。\n备用件以 STL 单独附带，STL 文件名 print-N 表示该 STL 的打印份数。\n3MF 未切片，请在切片器核对材料、方向、支撑和打印机范围。\n')
    for project in projects:
     job['current']=project['name']
     with project['target'].open('rb') as source,z.open(project['name'],'w',force_zip64=True) as dest:
      while True:
       data=source.read(1024*1024)
       if not data:break
       dest.write(data);job['done']+=len(data)
   for r in stl_rows:
    p=secure_file(r['path']);qty=r['qty'];folder=Path(r['path']).parent.as_posix()
    for n in range(qty if copies else 1):
     name=f'STL/{folder}/{p.stem}__'+(f'{n+1}-of-{qty}' if copies else f'print-{qty}')+'.stl'
     job['current']=p.name
     with p.open('rb') as source,z.open(name,'w',force_zip64=True) as dest:
      while True:
       data=source.read(1024*1024)
       if not data:break
       dest.write(data);job['done']+=len(data)
   for f in CAT['files']:
    if f['path'].lower().endswith('.pdf'):z.write(secure_file(f['path']),'装配说明/'+f['name'])
  partial.replace(target);job.update(status='done',download='/api/download/'+jobid,size=target.stat().st_size)
 except Exception as exc:
  partial.unlink(missing_ok=True);job.update(status='error',error=str(exc))
class Handler(SimpleHTTPRequestHandler):
 def __init__(self,*a,**kw):super().__init__(*a,directory=str(BASE/'dist'),**kw)
 def trusted(self):
  host=self.headers.get('Host','').split(':')[0]
  origin=self.headers.get('Origin')
  return host in ['127.0.0.1','localhost'] and (not origin or origin in [f'http://127.0.0.1:{self.server.server_port}',f'http://localhost:{self.server.server_port}'])
 def json(self,data,status=200):
  raw=json.dumps(data,ensure_ascii=False).encode();self.send_response(status);self.send_header('Content-Type','application/json; charset=utf-8');self.send_header('Content-Length',str(len(raw)));self.send_header('Cache-Control','no-store');self.end_headers();self.wfile.write(raw)
 def do_GET(self):
  if not self.trusted():return self.json({'error':'Loopback origin required'},403)
  path=urlparse(self.path).path
  if path=='/api/status':return self.json({'local':True,'libraryName':LIB.name,'stlCount':CAT['stlCount'],'ready':LIB.is_dir()})
  if path.startswith('/api/preview-job/'):
   j=preview_service.JOBS.get(path.rsplit('/',1)[-1]);return self.json(preview_service.public(j) if j else {'error':'Job not found'},200 if j else 404)
  if path.startswith('/api/kit-job/'):
   j=kit_service.JOBS.get(path.rsplit('/',1)[-1]);return self.json(kit_service.public_job(j) if j else {'error':'Job not found'},200 if j else 404)
  if path.startswith('/api/kit-download/'):
   ident=path.rsplit('/',1)[-1];j=kit_service.JOBS.get(ident)
   if not j or j['status']!='done':return self.json({'error':'3MF尚未生成'},404)
   p=Path(j['target']);self.send_response(200);self.send_header('Content-Type','model/3mf');self.send_header('Content-Disposition',"attachment; filename=VAULT-kit.3mf; filename*=UTF-8''"+__import__('urllib.parse',fromlist=['quote']).quote(j['filename']));self.send_header('Content-Length',str(p.stat().st_size));self.end_headers()
   try:
    with p.open('rb') as f:shutil.copyfileobj(f,self.wfile,1024*1024)
   except (BrokenPipeError,ConnectionResetError):pass
   return
  if path.startswith('/api/job/'):
   j=JOBS.get(path.rsplit('/',1)[-1]);return self.json(j if j else {'error':'Job not found'},200 if j else 404)
  if path.startswith('/api/download/'):
   ident=path.rsplit('/',1)[-1];j=JOBS.get(ident)
   if not j or j['status']!='done':return self.json({'error':'Export not ready'},404)
   p=EXPORT/(ident+'.zip');self.send_response(200);self.send_header('Content-Type','application/zip');self.send_header('Content-Disposition','attachment; filename="VAULT-workbench.zip"');self.send_header('Content-Length',str(p.stat().st_size));self.end_headers()
   try:
    with p.open('rb') as f:shutil.copyfileobj(f,self.wfile,1024*1024)
   except (BrokenPipeError,ConnectionResetError):pass
   return
  if path.startswith('/api/file/'):
   try:p=secure_file(unquote(path[len('/api/file/'):]))
   except ValueError:return self.json({'error':'Unknown file'},404)
   self.send_response(200);self.send_header('Content-Length',str(p.stat().st_size));self.send_header('Content-Type','application/pdf' if p.suffix.lower()=='.pdf' else 'application/octet-stream');self.end_headers()
   with p.open('rb') as f:shutil.copyfileobj(f,self.wfile,1024*1024)
   return
  return super().do_GET()
 def do_POST(self):
  if not self.trusted():return self.json({'error':'Loopback origin required'},403)
  if self.path=='/api/preview':
   try:
    length=int(self.headers.get('Content-Length','0'))
    if not 0<length<=20000:raise ValueError('Invalid request length')
    return self.json(preview_service.request(json.loads(self.rfile.read(length))))
   except (ValueError,KeyError,TypeError,json.JSONDecodeError) as e:return self.json({'error':str(e)},400)
  if self.path=='/api/kit':
   try:
    length=int(self.headers.get('Content-Length','0'))
    if not 0<length<=20000:raise ValueError('Invalid request length')
    return self.json(kit_service.public_job(kit_service.request(json.loads(self.rfile.read(length)))))
   except (ValueError,KeyError,TypeError,json.JSONDecodeError) as e:return self.json({'error':str(e)},400)
  if self.path!='/api/export':return self.json({'error':'Not found'},404)
  try:
   length=int(self.headers.get('Content-Length','0'))
   if length<1 or length>5_000_000:raise ValueError('Invalid request length')
   p=json.loads(self.rfile.read(length));rows=p['parts']
   if not isinstance(rows,list) or len(rows)>len(FILES):raise ValueError('Invalid parts')
   seen=set()
   for r in rows:
    if r['path'] in seen:raise ValueError('Duplicate path')
    seen.add(r['path']);secure_file(r['path'])
    if type(r['qty']) is not int or not 1<=r['qty']<=999:raise ValueError('Invalid quantity')
   if not isinstance(p.get('plan'),dict):raise ValueError('Missing plan')
   if p.get('mode') not in (None,'kits'):raise ValueError('打包模式无效')
   if p.get('mode')=='kits':workbench_export.validate(p)
   size=sum(FILES[r['path']]['bytes']*(r['qty'] if p.get('copies') else 1) for r in rows)
   if size>shutil.disk_usage(BASE).free-100_000_000:raise ValueError('磁盘剩余空间不足')
   ident=uuid.uuid4().hex;JOBS[ident]={'id':ident,'status':'queued','done':0,'total':size}
   threading.Thread(target=run_export,args=(ident,p),daemon=True).start();self.json({'id':ident})
  except (ValueError,KeyError,TypeError,json.JSONDecodeError) as e:self.json({'error':str(e)},400)
 def log_message(self,fmt,*args):print(fmt%args,flush=True)
if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--port',type=int,default=8765);parser.add_argument('--open',action='store_true');args=parser.parse_args()
 server=ThreadingHTTPServer(('127.0.0.1',args.port),Handler)
 print(f'VAULT 工作台 http://127.0.0.1:{args.port}',flush=True)
 if args.open:
  import webbrowser
  webbrowser.open(f'http://127.0.0.1:{args.port}')
 try:server.serve_forever()
 except KeyboardInterrupt:server.server_close()
