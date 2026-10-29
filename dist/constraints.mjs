import {newFoundationIssue} from './foundation.mjs?revision=foundation-1';
import {insertModule} from './core.mjs?revision=strong-snap-1';
const TOL=1e-5,clean=n=>Math.round(n*1e5)/1e5;
const crosses=(a,b,lookup)=>Math.min(a.x+lookup[a.model].width,b.x+lookup[b.model].width)-Math.max(a.x,b.x)>TOL;
const ordered=items=>items.map((a,index)=>({a,index})).sort((a,b)=>a.a.y-b.a.y||a.a.x-b.a.x||a.index-b.index).map(({a})=>a);
function xSlots(item,items,lookup){
 const width=lookup[item.model].width;
 return [...new Set([0,...items.flatMap(a=>{const right=a.x+lookup[a.model].width;return [a.x,right,a.x-width,right-width];})].filter(x=>x>=-TOL).map(x=>clean(Math.max(0,x))))];
}
function fullySupported(a,items,lookup){
 if(a.y<TOL)return true;
 const width=lookup[a.model].width;
 const intervals=items.filter(b=>Math.abs(b.y+lookup[b.model].height-a.y)<TOL&&crosses(a,b,lookup)).map(b=>[Math.max(a.x,b.x),Math.min(a.x+width,b.x+lookup[b.model].width)]).sort((a,b)=>a[0]-b[0]);
 let end=a.x;for(const [start,right] of intervals){if(start>end+TOL)return false;end=Math.max(end,right);}return end>=a.x+width-TOL;
}
function validLayout(items,lookup){return items.every((a,index)=>fullySupported(a,items.filter(b=>b.id!==a.id),lookup)&&!items.slice(index+1).some(b=>crosses(a,b,lookup)&&a.y<b.y+lookup[b.model].height-TOL&&a.y+lookup[a.model].height>b.y+TOL));}
function floorAt(item,placed,lookup){return clean(Math.max(0,...placed.filter(b=>crosses(item,b,lookup)).map(b=>b.y+lookup[b.model].height)));}
// Gravity acts on complete modules. Sorting and returning by ID preserve all
// recipe, colour and accessory data, including unequal-height adjacent columns.
export function compactLayout(items,lookup){
 const placed=[];for(const original of ordered(items)){const item={...original,x:clean(original.x)};item.y=floorAt(item,placed,lookup);placed.push(item);}
 const byId=new Map(placed.map(a=>[a.id,a]));return items.map(a=>byId.get(a.id));
}
// Repair existing free placements once strong snapping is enabled. Unsupported
// bridges move to the nearest complete support surface; nothing is resized.
export function constrainLayout(items,lookup){
 if(validLayout(items,lookup))return items.map(a=>({...a,x:clean(a.x),y:clean(a.y)}));
 const placed=[];
 for(const original of ordered(items)){
  const item={...original,x:clean(Math.max(0,original.x))},slots=xSlots(item,placed,lookup);
  const near=[...slots].sort((a,b)=>Math.abs(a-item.x)-Math.abs(b-item.x)||a-b)[0];
  if(Math.abs(near-item.x)<=10)item.x=near;
  item.y=floorAt(item,placed,lookup);
  if(!fullySupported(item,placed,lookup)){
   const options=[];
   for(const x of slots){const a={...item,x};a.y=floorAt(a,placed,lookup);if(fullySupported(a,placed,lookup))options.push(a);}
   options.sort((a,b)=>(Math.abs(a.x-item.x)+Math.abs(a.y-item.y))-(Math.abs(b.x-item.x)+Math.abs(b.y-item.y))||a.y-b.y||a.x-b.x);
   Object.assign(item,options[0]);
  }
  placed.push(item);
 }
 const byId=new Map(placed.map(a=>[a.id,a]));return items.map(a=>byId.get(a.id));
}
// During a drag the start geometry is immutable. Horizontal edges are mandatory
// slots, vertical gaps collapse, and an unsupported bridge rejects the drop.
export function constrainedInsert(candidate,items,lookup,options={}){
 const slots=xSlots(candidate,items,lookup).sort((a,b)=>Math.abs(a-candidate.x)-Math.abs(b-candidate.x)||a-b);
 const result=insertModule({...candidate,x:slots[0]},items,lookup,{...options,lockedX:true});
 const compacted=compactLayout(result.items,lookup);
 const foundation=newFoundationIssue(items,compacted,lookup);
 const invalid=!validLayout(compacted,lookup)||foundation;
 if(invalid)return {items:items.map(a=>({...a})),insertion:null,rejected:true,reason:foundation?.text};
 const moving=compacted.find(a=>a.id===candidate.id);
 return {items:compacted,insertion:result.insertion?{...result.insertion,x:moving.x,y:moving.y}:null,rejected:false};
}
