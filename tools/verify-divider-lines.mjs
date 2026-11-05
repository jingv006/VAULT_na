import fs from 'node:fs';
import assert from 'node:assert/strict';
import {matchDividerLine,snapDividerPoint,gridFor,maxHeight,dividerBOM,validPlan} from '../dist/divider-layout.mjs';
const data=JSON.parse(fs.readFileSync(new URL('../dist/dividers-data.json',import.meta.url)));
let cases=0;
for(const family of ['S','M','L','XL'])for(const depth of [3,4,5,6,7])for(const floor of family==='XL'?[1]:[1,2,4])for(const height of [20,34.5,82.5].filter(h=>h<=maxHeight(floor))){
 const spec={family,depth,floor},g=gridFor(spec,data),options={height};
 for(const [start,end,axis,n] of [
  [{x:0,y:2},{x:g.w,y:2},'h',g.w],
  [{x:g.w,y:2},{x:0,y:2},'h',g.w],
  [{x:2,y:0},{x:2,y:g.d},'v',g.d],
  [{x:2,y:g.d},{x:2,y:0},'v',g.d]]){
  const match=matchDividerLine(start,end,[],g,data,options);assert(match.valid);assert.equal(match.item.axis,axis);assert.equal(match.part.number,n);
  const plan={version:1,spec,height,pin:'loose',items:[{...match.item,id:'line'}]};assert(validPlan(plan,data));
  const bom=dividerBOM(plan,data);assert.equal(bom.find(p=>p.role==='divider').qty,1);assert.equal(bom.find(p=>p.role==='straight').qty,2);assert.equal(bom.find(p=>p.role==='loose').qty,2);cases++;
 }
}
const g={w:10,d:10},options={height:34.5};
const match=(a,b,items=[])=>matchDividerLine(a,b,items,g,data,options);
assert.deepEqual(snapDividerPoint({x:-2.2,y:10.9},g),{x:0,y:10});
assert.equal(match({x:.1,y:3.1},{x:7.8,y:4}).item.n,8);
assert.equal(match({x:0,y:3},{x:3,y:3}).item.n,5,'short lines visibly match the shortest official length');
assert(!match({x:8,y:3},{x:10,y:3}).valid,'do not invent unsupported short plates');
assert(!match({x:0,y:0},{x:10,y:0}).valid,'outer wall is not a divider');
assert(!match({x:2,y:2},{x:2,y:2}).valid);
assert(!match({x:NaN,y:2},{x:8,y:2}).valid);
const h={id:'h',axis:'h',n:10,x:0,y:5,border:'straight'};
assert(!match({x:0,y:5},{x:10,y:5},[h]).valid,'parallel overlap rejected');
assert(!match({x:5,y:0},{x:5,y:10},[h]).valid,'crossings rejected');
const joint=match({x:5,y:0},{x:5,y:5},[h]);assert(joint.valid,'T joint endpoint accepted');
const plan={version:1,spec:{family:'S',depth:3,floor:1},height:34.5,pin:'loose',items:[h,{...joint.item,id:'v'}]};
assert(validPlan(plan,data));const bom=dividerBOM(plan,data);
assert.equal(bom.find(p=>p.role==='straight').qty,3);assert.equal(bom.find(p=>p.role==='loose').qty,4);
console.log(`${cases} line/drawer/height cases passed; bidirectional matching, snap, minimum lengths, collision/T joints and exact BOM counts`);
