import fs from 'node:fs';
import assert from 'node:assert/strict';
import {moduleExport} from '../dist/module-export.mjs';
import {makeBOM} from '../dist/core.mjs';
import {DEFAULT_COLOURS} from '../dist/palette-store.mjs';
const cat=JSON.parse(fs.readFileSync(new URL('../dist/catalog.json',import.meta.url)));
const items=Array.from({length:3},(_,n)=>({id:'box-'+n,model:'d-S3-1',x:n*164.8,y:0,roof:'Table',color:['#123456','#abcdef','#fedcba'][n]}));
const state={version:1,title:'3 套 S3F1',items,extras:[],overrides:{}};
const fixtures=[];
function payload(plan){const result=moduleExport(plan,cat,DEFAULT_COLOURS);const out={mode:'kits',parts:makeBOM(plan,cat).parts.map(p=>({path:p.path,qty:p.qty})),kitGroups:result.groups,extraParts:result.extras,plan};fixtures.push(out);return result;}
const three=payload(state);
assert.equal(three.groups.length,1);assert.equal(three.groups[0].qty,3);
assert.deepEqual(three.groups[0].spec.colours,DEFAULT_COLOURS,'pastel item colours do not fragment production projects');
const stacked=payload({...state,items:items.map((p,n)=>({...p,x:0,y:n*48}))});
assert.deepEqual(stacked.groups.map(g=>[g.spec.roof,g.qty]),[['none',2],['Table',1]],'covered roofs are not overprinted');
assert.equal(payload({...state,items:items.map((p,n)=>({...p,grid:n===0,rails:n===1}))}).groups.length,3);
const extra=cat.files.find(f=>f.path.endsWith('/Runner Stopper.stl')).path;
const withExtras=payload({...state,extras:[{path:extra,qty:2},{path:extra,qty:3}]});
assert.deepEqual(withExtras.extras,[{path:extra,qty:5}]);
const first=makeBOM(state,cat).parts[0];
assert.throws(()=>moduleExport({...state,overrides:{[first.path]:first.qty-1}},cat,DEFAULT_COLOURS),/手动修改/);
assert.equal(payload({...state,overrides:{[first.path]:first.qty}}).groups[0].qty,3);
for(const model of ['s-S6-2-standard','d-L3-2-twin','d-XL3-1']){
 payload({...state,items:[{...items[0],model,roof:model.startsWith('s-')?'Whole':'Grid',grid:true,rails:false}]});
}
fs.mkdirSync(new URL('../tmp/',import.meta.url),{recursive:true});
fs.writeFileSync(new URL('../tmp/module-export-fixtures.json',import.meta.url),JSON.stringify(fixtures));
console.log('Module export grouping passed: 3 identical kits, covered roofs, accessories, colours, extras, overrides, flip/twin/XL variants');
