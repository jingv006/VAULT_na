export const PALETTE_KEY='vault-kit-colours';
export const PREVIEW_KEY='vault-workbench-colour-preview-v1';
export const COLOUR_SLOTS=[{id:'light',name:'主体'},{id:'dark',name:'内件'},{id:'orange',name:'功能件'},{id:'label',name:'标签'}];
export const DEFAULT_COLOURS={light:'#D1D3D5',dark:'#454749',orange:'#F58238',label:'#F4F2EB'};
export const PASTEL_COLOURS=['#dce2d5','#e8e6db','#c6d2c2','#d5dbdc','#e0cdbd'];
const valid=value=>typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value);
export function normalisePalette(value){
 return Object.fromEntries(COLOUR_SLOTS.map(({id})=>[id,valid(value?.[id])?value[id].toUpperCase():DEFAULT_COLOURS[id]]));
}
export function readPalette(storage){
 try{return normalisePalette(JSON.parse((storage??globalThis.localStorage).getItem(PALETTE_KEY)||'{}'));}catch{return {...DEFAULT_COLOURS};}
}
export function writePalette(value,storage){
 const colours=normalisePalette(value);try{(storage??globalThis.localStorage).setItem(PALETTE_KEY,JSON.stringify(colours));}catch{}return colours;
}
export function watchPalette(callback,{storage,windowTarget=globalThis.window,documentTarget=globalThis.document}={}){
 let previous=JSON.stringify(readPalette(storage));
 const check=(force=false)=>{const colours=readPalette(storage),next=JSON.stringify(colours);if(force===true||next!==previous){previous=next;callback(colours);}};
 const onStorage=event=>{if(event.key===PALETTE_KEY||event.key===null)check(true);};
 const onVisible=()=>{if(!documentTarget||documentTarget.visibilityState==='visible')check();};
 windowTarget?.addEventListener('storage',onStorage);windowTarget?.addEventListener('pageshow',check);documentTarget?.addEventListener('visibilitychange',onVisible);
 return()=>{windowTarget?.removeEventListener('storage',onStorage);windowTarget?.removeEventListener('pageshow',check);documentTarget?.removeEventListener('visibilitychange',onVisible);};
}
export function previewPalette(item,{mode='pastel',colours,seed=0}={}){
 if(mode==='custom')return normalisePalette(colours);
 let hash=seed>>>0;for(const char of String(item.id||item.model||''))hash=(Math.imul(hash,31)+char.codePointAt(0))>>>0;
 const light=!seed&&valid(item.color)?item.color.toUpperCase():PASTEL_COLOURS[hash%PASTEL_COLOURS.length].toUpperCase();
 return {...DEFAULT_COLOURS,light};
}
export function contrastColour(hex){
 const [r,g,b]=hex.slice(1).match(/../g).map(n=>parseInt(n,16));
 return r*.299+g*.587+b*.114>150?'#35452E':'#F5F7F0';
}
export function mixColour(a,b,amount){
 const aa=a.slice(1).match(/../g),bb=b.slice(1).match(/../g);
 return '#'+aa.map((n,i)=>Math.round(parseInt(n,16)*(1-amount)+parseInt(bb[i],16)*amount).toString(16).padStart(2,'0')).join('');
}
