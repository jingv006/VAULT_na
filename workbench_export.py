# -*- coding: utf-8 -*-
"""Complete module projects, each stored once with a print-N set count."""
from collections import Counter, OrderedDict
from pathlib import Path
import csv, io, time
import kit_service as kits

ROOFS={'Table':'平面顶盖','Grid':'网格顶盖','Bowl':'托盘顶盖',
       'Under Table Mount':'桌下安装','none':'不含顶盖','Whole':'一体翻盖','Split':'分体翻盖','Lid':'标准翻盖'}

def validate(payload):
    groups=payload.get('kitGroups')
    if not isinstance(groups,list) or not groups or len(groups)>500:
        raise ValueError('请先添加组合模块，再导出整合 3MF')
    merged=OrderedDict();expected=Counter();total=0
    for group in groups:
        qty=group['qty']
        if type(qty) is not int or not 1<=qty<=500:raise ValueError('模块套数无效')
        total+=qty
        if total>500:raise ValueError('最多导出 500 个模块')
        spec=kits.specification(group['spec'])
        key=repr(spec)
        if key in merged:merged[key]['qty']+=qty
        else:merged[key]={'spec':spec,'qty':qty}
        for row in kits.recipe(spec):expected[row['path']]+=row['qty']*qty
    extras=payload.get('extraParts',[])
    if not isinstance(extras,list) or len(extras)>len(kits.FILES):raise ValueError('备用件无效')
    extra_counts=Counter()
    for row in extras:
        if row['path'] not in kits.FILES or type(row['qty']) is not int or not 1<=row['qty']<=999:
            raise ValueError('备用件路径或数量无效')
        extra_counts[row['path']]+=row['qty']
    expected.update(extra_counts)
    actual={r['path']:r['qty'] for r in payload['parts']}
    if dict(expected)!=actual:
        raise ValueError('3MF 模块配方与打印清单不一致，请恢复手动修改的零件数量后重试')
    return list(merged.values()),[{'path':path,'qty':qty} for path,qty in extra_counts.items()]

def filename(spec,qty):
    # A project contains ONE module's parts. print-N counts complete module sets.
    m=kits.MODULES[spec['model']]
    roof=ROOFS[spec['roof']] if m['kind']=='drawer' or spec['roof']!='none' else ROOFS.get(m.get('defaultLid'),'标准翻盖')
    stem=Path(kits.filename(spec)).stem
    options=[roof]+(['网格底板'] if spec['grid'] else [])+(['加强齿条'] if spec['rails'] else [])
    return '3MF/'+stem+'_'+'_'.join(options)+f'__print-{qty}.3mf'

def prepare(groups,job):
    result=[]
    job.update(phase='kits',unit='kits',done=0,total=len(groups),status='preparing')
    for index,group in enumerate(groups):
        project=kits.request(group['spec'])
        while project['status'] not in ('done','error'):
            job.update(current=f"{index+1}/{len(groups)} · {kits.code(kits.MODULES[group['spec']['model']])} · {project.get('current','准备 3MF')}")
            time.sleep(.25)
        if project['status']=='error':raise ValueError(project.get('error','3MF 生成失败'))
        result.append({**group,'name':filename(group['spec'],group['qty']),'target':Path(project['target'])})
        job.update(done=index+1,current='已整理 '+result[-1]['name'])
    return result

def manifest(projects):
    out=io.StringIO();writer=csv.writer(out)
    writer.writerow(['3MF 文件','型号','打印套数','单套说明','顶盖','网格底板','加强齿条','配色'])
    for p in projects:
        spec=p['spec'];writer.writerow([p['name'],kits.code(kits.MODULES[spec['model']]),p['qty'],
            '工程内为一套模块所需零件；整份工程打印指定套数',spec['roof'],spec['grid'],spec['rails'],str(spec['colours'])])
    return out.getvalue().encode('utf-8-sig')
