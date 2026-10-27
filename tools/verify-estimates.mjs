import fs from 'node:fs';
import assert from 'node:assert/strict';
import {estimateBOM,makeBOM} from '../dist/core.mjs';
const rows={parts:[{path:'shell.stl',qty:2},{path:'hinge.stl',qty:5}]};
const records={'shell.stl':{status:'ok',grams:197.88,seconds:19577},'hinge.stl':{status:'ok',grams:18.95,seconds:3126,needsSupport:true}};
let e=estimateBOM(rows,{records});assert.equal(e.grams,490.51);assert.equal(e.seconds,54784);assert.equal(e.knownCopies,7);assert.equal(e.supportCopies,5);assert.equal(e.complete,true);
e=estimateBOM(rows,{records:{'shell.stl':records['shell.stl'],'hinge.stl':{status:'failed',grams:100,seconds:100}}});assert.equal(e.grams,395.76);assert.equal(e.missingCopies,5);assert.equal(e.complete,false);
e=estimateBOM(rows,{records:{...records,'hinge.stl':{...records['hinge.stl'],estimateOnly:true,printableOnH2D:false}}});assert.equal(e.estimateOnlyCopies,5);assert.equal(e.grams,490.51);
e=estimateBOM(rows,{records:{...records,'hinge.stl':{...records['hinge.stl'],generatedSupports:true}}});assert.equal(e.autoSupportCopies,5);assert.equal(e.supportCopies,0);assert.equal(e.grams,490.51);
assert.equal(estimateBOM({parts:[]},null).grams,0);assert.equal(estimateBOM(rows,null).complete,false);
const c=JSON.parse(fs.readFileSync(new URL('../dist/catalog.json',import.meta.url)));
const path=c.modules.find(m=>m.id==='d-S3-1').parts[0].path;
const one={items:[{id:'one',model:'d-S3-1',x:0,y:0}],extras:[],overrides:{}};
const b=makeBOM(one,c);const fixture={records:Object.fromEntries(b.parts.map(p=>[p.path,{status:'ok',grams:10,seconds:60}]))};
const before=estimateBOM(b,fixture);
const two=structuredClone(one);two.items.push({...two.items[0],id:'two',y:48});const doubled=estimateBOM(makeBOM(two,c),fixture);
// Both assemblies share just one exposed top roof: adding another complete
// module must not double-count the roof that is now hidden under its neighbor.
const roof=b.parts.find(p=>p.role==='顶盖');const roofCost=fixture.records[roof.path];
assert.equal(doubled.grams,before.grams*2-roof.qty*roofCost.grams);
one.overrides[path]=3;const modified=estimateBOM(makeBOM(one,c),fixture);assert.equal(modified.grams,before.grams+20);
one.overrides[path]=0;assert.equal(estimateBOM(makeBOM(one,c),fixture).grams,before.grams-10);
console.log('Estimate tests passed: quantities, cumulative times, incomplete data, virtual envelopes, overrides and exposed roof accounting.');
