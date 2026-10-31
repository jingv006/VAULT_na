import fs from 'node:fs';
import assert from 'node:assert/strict';
import {stackDimensions} from '../dist/stack-dimensions.mjs';
import {measureAssembly} from '../dist/assembly-measurements.mjs';
import {exteriorParts} from '../dist/exterior-preview.mjs';
const cat=JSON.parse(fs.readFileSync(new URL('../dist/catalog.json',import.meta.url)));
const data=JSON.parse(fs.readFileSync(new URL('../dist/measurements.json',import.meta.url)));
const near=(a,b)=>assert(Math.abs(a-b)<.02,`${a} != ${b}`);
const item={id:'one',model:'d-L6-2',x:0,y:0,roof:'Table'};
const before=JSON.stringify(item),one=stackDimensions([item],cat,data);
one.external.forEach((n,i)=>near(n,data.records['d-L6-2|Table'].external[i]));
assert.deepEqual(one.nominal,[329.6,252,96]);
const translated=stackDimensions([{...item,x:720,y:144}],cat,data);
translated.external.forEach((n,i)=>near(n,one.external[i]));
const stacked=stackDimensions([item,{...item,id:'two',y:96}],cat,data);
stacked.external.forEach((n,i)=>near(n,one.external[i]+(i===2?96:0)));
const noRoof=stackDimensions([{...item,roof:'none'}],cat,data);
assert(noRoof.external[2]<one.external[2]);
const partial=stackDimensions([item],cat,{records:{}});
assert.equal(partial.external,null);assert.deepEqual(partial.missing,['one']);
assert.deepEqual(stackDimensions([],cat,data).external,[0,0,0]);
assert.equal(JSON.stringify(item),before);
// Test source-derived fixtures too: omitting internal meshes must keep the same bounds.
for(const filename of ['d-S3-1-verified.json','d-S3-2-verified.json','d-L3-2-twin-verified.json']){
 const fixture=JSON.parse(fs.readFileSync(new URL('./assembly-fixtures/'+filename,import.meta.url)));
 const model=cat.modules.find(m=>m.id===fixture.model);
 const parts=fixture.parts||fixture.data?.parts;
 const full=measureAssembly(model,parts),light=measureAssembly(model,exteriorParts(parts));
 light.external.forEach((n,i)=>near(n,full.external[i]));
}
console.log('Stack dimensions passed: physical union, 48 mm pitch, covered roofs, translation, empty/missing records and exterior-only fixtures');
