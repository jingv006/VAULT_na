import {makeBOM} from './core.mjs?revision=foundation-1';
import {stackLayout} from './stack-layout.mjs?revision=stack-preview-1';
import {normalisePalette} from './palette-store.mjs?revision=shared-palette-1';

export function moduleExport(state,catalog,colours){
 const natural=makeBOM({...state,overrides:{}},catalog),actual=makeBOM(state,catalog);
 const quantities=new Map(actual.parts.map(p=>[p.path,p.qty]));
 if(natural.parts.some(p=>(quantities.get(p.path)||0)!==p.qty))
  throw Error('整合 3MF 按完整模块配方生成。当前手动修改过零件数量，请使用第一项，或在打印清单中恢复配方数量。');
 const groups=new Map();
 for(const entry of stackLayout(state.items,catalog)){
  const spec={model:entry.model.id,...entry.options,colours:normalisePalette(colours)};
  const key=JSON.stringify(spec);
  if(groups.has(key))groups.get(key).qty++;
  else groups.set(key,{spec,qty:1});
 }
 const extras=new Map();
 for(const p of state.extras||[])extras.set(p.path,(extras.get(p.path)||0)+p.qty);
 return {groups:[...groups.values()],extras:[...extras].map(([path,qty])=>({path,qty})),
  count:state.items.length};
}
