import * as T from './vendor/three/three.module.js';
import {OrbitControls} from './vendor/three/OrbitControls.js';
import {createModuleAssembly,geometries,pruneGeometries} from './assembly-viewer.mjs?revision=stack-preview-1';
import {verifyPreviewRoof} from './roof-options.mjs?revision=flip-roof-load-2';
import {stackLayout,stackModulePosition} from './stack-layout.mjs?revision=stack-preview-1';

const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export class StackViewer{
 constructor(host){
  this.host=host;this.token=0;this.key='';this.modules=[];this.jobs=new Map();this.active=false;this.dirty=true;
  host.innerHTML=`<div class="stack-scene-top"><div><strong>三维组合预览</strong><span class="stack-scene-summary" role="status"></span></div><button class="stack-camera-reset" type="button">复位视角 ↺</button></div><div class="stack-scene-status" role="status">正在准备真实模型…</div><span class="stack-scene-gesture">拖动旋转 · 滚轮缩放 · 右键平移</span><span class="stack-scene-caption">按当前布局装配 · 备用件仅计入打印清单</span>`;
  this.status=host.querySelector('.stack-scene-status');this.summary=host.querySelector('.stack-scene-summary');
  this.renderer=new T.WebGLRenderer({antialias:true,alpha:true});this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.localClippingEnabled=true;
  this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFSoftShadowMap;
  this.renderer.domElement.setAttribute('aria-label','按当前模块位置与顺序堆叠的真实三维模型');host.prepend(this.renderer.domElement);
  this.scene=new T.Scene();this.scene.background=new T.Color('#F5F6F1');this.camera=new T.PerspectiveCamera(35,1,.5,100000);this.camera.up.set(0,0,1);
  this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.enableDamping=true;this.controls.dampingFactor=.12;this.controls.minDistance=60;this.controls.maxDistance=100000;this.controls.addEventListener('change',()=>this.dirty=true);
  this.scene.add(new T.HemisphereLight(0xffffff,0x9b9e91,1.4));
  this.sun=new T.DirectionalLight(0xffffff,2.1);this.sun.castShadow=true;this.sun.shadow.mapSize.set(2048,2048);this.sun.shadow.bias=-.00005;this.sun.shadow.normalBias=.35;this.scene.add(this.sun,this.sun.target);
  const fill=new T.DirectionalLight(0xffffff,.7);fill.position.set(400,-250,300);this.scene.add(fill);
  this.ground=new T.Mesh(new T.PlaneGeometry(1,1),new T.ShadowMaterial({opacity:.10}));this.ground.receiveShadow=true;this.scene.add(this.ground);
  this.root=new T.Group();this.scene.add(this.root);this.camera.position.set(260,400,240);this.controls.target.set(0,0,100);
  this.resize=new ResizeObserver(()=>this.size());this.resize.observe(host);
  this.inView=true;this.intersection=new IntersectionObserver(entries=>{this.inView=entries[0].isIntersecting;});this.intersection.observe(host);
  this.tick=()=>{this.frame=requestAnimationFrame(this.tick);if(!this.active||!this.inView)return;const changed=this.controls.update();if(this.dirty||changed){this.renderer.render(this.scene,this.camera);this.dirty=false;}};this.tick();
  host.querySelector('.stack-camera-reset').onclick=()=>this.fitCamera(true);
  this.renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();this.key='';this.status.hidden=false;this.status.textContent='三维显示已暂停，可先返回二维，再重新打开预览。';host.dataset.previewState='error';});
 }
 setActive(active){
  this.active=active;
  if(active){this.size();this.dirty=true;}
  else if(this.host.dataset.previewState==='loading'){this.token++;this.key='';}
 }
 size(){const {width,height}=this.host.getBoundingClientRect();if(!width||!height)return;this.renderer.setSize(width,height);this.camera.aspect=width/height;this.camera.updateProjectionMatrix();this.dirty=true;}
 clear(){for(const module of this.modules)module.clear();this.modules=[];this.root.clear();}
 async preview(entry,token){
  const spec={model:entry.model.id,...entry.options},key=JSON.stringify(spec);
  if(this.jobs.has(key))return this.jobs.get(key);
  let response=await fetch('/api/preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(spec)});
  let job=await response.json();if(!response.ok)throw Error(job.error||'本机模型服务暂不可用');
  while(job.status!=='done'){
   if(job.status==='error')throw Error(job.error||'模型准备失败');
   if(token!==this.token)return null;
   this.status.textContent=`准备 ${entry.model.family+entry.model.depth+'F'+entry.model.floor} · ${job.done}/${job.total} 个零件`;
   await pause(700);response=await fetch('/api/preview-job/'+job.id,{cache:'no-store'});job=await response.json();if(!response.ok)throw Error(job.error||'模型进度读取失败');
  }
  verifyPreviewRoof(entry.model,entry.options.roof,job.data.parts);this.jobs.set(key,job.data.parts);return job.data.parts;
 }
 async update(items,catalog){
  const entries=stackLayout(items,catalog),key=JSON.stringify(entries.map(e=>[e.id,e.model.id,e.x,e.z,e.colour,e.options]));
  if(key===this.key)return;this.key=key;this.last={items:structuredClone(items),catalog};const token=++this.token;
  this.host.dataset.previewState='loading';this.host.dataset.moduleCount='0';this.status.hidden=false;this.status.replaceChildren();this.status.textContent='正在按当前布局装配真实模型…';this.root.visible=false;this.dirty=true;
  if(!entries.length){this.clear();this.status.textContent='从左侧添加模块后，可在这里查看三维组合。';this.summary.textContent='暂无模块';this.host.dataset.previewState='empty';return;}
  const assembled=[];
  try{
   const palettes={light:'#D1D3D5',dark:'#454749',orange:'#F58238',label:'#F4F2EB'};
   const loaded=new Map(),activeURLs=new Set();
   for(let index=0;index<entries.length;index++){
    if(token!==this.token)break;const entry=entries[index];
    this.status.textContent=`装配 ${index+1}/${entries.length} · ${entry.model.family+entry.model.depth+'F'+entry.model.floor}`;
    const parts=await this.preview(entry,token);if(!parts||token!==this.token)break;
    const assets=[];
    for(const part of parts){activeURLs.add(part.asset.url);if(!loaded.has(part.asset.url))loaded.set(part.asset.url,geometries(part.asset));assets.push(await loaded.get(part.asset.url));if(token!==this.token)break;}
    if(token!==this.token)break;
    const module=createModuleAssembly(entry.model,parts,assets,{...palettes,light:entry.colour||palettes.light});
    const body=parts.find(p=>['柜体','箱体'].includes(p.role));module.root.position.set(...stackModulePosition(entry,body.asset.size[1]));module.root.userData={id:entry.id,model:entry.model.id,roof:entry.options.roof};
    // Per-module clipping planes use world coordinates in the combined scene.
    for(const clip of module.keyClips)clip.plane.constant+=module.root.position.y;
    assembled.push(module);
   }
   if(token!==this.token){for(const module of assembled)module.clear();return;}
   this.clear();this.modules=assembled;for(const module of assembled)this.root.add(module.root);
   pruneGeometries(activeURLs);this.root.visible=true;this.status.hidden=true;this.host.dataset.previewState='ready';this.host.dataset.moduleCount=String(assembled.length);
   this.host.dataset.layout=JSON.stringify(assembled.map(module=>({id:module.root.userData.id,model:module.m.id,position:module.root.position.toArray(),roof:module.root.userData.roof})));
   this.summary.textContent=`${assembled.length} 个模块 · 顶盖、网格与齿条随当前选择`;
   this.fitCamera(!this.hasView);this.hasView=true;this.dirty=true;
  }catch(error){
   for(const module of assembled)module.clear();if(token!==this.token)return;this.key='';this.host.dataset.previewState='error';
   this.status.textContent='三维预览未载入：'+error.message;
   const retry=document.createElement('button');retry.type='button';retry.textContent='重试';retry.onclick=()=>this.update(this.last.items,this.last.catalog);this.status.append(retry);
  }
 }
 fitCamera(reset=false){
  if(!this.modules.length)return;this.root.updateMatrixWorld(true);
  const box=new T.Box3().setFromObject(this.root),size=box.getSize(new T.Vector3()),center=box.getCenter(new T.Vector3());
  const direction=reset?new T.Vector3(.65,1,.55).normalize():this.camera.position.clone().sub(this.controls.target).normalize();
  const radius=size.length()/2,fov=T.MathUtils.degToRad(this.camera.fov/2),horizontal=Math.atan(Math.tan(fov)*Math.max(.1,this.camera.aspect));
  const distance=Math.max(radius/Math.sin(Math.min(fov,horizontal))*1.12,100);
  this.controls.target.copy(center);this.camera.position.copy(center).addScaledVector(direction,distance);this.camera.far=Math.max(10000,distance+radius*8);this.camera.updateProjectionMatrix();this.controls.update();
  const span=Math.max(size.x,size.y,size.z,100);this.ground.position.set(center.x,center.y,box.min.z-2);this.ground.scale.setScalar(span*8);
  this.sun.position.copy(center).add(new T.Vector3(-span*.8,span,span*2));this.sun.target.position.copy(center);
  Object.assign(this.sun.shadow.camera,{left:-span,right:span,top:span,bottom:-span,near:1,far:span*6});this.sun.shadow.camera.updateProjectionMatrix();this.dirty=true;
 }
}
