import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three/three.module.js';
import {stackLayout,stackModulePosition} from '../dist/stack-layout.mjs';
import {createModuleAssembly} from '../dist/assembly-viewer.mjs';
import {makeBOM} from '../dist/core.mjs';

const catalog=JSON.parse(fs.readFileSync(new URL('../dist/catalog.json',import.meta.url)));
const items=[
 {id:'base',model:'d-L3-2-twin',x:50,y:0,roof:'Bowl',color:'#c6d2c2'},
 {id:'left',model:'d-S3-1',x:50,y:96,roof:'Grid',grid:true,rails:true,color:'#e0cdbd'},
 {id:'right',model:'d-S3-2',x:214.8,y:96,roof:'none',color:'#d5dbdc'},
 {id:'flip',model:'s-S6-2-standard',x:600,y:0,roof:'Whole',color:'#dce2d5'},
 {id:'xl',model:'d-XL5-1',x:1000,y:0,roof:'Table',grid:true,color:'#d5dbdc'}
];
const before=JSON.stringify(items),plan=stackLayout(items,catalog);
assert.equal(plan.length,5);assert.equal(plan[0].options.roof,'none','covered cabinet roof removed');
assert.equal(plan[1].options.roof,'Grid');assert.equal(plan[1].options.grid,true);assert.equal(plan[1].options.rails,true);
assert.equal(plan[2].options.roof,'none');assert.equal(plan[3].options.roof,'Whole');
assert.deepEqual(plan.map(e=>[e.id,e.x,e.z]),items.map(i=>[i.id,i.x,i.y]));
assert.equal(JSON.stringify(items),before,'preview never mutates saved layout');
const group=new T.Group();
for(const entry of plan){
 const filename=entry.model.id+(entry.options.roof==='Whole'?'-whole':'')+'-verified.json';
 const data=JSON.parse(fs.readFileSync(new URL('./assembly-fixtures/'+filename,import.meta.url)));
 const parts=data.parts.filter(p=>entry.options.roof!=='none'||p.role!=='顶盖');
 const assets=parts.map(p=>{
  const bytes=fs.readFileSync(new URL('../dist/'+p.asset.url,import.meta.url)),buffer=Uint8Array.from(bytes).buffer;
  return p.asset.components.map(c=>{const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(new Float32Array(buffer,c.offset,c.vertices*3),3));g.setIndex(new T.BufferAttribute(new Uint32Array(buffer,c.indexOffset,c.indices),1));return g;});
 });
 const module=createModuleAssembly(entry.model,parts,assets,{light:entry.colour,dark:'#454749',orange:'#F58238',label:'#F4F2EB'});
 const body=parts.find(p=>['柜体','箱体'].includes(p.role));module.root.position.set(...stackModulePosition(entry,body.asset.size[1]));
 for(const clip of module.keyClips)clip.plane.constant+=module.root.position.y;
 group.add(module.root);group.updateMatrixWorld(true);
 assert.equal(module.root.position.z,entry.z,'exact nominal F stacking height');
 assert(Math.abs(module.root.position.x-entry.model.width/2-entry.x)<1e-7,'left edges follow the 2D layout');
 assert.equal(module.root.position.y+body.asset.size[1]/2,0,'different depths share cabinet front plane');
 const mesh=module.moves.find(p=>['柜体','箱体'].includes(p.mesh.userData.role)).mesh;
 assert.equal(mesh.material.color.getHexString(),entry.colour.slice(1),'selected module colour preserved');
 assert(new T.Box3().setFromObject(module.root).getSize(new T.Vector3()).toArray().every(n=>n>0&&Number.isFinite(n)));
 assert(module.moves.every(p=>p.mesh.position.toArray().every(Number.isFinite)));
 if(entry.options.roof==='none')assert(!module.moves.some(p=>p.mesh.userData.role==='顶盖'));
 if(entry.options.roof==='Whole')assert.equal(module.moves.filter(p=>p.mesh.userData.role==='翻盖').length,1);
}
assert.equal(group.children.length,5);
const stackBOM=makeBOM({items,extras:[],overrides:{}},catalog);
assert(!stackBOM.parts.some(p=>p.path.includes('L3 Bowl Roof')),'BOM and preview agree on covered roof');
const moved=stackLayout(items.map(i=>i.id==='right'?{...i,x:400,y:144}:i),catalog);
assert.equal(moved[2].x,400);assert.equal(moved[2].z,144);
assert.equal(stackLayout([],catalog).length,0);
console.log('Stack preview: real drawer/twin/flip assemblies, 2D positions, exact F pitch, front alignment, colours, accessories and roof exposure passed');
