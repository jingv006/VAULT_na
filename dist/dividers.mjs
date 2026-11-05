import {gridFor,maxHeight,fits,dividerBOM,validPlan,snapDividerPoint,matchDividerLine} from './divider-layout.mjs?revision=draw-lines-1';
import {matchModelDirectory} from './local-models.mjs?revision=directory-tree-2';
import {readPalette} from './palette-store.mjs?revision=shared-palette-1';
const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const [data,cat,estimates]=await Promise.all(['dividers-data.json','catalog.json','estimates.json'].map(async u=>{const r=await fetch(u);if(!r.ok)throw Error('模型索引读取失败');return r.json();}));
const KEY='vault-divider-layouts-v1';let saved={},state,selected=null,history=[],drag=null,linked=new Map(),local=false,busy=false;
try{saved=JSON.parse(localStorage.getItem(KEY)||'{}');if(!saved||typeof saved!=='object'||Array.isArray(saved))saved={};}catch{}
let mode='draw',anchor=null,draft=null,stroke=null,hover=null;
const key=s=>s.family+s.depth+'F'+s.floor;
const blank=spec=>({version:1,spec,height:34.5,pin:'loose',items:[]});
const grid=()=>gridFor(state.spec,data),clone=x=>JSON.parse(JSON.stringify(x));
let timer;function toast(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(timer);timer=setTimeout(()=>$('toast').classList.remove('show'),3500);}
function save(){saved[key(state.spec)]=clone(state);try{localStorage.setItem(KEY,JSON.stringify(saved));$('saveState').textContent='方案已自动保存至本机';}catch{$('saveState').textContent='本机存储已满，请保存方案文件';}}
function checkpoint(){history.push(clone(state));if(history.length>60)history.shift();}
function loadSpec(){anchor=draft=stroke=hover=drag=null;const spec={family:$('family').value,depth:+$('depth').value,floor:+$('floor').value};if(spec.family==='XL')spec.floor=1;const stored=saved[key(spec)];state=validPlan(stored,data)?clone(stored):blank(spec);history=[];selected=null;sync();render();}
function sync(){for(const k of ['family','depth','floor'])$(k).value=state.spec[k];$('floor').disabled=state.spec.family==='XL';$('dividerHeight').innerHTML=[20,34.5,82.5].filter(n=>n<=maxHeight(state.spec.floor)).map(n=>`<option value="${n}">${n} mm${n===34.5?' · 1F 满高':n===82.5?' · 2F 满高':''}</option>`).join('');$('dividerHeight').value=state.height;$('pin').value=state.pin;}
function drawLibrary(){const available=data.parts.filter(p=>p.role==='divider'&&p.height===state.height&&p.number<=Math.max(grid().w,grid().d)).sort((a,b)=>a.number-b.number);$('pieceCount').textContent=available.length+' 款';$('pieceList').innerHTML=available.map(p=>`<article class="piece-card" draggable="true" data-n="${p.number}"><svg viewBox="0 0 100 22" aria-hidden="true"><path d="M3 17 L8 6 L92 6 L97 17Z" fill="#e9bc8c" stroke="#c99a68"/><circle cx="20" cy="12" r="2" fill="#fcfcf9"/><circle cx="80" cy="12" r="2" fill="#fcfcf9"/></svg><button aria-label="添加 ${p.number} 号隔板" data-add="${p.number}">＋</button><h3>${p.number} 号${p.number===data.widthNumbers[state.spec.family]?' · 横隔':''}</h3><small>${p.size[0]} mm 长 · ${state.height} mm 高</small></article>`).join('');
 $('pieceList').querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>add(+b.dataset.add));$('pieceList').querySelectorAll('[draggable]').forEach(a=>a.ondragstart=e=>e.dataTransfer.setData('text/plain',a.dataset.n));}
