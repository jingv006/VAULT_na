import fs from 'node:fs';
import {measureAssembly} from '../dist/assembly-measurements.mjs';
const rows=JSON.parse(fs.readFileSync('/tmp/vault-dimension-metadata.json')),records={};
for(const row of rows){try{records[row.model.id+'|'+row.roof]=measureAssembly(row.model,row.parts);}catch(error){console.error(row.model.id,row.roof,error.message);}}
fs.writeFileSync(new URL('../dist/measurements.json',import.meta.url),JSON.stringify({version:1,records},null,2)+'\n');
console.log('measured',Object.keys(records).length,'assemblies; L6F2',records['d-L6-2|Table']);
