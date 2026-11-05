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
export function snapDividerPoint(point,grid){
 return {x:Math.max(0,Math.min(grid.w,Math.round(point.x))),y:Math.max(0,Math.min(grid.d,Math.round(point.y)))};
}
export function matchDividerLine(start,end,items,grid,data,{height,border='straight',id='draft'}={}){
 if(![start?.x,start?.y,end?.x,end?.y].every(Number.isFinite))return {valid:false,reason:'请在箱内选择起点和终点'};
 const a=snapDividerPoint(start,grid),b=snapDividerPoint(end,grid),dx=b.x-a.x,dy=b.y-a.y;
 if(!dx&&!dy)return {valid:false,reason:'拖出一条线，或再点一个终点'};
 const axis=Math.abs(dx)>=Math.abs(dy)?'h':'v',k=axis==='h'?'x':'y',q=axis==='h'?'y':'x',limit=axis==='h'?grid.w:grid.d;
 const sign=b[k]>=a[k]?1:-1,available=sign>0?limit-a[k]:a[k],requested=Math.abs(b[k]-a[k]);
 const parts=data.parts.filter(p=>p.role==='divider'&&p.height===height&&p.number<=available)
  .sort((p,r)=>Math.abs(p.number-requested)-Math.abs(r.number-requested)||p.number-r.number);
 if(!parts.length)return {valid:false,reason:'此方向空间不足，最短官方隔板为 5 号'};
 const part=parts[0],item={id,axis,n:part.number,x:a.x,y:a.y,border};
 if(sign<0)item[k]-=part.number;
 const valid=fits(item,items,grid);
 const reason=a[q]===0||a[q]===(axis==='h'?grid.d:grid.w)?'隔板需放在箱体内部，不能沿外壁重叠摆放':!valid?'与已有隔板重叠或交叉，请改成端点相接的 T 形分区':'';
 return {item,part,valid,reason,requested,adjusted:requested!==part.number};
}
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
