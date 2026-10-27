import assert from 'node:assert/strict';
import fs from 'node:fs';
import {writeZip} from '../dist/zip.mjs';
import {matchModelDirectory} from '../dist/local-models.mjs';
const catalog=JSON.parse(fs.readFileSync(new URL('../dist/catalog.json',import.meta.url)));
const files=catalog.files.map(file=>({name:file.name,size:file.bytes,webkitRelativePath:'original-library/'+file.path}));
const result=matchModelDirectory(files,catalog);
assert.equal(result.stls,733);assert.equal(result.missing.length,0);assert.equal(result.root,'original-library');
assert.equal(result.files.size,catalog.files.length);
assert.throws(()=>matchModelDirectory(files.map(file=>({...file,webkitRelativePath:'flat/'+file.name})),catalog),/文件树/);
assert.throws(()=>matchModelDirectory(files.map(file=>({...file,webkitRelativePath:'parent/'+file.webkitRelativePath})),catalog),/文件树/);
assert.throws(()=>matchModelDirectory([],catalog));
const first=files.find(file=>file.name.endsWith('.stl'));
const partial=matchModelDirectory([first],catalog);
assert.equal(partial.stls,1);assert.equal(partial.missing.length,732);
const changed=files.map(file=>file===first?{...file,size:file.size+1}:file);
const mismatch=matchModelDirectory(changed,catalog);
assert.equal(mismatch.stls,733);assert.equal(mismatch.wrongSize.length,1);assert.equal(mismatch.missing.length,0);
assert.equal(mismatch.files.get(first.webkitRelativePath.split('/').slice(1).join('/')),changed[files.indexOf(first)],'path match does not depend on file size');
assert.throws(()=>matchModelDirectory(files.filter(file=>!file.name.toLowerCase().endsWith('.stl')),catalog),/STL/);
// Identical basenames across families must retain distinct local File objects.
const groups=new Map();
for(const file of files){const rows=groups.get(file.name)||[];rows.push(file);groups.set(file.name,rows);}
const duplicate=[...groups.values()].find(rows=>rows.length>1&&rows[0].name.endsWith('.stl'));
assert(duplicate);
for(const file of duplicate){const path=file.webkitRelativePath.split('/').slice(1).join('/');assert.equal(result.files.get(path),file);}


for(const root of ['VAULT','my-models','2026-10 library backup','我的模型 收藏夹','261021_VAULT_USSA_S']){
 const renamed=files.map(file=>({...file,webkitRelativePath:root+'/'+file.webkitRelativePath.split('/').slice(1).join('/')}));
 const matched=matchModelDirectory(renamed,catalog);
 assert.equal(matched.stls,733);assert.equal(matched.missing.length,0);assert.equal(matched.root,root);
}
const windows=files.map(file=>({...file,webkitRelativePath:file.webkitRelativePath.replaceAll('/','\\').toUpperCase()}));
assert.equal(matchModelDirectory(windows,catalog).stls,733,'Windows separators and case variation');
const guide=catalog.files.find(file=>file.path.endsWith('/Runners/x3 Runner Guide.stl'));
const slide=catalog.files.find(file=>file.path.endsWith('/Runners/x3 Runner Slide.stl'));
const screenshotFiles=[guide,slide].map(record=>({name:record.name.replace(/(Guide|Slide)/,'$1s'),size:record.bytes+100,webkitRelativePath:'任意名字/'+record.path.replace(/(Guide|Slide)/,'$1s')}));
const screenshotMatch=matchModelDirectory(screenshotFiles,catalog);
assert.equal(screenshotMatch.files.get(guide.path),screenshotFiles[0]);
assert.equal(screenshotMatch.files.get(slide.path),screenshotFiles[1]);
assert.equal(screenshotMatch.wrongSize.length,2);assert.equal(screenshotMatch.aliases.length,2);
const canonical=files.find(file=>file.webkitRelativePath.endsWith('/Runners/x3 Runner Guide.stl'));
for(const both of [[screenshotFiles[0],canonical],[canonical,screenshotFiles[0]]])assert.equal(matchModelDirectory(both,catalog).files.get(guide.path),canonical,'exact source path wins over alias');
const xl=catalog.files.find(file=>file.path.endsWith('/x3 Runner Guide XL.stl'));
assert(matchModelDirectory([{name:'x3 Runner Guides XL.stl',size:xl.bytes,webkitRelativePath:'VAULT/'+xl.path.replace('Guide XL','Guides XL')}],catalog).files.has(xl.path));
console.log('Directory matching passed: five arbitrary root names, 733 STL, Windows paths/case, Guide(s)/Slide(s) screenshot regression, size-independent matching, canonical preference and duplicate-name isolation');

const payloads=['solid guide\nendsolid guide\n','solid slide\nendsolid slide\n'];
const exportFiles=[guide,slide].map((record,i)=>{
 const blob=new Blob([payloads[i]]);
 return {name:record.name.replace(/(Guide|Slide)/,'$1s'),size:blob.size,webkitRelativePath:'Custom Folder/'+record.path.replace(/(Guide|Slide)/,'$1s'),stream:()=>blob.stream()};
});
const exportMap=matchModelDirectory(exportFiles,catalog).files,chunks=[];
await writeZip([guide,slide].map(record=>({name:'STL/'+record.path,size:exportMap.get(record.path).size,stream:()=>exportMap.get(record.path).stream()})),{write:bytes=>chunks.push(bytes),close:async()=>{}});
fs.mkdirSync(new URL('../tmp/',import.meta.url),{recursive:true});fs.writeFileSync(new URL('../tmp/renamed-guide-test.zip',import.meta.url),Buffer.concat(chunks));
console.log('Plural-name source files packed with their actual contents/sizes into tmp/renamed-guide-test.zip');