function endpoints(a){return [a.x,a.y,a.x+(a.axis==='h'?a.n:0),a.y+(a.axis==='v'?a.n:0)];}
function board(){const {w,d}=grid(),width={S:164.8,M:254,L:329.6,XL:418.8}[state.spec.family];$('board').setAttribute('viewBox',`-4 -3 ${w+8} ${d+6}`);
 let svg=`<defs><pattern id="holes" width="1" height="1" patternUnits="userSpaceOnUse"><circle cx="0" cy="0" r=".075" fill="#b6c4a7"/></pattern></defs><rect x="-.65" y="-.65" width="${w+1.3}" height="${d+1.3}" rx=".7" fill="#e4eada" stroke="#94a781" stroke-width=".12"/><rect width="${w}" height="${d}" rx=".25" fill="#f3f6ec"/><rect width="${w}" height="${d}" fill="url(#holes)"/><text x="${w/2}" y="-1.5" text-anchor="middle" fill="#91a27f" font-size=".48">${state.spec.family}${state.spec.depth}F${state.spec.floor} · 官方编号规划</text>`;
 for(const a of state.items){const [x,y,x2,y2]=endpoints(a),active=a.id===selected;svg+=`<g class="divider" data-id="${esc(a.id)}" role="button" tabindex="0" aria-label="${a.n}号${a.axis==='h'?'横向':'纵向'}隔板"><path d="M${x} ${y}L${x2} ${y2}" stroke="transparent" stroke-width="1.2"/><path d="M${x} ${y}L${x2} ${y2}" stroke="${active?'#526f3c':'#c59059'}" stroke-width="${active?'.6':'.4'}" stroke-linecap="round"/><path d="M${x} ${y}L${x2} ${y2}" stroke="#edc59a" stroke-width=".24"/>`;
 for(const [px,py] of [[x,y],[x2,y2]]){const wall=a.axis==='h'?(px===0||px===w):(py===0||py===d);if(wall&&a.border!=='none')svg+=`<rect x="${px-.24}" y="${py-.24}" width=".48" height=".48" rx="${a.border==='rounded'?'.2':'.02'}" fill="#a7b49a" stroke="#7e926d" stroke-width=".06"/>`;}
 for(const t of [2/a.n,1-2/a.n])svg+=`<circle cx="${x+(x2-x)*t}" cy="${y+(y2-y)*t}" r=".11" fill="#f8faf3" stroke="#6a8058" stroke-width=".05"/>`;
 svg+=`<text x="${(x+x2)/2}" y="${(y+y2)/2-.38}" text-anchor="middle" font-size=".45" fill="#627b4e">${a.n}号</text></g>`;}
 $('planName').textContent=`${state.spec.family}${state.spec.depth}F${state.spec.floor} · 隔板规划`;$('drawerSize').textContent=`外箱名义尺寸 ${width} 宽 × ${state.spec.depth*42} 深 × ${state.spec.floor*48} 高 mm。隔板编号范围：横向 ${w}，纵向 ${d}。`;
 if(mode==='draw'&&hover)svg+=`<circle class="snap-point" cx="${hover.x}" cy="${hover.y}" r=".17" fill="#658552" stroke="white" stroke-width=".05" pointer-events="none"/>`;
 if(anchor){const d=draft?.item,[x,y,x2,y2]=d?endpoints(d):[anchor.x,anchor.y,anchor.x,anchor.y],colour=draft?.valid?'#597b43':'#c17a53';svg+=`<g class="draft-line" pointer-events="none" aria-hidden="true"><path d="M${x} ${y}L${x2} ${y2}" stroke="${colour}" stroke-width=".22" stroke-dasharray=".2 .12"/><circle cx="${anchor.x}" cy="${anchor.y}" r=".21" fill="${colour}" stroke="white" stroke-width=".06"/>${d?`<circle cx="${x2===anchor.x&&y2===anchor.y?x:x2}" cy="${x2===anchor.x&&y2===anchor.y?y:y2}" r=".18" fill="white" stroke="${colour}" stroke-width=".07"/>`:''}</g>`;}
 $('board').innerHTML=svg;$('board').dataset.tool=mode;
 $('drawMode').setAttribute('aria-pressed',String(mode==='draw'));$('editMode').setAttribute('aria-pressed',String(mode==='edit'));
 const a=state.items.find(i=>i.id===selected);$('selection').innerHTML=a?`<strong>${a.n}号 · ${a.axis==='h'?'横向':'纵向'} · ${state.height} mm 高</strong><span>起点 ${a.x}, ${a.y} · 孔数坐标</span><button id="rotatePiece">旋转 R</button><button id="removePiece">删除</button>`:mode==='draw'?'按住拖出一条线，或依次点击起点与终点；横竖自动吸附孔位。':'点击隔板后拖动，按 R 旋转，Delete 删除。';if(a){$('rotatePiece').onclick=rotate;$('removePiece').onclick=remove;}
 if(anchor){$('selection').innerHTML=`<strong>${draft?.part?`自动匹配 ${draft.part.number} 号 · ${draft.part.size[0]} mm 长`: '已选起点 '+anchor.x+', '+anchor.y}</strong><span>${draft?.valid?'松开鼠标或点击终点即可放置'+(draft.adjusted?' · 已匹配最近的官方长度':''):esc(draft?.reason||'拖动鼠标，或点击终点')}</span><button id="cancelLine">取消 Esc</button>`;$('cancelLine').onclick=()=>{cancelDrawing();board();};}
 $('undo').disabled=!history.length&&!anchor;$('clear').disabled=!state.items.length&&!anchor;$('layoutStatus').textContent=state.items.length?`✓ ${state.items.length} 片隔板 · 无越界、重叠或交叉穿插`:'在箱内连线，即可自动匹配并添加官方隔板';}

