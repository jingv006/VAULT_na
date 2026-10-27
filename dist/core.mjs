import {selectedRoof} from './roof-options.mjs?revision=flip-roof-load-2';
export const EPS = 0.6;
export function bounds(items, lookup) {
 if (!items.length) return {x:0,y:0,width:0,height:0,depth:0};
 const minX=Math.min(...items.map(i=>i.x)), minY=Math.min(...items.map(i=>i.y));
 return {x:minX,y:minY,width:Math.max(...items.map(i=>i.x+lookup[i.model].width))-minX,height:Math.max(...items.map(i=>i.y+lookup[i.model].height))-minY,depth:Math.max(...items.map(i=>lookup[i.model].nominalDepth))};
}
export function overlap(a,b,lookup) {
 const m=lookup[a.model],n=lookup[b.model];
 return a.x < b.x+n.width-EPS && a.x+m.width > b.x+EPS && a.y < b.y+n.height-EPS && a.y+m.height > b.y+EPS;
}
export function validate(items, lookup) {
 const warnings=[];
 for(let k=0;k<items.length;k++) {
  const a=items[k],m=lookup[a.model];
  for(const b of items.slice(k+1)) if(overlap(a,b,lookup)) warnings.push({id:a.id,type:'collision',text:`${m.name} 与 ${lookup[b.model].name} 重叠`});
  if(a.y>EPS) {
   const below=items.filter(b=>b.id!==a.id && Math.abs(b.y+lookup[b.model].height-a.y)<EPS && b.x<a.x+m.width-EPS && b.x+lookup[b.model].width>a.x+EPS);
   const ranges=below.map(b=>[Math.max(a.x,b.x),Math.min(a.x+m.width,b.x+lookup[b.model].width)]).sort((x,y)=>x[0]-y[0]);
   let end=a.x; for(const [s,e] of ranges){if(s>end+EPS)break;end=Math.max(end,e);}
   if(end<a.x+m.width-EPS) warnings.push({id:a.id,type:'support',text:`${m.name} 底部未被完整支撑`});
   if(below.some(b=>lookup[b.model].depth!==m.depth)) warnings.push({id:a.id,type:'depth',text:`${m.name} 与下层深度不同`});
  }
 }
 return warnings;
}
export function isExposed(item,items,lookup) {
 const m=lookup[item.model];
 return !items.some(b=>b.id!==item.id && b.y>=item.y+m.height-EPS && b.x<item.x+m.width-EPS && b.x+lookup[b.model].width>item.x+EPS);
}
export function makeBOM(state, catalog) {
 const lookup=Object.fromEntries(catalog.modules.map(m=>[m.id,m])), meta=Object.fromEntries(catalog.files.map(f=>[f.path,f]));
 const parts=new Map(),hardware=new Map();
 const add=(p)=>{if(!meta[p.path]) throw Error('模型文件不存在：'+p.path); const prev=parts.get(p.path); if(prev)prev.qty+=p.qty;else parts.set(p.path,{...p,...meta[p.path]});};
 for(const item of state.items) {
  const m=lookup[item.model]; if(!m)throw Error('未知模块 '+item.model);
  if(m.kind==='sustainer'&&m.lidRoofs){
   m.parts.filter(p=>!['翻盖','翻盖分件','翻盖连接件'].includes(p.role)).forEach(add);
   m.lidRoofs[selectedRoof(m,item.roof)].forEach(add);
  }else m.parts.forEach(add);
  if(item.grid)m.gridParts.forEach(add);
  if(item.rails)m.railParts.forEach(add);
  if(m.kind==='drawer' && isExposed(item,state.items,lookup) && item.roof!=='none') (m.roofs[item.roof||'Table']||[]).forEach(add);
  m.hardware.forEach(h=>hardware.set(h.name,(hardware.get(h.name)||0)+h.qty));
 }
 for(const p of state.extras||[])add({path:p.path,qty:p.qty,role:'自选配件'});
 for(const [path,qty] of Object.entries(state.overrides||{})) if(parts.has(path))parts.get(path).qty=qty;
 const rows=[...parts.values()].filter(p=>p.qty>0).sort((a,b)=>a.path.localeCompare(b.path));
 return {parts:rows,hardware:[...hardware].map(([name,qty])=>({name,qty})),copies:rows.reduce((a,p)=>a+p.qty,0),bytes:rows.reduce((a,p)=>a+p.bytes,0),copyBytes:rows.reduce((a,p)=>a+p.bytes*p.qty,0)};
}
export function estimateBOM(bom, data) {
 const records=data?.records||{},result={grams:0,seconds:0,knownFiles:0,knownCopies:0,missingFiles:0,missingCopies:0,missing:[],supportCopies:0,autoSupportCopies:0,materialMismatchCopies:0,estimateOnlyCopies:0,warningCopies:0,complete:true};
 for(const part of bom.parts) {
  const record=records[part.path];
  if(record?.status==='ok'&&Number.isFinite(record.grams)&&record.grams>0&&Number.isFinite(record.seconds)&&record.seconds>0) {
   result.grams+=record.grams*part.qty;result.seconds+=record.seconds*part.qty;result.knownFiles++;result.knownCopies+=part.qty;
   if(record.needsSupport&&!record.generatedSupports)result.supportCopies+=part.qty;
   if(record.generatedSupports)result.autoSupportCopies+=part.qty;
   if(record.materialMismatch)result.materialMismatchCopies+=part.qty;
   if(record.estimateOnly)result.estimateOnlyCopies+=part.qty;
   if(record.warnings?.length)result.warningCopies+=part.qty;
  } else {
   result.missingFiles++;result.missingCopies+=part.qty;result.missing.push({path:part.path,qty:part.qty,status:record?.status||'pending',error:record?.error||''});
  }
 }
 result.complete=result.missingFiles===0;result.grams=Math.round(result.grams*100)/100;
 return result;
}
export function snap(item, items, lookup, threshold=10) {
 const m=lookup[item.model]; const xs=[0],ys=[0];
 for(const a of items)if(a.id!==item.id){const n=lookup[a.model];xs.push(a.x,a.x+n.width,a.x-m.width,a.x+n.width-m.width);ys.push(a.y,a.y+n.height,a.y-m.height,a.y+n.height-m.height);}
 const near=(v,arr)=>arr.reduce((r,t)=>Math.abs(v-t)<Math.abs(v-r)?t:r,Infinity);
 const x=near(item.x,xs),y=near(item.y,ys);
 return {...item,x:Math.max(0,Math.abs(item.x-x)<=threshold?x:Math.round(item.x)),y:Math.max(0,Math.abs(item.y-y)<=threshold?y:Math.round(item.y))};
}
function sharesColumn(a,b,lookup) {
 return Math.min(a.x+lookup[a.model].width,b.x+lookup[b.model].width)-Math.max(a.x,b.x)>EPS;
}

