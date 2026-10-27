import {isExposed} from './core.mjs?revision=workbench-options-1';
import {selectedRoof} from './roof-options.mjs?revision=flip-roof-load-2';

export function stackLayout(items,catalog){
 const lookup=Object.fromEntries(catalog.modules.map(m=>[m.id,m]));
 return items.map(item=>{
  const model=lookup[item.model];if(!model)throw Error('无法预览未知模块');
  const roof=model.kind==='drawer'&&!isExposed(item,items,lookup)?'none':selectedRoof(model,item.roof);
  return {id:item.id,model,x:item.x,z:item.y,colour:item.color,options:{roof,grid:!!item.grid,rails:model.kind==='drawer'&&!!item.rails}};
 });
}
export function stackModulePosition(entry,bodyDepth){
 // Source assemblies are width-centred and rise from Z=0. Align cabinet front
 // planes even when different depths are present; keep the exact 48 mm pitch.
 return [entry.x+entry.model.width/2,-bodyDepth/2,entry.z];
}
