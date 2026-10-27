import fs from 'node:fs';
import assert from 'node:assert/strict';
import {randomLayout} from '../dist/random-layout.mjs';
import {bounds,validate,validatePlan,makeBOM} from '../dist/core.mjs';
const catalog=JSON.parse(fs.readFileSync(new URL('../dist/catalog.json',import.meta.url)));
const lookup=Object.fromEntries(catalog.modules.map(m=>[m.id,m]));
const widths={S:164.8,M:254,L:329.6,XL:418.8};
const seeded=initial=>{let seed=initial;return()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);};
let cases=0;
for(const family of Object.keys(widths))for(const depth of [3,4,5,6,7])for(const kind of ['drawer','sustainer','mixed'])for(let seed=1;seed<=12;seed++){
 const totalF=1+(seed*7+depth)%40,items=randomLayout(catalog,{family,depth,totalF,kind},seeded(++cases));
 const b=bounds(items,lookup);
 assert(Math.abs(b.width-widths[family])<1e-7,'requested width');
 assert.equal(b.height,totalF*48,'exact total F height');assert.equal(b.depth,depth*42);
 assert.equal(items[0].y,0);assert.equal(lookup[items[0].model].family,family,'full width bottom module');
 assert(items.length<=500);assert.equal(new Set(items.map(i=>i.id)).size,items.length);
 assert.deepEqual(validate(items,lookup),[],'no collision, unsupported region or depth mismatch');
 for(const item of items){assert.equal(lookup[item.model].depth,depth);if(kind!=='mixed')assert.equal(lookup[item.model].kind,kind);}
 const restored=validatePlan({version:1,title:'random',items,extras:[],overrides:{}},catalog);
 const bom=makeBOM(restored,catalog);assert(bom.parts.length);assert(bom.parts.every(p=>p.qty>0));
}
const variants=new Set(Array.from({length:30},(_,i)=>JSON.stringify(randomLayout(catalog,{family:'L',depth:3,totalF:12},seeded(i+1)).map(m=>[m.model,m.x,m.y]))));
assert(variants.size>15,'random results vary in module selection and layout');
for(const options of [{family:'X'},{depth:2},{depth:3.5},{totalF:0},{totalF:41},{totalF:2.5},{kind:'unknown'}])assert.throws(()=>randomLayout(catalog,options));
console.log(`${cases} randomized envelopes passed: exact width/depth/F height, support, collisions, module types, import and BOM; variation and invalid inputs verified`);
