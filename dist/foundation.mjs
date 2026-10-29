// A pair of separate narrow cabinets needs a shared, full-width ground base.
// A twin L/XL cabinet is itself one wide body and can also serve as a base.
const EPS=.6;
export function foundationWarnings(items,lookup){
 const small=items.filter(a=>['S','M'].includes(lookup[a.model]?.family)),bases=items.filter(a=>a.y<EPS&&['L','XL'].includes(lookup[a.model]?.family)),warnings=new Map();
 const anchored=new Set(small.filter(a=>bases.some(base=>{const model=lookup[base.model],m=lookup[a.model];return model.depth===m.depth&&base.x<=a.x+EPS&&base.x+model.width>=a.x+m.width-EPS;})).map(a=>a.id));
 for(let i=0;i<small.length;i++)for(const b of small.slice(i+1)){
  let a=small[i],right=b;if(a.x>right.x)[a,right]=[right,a];
  const m=lookup[a.model],n=lookup[right.model];
  const required=m.family==='S'&&n.family==='S'?'L':m.family!==n.family?'XL':null;
  if(!required||Math.abs(a.x+m.width-right.x)>EPS||Math.min(a.y+m.height,right.y+n.height)-Math.max(a.y,right.y)<=EPS)continue;
  // Adjacent cabinets may already belong to separate valid wide bases.
  if(anchored.has(a.id)&&anchored.has(right.id))continue;
  const x=a.x,width=m.width+n.width,depth=m.depth===n.depth?m.depth:null;
  if(depth&&bases.some(base=>{const model=lookup[base.model];return model.depth===depth&&base.x<=x+EPS&&base.x+model.width>=x+width-EPS;}))continue;
  const key=[Math.round(x*10)/10,required,m.depth,n.depth].join(':');
  if(!warnings.has(key))warnings.set(key,{id:a.id,type:'foundation',key,x,width,depth,requiredFamily:required,text:depth?`${required==='L'?'两个 S':'S＋M'} 并排需要共用同深度的 ${required} 底座，请先在最底层放置 ${required}${depth} 模块`:'并排的 S / M 模块需先统一深度，再放置共用的 L / XL 底座'});
 }
 return [...warnings.values()];
}
export function newFoundationIssue(before,after,lookup){
 const footprint=w=>[Math.round(w.x*10)/10,w.requiredFamily].join(':');
 const previous=new Set(foundationWarnings(before,lookup).map(footprint));
 return foundationWarnings(after,lookup).find(w=>!previous.has(footprint(w)));
}