// Close only the gap left by the moving module. Independent stacks and existing
// intentional gaps are preserved; a bridge still rests on its other supports.
function liftOut(items,id,lookup) {
 const original=items.find(i=>i.id===id),rest=items.filter(i=>i.id!==id).map(i=>({...i}));
 if(!original)return rest;
 const affected=new Set(),queue=[original];
 for(let n=0;n<queue.length;n++)for(const a of items) {
  const below=queue[n];
  if(a.id!==id&&!affected.has(a.id)&&sharesColumn(a,below,lookup)&&Math.abs(a.y-below.y-lookup[below.model].height)<EPS) {
   affected.add(a.id);queue.push(a);
  }
 }
 for(const a of [...rest].sort((a,b)=>a.y-b.y))if(affected.has(a.id)) {
  a.y=Math.max(0,...rest.filter(b=>b.id!==a.id&&sharesColumn(a,b,lookup)&&b.y+lookup[b.model].height<=a.y+EPS).map(b=>b.y+lookup[b.model].height));
 }
 return rest;
}

// Plan against the drag-start geometry, never against the last preview. This
// keeps the insertion target stable while the surrounding modules make room.
export function insertModule(candidate,items,lookup,{probeY=candidate.y+lookup[candidate.model].height/2,threshold=10}={}) {
 const moving={...snap(candidate,items,lookup,threshold)},width=lookup[moving.model].width;
 const targets=items.map(a=>{
  const m=lookup[a.model],shared=Math.min(moving.x+width,a.x+m.width)-Math.max(moving.x,a.x);
  return {item:a,shared,distance:Math.max(a.y-probeY,probeY-a.y-m.height,0)};
 }).filter(t=>t.shared>EPS&&t.shared>=Math.min(width,lookup[t.item.model].width)*.2&&t.distance<=Math.max(24,threshold*2))
 .sort((a,b)=>a.distance-b.distance||b.shared-a.shared||a.item.y-b.item.y);
 const target=targets[0]?.item,original=items.find(i=>i.id===candidate.id);
 // The old slot acts as a placeholder until the pointer crosses into a neighbor.
 if(target?.id===original?.id&&original) {
  moving.y=original.y;
  return {items:items.map(i=>i.id===moving.id?moving:{...i}),insertion:null};
 }
 const rest=liftOut(items,candidate.id,lookup);
 let insertion=null;
 if(target) {
  const mapped=rest.find(i=>i.id===target.id),after=probeY>=target.y+lookup[target.model].height/2;
  moving.y=mapped.y+(after?lookup[mapped.model].height:0);
  insertion={x:moving.x,y:moving.y,width,targetId:target.id,edge:after?'above':'below'};
 } else Object.assign(moving,snap(moving,rest,lookup,threshold));
 // Push only collided modules, then propagate upward across bridges. Columns
 // which merely share an edge never move, and different module heights work.
 const lifted=[moving];
 for(const a of [...rest].sort((a,b)=>a.y-b.y)) {
  const oldY=a.y;
  while(true) {
   const blockers=lifted.filter(b=>overlap(a,b,lookup));
   if(!blockers.length)break;
   a.y=Math.max(...blockers.map(b=>b.y+lookup[b.model].height));
  }
  if(a.y>oldY+EPS)lifted.push(a);
 }
 const byId=new Map([...rest,moving].map(i=>[i.id,i]));
 return {items:original?items.map(i=>byId.get(i.id)):[...rest,moving],insertion};
}
export function validatePlan(input,catalog) {
 if(!input||input.version!==1||!Array.isArray(input.items)||input.items.length>500)throw Error('方案格式无效（最多 500 个模块）');
 const known=new Set(catalog.modules.map(m=>m.id)),paths=new Set(catalog.files.map(f=>f.path));
 const items=input.items.map((i,n)=>{
  if(!known.has(i.model)||!Number.isFinite(i.x)||!Number.isFinite(i.y)||i.x<0||i.y<0||i.x>20000||i.y>20000)throw Error('方案中有无效的模块或坐标');
  const m=catalog.modules.find(m=>m.id===i.model);
  return {id:'import-'+n,model:i.model,x:i.x,y:i.y,grid:!!i.grid,rails:!!i.rails,roof:m.kind==='sustainer'?selectedRoof(m,i.roof):['none','Table','Grid','Bowl','Under Table Mount'].includes(i.roof)?i.roof:'Table',color:/^#[0-9a-fA-F]{6}$/.test(i.color||'')?i.color:'#dce2d5'};
 });
 const extras=(Array.isArray(input.extras)?input.extras:[]).map(p=>{if(!paths.has(p.path)||!Number.isInteger(p.qty)||p.qty<1||p.qty>999)throw Error('配件无效');return {path:p.path,qty:p.qty};});
 const overrides={};for(const [p,q] of Object.entries(input.overrides||{})){if(!paths.has(p)||!Number.isInteger(q)||q<0||q>999)throw Error('打印数量无效');overrides[p]=q;}
 return {version:1,title:typeof input.title==='string'?input.title.slice(0,80):'我的收纳工作台',items,extras,overrides};
}
export const csv = rows => '\ufeff'+rows.map(r=>r.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\r\n');
export function packEntries(bom, copies=false) {
 return bom.parts.flatMap(p=>{
  const segments=p.path.split('/'),base=segments.pop().replace(/\.stl$/i,''),folder=segments.join('/');
  return copies?Array.from({length:p.qty},(_,i)=>({path:p.path,name:`STL/${folder}/${base}__${i+1}-of-${p.qty}.stl`,bytes:p.bytes})): [{path:p.path,name:`STL/${folder}/${base}__print-${p.qty}.stl`,bytes:p.bytes}];
 });
}
