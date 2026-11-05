# -*- coding: utf-8 -*-
"""Cross-check browser/server BOMs and inspect a real lossless divider 3MF."""
from pathlib import Path
from collections import Counter
import copy, json, os, subprocess, sys, tempfile, zipfile, xml.etree.ElementTree as E
BASE=Path(__file__).resolve().parents[1];sys.path.insert(0,str(BASE))
import divider_service as service
import kit_service as kits

script="""
import fs from 'node:fs';
import {dividerBOM,gridFor,maxHeight} from './dist/divider-layout.mjs';
const data=JSON.parse(fs.readFileSync('dist/dividers-data.json'));const result=[];
for(const family of ['S','M','L','XL'])for(const depth of [3,4,5,6,7])for(const floor of family==='XL'?[1]:[1,2,4])for(const height of [20,34.5,82.5].filter(n=>n<=maxHeight(floor)))for(const border of ['straight','rounded','none']){
 const spec={family,depth,floor},g=gridFor(spec,data);
 const plan={version:1,spec,height,pin:border==='rounded'?'tight':'loose',items:[
  {id:'a',axis:'h',n:g.w,x:0,y:5,border},{id:'b',axis:'v',n:5,x:5,y:0,border}]};
 result.push({plan,rows:dividerBOM(plan,data).map(p=>({path:p.path,qty:p.qty}))});
}console.log(JSON.stringify(result));
"""
fixtures=json.loads(subprocess.check_output([os.environ.get('NODE','node'),'--input-type=module','-e',script],cwd=BASE))
for fixture in fixtures:
    spec=service.specification({'plan':fixture['plan']});rows=service.recipe(spec)
    assert {r['path']:r['qty'] for r in rows}=={r['path']:r['qty'] for r in fixture['rows']}
    assert all(r['slot'] in ('light','orange') for r in rows)

plan=fixtures[0]['plan']
bad=[]
for change in [lambda p:p['items'][0].update(x=-1),lambda p:p['items'][0].update(y=0),
               lambda p:p['items'][0].update(n=4),lambda p:p['items'][1].update(id='a'),
               lambda p:p['items'][1].update(x=2,y=2,n=10),lambda p:p.update(items=[]),
               lambda p:p['items'][0].update(x=.5),lambda p:p.update(height=82.5),
               lambda p:p.update(items=p['items']+[dict(p['items'][0],id='overlap')])]:
    p=copy.deepcopy(plan);change(p);bad.append(p)
for p in bad:
    try:service.specification({'plan':p})
    except ValueError:pass
    else:raise AssertionError('Invalid layout accepted: '+repr(p))

colours={'light':'#62937A','dark':'#454749','orange':'#F58238','label':'#F4F2EB'}
spec=service.specification({'plan':plan,'colours':colours});rows=service.recipe(spec)
with tempfile.TemporaryDirectory(prefix='vault-divider-3mf-') as folder:
    target=Path(folder)/'dividers.3mf';job={'id':'test','target':str(target),'total':len(rows)}
    service.generate(job,spec,rows)
    assert job['status']=='done',job
    with zipfile.ZipFile(target) as z:
        assert z.testzip() is None
        manifest=json.loads(z.read('Metadata/vault_manifest.json'))
        assert json.loads(z.read('Metadata/隔板方案.json'))==spec['plan']
        assert manifest['module']=='divider-layout' and manifest['layout']==spec['plan']
        expected=Counter({r['path']:r['qty'] for r in rows})
        instances=[o for p in manifest['plates'] for o in p['objects']]
        assert Counter(o['path'] for o in instances)==expected
        assert len(instances)==9 and len(manifest['parts'])==4
        xml=E.fromstring(z.read('3D/3dmodel.model'));ns={'c':kits.CORE}
        assert len(xml.findall('c:build/c:item',ns))==9
        meshes=xml.findall('c:resources/c:object/c:mesh',ns);assert len(meshes)==4
        assert len({o.attrib['id'] for o in xml.findall('c:resources/c:object',ns)})==13
        for row in manifest['parts']:
            # mesh_cache retains original facet count; all copies reference that mesh.
            import struct
            with (kits.LIB/row['path']).open('rb') as source:header=source.read(84)
            assert row['mesh']['triangles']==struct.unpack('<I',header[80:84])[0]
        settings=json.loads(z.read('Metadata/project_settings.config'))
        assert settings['filament_colour']==list(colours.values())
        assert settings['wall_loops']=='2' and settings['sparse_infill_density']=='15%'
        E.fromstring(z.read('Metadata/model_settings.config'))
        # Plate coordinates use separate origins; each normal plate stays within the bed.
        for plate in manifest['plates']:
            assert not plate['needsReview']
        assert b'\xef\xbb\xbf'==z.read('Metadata/打印清单.csv')[:3]
print(f'{len(fixtures)} JS/Python divider BOMs matched; invalid layouts rejected; real 3MF has 9 exact copies, 4 lossless meshes, colour plates, profile, plan and manifest')
