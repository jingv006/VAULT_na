// Fit is a size screen, not a slicer simulation. Never silently scale or tilt parts.
const permutations=[[0,1,2],[1,0,2],[0,2,1],[2,0,1],[1,2,0],[2,1,0]];
export function customPrinter(profile){
 const volume=profile?.volume;
 if(!Array.isArray(volume)||volume.length!==3||volume.some(n=>typeof n!=='number'||!Number.isFinite(n)||n<1||n>10000))throw Error('X、Y、Z 打印范围须为 1–10000 mm 的有效数字');
 return {id:'custom',brand:'自定义',name:String(profile.name||'我的打印机').trim().slice(0,80)||'我的打印机',volume:[...volume],source:null,note:'按你输入的有效打印范围检查。'};
}
export function fitPart(path,printer,geometry,{reorient=false,margin=0}={}) {
 const size=geometry?.records?.[path]?.size,volume=printer?.volume;
 if(!size||!volume||size.length!==3||size.some(n=>!Number.isFinite(n)||n<=0))return {status:'unknown',size:null};
 const within=order=>order.every((axis,i)=>size[axis]+(i<2?2*margin:0)<=volume[i]+.00001);
 if(within(permutations[0]))return {status:'fits',size,order:permutations[0],orientedSize:size};
 if(within(permutations[1]))return {status:'rotate',size,order:permutations[1],orientedSize:permutations[1].map(a=>size[a])};
 const order=permutations.slice(2).find(within);
 if(order)return {status:'reorient',size,order,orientedSize:order.map(a=>size[a]),allowed:reorient};
 return {status:'oversize',size};
}
export function printerBOM(bom,printer,geometry,options={}) {
 const result={printer,parts:[],fits:0,rotate:0,reorient:0,oversize:0,unknown:0,blockedFiles:0,blockedCopies:0};
 for(const p of bom.parts) {
  const fit=fitPart(p.path,printer,geometry,options),blocked=['oversize','unknown'].includes(fit.status)||(fit.status==='reorient'&&!options.reorient);
  result[fit.status]++;if(blocked){result.blockedFiles++;result.blockedCopies+=p.qty;}
  result.parts.push({...p,fit,blocked});
 }
 result.status=result.unknown?'unknown':result.blockedFiles?'blocked':result.reorient||result.rotate?'rotate':'fits';
 return result;
}
export const fitLabel=status=>({fits:'原方向尺寸内',rotate:'需平面旋转90°',reorient:'需换面放置',oversize:'超出所检查方向范围',unknown:'缺少尺寸记录'}[status]||'待核对');
