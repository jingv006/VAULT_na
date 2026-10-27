import assert from 'node:assert/strict';
import fs from 'node:fs';
import {matchModelDirectory} from '../dist/local-models.mjs';
const catalog=JSON.parse(fs.readFileSync(new URL('../dist/catalog.json',import.meta.url)));
const files=catalog.files.map(file=>({name:file.name,size:file.bytes,webkitRelativePath:'original-library/'+file.path}));
const result=matchModelDirectory(files,catalog);
assert.equal(result.stls,733);assert.equal(result.missing.length,0);assert.equal(result.root,'original-library');
assert.equal(result.files.size,catalog.files.length);
assert.throws(()=>matchModelDirectory(files.map(file=>({...file,webkitRelativePath:'flat/'+file.name})),catalog),/根目录/);
assert.throws(()=>matchModelDirectory(files.map(file=>({...file,webkitRelativePath:'parent/'+file.webkitRelativePath})),catalog),/根目录/);
assert.throws(()=>matchModelDirectory([],catalog));
const first=files.find(file=>file.name.endsWith('.stl'));
const partial=matchModelDirectory([first],catalog);
assert.equal(partial.stls,1);assert.equal(partial.missing.length,732);
const changed=files.map(file=>file===first?{...file,size:file.size+1}:file);
const mismatch=matchModelDirectory(changed,catalog);
assert.equal(mismatch.stls,732);assert.equal(mismatch.wrongSize.length,1);
assert(!mismatch.files.has(first.webkitRelativePath.split('/').slice(1).join('/')));
assert.throws(()=>matchModelDirectory(files.filter(file=>!file.name.toLowerCase().endsWith('.stl')),catalog),/STL/);
// Identical basenames across families must retain distinct local File objects.
const groups=new Map();
for(const file of files){const rows=groups.get(file.name)||[];rows.push(file);groups.set(file.name,rows);}
const duplicate=[...groups.values()].find(rows=>rows.length>1&&rows[0].name.endsWith('.stl'));
assert(duplicate);
for(const file of duplicate){const path=file.webkitRelativePath.split('/').slice(1).join('/');assert.equal(result.files.get(path),file);}
console.log('Directory matching passed: 733 STL, original paths, duplicate basenames, partial/mismatched libraries and wrong-root/flattened rejection');
