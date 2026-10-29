import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import * as T from '../dist/vendor/three/three.module.js';
import {StackViewer} from '../dist/stack-viewer.mjs';
import {EXTERIOR_ROLES,exteriorParts} from '../dist/exterior-preview.mjs';
import {createModuleAssembly} from '../dist/assembly-viewer.mjs';
import {verifyPreviewRoof} from '../dist/roof-options.mjs';
const catalog=JSON.parse(fs.readFileSync(new URL('../dist/catalog.json',import.meta.url)));
const backendRoles=JSON.parse(execFileSync('/usr/bin/python3',['-c','import json,preview_service; print(json.dumps(sorted(preview_service.EXTERIOR_ROLES)))'],{cwd:new URL('..',import.meta.url),encoding:'utf8'}));
assert.deepEqual([...EXTERIOR_ROLES].sort(),backendRoles,'browser and server agree on exposed roles');
let savedFetch=globalThis.fetch,requests=[],urls=[],fullStats=0,outerStats=0;
const colours={light:'#D1D3D5',dark:'#454749',orange:'#F58238',label:'#F4F2EB'};
try{
 for(const id of ['d-S3-1','d-L3-2-twin','d-XL5-1','s-S6-2-standard','s-L3-2-sealed']){
  const filename=id+(id==='s-S6-2-standard'?'-whole':'')+'-verified.json';
  const fixture=JSON.parse(fs.readFileSync(new URL('./assembly-fixtures/'+filename,import.meta.url))),m=catalog.modules.find(m=>m.id===id);
  const host={dataset:{}},viewer=Object.create(StackViewer.prototype);
  Object.assign(viewer,{host,status:{hidden:false,replaceChildren(){},append(){}},summary:{},root:new T.Group(),modules:[],jobs:new Map(),token:0,key:'',fitCamera(){}});
  globalThis.fetch=async(url,options)=>{
   if(url==='/api/preview'){const payload=JSON.parse(options.body);requests.push(payload);assert.equal(payload.detail,'exterior');assert.equal(payload.grid,false);assert.equal(payload.rails,false);
    // Simulate an older backend returning a complete assembly: frontend must
    // still reject internal binaries before touching the geometry loader.
    return {ok:true,json:async()=>({status:'done',data:fixture})};}
   urls.push(url);assert(exteriorParts(fixture.parts).some(p=>p.asset.url===url),'internal binary was requested');
   return {ok:true,arrayBuffer:async()=>Uint8Array.from(fs.readFileSync(new URL('../dist/'+url,import.meta.url))).buffer};
  };
  const item={id:'one',model:id,x:0,y:0,roof:id==='s-S6-2-standard'?'Whole':m.kind==='drawer'?'Table':m.defaultLid,grid:true,rails:true,color:'#dce2d5'};
  const before=JSON.stringify(item);await viewer.update([item],catalog,{mode:'custom',colours});
  assert.equal(host.dataset.previewState,'ready');assert.equal(host.dataset.detail,'exterior');assert.equal(viewer.modules.length,1);
  const module=viewer.modules[0];assert(module.moves.every(p=>EXTERIOR_ROLES.has(p.mesh.userData.role)));
  assert(!module.moves.some(p=>p.mesh.userData.role==='抽屉盒'||p.mesh.userData.role.startsWith('密封')));
  verifyPreviewRoof(m,item.roof,exteriorParts(fixture.parts),{exterior:true});
  const roofRole=m.kind==='drawer'?'顶盖':item.roof==='Whole'?'翻盖':'翻盖分件';
  if(fixture.parts.some(p=>p.role===roofRole))assert.throws(()=>verifyPreviewRoof(m,item.roof,exteriorParts(fixture.parts).filter(p=>p.role!==roofRole),{exterior:true}),'missing exterior roof must still be rejected');
  const root=module.root,fetchCount=urls.length,requestCount=requests.length;
  await viewer.update([{...item,grid:false,rails:false}],catalog,{mode:'custom',colours:{...colours,light:'#339988'}});
  assert.equal(viewer.modules[0].root,root,'internal accessory changes do not rebuild the scene');assert.equal(urls.length,fetchCount);assert.equal(requests.length,requestCount);
  assert.equal(JSON.stringify(item),before,'BOM flags are not mutated');
  const geom=p=>p.asset.components.reduce((n,c)=>n+c.indices/3,0)*p.qty;
  fullStats+=fixture.parts.reduce((n,p)=>n+geom(p),0);outerStats+=exteriorParts(fixture.parts).reduce((n,p)=>n+geom(p),0);
  // Remaining exterior parts retain their exact full-assembly placement.
  const allAssets=fixture.parts.map(p=>{const b=Uint8Array.from(fs.readFileSync(new URL('../dist/'+p.asset.url,import.meta.url))).buffer;return p.asset.components.map(c=>{const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(new Float32Array(b,c.offset,c.vertices*3),3));g.setIndex(new T.BufferAttribute(new Uint32Array(b,c.indexOffset,c.indices),1));return g;});});
  const full=createModuleAssembly(m,fixture.parts,allAssets,colours),outer=createModuleAssembly(m,exteriorParts(fixture.parts),allAssets.filter((_,i)=>EXTERIOR_ROLES.has(fixture.parts[i].role)),colours);
  const signature=a=>[a.mesh.userData.path,a.mesh.userData.drawer,a.base.toArray(),a.mesh.rotation.toArray()];
  assert.deepEqual(outer.moves.map(signature),full.moves.filter(p=>EXTERIOR_ROLES.has(p.mesh.userData.role)).map(signature),'outer appearance and placement match full assembly');
  full.clear();outer.clear();viewer.clear();
 }
}finally{globalThis.fetch=savedFetch;}
assert(outerStats<fullStats);console.log(`Exterior preview: five real assemblies, protocol, only exterior binary requests, shared positions, colours and accessory reuse passed; fixture triangles ${fullStats} → ${outerStats} (${(100*(1-outerStats/fullStats)).toFixed(1)}% fewer)`);
