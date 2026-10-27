#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Resume-safe local slicing. Records actual G-code statistics; never uploads models."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor,as_completed
from collections import Counter
import argparse,csv,hashlib,json,math,os,re,shutil,subprocess,sys,threading,time
BASE=Path(__file__).resolve().parents[1]
LIB=BASE.parent/'261021_VAULT_USSA_S'
SLICER=Path('/Applications/OrcaSlicer.app/Contents/MacOS/OrcaSlicer')
VENDOR=Path('/Applications/OrcaSlicer.app/Contents/Resources/profiles/BBL')
RUN=BASE/'slicing/H2D-PLA-020-15pct-2walls-orca'
PROFILE_NAMES={'machine':'Bambu Lab H2D 0.4 nozzle','process':'0.20mm Standard @BBL H2D','filament':'Bambu PLA Basic @BBL H2D'}
LOCK=threading.Lock();ACTIVE={}
def atomic_json(path,value):
 path.parent.mkdir(parents=True,exist_ok=True);temp=path.with_name(path.name+'.tmp');temp.write_text(json.dumps(value,ensure_ascii=False,separators=(',',':'))+'\n');temp.replace(path)
def digest_file(path):
 h=hashlib.sha256()
 with path.open('rb') as f:
  for b in iter(lambda:f.read(1024*1024),b''):h.update(b)
 return h.hexdigest()
def resolve(name,kind):
 d=json.loads((VENDOR/kind/(name+'.json')).read_text());out={}
 if d.get('inherits'):out=resolve(d['inherits'],kind)
 out.update(d);out.pop('inherits',None);return out

def prepare():
 RUN.mkdir(parents=True,exist_ok=True)
 configs={}
 for kind,name in PROFILE_NAMES.items():
  d=resolve(name,kind)
  if kind=='process':d.update(wall_loops='2',sparse_infill_density='15%',enable_support='0',sparse_infill_pattern='grid',layer_height='0.2',top_shell_layers='5',bottom_shell_layers='3',top_shell_thickness='1.0',bottom_shell_thickness='0',brim_type='auto_brim',brim_width='5')
  configs[kind]=d
  atomic_json(RUN/(kind+'.json'),d)
 fingerprint=hashlib.sha256(json.dumps(configs,sort_keys=True).encode()+str(SLICER.stat().st_mtime_ns).encode()).hexdigest()
 return {'id':'h2d-pla-020-15pct-2walls','fingerprint':fingerprint,'slicer':'OrcaSlicer 2.4.2','machine':'Bambu Lab H2D','material':'Bambu PLA Basic','nozzleMM':.4,'layerHeightMM':.2,'infillPercent':15,'wallLoops':2,'infillPattern':configs['process']['sparse_infill_pattern'],'topShellLayers':int(configs['process']['top_shell_layers']),'bottomShellLayers':int(configs['process']['bottom_shell_layers']),'supports':False,'brim':'auto_brim, 5mm setting','orientation':'original STL, no auto rotation','densityGPerCm3':float(configs['filament']['filament_density'][0]),'filamentDiameterMM':float(configs['filament']['filament_diameter'][0]),'timeBasis':'单份 STL 单独切片的预计总时间，按打印份数累计；未模拟合盘或多机并行','scopeNote':'统一 PLA 基准估算；未计额外自动支撑，TPU 专用件需按实际材料重切'}
def duration(text):
 result=sum(float(value)*{'d':86400,'h':3600,'m':60,'s':1}[unit] for value,unit in re.findall(r'([\d.]+)\s*([dhms])',text))
 if not result:raise ValueError('Missing print duration')
 return round(result)
def number(header,name):
 m=re.search(name+r'\s*[:=]\s*([\d.]+)',header)
 if not m:raise ValueError('Missing G-code statistic: '+name)
 return float(m.group(1))
