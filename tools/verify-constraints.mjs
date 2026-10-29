import assert from 'node:assert/strict';
import fs from 'node:fs';
import {constrainLayout,constrainedInsert} from '../dist/constraints.mjs';
import {validate} from '../dist/core.mjs';
import {randomLayout} from '../dist/random-layout.mjs';
const cat=JSON.parse(fs.readFileSync(new URL('../dist/catalog.json',import.meta.url))),lookup=Object.fromEntries(cat.modules.map(m=>[m.id,m]));
const item=(id,model,x,y)=>({id,model,x,y,color:'#00264d',roof:'Table',grid:true});
const screenshot=[item('base','d-L3-2-twin',0,0),item('l1','d-S3-1',0,96),item('l2','d-S3-1',0,144),item('l3','d-S3-1',0,192),item('r1','d-S3-2',164.8,125),item('r2','d-S3-1',164.8,221),item('wide','d-L3-2',0,269),item('top','d-L3-1',0,365)];
const before=structuredClone(screenshot),fixed=constrainLayout(screenshot,lookup);
assert.deepEqual(screenshot,before,'normalising never mutates input');
assert.deepEqual(fixed.map(a=>a.y),[0,96,144,192,96,192,240,336]);assert.deepEqual(validate(fixed,lookup),[]);
assert.deepEqual(constrainLayout(fixed,lookup),fixed,'normalisation is stable');
assert(fixed.every((a,k)=>a.model===before[k].model&&a.color===before[k].color&&a.grid===before[k].grid));
const overlapping=[item('a','d-S3-2',0,0),item('b','d-S3-1',4,28),item('c','d-S3-4',0,150)];
assert.deepEqual(validate(constrainLayout(overlapping,lookup),lookup),[]);
const oneColumn=[item('base','d-L3-4',0,0),item('middle','d-L3-1',0,192),item('top','d-L3-2',0,240)];
const moved=constrainedInsert({...oneColumn[2],y:0},oneColumn,lookup,{probeY:10});
assert.deepEqual(moved.items.map(a=>a.y),[96,288,0]);assert.equal(moved.rejected,false);assert.deepEqual(validate(moved.items,lookup),[]);
// Horizontal gaps/partial overlaps cannot survive a drop, even well outside
// the former 10mm threshold. A far-up drop lands on the top contact surface.
for(const x of [12,35,151,180,220,320,350,500]){
 const r=constrainedInsert({...oneColumn[1],x,y:500},oneColumn,lookup,{probeY:500});
 assert.deepEqual(validate(r.items,lookup),[]);assert(r.items.every(a=>a.y%48===0));
}
const bridge=[item('a','d-S3-1',0,0),item('b','d-S3-1',164.8,0),item('wide','d-L3-1',0,48),item('l','d-S3-2',0,96),item('r','d-S3-2',164.8,96)];
const rejected=constrainedInsert({...bridge[3],y:0},bridge,lookup,{probeY:10});
assert.equal(rejected.rejected,true);assert.deepEqual(rejected.items,bridge,'reject an insertion leaving a bridge partly floating');
const repairedBridge=validate(constrainLayout(bridge.filter(a=>a.id!=='b'),lookup),lookup);
assert.deepEqual(repairedBridge.filter(w=>w.type!=='foundation'),[],'gravity repairs geometry without inventing a missing base');assert(repairedBridge.some(w=>w.type==='foundation'));
let seed=12345;const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/2**32);
let cases=0;
for(const family of ['S','M','L','XL'])for(const kind of ['drawer','sustainer','mixed'])for(let n=0;n<20;n++){
 let items=randomLayout(cat,{family,kind,depth:3+n%5,totalF:1+n%16},rand);
 assert.deepEqual(constrainLayout(items,lookup),items,'valid layouts retain exact placements');
 for(let move=0;move<10;move++){
  const current=items[Math.floor(rand()*items.length)],original=structuredClone(items),probeY=rand()*1000;
  const result=constrainedInsert({...current,x:rand()*700,y:probeY},items,lookup,{probeY});
  assert.deepEqual(items,original);assert.deepEqual(validate(result.items,lookup).filter(w=>w.type!=='depth'),[],JSON.stringify(result));
  assert.deepEqual(result.items.map(a=>[a.id,a.model,a.grid,a.roof,a.color]),items.map(a=>[a.id,a.model,a.grid,a.roof,a.color]));
  assert.deepEqual(constrainLayout(result.items,lookup),result.items,'committing a valid drag cannot change its preview');
  items=result.items;cases++;
 }
}
for(let n=0;n<100;n++){
 const scattered=Array.from({length:12},(_,k)=>item('free-'+k,cat.modules[Math.floor(rand()*cat.modules.length)].id,rand()*600,rand()*700));
 const fixed=constrainLayout(scattered,lookup);assert.deepEqual(validate(fixed,lookup).filter(w=>!['depth','foundation'].includes(w.type)),[]);
 assert.deepEqual(constrainLayout(fixed,lookup),fixed,'repair of arbitrary overlapping free placements is stable');
}
console.log(`Strong snapping: screenshot gaps, overlaps, complete support, stable repair, rejected bridges, top/bottom insertions and ${cases} repeated mixed-size drag cases passed`);