const labels={divider:'隔板',straight:'直边端部件',rounded:'圆角端部件',loose:'松配插销',tight:'紧配插销'};
const name=p=>p.role==='divider'?p.number+'号隔板 · '+p.height+' mm':labels[p.role]+(p.height?' · '+p.height+' mm':'');
function bom(){const rows=dividerBOM(state,data);renderUsedParts(rows);let grams=0,seconds=0,missing=0;for(const r of rows){const e=estimates.records[r.path];if(e?.status==='ok'){grams+=e.grams*r.qty;seconds+=e.seconds*r.qty;}else missing++;}const mins=Math.ceil(seconds/60);$('grams').textContent=(missing?'≥ ':'')+(grams>=1000?(grams/1000).toFixed(2)+' kg':grams.toFixed(1)+' g');$('duration').textContent=(missing?'≥ ':'')+(mins>=60?Math.floor(mins/60)+'小时':'')+(mins%60)+'分';$('bomCount').textContent=state.items.length+' 片隔板 · '+rows.reduce((n,p)=>n+p.qty,0)+' 份打印';$('estimateNote').textContent=`H2D · PLA · 0.4 mm · 0.20 mm · 15% 填充 · 2层墙。${missing?missing+' 种文件未计入估算。':'按原有切片记录与打印份数汇总。'}`;
 $('bomList').innerHTML=rows.length?`<table><thead><tr><th>官方模型 / 文件</th><th>份数</th><th>单份耗材</th></tr></thead><tbody>${rows.map(p=>`<tr><td>${name(p)}<small>${esc(p.path)}</small></td><td>${p.qty}</td><td>${estimates.records[p.path]?.status==='ok'?estimates.records[p.path].grams.toFixed(1)+' g':'暂无记录'}</td></tr>`).join('')}</tbody></table>`:'<p class="muted small">添加隔板后，端部件和插销会一起列出。</p>';$('download3mf').disabled=busy||!rows.length;$('download3mf').textContent=busy?'正在整理 3MF…':'↓ 下载整合 3MF';$('csv').disabled=!rows.length;}