def parse_gcode(path,profile,generated_supports=False):
 with path.open('rb') as f:
  head=f.read(120000).decode('utf-8','replace');f.seek(max(0,path.stat().st_size-40000));tail=f.read().decode('utf-8','replace')
 if '; EXECUTABLE_BLOCK_END' not in tail:raise ValueError('Incomplete G-code')
 for key,value in [('wall_loops','2'),('sparse_infill_density','15%'),('layer_height','0.2'),('enable_support','1' if generated_supports else '0')]:
  if not re.search(r'^; '+key+r' = '+re.escape(value)+r'\s*$',head,re.M):raise ValueError('Unexpected slicing setting: '+key)
 mass=number(head+tail,r'(?:total filament weight|filament used) \[g\]');length=number(head+tail,r'(?:total filament length|filament used) \[mm\]')
 m=re.search(r'model printing time: ([^;\n]+); total estimated time: ([^\n]+)',head)
 if not m:raise ValueError('Missing timing header')
 expected=length*math.pi*(profile['filamentDiameterMM']/2)**2/1000*profile['densityGPerCm3']
 if abs(expected-mass)>max(.15,mass*.005):raise ValueError('Filament mass cross-check failed')
 if mass<=0 or length<=0:raise ValueError('Empty toolpath')
 return {'grams':mass,'filamentMetres':round(length/1000,5),'modelSeconds':duration(m[1]),'seconds':duration(m[2]),'layers':int(number(head,'total layer number')),'gcodeBytes':path.stat().st_size,'gcodeSHA256':digest_file(path),'massCrossCheckGrams':round(expected,4)}

