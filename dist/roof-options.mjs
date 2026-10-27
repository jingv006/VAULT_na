const drawerStyles=[['Table','平面顶盖'],['Grid','网格收纳'],['Bowl','托盘顶盖'],['Under Table Mount','桌下安装'],['none','不含顶盖']];
const lidNames={Lid:'标准翻盖',Split:'分体翻盖',Whole:'一体翻盖'};
export function roofChoices(m){
 if(m.kind==='drawer')return drawerStyles.filter(([value])=>value==='none'||m.roofs?.[value]?.length);
 return Object.keys(m.lidRoofs||{[m.depth>=6?'Split':'Lid']:[]}).map(value=>[value,lidNames[value]||value]);
}
export function selectedRoof(m,value){
 const choices=roofChoices(m);
 return choices.some(([key])=>key===value)?value:(m.kind==='drawer'?'Table':m.defaultLid||choices[0]?.[0]);
}

export function roofDescription(m,value){
 const roof=selectedRoof(m,value),name=roofChoices(m).find(([key])=>key===roof)?.[1]||'';
 return name+(roof==='Split'?'（2 片盖板＋连接件）':roof==='Whole'?'（1 片盖板）':'');
}
// Accept a preview only if its actual roof files match the selected recipe.
export function verifyPreviewRoof(m,value,parts){
 const roof=selectedRoof(m,value),roles=m.kind==='drawer'?['顶盖']:['翻盖','翻盖分件','翻盖连接件'];
 const expected=m.kind==='drawer'?(m.roofs?.[roof]||[]):(m.lidRoofs?.[roof]||m.parts.filter(p=>roles.includes(p.role)));
 const signature=rows=>JSON.stringify(rows.map(p=>[p.path,p.qty]).sort((a,b)=>a[0].localeCompare(b[0])));
 if(signature(expected)!==signature(parts.filter(p=>roles.includes(p.role))))throw Error('返回的顶盖模型与所选款式不一致，请重试');
 return roof;
}
