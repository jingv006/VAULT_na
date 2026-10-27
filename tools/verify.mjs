import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeBOM,validate,bounds,validatePlan,packEntries} from '../dist/core.mjs';
import {writeZip} from '../dist/zip.mjs';
const c=JSON.parse(fs.readFileSync(new URL('../dist/catalog.json',import.meta.url))), lookup=Object.fromEntries(c.modules.map(m=>[m.id,m]));
assert.equal(c.stlCount,733);assert.equal(c.modules.length,160);
for(const m of c.modules){const s={items:[{id:'a',model:m.id,x:0,y:0,roof:'Table',grid:true,rails:true}],extras:[],overrides:{}};const b=makeBOM(s,c);assert(b.parts.length>8,m.id);for(const p of b.parts)assert(fs.existsSync(new URL('../../261021_VAULT_USSA_S/'+p.path,import.meta.url)),p.path);}
const sample={version:1,title:'回归测试',items:[{id:'a',model:'d-L3-4',x:0,y:0},{id:'b',model:'d-L3-1',x:0,y:192},{id:'c',model:'d-S3-2',x:0,y:240},{id:'d',model:'d-S3-2',x:164.8,y:240}],extras:[],overrides:{}};
assert.deepEqual(validate(sample.items,lookup),[]);assert.equal(bounds(sample.items,lookup).height,336);
const bom=makeBOM(sample,c),roof=bom.parts.filter(p=>p.role==='顶盖');assert.equal(roof.length,1);assert.equal(roof[0].qty,2);assert.equal(bom.parts.find(p=>p.name==='Springs.stl').qty,4);assert.equal(bom.parts.find(p=>p.name==='x3 Runner Slide.stl').qty,18);assert.equal(bom.hardware[0].qty,36);
const bad=structuredClone(sample);bad.items[3].x=150;assert(validate(bad.items,lookup).some(w=>w.type==='collision'));bad.items[3].x=500;assert(validate(bad.items,lookup).some(w=>w.type==='support'));
assert.throws(()=>validatePlan({...sample,items:[{model:'../../outside',x:0,y:0}]},c));assert.throws(()=>validatePlan({...sample,items:[{model:'d-S3-1',x:-1,y:0}]},c));
const twin=makeBOM({items:[{id:'a',model:'d-L3-1-twin',x:0,y:0}],extras:[],overrides:{}},c);assert.equal(twin.parts.find(p=>p.name==='S3 Box 1F.stl').qty,2);assert.equal(twin.parts.find(p=>p.name==='L3² Module 1F.stl').qty,1);
const entries=packEntries(bom,true);assert.equal(entries.length,bom.copies);assert.equal(new Set(entries.map(e=>e.name)).size,entries.length);
const chunks=[];const blobs=[new Blob(['你好 VAULT']),new Blob([new Uint8Array(100000).fill(42)])];await writeZip(blobs.map((b,i)=>({name:['打印清单.csv','模型.stl'][i],size:b.size,stream:()=>b.stream()})),{write:b=>chunks.push(b),close:async()=>{}});fs.mkdirSync(new URL('../tmp/',import.meta.url),{recursive:true});fs.writeFileSync(new URL('../tmp/browser-test.zip',import.meta.url),Buffer.concat(chunks));
console.log(JSON.stringify({modules:c.modules.length,stls:c.stlCount,sample:{modules:4,height:336,uniqueFiles:bom.parts.length,printCopies:bom.copies,bytes:bom.bytes},tests:'All recipe files, mixed stacks, collisions, support, twin drawers, import rejection and streaming ZIP passed'}));