def slice_one(file,profile,timeout,retry=False):
 rel=file['path'];source=LIB/rel;stat=source.stat();key=hashlib.sha256(rel.encode()).hexdigest()[:24]
 record_path=RUN/'records'/(key+'.json')
 if record_path.exists():
  previous=json.loads(record_path.read_text())
  if previous.get('profileFingerprint')==profile['fingerprint'] and previous.get('sourceBytes')==stat.st_size and previous.get('sourceMtimeNs')==stat.st_mtime_ns and (previous.get('status')=='ok' or not retry):return previous
 job=RUN/'work'/key;shutil.rmtree(job,ignore_errors=True);job.mkdir(parents=True,exist_ok=True);log=RUN/'logs'/(key+'.log');log.parent.mkdir(exist_ok=True)
 record={'path':rel,'name':source.name,'status':'running','sourceBytes':stat.st_size,'sourceMtimeNs':stat.st_mtime_ns,'sourceSHA256':digest_file(source),'profileFingerprint':profile['fingerprint'],'needsSupport':'turn on support' in source.name.lower(),'materialMismatch':'tpu' in source.name.lower()}
 process_path=RUN/'process.json'
 cmd=[str(SLICER),'--debug','2','--datadir',str(job/'runtime'),'--load-settings',str(RUN/'machine.json')+';'+str(process_path),'--load-filaments',str(RUN/'filament.json'),'--orient','0','--arrange','1','--slice','0','--outputdir',str(job),str(source)]
 started=time.monotonic()
 with LOCK:ACTIVE[key]=source.name
 try:
  with log.open('w') as output:process=subprocess.run(cmd,stdout=output,stderr=subprocess.STDOUT,timeout=timeout)
  text=log.read_text(errors='replace');record['exitCode']=process.returncode
  gcode=job/'plate_1.gcode'
  if process.returncode==156:
   # Four split XL baseplates contain floating regions in the supplied pose.
   # Include necessary support rather than recording a zero or fabricating data.
   support_process=json.loads((RUN/'process.json').read_text());support_process['enable_support']='1'
   process_path=job/'process-with-support.json';atomic_json(process_path,support_process)
   record.update(generatedSupports=True,needsSupport=True,supportNote='当前方向存在悬空结构，切片需启用自动树状支撑；本项耗材和时间已包含支撑。',effectiveOverrides={'enable_support':'1'},overrideProcessSHA256=digest_file(process_path))
   cmd[cmd.index('--load-settings')+1]=str(RUN/'machine.json')+';'+str(process_path)
   with log.open('a') as output:
    output.write('\nSUPPORT OVERRIDE: include necessary automatic support\n');output.flush()
    process=subprocess.run(cmd,stdout=output,stderr=subprocess.STDOUT,timeout=timeout)
   text=log.read_text(errors='replace');record['exitCode']=process.returncode
  if process.returncode!=0 and (process.returncode==206 or re.search(r'no object is fully inside|not fit|cannot fit|outside.*print',text,re.I)):
   # Preserve scale, orientation, speeds and extrusion settings. This separate
   # virtual envelope is only for estimating parts which cannot fit the H2D.
   machine=json.loads((RUN/'machine.json').read_text())
   machine.update(printable_area=['0x0','600x0','600x600','0x600'],printable_height='600',extruder_printable_area=['0x0,600x0,600x600,0x600','0x0,600x0,600x600,0x600'],extruder_printable_height=['600','600'],bed_exclude_area=[],wrapping_exclude_area=[])
   atomic_json(job/'estimate-only-machine.json',machine)
   record['printableOnH2D']=False;record['estimateOnly']=True;record['envelopeNote']='当前 STL 方向未通过 H2D 标准范围检查，采用 600mm 虚拟范围、相同模型尺寸与 H2D 速度，仅供耗材时间估算；需调整方向、拆分或换机。'
   cmd[cmd.index('--load-settings')+1]=str(job/'estimate-only-machine.json')+';'+str(process_path)
   with log.open('a') as output:
    output.write('\nESTIMATE ONLY: 600mm virtual envelope, no scaling\n');output.flush()
    process=subprocess.run(cmd,stdout=output,stderr=subprocess.STDOUT,timeout=timeout)
   text=log.read_text(errors='replace');record['exitCode']=process.returncode
  if process.returncode==0 and gcode.is_file():
   record.update(parse_gcode(gcode,profile,record.get('generatedSupports',False)));record['status']='ok';record.setdefault('printableOnH2D',True)
   record['warnings']=[line.strip()[:300] for line in text.splitlines() if '[error]' in line or '[warning]' in line or '[warn]' in line][-12:]
  else:
   record['status']='out_of_bounds' if re.search(r'(outside|out of|exceed|too large|beyond).*(print|bed|plate|volume|height|bound)|not fit|cannot fit|no object is fully inside',text,re.I) else 'failed'
   record['error']=text[-4000:].strip() or f'Slicer exit {process.returncode}; no G-code'
 except subprocess.TimeoutExpired:record.update(status='timeout',error=f'Slicing exceeded {timeout}s')
 except Exception as e:record.update(status='failed',error=str(e))
 finally:
  record['elapsedSeconds']=round(time.monotonic()-started,2);record['updatedAt']=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())
  with LOCK:ACTIVE.pop(key,None)
  atomic_json(record_path,record)
  shutil.rmtree(job,ignore_errors=True)
 return record

