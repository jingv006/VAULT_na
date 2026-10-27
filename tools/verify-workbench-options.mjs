import fs from 'node:fs';
import assert from 'node:assert/strict';
import {roofLibrary,roofTarget,drawerAccessoryState,setDrawerAccessory} from '../dist/workbench-options.mjs';
import {makeBOM,validatePlan,estimateBOM,packEntries} from '../dist/core.mjs';
import {customPrinter,printerBOM} from '../dist/printers.mjs';
const load=name=>JSON.parse(fs.readFileSync(new URL('../dist/'+name,import.meta.url)));
const catalog=load('catalog.json'),geometry=load('geometry.json'),estimates=load('estimates.json');
const lookup=Object.fromEntries(catalog.modules.map(m=>[m.id,m])),choices=roofLibrary(catalog);
assert.equal(new Set(choices.map(r=>r.id)).size,choices.length);
for(const choice of choices){assert(choice.parts.length);for(const p of choice.parts)assert(geometry.records[p.path]);}
const pick=(family,depth,value,kind='drawer')=>choices.find(c=>c.family===family&&c.depth===depth&&c.value===value&&c.kind===kind);
const items=[{id:'bottom',model:'d-S3-1',x:0,y:0,roof:'Table'},{id:'top',model:'d-S3-2',x:0,y:48,roof:'Table'},{id:'other',model:'d-L3-1',x:164.8,y:0,roof:'Table'}];
const tray=pick('S',3,'Bowl');
assert.equal(roofTarget(tray,items,lookup,{selectedId:'bottom'}).id,'top');
assert.equal(roofTarget(tray,items,lookup,{targetId:'bottom'}),undefined,'covered drawer cannot receive a roof');
assert.equal(roofTarget(tray,items,lookup,{targetId:'other'}),undefined,'mismatched width rejected');
assert.equal(roofTarget(pick('S',4,'Grid'),items,lookup),undefined,'mismatched depth rejected');
const state={version:1,title:'test',items,extras:[],overrides:{}};
const before=makeBOM(state,catalog);items[1].roof='Bowl';
const after=makeBOM(state,catalog),oldPath=pick('S',3,'Table').parts[0].path;
assert(!after.parts.some(p=>p.path===oldPath),'new style replaces automatic top roof, without duplication');
for(const p of tray.parts)assert.equal(after.parts.find(r=>r.path===p.path).qty,p.qty);
assert.equal(after.copies,before.copies);
assert.notEqual(estimateBOM(after,estimates).grams,estimateBOM(before,estimates).grams);
state.extras=tray.parts.map(p=>({path:p.path,qty:p.qty}));
const spare=makeBOM(state,catalog);
for(const p of tray.parts)assert.equal(spare.parts.find(r=>r.path===p.path).qty,p.qty*2);
assert(packEntries(spare).some(e=>e.path===tray.parts[0].path),'selected roof included in export manifest');
const flip={version:1,title:'flip',items:[{id:'a',model:'s-S6-2-standard',x:0,y:0,roof:'Whole'},{id:'b',model:'s-S6-2-standard',x:0,y:96,roof:'Split'}],extras:[],overrides:{}};
assert.equal(roofTarget(pick('S',6,'Whole','sustainer'),flip.items,lookup,{targetId:'a'}).id,'a');
const restored=validatePlan(JSON.parse(JSON.stringify(flip)),catalog);
assert.equal(restored.items[0].roof,'Whole');assert.equal(restored.items[1].roof,'Split');
assert(makeBOM(restored,catalog).parts.some(p=>p.path.includes('Roof Whole')));
const profile=customPrinter({name:'自己的打印机',volume:[220.5,230,250]});
assert.deepEqual(customPrinter(JSON.parse(JSON.stringify(profile))),profile,'profile survives local storage roundtrip');
for(const volume of [[0,200,200],[-1,2,3],[Infinity,2,3],[NaN,2,3],[1,2],[1,2,10001],['220',220,250]])assert.throws(()=>customPrinter({volume}));
const small=printerBOM(spare,customPrinter({volume:[50,50,50]}),geometry),large=printerBOM(spare,customPrinter({volume:[1000,1000,1000]}),geometry);
assert(small.blockedFiles>0);assert.equal(large.blockedFiles,0);
const fake={parts:[{path:'p',qty:3}]},g={records:{p:{size:[200,100,50]}}};
assert.equal(printerBOM(fake,customPrinter({volume:[200,100,50]}),g).blockedFiles,0);
assert.equal(printerBOM(fake,customPrinter({volume:[200,100,50]}),g,{margin:3}).blockedCopies,3);
console.log(`Passed ${choices.length} roof choices; compatible installation, covered/mismatched rejection, replacement, spare/export/estimates, plan reload and custom printer bounds/fit`);

// Bulk changes must multiply twin-drawer parts correctly and leave flip boxes
// and manually added spare files untouched.
const mixedItems=[{id:'twin',model:'d-L3-1-twin',x:0,y:0,grid:false,rails:false},{id:'drawer',model:'d-S3-2',x:0,y:48,grid:true,rails:false},{id:'flip',model:'s-S3-2-standard',x:400,y:0,grid:true,rails:true}];
const inventoryState={version:1,title:'bulk',items:mixedItems,extras:[],overrides:{}};
const original=JSON.stringify(mixedItems);
const mixed=drawerAccessoryState(mixedItems,lookup,'grid');
assert.deepEqual(mixed,{total:2,enabled:1,checked:false,mixed:true});
let bulk=setDrawerAccessory(mixedItems,lookup,'grid',true);
bulk=setDrawerAccessory(bulk,lookup,'rails',true);
assert.equal(JSON.stringify(mixedItems),original,'bulk setter leaves the original undo snapshot intact');
assert.equal(bulk[2],mixedItems[2],'flip-box choices untouched');
const on=makeBOM({...inventoryState,items:bulk},catalog);
for(const path of new Set(bulk.filter(i=>lookup[i.model].kind==='drawer').flatMap(i=>lookup[i.model].railParts.map(p=>p.path)))){
 const expected=bulk.filter(i=>lookup[i.model].kind==='drawer').reduce((n,i)=>n+lookup[i.model].railParts.filter(p=>p.path===path).reduce((a,p)=>a+p.qty,0),0);
 assert.equal(on.parts.find(p=>p.path===path).qty,expected,'rail quantities follow each original recipe');
}
assert(drawerAccessoryState(bulk,lookup,'grid').checked);
assert(drawerAccessoryState(bulk,lookup,'rails').checked);
const sparePath=lookup['d-S3-2'].gridParts[0].path;
let off=setDrawerAccessory(bulk,lookup,'grid',false);off=setDrawerAccessory(off,lookup,'rails',false);
const offBOM=makeBOM({...inventoryState,items:off,extras:[{path:sparePath,qty:2}]},catalog);
assert(offBOM.parts.find(p=>p.path===sparePath).qty>=2,'manually added spare grid remains');
assert.equal(off[2].grid,true);assert.equal(off[2].rails,true);
assert.equal(drawerAccessoryState([],lookup,'grid').total,0);
assert(estimateBOM(on,estimates).grams>estimateBOM(makeBOM(inventoryState,catalog),estimates).grams,'bulk accessories increase material estimate');
console.log('Bulk grid/rails: mixed state, twin recipe quantities, flip/spare isolation and estimates passed');
