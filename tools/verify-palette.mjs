import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../dist/vendor/three/three.module.js';
import {PALETTE_KEY,DEFAULT_COLOURS,PASTEL_COLOURS,normalisePalette,readPalette,writePalette,watchPalette,previewPalette,contrastColour} from '../dist/palette-store.mjs';
import {StackViewer} from '../dist/stack-viewer.mjs';
const memory=new Map(),storage={getItem:key=>memory.get(key),setItem:(key,value)=>memory.set(key,value)};
assert.deepEqual(readPalette(storage),DEFAULT_COLOURS);
storage.setItem(PALETTE_KEY,'broken');assert.deepEqual(readPalette(storage),DEFAULT_COLOURS);
assert.deepEqual(normalisePalette({light:'#112233',dark:'red',orange:'url(x)',unknown:'#ffffff'}),{...DEFAULT_COLOURS,light:'#112233'});
const custom={light:'#223344',dark:'#116622',orange:'#CC5511',label:'#EECC77'};
assert.deepEqual(writePalette(custom,storage),custom);assert.deepEqual(readPalette(storage),custom);
const windowTarget=new EventTarget(),documentTarget=new EventTarget();documentTarget.visibilityState='visible';let calls=[];
const stop=watchPalette(p=>calls.push(p),{storage,windowTarget,documentTarget});
const event=key=>Object.assign(new Event('storage'),{key});
windowTarget.dispatchEvent(event('unrelated'));assert.equal(calls.length,0);
// Both pages may edit locally before the other returns to an earlier palette.
writePalette({...custom,light:'#445566'},storage);windowTarget.dispatchEvent(event(PALETTE_KEY));
writePalette(custom,storage);windowTarget.dispatchEvent(event(PALETTE_KEY));assert.deepEqual(calls.at(-1),custom);
writePalette(DEFAULT_COLOURS,storage);documentTarget.dispatchEvent(new Event('visibilitychange'));assert.deepEqual(calls.at(-1),DEFAULT_COLOURS);
const count=calls.length;stop();windowTarget.dispatchEvent(event(PALETTE_KEY));assert.equal(calls.length,count);
const item={id:'cabinet',model:'d-S3-1',x:12,y:48,color:'#dce2d5',roof:'Table'},before=JSON.stringify(item);
assert.equal(previewPalette(item).light,'#DCE2D5');assert.deepEqual(previewPalette(item,{mode:'custom',colours:custom}),custom);
for(let seed=1;seed<20;seed++)assert(PASTEL_COLOURS.map(x=>x.toUpperCase()).includes(previewPalette(item,{seed}).light));
assert.equal(JSON.stringify(item),before);assert.equal(contrastColour('#000000'),'#F5F7F0');assert.equal(contrastColour('#ffffff'),'#35452E');
const catalog=JSON.parse(fs.readFileSync(new URL('../dist/catalog.json',import.meta.url)));
const fixture=JSON.parse(fs.readFileSync(new URL('./assembly-fixtures/d-S3-1-verified.json',import.meta.url)));
const host={dataset:{}},status={hidden:false,textContent:'',replaceChildren(){},append(){}};
const viewer=Object.create(StackViewer.prototype);Object.assign(viewer,{host,status,summary:{},root:new T.Group(),modules:[],jobs:new Map(),token:0,key:'',fitCalls:0,fitCamera(){this.fitCalls++;}});
let finish,previewCalls=0,fetchCalls=0;viewer.preview=async()=>{previewCalls++;return new Promise(resolve=>finish=resolve);};
const originalFetch=globalThis.fetch;
globalThis.fetch=async url=>{fetchCalls++;const bytes=fs.readFileSync(new URL('../dist/'+url,import.meta.url));return {ok:true,arrayBuffer:async()=>Uint8Array.from(bytes).buffer};};
try{
 const loading=viewer.update([item],catalog,{mode:'pastel'});
 // A colour change while geometry is loading must win when the model arrives.
 await viewer.update([item],catalog,{mode:'custom',colours:custom});finish(fixture.parts);await loading;
 assert.equal(host.dataset.previewState,'ready');assert.equal(viewer.modules.length,1);assert.deepEqual(viewer.modules[0].colours,custom);
 const module=viewer.modules[0],root=module.root,position=root.position.toArray(),fetchCount=fetchCalls;
 const changed={...custom,light:'#88AA66',label:'#BB44AA'};
 await viewer.update([item],catalog,{mode:'custom',colours:changed});
 assert.equal(viewer.modules[0],module,'recolour retains geometry and assembly');assert.equal(module.root,root);assert.deepEqual(root.position.toArray(),position);
 assert.equal(previewCalls,1);assert.equal(fetchCalls,fetchCount,'recolour does not request any model files');assert.equal(viewer.fitCalls,1,'camera is not refitted');
 for(const [material,slot] of module.materials)assert.equal(material.color.getHexString().toUpperCase(),changed[slot].slice(1));
 await viewer.update([item],catalog,{mode:'pastel',seed:21});assert.deepEqual(module.colours,previewPalette(item,{seed:21}));assert.equal(host.dataset.colourMode,'pastel');
 assert.equal(JSON.stringify(item),before);assert.equal(previewCalls,1);assert.equal(viewer.fitCalls,1);viewer.clear();
}finally{globalThis.fetch=originalFetch;}
console.log('Shared palette: validation, existing storage, cross-page edits, reset, pastel modes, in-flight recolour, actual materials and no geometry/camera reload passed');
