import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gridFor,fits,dividerBOM,validPlan} from '../dist/divider-layout.mjs';
const d=JSON.parse(fs.readFileSync(new URL('../dist/dividers-data.json',import.meta.url))),cat=JSON.parse(fs.readFileSync(new URL('../dist/catalog.json',import.meta.url)));
assert.equal(d.parts.length,92);for(const p of d.parts)assert(cat.files.some(f=>f.path===p.path&&f.bytes===p.bytes));
let cases=0;
for(const family of ['S','M','L','XL'])for(const depth of [3,4,5,6,7])for(const floor of family==='XL'?[1]:[1,2,4])for(const height of [20,34.5,82.5].filter(h=>h<=(floor===1?34.5:82.5))){
 const spec={family,depth,floor},g=gridFor(spec,d),item={id:'a',n:g.w,axis:'h',x:0,y:Math.floor(g.d/2),border:'straight'},plan={version:1,spec,height,pin:'loose',items:[item]};
 assert(validPlan(plan,d));const rows=dividerBOM(plan,d);assert.equal(rows.find(p=>p.role==='straight').qty,2);assert.equal(rows.find(p=>p.role==='loose').qty,2);assert.equal(rows.find(p=>p.role==='divider').number,g.w);
 assert(!fits({...item,x:1},[],g));assert(!fits({...item,y:0},[],g));assert(!fits({...item,id:'overlap'},[item],g));
 const v={id:'v',n:g.d,axis:'v',x:Math.floor(g.w/2),y:0,border:'rounded'};assert(fits(v,[],g));assert(!fits(v,[item],g));
 assert(!validPlan({...plan,items:[{...item,n:4}]},d));assert(!validPlan({...plan,pin:'bad'},d));cases++;
}
const g={w:10,d:10},h={id:'h',n:10,axis:'h',x:0,y:5,border:'straight'};assert(fits({id:'v',n:5,axis:'v',x:5,y:5},[h],g));
console.log(`${cases} drawer/height combinations; official paths, full-width BOM, pins, edges, rotations, overlap/crossing rejection and T joints passed`);
