import * as T from './vendor/three/three.module.js';
import {roofChoices,selectedRoof,roofDescription,verifyPreviewRoof} from './roof-options.mjs?revision=flip-roof-load-2';
import {OrbitControls} from './vendor/three/OrbitControls.js';
import {sustainerDatums,alignedSustainerPart,sustainerLockPose,sustainerLockPlacement} from './sustainer-alignment.mjs?revision=flip-roofs-1';
import {drawerDatums,alignedDrawerPart} from './drawer-alignment.mjs?revision=xl-drawers-1';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const cache=new Map();
export async function geometries(asset){
 if(cache.has(asset.url))return cache.get(asset.url);
 const r=await fetch(asset.url,{cache:'no-store'});if(!r.ok)throw Error('三维零件读取失败');const buffer=await r.arrayBuffer();
 const gs=asset.components.map(c=>{const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(new Float32Array(buffer,c.offset,c.vertices*3),3));g.setIndex(new T.BufferAttribute(new Uint32Array(buffer,c.indexOffset??c.offset+c.vertices*12,c.indices),1));if(c.normalOffset!==undefined)g.setAttribute('normal',new T.BufferAttribute(new Float32Array(buffer,c.normalOffset,c.vertices*3),3));else g.computeVertexNormals();return g;});
 cache.set(asset.url,gs);return gs;
}
export function pruneGeometries(active){
 for(const [url,gs] of cache)if(!active.has(url)){for(const g of gs)g.dispose();cache.delete(url);}
}
// Share the measured assembly rules without creating a renderer for each box.
export function createModuleAssembly(m,parts,assets,colours){
 const module=Object.create(AssemblyViewer.prototype);
 Object.assign(module,{root:new T.Group(),materials:[],moves:[],decorations:[],colours:{...colours},m,explode:0,open:0});
 module.assemble(m,parts,assets);
 return module;
}
export class AssemblyViewer{
 constructor(host,{onRoofChange}={}){
  this.onRoofChange=onRoofChange;
  this.host=host;this.token=0;this.key='';this.colours={};this.materials=[];this.moves=[];this.decorations=[];this.explode=0;this.open=0;this.targetE=0;this.targetO=0;
  host.innerHTML=`<div class="viewer-top"><span class="viewer-model-name">真实 STL · 三维装配</span><button data-action="camera" title="复位视角">复位视角 ↺</button></div><div class="viewer-body"><div class="viewer-stage"><div class="viewer-status" role="status">正在准备三维视图…</div><span class="viewer-gesture">拖动旋转 · 滚轮缩放 · 右键平移</span></div><aside class="viewer-roofs" aria-label="顶盖款式" hidden><strong>顶盖款式</strong><div class="viewer-roof-options" role="group" aria-label="选择顶盖款式"></div></aside></div><div class="viewer-toolbar"><button data-action="assembled" class="active">装配</button><button data-action="explode">爆炸图</button><button data-action="open">拉开抽屉</button><button data-action="fullscreen" title="放大三维区域">放大 ↗</button></div><div class="viewer-ranges"><label>拆解程度<input aria-label="拆解程度" type="range" min="0" max="100" value="0" data-range="explode"></label><label><span class="open-label">抽屉开合</span><input aria-label="开合程度" type="range" min="0" max="100" value="0" data-range="open"></label></div><p class="viewer-caption">原始 STL 轻量显示网格 · 展示装配，不验证机械公差与干涉</p>`;
  this.stage=host.querySelector('.viewer-stage');this.stage.addEventListener('webglcontextlost',e=>{e.preventDefault();this.status.hidden=false;this.status.textContent='三维显示已暂停，请刷新页面重新载入。';});this.status=host.querySelector('.viewer-status');
  try{
   this.renderer=new T.WebGLRenderer({antialias:true,alpha:true});this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.localClippingEnabled=true;this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFSoftShadowMap;this.stage.prepend(this.renderer.domElement);this.renderer.domElement.setAttribute('aria-label','可旋转的真实 STL 三维模型');
   this.scene=new T.Scene();this.scene.background=new T.Color('#F5F6F1');this.camera=new T.PerspectiveCamera(35,1,.5,10000);this.camera.up.set(0,0,1);
   this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.dirty=true;this.controls.addEventListener('change',()=>this.dirty=true);this.controls.enableDamping=true;this.controls.dampingFactor=.12;this.controls.minDistance=60;this.controls.maxDistance=4000;
   this.scene.add(new T.HemisphereLight(0xffffff,0x9b9e91,1.4));const sun=new T.DirectionalLight(0xffffff,2.1);sun.position.set(-250,350,650);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-700,right:700,top:700,bottom:-700,near:1,far:1800});sun.shadow.bias=-.00005;sun.shadow.normalBias=.35;this.scene.add(sun);const fill=new T.DirectionalLight(0xffffff,.7);fill.position.set(400,-250,300);this.scene.add(fill);
   this.ground=new T.Mesh(new T.PlaneGeometry(3000,3000),new T.ShadowMaterial({opacity:.10}));this.ground.position.z=-1;this.ground.receiveShadow=true;this.scene.add(this.ground);
   this.root=new T.Group();this.scene.add(this.root);this.resize=new ResizeObserver(()=>this.size());this.resize.observe(this.stage);
   this.visible=true;new IntersectionObserver(es=>{this.visible=es[0].isIntersecting;}).observe(host);
   this.tick=()=>{this.frame=requestAnimationFrame(this.tick);if(!this.visible)return;this.explode+=(this.targetE-this.explode)*.13;this.open+=(this.targetO-this.open)*.13;this.pose();const changed=this.controls.update();if(this.dirty||changed||Math.abs(this.targetE-this.explode)>.0001||Math.abs(this.targetO-this.open)>.0001){this.renderer.render(this.scene,this.camera);this.dirty=false;}};this.tick();
  }catch(e){this.status.textContent='当前浏览器无法启动三维显示：'+e.message;this.failed=true;}
  host.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>{const a=b.dataset.action;if(a==='camera')this.resetCamera();if(a==='assembled'){this.targetE=0;this.targetO=0;}if(a==='explode')this.targetE=this.targetE>.5?0:1;if(a==='open')this.targetO=this.targetO>.5?0:1;if(a==='fullscreen'){if(document.fullscreenElement)document.exitFullscreen();else host.requestFullscreen?.();}this.sync();});
  host.querySelectorAll('[data-range]').forEach(i=>i.oninput=()=>{if(i.dataset.range==='explode')this.targetE=+i.value/100;else this.targetO=+i.value/100;this.sync();});
 }
 size(){const {width,height}=this.stage.getBoundingClientRect();if(!width||!height||!this.renderer)return;this.dirty=true;this.renderer.setSize(width,height);this.camera.aspect=width/height;this.camera.updateProjectionMatrix();}
 sync(){this.host.querySelector('[data-range="explode"]').value=this.targetE*100;this.host.querySelector('[data-range="open"]').value=this.targetO*100;this.host.querySelector('[data-action="explode"]').classList.toggle('active',this.targetE>.01);this.host.querySelector('[data-action="open"]').classList.toggle('active',this.targetO>.01);this.host.querySelector('[data-action="assembled"]').classList.toggle('active',this.targetE===0&&this.targetO===0);if(this.moves.length)this.fitCamera();}
 resetCamera(){if(!this.m||!this.camera)return;this.camera.position.set(260,400,240);this.controls.target.set(0,0,this.m.height*.5);this.fitCamera();}
 fitCamera(){
  if(!this.moves.length)return;const e=this.explode,o=this.open;this.explode=this.targetE;this.open=this.targetO;this.pose();this.root.updateMatrixWorld(true);const box=new T.Box3().setFromObject(this.root),size=box.getSize(new T.Vector3()),center=box.getCenter(new T.Vector3());this.explode=e;this.open=o;this.pose();
  const direction=this.camera.position.clone().sub(this.controls.target).normalize();const distance=Math.max(size.z,size.x/Math.max(.5,this.camera.aspect),size.y*.85)/(2*Math.tan(T.MathUtils.degToRad(this.camera.fov/2)))*1.35+size.y*.35;if(this.ground)this.ground.position.z=box.min.z-2;this.controls.target.copy(center);this.camera.position.copy(center).addScaledVector(direction,distance);this.controls.update();
 }

 paint(colours){this.dirty=true;this.colours=colours;for(const [mat,slot] of this.materials)mat.color.set(colours[slot]||'#D1D3D5');}
 renderRoofs(m,options){
  const panel=this.host.querySelector('.viewer-roofs');panel.hidden=false;
  const styles=roofChoices(m);
  const current=selectedRoof(m,options.roof),list=panel.querySelector('.viewer-roof-options');
  if(panel.dataset.roofModel!==m.id){
   panel.dataset.roofModel=m.id;list.replaceChildren();
   for(const [value,title] of styles){
    const b=document.createElement('button');b.type='button';b.dataset.roof=value;b.setAttribute('aria-label',title);
    const details=value==='Split'?'<path d="M20 16l24 10" stroke-dasharray="2 2"/>':value==='Grid'?'<path d="M19 13l22 13m-14-17l22 13M19 23L43 10m-14 19l24-13"/>':value==='Bowl'?'<path d="M9 21v-8l24-8 24 10v8M9 13l24 10 24-8"/>':value==='Under Table Mount'?'<path d="M9 17H3v8h10m44-8h6v8H53"/>':value==='none'?'<path d="M16 31L50 7"/>':'';
    b.innerHTML=`<svg viewBox="0 0 66 40" aria-hidden="true"><path d="M9 20l24-8 24 10-24 8z" class="roof-icon-face" ${value==='none'?'stroke-dasharray="3 3"':''}/>${details}</svg><span>${title}</span>`;
    b.onclick=()=>this.onRoofChange?.(value);list.append(b);
   }
  }
  for(const b of list.children){const active=b.dataset.roof===current;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));}
 }
 async update(m,options,colours){
  options={...options};this.renderRoofs(m,options);this.paint(colours);if(this.failed)return;const key=JSON.stringify([m.id,options.roof,options.grid,options.rails]);if(key===this.key)return;this.key=key;const token=++this.token,preserveView=this.m?.id===m.id&&this.moves.length>0;this.m=m;if(!preserveView)this.targetE=this.targetO=this.explode=this.open=0;this.sync();this.host.querySelector('[data-action="open"]').textContent=m.kind==='drawer'?'拉开抽屉':'打开盖子';this.host.querySelector('.viewer-caption').textContent=m.kind==='drawer'?'原始 STL 展示装配 · 旋钮圆饰片仅为预览装饰，未含独立 STL':'原始 STL 轻量显示网格 · 展示装配，不验证机械公差与干涉';this.host.querySelector('.open-label').textContent=m.kind==='drawer'?'抽屉开合':'盖子开合';this.status.hidden=false;this.status.textContent='正在载入 '+roofDescription(m,options.roof)+' 的真实 STL…';this.host.dataset.previewState='loading';delete this.host.dataset.loadedRoof;this.host.querySelector('.viewer-model-name').textContent='正在载入 · '+roofDescription(m,options.roof);this.root.visible=false;this.dirty=true;
  try{
   let r=await fetch('/api/preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:m.id,...options})});let j=await r.json();if(!r.ok)throw Error(j.error||'三维服务尚未就绪，请重新启动本机工作台');
   while(j.status!=='done'){if(token!==this.token)return;if(j.status==='error')throw Error(j.error);this.status.textContent=`准备三维零件 ${j.done}/${j.total} · ${j.current||''}`;await pause(800);r=await fetch('/api/preview-job/'+j.id,{cache:'no-store'});j=await r.json();if(!r.ok)throw Error(j.error||'三维进度读取失败');}
   if(token!==this.token)return;const loadedRoof=verifyPreviewRoof(m,options.roof,j.data.parts);
   const assets=await Promise.all(j.data.parts.map(p=>geometries(p.asset)));if(token!==this.token)return;
   this.clear();const active=new Set(j.data.parts.map(p=>p.asset.url));for(const [url,gs] of cache){if(cache.size<=70)break;if(!active.has(url)){for(const g of gs)g.dispose();cache.delete(url);}}this.assemble(m,j.data.parts,assets);this.host.dispatchEvent?.(new CustomEvent('assembly-measured',{detail:{model:m,roof:loadedRoof,parts:j.data.parts}}));this.paint(this.colours);this.root.visible=true;this.dirty=true;this.status.hidden=true;this.host.dataset.previewState='ready';this.host.dataset.loadedRoof=loadedRoof;this.host.querySelector('.viewer-model-name').textContent='已载入 · '+roofDescription(m,loadedRoof)+' · 真实 STL';if(preserveView)this.fitCamera();else this.resetCamera();
  }catch(e){if(token!==this.token)return;this.key='';this.host.dataset.previewState='error';this.host.querySelector('.viewer-model-name').textContent='模型未载入 · '+roofDescription(m,options.roof);this.status.textContent='三维预览未载入：'+e.message;const b=document.createElement('button');b.textContent='重试';b.onclick=()=>{this.key='';this.update(m,options,this.colours);};this.status.append(b);}
 }
 clear(){this.root.clear();for(const mesh of this.decorations||[])mesh.geometry.dispose();this.decorations=[];for(const [mat] of this.materials)mat.dispose();this.materials=[];this.moves=[];this.keyClips=[];this.lid=null;}
 assemble(m,parts,assets){
  const main=parts.find(p=>['柜体','箱体'].includes(p.role));const W=main?.asset.size[0]||m.width,D=main?.asset.size[1]||m.nominalDepth+20,H=main?.asset.size[2]||m.height;this.D=D;
  const sustainer=m.kind==='sustainer'?sustainerDatums(m,parts):null;this.sustainer=sustainer;
  const twin=m.variant==='twin',cuts=twin?[164.8,W-164.8]:[W];const centers=cuts.map((w,i)=>-W/2+cuts.slice(0,i).reduce((a,b)=>a+b,0)+w/2);
  const lid=new T.Group();lid.position.set(0,-D/2,H-5);this.root.add(lid);this.lid=lid;if(sustainer)lid.position.set(0,sustainer.axisY,sustainer.rim);
  let sequence={};const datums=m.kind==='drawer'?drawerDatums(m,parts):null;this.datums=datums;
  if(datums){
   datums.keyAsset=parts.find(p=>p.role==='旋钮锁芯')?.asset;datums.capAsset=parts.find(p=>p.role==='旋钮帽')?.asset;
   const fronts=parts.filter(p=>p.role==='抽屉盒'||p.role==='抽屉盒分件'&&p.path.includes('Part 1'));
   datums.boxAssets=datums.frames.map(f=>[...fronts].sort((a,b)=>Math.abs(a.asset.size[0]-(f.width-30.6))-Math.abs(b.asset.size[0]-(f.width-30.6)))[0]?.asset);
   // Split XL6/7 boxes retain the one-piece XL boxes' 2.2mm depth clearance.
   datums.boxDepths=datums.frames.map((f,i)=>parts.some(p=>p.role==='抽屉盒分件')?D-2.2:datums.boxAssets[i]?.size[1]);
  }
  parts.forEach((p,pi)=>{
   const role=p.role,gs=assets[pi],multi=['弹簧套件','堆叠锁扣','加强齿条套件','上铰链套件','下铰链套件','铰链轴套件','锁扣插销套件'].includes(role);
   const mat=new T.MeshStandardMaterial({color:this.colours[p.slot]||p.colour,roughness:.58,metalness:0,side:T.DoubleSide});this.materials.push([mat,p.slot]);
   for(let copy=0;copy<p.qty;copy++)gs.forEach((g,ci)=>{
    const c=p.asset.components[ci],sz=c.size;let n=(sequence[role]||0);sequence[role]=n+1;let drawer=twin?Math.floor(n/Math.max(1,p.qty*gs.length/2))%2:0;
    const match=p.path.split('/').pop().match(/^(XL|S|M|L)\d/);if(twin&&match){const ww={S:164.8,M:254,L:329.6,XL:418.8}[match[1]];drawer=Math.abs(ww-cuts[0])<=Math.abs(ww-cuts[1])?0:1;if(Math.abs(cuts[0]-cuts[1])<1)drawer=n%2;}
    const x=centers[drawer],w=cuts[drawer],side=n%2?-1:1;let pos=[x,0,sz[2]/2+5],ex=[0,0,40],moving=false,onLid=false;
    if(['柜体','箱体'].includes(role)){pos=[0,0,H/2];ex=[0,0,0];}
    else if(role==='顶盖'){pos=[0,0,H-9+sz[2]/2];ex=[0,0,85];}
    else if(['抽屉盒','抽屉盒分件','抽屉背板'].includes(role)){pos=[x,0,sz[2]/2+4];ex=[0,D*.55,18];moving=true;if(role.includes('分件'))pos[0]+=side*w*.22;}
    else if(['面板','前面板'].includes(role)){pos=[x,D/2+sz[1]/2-6,sz[2]/2+1];ex=[0,D*.95,10];moving=m.kind==='drawer';}
    else if(role==='旋钮锁芯'){pos=[x,D/2-15,m.height*.32];ex=[0,D*1.3,5];moving=true;}
    else if(role==='旋钮帽'){pos=[x,D/2+12,m.height*.32];ex=[0,D*1.55,5];moving=true;}
    else if(role==='面板端盖'){pos=[x+side*w*.32,D/2+3,m.height*.67];ex=[side*15,D*1.3,0];moving=true;}
    else if(['标签','锁扣标签','箱体标签'].includes(role)){pos=[m.kind==='drawer'?x-32:side*W*.32,D/2+(m.kind==='drawer'?5:16),m.kind==='drawer'?m.height*.32:H*(role==='箱体标签'?.53:.25)];ex=[0,D*1.6,15];moving=m.kind==='drawer';}
    else if(role==='弹簧套件'){pos=[x+side*25,D/2-8,m.height*.32];ex=[side*20,D*1.15,20];moving=true;}
    else if(['导轨','滑轨','加强齿条套件'].includes(role)){pos=[x+side*(w/2-(role==='导轨'?9:18)),0,role==='导轨'?18:15];ex=[side*(45+ci*6),role==='导轨'?0:D*.4,10];moving=role!=='导轨';}
    else if(role==='限位件'){pos=[x+side*(w/2-10),D/2-9,8];ex=[side*35,25,-15];}
    else if(role==='堆叠锁扣'){pos=[0,0,3];ex=[0,-25,-50-ci*8];}
    else if(role.startsWith('网格收纳底板')){pos=[x,0,8+sz[2]/2];ex=[0,D*.5,65];moving=m.kind==='drawer';}
    else if(['翻盖','翻盖分件','翻盖连接件'].includes(role)){pos=[0,D/2,sz[2]/2];ex=[role.includes('分件')?side*40:0,0,85];onLid=true;if(role.includes('分件'))pos[0]=side*W*.24;}
    else if(role.includes('铰链')){pos=[side*W*.32,-D/2+4,H-sz[2]/2];ex=[side*15,-50,40];if(role==='上铰链套件'){pos=[0,10,-10];onLid=true;}}
    else if(role.includes('密封')){pos=[(n-(p.qty-1)/2)*W/(p.qty+1),0,sz[2]/2+4];ex=[0,0,70+n*15];}
    else if(role.includes('锁扣')){pos=[side*W*.32,D/2+6,H*.4];ex=[side*10,60+ci*15,0];}
    else if(role==='双抽屉中间连接件'){pos=[0,0,H/2];ex=[0,-50,20];}
    const aligned=datums?alignedDrawerPart(datums,p,c,{drawer,n,component:ci}):sustainer?alignedSustainerPart(sustainer,p,c,{n,component:ci}):null;const mesh=new T.Mesh(g,mat);if(aligned){pos=aligned.position;ex=aligned.explosion;moving=aligned.moving;onLid=aligned.onLid??false;mesh.rotation.set(...aligned.rotation);}else if(['旋钮锁芯','旋钮帽','面板端盖','标签','锁扣标签','箱体标签'].includes(role))mesh.rotation.z=Math.PI;mesh.position.set(...pos);mesh.castShadow=true;mesh.receiveShadow=false;mesh.userData={role,path:p.path,name:p.name,drawer:aligned?.drawer??drawer,anchor:aligned?.anchor};(onLid?lid:this.root).add(mesh);this.moves.push({mesh,base:new T.Vector3(...pos),ex:new T.Vector3(...ex),moving,lockMotion:aligned?.lockMotion});
   });
  });
  this.decorations=[];if(m.kind==='drawer')for(const cap of this.moves.filter(p=>p.mesh.userData.role==='旋钮帽')){const bore=datums.capAsset.landmarks?.frontBore||{x:-12.3125,z:0,radius:3.2225};const mat=new T.MeshStandardMaterial({color:this.colours.label||'#F4F2EB',roughness:.65});const disc=new T.Mesh(new T.CylinderGeometry(bore.radius-.08,bore.radius-.12,.45,48),mat);disc.position.set(bore.x,-datums.capAsset.size[1]/2+.205,bore.z);disc.userData={role:'旋钮圆饰片',previewOnly:true};disc.castShadow=true;cap.mesh.add(disc);this.decorations.push(disc);this.materials.push([mat,'label']);}
  this.keyClips=[];if(m.kind==='drawer')for(const key of this.moves.filter(p=>p.mesh.userData.role==='旋钮锁芯')){const cap=this.moves.find(p=>p.mesh.userData.role==='旋钮帽'&&p.mesh.userData.drawer===key.mesh.userData.drawer);if(!cap)continue;const slot=this.materials.find(([mat])=>mat===key.mesh.material)?.[1];key.mesh.material=key.mesh.material.clone();const plane=new T.Plane(new T.Vector3(0,-1,0),0);key.mesh.material.clippingPlanes=[plane];key.mesh.material.clipShadows=true;this.materials.push([key.mesh.material,slot]);this.keyClips.push({plane,cap,depth:datums.capAsset.size[1]});}
  this.pose();
 }
 pose(){const release=Math.min(1,Math.max(this.open*5,this.explode*3)),lockPose=this.sustainer?sustainerLockPose(this.sustainer,release):null;for(const p of this.moves){if(p.lockMotion){const placed=sustainerLockPlacement(p.lockMotion,lockPose);p.mesh.position.set(...placed.position);p.mesh.rotation.set(...placed.rotation);}else p.mesh.position.copy(p.base);p.mesh.position.addScaledVector(p.ex,this.explode);if(p.moving)p.mesh.position.y+=this.open*this.D*.78;}for(const c of this.keyClips||[])c.plane.constant=c.cap.mesh.position.y+c.depth/2-.25;if(this.lid)this.lid.rotation.x=this.m.kind==='sustainer'?Math.max(0,(this.open-.2)/.8)*Math.PI*.47:0;}
}
