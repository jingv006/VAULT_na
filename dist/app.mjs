import {newFoundationIssue} from './foundation.mjs?revision=foundation-1';
import {constrainLayout,constrainedInsert} from './constraints.mjs?revision=foundation-1';
import {COLOUR_SLOTS,DEFAULT_COLOURS,PASTEL_COLOURS,PREVIEW_KEY,readPalette,writePalette,watchPalette,previewPalette,contrastColour,mixColour} from './palette-store.mjs?revision=shared-palette-1';
import {bounds,validate,isExposed,makeBOM,validatePlan,csv,packEntries,estimateBOM} from './core.mjs?revision=foundation-1';
import {writeZip} from './zip.mjs';
import {partName,folderName} from './i18n.mjs';
import {fitPart,printerBOM,fitLabel,customPrinter} from './printers.mjs?revision=workbench-options-1';
import {roofLibrary,roofTarget,drawerAccessoryState,setDrawerAccessory} from './workbench-options.mjs?revision=bulk-accessories-1';
import {roofChoices,selectedRoof} from './roof-options.mjs?revision=flip-roof-load-2';
import {randomLayout} from './random-layout.mjs?revision=foundation-1';
import {matchModelDirectory} from './local-models.mjs?revision=directory-tree-2';
const $=id=>document.getElementById(id), $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>Number(n.toFixed(1)).toLocaleString('zh-CN');
const size=n=>n>1e9?(n/1e9).toFixed(2)+' GB':n>1e6?(n/1e6).toFixed(1)+' MB':(n/1e3).toFixed(0)+' KB';
const COLORS=PASTEL_COLOURS;
let customColours=readPalette(),colourMode='pastel',pastelSeed=0;
try{const pref=JSON.parse(localStorage.getItem(PREVIEW_KEY)||'{}');colourMode=pref.mode==='custom'?'custom':'pastel';pastelSeed=Number.isInteger(pref.seed)?pref.seed>>>0:0;}catch{}
const appearance=()=>({mode:colourMode,colours:{...customColours},seed:pastelSeed});
const KEY='vault-workbench-plan-v1';
const PRINTER_KEY='vault-workbench-printer-v1';
let printerData=null,geometry=null,printerSettings={id:'h2d',margin:0,reorient:false};
try{Object.assign(printerSettings,JSON.parse(localStorage.getItem(PRINTER_KEY)||'{}'));}catch{}
try{printerSettings.custom=customPrinter(printerSettings.custom);}catch{printerSettings.custom=customPrinter({name:'我的打印机',volume:[220,220,250]});}
const PRINTER_BRANDS=['拓竹','创想三维','纵维立方'];
const printerGroup=printer=>printer.brand==='自定义'?'自定义':PRINTER_BRANDS.includes(printer.brand)?printer.brand:'其他品牌';
const printerLabel=printer=>printerGroup(printer)==='其他品牌'?printer.brand+' '+printer.name:printer.name;
const printerGroups=()=>[...PRINTER_BRANDS,'其他品牌'].filter(group=>printerData.printers.some(printer=>printerGroup(printer)===group));
const chosenPrinter=()=>printerSettings.id==='custom'?customPrinter(printerSettings.custom):printerData?.printers.find(p=>p.id===printerSettings.id)||printerData?.printers[0];
function syncCustomPrinterInputs(){const p=customPrinter(printerSettings.custom);$('customPrinterForm').hidden=printerSettings.id!=='custom';$('customPrinterName').value=p.name;['X','Y','Z'].forEach((axis,i)=>$('customPrinter'+axis).value=p.volume[i]);$('customPrinterError').hidden=true;}
const sourceBytes=(bom,copies)=>bom.parts.reduce((n,p)=>n+(linkedFiles.get(p.path)?.size??p.bytes)*(copies?p.qty:1),0);
const dimensionsText=size=>size?size.map(n=>Number(n.toFixed(3)).toLocaleString('zh-CN')).join(' × ')+' mm':'尺寸待读取';
const compatibility=bom=>printerBOM(bom,chosenPrinter(),geometry,printerSettings);
function moduleBOM(a){return makeBOM({items:[{...a,roof:lookup[a.model].kind==='drawer'&&!isExposed(a,state.items,lookup)?'none':a.roof}],extras:[],overrides:state.overrides},cat);}
function fitSummary(result){return result.unknown?'缺少 '+result.unknown+' 种尺寸记录':result.blockedFiles?result.blockedFiles+' 种当前放不下':result.reorient?'需换面 '+result.reorient+' 种':result.rotate?'需平面旋转 '+result.rotate+' 种':'全部零件尺寸内';}
function fitDetails(part){return fitLabel(part.fit.status)+(part.fit.status==='reorient'&&!printerSettings.reorient?' · 当前未允许换面':'')+' · '+dimensionsText(part.fit.size);}
function renderPrinters(bom=makeBOM(state,cat)){
 const p=chosenPrinter();if(!p||!geometry){$('printerSummary').textContent='打印机尺寸记录暂不可用，请刷新重试。';return;}
 const result=compatibility(bom),parts=result.parts.filter(p=>p.fit.status!=='fits');
 $('printerSummary').className='printer-summary '+result.status;
 $('printerSummary').textContent=!bom.parts.length?'添加模块后自动检查各零件尺寸':result.blockedFiles?`${p.brand} ${p.name}：${result.blockedFiles} 种 / ${result.blockedCopies} 份零件当前放不下`:`${p.brand} ${p.name}：${fitSummary(result)}`;
 $('printerVolume').textContent=dimensionsText(p.volume)+' · 宽 × 深 × 高';
 $('printerSource').hidden=!p.source;if(p.source)$('printerSource').href=p.source;else $('printerSource').removeAttribute('href');$('printerSource').textContent='官方规格 ↗';$('customPrinterForm').hidden=printerSettings.id!=='custom';
 $('printerNote').textContent=(p.note?p.note+' ':'')+'检查实际 STL 外形，默认允许平面旋转90°。超界表示所检查方向放不下，斜放或拆分请在切片器核对。支撑、裙边、擦嘴及禁入区会占用额外空间；换面后需重新切片，耗材与时间仍显示原 H2D 基准。';
 $('printerIssueCount').textContent=parts.length?`查看 ${parts.length} 种需处理零件（含转向提示）`:'全部零件均在原方向尺寸范围内';
 $('printerIssues').innerHTML=parts.map(part=>`<div class="printer-issue ${part.blocked?'blocked':'rotate'}"><div><strong>${esc(partName(part))}</strong><small>${esc(fitDetails(part))} · ${part.qty}份</small><details class="source-file"><summary>原文件</summary>${esc(part.path)}</details></div><span>${part.blocked?'当前放不下':'需转向'}</span></div>`).join('');
 $('printerMatrix').innerHTML=['自定义',...printerGroups()].map(brand=>`<div class="printer-brand ${brand==='自定义'?'printer-brand-custom':''}"><h3>${esc(brand)}</h3>${[...printerData.printers,customPrinter(printerSettings.custom)].filter(p=>printerGroup(p)===brand).map(printer=>{const r=printerBOM(bom,printer,geometry,printerSettings);return `<button class="printer-row ${r.status} ${printer.id===p.id?'selected':''}" data-printer="${printer.id}" title="${esc(dimensionsText(printer.volume)+'；'+fitSummary(r))}"><span><strong>${esc(printerLabel(printer))}</strong><small>${dimensionsText(printer.volume)}</small></span><b>${!bom.parts.length?'待添加':r.blockedFiles?r.blockedFiles+'种放不下':r.reorient?'需换面':r.rotate?'需平转':'尺寸内'}</b></button>`;}).join('')}</div>`).join('');
 $$('#printerMatrix [data-printer]').forEach(button=>button.onclick=()=>{printerSettings.id=button.dataset.printer;$('printerSelect').value=printerSettings.id;syncCustomPrinterInputs();savePrinterSettings();});
}
function savePrinterSettings(){try{localStorage.setItem(PRINTER_KEY,JSON.stringify(printerSettings));}catch{}draw();renderInspector();renderStats();if($('bomDialog').open)renderBOM();}

