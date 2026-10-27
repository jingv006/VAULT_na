from pathlib import Path
import json
BASE=Path(__file__).resolve().parent
VENDOR=Path('/Applications/BambuStudio.app/Contents/Resources/profiles/BBL')
def resolve(name,kind,chain=None):
 p=VENDOR/kind/(name+'.json')
 d=json.loads(p.read_text())
 parents=[];out={}
 if d.get('inherits'):
  out,parents=resolve(d['inherits'],kind)
 out.update(d);out.pop('inherits',None)
 return out,parents+[name]
summary={'slicer':'BambuStudio-02.08.02.61','sourceSTL':'01. DRAWERS/01. S Families/S3/Modules/S3 Module 1F.stl','orientation':'原始 STL 方向，自动排盘但不自动旋转','profiles':{}}
for kind,name in [('machine','Bambu Lab P2S 0.4 nozzle'),('process','0.20mm Standard @BBL P2S'),('filament','Bambu PLA Basic @BBL P2S')]:
 data,chain=resolve(name,kind)
 if kind=='process':data.update({'sparse_infill_density':'15%','wall_loops':'2'})
 (BASE/(kind+'.json')).write_text(json.dumps(data,ensure_ascii=False,indent=2))
 keys=['nozzle_diameter','layer_height','initial_layer_print_height','sparse_infill_density','wall_loops','sparse_infill_pattern','top_shell_layers','top_shell_thickness','bottom_shell_layers','bottom_shell_thickness','enable_support','support_type','filament_density','filament_diameter','filament_flow_ratio','brim_type','brim_width','curr_bed_type']
 summary['profiles'][kind]={'name':name,'inheritance':chain,'settings':{k:data[k] for k in keys if k in data}}
(BASE/'settings-summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2))
print(json.dumps(summary,ensure_ascii=False,indent=2))
