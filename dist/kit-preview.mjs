// Nominal-size illustration shared by the overview and its size cards.
// F denotes module height; a twin module has two side-by-side drawers.
import {selectedRoof} from './roof-options.mjs?revision=flip-roof-load-2';
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tone=(hex,factor)=>'#'+hex.slice(1).match(/../g).map(v=>Math.min(255,Math.round(parseInt(v,16)*factor)).toString(16).padStart(2,'0')).join('');

export function kitPreview(m,{colours={},roof='Table',grid=false,rails=false,compact=false}={}) {
 const light=colours.light||'#D1D3D5',dark=colours.dark||'#454749',orange=colours.orange||'#F58238',label=colours.label||'#F4F2EB';
 const W=m.width,H=m.height,D=m.nominalDepth,isBox=m.kind==='sustainer',twin=m.variant==='twin';
 if(isBox)roof=selectedRoof(m,roof);
 const lidAngle=Math.PI*.36,lidRise=isBox?D*Math.sin(lidAngle):0;
 const ext=roof==='Under Table Mount'&&!isBox?11:0;
 const projectedWidth=W+D*.38+ext*2,projectedHeight=H+D*.25+lidRise+12;
 const canvasW=compact?100:440,canvasH=compact?65:280,captionSpace=compact?0:23;
 const scale=Math.min((canvasW-(compact?8:32))/projectedWidth,(canvasH-captionSpace-(compact?8:22))/projectedHeight);
 const left=(canvasW-projectedWidth*scale)/2+ext*scale,bottom=(canvasH-captionSpace+projectedHeight*scale)/2-5*scale;
 const p=(x,y,z)=>[left+(x+y*.38)*scale,bottom-(z+y*.25)*scale];
 const point=a=>p(...a).map(n=>+n.toFixed(2)).join(',');
 const poly=(points,fill,extra='')=>`<polygon points="${points.map(point).join(' ')}" fill="${fill}" ${extra}/>`;
 const line=(points,stroke= tone(light,.73),extra='')=>`<polyline points="${points.map(point).join(' ')}" fill="none" stroke="${stroke}" ${extra}/>`;
 const face=(x,z,w,h,fill,r=2,extra='')=>{const [sx,sy]=p(x,0,z+h);return `<rect x="${sx}" y="${sy}" width="${w*scale}" height="${h*scale}" rx="${r*scale}" fill="${fill}" ${extra}/>`;};
 const dot=(x,z,r,fill)=>{const [cx,cy]=p(x,0,z);return `<circle cx="${cx}" cy="${cy}" r="${r*scale}" fill="${fill}" stroke="none"/>`;};
 const gridLines=(z,inset=6)=>{
  let s='';for(let x=42;x<W-inset;x+=42)s+=line([[x,inset,z],[x,D-inset,z]],tone(light,.77));
  for(let y=42;y<D-inset;y+=42)s+=line([[inset,y,z],[W-inset,y,z]],tone(light,.77));return s;
 };
 const code=m.family+m.depth+'F'+m.floor;
 let s=poly([[-3,-3,-3],[W+4,-3,-3],[W+4,D+3,-3],[-3,D+3,-3]],'#e9ece4','stroke="none"');
 if(isBox) {
  // Open the lid so flat, divider-interface and sealed variants remain visible.
  const ly=y=>D-(D-y)*Math.cos(lidAngle),lz=y=>H+(D-y)*Math.sin(lidAngle);
  s+=poly([[0,ly(0),lz(0)],[W,ly(0),lz(0)],[W,D,H],[0,D,H]],tone(light,1.05));
  s+=poly([[5,ly(5),lz(5)-1],[W-5,ly(5),lz(5)-1],[W-5,ly(D-5),lz(D-5)-1],[5,ly(D-5),lz(D-5)-1]],light);
  if(roof==='Split'){const seam=D*(D+30.1-162.05)/(D+30.1);s+=line([[2,ly(seam),lz(seam)],[W-2,ly(seam),lz(seam)]],tone(light,.65),'stroke-dasharray="3 2"');}
  s+=poly([[0,D,0],[W,D,0],[W,D,H],[0,D,H]],tone(light,.88));
  s+=poly([[5,5,H-7],[W-5,5,H-7],[W-5,D-5,H-7],[5,D-5,H-7]],tone(light,.78));
  if(m.variant==='sealed') {
   for(const x of [W/3,W*2/3])s+=poly([[x-1,5,H-7],[x+1,5,H-7],[x+1,D-5,H-7],[x-1,D-5,H-7]],dark);
   for(const y of [D/3,D*2/3])s+=poly([[5,y-1,H-7],[W-5,y-1,H-7],[W-5,y+1,H-7],[5,y+1,H-7]],dark);
  }else if(m.variant==='dividers'){
   for(const x of [W/3,W*2/3])s+=line([[x,D-14,H-6],[x,D-5,H-6]],tone(light,.85),'stroke-width="1.5"');
  }
  if(grid)s+=gridLines(H-6);
 } else {
  s+=poly([[0,0,H],[W,0,H],[W,D,H],[0,D,H]],roof==='none'?dark:tone(light,1.04));
 }
 // Outer sides and front all use the same physical dimensions as the model card.
 s+=poly([[W,0,0],[W,D,0],[W,D,H],[W,0,H]],tone(light,.9));
 s+=face(0,0,W,H,light,2,`stroke="${tone(light,.72)}"`);
 const sidePad=Math.min(8,H*.12);
 for(let f=0;f<m.floor;f++)for(let d=0;d<m.depth;d++){
  const y=11+d*42,z=9+f*48;if(y+12>D||z+sidePad>H-3)continue;
  s+=poly([[W,y,z],[W,y+12,z],[W,y+12,z+sidePad],[W,y,z+sidePad]],tone(light,.82),'stroke="none"');
 }
 if(!isBox) {
  const drawerWidths=twin?(m.family==='XL'?[164.8,W-164.8]:[W/2,W/2]):[W];
  let start=0;
  for(const width of drawerWidths){
   s+=face(start+4,4,width-8,H-8,dark,2,'stroke="none"');
   s+=face(start+6,6,width-12,H-12,light,2,`stroke="${tone(light,.8)}"`);
   const handleWidth=Math.min(width-28,112),handleHeight=Math.min(16,H*.32),hx=start+(width-handleWidth)/2,hz=Math.max(10,H*.28),cx=hx+handleWidth*.49;
   s+=face(hx,hz,handleWidth,handleHeight,tone(light,.99),handleHeight/2,`stroke="${tone(light,.8)}"`);
   s+=dot(cx,hz+handleHeight/2,Math.min(6,handleHeight*.37),dark);
   s+=face(cx+5,hz+handleHeight*.26,Math.min(35,handleWidth*.3),handleHeight*.48,label,1,'stroke="none"');
   for(const x of [start+13,start+width-20])s+=face(x,1.5,7,2.3,orange,1,'stroke="none"');
   start+=width;
  }
  if(twin)s+=face(drawerWidths[0]-1.5,3,3,H-6,tone(light,.8),0,'stroke="none"');
  if(roof!=='none'){
   const rz=H+(roof==='Bowl'?6:3);
   s+=poly([[-1,-1,H],[-1,-1,rz],[W+1,-1,rz],[W+1,-1,H]],tone(light,.96));
   s+=poly([[-1,-1,rz],[W+1,-1,rz],[W+1,D+1,rz],[-1,D+1,rz]],tone(light,1.06));
   if(roof==='Grid')s+=gridLines(rz+.05);
   if(roof==='Bowl'){
    s+=poly([[5,5,rz-.5],[W-5,5,rz-.5],[W-5,D-5,rz-.5],[5,D-5,rz-.5]],tone(light,.86));
    s+=poly([[8,8,rz-1],[W-8,8,rz-1],[W-8,D-8,rz-1],[8,D-8,rz-1]],light);
   }
   if(roof==='Under Table Mount')for(const x of [-ext,W]){
    s+=poly([[x,12,H],[x+ext,12,H],[x+ext,D-12,H],[x,D-12,H]],tone(light,.92));
    for(const y of [22,D-22]){const [cx,cy]=p(x+ext/2,y,H+.1);s+=`<ellipse cx="${cx}" cy="${cy}" rx="${1.8*scale}" ry="${.9*scale}" fill="${dark}" stroke="none"/>`;}
   }
  }else s+=poly([[4,4,H+.05],[W-4,4,H+.05],[W-4,D-4,H+.05],[4,D-4,H+.05]],tone(dark,.9));
 }else{
  const lockHeight=Math.min(20,H*.45),lockWidth=Math.min(23,W*.12);
  for(const x of (['S','M'].includes(m.family)?[W/2]:[W/4,W*3/4])){
   s+=face(x-lockWidth/2,H-lockHeight-1,lockWidth,lockHeight,dark,2,'stroke="none"');
   s+=face(x-lockWidth*.3,H-lockHeight*.7,lockWidth*.6,3,tone(dark,.7),1,'stroke="none"');
   s+=poly([[x-8,D-8,H],[x+8,D-8,H],[x+8,D+1,H+9],[x-8,D+1,H+9]],dark,'stroke="none"');
   s+=poly([[x-9,D-8,H+1],[x-5,D-8,H+1],[x-5,D+1,H+10],[x-9,D+1,H+10]],orange,'stroke="none"');
  }
  s+=face(W*.37,H*.31,W*.26,Math.min(10,H*.18),label,1,'stroke="none"');
 }
 const roofNames={Table:'平面顶盖',Grid:'网格顶盖',Bowl:'托盘顶盖','Under Table Mount':'桌下安装顶盖',none:'无顶盖'};
 const variantNames={standard:'标准',flat:'平底',dividers:'分隔接口',sealed:'密封分隔'};
 const caption=`${code} · ${m.floor}F / ${H} mm 高 · ${isBox?'翻盖箱 / '+variantNames[m.variant]+' / '+({Lid:'标准翻盖',Split:'分体翻盖',Whole:'一体翻盖'}[roof]||'标准翻盖'):(twin?'左右双抽屉 / ':'')+roofNames[roof]}`;
 const notes=[grid?'含内部网格底板':'',rails&&!isBox?'含加强齿条':'',m.variant==='dividers'?'可选隔板未添加':''].filter(Boolean).join(' · ');
 if(!compact)s+=`<text x="${canvasW/2}" y="${canvasH-12}" text-anchor="middle" fill="#8c9982" stroke="none" font-size="9" font-family="sans-serif">${escape(caption)}</text>${notes?`<text x="${canvasW/2}" y="${canvasH-1}" text-anchor="middle" fill="#a5af9a" stroke="none" font-size="8" font-family="sans-serif">${escape(notes)}</text>`:''}`;
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${canvasW} ${canvasH}" ${compact?'aria-hidden="true"':`role="img" aria-label="${escape(caption+'，名义尺寸与配色示意')}"`} data-preview-height="${H}" data-preview-width="${W}" data-preview-depth="${D}" data-preview-kind="${m.kind}" data-preview-roof="${roof}" stroke="${tone(light,.74)}" stroke-width="${compact?.55:.7}" stroke-linejoin="round">${s}</svg>`;
}
