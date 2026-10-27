import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../dist/vendor/three/three.module.js';
import {AssemblyViewer} from '../dist/assembly-viewer.mjs';
import {sustainerLockPose} from '../dist/sustainer-alignment.mjs';
const catalog=JSON.parse(fs.readFileSync(new URL('../dist/catalog.json',import.meta.url)));
for(const m of catalog.modules.filter(m=>m.kind==='sustainer')){
 const locks=['S','M'].includes(m.family)?1:2;
 for(const role of ['锁扣座','锁扣内件','锁扣外件','锁扣插销套件'])assert.equal(m.parts.find(p=>p.role===role).qty,locks,`${m.id}: lock quantity`);
 assert.equal(m.parts.find(p=>p.role==='锁扣标签').qty,1);
 if(m.family==='XL')assert(m.parts.find(p=>p.role==='前面板').path.endsWith('XL1F Facade.stl'));
 if(m.variant==='sealed')assert.equal(m.parts.filter(p=>p.role.startsWith('密封')).reduce((n,p)=>n+p.qty,0),3,'preserve the existing removable-divider recipe');
}
const fixtures=['s-S3-1-standard','s-S3-2-standard','s-M3-4-standard','s-L3-2-sealed','s-XL3-1-flat','s-S6-2-standard','s-L7-4-sealed','s-XL3-1-sealed'].map(id=>({id,whole:false}));
fixtures.push({id:'s-S6-2-standard',whole:true},{id:'s-L7-4-sealed',whole:true});
for(const {id,whole} of fixtures){
 const m=catalog.modules.find(m=>m.id===id),data=JSON.parse(fs.readFileSync(new URL('./assembly-fixtures/'+id+(whole?'-whole':'')+'-verified.json',import.meta.url)));
 const gs=data.parts.map(p=>{
  const file=fs.readFileSync(new URL('../dist/'+p.asset.url,import.meta.url));
  const buffer=Uint8Array.from(file).buffer;
  return p.asset.components.map(c=>{
   const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(new Float32Array(buffer,c.offset,c.vertices*3),3));g.setIndex(new T.BufferAttribute(new Uint32Array(buffer,c.indexOffset,c.indices),1));return g;
  });
 });
 const v=Object.create(AssemblyViewer.prototype);Object.assign(v,{root:new T.Group(),materials:[],moves:[],colours:{light:'#D1D3D5',dark:'#454749',orange:'#F58238',label:'#F4F2EB'},m,explode:0,open:0});v.assemble(m,data.parts,gs);v.root.updateMatrixWorld(true);
 const d=v.sustainer,near=(a,b,why)=>assert(Math.abs(a-b)<.075,`${id}: ${why}: ${a} vs ${b}`);
 const records=role=>v.moves.filter(p=>p.mesh.userData.role===role);
 const component=p=>{const source=data.parts.find(r=>r.path===p.mesh.userData.path),same=records(p.mesh.userData.role).indexOf(p);return source.asset.components[same%source.asset.components.length];};
 const world=p=>p.mesh.getWorldPosition(new T.Vector3());
 for(const lower of records('下铰链套件')){
  const c=component(lower),w=world(lower);
  // M source pads use 22.75 mm spacing versus 23 mm in the shared S/M leaf.
  // Keep the unscaled meshes centred; this 0.125 mm source difference is retained.
  for(const h of c.landmarks.mountHoles)assert(d.body.landmarks.hingeHoles.some(b=>Math.hypot(w.x+h.x-b.x,w.z+h.z-(d.H/2+b.z))<.16),`${id}: lower hinge holes coincide with body holes`);
  near(w.y-c.size[1]/2+7,d.axisY,'lower barrel Y');near(w.z+c.size[2]/2-7,d.rim,'lower barrel Z');
 }
 for(const upper of records('上铰链套件')){const c=component(upper),w=world(upper);assert.equal(upper.mesh.parent,v.lid);near(w.y-c.size[1]/2+7,d.axisY,'upper barrel Y');near(w.z,d.rim,'upper barrel Z');}
 for(const pin of records('铰链轴套件')){const c=component(pin),axis=pin.mesh.localToWorld(new T.Vector3(...c.landmarks.shaftAxis));near(axis.y,d.axisY,'hinge rod shares barrel Y');near(axis.z,d.rim,'hinge rod shares barrel Z');}
 const facade=records('前面板')[0];near(world(facade).y-d.facade.size[1]/2,d.D/2,'facade rear contacts body front');near(world(facade).z-d.facade.size[2]/2,d.outsideFloor,'facade bottom');
 for(const lid of v.moves.filter(p=>['翻盖','翻盖分件'].includes(p.mesh.userData.role))){const c=component(lid);assert(c.landmarks.planes.z.some(p=>p.normal===1&&p.area>c.size[0]*c.size[1]*.05),`${id}: cover must have an aligned broad top plane`);}
 const holders=records('锁扣座');assert.equal(holders.length,['S','M'].includes(m.family)?1:2);
 for(const holder of holders){const c=component(holder),w=world(holder);for(const h of c.landmarks.mountHoles)assert(d.facade.landmarks.mountHoles.some(f=>Math.hypot(w.x+h.x-f.x,w.z+h.z-(d.facadeZ+f.z))<.05),`${id}: lock holder mounting holes`);const mountingFace=c.landmarks.planes.y.find(p=>p.normal===1);near(w.y+mountingFace.at,d.D/2,'holder mounting leaf contacts REAR of facade');}
 const closed=sustainerLockPose(d);near(closed.catchPoint[0],closed.target[0],'closed hook seats on groove Y');near(closed.catchPoint[1],closed.target[1],'closed hook seats on groove Z');
 assert(Math.abs(closed.outerAngle)<.12,'closed lever must be pressed down, not raised');
 assert(closed.hookTip[0]>d.facadeY-6&&closed.hookTip[0]<d.facadeY-3,'hook toe sits inside the recessed lid channel');
 assert(closed.hookTip[1]>d.rim+6.3&&closed.hookTip[1]<d.rim+8.2,'hook toe sits at groove depth, not above the lid');
 const released=sustainerLockPose(d,1);assert(released.hookTip[0]>closed.hookTip[0]+20,'released hook must clear the groove in front');assert(released.outerAngle<-.45,'released lever visibly raised');
 const checkLockPivots=pose=>{
  v.root.updateMatrixWorld(true);
  for(const inner of records('锁扣内件')){const c=component(inner),top=Math.max(...c.landmarks.pivotBores.map(b=>b.z));for(const bore of c.landmarks.pivotBores){const w=inner.mesh.localToWorld(new T.Vector3(0,bore.x,bore.z)),expected=Math.abs(bore.z-top)<.01?pose.pivot:pose.bottom;near(w.y,expected[0],'inner lock pivot Y');near(w.z,expected[1],'inner lock pivot Z');}}
  for(const outer of records('锁扣外件')){const c=component(outer),b=c.landmarks.pivotBores[0],w=outer.mesh.localToWorld(new T.Vector3(0,b.x,b.z));near(w.y,pose.bottom[0],'outer lock pivot Y');near(w.z,pose.bottom[1],'outer lock pivot Z');}
 };
 checkLockPivots(closed);
 const closedMatrices=v.moves.map(p=>p.mesh.matrixWorld.clone());
 v.open=.1;v.pose();checkLockPivots(sustainerLockPose(d,.5));near(v.lid.rotation.x,0,'release latch before moving lid');
 v.open=.2;v.pose();checkLockPivots(sustainerLockPose(d,1));near(v.lid.rotation.x,0,'lid remains closed until latch released');
 v.open=0;v.pose();v.root.updateMatrixWorld(true);v.moves.forEach((p,i)=>p.mesh.matrixWorld.elements.forEach((n,j)=>assert(Math.abs(n-closedMatrices[i].elements[j])<1e-7,'returning to assembled restores the latched transform')));
 if(m.variant==='sealed'){
  assert(d.dividerRows.length>0,`${id}: use actual divider grooves; not nominal Gridfinity spacing`);
  for(const divider of v.moves.filter(p=>p.mesh.userData.role.startsWith('密封')))assert(d.dividerRows.some(y=>Math.abs(divider.base.y-y)<.01));
 }
 if(whole){assert.equal(records('翻盖').length,1);assert.equal(records('翻盖分件').length,0);assert.equal(records('翻盖连接件').length,0);near(d.roofDepth,d.D+10,'whole cover spans complete body depth');}
 else if(m.depth>=6){const lids=records('翻盖分件');assert.equal(lids.length,2);const [a,b]=lids.map(p=>new T.Box3().setFromObject(p.mesh)).sort((a,b)=>a.min.y-b.min.y);near(a.max.y,b.min.y,'split covers meet at depth seam');near((a.min.x+a.max.x)/2,(b.min.x+b.max.x)/2,'split covers share width centre');assert(Math.abs((a.max.x-a.min.x)-(b.max.x-b.min.x))<.5,'retain original split-mesh width difference without scaling');}
 v.open=1;v.pose();v.root.updateMatrixWorld(true);const body=records('箱体')[0];near(body.mesh.position.z,d.H/2,'body stays still on opening');for(const upper of records('上铰链套件'))assert.equal(upper.mesh.parent,v.lid);
 v.open=0;v.explode=1;v.pose();for(const part of v.moves)assert(part.mesh.position.toArray().every(Number.isFinite));
 for(const holder of holders)assert(holder.mesh.position.y>holder.base.y+90);
 console.log(`${id}${whole?' Whole':''}: measured mounts, hinge/lock axes, opening, explosion and recipe verified`);
 for(const set of gs)for(const g of set)g.dispose();for(const [mat] of v.materials)mat.dispose();
}