def publish(profile,files,records,started):
 counts=Counter(r['status'] for r in records.values());pending=len(files)-len(records)
 summary={'total':len(files),'processed':len(records),'ok':counts['ok'],'failed':sum(n for k,n in counts.items() if k!='ok'),'pending':pending,'outOfBounds':counts['out_of_bounds']+sum(bool(r.get('estimateOnly')) for r in records.values()),'estimateOnly':sum(bool(r.get('estimateOnly')) for r in records.values()),'supportOverrides':sum(bool(r.get('generatedSupports')) for r in records.values()),'withWarnings':sum(bool(r.get('warnings')) for r in records.values()),'elapsedSeconds':round(time.monotonic()-started),'active':list(ACTIVE.values()),'complete':pending==0}
 data={'version':1,'profile':profile,'updatedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'summary':summary,'records':records}
 atomic_json(BASE/'dist/estimates.json',data);atomic_json(RUN/'progress.json',summary)
 return summary

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--workers',type=int,default=2);parser.add_argument('--timeout',type=int,default=120);parser.add_argument('--limit',type=int);parser.add_argument('--retry-failed',action='store_true');parser.add_argument('--path');args=parser.parse_args()
 profile=prepare();atomic_json(RUN/'profile-summary.json',profile)
 cat=json.loads((BASE/'dist/catalog.json').read_text());files=[f for f in cat['files'] if f['path'].lower().endswith('.stl')]
 sample_names={'S3 Module 1F.stl','S3 Module 2F.stl','S3 Table Roof.stl','S3 Box 2F.stl','L3 Module 4F.stl','L3 Module 1F.stl','L3 Box 4F.stl','L3 Box 1F.stl','S2F (Turn On Supports).stl','L1F (Turn On Supports).stl','L4F (Turn On Supports).stl'}
 sample_paths={p['path'] for m in cat['modules'] if m['id'] in ['d-L3-4','d-L3-1','d-S3-2'] for p in m['parts']}
 core_paths={p['path'] for m in cat['modules'] for p in m['parts']}
 files.sort(key=lambda f:(0 if f['name']=='S3 Module 1F.stl' else 1 if f['path'] in sample_paths or f['name'] in sample_names else 2 if f['path'] in core_paths else 3,f['bytes']))
 if args.path:files=[f for f in files if args.path in f['path']]
 if args.limit:files=files[:args.limit]
 records={};pending=[]
 for f in files:
  path=RUN/'records'/(hashlib.sha256(f['path'].encode()).hexdigest()[:24]+'.json')
  old=json.loads(path.read_text()) if path.exists() else None
  stat=(LIB/f['path']).stat()
  if old and old.get('profileFingerprint')==profile['fingerprint'] and old.get('sourceBytes')==stat.st_size and old.get('sourceMtimeNs')==stat.st_mtime_ns and (old.get('status')=='ok' or not args.retry_failed):records[f['path']]=old
  else:pending.append(f)
 started=time.monotonic();publish(profile,files,records,started)
 print('START '+json.dumps({'files':len(files),'workers':args.workers,'profile':profile['id']}),flush=True)
 with ThreadPoolExecutor(max_workers=max(1,min(3,args.workers))) as pool:
  futures={pool.submit(slice_one,f,profile,args.timeout,args.retry_failed):f for f in pending}
  for future in as_completed(futures):
   f=futures[future]
   try:r=future.result()
   except Exception as e:r={'path':f['path'],'name':f['name'],'status':'failed','error':str(e)}
   records[f['path']]=r;s=publish(profile,files,records,started)
   print(json.dumps({'processed':s['processed'],'total':s['total'],'ok':s['ok'],'failed':s['failed'],'name':f['name'],'status':r['status'],'grams':r.get('grams'),'seconds':r.get('seconds'),'elapsed':s['elapsedSeconds']},ensure_ascii=False),flush=True)
 with (RUN/'all-model-estimates.csv').open('w',encoding='utf-8-sig',newline='') as output:
  w=csv.writer(output);w.writerow(['原始路径','状态','每份克重g','每份时间秒','每份线长m','需开启支撑提示','材料为TPU提示','错误'])
  for f in files:
   r=records[f['path']];w.writerow([f['path'],r['status'],r.get('grams',''),r.get('seconds',''),r.get('filamentMetres',''),r.get('needsSupport',False),r.get('materialMismatch',False),r.get('error','')])
 summary=publish(profile,files,records,started)
 if len(files)==733 and not summary['failed']:subprocess.run([sys.executable,str(BASE/'tools/audit_estimates.py')],check=True)
 print('DONE '+json.dumps(summary,ensure_ascii=False),flush=True)
if __name__=='__main__':main()
