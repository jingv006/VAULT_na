import fs from 'node:fs';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';import{makeBOM}from '../dist/core.mjs';
const base=fileURLToPath(new URL('../',import.meta.url));const c=JSON.parse(fs.readFileSync(base+'dist/catalog.json')),cases=[];
for(const m of c.modules)for(const roof of m.kind==='drawer'?['none',...Object.keys(m.roofs)]:['none',...Object.keys(m.lidRoofs||{})])for(const grid of [false,true])for(const rails of m.kind==='drawer'?[false,true]:[false]){
 const spec={model:m.id,roof,grid,rails};const bom=makeBOM({items:[{id:'one',model:m.id,x:0,y:0,roof,grid,rails}],extras:[],overrides:{}},c);cases.push({spec,parts:bom.parts.map(p=>({path:p.path,qty:p.qty,role:p.role}))});
}
fs.mkdirSync(base+'tmp',{recursive:true});fs.writeFileSync(base+'tmp/kit-recipe-fixtures.json',JSON.stringify(cases));
const result=spawnSync('/usr/bin/python3',[base+'tools/verify-kits.py'],{stdio:'inherit'});process.exitCode=result.status??1;