function renderUsedParts(rows){
 $('usedPartCount').textContent=rows.length+' 种';
 const sorted=[...rows].sort((a,b)=>['divider','straight','rounded','loose','tight'].indexOf(a.role)-['divider','straight','rounded','loose','tight'].indexOf(b.role)||(a.number||0)-(b.number||0));
 $('usedParts').innerHTML=sorted.length?sorted.map(p=>{
  const text=p.role==='divider'?`${p.size[0]} mm 长 · ${p.height} mm 高`:p.role==='loose'||p.role==='tight'?'每片隔板 2 个':'仅统计接触箱壁的端点';
  const content=`<i class="used-part-icon ${p.role}" aria-hidden="true"></i><span><strong>${esc(name(p))}</strong><small>${text}</small></span><b>×${p.qty}</b>`;
  return p.role==='divider'?`<button class="used-part-row" data-used-n="${p.number}" title="选择已放置的 ${p.number} 号隔板">${content}</button>`:`<div class="used-part-row">${content}</div>`;
 }).join(''):'<div class="used-parts-empty"><span>⌁</span><strong>先画一条分区线</strong><p>自动匹配的官方隔板与配套件会显示在这里。</p></div>';
 $('usedPartsSummary').textContent=state.items.length?`${state.items.length} 片隔板 · ${rows.reduce((n,p)=>n+p.qty,0)} 份打印`:'横竖连线 · 孔位吸附 · 即画即用';
 $('usedParts').querySelectorAll('[data-used-n]').forEach(button=>button.onclick=()=>{cancelDrawing();mode='edit';selected=state.items.find(i=>i.n===+button.dataset.usedN)?.id;board();});
}
function render(){board();bom();save();}
function add(n,point){if(state.items.length>=100)return toast('单个方案最多 100 片隔板');const axis=$('axis').value,a={id:crypto.randomUUID(),n,axis,x:point?Math.round(point.x):0,y:point?Math.round(point.y):0,border:$('border').value};if(!point){let found=false;const g=grid();for(let y=0;y<=g.d&&!found;y++)for(let x=0;x<=g.w&&!found;x++){a.x=x;a.y=y;if(fits(a,state.items,g)){found=true;}}if(!found)return toast('没有合适位置，请更换方向、编号或移动已有隔板');}if(!fits(a,state.items,grid()))return toast('此处越界或与已有隔板重叠 / 交叉，请换一个位置');checkpoint();state.items.push(a);selected=a.id;mode='edit';cancelDrawing();render();}
function rotate(){const a=state.items.find(i=>i.id===selected);if(!a)return;const next={...a,axis:a.axis==='h'?'v':'h'};if(!fits(next,state.items,grid()))return toast('旋转后放不下，请先移动隔板');checkpoint();Object.assign(a,next);render();}
function remove(){if(!selected)return;checkpoint();state.items=state.items.filter(i=>i.id!==selected);selected=null;render();}
function point(e){const p=$('board').createSVGPoint();p.x=e.clientX;p.y=e.clientY;return p.matrixTransform($('board').getScreenCTM().inverse());}
function cancelDrawing(){anchor=draft=stroke=hover=null;}
function setMode(next){endDrag(true);cancelDrawing();mode=next;selected=null;board();}
function updateDraft(p){hover=snapDividerPoint(p,grid());draft=matchDividerLine(anchor,p,state.items,grid(),data,{height:state.height,border:$('border').value});}
function finishLine(p){
 updateDraft(p);const result=draft;cancelDrawing();
 if(!result.valid){board();return toast(result.reason);}
 if(state.items.length>=100){board();return toast('单个方案最多 100 片隔板');}
 checkpoint();const item={...result.item,id:crypto.randomUUID()};state.items.push(item);selected=item.id;render();
 toast(`已匹配 ${result.part.number} 号隔板 · ${result.part.size[0]} mm 长`);
}
$('drawMode').onclick=()=>setMode('draw');$('editMode').onclick=()=>setMode('edit');
$('board').onpointerdown=e=>{
 if(e.button!==0||!e.isPrimary)return;const p=point(e);
 if(mode==='draw'){
  if(p.x<-.3||p.x>grid().w+.3||p.y<-.3||p.y>grid().d+.3)return;
  const hadAnchor=!!anchor;if(!anchor)anchor=snapDividerPoint(p,grid());
  stroke={pointerId:e.pointerId,x:e.clientX,y:e.clientY,hadAnchor};selected=null;updateDraft(p);
  $('board').setPointerCapture(e.pointerId);e.preventDefault();board();return;
 }
 const g=e.target.closest('[data-id]');selected=g?.dataset.id||null;
 if(selected){const a=state.items.find(i=>i.id===selected);drag={before:clone(state),point:p,a:clone(a)};$('board').setPointerCapture(e.pointerId);}board();
};
$('board').onpointermove=e=>{
 if(!e.isPrimary)return;
 if(mode==='draw'){
  const p=point(e);if(!anchor&&(p.x<0||p.x>grid().w||p.y<0||p.y>grid().d)){if(hover){hover=null;board();}return;}
  if(anchor)updateDraft(p);else hover=snapDividerPoint(p,grid());board();return;
 }
 if(!drag)return;const p=point(e),a={...drag.a,x:Math.round(drag.a.x+p.x-drag.point.x),y:Math.round(drag.a.y+p.y-drag.point.y)};
 if(fits(a,state.items,grid())){Object.assign(state.items.find(i=>i.id===a.id),a);board();}
};
function endDrag(cancel=false){if(!drag)return;if(cancel)state=drag.before;else if(JSON.stringify(state)!==JSON.stringify(drag.before)){history.push(drag.before);}drag=null;render();}
$('board').onpointerup=e=>{
 if(!e.isPrimary)return;
 if(mode==='draw'&&stroke){const finish=stroke.hadAnchor||Math.hypot(e.clientX-stroke.x,e.clientY-stroke.y)>=6;stroke=null;if(finish)finishLine(point(e));else board();}
 else endDrag();
};
$('board').onpointercancel=()=>{cancelDrawing();endDrag(true);board();};
$('board').onlostpointercapture=()=>{if(stroke){cancelDrawing();board();}endDrag();};
$('board').onpointerleave=()=>{if(!anchor&&!drag){hover=null;board();}};
$('board').onkeydown=e=>{if(['Enter',' '].includes(e.key)&&e.target.closest('[data-id]')){e.preventDefault();cancelDrawing();mode='edit';selected=e.target.closest('[data-id]').dataset.id;board();}};
$('board').ondragover=e=>e.preventDefault();$('board').ondrop=e=>{e.preventDefault();const n=+e.dataTransfer.getData('text/plain');if(data.parts.some(p=>p.role==='divider'&&p.number===n&&p.height===state.height))add(n,point(e));};
for(const id of ['family','depth','floor'])$(id).onchange=()=>{save();loadSpec();drawLibrary();};$('dividerHeight').onchange=()=>{cancelDrawing();checkpoint();state.height=+$('dividerHeight').value;drawLibrary();render();};$('pin').onchange=()=>{checkpoint();state.pin=$('pin').value;render();};
$('undo').onclick=()=>{if(anchor){cancelDrawing();board();return;}if(!history.length)return;cancelDrawing();state=history.pop();selected=null;sync();drawLibrary();render();};$('clear').onclick=()=>{cancelDrawing();if(!state.items.length){board();return;}checkpoint();state.items=[];selected=null;render();};$('example').onclick=()=>{cancelDrawing();checkpoint();state.items=[{id:crypto.randomUUID(),n:grid().w,axis:'h',x:0,y:Math.floor(grid().d/2),border:$('border').value}];selected=state.items[0].id;render();};
document.addEventListener('keydown',e=>{if(/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;if(e.key==='Escape'){cancelDrawing();endDrag(true);selected=null;board();}if(e.key.toLowerCase()==='r')rotate();if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();remove();}const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key],a=state.items.find(i=>i.id===selected);if(a&&delta){e.preventDefault();const next={...a,x:a.x+delta[0],y:a.y+delta[1]};if(fits(next,state.items,grid())){checkpoint();Object.assign(a,next);render();}}});
function download(blob,filename){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}
function csv(plan=state){return '\ufeff部件,打印份数,源文件\r\n'+dividerBOM(plan,data).map(p=>[name(p),p.qty,p.path].map(s=>'"'+String(s).replaceAll('"','""')+'"').join(',')).join('\r\n');}
$('csv').onclick=()=>download(new Blob([csv()],{type:'text/csv;charset=utf-8'}),key(state.spec)+'-隔板清单.csv');$('savePlan').onclick=()=>download(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),key(state.spec)+'-隔板方案.json');$('importPlan').onclick=()=>$('planInput').click();$('planInput').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{const plan=JSON.parse(await f.text());if(!validPlan(plan,data))throw Error('方案规格、模型或排布无效');save();cancelDrawing();state=plan;history=[];selected=null;sync();drawLibrary();render();toast('已导入隔板方案');}catch(error){toast(error.message);}e.target.value='';};
$('chooseModelDirectory').disabled=false;$('chooseModelDirectory').onclick=()=>$('folderInput').click();$('folderInput').onchange=e=>{try{const result=matchModelDirectory([...e.target.files],cat);linked=result.files;toast('已连接 '+result.stls+' 个模型文件');$('modelDirectoryStatus').innerHTML='<i></i>本地文件已连接';}catch(error){toast(error.message);}e.target.value='';};
try{const r=await fetch('/api/status');if(r.ok)local=(await r.json()).ready===true;}catch{}$('modelDirectoryStatus').innerHTML='<i></i>'+(local?'本机模型库已连接':'本地模型 · 无需上传');
$('download3mf').onclick=async()=>{
 if(busy||!state.items.length)return;
 busy=true;bom();$('exportDownload').hidden=true;const snapshot=clone(state),title=key(snapshot.spec);let completed=null;
 $('exportStatus').textContent=title+' · 正在准备隔板 3MF…';
 try{
  const status=await fetch('/api/status');if(!status.ok||!(await status.json()).ready)throw Error('请使用本机启动入口打开页面；整合 3MF 需要本机服务及原始模型库');
  const response=await fetch('/api/divider-3mf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({plan:snapshot,colours:readPalette()})});
  if(!(response.headers.get('content-type')||'').includes('application/json'))throw Error('请重新启动本机服务后重试');
  let job=await response.json();if(!response.ok)throw Error(job.error||'3MF 生成失败');
  while(job.status!=='done'){
   if(job.status==='error')throw Error(job.error||'3MF 生成失败');
   $('download3mf').textContent='正在整理 3MF…';$('exportStatus').textContent=title+' · '+(job.current||'等待整理')+` · ${job.done}/${job.total} 种文件`;
   await new Promise(resolve=>setTimeout(resolve,1000));
   const next=await fetch('/api/kit-job/'+encodeURIComponent(job.id));job=await next.json();if(!next.ok)throw Error(job.error||'进度查询失败');
  }
  completed=job;const link=$('exportDownload');link.href=job.download;link.download=job.filename;link.textContent='重新下载 '+title+' 隔板 3MF ↗';link.hidden=false;link.click();
 }catch(error){$('exportStatus').textContent='生成失败：'+error.message;toast(error.message);}
 finally{busy=false;bom();if(completed){$('exportStatus').textContent=title+' · 3MF 已完成，已按实际数量整理全部零件，可直接导入切片软件。';toast('隔板 3MF 已生成，开始下载');}}
};
loadSpec();drawLibrary();
