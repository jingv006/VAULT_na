// Native millimetres, measured mounting faces and coaxial hinges/lock pivots.
const planes=(a,axis)=>a?.landmarks?.planes?.[axis]||[];
const face=(a,axis,normal,fallback)=>planes(a,axis).find(p=>p.normal===normal)?.at??fallback;
const avg=xs=>xs.reduce((a,b)=>a+b,0)/xs.length;
const feature=(p)=>p.asset.components[0];
const rotate=(a,[y,z])=>[Math.cos(a)*y-Math.sin(a)*z,Math.sin(a)*y+Math.cos(a)*z];
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
export function sustainerLockPose(d,release=0){
 // Seat the hook toe in the recessed channel behind the lid's front lip.
 // The holder leaf mounts BEHIND the facade, not on its outer recessed face.
 const a=[d.pivotY,d.pivotZ],b=[d.pivotY,d.outerAxis],length=a[1]-b[1];
 const catchOffset=[d.outerY-6.504-b[0],d.outerZ+d.outerHeight/2-6.1644-b[1]];
 const target=[d.facadeY-4.3,d.rim+9.1],t=[target[0]-a[0],target[1]-a[1]],distance=Math.hypot(...t),radius=Math.hypot(...catchOffset);
 const gamma=Math.atan2(t[1],t[0]),angle=Math.acos(Math.max(-1,Math.min(1,(distance*distance+length*length-radius*radius)/(2*distance*length))));
 const solutions=[gamma+angle,gamma-angle].map(phi=>wrap(phi+Math.PI/2));
 // The short, inward branch presses the lever against the facade.
 // The other branch raises the lever and must not be used for closed preview.
 const closedInner=solutions.sort((a,b)=>Math.abs(a)-Math.abs(b))[0];
 const closedBottom=rotate(closedInner,[0,-length]).map((v,i)=>v+a[i]);
 const closedOuter=wrap(Math.atan2(target[1]-closedBottom[1],target[0]-closedBottom[0])-Math.atan2(catchOffset[1],catchOffset[0]));
 const innerAngle=closedInner*(1-release)+Math.PI/3*release,outerAngle=closedOuter*(1-release)-Math.PI/6*release;
 const bottom=rotate(innerAngle,[0,-length]).map((v,i)=>v+a[i]);
 const iv=rotate(innerAngle,[d.innerBore.x,d.innerBore.z]),ov=rotate(outerAngle,[d.outerBore.x,-d.outerBore.z]);
 const hookTipOffset=[catchOffset[0]-.444,catchOffset[1]-1.946];
 return {innerAngle,outerAngle,inner:[a[0]-iv[0],a[1]-iv[1]],outer:[bottom[0]-ov[0],bottom[1]-ov[1]],bottom,pivot:a,catchPoint:rotate(outerAngle,catchOffset).map((v,i)=>v+bottom[i]),hookTip:rotate(outerAngle,hookTipOffset).map((v,i)=>v+bottom[i]),target};
}
export function sustainerLockPlacement(motion,pose){
 const {x,kind}=motion;let yz,rotation=[0,0,0];
 if(kind==='inner'){yz=pose.inner;rotation[0]=pose.innerAngle;}
 if(kind==='outer'){yz=pose.outer;rotation=[pose.outerAngle,Math.PI,0];}
 if(kind==='label'){
  const offset=rotate(pose.outerAngle,[motion.y,-motion.z]);yz=offset.map((v,i)=>v+pose.outer[i]);rotation=[pose.outerAngle,Math.PI,0];
 }
 if(kind==='pin'){
  const angle=motion.long?pose.outerAngle:pose.innerAngle,axis=rotate(angle,[motion.axis[1]*motion.side,motion.axis[2]]),pivot=motion.long?pose.bottom:pose.pivot;
  yz=[pivot[0]-axis[0],pivot[1]-axis[1]];rotation=[angle,0,motion.side<0?Math.PI:0];
 }
 return {position:[x,...yz],rotation};
}
export function sustainerDatums(m,parts){
 const body=parts.find(p=>p.role==='箱体').asset,facade=parts.find(p=>p.role==='前面板').asset;
 const [W,D,H]=body.size,lower=parts.find(p=>p.role==='下铰链套件').asset.components[0];
 const holes=body.landmarks.hingeHoles||[],localHoles=lower.landmarks?.mountHoles||[];
 const lowerZ=holes.length&&localHoles.length?H/2+Math.max(...holes.map(h=>h.z))-Math.max(...localHoles.map(h=>h.z)):m.height-37.7;
 const mountY=planes(body,'y').find(p=>p.normal===1&&Math.abs(p.at-(-D/2+6.9))<.1)?.at??-D/2+6.9;
 const lowerY=mountY-face(lower,'y',-1,lower.size[1]/2-4);
 const axisY=lowerY-lower.size[1]/2+7,rim=lowerZ+lower.size[2]/2-7;
 const hingeX=[-1,1].map(side=>{const hs=holes.filter(h=>h.x*side>0);return hs.length?avg(hs.map(h=>h.x)):side*(W/2-30.5);});
 const outsideFloor=H/2+face(body,'z',-1,-H/2+4.8),insideFloor=H/2+face(body,'z',1,-H/2+9.8);
 const facadeY=D/2-face(facade,'y',-1,-facade.size[1]/2),facadeZ=outsideFloor+facade.size[2]/2;
 const mounts=(facade.landmarks.mountHoles||[]).filter(h=>h.radius<1.95),xs=[...new Set(mounts.map(h=>+h.x.toFixed(1)))].sort((a,b)=>a-b);
 const lockX=xs.length?Array.from({length:xs.length/2},(_,i)=>(xs[i*2]+xs[i*2+1])/2):(m.family==='S'||m.family==='M'?[0]:[-W/4,W/4]);
 const holder=feature(parts.find(p=>p.role==='锁扣座')),inner=feature(parts.find(p=>p.role==='锁扣内件')),outer=feature(parts.find(p=>p.role==='锁扣外件'));
 const mountZ=mounts.length?avg(mounts.map(h=>h.z)):facade.size[2]/2-17.7;
 const holderY=D/2-face(holder,'y',1,-4.45),holderZ=facadeZ+mountZ;
 const hb=holder.landmarks?.pivotBores?.[0]||{x:5.75,z:2.7},ib=inner.landmarks?.pivotBores||[{x:0,z:-7.5},{x:0,z:7.5}],ob=outer.landmarks?.pivotBores?.[0]||{x:3.8,z:outer.size[2]/2-10.3};
 const pivotY=holderY+hb.x,pivotZ=holderZ+hb.z,innerY=pivotY-ib[0].x,innerZ=pivotZ-Math.max(...ib.map(b=>b.z));
 const outerAxis=innerZ+Math.min(...ib.map(b=>b.z)),outerY=pivotY-ob.x,outerZ=outerAxis+ob.z;
 const roofs=parts.filter(p=>['翻盖','翻盖分件'].includes(p.role));
 const rearRoof=roofs.find(p=>!p.path.includes('Part 2'))||roofs[0],roof=feature(rearRoof);
 const seat=planes(roof,'z').find(p=>p.normal===-1&&p.at<-3&&p.at>-9&&p.area>200)?.at??-6.3;
 return {W,D,H,body,facade,facadeY,facadeZ,outsideFloor,insideFloor,hingeX,lowerY,lowerZ,axisY,rim,lowerWidth:lower.size[0],lockX,holderY,holderZ,innerY,innerZ,outerY,outerZ,pivotY,pivotZ,outerAxis,innerBore:ib.reduce((a,b)=>a.z>b.z?a:b),outerBore:ob,outerHeight:outer.size[2],roofZ:rim-seat,roofDepth:roofs.reduce((n,p)=>n+feature(p).size[1],0),rearDepth:roof.size[1],roofSeat:seat,dividerRows:body.landmarks.dividerRows||[],m};
}
export function alignedSustainerPart(d,p,c,{n,component}){
 const role=p.role,sz=c.size,side=n%2?1:-1,rotation=[0,0,0];
 let position,explosion=[0,0,40],onLid=false,anchor,lockMotion;
 const lock=d.lockX[Math.floor(n/(role==='锁扣插销套件'?p.asset.components.length:1))%d.lockX.length];
 if(role==='箱体'){position=[0,0,d.H/2];explosion=[0,0,0];anchor='body';}
 else if(role==='前面板'){position=[0,d.facadeY,d.facadeZ];explosion=[0,60,0];anchor='facade-seat';}
 else if(role==='翻盖'||role==='翻盖分件'){
  const rear=role==='翻盖'||!p.path.includes('Part 2'),y=role==='翻盖'?5:5-d.roofDepth/2+(rear?sz[1]/2:d.rearDepth+sz[1]/2);
  position=[0,y,d.roofZ];onLid=true;explosion=[0,role==='翻盖分件'?(rear?-25:25):0,85];anchor='roof-hinge-seat';
 }
 else if(role==='翻盖连接件'){position=[0,5-d.roofDepth/2+d.rearDepth,d.roofZ+4.65];rotation[2]=Math.PI/2;onLid=true;explosion=[0,0,120];anchor='roof-joint';}
 else if(role==='下铰链套件'){position=[d.hingeX[n%2],d.lowerY,d.lowerZ];explosion=[side*22,-45,0];anchor='rear-mount-holes';}
 else if(role==='上铰链套件'){
  const x=p.asset.components.length===1?0:side*(Math.abs(d.hingeX[n%2])-(d.lowerWidth+sz[0])/2-.5);
  position=[x,d.axisY+sz[1]/2-7,d.rim];onLid=true;explosion=[side*15,-45,30];anchor='lid-hinge-axis';
 }
 else if(role==='铰链轴套件'){
  const x=side*(Math.abs(d.hingeX[n%2])+d.lowerWidth/2+4.5-sz[0]/2);
  // Source pins have opposite heads; preserve their outward direction.
  if(Math.sign(c.center[0])!==side)rotation[2]=Math.PI;
  const axis=c.landmarks?.shaftAxis||[0,0,-2.525],flip=rotation[2]? -1:1;
  position=[x,d.axisY-axis[1]*flip,d.rim-axis[2]];explosion=[side*90,0,0];anchor='hinge-pin-axis';
 }
 else if(role==='锁扣座'){position=[lock,d.holderY,d.holderZ];explosion=[0,100,0];anchor='lock-mount-holes';}
 else if(role==='锁扣内件'){lockMotion={x:lock,kind:'inner'};explosion=[0,135,0];anchor='lock-inner-pivot';}
 else if(role==='锁扣外件'){lockMotion={x:lock,kind:'outer'};explosion=[0,180,0];anchor='lock-outer-pivot';}
 else if(role==='锁扣插销套件'){
  const long=sz[0]>19,pinSide=component%2?1:-1,width=long?49.99:39.6;
  if(pinSide<0)rotation[2]=Math.PI;
  const axis=c.landmarks?.shaftAxis||[0,0,0];
  lockMotion={x:lock+pinSide*(width/2-sz[0]/2),kind:'pin',side:pinSide,long,axis};explosion=[pinSide*65,135,0];anchor='lock-pin-axis';
 }
 else if(role==='箱体标签'&&n<d.lockX.length){
  lockMotion={x:lock,kind:'label',y:8.3-sz[1]/2,z:d.m.floor===1?6.6:9.6};explosion=[0,205,0];anchor='lock-label-window';
 }
 else if(role==='锁扣标签'||role==='箱体标签'){
  const pocket=d.facade.landmarks.labelPocket;
  position=pocket?[(pocket.minX+pocket.maxX)/2,d.facadeY+pocket.bedY+sz[1]/2,d.facadeZ+(pocket.minZ+pocket.maxZ)/2]:[d.W/2-sz[0]/2-2.5,d.facadeY+2.87+sz[1]/2,d.facadeZ-3.6];
  explosion=[0,205,0];anchor='facade-label-recess';
 }
 else if(role.startsWith('密封')){
  const rows=d.dividerRows.length?d.dividerRows:Array.from({length:d.m.depth-1},(_,i)=>(i-(d.m.depth-2)/2)*37.7+3.5);
  const row=Math.floor(n/(role==='密封中隔板'?1:2))%rows.length;
  const x=role==='密封中隔板'?0:side*(d.m.family==='XL'?(d.W-sz[0])/2-2:d.W/4);
  position=[x,rows[row],d.insideFloor-2.01+sz[2]/2];explosion=[side*10,0,70+row*16];anchor='divider-groove';
 }
 else if(role.startsWith('网格收纳底板')){position=[0,0,d.insideFloor+.15+sz[2]/2];explosion=[0,0,70];anchor='inside-floor';}
 if(lockMotion){const placement=sustainerLockPlacement(lockMotion,sustainerLockPose(d));position=placement.position;rotation.splice(0,3,...placement.rotation);}
 if(!position)return null;
 if(onLid)position=[position[0],position[1]-d.axisY,position[2]-d.rim];
 return {position,rotation,explosion,onLid,moving:false,anchor,lockMotion};
}
