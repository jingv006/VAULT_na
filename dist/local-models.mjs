// Match paths relative to the selected library root. Do not flatten folders or
// fall back to basenames: different VAULT families reuse the same filenames.
export function matchModelDirectory(files,catalog){
 const known=new Map(catalog.files.map(file=>[file.path.normalize('NFC'),file]));
 const matched=new Map(),wrongSize=[];let root='';
 for(const file of files){
  const segments=String(file.webkitRelativePath||'').normalize('NFC').split('/');
  if(segments.length<2)continue;
  const relative=segments.slice(1).join('/'),record=known.get(relative);
  if(!record)continue;
  if(file.size!==record.bytes){wrongSize.push(relative);continue;}
  root=segments[0];matched.set(record.path,file);
 }
 if(!matched.size)throw Error('未找到匹配的模型。请选择原模型根目录，并保持 01. DRAWERS、02. SUSTAINERS 等子目录及文件名不变。');
 const stls=[...matched.keys()].filter(path=>/\.stl$/i.test(path)).length;
 if(!stls)throw Error('目录中没有匹配的 STL，请选择完整的原模型根目录并保持原目录结构。');
 return {root,files:matched,stls,totalSTLs:catalog.stlCount,wrongSize,missing:catalog.files.filter(file=>/\.stl$/i.test(file.path)&&!matched.has(file.path)).map(file=>file.path)};
}
