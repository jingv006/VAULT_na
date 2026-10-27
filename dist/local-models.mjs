// Compare only the tree inside the chosen root; its name is never a key.
// Never fall back to a bare filename: VAULT families reuse many basenames.
function pathKey(path){
 return path.split('/').map(segment=>segment.trim().replace(/\s+/g,' ').toLowerCase()).join('/')
  .replace(/\/x(\d+) runner guides(?=(?: xl)?\.stl$)/,'/x$1 runner guide')
  .replace(/\/x(\d+) runner slides(?=(?: xl)?\.stl$)/,'/x$1 runner slide');
}
export function matchModelDirectory(files,catalog){
 const known=new Map(catalog.files.map(file=>[file.path.normalize('NFC'),file]));
 const tree=new Map();
 for(const record of catalog.files){const key=pathKey(record.path.normalize('NFC'));if(!tree.has(key))tree.set(key,[]);tree.get(key).push(record);}
 const matched=new Map(),actualPaths=new Map();let root='';
 for(const file of files){
  const segments=String(file.webkitRelativePath||'').replaceAll('\\','/').normalize('NFC').split('/');
  if(segments.length<2)continue;
  const relative=segments.slice(1).join('/'),candidates=tree.get(pathKey(relative));
  const record=known.get(relative)||(candidates?.length===1?candidates[0]:null);
  if(!record)continue;
  // If both a canonical filename and an alias exist, prefer the exact path.
  if(matched.has(record.path)&&actualPaths.get(record.path)===record.path)continue;
  root=segments[0];matched.set(record.path,file);actualPaths.set(record.path,relative);
 }
 if(!matched.size)throw Error('未找到匹配的模型。外层文件夹可任意命名，请选择内含 01. DRAWERS、02. SUSTAINERS 等原始子目录的文件夹，保留内部文件树。');
 const stls=[...matched.keys()].filter(path=>/\.stl$/i.test(path)).length;
 if(!stls)throw Error('目录中没有匹配的 STL，请选择模型根目录并保留内部文件树；外层文件夹名称不限。');
 const wrongSize=[...matched].filter(([path,file])=>file.size!==known.get(path.normalize('NFC')).bytes).map(([path])=>path);
 const aliases=[...actualPaths].filter(([path,actual])=>path!==actual).map(([path,actual])=>({path,actual}));
 return {root,files:matched,stls,totalSTLs:catalog.stlCount,wrongSize,aliases,missing:catalog.files.filter(file=>/\.stl$/i.test(file.path)&&!matched.has(file.path)).map(file=>file.path)};
}
