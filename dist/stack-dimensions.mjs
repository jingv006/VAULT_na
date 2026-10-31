import {bounds} from './core.mjs?revision=foundation-1';
import {stackLayout,stackModulePosition} from './stack-layout.mjs?revision=stack-preview-1';

// Union closed modules in the same coordinate system as the 3D stack viewer.
// Keep the 48 mm stacking pitch; adding each module's outer height overcounts.
export function stackDimensions(items,catalog,measurements){
 const lookup=Object.fromEntries(catalog.modules.map(m=>[m.id,m]));
 const nominal=bounds(items,lookup),missing=[];
 const low=[Infinity,Infinity,Infinity],high=[-Infinity,-Infinity,-Infinity];
 for(const entry of stackLayout(items,catalog)){
  const record=measurements?.records?.[entry.model.id+'|'+entry.options.roof];
  const b=record?.externalBounds;
  if(!b||!record.housing?.[1]||![...b.min,...b.max].every(Number.isFinite)){
   missing.push(entry.id);continue;
  }
  const offset=stackModulePosition(entry,record.housing[1]);
  for(let axis=0;axis<3;axis++){
   low[axis]=Math.min(low[axis],b.min[axis]+offset[axis]);
   high[axis]=Math.max(high[axis],b.max[axis]+offset[axis]);
  }
 }
 return {nominal:[nominal.width,nominal.depth,nominal.height],
  external:missing.length?null:items.length?high.map((n,i)=>n-low[i]):[0,0,0],missing};
}