const massText=g=>g>=1000?(g/1000).toFixed(2)+' kg':(g<10?Number(g.toFixed(2)):fmt(g))+' g';
const timeText=seconds=>{const mins=Math.ceil(seconds/60),h=Math.floor(mins/60),m=mins%60;return h?h+'小时'+(m?m+'分':''):mins+'分';};
const estimateFor=bom=>estimateBOM(bom,estimates);
function estimateText(e){if(!e.knownFiles&&e.missingFiles)return '暂无可用切片记录';const prefix=e.complete?'':'已知部分 ≥ ';return prefix+massText(e.grams)+' · '+timeText(e.seconds);}
function unitEstimate(path,qty=1){const r=estimates?.records?.[path];if(r?.status==='ok')return massText(r.grams*qty)+' / '+timeText(r.seconds*qty);return r&&r.status!=='pending'?'暂不能估算':'待切片';}
function estimateState(path){const r=estimates?.records?.[path];if(!r)return '待切片';return r.status==='ok'?(r.estimateOnly?'仅估算 · 当前方向超界':'已切片'):r.status==='out_of_bounds'?'超出 H2D 范围':r.status==='timeout'?'切片超时':'切片异常';}
function estimateSummary(e){if(!e.knownFiles&&!e.missingFiles)return '添加模块后自动汇总耗材与时间';return e.complete?'本组 '+e.knownFiles+' 种模型均有切片记录':e.knownFiles+' 种已计入，'+e.missingFiles+' 种（'+e.missingCopies+'份）尚未计入总量';}
async function refreshEstimates(){
 clearTimeout(estimateTimer);
 try{const r=await fetch('estimates.json',{cache:'no-store'});if(!r.ok)throw Error('切片记录不可用');const data=await r.json();if(data.version!==1||!data.records)throw Error('切片记录无效');estimates=data;
 if(cat&&state){renderStats();const scroll=$('modelList').scrollTop;renderLibrary();$('modelList').scrollTop=scroll;if($('bomDialog').open&&!$('bomDialog').contains(document.activeElement))renderBOM();}
 }catch(e){if(cat&&state)renderStats();}
 if(!estimates?.summary?.complete)estimateTimer=setTimeout(refreshEstimates,15000);
}

let estimates=null,estimateTimer,stack3d,stack3dLoading,canvasMode='2d',previewAvailable=false;
let committedState=null,checkpointBackup=null;
let roofEntries=[],cat,lookup,fileMeta,state,selected=null,local=false,linkedFiles=new Map(),kind='drawer',family='all',height='all',depth='3',view='front',dims=true,magnet=true,history=[],future=[],drag=null,box=[-120,-480,650,570],homeBox=[-120,-480,650,570],bomTab='parts',toastTimer,exporting=false;
function toast(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),4000);}
function sample(){return {version:1,title:'我的收纳工作台',items:[{id:'base',model:'d-L3-4',x:0,y:0,color:COLORS[0],roof:'Table'},{id:'middle',model:'d-L3-1',x:0,y:192,color:COLORS[1],roof:'Table'},{id:'top-a',model:'d-S3-2',x:0,y:240,color:COLORS[0],roof:'Table'},{id:'top-b',model:'d-S3-2',x:164.8,y:240,color:COLORS[2],roof:'Table'}],extras:[],overrides:{}};}
function checkpoint(){const before=JSON.stringify(state);checkpointBackup={before,future:[...future]};history.push(before);if(history.length>60)history.shift();future=[];}
function save(){try{localStorage.setItem(KEY,JSON.stringify(state));$('saveStatus').textContent='已自动保存至本机';}catch{$('saveStatus').textContent='浏览器存储不可用，请保存方案';}}
function update({refit=false,constrain=true,checkFoundation=true}={}){
 const items=magnet&&constrain?constrainLayout(state.items,lookup):state.items;
 const issue=committedState&&checkFoundation?newFoundationIssue(committedState.items,items,lookup):null;
 if(issue){const previous=JSON.stringify(committedState);state=structuredClone(committedState);$('projectTitle').value=state.title;if(history.at(-1)===previous){history.pop();if(checkpointBackup?.before===previous)future=checkpointBackup.future;}if(!state.items.some(a=>a.id===selected))selected=null;toast(issue.text);}
 else state.items=items;
 committedState=structuredClone(state);checkpointBackup=null;save();draw();if(canvasMode==='3d')refreshStack3D();renderInspector();syncBulkAccessories();renderStats();if(refit)fit();$('undo').disabled=!history.length;$('redo').disabled=!future.length;$('clear').disabled=!state.items.length&&!state.extras.length&&!Object.keys(state.overrides).length;return !issue;}
