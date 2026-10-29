import fs from 'node:fs';
import assert from 'node:assert/strict';
import {fitPart,printerBOM} from '../dist/printers.mjs';
import {makeBOM} from '../dist/core.mjs';
import {partName} from '../dist/i18n.mjs';
const load=file=>JSON.parse(fs.readFileSync(new URL('../dist/'+file,import.meta.url)));
const catalog=load('catalog.json'),geometry=load('geometry.json'),data=load('printers.json');
const test=(size,volume,options)=>fitPart('part',{volume},{records:{part:{size}}},options);
assert.equal(test([200,100,50],[200,100,50]).status,'fits');
assert.equal(test([200.001,100,50],[200,100,50]).status,'oversize');
assert.equal(test([210,300,50],[325,220,325]).status,'rotate');
assert.equal(test([100,100,300],[325,320,180]).status,'reorient');
assert.equal(test([100,100,300],[325,320,180],{reorient:true}).allowed,true);
assert.equal(test([199,100,50],[200,150,150],{margin:3}).status,'oversize');
assert.equal(test([501,501,501],[420,420,500]).status,'oversize');
assert.equal(fitPart('missing',{volume:[500,500,500]},geometry).status,'unknown');
assert.equal(test([NaN,2,3],[500,500,500]).status,'unknown');
const fixture={records:{part:{size:[100,100,300]}}};
let report=printerBOM({parts:[{path:'part',qty:4}]},{volume:[325,320,180]},fixture);
assert.equal(report.blockedFiles,1);assert.equal(report.blockedCopies,4);
report=printerBOM({parts:[{path:'part',qty:4}]},{volume:[325,320,180]},fixture,{reorient:true});
assert.equal(report.blockedFiles,0);assert.equal(report.reorient,1);
const stls=catalog.files.filter(f=>/\.stl$/i.test(f.path));
assert.equal(stls.length,733);assert.equal(Object.keys(geometry.records).length,733);
for(const f of stls){
 const g=geometry.records[f.path];assert.equal(g.sourceBytes,f.bytes);assert(g.size.every(n=>n>0&&Number.isFinite(n)));
 const zh=partName(f);assert(/[\u4e00-\u9fff]/.test(zh),'No Chinese name: '+f.path);
 const words=zh.replace(/(?:XL|S|M|L|x)\d*[Ff]?[²]?|\d[-–\d]*[Ff]|TPU|mm/gi,'');
 assert(!/[a-z]/i.test(words),'Untranslated word: '+zh);
 for(const printer of data.printers)assert.notEqual(fitPart(f.path,printer,geometry).status,'unknown');
}
assert(data.printers.length>=28);assert.equal(new Set(data.printers.map(p=>p.id)).size,data.printers.length);
const arco=data.printers.find(p=>p.id==='phrozen-arco');assert.equal(arco.brand,'普罗森');assert.equal(arco.name,'Arco');assert.deepEqual(arco.volume,[300,300,300]);
assert.equal(fitPart('part',arco,{records:{part:{size:[300,300,300]}}}).status,'fits');
assert.equal(fitPart('part',arco,{records:{part:{size:[301,300,300]}}}).status,'oversize');
assert.deepEqual(data.printers.find(p=>p.id==='h2d').volume,[325,320,325]);
assert.deepEqual(data.printers.find(p=>p.id==='h2d-dual').volume,[300,320,325]);
assert(data.printers.filter(p=>p.id!=='phrozen-arco').every(p=>/^https:\/\//.test(p.source)));
assert.equal(arco.source,null);
let cases=0;
for(const m of catalog.modules)for(const roof of m.kind==='drawer'?Object.keys(m.roofs):['Table']){
 const state={items:[{id:'one',model:m.id,x:0,y:0,roof,grid:true,rails:true}],extras:[],overrides:{}};
 const bom=makeBOM(state,catalog);
 for(const p of data.printers){const result=printerBOM(bom,p,geometry);assert.equal(result.unknown,0);assert.equal(result.parts.length,bom.parts.length);}
 cases++;
}
// A tall stack still fits when its individual parts fit, and covered roofs disappear.
const stack={items:[0,1,2,3,4,5,6,7].map((n)=>({id:''+n,model:'d-S3-1',x:0,y:48*n})),extras:[],overrides:{}};
const h2d=data.printers.find(p=>p.id==='h2d'),bom=makeBOM(stack,catalog);
assert.equal(printerBOM(bom,h2d,geometry).blockedFiles,0);
assert.equal(bom.parts.filter(p=>p.role==='顶盖').reduce((n,p)=>n+p.qty,0),1);
const shell=bom.parts.find(p=>p.role==='柜体');stack.overrides[shell.path]=0;
assert(!printerBOM(makeBOM(stack,catalog),h2d,geometry).parts.some(p=>p.path===shell.path));
console.log(`Passed: 733 geometry records and translations; ${data.printers.length} printer modes; ${cases} recipe variants; rotations, margins, missing geometry, quantities and covered roofs.`);
