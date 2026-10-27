// Measurements are in source-mesh millimetres. No scaling of display or print meshes.
const levels=(asset,axis)=>asset?.landmarks?.planes?.[axis]||[];
const surface=(asset,axis,normal,fallback)=>levels(asset,axis).find(p=>p.normal===normal)?.at??fallback;
export function drawerDatums(m,parts){
 const body=parts.find(p=>p.role==='柜体'),a=body.asset,[W,D,H]=a.size;
 const large=levels(a,'z').filter(p=>p.area>W*D*.3),bottom=large.filter(p=>p.at<0),top=large.filter(p=>p.at>0);
 const outsideFloor=H/2+(bottom.find(p=>p.normal===-1)?.at??(-H/2+4.8));
 const insideFloor=H/2+(bottom.find(p=>p.normal===1)?.at??(-H/2+7.8));
 const outsideCeiling=H/2+(top.find(p=>p.normal===1)?.at??(m.height+3.8-H/2));
 const cuts=m.variant==='twin'?[164.8,m.width-164.8]:[m.width],centers=cuts.map((w,i)=>-m.width/2+cuts.slice(0,i).reduce((a,b)=>a+b,0)+w/2);
 const frames=centers.map((x,i)=>{
  const faces=parts.filter(p=>p.role==='面板');const face=faces.reduce((best,p)=>Math.abs(p.asset.size[0]-cuts[i])<Math.abs(best.asset.size[0]-cuts[i])?p:best,faces[0]);
  const fa=face.asset,faceZ=outsideFloor+fa.size[2]/2,boxFront=D/2+1;
  const rear=surface(fa,'y',-1,-fa.size[1]/2),front=surface(fa,'y',1,fa.size[1]/2),faceY=boxFront-rear;
  const holes=(fa.landmarks?.holes?.length?fa.landmarks.holes:Array.from({length:m.floor*2},(_,n)=>({x:(n%2?1:-1)*(fa.size[0]/2-30.95),z:23.5+48*Math.floor(n/2)-fa.size[2]/2}))).map(p=>({x:x+p.x,z:faceZ+p.z,radius:p.radius}));
  const axisZ=Math.min(...holes.map(p=>p.z));const measured=fa.landmarks?.labelHole;const labelHole=measured?holes.find(h=>Math.hypot(h.x-x-measured.x,h.z-faceZ-measured.z)<.05):holes.filter(p=>Math.abs(p.z-axisZ)<.1).reduce((a,b)=>a.x>b.x?a:b);
  return {x,width:cuts[i],face,faceY,faceZ,faceBack:boxFront,faceFront:faceY+front,axisZ,holes,capHoles:holes.filter(p=>p!==labelHole),labelHole};
 });
 return {W,D,H,bodyAsset:a,railRows:m.floor,runnerPorts:a.landmarks?.runnerPorts||[],outsideFloor,insideFloor,boxBottom:insideFloor+.2,outsideCeiling,frames};
}
export function alignedDrawerPart(d,p,c,{drawer,n,component}){
 const role=p.role,sz=c.size,a=p.asset,side=n%2?-1:1;
 if(role==='面板端盖'){let index=n;drawer=0;while(drawer<d.frames.length-1&&index>=d.frames[drawer].capHoles.length){index-=d.frames[drawer].capHoles.length;drawer++;}n=index;}
 const f=d.frames[drawer];
 const rotation=[0,0,0];let position,explosion=[0,0,40],moving=false,anchor;
 const keyAsset=d.keyAsset,capAsset=d.capAsset;
 if(role==='柜体'){position=[0,0,d.H/2];explosion=[0,0,0];}
 else if(role==='顶盖'){position=[0,0,d.outsideCeiling-surface(a,'z',-1,-sz[2]/2+4.8)];explosion=[0,0,85];anchor='roof-seat';}
 else if(role==='抽屉盒'){position=[f.x,f.faceBack-a.size[1]/2,d.boxBottom+sz[2]/2];explosion=[0,d.D*.55,0];moving=true;anchor='box-floor';}
 else if(role==='面板'){position=[f.x,f.faceY,f.faceZ];explosion=[0,d.D*.95,0];moving=true;anchor='facade';}
 else if(role==='旋钮锁芯'||role==='旋钮帽'){
  const gearFront=levels(keyAsset,'y').filter(p=>p.normal===1&&p.area>100&&p.at<0).sort((a,b)=>a.at-b.at)[0]?.at??-13.51;
  const keyY=f.faceBack-gearFront-.05;
  if(role==='旋钮锁芯'){position=[f.x,keyY,f.axisZ];explosion=[0,d.D*.75,0];}
  else{const shoulder=levels(keyAsset,'y').find(p=>p.normal===1&&p.at>0&&p.area>300)?.at??1.69;position=[f.x,keyY+shoulder+sz[1]/2+.02,f.axisZ];rotation[0]=Math.PI;explosion=[0,d.D*1.35,0];}
  moving=true;anchor='key-axis';
 }
 else if(role==='面板端盖'){
  const local=n%f.capHoles.length,h=f.capHoles[local];position=[h.x,f.faceFront-surface(a,'y',1,sz[1]/2)+.02,h.z];explosion=[0,d.D*1.3,0];moving=true;anchor='facade-hole';
 }
 else if(role==='标签'){const pocket=f.face.asset.landmarks?.labelPocket;position=pocket?[f.x+pocket.maxX-sz[0]/2-.03,f.faceY+pocket.bedY-surface(a,'y',-1,-sz[1]/2),f.faceZ+(pocket.minZ+pocket.maxZ)/2]:[f.x+f.face.asset.size[0]/2-sz[0]/2-2.48,f.faceFront-surface(a,'y',1,sz[1]/2)-.09,f.axisZ];explosion=[0,d.D*1.4,0];moving=true;anchor='label-recess';}
 else if(role==='弹簧套件'){
  const mount=f.holes.filter(p=>Math.abs(p.z-f.axisZ)<.1).filter(p=>side*(p.x-f.x)>0).sort((a,b)=>Math.abs(a.x-f.x)-Math.abs(b.x-f.x))[0];
  const pocket=levels(f.face.asset,'y').find(p=>p.normal===-1&&p.at>surface(f.face.asset,'y',-1,-5)+1&&p.area>1000)?.at??.62;
  position=[mount.x-side*13.098,f.faceY+pocket-sz[1]/2,f.axisZ];if(side<0)rotation[1]=Math.PI;
  explosion=[side*15,d.D*.85,0];moving=true;anchor='spring-boss';
 }
 else if(role==='导轨'||role==='滑轨'){
  const boxWidth=f.width-30.6;
  const xx=role==='导轨'?f.width/2-3-sz[0]/2:boxWidth/2+sz[0]/2-1.5;
  const level=Math.floor((n%(d.railRows*2))/2);position=[f.x+side*xx,role==='导轨'?1.7:f.faceBack-a.size[1]/2-1,f.axisZ+48*level];if(side>0)rotation[1]=Math.PI;
  explosion=[side*(45+(role==='滑轨'?18:0)),role==='滑轨'?d.D*.45:0,0];moving=role==='滑轨';anchor='runner-channel';
 }
 else if(role==='加强齿条套件'){
  position=[f.x,f.faceBack-sz[1]/2-.1,f.axisZ+side*16.7];if(side>0)rotation[1]=Math.PI;
  explosion=[0,d.D*.65,side*22];moving=true;anchor='front-geared-rack';
 }
 else if(role==='限位件'){const level=Math.floor((n%(d.railRows*2))/2),port=d.runnerPorts[level];position=[f.x+side*(f.width/2+.15-sz[0]/2),port?.y??(d.D/2-44.55),port?d.H/2+port.z:f.axisZ+48*level];if(side>0)rotation[1]=Math.PI;explosion=[side*100,0,0];anchor='runner-stop';}
 else if(role==='堆叠锁扣'){
  // The 4.5 mm latch slides INSIDE the underside's 4.8 mm mounting bay.
  // Its forward tips stop at the bay's rear-facing wall; the pull ring faces back.
  const stop=levels(d.bodyAsset,'y').find(p=>p.normal===-1&&Math.abs(p.at-(-d.D/2+63.48))<.3)?.at??-d.D/2+63.48;
  const tip=surface(a,'y',1,sz[1]/2);
  position=[f.x,stop-tip-.15,d.outsideFloor-sz[2]/2-.15];
  explosion=[0,-20,-45];anchor='bottom-latch';
 }
 else if(role==='网格收纳底板'){
  const box=d.boxAssets?.[drawer],floor=box?surface(box,'z',1,-box.size[2]/2+3)+box.size[2]/2:3;
  position=[f.x,f.faceBack-(box?.size[1]??d.D-2.3)/2,d.boxBottom+floor+.15+sz[2]/2];explosion=[0,d.D*.5,70];moving=true;anchor='inside-box-floor';
 }
 if(!position)return null;
 return {position,rotation,explosion,moving,anchor,drawer};
}