function syncBulkAccessories(){
 for(const [id,key] of [['allDrawersGrid','grid'],['allDrawersRails','rails']]){
  const status=drawerAccessoryState(state.items,lookup,key),input=$(id);
  input.checked=status.checked;input.indeterminate=status.mixed;input.disabled=!status.total;
  input.setAttribute('aria-checked',status.mixed?'mixed':String(status.checked));
  input.title=status.total?`${status.enabled}/${status.total} 个抽屉模块已添加；点击为全部抽屉统一设置`:'添加抽屉模块后可使用';
 }
}
function applyBulkAccessory(key,enabled){
 const status=drawerAccessoryState(state.items,lookup,key);if(!status.total)return;
 checkpoint();state.items=setDrawerAccessory(state.items,lookup,key,enabled);
 const partsKey=key==='grid'?'gridParts':'railParts';
 // A bulk change restores recipe counts for these accessory files only.
 for(const item of state.items)if(lookup[item.model].kind==='drawer')for(const part of lookup[item.model][partsKey]||[])delete state.overrides[part.path];
 update();if($('bomDialog').open)renderBOM();
 toast(`已为 ${status.total} 个抽屉模块${enabled?'添加':'取消'}${key==='grid'?' Gridfinity 网格底板':'加强齿条'}，可撤销恢复`);
}
function restore(str){state=JSON.parse(str);if(magnet&&JSON.stringify(constrainLayout(state.items,lookup))!==JSON.stringify(state.items)){magnet=false;$('snapToggle').checked=false;toast('已恢复原自由布局，强吸附已关闭');}selected=null;$('projectTitle').value=state.title;update({refit:true,constrain:false,checkFoundation:false});}
function undo(){if(!history.length)return;future.push(JSON.stringify(state));restore(history.pop());}
function redo(){if(!future.length)return;history.push(JSON.stringify(state));restore(future.pop());}
function selectedItem(){return state.items.find(i=>i.id===selected);}
async function refreshStack3D(){
 if(canvasMode!=='3d')return;
 try{
  if(!stack3d){
   stack3dLoading??=import('./stack-viewer.mjs?revision=exterior-1').catch(error=>{stack3dLoading=null;throw error;});
   const {StackViewer}=await stack3dLoading;if(canvasMode!=='3d')return;
   stack3d??=new StackViewer($('workbench3d'));
  }
  if(canvasMode==='3d'){stack3d.setActive(true);await stack3d.update(structuredClone(state.items),cat,appearance());}
 }catch(error){setCanvasMode('2d');toast('三维显示暂不可用：'+error.message);}
}
function setCanvasMode(mode){
 if(mode==='3d'&&!previewAvailable)return toast('请通过本机服务打开网页以预览真实三维模型');
 canvasMode=mode;const is3d=mode==='3d';toggleRandomMenu(false);
 $('canvasWrap').classList.toggle('is-3d',is3d);$('workbench3d').hidden=!is3d;
 $('stackPreviewBtn').textContent=is3d?'返回二维视图':'3D 预览';$('stackPreviewBtn').setAttribute('aria-pressed',String(is3d));
 $$('.view-tabs button').forEach(button=>button.disabled=is3d);
 $('snapToggle').disabled=is3d;$('dimToggle').disabled=is3d;$('inspector').hidden=true;
 if(is3d){if(!stack3d)$('workbench3d').textContent='正在准备三维组合预览…';refreshStack3D();}
 else{stack3d?.setActive(false);draw();renderInspector();}
}
function mini(m){const w=m.width,h=Math.max(32,m.height),bw=120,bh=60,scale=Math.min((bw-15)/w,(bh-12)/h),rw=w*scale,rh=h*scale,x=(bw-rw)/2,y=(bh-rh)/2;let text='';const pieces=m.variant==='twin'?2:1;for(let k=0;k<pieces;k++){let sx=x+k*rw/pieces; text+=`<rect x="${sx+1}" y="${y+1}" width="${rw/pieces-2}" height="${rh-2}" rx="3" fill="${m.kind==='sustainer'?'#e2e0d4':'#dfe5d7'}" stroke="#829274" stroke-width=".8"/><rect x="${sx+3}" y="${y+3}" width="${rw/pieces-6}" height="${Math.max(4,rh-6)}" rx="2" fill="none" stroke="#a8b49c" stroke-width=".6"/>${m.kind==='sustainer'?`<rect x="${sx+rw/pieces/2-7}" y="${y+1}" width="14" height="6" rx="1" fill="#7d8b70"/>`:`<circle cx="${sx+rw/pieces/2}" cy="${y+rh-6}" r="1.8" fill="#839174"/>`}`;}
return `<svg viewBox="0 0 ${bw} ${bh}" aria-hidden="true">${text}</svg>`;}
function renderLibrary(){
 const q=$('search').value.trim().toLowerCase();$('filters').hidden=kind==='parts';$('heightFilters').closest('.filter-line').hidden=kind==='roofs';$('roofLibraryHint').hidden=kind!=='roofs';
 if(kind==='roofs'){renderRoofLibrary(q);return;}
 if(kind==='parts'){
  const paths=cat.files.filter(f=>f.path.toLowerCase().endsWith('.stl')&&(f.path.includes('Universal')||f.path.startsWith('03. MODIFICATIONS'))&&(!q||(partName(f)+' '+f.name+' '+f.path).toLowerCase().includes(q)));
  $('resultCount').textContent=`${paths.length} 个原始配件`;
  $('modelList').innerHTML=paths.map(f=>`<article class="model-card part-card"><span class="part-icon">◇</span><div class="part-info"><h3>${esc(partName(f))}</h3><small>${size(f.bytes)} · ${esc(folderName(f.path))}</small><small class="part-estimate">${esc(unitEstimate(f.path))}</small></div><button class="add" data-part="${esc(f.path)}" aria-label="添加 ${esc(partName(f))}" title="${esc(f.name)}">＋</button></article>`).join('')||'<div class="empty">没有找到配件</div>';
  $$('#modelList [data-part]').forEach(b=>b.onclick=()=>{checkpoint();const p=state.extras.find(p=>p.path===b.dataset.part);if(p)p.qty++;else state.extras.push({path:b.dataset.part,qty:1});update();toast('已添加至打印单，可在清单调整数量');});return;
 }
 const models=cat.modules.filter(m=>m.kind===kind&&(family==='all'||m.family===family)&&(height==='all'||m.floor===+height)&&(depth==='all'||m.depth===+depth)&&(!q||(m.name+' '+m.subtitle).toLowerCase().includes(q)));
 $('resultCount').textContent=`${models.length} 个完整模块`;
 $('modelList').innerHTML=models.map(m=>`<article class="model-card" draggable="true" data-model="${m.id}"><div class="card-preview">${mini(m)}</div><h3>${esc(m.name)}</h3><small>${esc(m.subtitle)}</small><small>${fmt(m.width)} × ${m.nominalDepth} mm</small><button class="add" aria-label="添加 ${esc(m.name+' '+m.subtitle)}">＋</button></article>`).join('')||'<div class="empty">当前筛选没有模块<br>试试其他宽度或高度</div>';
 $$('#modelList [data-model]').forEach(c=>{c.onclick=()=>addModel(c.dataset.model);c.ondragstart=e=>{e.dataTransfer.setData('application/x-vault-module',c.dataset.model);e.dataTransfer.effectAllowed='copy';};});
}
function roofIcon(choice){
 const details=choice.value==='Grid'?'<path d="M22 11l30 13m-21-17l30 13M22 23L48 8m-17 20l26-15"/>':choice.value==='Bowl'?'<path d="M12 22v-8l28-9 28 11v9M12 14l28 11 28-9"/>':choice.value==='Under Table Mount'?'<path d="M12 18H5v11h13m50-11h7v11H62"/>':choice.value==='Split'?'<path d="M26 11l28 12" stroke-dasharray="3 2"/>':'';
 return `<svg viewBox="0 0 80 40" aria-hidden="true"><g fill="#e5eadf" stroke="#819174" stroke-width="1.1"><path d="M12 20l28-9 28 11-28 9z"/>${details}</g></svg>`;
}
function renderRoofLibrary(q){
 const choices=roofEntries.filter(r=>(family==='all'||r.family===family)&&(depth==='all'||r.depth===+depth)&&(!q||(r.family+r.depth+' '+r.title+' '+(r.kind==='drawer'?'抽屉顶盖':'翻盖箱盖子')).toLowerCase().includes(q)));
 $('resultCount').textContent=`${choices.length} 款顶盖`;
 $('modelList').innerHTML=choices.map(r=>{
  const target=roofTarget(r,state.items,lookup,{selectedId:selected}),installed=target&&selectedRoof(lookup[target.model],target.roof)===r.value;
  const estimate=estimateFor({parts:r.parts});
  return `<article class="model-card roof-card ${installed?'roof-installed':''}" draggable="true" data-roof-choice="${esc(r.id)}"><div class="card-preview">${roofIcon(r)}</div><h3>${r.family+r.depth} · ${r.title}</h3><small>${r.kind==='drawer'?'抽屉顶盖':'翻盖箱盖子'} · ${r.parts.reduce((n,p)=>n+p.qty,0)} 份打印</small><small>${fmt(r.width)} × ${r.nominalDepth} mm</small><small class="part-estimate">${estimateText(estimate)}</small><div class="roof-card-actions"><button data-install-roof aria-label="装配 ${r.family+r.depth+' '+r.title}">${installed?'已装配 · 更换':'装到顶层'}</button><button data-spare-roof aria-label="备用打印 ${r.family+r.depth+' '+r.title}">＋ 备用件</button></div></article>`;
 }).join('')||'<div class="empty">没有符合筛选的顶盖</div>';
 $$('#modelList [data-roof-choice]').forEach(card=>{
  const choice=choices.find(r=>r.id===card.dataset.roofChoice);
  card.onclick=()=>installRoof(choice);
  card.querySelector('[data-spare-roof]').onclick=e=>{e.stopPropagation();addSpareRoof(choice);};
  card.ondragstart=e=>{e.dataTransfer.setData('application/x-vault-roof',choice.id);e.dataTransfer.effectAllowed='copy';};
 });
}
function installRoof(choice,targetId){
 const target=roofTarget(choice,state.items,lookup,{selectedId:selected,targetId});
 if(!target)return toast(`没有可用的 ${choice.family+choice.depth} ${choice.kind==='drawer'?'顶层抽屉柜':'翻盖箱'}；可先添加柜体，或点击“备用件”仅打印`);
 const same=selectedRoof(lookup[target.model],target.roof)===choice.value;
 if(!same){checkpoint();target.roof=choice.value;}
 selected=target.id;update({refit:true});renderLibrary();
 toast(same?'该模块已使用此顶盖，可在编辑面板更换或移除':'已装配 '+choice.title+'，打印清单和用量已更新');
}
function addSpareRoof(choice){
 if(choice.parts.some(p=>(state.extras.find(e=>e.path===p.path)?.qty||0)+p.qty>999))return toast('备用件数量最多 999 份');
 checkpoint();for(const p of choice.parts){const existing=state.extras.find(e=>e.path===p.path);if(existing)existing.qty+=p.qty;else state.extras.push({path:p.path,qty:p.qty});}
 update();toast('备用 '+choice.title+' 已加入打印清单，可在清单调整数量');
}
function addModel(id,pos,probeY){
 if(state.items.length>=500)return toast('每个方案最多 500 个模块');
 const m=lookup[id],sel=selectedItem();let x=sel?sel.x:0,y=sel?sel.y+lookup[sel.model].height:Math.max(0,...state.items.map(i=>i.y+lookup[i.model].height));
 const item={id:crypto.randomUUID(),model:id,x:pos?.x??x,y:pos?.y??y,color:COLORS[0],roof:'Table',grid:false,rails:false};
 const placement=pos&&magnet?constrainedInsert(item,state.items,lookup,{probeY}):null;
 if(placement?.rejected)return toast(placement.reason||'此处无法完整支撑模块，请选择贴合的层位');
 checkpoint();if(placement)state.items=placement.items;else state.items.push(item);
 selected=item.id;if(update({refit:!pos||outsideView()}))toast('已添加 '+m.name);
}
function changeSelected(fn,refit=false){const i=selectedItem();if(!i)return;checkpoint();fn(i);update({refit});}
function removeSelected(){if(!selectedItem())return;checkpoint();state.items=state.items.filter(i=>i.id!==selected);selected=null;update();}
function duplicate(){const a=selectedItem();if(!a)return;checkpoint();const b={...a,id:crypto.randomUUID(),y:a.y+lookup[a.model].height};state.items.push(b);selected=b.id;update({refit:true});}
function renderInspector(){const a=selectedItem();$('inspector').hidden=!a;if(!a)return;const m=lookup[a.model];const exposed=isExposed(a,state.items,lookup);
 const alternatives=cat.modules.filter(n=>n.kind===m.kind&&n.family===m.family&&n.depth===m.depth&&n.variant===m.variant);
 $('inspector').innerHTML=`<div class="selection-head"><strong>${esc(m.name)}</strong><button id="closeInspector" aria-label="关闭模块编辑">×</button></div><small>${esc(m.subtitle)}<br>${fmt(m.width)} 宽 × ${m.nominalDepth} 深 × ${m.height} 高 mm（名义）</small><label>模块高度<select id="editModel">${alternatives.map(n=>`<option value="${n.id}" ${n.id===m.id?'selected':''}>${n.floor}F · ${n.height} mm</option>`).join('')}</select></label><div class="coordinate-fields"><label>X · mm<input type="number" id="editX" min="0" max="20000" step="0.1" value="${fmtInput(a.x)}"></label><label>Y · mm<input type="number" id="editY" min="0" max="20000" step="0.1" value="${fmtInput(a.y)}"></label></div>${`<label>${m.kind==='drawer'?'顶部顶盖':'翻盖款式'}${m.kind==='drawer'&&!exposed?' · 已被上层覆盖':''}<select id="editRoof" ${m.kind==='drawer'&&!exposed?'disabled':''}>${roofChoices(m).map(([v,t])=>`<option value="${v}" ${selectedRoof(m,a.roof)===v?'selected':''}>${t}</option>`).join('')}</select></label>`}<label class="option-check"><input type="checkbox" id="editGrid" ${a.grid?'checked':''}>添加 网格收纳底板</label>${m.kind==='drawer'?`<label class="option-check"><input type="checkbox" id="editRails" ${a.rails?'checked':''}>添加加强齿条套件</label>`:''}<small class="module-colour-hint">浅色预览 · 单个模块颜色</small><div class="swatches">${COLORS.map(c=>`<button style="background:${c}" class="${a.color===c?'active':''}" data-color="${c}" title="更改预览颜色"></button>`).join('')}</div><div class="selection-actions"><button id="duplicateModule">复制 ↑</button><button id="deleteModule">删除</button></div>`;
 $('closeInspector').onclick=()=>{selected=null;draw();renderInspector();};
 $('editModel').onchange=e=>changeSelected(i=>i.model=e.target.value);
 for(const [id,key] of [['editX','x'],['editY','y']])$(id).onchange=e=>{const n=Number(e.target.value);if(Number.isFinite(n)&&n>=0&&n<=20000)changeSelected(i=>i[key]=n);else renderInspector();};
 if($('editRoof'))$('editRoof').onchange=e=>changeSelected(i=>i.roof=e.target.value);
 $('editGrid').onchange=e=>changeSelected(i=>i.grid=e.target.checked);
 if($('editRails'))$('editRails').onchange=e=>changeSelected(i=>i.rails=e.target.checked);
 $$('#inspector [data-color]').forEach(b=>b.onclick=()=>{colourMode='pastel';pastelSeed=0;savePreviewColours();syncColourControls();changeSelected(i=>i.color=b.dataset.color);});
 $('duplicateModule').onclick=duplicate;$('deleteModule').onclick=removeSelected;
}
const fmtInput=n=>+n.toFixed(1);
function shape(item,exportMode=false){
 const m=lookup[item.model],x=item.x,h=view==='top'?m.nominalDepth:m.height,y=view==='top'?-m.nominalDepth:-item.y-h,w=m.width,p=previewPalette(item,appearance()),c=p.light,custom=colourMode==='custom',ink=custom?contrastColour(c):'#4b5b40',edge=custom?mixColour(c,ink,.5):'#77866c',inset=custom?mixColour(c,ink,.25):'#a8b39a',roofColour=custom?mixColour(c,ink,.15):'#64745a',active=item.id===selected&&!exportMode,pieces=m.variant==='twin'?2:1;
 let s=`<g class="module" data-id="${item.id}" data-preview-light="${c}" tabindex="0" role="button" aria-label="${esc(m.name+' '+m.subtitle)}" transform="translate(${x} ${y})"><title>${esc(m.name+' · '+m.subtitle)}</title><rect x="1.5" y="1.5" width="${w-3}" height="${h-3}" rx="5" fill="${c}" stroke="${edge}" stroke-width="1.5"/><rect x="5" y="5" width="${w-10}" height="${h-10}" rx="3.5" fill="none" stroke="${inset}" stroke-width="1"/>`;
 if(view==='top'){
  for(let k=1;k<m.depth;k++)s+=`<path d="M 8 ${h*k/m.depth} H ${w-8}" stroke="${inset}" stroke-width=".6" opacity=".5"/>`;
  s+=`<text x="${w/2}" y="${h/2}" text-anchor="middle" fill="${ink}" font-family="sans-serif" font-size="10">${esc(m.name)}</text><text x="${w/2}" y="${h/2+16}" text-anchor="middle" fill="${ink}" font-family="sans-serif" font-size="8">${m.nominalDepth} mm 深</text>`;
 }else{
  if(pieces===2)s+=`<path d="M ${m.family==='XL'?164.8:w/2} 5 V ${h-5}" stroke="${edge}" stroke-width="2"/>`;
  for(let k=0;k<pieces;k++){
   const px=pieces===1?0:(k===0?0:(m.family==='XL'?164.8:w/2)),pw=pieces===1?w:(m.family==='XL'?(k===0?164.8:254):w/2),cx=px+pw/2;
   s+=`<text x="${cx}" y="${h/2+(h<60?-2:2)}" text-anchor="middle" fill="${ink}" font-family="sans-serif" font-size="${h<60?9:11}" letter-spacing=".1">${esc(pieces===1?m.family+m.depth+' '+m.floor+'F':(k===0?'S':m.family==='XL'?'M':'S')+m.depth+' '+m.floor+'F')}</text>`;
   if(m.kind==='drawer'&&custom)s+=`<rect x="${px+7}" y="${h-5}" width="6" height="2" rx="1" fill="${p.orange}"/>`;
   if(m.kind==='drawer')s+=`<circle cx="${cx}" cy="${h-13}" r="3.2" fill="${custom?p.dark:'#819072'}"/><rect x="${cx-7}" y="${h-14.5}" width="14" height="3" rx="1.5" fill="${custom?p.label:'#a3ae96'}"/>`;
   else s+=`<rect x="${px+pw*.23-7}" y="1" width="14" height="14" rx="2" fill="${custom?p.dark:'#738168'}"/><rect x="${px+pw*.77-7}" y="1" width="14" height="14" rx="2" fill="${custom?p.dark:'#738168'}"/><path d="M ${px+pw*.23-3} 8 h 6 M ${px+pw*.77-3} 8 h 6" stroke="${custom?p.orange:'#c1cab6'}" stroke-width="2"/>`;
  }
  if(m.kind==='drawer'&&isExposed(item,state.items,lookup)&&item.roof!=='none'){
   const roof=selectedRoof(m,item.roof),title=roofChoices(m).find(([key])=>key===roof)?.[1];
   let mark=roof==='Bowl'?`<path d="M1 -11V-2H${w-1}V-11" fill="none" stroke="${roofColour}" stroke-width="3"/>`:`<rect x="0" y="-6" width="${w}" height="5" rx="1.5" fill="${roofColour}"/>`;
   if(roof==='Grid')for(let gx=12;gx<w;gx+=21)mark+=`<path d="M${gx} -7v7" stroke="${custom?p.dark:'#dfe6d7'}" stroke-width="2"/>`;
   if(roof==='Under Table Mount')mark+=`<path d="M0 -3h-12v-5H${w+12}v5h-12" fill="none" stroke="${roofColour}" stroke-width="2"/>`;
   s+=`<g class="roof-preview" data-roof="${roof}"><title>${esc(title)}</title>${mark}</g>`;
  }
 }
 if(!exportMode&&chosenPrinter()&&geometry){const r=compatibility(moduleBOM(item));if(r.blockedFiles||r.reorient)s+=`<g pointer-events="none"><rect x="${w-92}" y="7" width="83" height="16" rx="4" fill="${r.blockedFiles?'#fff0e8':'#fff7de'}"/><text x="${w-50}" y="18" text-anchor="middle" fill="#a1663c" font-size="8" font-family="sans-serif">${r.blockedFiles?r.blockedFiles+'种当前放不下':r.reorient+'种需换面'}</text></g>`;}
 if(active)s+=`<rect class="selection-outline" x="-4" y="-4" width="${w+8}" height="${h+8}" rx="7" fill="none" stroke="#d18a57" stroke-width="1.5" stroke-dasharray="4 3"/><rect x="${w-1}" y="${h-1}" width="6" height="6" rx="1" fill="#d18a57"/>`;
 return s+'</g>';
}
function dimension(x1,y1,x2,y2,label,vertical=false){return `<g fill="#89987a" stroke="#aab79b" stroke-width=".7"><path d="M ${x1} ${y1} L ${x2} ${y2}"/>${vertical?`<path d="M ${x1-5} ${y1} h 10 M ${x2-5} ${y2} h 10"/><text x="${x1-14}" y="${(y1+y2)/2}" transform="rotate(-90 ${x1-14} ${(y1+y2)/2})" text-anchor="middle" stroke="none" font-size="9" font-family="sans-serif">${esc(label)}</text>`:`<path d="M ${x1} ${y1-5} v 10 M ${x2} ${y2-5} v 10"/><text x="${(x1+x2)/2}" y="${y1+17}" text-anchor="middle" stroke="none" font-size="9" font-family="sans-serif">${esc(label)}</text>`}</g>`;}
function scene(exportMode=false){
 const b=bounds(state.items,lookup),floorX=Math.min(-80,b.x-65),floorW=Math.max(650,b.width+150),dH=view==='top'?b.depth:b.height;
 let s=`<path d="M ${floorX} 0 H ${floorX+floorW}" stroke="#aebd9d" stroke-width=".8" stroke-dasharray="3 4"/><text x="${floorX}" y="18" fill="#9faa91" font-size="8" font-family="sans-serif">${view==='top'?'正面 FRONT':'基准面 / Y = 0'}</text>`;
 s+=[...state.items].sort((a,b)=>a.y-b.y).map(i=>shape(i,exportMode)).join('');
 if(!exportMode&&drag?.insertion) {
  const p=drag.insertion;
  s+=`<g pointer-events="none" aria-hidden="true"><path d="M ${p.x-5} ${-p.y} H ${p.x+p.width+5}" stroke="#d18a57" stroke-width="3"/><circle cx="${p.x-5}" cy="${-p.y}" r="3.5" fill="#d18a57"/><text x="${p.x+6}" y="${-p.y-9}" fill="#b36e3d" font-size="9" font-family="sans-serif">${p.y<.6?'插入底层':'插入此层'} · 上方自动让位</text></g>`;
 }
 if(dims&&state.items.length){s+=dimension(b.x,33,b.x+b.width,33,fmt(b.width)+' mm');s+=dimension(b.x-30,0,b.x-30,-dH,fmt(dH)+' mm',true);}
 return s;
}
function draw(){if(!cat)return;$('canvasWrap').dataset.colourMode=colourMode;$('canvas').setAttribute('viewBox',box.join(' '));$('canvas').innerHTML=scene();$('emptyCanvas').hidden=state.items.length>0;}
function outsideView(){const b=bounds(state.items,lookup);return b.x-45<box[0]||b.x+b.width+30>box[0]+box[2]||-b.y-b.height-30<box[1]||65>box[1]+box[3];}
function fit(){
 if(canvasMode==='3d'){stack3d?.fitCamera();return;}
 const b=bounds(state.items,lookup),aspect=$('canvas').clientWidth/Math.max(1,$('canvas').clientHeight);
 const w=state.items.length?Math.max(b.width+170,500):650,h=state.items.length?Math.max((view==='top'?b.depth:b.height)+155,400):500;
 const vw=Math.max(w,h*aspect),vh=vw/aspect;
 box=[b.x+b.width/2-vw/2,-(view==='top'?b.depth:b.height)/2-vh/2+30,vw,vh];homeBox=[...box];draw();$('zoomValue').textContent='100%';
}
function zoom(mult){const w=box[2]*mult,h=box[3]*mult;if(w<150||w>30000)return;box=[box[0]+(box[2]-w)/2,box[1]+(box[3]-h)/2,w,h];draw();$('zoomValue').textContent=Math.round(homeBox[2]/w*100)+'%';}
function svgPoint(e){const p=$('canvas').createSVGPoint();p.x=e.clientX;p.y=e.clientY;return p.matrixTransform($('canvas').getScreenCTM().inverse());}
function renderStats(){
 const b=bounds(state.items,lookup),bom=makeBOM(state,cat),warnings=validate(state.items,lookup),e=estimateFor(bom);
 $('statModules').textContent=String(state.items.length).padStart(2,'0');$('statHeight').innerHTML=fmt(b.height)+'<small>mm</small>';$('statParts').textContent=bom.copies;$('validationSummary').textContent=warnings.length?`⚠ ${warnings.length} 处需要核对`:'✓ 布局检查通过';$('validationSummary').className=warnings.length?'warn':'valid';
 const prefix=e.complete?'':'≥ ';$('statMaterial').textContent=e.knownFiles||!bom.parts.length?prefix+massText(e.grams):'待切片';$('statTime').textContent=e.knownFiles||!bom.parts.length?prefix+timeText(e.seconds):'待切片';
 const progress=estimates?.summary;$('estimateCoverage').textContent=estimateSummary(e)+(progress&&!progress.complete?' · 全库 '+progress.processed+'/'+progress.total:'');
 const notes=[];if(e.missingFiles)notes.push('有 '+e.missingFiles+' 种模型缺少可用记录，上述数字仅为已知部分。');if(e.supportCopies)notes.push(e.supportCopies+' 份模型文件标注需开启支撑，当前未计额外支撑。');if(e.autoSupportCopies)notes.push(e.autoSupportCopies+' 份特殊分件已开启自动支撑，相关耗材与时间已计入。');if(e.estimateOnlyCopies)notes.push(e.estimateOnlyCopies+' 份整件在当前方向下超出 H2D 范围，已用相同速度的虚拟区域估算，需调整方向、拆分或换机。');if(e.materialMismatchCopies)notes.push(e.materialMismatchCopies+' 份 TPU 专用件目前按 PLA 基准估算。');
 $('estimateNotice').hidden=!notes.length;$('estimateNotice').textContent=notes.join(' ');renderPrinters(bom);
} 
function connectionUI(){const connected=local||linkedFiles.size>0;$('libDot').style.background=connected?'#809974':'#cfaa70';$('libStatus').textContent=local?'本机模型库已连接':connected?'已连接本地文件夹':'模型索引已就绪';$('libDetail').textContent=local?`${cat.stlCount} 个 STL · 无需上传`:connected?`${linkedFiles.size} 个可读取文件 · 仅本地读取`:'打包前选择原始模型文件夹';$('connectLibrary').innerHTML=connected?'重新选择模型文件夹 <span>↗</span>':'连接模型文件夹 <span>↗</span>';}
function renderBOM(){
 const b=makeBOM(state,cat),warnings=validate(state.items,lookup);$('bomSummary').textContent=`${state.items.length} 个模块 · ${b.parts.length} 种模型 · ${b.copies} 份 STL · 合并打包约 ${size(b.bytes)}`;$('warningCount').textContent=warnings.length?`(${warnings.length})`:'';$('bomEstimate').textContent=estimateText(estimateFor(b))+' · '+estimateSummary(estimateFor(b));
 if(bomTab==='hardware')$('bomBody').innerHTML=`<table class="bom-table"><thead><tr><th>紧固件 · 按原说明预估</th><th>数量</th></tr></thead><tbody>${b.hardware.map(h=>`<tr><td><strong>${esc(h.name)}</strong></td><td>${h.qty}</td></tr>`).join('')}</tbody></table><p class="notice">改装配件所需额外螺丝、杆件和轴承请对照原版说明另计。开启更多安装配件后，此表不会自动推算其五金。</p>`;
 else if(bomTab==='warnings')$('bomBody').innerHTML=warnings.length?`<div class="warning-list">${warnings.map(w=>`<div class="warning-row">△ ${esc(w.text)}</div>`).join('')}</div>`:'<div class="check-ok">✓ 未发现模块重叠、悬空或上下深度不一致。<p style="font-size:10px;color:#9aa98b">二维布局检查不验证机械连接、装配公差或承重。</p></div>';
 else $('bomBody').innerHTML=b.parts.length?`<table class="bom-table"><thead><tr><th>中文部件名称 / 原文件</th><th class="role">用途</th><th>打印份数</th><th>单份耗材 / 时间</th><th>本项合计</th><th>当前打印机尺寸检查</th></tr></thead><tbody>${b.parts.map(p=>`<tr><td><strong>${esc(partName(p))}</strong><details class="source-file"><summary>原文件名与路径</summary>${esc(p.path)}</details><small>${p.note?'<br>'+esc(p.note):''}</small></td><td class="role">${esc(p.role)}</td><td><input type="number" min="0" max="999" step="1" value="${p.qty}" class="${Object.hasOwn(state.overrides,p.path)?'custom-qty':''}" data-qty="${esc(p.path)}" aria-label="${esc(partName(p))} 打印份数"></td><td class="estimate-cell" title="${esc(estimates?.records?.[p.path]?.envelopeNote||estimates?.records?.[p.path]?.error||'H2D，0.20mm，15%填充，2层墙，无自动支撑')}">${esc(unitEstimate(p.path))}<small>${esc(estimateState(p.path))}${estimates?.records?.[p.path]?.generatedSupports?' · 已计支撑':estimates?.records?.[p.path]?.needsSupport?' · 需支撑':''}${estimates?.records?.[p.path]?.materialMismatch?' · TPU 件':''}</small></td><td class="estimate-cell">${esc(unitEstimate(p.path,p.qty))}<small>${size(p.bytes)}</small></td><td class="fit-cell ${fitPart(p.path,chosenPrinter(),geometry,printerSettings).status}">${esc(fitLabel(fitPart(p.path,chosenPrinter(),geometry,printerSettings).status))}<small>${esc(dimensionsText(fitPart(p.path,chosenPrinter(),geometry,printerSettings).size))}</small></td></tr>`).join('')}</tbody></table>`:'<div class="empty">还没有打印零件，先从模块库开始搭建。</div>';
 $$('#bomBody [data-qty]').forEach(input=>input.onchange=()=>{const n=Number(input.value);if(!Number.isInteger(n)||n<0||n>999){renderBOM();return;}checkpoint();state.overrides[input.dataset.qty]=n;update();renderBOM();});
}
function download(blob,name){const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),60000);}
function planName(){return (state.title||'VAULT').replace(/[\\/:*?"<>|]/g,'_');}
function exportSVG(){const b=bounds(state.items,lookup),w=Math.max(b.width+130,500),h=Math.max((view==='top'?b.depth:b.height)+150,350),y=-(view==='top'?b.depth:b.height)-55;return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${b.x-65} ${y} ${w} ${h}"><rect x="${b.x-65}" y="${y}" width="${w}" height="${h}" fill="#f9faf5"/><text x="${b.x}" y="${y+22}" font-family="sans-serif" font-size="11" fill="#566a48">${esc(state.title)} · VAULT</text>${scene(true)}<text x="${b.x}" y="75" font-family="sans-serif" font-size="7" fill="#8a987a">名义尺寸示意 · 不含装配间隙、凸起或顶盖厚度</text></svg>`;}
function exportCSV(){const b=makeBOM(state,cat);return csv([['中文部件名称','原文件名','STL 打印份数','用途','原始路径','单份耗材g','单份时间秒','合计耗材g','合计时间秒','切片状态','说明','STL实际外形mm','检查打印机','打印机范围mm','尺寸检查'],...b.parts.map(p=>{const r=estimates?.records?.[p.path],known=r?.status==='ok';return [partName(p),p.name,p.qty,p.role,p.path,known?r.grams:'',known?r.seconds:'',known?(r.grams*p.qty).toFixed(2):'',known?r.seconds*p.qty:'',estimateState(p.path),[p.note,r?.estimateOnly?r.envelopeNote:'',r?.generatedSupports?r.supportNote:r?.needsSupport?'文件标注需支撑，当前未计额外支撑':'',r?.materialMismatch?'TPU 专用件按 PLA 估算':''].filter(Boolean).join('；'),dimensionsText(geometry?.records?.[p.path]?.size),chosenPrinter()?chosenPrinter().brand+' '+chosenPrinter().name:'',dimensionsText(chosenPrinter()?.volume),fitLabel(fitPart(p.path,chosenPrinter(),geometry,printerSettings).status)];})]);}
function estimateSnapshot(bom){return {profile:estimates?.profile||null,updatedAt:estimates?.updatedAt||null,summary:estimateFor(bom),printerCompatibility:{checkedAt:printerData?.checkedAt,settings:{...printerSettings},result:compatibility(bom)},parts:bom.parts.map(p=>({path:p.path,qty:p.qty,estimate:estimates?.records?.[p.path]||null}))};}
function showExport(){if(!state.items.length&&!state.extras.length)return toast('请先添加模块或配件');if(!$('exportDialog').open)$('exportDialog').showModal();renderExport();}
function renderExport(){const b=makeBOM(state,cat),copies=$$('input[name=exportMode]').find(r=>r.checked).value==='copies',w=validate(state.items,lookup);$('exportSummary').textContent=`${b.parts.length} 种模型 · ${b.copies} 份 STL · ${estimateText(estimateFor(b))}`;$('exportSize').textContent='预计模型体积 '+size(local?(copies?b.copyBytes:b.bytes):sourceBytes(b,copies));$('exportDocs').textContent=local?'本机版同时附带目录内原版 PDF 装配说明。':'已连接的原版 PDF 装配说明也会随包附带。';$('exportConnection').hidden=local||linkedFiles.size>0;$('exportWarning').hidden=!w.length;$('exportWarning').textContent=`当前有 ${w.length} 处布局提示。可以先在“打印清单 → 布局检查”核对，也可按当前布局导出。`;$('connectExport').hidden=local;$('startExport').disabled=exporting||!b.parts.length;$('connectExport').disabled=exporting;$('startExport').textContent=exporting?'正在打包…':'生成 ZIP ↓';$$('input[name=exportMode]').forEach(r=>r.disabled=exporting);}
function progress(n,total,name){$('progressBar').style.width=Math.min(100,100*n/Math.max(1,total))+'%';$('progressText').textContent=`${size(n)} / ${size(total)} · ${name||''}`;}
async function performExport(){
 if(exporting)return;const b=makeBOM(state,cat),copies=$$('input[name=exportMode]').find(r=>r.checked).value==='copies';
 if(!local&&!linkedFiles.size){$('folderInput').click();return;}
 // Validate every file before opening the save dialog or writing any bytes.
 const entries=packEntries(b,copies);
 if(!local){const missing=b.parts.filter(p=>!linkedFiles.has(p.path));if(missing.length){$('exportConnection').hidden=false;$('exportConnection').textContent=`所选文件夹缺少 ${missing.length} 个模型，例如 ${missing[0].path}。请选择包含该相对路径的完整模型根目录；外层文件夹可任意命名，只需保留内部文件树。`;return;}}
 const snapshot=JSON.parse(JSON.stringify(state)),svg=exportSVG();let writable=null;
 try{
  if(!local&&window.showSaveFilePicker){const handle=await showSaveFilePicker({suggestedName:planName()+'.zip',types:[{description:'ZIP 压缩包',accept:{'application/zip':['.zip']}}]});writable=await handle.createWritable();}
  const total=local?(copies?b.copyBytes:b.bytes):sourceBytes(b,copies);
  if(!local&&!writable&&total>400e6)throw Error('当前浏览器不支持直接写入大文件。请使用 Chrome / Edge，或运行项目内“启动工作台.command”后打包。');
  exporting=true;renderExport();$('exportProgress').hidden=false;progress(0,total,'准备文件');
  if(local){
   const r=await fetch('/api/export',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({parts:b.parts.map(p=>({path:p.path,qty:p.qty,note:p.note})),copies,plan:snapshot,hardware:b.hardware,svg,estimate:estimateSnapshot(b),manifestCSV:exportCSV()})});const j=await r.json();if(!r.ok)throw Error(j.error||'打包失败');
   let result;
   while(true){await new Promise(r=>setTimeout(r,500));const res=await fetch('/api/job/'+j.id);result=await res.json();if(result.status==='error')throw Error(result.error);progress(result.done,result.total,result.current);if(result.status==='done')break;}
   const a=document.createElement('a');a.href=result.download;a.download=planName()+'.zip';a.click();progress(result.total,result.total,'打包完成，已开始下载');
  }else{
   const extras=[{name:'打印机适配.json',data:JSON.stringify(estimateSnapshot(b).printerCompatibility,null,2)},{name:'layout.vault.json',data:JSON.stringify(snapshot,null,2)},{name:'耗材时间估算.json',data:JSON.stringify(estimateSnapshot(b),null,2)},{name:'打印清单.csv',data:exportCSV()},{name:'紧固件.csv',data:csv([['名称','数量'],...b.hardware.map(h=>[h.name,h.qty])])},{name:'组合预览.svg',data:svg},{name:'README.txt',data:'VAULT 模型清单\nprint-N 表示该 STL 文件所需打印份数。套件文件可能包含多个零件。\n二维图仅用于布局与数量核对；实际装配请对照原版说明。\n配方打印数量可在工作台手动调整。'}];
   const sources=entries.map(e=>{const f=linkedFiles.get(e.path);return {name:e.name,size:f.size,stream:()=>f.stream()};});
   for(const f of cat.files.filter(f=>f.path.endsWith('.pdf'))){const source=linkedFiles.get(f.path);if(source)sources.push({name:'装配说明/'+f.name,size:source.size,stream:()=>source.stream()});}
   for(const e of extras){const blob=new Blob([e.data]);sources.push({name:e.name,size:blob.size,stream:()=>blob.stream()});}
   const chunks=[],sink=writable||{write:b=>chunks.push(b),close:async()=>{}};await writeZip(sources,sink,progress);if(!writable)download(new Blob(chunks,{type:'application/zip'}),planName()+'.zip');$('progressText').textContent='打包完成 · 文件已保存';
  }
  toast('模型已按打印数量整理打包');
 }catch(e){if(writable)await writable.abort().catch(()=>{});if(e.name!=='AbortError'){toast(e.message);$('progressText').textContent=e.message;}}
 finally{exporting=false;renderExport();}
}
function positionRandomMenu(){
 const menu=$('randomLayoutMenu');if(menu.hidden)return;
 const anchor=$('randomLayoutBtn').getBoundingClientRect(),width=menu.offsetWidth,height=menu.offsetHeight;
 const left=Math.max(12,Math.min(anchor.left,window.innerWidth-width-12));
 const top=anchor.top-height-10>=12?anchor.top-height-10:Math.max(12,Math.min(anchor.bottom+10,window.innerHeight-height-12));
 menu.style.left=left+'px';menu.style.top=top+'px';
}
function toggleRandomMenu(open){
 $('randomLayoutMenu').hidden=!open;$('randomLayoutBtn').setAttribute('aria-expanded',String(open));
 if(open){$('randomLayoutError').hidden=true;positionRandomMenu();$('randomFamily').focus({preventScroll:true});}
}
function bindRandomLayout(){
 $('randomLayoutBtn').onclick=()=>toggleRandomMenu($('randomLayoutMenu').hidden);
 $('closeRandomMenu').onclick=()=>{toggleRandomMenu(false);$('randomLayoutBtn').focus();};
 $('randomTotalF').oninput=()=>{const f=Number($('randomTotalF').value);$('randomHeightNote').textContent=Number.isInteger(f)&&f>=1&&f<=40?f+'F · '+f*48+' mm 高':'请输入 1–40F，1F = 48 mm';};
 $('randomLayoutForm').onsubmit=e=>{
  e.preventDefault();
  try{
   const items=randomLayout(cat,{family:$('randomFamily').value,depth:Number($('randomDepth').value),totalF:Number($('randomTotalF').value),kind:$('randomKind').value});
   checkpoint();state={...state,items,extras:[],overrides:{}};selected=null;view='front';
   $$('.view-tabs button').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
   toggleRandomMenu(false);update({refit:true});if(kind==='roofs')renderLibrary();
   toast('已随机搭配 '+items.length+' 个模块 · '+$('randomTotalF').value+'F，可撤销恢复');
  }catch(error){$('randomLayoutError').textContent=error.message;$('randomLayoutError').hidden=false;positionRandomMenu();}
 };
 document.addEventListener('pointerdown',e=>{if(!$('randomLayoutMenu').hidden&&!$('randomLayoutMenu').contains(e.target)&&!$('randomLayoutBtn').contains(e.target))toggleRandomMenu(false);});
 window.addEventListener('resize',positionRandomMenu);
 window.addEventListener('scroll',()=>{if(!$('randomLayoutMenu').hidden)positionRandomMenu();},true);
}
function savePreviewColours(){try{localStorage.setItem(PREVIEW_KEY,JSON.stringify({mode:colourMode,seed:pastelSeed}));}catch{}}
function syncColourControls(){
 $$('[data-colour-mode]').forEach(button=>{const active=button.dataset.colourMode===colourMode;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});
 $$('#workbenchPaletteInputs [data-slot]').forEach(input=>{if(input.value.toUpperCase()!==customColours[input.dataset.slot])input.value=customColours[input.dataset.slot];input.nextElementSibling.textContent=customColours[input.dataset.slot];});
 $('workbenchPaletteHint').textContent=colourMode==='custom'?'正在使用自定义颜色 · 与尺寸总览同步':'正在使用浅色预览 · 修改下方颜色即可切换自定义';
}
function refreshPreviewColours(){syncColourControls();draw();if(canvasMode==='3d')refreshStack3D();}
function bindPaletteControls(){
 $('workbenchPaletteInputs').innerHTML=COLOUR_SLOTS.map(slot=>`<label><span>${slot.name}</span><input type="color" data-slot="${slot.id}" value="${customColours[slot.id]}" aria-label="${slot.name}颜色"><code>${customColours[slot.id]}</code></label>`).join('');
 $$('#workbenchPaletteInputs [data-slot]').forEach(input=>input.oninput=()=>{customColours=writePalette({...customColours,[input.dataset.slot]:input.value});colourMode='custom';savePreviewColours();refreshPreviewColours();});
 $$('[data-colour-mode]').forEach(button=>button.onclick=()=>{colourMode=button.dataset.colourMode;savePreviewColours();refreshPreviewColours();});
 $('randomPastelColours').onclick=()=>{pastelSeed=(pastelSeed+1+Math.floor(Math.random()*0xffffff))>>>0||1;colourMode='pastel';savePreviewColours();refreshPreviewColours();};
 $('resetWorkbenchColours').onclick=()=>{customColours=writePalette(DEFAULT_COLOURS);colourMode='custom';savePreviewColours();refreshPreviewColours();};
 watchPalette(next=>{customColours=next;refreshPreviewColours();});syncColourControls();
}
function bind(){
 bindPaletteControls();
 $('stackPreviewBtn').disabled=!previewAvailable;$('stackPreviewBtn').title=previewAvailable?'按当前布局查看真实三维装配':'通过本机服务打开后可使用真实三维预览';$('stackPreviewBtn').onclick=()=>setCanvasMode(canvasMode==='2d'?'3d':'2d');
 bindRandomLayout();
 $('allDrawersGrid').onchange=e=>applyBulkAccessory('grid',e.target.checked);
 $('allDrawersRails').onchange=e=>applyBulkAccessory('rails',e.target.checked);
 $('printerSelect').onchange=e=>{printerSettings.id=e.target.value;syncCustomPrinterInputs();savePrinterSettings();};
 $('customPrinterForm').onsubmit=e=>{e.preventDefault();try{const p=customPrinter({name:$('customPrinterName').value,volume:['X','Y','Z'].map(axis=>Number($('customPrinter'+axis).value))});printerSettings.custom=p;printerSettings.id='custom';syncCustomPrinterInputs();savePrinterSettings();toast('已应用 '+p.name+' · '+dimensionsText(p.volume));}catch(error){$('customPrinterError').hidden=false;$('customPrinterError').textContent=error.message;}};$('printerMargin').onchange=e=>{printerSettings.margin=+e.target.value;savePrinterSettings();};$('printerReorient').onchange=e=>{printerSettings.reorient=e.target.checked;savePrinterSettings();};
 $$('#kindTabs button').forEach(b=>b.onclick=()=>{kind=b.dataset.kind;$$('#kindTabs button').forEach(x=>x.classList.toggle('active',x===b));renderLibrary();});
 for(const [id,key] of [['familyFilters','family'],['heightFilters','height']])$$('#'+id+' button').forEach(b=>b.onclick=()=>{if(key==='family')family=b.dataset.value;else height=b.dataset.value;$$('#'+id+' button').forEach(x=>x.classList.toggle('active',x===b));renderLibrary();});
 $('search').oninput=renderLibrary;$('depthFilter').onchange=e=>{depth=e.target.value;renderLibrary();};
 $('undo').onclick=undo;$('redo').onclick=redo;$('clear').onclick=()=>{if(!state.items.length&&!state.extras.length&&!Object.keys(state.overrides).length)return;checkpoint();state.items=[];state.extras=[];state.overrides={};selected=null;update({refit:true});toast('已清除所有模块和备用件，可撤销恢复');};
 $('loadExample').onclick=()=>{checkpoint();state=sample();selected=null;$('projectTitle').value=state.title;update({refit:true});toast('已载入示例，可撤销回到原方案');};
 $('projectTitle').onchange=e=>{checkpoint();state.title=e.target.value.trim()||'我的收纳工作台';update();};
 $('snapToggle').onchange=e=>{magnet=e.target.checked;if(magnet){const next=constrainLayout(state.items,lookup);if(JSON.stringify(next)!==JSON.stringify(state.items)){checkpoint();state.items=next;if(update({refit:true}))toast('已按强吸附整理层位，消除空隙与重叠，可撤销');}}};$('dimToggle').onchange=e=>{dims=e.target.checked;draw();};
 $$('.view-tabs button').forEach(b=>b.onclick=()=>{view=b.dataset.view;$$('.view-tabs button').forEach(x=>x.classList.toggle('active',x===b));selected=null;renderInspector();fit();if(view==='top')toast('俯视图预览占地，切回正面可拖动堆叠');});
 $('zoomIn').onclick=()=>zoom(.82);$('zoomOut').onclick=()=>zoom(1.22);$('fit').onclick=fit;
 $('canvas').addEventListener('wheel',e=>{if(e.ctrlKey||e.metaKey){e.preventDefault();zoom(e.deltaY>0?1.08:.92);}},{passive:false});
 $('canvas').onpointerdown=e=>{
  if(e.button!==0&&e.button!==1)return;const target=e.target.closest('.module');
  const p=svgPoint(e);
  if(!target||e.button===1){selected=null;renderInspector();draw();drag={pan:true,startX:e.clientX,startY:e.clientY,box:[...box]};$('canvas').setPointerCapture(e.pointerId);return;}
  selected=target.dataset.id;renderInspector();draw();if(view!=='front')return;
  const a=selectedItem();drag={id:a.id,start:p,startClient:[e.clientX,e.clientY],initial:{...a},items:state.items.map(i=>({...i})),before:JSON.stringify(state),moved:false,insertion:null};$('canvas').setPointerCapture(e.pointerId);
 };
 $('canvas').onpointermove=e=>{
  if(!drag)return;
  if(drag.pan){const scale=box[2]/$('canvas').clientWidth;box=[drag.box[0]-(e.clientX-drag.startX)*scale,drag.box[1]-(e.clientY-drag.startY)*scale,drag.box[2],drag.box[3]];draw();return;}
  if(Math.hypot(e.clientX-drag.startClient[0],e.clientY-drag.startClient[1])>3)drag.moved=true;
  if(!drag.moved)return;
  const p=svgPoint(e),candidate={...drag.initial,x:Math.max(0,drag.initial.x+p.x-drag.start.x),y:Math.max(0,drag.initial.y-p.y+drag.start.y)};
  if(magnet) {
   const result=constrainedInsert(candidate,drag.items,lookup,{probeY:-p.y,threshold:Math.min(15,10*box[2]/homeBox[2])});
   state.items=result.items;drag.insertion=result.insertion;drag.rejected=result.rejected;drag.reason=result.reason;
  } else {state.items=drag.items.map(i=>i.id===candidate.id?candidate:{...i});drag.insertion=null;}
  $('inspector').hidden=true;draw();
 };
 function endDrag(cancel=false){if(!drag)return;const d=drag;drag=null;if(!d.pan&&d.moved){if(cancel)state=JSON.parse(d.before);else if(JSON.stringify(state)!==d.before){checkpointBackup={before:d.before,future:[...future]};history.push(d.before);if(history.length>60)history.shift();future=[];}update({refit:!cancel&&outsideView()});}else {draw();renderInspector();}if(d.rejected&&!cancel)toast(d.reason||'此位置无法完整支撑模块，已保持原层位');}
 $('canvas').onpointerup=()=>endDrag();$('canvas').onpointercancel=()=>endDrag(true);
 $('canvas').onkeydown=e=>{if(e.key==='Enter'&&e.target.closest('.module')){selected=e.target.closest('.module').dataset.id;draw();renderInspector();}};
 $('canvasWrap').ondragover=e=>{e.preventDefault();e.dataTransfer.dropEffect='copy';};
 $('canvasWrap').ondrop=e=>{e.preventDefault();const roofId=e.dataTransfer.getData('application/x-vault-roof');if(roofId){const choice=roofEntries.find(r=>r.id===roofId),point=svgPoint(e),direct=e.target.closest('.module')?.dataset.id;const target=direct||state.items.filter(i=>{const m=lookup[i.model];return choice&&m.kind===choice.kind&&m.family===choice.family&&m.depth===choice.depth&&point.x>=i.x&&point.x<=i.x+m.width&&Math.abs(-point.y-i.y-m.height)<30;}).sort((a,b)=>b.y-a.y)[0]?.id;if(choice&&target)installRoof(choice,target);else toast('请将顶盖拖到同宽、同深度的可用柜体上');return;}const id=e.dataTransfer.getData('application/x-vault-module');if(!lookup[id])return;if(view!=='front'){view='front';$$('.view-tabs button').forEach(b=>b.classList.toggle('active',b.dataset.view===view));fit();}const p=svgPoint(e),m=lookup[id];addModel(id,{x:Math.max(0,p.x-m.width/2),y:Math.max(0,-p.y-m.height/2)},-p.y);};
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('randomLayoutMenu').hidden){e.preventDefault();toggleRandomMenu(false);$('randomLayoutBtn').focus();return;}const editable=/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName);if(editable)return;const dialog=$$('dialog').some(d=>d.open);if(dialog)return;
  if(drag){if(e.key==='Escape'){e.preventDefault();endDrag(true);}return;}
  if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo();}
  if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='y'){e.preventDefault();redo();}
  if((e.key==='Delete'||e.key==='Backspace')&&selected){e.preventDefault();removeSelected();}
  if(e.key==='Escape'){selected=null;draw();renderInspector();}
  if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)&&selected){e.preventDefault();const step=e.shiftKey?10:1;changeSelected(i=>{if(e.key==='ArrowLeft')i.x=Math.max(0,i.x-step);if(e.key==='ArrowRight')i.x+=step;if(e.key==='ArrowUp')i.y+=step;if(e.key==='ArrowDown')i.y=Math.max(0,i.y-step);});}
 });
 $('bomBtn').onclick=()=>{renderBOM();$('bomDialog').showModal();};$('estimateDetails').onclick=()=>{bomTab='parts';$$('[data-bomtab]').forEach(b=>b.classList.toggle('active',b.dataset.bomtab===bomTab));renderBOM();$('bomDialog').showModal();};$('validationSummary').onclick=()=>{bomTab='warnings';$$('[data-bomtab]').forEach(b=>b.classList.toggle('active',b.dataset.bomtab===bomTab));renderBOM();$('bomDialog').showModal();};
 $$('[data-bomtab]').forEach(b=>b.onclick=()=>{bomTab=b.dataset.bomtab;$$('[data-bomtab]').forEach(x=>x.classList.toggle('active',x===b));renderBOM();});
 $('resetQty').onclick=()=>{checkpoint();state.overrides={};update();renderBOM();};
 $('exportBtn').onclick=showExport;$('packFromBom').onclick=()=>{$('bomDialog').close();showExport();};$('startExport').onclick=performExport;
 $$('input[name=exportMode]').forEach(r=>r.onchange=renderExport);
 $('csvExport').onclick=()=>download(new Blob([exportCSV()],{type:'text/csv;charset=utf-8'}),planName()+'-打印清单.csv');
 $('svgExport').onclick=()=>download(new Blob([exportSVG()],{type:'image/svg+xml'}),planName()+'.svg');
 $('savePlan').onclick=()=>download(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),planName()+'.vault.json');
 $('importPlan').onclick=()=>$('planInput').click();$('planInput').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>5e6)throw Error('方案文件过大');const next=validatePlan(JSON.parse(await file.text()),cat);checkpoint();state=next;selected=null;$('projectTitle').value=state.title;if(update({refit:true}))toast('方案已导入');}catch(err){toast('导入失败：'+err.message);}e.target.value='';};
 $('chooseModelDirectory').disabled=false;
 for(const id of ['connectLibrary','connectExport','chooseModelDirectory'])$(id).onclick=()=>$('folderInput').click();
 $('folderInput').onchange=e=>{try{if(!e.target.files.length)return;const result=matchModelDirectory(e.target.files,cat);linkedFiles=result.files;local=false;connectionUI();$('chooseModelDirectory').textContent='重新选择模型目录';$('modelDirectoryStatus').querySelector('span').textContent=`已匹配 ${result.stls}/${result.totalSTLs} STL`;if($('exportDialog').open)renderExport();toast(`已连接 ${result.root} · ${result.stls}/${result.totalSTLs} STL${result.missing.length?'，部分模型在内部文件树中未找到':''}${result.wrongSize.length?'，'+result.wrongSize.length+' 个文件大小与参考版本不同（仍可使用）':''} · 仅本地读取`);}catch(error){toast(error.message);}finally{e.target.value='';}};
 $('helpBtn').onclick=()=>$('helpDialog').showModal();$$('.close-dialog').forEach(b=>b.onclick=()=>b.closest('dialog').close());$$('dialog').forEach(d=>{d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}});d.addEventListener('cancel',e=>{if(d.id==='exportDialog'&&exporting)e.preventDefault();});});
 new ResizeObserver(()=>{if(!drag)fit();}).observe($('canvasWrap'));
}
async function init(){try{const r=await fetch('catalog.json?revision=aligned-holes-2',{cache:'no-store'});if(!r.ok)throw Error('目录文件读取失败');cat=await r.json();lookup=Object.fromEntries(cat.modules.map(m=>[m.id,m]));roofEntries=roofLibrary(cat);fileMeta=Object.fromEntries(cat.files.map(f=>[f.path,f]));$('moduleCount').textContent=cat.modules.length;
 try{const saved=localStorage.getItem(KEY);state=saved?validatePlan(JSON.parse(saved),cat):sample();}catch{state=sample();toast('上次方案无法读取，已载入示例');}
 $('projectTitle').value=state.title;
 try{const responses=await Promise.all([fetch('printers.json?revision=other-printers-1',{cache:'no-store'}),fetch('geometry.json')]);if(responses.some(r=>!r.ok))throw Error('打印机数据不可用');[printerData,geometry]=await Promise.all(responses.map(r=>r.json()));if(printerSettings.id!=='custom'&&!printerData.printers.some(p=>p.id===printerSettings.id))printerSettings.id='h2d';printerSettings.margin=[0,3,5].includes(printerSettings.margin)?printerSettings.margin:0;printerSettings.reorient=printerSettings.reorient===true;$('printerSelect').innerHTML=printerGroups().map(brand=>`<optgroup label="${esc(brand)}">${printerData.printers.filter(p=>printerGroup(p)===brand).map(p=>`<option value="${p.id}">${esc(printerLabel(p))}</option>`).join('')}</optgroup>`).join('')+'<optgroup label="自定义"><option value="custom">自定义打印机</option></optgroup>';$('printerSelect').value=printerSettings.id;syncCustomPrinterInputs();$('printerMargin').value=printerSettings.margin;$('printerReorient').checked=printerSettings.reorient;}catch(e){toast(e.message);}
 try{const res=await fetch('/api/status');if(res.ok){const status=await res.json();local=status.local&&status.ready;previewAvailable=local;}}catch{}
 await refreshEstimates();bind();renderLibrary();connectionUI();const aligned=constrainLayout(state.items,lookup);if(JSON.stringify(aligned)!==JSON.stringify(state.items)){checkpoint();state.items=aligned;toast('已按强吸附整理当前层位，可撤销');}update({refit:true});window.VaultWorkbench={getState:()=>structuredClone(state),getCatalog:()=>cat,getBOM:()=>makeBOM(state,cat),getWarnings:()=>validate(state.items,lookup),getEstimate:()=>estimateFor(makeBOM(state,cat)),getPrinterReport:()=>compatibility(makeBOM(state,cat)),getPrinters:()=>printerData,getGeometry:()=>geometry};
 const requestedKit=new URLSearchParams(location.search).get('kit');if(requestedKit&&lookup[requestedKit]){addModel(requestedKit);window.history.replaceState(null,'','workbench.html');}
 }catch(e){$('modelList').innerHTML='<div class="empty">'+esc(e.message)+'<br>请通过本地服务或在线地址打开工作台。</div>';toast(e.message);}}
init();
