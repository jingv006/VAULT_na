const colours=['#dce2d5','#e8e6db','#c6d2c2','#d5dbdc','#e0cdbd'];
const widths={S:164.8,M:254,L:329.6,XL:418.8};

// Build complete horizontal bands so every module has full support and the
// chosen envelope remains exact, even when the columns use different heights.
export function randomLayout(catalog,{family='L',depth=3,totalF=8,kind='drawer'}={},random=Math.random){
 if(!Object.hasOwn(widths,family)||!Number.isInteger(depth)||depth<3||depth>7||!Number.isInteger(totalF)||totalF<1||totalF>40||!['drawer','sustainer','mixed'].includes(kind))throw Error('请选择有效的底层尺寸和 1–40F 整体高度');
 const pick=values=>values[Math.min(values.length-1,Math.max(0,Math.floor(random()*values.length)))];
 const available=catalog.modules.filter(m=>m.depth===depth&&(kind==='mixed'||m.kind===kind));
 const byFamily=f=>available.filter(m=>m.family===f);
 if(!byFamily(family).some(m=>m.floor===1))throw Error('这个尺寸暂没有可用的 1F 模块');
 const items=[];
 const addColumn=(f,x,y,layers)=>{
  let remaining=layers;
  while(remaining){
   const models=byFamily(f).filter(m=>m.floor<=remaining);
   const floors=[...new Set(models.map(m=>m.floor))];
   const floor=pick(floors),m=pick(models.filter(m=>m.floor===floor));
   if(!m)throw Error('此尺寸无法组成所选高度');
   items.push({id:'random-'+items.length,model:m.id,x,y,color:pick(colours),roof:m.kind==='drawer'?'Table':m.defaultLid,grid:false,rails:false});
   y+=m.height;remaining-=floor;
  }
 };
 const base=pick(byFamily(family).filter(m=>m.floor<=totalF));
 // Use the selected full-width module for the bottom footprint.
 items.push({id:'random-0',model:base.id,x:0,y:0,color:pick(colours),roof:base.kind==='drawer'?'Table':base.defaultLid,grid:false,rails:false});
 let filled=base.floor;
 while(filled<totalF){
  const band=pick([1,2,4].filter(n=>n<=totalF-filled));
  const layouts=family==='L'?[['L'],['S','S']]:family==='XL'?[['XL'],['S','M'],['M','S']]:[[family]];
  const columns=pick(layouts.filter(columns=>columns.every(f=>byFamily(f).some(m=>m.floor===1))));
  let x=0;
  for(const f of columns){addColumn(f,x,filled*48,band);x+=widths[f];}
  filled+=band;
 }
 return items;
}
