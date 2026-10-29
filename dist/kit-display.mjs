import {kitPreview} from './kit-preview.mjs?revision=flip-roof-load-2';
import {roofChoices,selectedRoof} from './roof-options.mjs?revision=flip-roof-load-2';

// The diagram has no dependency on Three.js, STL files or the model API.
export class KitDisplay {
 constructor({diagram,assembly,controls,hint,local,onRoofChange}) {
  Object.assign(this,{diagram,assembly,controls,hint,local,onRoofChange});
  this.mode='2d';
  try {if(localStorage.getItem('vault-kit-view')==='3d'&&local)this.mode='3d';}catch{}
  for(const button of controls.querySelectorAll('[data-view]')) {
   if(button.dataset.view==='3d') {
    button.disabled=!local;
    button.title=local?'旋转、爆炸和开合真实模型':'连接本机模型服务后可使用三维展示';
   }
   button.onclick=()=>{
    this.mode=button.dataset.view;
    try {localStorage.setItem('vault-kit-view',this.mode);}catch{}
    this.render();
   };
  }
 }
 update(model,options,colours) {
  this.model=model;this.options={...options};this.colours={...colours};this.render();
 }
 render() {
  if(!this.model)return;
  for(const button of this.controls.querySelectorAll('[data-view]')) {
   const active=button.dataset.view===this.mode;
   button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));
  }
  const diagram=this.mode==='2d';
  this.diagram.hidden=!diagram;this.assembly.hidden=diagram;
  this.hint.textContent=diagram?'尺寸与配色示意 · 无需本地三维模型': '真实模型 · 可旋转、爆炸与开合';
  if(diagram) {
   this.diagram.querySelector('.diagram-stage').innerHTML=kitPreview(this.model,{...this.options,colours:this.colours});
   const panel=this.diagram.querySelector('.viewer-roofs'),list=panel.querySelector('.viewer-roof-options');
   panel.hidden=false;list.replaceChildren();
   for(const [value,title] of roofChoices(this.model)) {
    const button=document.createElement('button'),active=selectedRoof(this.model,this.options.roof)===value;
    button.type='button';button.textContent=title;button.dataset.roof=value;
    button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));
    button.onclick=()=>this.onRoofChange(value);list.append(button);
   }
  }else this.showAssembly();
 }
 async showAssembly() {
  try {
   if(!this.viewer) {
    this.loading??=import('./assembly-viewer.mjs?revision=xl-drawers-1').catch(error=>{this.loading=null;throw error;});
    const {AssemblyViewer}=await this.loading;
    // A switch or colour/model change may happen while the module is loading.
    if(this.mode!=='3d')return;
    this.viewer??=new AssemblyViewer(this.assembly,{onRoofChange:this.onRoofChange});
    if(this.viewer.failed)throw Error('三维显示不可用');
   }
   if(this.mode==='3d') {
    this.viewer.size();this.viewer.dirty=true;
    this.viewer.update(this.model,this.options,this.colours);
   }
  }catch {
   this.mode='2d';this.render();
   this.hint.textContent='三维显示暂不可用，已切换为二维示意';
  }
 }
}
