export const maxHeight=floor=>floor===1?34.5:82.5;
export function gridFor(spec,data){return {w:data.widthNumbers[spec.family],d:data.depthNumbers[spec.depth]};}
export function fits(item,items,grid){
 if(item.axis==='h'&&(item.y<=0||item.y>=grid.d)||item.axis==='v'&&(item.x<=0||item.x>=grid.w))return false;
 const end={x:item.x+(item.axis==='h'?item.n:0),y:item.y+(item.axis==='v'?item.n:0)};
 if(!Number.isInteger(item.x)||!Number.isInteger(item.y)||item.x<0||item.y<0||end.x>grid.w||end.y>grid.d||item.n<5)return false;
 // Parallel overlaps and interior crossings cannot be assembled; T joints may meet at endpoints.
 for(const b of items.filter(b=>b.id!==item.id)){
  if(item.axis===b.axis){const k=item.axis==='h'?'x':'y',q=k==='x'?'y':'x';if(item[q]===b[q]&&Math.max(item[k],b[k])<Math.min(item[k]+item.n,b[k]+b.n))return false;}
  else{const h=item.axis==='h'?item:b,v=item.axis==='v'?item:b;if(v.x>h.x&&v.x<h.x+h.n&&h.y>v.y&&h.y<v.y+v.n)return false;}
 }
 return true;
}
export function borderCount(item,grid){if(item.border==='none')return 0;const limit=item.axis==='h'?grid.w:grid.d,start=item.axis==='h'?item.x:item.y;return Number(start===0)+Number(start+item.n===limit);}
export function dividerBOM(state,data){
 const rows=new Map(),grid=gridFor(state.spec,data);
 const add=(part,qty)=>{if(!part)throw Error('官方模型不存在');const row=rows.get(part.path)||{...part,qty:0};row.qty+=qty;rows.set(part.path,row);};
 for(const item of state.items){add(data.parts.find(p=>p.role==='divider'&&p.number===item.n&&p.height===state.height),1);const count=borderCount(item,grid);if(count)add(data.parts.find(p=>p.role===item.border&&p.height===state.height),count);add(data.parts.find(p=>p.role===state.pin),2);}
 return [...rows.values()];
}
export function validPlan(plan,data){
 if(plan?.version!==1||!['S','M','L','XL'].includes(plan.spec?.family)||![3,4,5,6,7].includes(plan.spec.depth)||![1,2,4].includes(plan.spec.floor)||plan.spec.family==='XL'&&plan.spec.floor!==1||![20,34.5,82.5].includes(plan.height)||plan.height>maxHeight(plan.spec.floor)||!['loose','tight'].includes(plan.pin)||!Array.isArray(plan.items)||plan.items.length>100)return false;
 const ids=new Set(),grid=gridFor(plan.spec,data);return plan.items.every(i=>{if(!i||typeof i.id!=='string'||ids.has(i.id)||!['h','v'].includes(i.axis)||!['none','straight','rounded'].includes(i.border)||!data.parts.some(p=>p.role==='divider'&&p.number===i.n&&p.height===plan.height))return false;ids.add(i.id);return fits(i,plan.items,grid);});
}
