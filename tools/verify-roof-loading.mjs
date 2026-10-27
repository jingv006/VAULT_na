import assert from 'node:assert/strict';
import fs from 'node:fs';
import {AssemblyViewer} from '../dist/assembly-viewer.mjs';
import {roofChoices,verifyPreviewRoof} from '../dist/roof-options.mjs';

const catalog=JSON.parse(fs.readFileSync(new URL('../dist/catalog.json',import.meta.url)));
for(const m of catalog.modules)for(const [roof] of roofChoices(m)){
 const rows=m.kind==='drawer'?(m.roofs[roof]||[]):m.lidRoofs[roof];
 assert.equal(verifyPreviewRoof(m,roof,rows),roof);
 if(rows.length)assert.throws(()=>verifyPreviewRoof(m,roof,[]));
}

const model=catalog.modules.find(m=>m.id==='s-S6-2-standard');
const nodes=new Map(),node=selector=>{
 if(!nodes.has(selector))nodes.set(selector,{textContent:'',append(){}});
 return nodes.get(selector);
};
const viewer=Object.create(AssemblyViewer.prototype);
Object.assign(viewer,{
 host:{dataset:{},querySelector:node},status:node('status'),root:{visible:true},
 key:'',token:0,m:model,moves:[{}],colours:{},renderRoofs(){},paint(){},sync(){},
 clear(){},assemble(m,parts){this.actualPaths=parts.map(p=>p.path);},fitCamera(){},resetCamera(){}
});
const payload=roof=>({status:'done',data:{parts:model.lidRoofs[roof].map(p=>({...p,asset:{url:'/test/'+p.path,components:[]}}))}});
let serve=roof=>Promise.resolve(payload(roof));
const originalFetch=globalThis.fetch,originalDocument=globalThis.document;
globalThis.document={createElement:()=>({})};
globalThis.fetch=async(url,options)=>url==='/api/preview'
 ?{ok:true,json:()=>serve(JSON.parse(options.body).roof)}
 :{ok:true,arrayBuffer:async()=>new ArrayBuffer(0)};
try{
 for(const roof of ['Whole','Split','Whole']){
  await viewer.update(model,{roof},{});
  assert.equal(viewer.host.dataset.loadedRoof,roof);
  assert.equal(viewer.host.dataset.previewState,'ready');
  assert.deepEqual(viewer.actualPaths,model.lidRoofs[roof].map(p=>p.path));
 }
 // A slower old request must never replace a more recent selected roof.
 let finishOld;
 serve=roof=>roof==='Split'?new Promise(resolve=>finishOld=resolve):Promise.resolve(payload(roof));
 const old=viewer.update(model,{roof:'Split'},{});
 assert.equal(viewer.host.dataset.previewState,'loading');
 assert.equal(viewer.host.dataset.loadedRoof,undefined);
 await viewer.update(model,{roof:'Whole'},{});
 finishOld(payload('Split'));await old;
 assert.equal(viewer.host.dataset.loadedRoof,'Whole');
 assert.deepEqual(viewer.actualPaths,model.lidRoofs.Whole.map(p=>p.path));
 // Mismatched backend results stay hidden, and clicking the same choice can retry.
 serve=()=>Promise.resolve(payload('Whole'));
 await viewer.update(model,{roof:'Split'},{});
 assert.equal(viewer.host.dataset.previewState,'error');
 assert.equal(viewer.root.visible,false);
 assert.match(viewer.status.textContent,/不一致/);
 serve=roof=>Promise.resolve(payload(roof));
 await viewer.update(model,{roof:'Split'},{});
 assert.equal(viewer.host.dataset.loadedRoof,'Split');
 assert.equal(viewer.root.visible,true);
 console.log('Roof recipes, actual mesh replacement, stale-response protection, mismatch rejection and retry passed');
}finally{globalThis.fetch=originalFetch;globalThis.document=originalDocument;}
