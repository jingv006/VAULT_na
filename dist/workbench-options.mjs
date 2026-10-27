import {roofChoices} from './roof-options.mjs?revision=flip-roof-load-2';
import {isExposed} from './core.mjs?revision=workbench-options-1';

export function roofLibrary(catalog){
 const choices=new Map();
 for(const m of catalog.modules)for(const [value,title] of roofChoices(m)){
  if(value==='none')continue;
  const id=[m.kind,m.family,m.depth,value].join(':');
  if(choices.has(id))continue;
  const parts=m.kind==='drawer'?m.roofs[value]:m.lidRoofs[value];
  if(!parts?.length)continue;
  choices.set(id,{id,value,title,kind:m.kind,family:m.family,depth:m.depth,width:m.width,nominalDepth:m.nominalDepth,parts});
 }
 return [...choices.values()];
}
export function roofTarget(choice,items,lookup,{selectedId,targetId}={}){
 const matches=items.filter(item=>{
  const m=lookup[item.model];
  return m.kind===choice.kind&&m.family===choice.family&&m.depth===choice.depth
   &&(m.kind!=='drawer'||isExposed(item,items,lookup));
 });
 if(targetId)return matches.find(item=>item.id===targetId);
 return matches.find(item=>item.id===selectedId)||matches.sort((a,b)=>b.y+lookup[b.model].height-a.y-lookup[a.model].height)[0];
}

const accessoryParts={grid:'gridParts',rails:'railParts'};
export function drawerAccessoryState(items,lookup,key){
 const parts=accessoryParts[key];if(!parts)throw Error('未知抽屉配件');
 const eligible=items.filter(item=>lookup[item.model]?.kind==='drawer'&&lookup[item.model][parts]?.length);
 const enabled=eligible.filter(item=>item[key]).length;
 return {total:eligible.length,enabled,checked:eligible.length>0&&enabled===eligible.length,mixed:enabled>0&&enabled<eligible.length};
}
export function setDrawerAccessory(items,lookup,key,enabled){
 const parts=accessoryParts[key];if(!parts)throw Error('未知抽屉配件');
 return items.map(item=>lookup[item.model]?.kind==='drawer'&&lookup[item.model][parts]?.length?{...item,[key]:enabled}:item);
}
