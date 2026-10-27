import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../dist/vendor/three/three.module.js';
import {AssemblyViewer} from '../dist/assembly-viewer.mjs';
const catalog=JSON.parse(fs.readFileSync(new URL('../dist/catalog.json',import.meta.url)));
const measured=JSON.parse(fs.readFileSync(new URL('./facade-datums.json',import.meta.url)));
for(const m of catalog.modules.filter(m=>m.kind==='drawer')){const expected=m.parts.filter(p=>p.role==='面板').reduce((n,p)=>n+p.qty*measured[p.path].capQuantity,0);assert.equal(m.parts.filter(p=>p.role==='面板端盖').reduce((n,p)=>n+p.qty,0),expected,`${m.id}: print recipe must match measured holes`);}
for(const id of ['d-S3-1','d-S3-2','s-S3-2-standard','d-L3-2-twin','s-L3-2-sealed','d-S3-4','d-M3-4','d-XL3-1-twin']){
 const data=JSON.parse(fs.readFileSync(new URL('./assembly-fixtures/'+id+'-verified.json',import.meta.url))),m=catalog.modules.find(m=>m.id===id);
 const geometries=data.parts.map(p=>{
  const bytes=fs.readFileSync(new URL('../dist/'+p.asset.url,import.meta.url));let end=0,triangles=0;
  const gs=p.asset.components.map(c=>{
   assert.equal(c.offset,end,'component offsets must be contiguous');assert.equal(c.indices%3,0,'all triangle indices must be included');
   const copy=Uint8Array.from(bytes).buffer,g=new T.BufferGeometry();const pos=new Float32Array(copy,c.offset,c.vertices*3),idx=new Uint32Array(copy,c.indexOffset??c.offset+c.vertices*12,c.indices);
   for(const n of pos)assert(Number.isFinite(n));for(const n of idx)assert(n<c.vertices,'indices must address this component');
   g.setAttribute('position',new T.BufferAttribute(pos,3));g.setIndex(new T.BufferAttribute(idx,1));if(c.normalOffset!==undefined){const normal=new Float32Array(copy,c.normalOffset,c.vertices*3);for(let i=0;i<normal.length;i+=3)assert(Math.abs(Math.hypot(normal[i],normal[i+1],normal[i+2])-1)<.001,'unit crease normals');}end+=(c.normalOffset!==undefined?c.vertices*24:c.vertices*12)+c.indices*4;triangles+=c.indices/3;return g;
  });assert.equal(end,bytes.length);assert.equal(triangles,p.asset.displayTriangles);return gs;
 });
 const v=Object.create(AssemblyViewer.prototype);Object.assign(v,{root:new T.Group(),materials:[],moves:[],colours:{light:'#8FA5B8',dark:'#454749',orange:'#F58238',label:'#F4F2EB'},m,explode:0,open:0});v.assemble(m,data.parts,geometries);
 if(m.kind==='drawer'){
  const d=v.datums,near=(a,b,label)=>assert(Math.abs(a-b)<.06,`${id}: ${label} (${a} versus ${b})`);
  const capCount=v.moves.filter(p=>p.mesh.userData.role==='面板端盖').length;assert.equal(capCount,d.frames.reduce((n,f)=>n+f.holes.length-1,0));
  for(const f of d.frames){
   assert.equal(f.holes.length,f.face.asset.landmarks.holes.length,'use measured facade holes');assert(f.holes.every(h=>Math.abs(h.radius-5)<.02));
   const caps=v.moves.filter(p=>p.mesh.userData.role==='面板端盖'&&p.mesh.userData.drawer===d.frames.indexOf(f));
   for(const h of f.capHoles)assert(caps.some(p=>Math.hypot(p.base.x-h.x,p.base.z-h.z)<.02),'every exposed hole has one concentric cap');for(const cap of caps)near(cap.base.y+data.parts.find(p=>p.role==='面板端盖').asset.landmarks.planes.y.find(p=>p.normal===1).at,f.faceFront+.02,'cap front flush with facade');
   near(f.axisZ,d.outsideFloor+23.5,'lock axis follows fixed bottom-row datum');
   const key=v.moves.find(p=>p.mesh.userData.role==='旋钮锁芯'&&p.mesh.userData.drawer===d.frames.indexOf(f));near(key.base.x,f.x,'key concentric X');near(key.base.z,f.axisZ,'key concentric Z');near(key.mesh.rotation.z,0,'key shaft faces outward');
   const cap=v.moves.find(p=>p.mesh.userData.role==='旋钮帽'&&p.mesh.userData.drawer===d.frames.indexOf(f));near(cap.base.z,key.base.z,'key cap shares shaft axis');
   const keyA=data.parts.find(p=>p.role==='旋钮锁芯').asset,capA=data.parts.find(p=>p.role==='旋钮帽').asset;
   const shoulder=keyA.landmarks.planes.y.find(p=>p.normal===1&&p.at>0&&p.area>300).at;near(cap.base.y-capA.size[1]/2,key.base.y+shoulder+.02,'cap rear rim touches key shoulder');
   const box=v.moves.find(p=>p.mesh.userData.role==='抽屉盒'&&p.mesh.userData.drawer===d.frames.indexOf(f));const boxA=d.boxAssets[d.frames.indexOf(f)];near(box.base.z-boxA.size[2]/2,d.insideFloor+.2,'box clears cabinet inside floor');near(box.base.y+boxA.size[1]/2,f.faceBack,'facade attaches to box front');
   for(const guide of v.moves.filter(p=>['导轨','滑轨'].includes(p.mesh.userData.role)&&p.mesh.userData.drawer===d.frames.indexOf(f)))assert(Array.from({length:m.floor},(_,i)=>f.axisZ+48*i).some(z=>Math.abs(guide.base.z-z)<.06),'runners match each 48mm channel');
   const stops=v.moves.filter(p=>p.mesh.userData.role==='限位件'&&p.mesh.userData.drawer===d.frames.indexOf(f));assert.equal(stops.length,m.floor*2);for(const stop of stops){assert(d.runnerPorts.some(port=>Math.abs(stop.base.y-port.y)<.03&&Math.abs(stop.base.z-(d.H/2+port.z))<.03),'stopper concentric with measured side port');assert.equal(stop.ex.y,0);assert.equal(stop.ex.z,0);assert(Math.abs(stop.ex.x)>30);}
   const boxMove=v.moves.find(p=>p.mesh.userData.role==='抽屉盒'&&p.mesh.userData.drawer===d.frames.indexOf(f));assert.equal(boxMove.ex.z,0,'drawer explosion must not lift');assert.equal(boxMove.ex.x,0);
   const latch=v.moves.find(p=>p.mesh.userData.role==='堆叠锁扣'&&p.mesh.userData.drawer===d.frames.indexOf(f));assert(latch.base.y<-20,'latch at rear mounting bay');const latchA=data.parts.find(p=>p.role==='堆叠锁扣').asset;near(latch.base.z+latchA.size[2]/2,d.outsideFloor-.15,'latch upper face seated under groove ceiling');assert(latch.base.z-latchA.size[2]/2>0,'latch contained inside bottom groove height');const stop=d.bodyAsset.landmarks.planes.y.find(p=>p.normal===-1&&Math.abs(p.at-(-d.D/2+63.48))<.3);assert(stop,'source mesh contains latch stop wall');near(latch.base.y+latchA.landmarks.planes.y.find(p=>p.normal===1).at,stop.at-.15,'latch forward tips sit behind groove stop');
   for(const spring of v.moves.filter(p=>p.mesh.userData.role==='弹簧套件'&&p.mesh.userData.drawer===d.frames.indexOf(f))){const side=spring.base.x>f.x?1:-1;const h=f.holes.filter(p=>Math.abs(p.z-f.axisZ)<.1&&side*(p.x-f.x)>0).sort((a,b)=>Math.abs(a.x-f.x)-Math.abs(b.x-f.x))[0];near(spring.base.x+side*13.098,h.x,'spring C-clip mounts onto matching boss');near(spring.base.z,h.z,'spring boss height');}
   const label=v.moves.find(p=>p.mesh.userData.role==='标签'&&p.mesh.userData.drawer===d.frames.indexOf(f)),labelA=data.parts.find(p=>p.role==='标签').asset;const pocket=f.face.asset.landmarks.labelPocket;near(label.base.x+labelA.size[0]/2,f.x+pocket.maxX-.03,'label inside measured pocket edge');near(label.base.y+labelA.landmarks.planes.y.find(p=>p.normal===-1).at,f.faceY+pocket.bedY,'label back contacts pocket bed');assert(label.base.y+labelA.size[1]/2<f.faceFront,'label front remains recessed');
  }
  const roof=v.moves.find(p=>p.mesh.userData.role==='顶盖');const roofA=data.parts.find(p=>p.role==='顶盖').asset;near(roof.base.z+roofA.landmarks.planes.z.find(p=>p.normal===-1).at,d.outsideCeiling,'roof seat contacts outside cabinet ceiling');
  for(const rack of v.moves.filter(p=>p.mesh.userData.role==='加强齿条套件')){rack.mesh.geometry.computeBoundingBox();const size=rack.mesh.geometry.boundingBox.getSize(new T.Vector3());assert(size.x>size.y*5&&size.x>size.z*5,'geared racks run across front width');}
 }
 if(m.kind==='drawer'){assert.equal(v.decorations.length,v.datums.frames.length);v.root.updateMatrixWorld(true);for(const disc of v.decorations){assert.equal(disc.userData.previewOnly,true);const cap=v.moves.find(p=>p.mesh===disc.parent),frame=v.datums.frames[cap.mesh.userData.drawer],center=disc.getWorldPosition(new T.Vector3());assert(center.x<frame.x-10,'accent end faces unlock indicator');const front=cap.mesh.localToWorld(new T.Vector3(disc.position.x,disc.position.y-.225,disc.position.z));assert(Math.abs(front.y-(cap.base.y+v.datums.capAsset.size[1]/2+.02))<.001,'accent front flush with knob cap');}}
 assert.equal(v.moves.length,data.parts.reduce((n,p)=>n+p.qty*p.asset.components.length,0));
 const body=v.moves.find(p=>['柜体','箱体'].includes(p.mesh.userData.role)),stationary=body.mesh.position.clone();v.open=1;v.pose();assert.deepEqual(body.mesh.position.toArray(),stationary.toArray());
 if(m.kind==='drawer'){assert(v.moves.some(p=>p.moving));for(const p of v.moves.filter(p=>p.moving))assert(p.mesh.position.y>p.base.y+v.D*.7);if(m.variant==='twin'){const boxes=v.moves.filter(p=>p.mesh.userData.role==='抽屉盒');assert(boxes.some(p=>p.base.x<0)&&boxes.some(p=>p.base.x>0));}}
 else {assert(v.lid.rotation.x>1.4);v.root.updateMatrixWorld(true);const front=new T.Vector3(0,v.D,0).applyMatrix4(v.lid.matrixWorld);assert(front.z>m.height,'opening the lid must raise its front above the body');}
 v.open=0;v.explode=1;v.pose();assert(v.moves.filter(p=>p.ex.length()>0).every(p=>p.mesh.position.distanceTo(p.base)>1));
 if(m.kind==='drawer'){
  v.root.updateMatrixWorld(true);
  for(const stop of v.moves.filter(p=>p.mesh.userData.role==='限位件')){
   const drawer=stop.mesh.userData.drawer,f=v.datums.frames[drawer],side=Math.sign(stop.base.x-f.x),stopBox=new T.Box3().setFromObject(stop.mesh);
   const inner=side>0?stopBox.min.x:-stopBox.max.x;
   const runners=v.moves.filter(p=>['导轨','滑轨'].includes(p.mesh.userData.role)&&p.mesh.userData.drawer===drawer&&Math.sign(p.base.x-f.x)===side);
   for(const runner of runners){const railBox=new T.Box3().setFromObject(runner.mesh);assert(inner>(side>0?railBox.max.x:-railBox.min.x)+8,`${id}: exploded stopper must sit entirely outside runners`);}
  }
 }
 v.paint(v.colours);assert(v.materials.every(([mat,slot])=>'#'+mat.color.getHexString().toUpperCase()===v.colours[slot]));
 for(const p of v.moves){assert(p.mesh.position.toArray().every(Number.isFinite));}
 console.log(id+': complete triangle buffers, '+v.moves.length+' meshes, opening/explosion/colour verified');
}
