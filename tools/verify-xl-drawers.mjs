import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three/three.module.js';
import {createModuleAssembly} from '../dist/assembly-viewer.mjs';
const cat=JSON.parse(fs.readFileSync(new URL('../dist/catalog.json',import.meta.url)));
const colours={light:'#D1D3D5',dark:'#454749',orange:'#F58238',label:'#F4F2EB'};
const near=(a,b,message,tol=.08)=>assert(Math.abs(a-b)<tol,`${message}: ${a} versus ${b}`);
const boxes=new Set(['抽屉盒','抽屉盒分件','抽屉背板']);
for(const m of cat.modules.filter(m=>m.kind==='drawer'&&m.family==='XL')){
 const parts=JSON.parse(fs.readFileSync(new URL('./assembly-fixtures/'+m.id+'-verified.json',import.meta.url))).parts;
 const assets=parts.map(p=>{const bytes=Uint8Array.from(fs.readFileSync(new URL('../dist/'+p.asset.url,import.meta.url))).buffer;
  return p.asset.components.map(c=>{const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(new Float32Array(bytes,c.offset,c.vertices*3),3));g.setIndex(new T.BufferAttribute(new Uint32Array(bytes,c.indexOffset,c.indices),1));return g;});});
 const module=createModuleAssembly(m,parts,assets,colours),d=module.datums;
 near(d.outsideFloor,4.8,m.id+' cabinet underside datum');near(d.insideFloor,7.8,m.id+' cabinet internal floor');near(d.outsideCeiling,51.8,m.id+' cabinet ceiling');
 module.root.updateMatrixWorld(true);
 for(const move of module.moves.filter(a=>boxes.has(a.mesh.userData.role))){
  const p=parts.find(p=>p.path===move.mesh.userData.path),f=d.frames[move.mesh.userData.drawer],box=new T.Box3().setFromObject(move.mesh);
  assert(p.asset.size[2]<40,`${m.id}: drawer parts must be horizontal and 1F high`);
  near(box.min.z,d.boxBottom,m.id+' box and rear panel share floor');assert(box.max.z<d.outsideCeiling-2,'drawer remains below inside ceiling');
  assert(box.min.x>=f.x-f.width/2&&box.max.x<=f.x+f.width/2,'drawer contained within its assigned cabinet half');
  assert(box.min.y>-d.D/2+.5&&box.max.y<=f.faceBack+.08,'drawer contained between cabinet back and facade');
  assert.equal(move.moving,true);assert.equal(move.ex.x,0);assert.equal(move.ex.z,0);
 }
 for(const f of d.frames){
  const drawer=d.frames.indexOf(f),moving=module.moves.filter(a=>a.mesh.userData.drawer===drawer&&boxes.has(a.mesh.userData.role));
  const front=moving.find(a=>a.mesh.userData.role==='抽屉盒'||a.mesh.userData.path.includes('Part 1'));
  near(new T.Box3().setFromObject(front.mesh).max.y,f.faceBack,m.id+' front box contacts facade');
  const back=moving.find(a=>a.mesh.userData.role==='抽屉背板');
  if(back){assert(parts.find(p=>p.path===back.mesh.userData.path).asset.size[1]<7);near(new T.Box3().setFromObject(back.mesh).min.y,new T.Box3().setFromObject(front.mesh).min.y,m.id+' back panel seated at rear');}
  const rear=moving.find(a=>a.mesh.userData.path.includes('Part 2'));
  if(rear){const a=new T.Box3().setFromObject(front.mesh),b=new T.Box3().setFromObject(rear.mesh),overlap=b.max.y-a.min.y;assert(overlap>5.8&&overlap<6.2,`${m.id}: split halves interlock by 6mm (${overlap})`);near(a.getCenter(new T.Vector3()).x,b.getCenter(new T.Vector3()).x,m.id+' split halves share centerline');}
 }
 for(const p of parts.filter(p=>p.role==='网格收纳底板')){
  const levels=p.asset.landmarks.planes.z;assert(p.asset.size[2]<30,`${m.id}: grid upright inside drawer height`);
  assert(levels.some(a=>a.normal===-1&&levels.some(b=>b.normal===1&&b.area>500&&Math.abs(b.at-a.at-4)<.3)),`${m.id}: actual grid floor surfaces are horizontal`);
 }
 for(const p of parts){const r=p.asset.orientation,matrix=new T.Matrix4().set(r[0][0],r[0][1],r[0][2],0,r[1][0],r[1][1],r[1][2],0,r[2][0],r[2][1],r[2][2],0,0,0,0,1);near(matrix.determinant(),1,m.id+' rigid source rotation',1e-5);}
 const rest=module.moves.filter(a=>boxes.has(a.mesh.userData.role)).map(a=>a.mesh.position.clone());
 module.open=1;module.pose();module.moves.filter(a=>boxes.has(a.mesh.userData.role)).forEach((a,i)=>{near(a.mesh.position.x,rest[i].x,m.id+' drawer opening X');near(a.mesh.position.z,rest[i].z,m.id+' drawer opening Z');near(a.mesh.position.y-rest[i].y,d.D*.78,m.id+' rear follows drawer opening');});
 module.open=0;module.explode=1;module.pose();module.moves.filter(a=>boxes.has(a.mesh.userData.role)).forEach((a,i)=>{near(a.mesh.position.x,rest[i].x,m.id+' explosion X');near(a.mesh.position.z,rest[i].z,m.id+' explosion Z');near(a.mesh.position.y-rest[i].y,d.D*.55,m.id+' entire box explodes forward');});
 module.open=0;module.explode=0;module.pose();module.moves.filter(a=>boxes.has(a.mesh.userData.role)).forEach((a,i)=>assert.deepEqual(a.mesh.position.toArray(),rest[i].toArray()));
 module.clear();console.log(m.id+': source orientation, floor/roof clearance, drawer halves, rear panel, grid, opening and explosion passed');
}
