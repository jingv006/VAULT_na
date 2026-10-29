import assert from 'node:assert/strict';
import fs from 'node:fs';
import {insertModule,validate,bounds,makeBOM} from '../dist/core.mjs';
const cat=JSON.parse(fs.readFileSync(new URL('../dist/catalog.json',import.meta.url)));
const lookup=Object.fromEntries(cat.modules.map(m=>[m.id,m]));
const base=[{id:'bottom',model:'d-L3-4',x:0,y:0},{id:'middle',model:'d-L3-1',x:0,y:192},{id:'top',model:'d-L3-2',x:0,y:240}];
const move=(items,id,x,probeY)=>insertModule({...items.find(i=>i.id===id),x,y:Math.max(0,probeY-lookup[items.find(i=>i.id===id).model].height/2)},items,lookup,{probeY});
const positions=items=>Object.fromEntries(items.map(i=>[i.id,i.y]));
const original=JSON.stringify(base);
let result=move(base,'top',0,10);
assert.deepEqual(positions(result.items),{bottom:96,middle:288,top:0});assert.equal(result.insertion.y,0);assert.deepEqual(validate(result.items,lookup),[]);
result=move(base,'top',0,200);
assert.deepEqual(positions(result.items),{bottom:0,middle:288,top:192});assert.deepEqual(validate(result.items,lookup),[]);
result=move(base,'middle',0,320);
assert.deepEqual(positions(result.items),{bottom:0,middle:288,top:192});assert.deepEqual(validate(result.items,lookup),[]);
result=move(base,'bottom',0,320);
assert.deepEqual(positions(result.items),{bottom:144,middle:0,top:48});assert.deepEqual(validate(result.items,lookup),[]);
assert.equal(JSON.stringify(base),original,'Preview must not mutate drag-start state');
assert.deepEqual(positions(move(base,'bottom',0,90).items),positions(base),'Own slot is a stable placeholder');
const left=[{id:'a',model:'d-S3-1',x:0,y:0},{id:'b',model:'d-S3-2',x:0,y:48},{id:'c',model:'d-S3-4',x:0,y:144}];
const right=[{id:'r0',model:'d-S3-2',x:164.8,y:0},{id:'r1',model:'d-S3-1',x:164.8,y:96}];
result=move([...left,...right],'c',0,10);
for(const a of right)assert.deepEqual(result.items.find(i=>i.id===a.id),a,'Independent column must not move');
result=move([...left,...right],'b',164.8,10);
assert.deepEqual(positions(result.items),{a:0,b:0,c:48,r0:96,r1:192});
// This legacy geometry-only fixture omits a wide ground base. Its insertion
// remains collision-free, while the new assembly validator reports that base.
assert.deepEqual(validate(result.items,lookup).filter(w=>w.type!=='foundation'),[]);assert.equal(validate(result.items,lookup).filter(w=>w.type==='foundation').length,1);
// A bridge propagates lifting into the other half of the stack, without moving
// the other base at the same height or pushing touching horizontal neighbors.
const bridge=[{id:'a',model:'d-S3-1',x:0,y:0},{id:'b',model:'d-S3-1',x:164.8,y:0},{id:'wide',model:'d-L3-1',x:0,y:48},{id:'l',model:'d-S3-2',x:0,y:96},{id:'r',model:'d-S3-2',x:164.8,y:96}];
result=move(bridge,'l',0,10);
assert.deepEqual(positions(result.items),{a:96,b:0,wide:144,l:0,r:192});assert(!validate(result.items,lookup).some(w=>w.type==='collision'));
// New library modules use exactly the same insertion behavior.
const fresh={id:'new',model:'d-L3-1',x:0,y:0};
result=insertModule(fresh,base,lookup,{probeY:10});
assert.deepEqual(positions(result.items),{bottom:48,middle:240,top:288,new:0});assert.deepEqual(validate(result.items,lookup),[]);
const away=move(base,'middle',500,30);
assert.deepEqual(positions(away.items),{bottom:0,middle:0,top:192});assert.equal(away.insertion,null,'No insertion into a distant column');
// Every permutation of mixed-height source and target slots must remain a
// collision-free, fully supported stack with the same total module height.
let cases=0;
for(const floors of [[1,2,4],[4,1,2],[2,4,1],[1,4,2,1]]){
 let y=0;const items=floors.map((f,k)=>{const a={id:'i'+k,model:'d-L3-'+f,x:0,y};y+=lookup[a.model].height;return a;});
 for(const source of items)for(const target of items)if(target.id!==source.id)for(const fraction of [.2,.8]){
  const r=move(items,source.id,0,target.y+lookup[target.model].height*fraction);
  assert.deepEqual(validate(r.items,lookup),[],JSON.stringify({source,target,fraction,result:r.items}));assert.equal(bounds(r.items,lookup).height,y);
  assert.equal(makeBOM({items:r.items,extras:[],overrides:{}},cat).hardware.reduce((a,h)=>a+h.qty,0),makeBOM({items,extras:[],overrides:{}},cat).hardware.reduce((a,h)=>a+h.qty,0));cases++;
 }
}
console.log(`Insertion checks passed: top → bottom, middle, bottom → top, source gap, independent columns, bridges, library drops, no input mutation, ${cases} mixed-height reorder cases.`);
