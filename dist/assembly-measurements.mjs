import * as T from './vendor/three/three.module.js';
import {createModuleAssembly} from './assembly-viewer.mjs?revision=xl-drawers-1';
const planes=(a,axis)=>(a.landmarks?.planes?.[axis]||[]);
export function cavity(asset){
 const result={};
 for(const axis of ['x','y']){
  const low=planes(asset,axis).filter(p=>p.at<0&&p.normal===1).sort((a,b)=>b.area-a.area)[0];
  const high=planes(asset,axis).filter(p=>p.at>0&&p.normal===-1).sort((a,b)=>b.area-a.area)[0];
  if(!low||!high||low.area<100||high.area<100)return null;result[axis]=high.at-low.at;
 }
 const floor=planes(asset,'z').filter(p=>p.normal===1&&p.at<0).sort((a,b)=>b.area-a.area)[0];
 if(!floor||floor.area<result.x*result.y*.2)return null;
 return [result.x,result.y,asset.size[2]/2-floor.at];
}
export function measureAssembly(model,parts){
 // Source-oriented bounds and measured attachment planes; no renderer or STL download.
 const assets=parts.map(p=>p.asset.components.map(c=>new T.BoxGeometry(...c.size)));
 const assembly=createModuleAssembly(model,parts,assets,{});
 assembly.root.updateMatrixWorld(true);
 const external=new T.Box3();
 const internal=new Set(['抽屉盒','抽屉盒分件','抽屉背板','导轨','滑轨','弹簧套件','网格收纳底板','加强齿条套件','密封隔板','密封侧隔板','密封中隔板','双抽屉中间连接件','翻盖连接件']);
 for(const move of assembly.moves){
  if(internal.has(move.mesh.userData.role))continue;
  const bounds=new T.Box3().setFromObject(move.mesh);
  // The viewer trims the key shaft at the knob cap; invisible shaft must not add depth.
  if(move.mesh.userData.role==='旋钮锁芯'){
   const cap=assembly.moves.find(p=>p.mesh.userData.role==='旋钮帽'&&p.mesh.userData.drawer===move.mesh.userData.drawer);
   if(cap)bounds.max.y=Math.min(bounds.max.y,cap.mesh.position.y+assembly.datums.capAsset.size[1]/2-.25);
  }
  external.union(bounds);
 }
 const dims=external.getSize(new T.Vector3()).toArray();
 const boxes=parts.filter(p=>p.role==='抽屉盒');
 const drawers=boxes.map(p=>({path:p.path,qty:p.qty,outer:p.asset.size,inner:cavity(p.asset)}));
 const housing=parts.find(p=>['柜体','箱体'].includes(p.role));
 for(const group of assets)for(const geometry of group)geometry.dispose();
 for(const mesh of assembly.decorations)mesh.geometry.dispose();for(const [mat] of assembly.materials)mat.dispose();
 return {external:dims,externalBounds:{min:external.min.toArray(),max:external.max.toArray()},housing:housing?.asset.size,drawers,splitDrawer:parts.some(p=>p.role==='抽屉盒分件'),basis:'closed-preview-assembly',innerBasis:'main-wall-planes-no-accessories'};
}
