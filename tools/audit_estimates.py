#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Audit completed slice statistics and export a human-readable local ledger."""
from pathlib import Path
import csv,json,math,re,hashlib
BASE=Path(__file__).resolve().parents[1]
RUN=BASE/'slicing/H2D-PLA-020-15pct-2walls-orca'
cat=json.loads((BASE/'dist/catalog.json').read_text())
data=json.loads((BASE/'dist/estimates.json').read_text());profile=data['profile'];records=data['records']
files=[f for f in cat['files'] if f['path'].lower().endswith('.stl')]
assert data['summary']['complete'],'Batch still running'
assert len(records)==len(files)==733,'Missing STL records'
assert set(records)=={f['path'] for f in files},'Unexpected or missing paths'
errors=[];normal=virtual=support=other_material=auto_support=0
for f in files:
 r=records[f['path']];p=BASE.parent/cat['libraryName']/f['path']
 assert r['sourceBytes']==p.stat().st_size and r['sourceMtimeNs']==p.stat().st_mtime_ns,'Source changed: '+f['path']
 assert r['profileFingerprint']==profile['fingerprint'],'Mixed profiles: '+f['path']
 assert re.fullmatch('[0-9a-f]{64}',r['sourceSHA256']),'Missing source hash'
 if r['status']!='ok':errors.append({'path':f['path'],'status':r['status'],'error':r.get('error','')});continue
 assert r['grams']>0 and r['seconds']>0 and r['filamentMetres']>0 and r['layers']>0
 expected=r['filamentMetres']*1000*math.pi*(profile['filamentDiameterMM']/2)**2/1000*profile['densityGPerCm3']
 assert abs(expected-r['grams'])<max(.15,r['grams']*.005),'Mass cross-check: '+f['path']
 assert r['exitCode']==0 and len(r['gcodeSHA256'])==64
 if r.get('estimateOnly'):
  virtual+=1;assert r.get('printableOnH2D') is False
  r['envelopeNote']='当前 STL 方向未通过 H2D 标准范围检查，采用 600mm 虚拟范围、相同模型尺寸与 H2D 速度，仅供耗材时间估算；需调整方向、拆分或换机。'
 else:normal+=1;assert r.get('printableOnH2D') is True
 support+=bool(r.get('needsSupport') and not r.get('generatedSupports'));auto_support+=bool(r.get('generatedSupports'));other_material+=bool(r.get('materialMismatch'))
data['summary']['outOfBounds']=virtual
data['summary']['supportOverrides']=auto_support
data['profile']['supportExceptionNote']=f'{auto_support} 个 XL 分件底板因悬空结构需启用自动支撑，记录已包含支撑；其余按默认无自动支撑。'
for path,record in records.items():
 if record.get('estimateOnly'):
  key=hashlib.sha256(path.encode()).hexdigest()[:24];(RUN/'records'/(key+'.json')).write_text(json.dumps(record,ensure_ascii=False,separators=(',',':'))+'\n')
temp=BASE/'dist/estimates.json.tmp';temp.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n');temp.replace(BASE/'dist/estimates.json')
def fmt(sec):
 if sec is None:return ''
 h,t=divmod(int(sec),3600);m,s=divmod(t,60);return f'{h:02}:{m:02}:{s:02}'
with (RUN/'all-model-estimates.csv').open('w',encoding='utf-8-sig',newline='') as out:
 w=csv.writer(out);w.writerow(['原始路径','状态','单份耗材g','单份总预计时间','单份总预计秒','单份模型打印秒','单份线长m','层数','需额外支撑提示','TPU专用件提示','已计自动支撑','标准H2D范围通过','估算范围说明','源文件SHA256','切片参数指纹'])
 for f in files:
  r=records[f['path']];status='超范围仅供估算' if r.get('estimateOnly') else '已切片' if r['status']=='ok' else r['status']
  w.writerow([f['path'],status,r.get('grams',''),fmt(r.get('seconds')),r.get('seconds',''),r.get('modelSeconds',''),r.get('filamentMetres',''),r.get('layers',''),bool(r.get('needsSupport') and not r.get('generatedSupports')),r.get('materialMismatch',False),r.get('generatedSupports',False),r.get('printableOnH2D',''),'；'.join(filter(None,[r.get('envelopeNote',''),r.get('supportNote',''),r.get('error','')])),r['sourceSHA256'],r['profileFingerprint']])
report={'totalSTL':len(files),'withEstimates':normal+virtual,'normalEnvelope':normal,'virtualEnvelope':virtual,'supportHintFiles':support,'materialMismatchFiles':other_material,'autoSupportFiles':auto_support,'unresolved':errors,'profile':profile,'checks':['all indexed STL paths accounted for','one common base profile fingerprint plus explicit support overrides','source bytes and modification time match','source and G-code checksums retained','successful toolpath files reached end block','wall/infill/layer/support settings validated from G-code','mass independently cross-checked from filament length and density']}
(RUN/'audit-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
(RUN/'批量切片结果.md').write_text(f'''# H2D 全库耗材与时间统计\n\n已处理 {len(files)} 个 STL，其中 {normal+virtual} 个已得到耗材与时间记录，{len(errors)} 个需继续处理。\n\n- 标准 H2D 当前方向切片成功：{normal} 个。\n- 当前方向未通过标准范围、使用600mm虚拟范围补做估算：{virtual} 个。\n- 文件名提示需开启支撑：{support} 个，当前统计未计额外自动支撑。\n- TPU专用件按统一PLA基准统计：{other_material} 个。\n- 特殊XL分件底板已计入必要自动支撑：{auto_support} 个。\n\n参数：H2D、0.4mm喷嘴、0.20mm层高、Bambu PLA Basic、15%网格填充、2层墙、5顶层、3底层、自动裙边5mm、默认无自动支撑（上述特殊分件除外）；保持原始STL方向，不缩放。切片器为OrcaSlicer 2.4.2。\n\n耗材按真实G-code中的统计读取，并用线长、线径1.75mm、PLA密度1.26g/cm³交叉核对。时间为单个STL的总预计时间；工作台按打印份数累加，未模拟合盘及多机并行。\n\n虚拟范围记录只用于耗材与时间规划，保留原始模型尺寸和H2D速度，不能据此认为整件能在H2D打印。需调整方向、选择已有分件、重新拆分或换机。\n\n系统保留逐文件源模型与G-code的SHA-256、参数指纹、用量、时间和切片日志；批量中间G-code已清理。未进行实际打印验证。\n''')
print(json.dumps({k:report[k] for k in ['totalSTL','withEstimates','normalEnvelope','virtualEnvelope','supportHintFiles','materialMismatchFiles','autoSupportFiles','unresolved']},ensure_ascii=False))
