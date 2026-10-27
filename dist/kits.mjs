import {makeBOM,estimateBOM,csv} from './core.mjs?revision=flip-roof-load-2';
import {partName} from './i18n.mjs';
import {printerBOM} from './printers.mjs';
import {kitPreview} from './kit-preview.mjs?revision=flip-roof-load-2';
import {KitDisplay} from './kit-display.mjs?revision=flip-roof-load-2';
import {roofChoices,selectedRoof} from './roof-options.mjs?revision=flip-roof-load-2';
import {matchModelDirectory} from './local-models.mjs?revision=directory-picker-1';
let viewer,selectedFiles=new Map(),fileURLs=new Map();
function localFileURL(path){
 const file=selectedFiles.get(path);if(!file)return null;
 if(!fileURLs.has(path))fileURLs.set(path,URL.createObjectURL(file));
 return fileURLs.get(path);
}
function bindModelDirectory(){
 $('chooseModelDirectory').disabled=false;
 $('chooseModelDirectory').onclick=()=>$('modelDirectoryInput').click();
 $('modelDirectoryInput').onchange=e=>{
  try{
   if(!e.target.files.length)return;
   const result=matchModelDirectory(e.target.files,cat);
   for(const url of fileURLs.values())URL.revokeObjectURL(url);fileURLs.clear();selectedFiles=result.files;
   $('chooseModelDirectory').textContent='重新选择模型目录';
   $('modelDirectoryStatus').querySelector('span').textContent=`已匹配 ${result.stls}/${result.totalSTLs} STL`;
   $('modelDirectoryFeedback').textContent=`已连接 ${result.root}：匹配 ${result.stls}/${result.totalSTLs} 个 STL。${result.missing.length?'缺少或版本不匹配 '+result.missing.length+' 个模型，缺失的文件需重新选择正确目录。':'目录结构与已知文件大小匹配。'}文件仅在浏览器本地读取，不上传。`;
   $('modelDirectoryFeedback').classList.remove('error');renderDetail();
  }catch(error){$('modelDirectoryFeedback').textContent=error.message;$('modelDirectoryFeedback').classList.add('error');}
  finally{$('modelDirectoryFeedback').hidden=false;e.target.value='';}
 };
}

