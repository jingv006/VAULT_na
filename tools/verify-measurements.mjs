import fs from 'node:fs';
import assert from 'node:assert/strict';
import {measureAssembly,cavity} from '../dist/assembly-measurements.mjs';
const data=JSON.parse(fs.readFileSync(new URL('../dist/measurements.json',import.meta.url))),r=data.records['d-L6-2|Table'];
const near=(x,y,tol=.15)=>assert(Math.abs(x-y)<tol,`${x} != ${y}`);
r.external.forEach((v,i)=>near(v,[329.9,311.2,109.8][i]));
r.housing.forEach((v,i)=>near(v,[329.6,272.1,105][i]));
r.drawers[0].outer.forEach((v,i)=>near(v,[299,269.8,85.5][i]));
r.drawers[0].inner.forEach((v,i)=>near(v,[290.6,260.2,82.5][i]));
assert(r.external[1]>r.housing[1]&&r.housing[1]>r.drawers[0].outer[1]);
assert.equal(cavity({size:[100,100,100]}),null);
for(const row of Object.values(data.records)){
 assert(row.external.length===3&&row.external.every(n=>n>0&&Number.isFinite(n)));
 for(const drawer of row.drawers)if(drawer.inner)drawer.inner.forEach((v,i)=>assert(v>0&&v<drawer.outer[i]));
}
console.log(`Passed ${Object.keys(data.records).length} measured assemblies; L6F2 outside/inside dimensions, shaft clipping and missing-plane handling`);