const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const code=m=>m.family+m.depth+'F'+m.floor;
const mass=n=>n>=1000?(n/1000).toFixed(2)+' kg':n.toFixed(1)+' g';
const duration=n=>{const mins=Math.ceil(n/60),hours=Math.floor(mins/60);return hours?hours+'小时'+(mins%60?mins%60+'分':''):mins+'分';};
let cat,estimates,palette,geometry,printers,lookup,selected='d-S3-1',kind='drawer',family='all',floor='all',depth='all',query='',options={roof:'Table',grid:false,rails:false},colours={},busy=false,local=false;
function model(){return lookup[selected];}
function snapshot(){return {model:selected,roof:options.roof,grid:options.grid,rails:options.rails,colours:{...colours}};}
function bom(){return makeBOM({items:[{id:'single-kit',model:selected,x:0,y:0,...options}],extras:[],overrides:{}},cat);}
function colouredRows(){return bom().parts.map(p=>({...p,slot:palette.roleSlots[p.role]}));}
function renderThumbnails(){
 document.querySelectorAll('#kitList [data-model]').forEach(button=>{const m=lookup[button.dataset.model];button.querySelector('.kit-card-icon').innerHTML=kitPreview(m,{colours,compact:true,...(m.id===selected?options:{})});});
}
function renderList(){
 const q=query.toLowerCase().replace(/[\s·-]/g,'');
 const models=cat.modules.filter(m=>m.kind===kind&&(family==='all'||m.family===family)&&(floor==='all'||m.floor===+floor)&&(depth==='all'||m.depth===+depth)&&(!q||(code(m)+' '+m.name+' '+m.subtitle+' '+m.id).toLowerCase().replace(/[\s·-]/g,'').includes(q)||(''+m.family+m.depth+m.floor+'f').toLowerCase()===q));
 $('kitCount').textContent=models.length+' 种配方';$('kitList').innerHTML=models.map(m=>`<button class="kit-card ${selected===m.id?'active':''}" data-model="${m.id}"><span class="kit-card-icon">${kitPreview(m,{colours,compact:true,...(m.id===selected?options:{})})}</span><strong>${code(m)}${m.variant==='twin'?'²':''}</strong><span>${esc(m.subtitle)}</span><small>${m.width} × ${m.nominalDepth} × ${m.height} mm</small></button>`).join('')||'<p class="empty">没有符合条件的箱子，试试其他筛选。</p>';
 $('kitList').querySelectorAll('[data-model]').forEach(button=>button.onclick=()=>{selected=button.dataset.model;options={roof:'Table',grid:false,rails:false};history.replaceState(null,'','#'+selected);renderList();renderDetail();});
}
function renderDetail(){
 const m=model();options.roof=selectedRoof(m,options.roof);
 const b=bom(),e=estimateBOM(b,estimates),rows=colouredRows(),fit=printerBOM(b,printers.printers.find(p=>p.id==='h2d'),geometry);
 $('kitName').textContent=code(m)+(m.variant==='twin'?' · 双抽屉':'');$('kitSubtitle').textContent=m.subtitle+' · 单个完整模块';viewer?.update(m,options,colours);renderThumbnails();
 $('kitDimensions').textContent=m.width+' 宽 × '+m.nominalDepth+' 深 × '+m.height+' 高 mm';
 $('kitFileCount').textContent=b.parts.length;$('kitCopyCount').textContent=b.copies;$('kitMass').textContent=mass(e.grams);$('kitTime').textContent=duration(e.seconds);
 $('roofOption').hidden=false;$('railsOption').hidden=m.kind!=='drawer';$('kitRoof').innerHTML=roofChoices(m).map(([value,title])=>`<option value="${esc(value)}">${esc(title)}</option>`).join('');$('kitRoof').value=options.roof;$('kitGrid').checked=options.grid;$('kitRails').checked=options.rails;
 $('partsCount').textContent=b.parts.length+' 种 STL · '+b.copies+' 份打印';
 $('kitParts').innerHTML=rows.map(p=>{const slot=palette.slots.find(s=>s.id===p.slot);return `<tr><td><strong>${esc(partName(p))}</strong><span class="part-role">${esc(p.role)}</span><details class="source-file"><summary>原始 STL 文件</summary><a href="${localFileURL(p.path)||'/api/file/'+encodeURIComponent(p.path)}" download="${esc(p.name)}">${esc(p.name)}</a><span>${esc(p.path)}</span></details>${p.note?'<small class="part-note">'+esc(p.note)+'</small>':''}</td><td class="qty-col">${p.qty}<small>份</small></td><td><span class="colour-tag"><i style="background:${colours[p.slot]}"></i>${esc(slot.name.split(' · ')[0])}</span></td><td class="unit-estimate">${mass(estimates.records[p.path].grams)}<small>${duration(estimates.records[p.path].seconds)}</small></td></tr>`;}).join('');
 const totals=palette.slots.map(s=>({s,rows:rows.filter(p=>p.slot===s.id)})).filter(g=>g.rows.length);
 $('colourBreakdown').innerHTML=totals.map(({s,rows})=>`<div><i style="background:${colours[s.id]}"></i><span>${s.name}</span><strong>${rows.reduce((n,p)=>n+p.qty,0)}份</strong><small>${mass(rows.reduce((n,p)=>n+estimates.records[p.path].grams*p.qty,0))}</small></div>`).join('');
 $('kitWarnings').innerHTML=[fit.blockedFiles?`<p>尺寸核对：${fit.blockedFiles} 种零件按当前方向放不进 H2D 单喷嘴范围，3MF 中保留原尺寸并单独标记，需调整方向或拆分。</p>`:'',e.supportCopies?`<p>${e.supportCopies} 份零件标注需支撑，3MF 已预设开启；汇总用量仍是原 H2D 切片基准，额外支撑另计。</p>`:'',e.autoSupportCopies?`<p>${e.autoSupportCopies} 份特殊分件的基准统计已包含自动支撑。</p>`:''].join('');
 $('kitHardware').innerHTML=b.hardware.map(h=>`<span>${esc(h.name)} <b>× ${h.qty}</b></span>`).join('');
 $('download3mf').disabled=busy||!local;$('download3mf').textContent=busy?'正在整理 3MF…':'↓ 下载预分色 3MF';$('downloadQuick').disabled=busy||!local;
 $('downloadHint').textContent=local?'首次生成会整理真实网格，完成后自动下载；相同配方再次下载直接读取缓存。':(selectedFiles.size?'已连接浏览器本地模型，原始 STL 可在文件清单下载；预分色 3MF 请使用本机启动服务生成。':'请通过本机启动文件打开网页以生成 3MF；也可在右上角选择原模型目录，直接读取原始 STL。');
 $('openWorkbench').href='workbench.html?kit='+encodeURIComponent(m.id);
}
function renderPalette(){
 $('paletteInputs').innerHTML=palette.slots.map(s=>`<label><input type="color" data-slot="${s.id}" value="${colours[s.id]}" aria-label="${s.name}颜色"><span>${s.name}</span><small>${colours[s.id]}</small></label>`).join('');
 document.querySelectorAll('[data-slot]').forEach(input=>input.oninput=()=>{colours[input.dataset.slot]=input.value.toUpperCase();try{localStorage.setItem('vault-kit-colours',JSON.stringify(colours));}catch{}input.parentElement.querySelector('small').textContent=input.value.toUpperCase();renderDetail();});
}
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}
async function downloadKit(){
 if(busy)return;const spec=snapshot(),title=code(model());busy=true;renderDetail();$('kitProgress').hidden=false;$('jobDownload').hidden=true;$('jobText').textContent='正在准备 '+title+' 的完整模型…';$('jobBar').style.width='2%';$('kitProgress').scrollIntoView({behavior:'smooth',block:'center'});
 try{const res=await fetch('/api/kit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(spec)});let job=await res.json();if(!res.ok)throw Error(job.error||'生成失败');
  while(job.status!=='done'){
   if(job.status==='error')throw Error(job.error);
   $('jobText').textContent=title+' · '+(job.current||'等待整理');$('jobBar').style.width=Math.max(2,Math.round(90*job.done/Math.max(1,job.total)))+'%';
   await new Promise(r=>setTimeout(r,1200));const next=await fetch('/api/kit-job/'+job.id);job=await next.json();if(!next.ok)throw Error(job.error||'进度查询失败');
  }
  $('jobBar').style.width='100%';$('jobText').textContent=title+' · 3MF 已完成，已按份数整合并分配颜色';const a=$('jobDownload');a.href=job.download;a.download=job.filename;a.hidden=false;a.textContent='重新下载 '+title+' 3MF ↗';a.click();
 }catch(error){$('jobText').textContent='生成失败：'+error.message+'。可重试，已整理的网格会保留。';}
 finally{busy=false;renderDetail();}
}
async function init(){
 try{[cat,estimates,palette,geometry,printers]=await Promise.all(['catalog.json','estimates.json','palette.json','geometry.json','printers.json'].map(async path=>{const r=await fetch(path+(path==='catalog.json'?'?revision=aligned-holes-2':''),{cache:'no-store'});if(!r.ok)throw Error(path+' 读取失败');return r.json();}));lookup=Object.fromEntries(cat.modules.map(m=>[m.id,m]));const hash=decodeURIComponent(location.hash.slice(1));if(lookup[hash])selected=hash;kind=model().kind;
  colours=Object.fromEntries(palette.slots.map(s=>[s.id,s.hex]));try{const saved=JSON.parse(localStorage.getItem('vault-kit-colours')||'{}');for(const s of palette.slots)if(/^#[0-9A-F]{6}$/i.test(saved[s.id]||''))colours[s.id]=saved[s.id];}catch{}try{const r=await fetch('/api/status');if(r.ok){const status=await r.json();local=status.local&&status.ready;}}catch{}
  bindModelDirectory();
  $('kitSearch').oninput=e=>{query=e.target.value;renderList();};
  for(const [id,key] of [['kitFamily','family'],['kitFloor','floor'],['kitDepth','depth']])$(id).onchange=e=>{if(key==='family')family=e.target.value;if(key==='floor')floor=e.target.value;if(key==='depth')depth=e.target.value;renderList();};
  document.querySelectorAll('[data-kind]').forEach(button=>{button.classList.toggle('active',button.dataset.kind===kind);button.onclick=()=>{kind=button.dataset.kind;document.querySelectorAll('[data-kind]').forEach(b=>b.classList.toggle('active',b===button));renderList();};});
  $('kitRoof').onchange=e=>{options.roof=e.target.value;renderDetail();};$('kitGrid').onchange=e=>{options.grid=e.target.checked;renderDetail();};$('kitRails').onchange=e=>{options.rails=e.target.checked;renderDetail();};
  $('download3mf').onclick=downloadKit;$('downloadQuick').onclick=downloadKit;$('resetPalette').onclick=()=>{try{localStorage.removeItem('vault-kit-colours');}catch{}colours=Object.fromEntries(palette.slots.map(s=>[s.id,s.hex]));renderPalette();renderDetail();};
  $('kitCSV').onclick=()=>{const rows=colouredRows();download(new Blob([csv([['中文名称','原始文件','原始路径','打印份数','用途','颜色','材料槽'],...rows.map(p=>[partName(p),p.name,p.path,p.qty,p.role,colours[p.slot],palette.slots.findIndex(s=>s.id===p.slot)+1])])],{type:'text/csv;charset=utf-8'}),code(model())+'-文件与配色清单.csv');};
  $('referenceGrid').innerHTML=palette.sources.map(s=>`<a class="reference-card" href="${s.image}" target="_blank"><img loading="lazy" src="${s.image}" alt="${s.title}"><strong>${s.title}</strong><small>${s.file} · 第 ${s.page} 页</small></a>`).join('');
  viewer=new KitDisplay({diagram:$('kitDiagram'),assembly:$('kitArt'),controls:$('kitViewControls'),hint:$('kitViewHint'),local,onRoofChange:roof=>{options.roof=roof;renderDetail();}});renderPalette();renderList();renderDetail();
 }catch(e){$('kitList').innerHTML='<p class="error">'+esc(e.message)+'</p>';}
}
init();
