// Streaming ZIP writer (STORE + data descriptors). Each source is read in chunks.
// Zip64 is intentionally rejected before writing; local Python export supports it.
const enc=new TextEncoder();
const table=Uint32Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crcUpdate(crc,bytes){for(const b of bytes)crc=table[(crc^b)&255]^(crc>>>8);return crc>>>0;}
function header(size,fields){const a=new Uint8Array(size),v=new DataView(a.buffer);for(const [pos,value,type=4] of fields)type===2?v.setUint16(pos,value,true):v.setUint32(pos,value,true);return a;}
export async function writeZip(entries,sink,onProgress=()=>{}) {
 const total=entries.reduce((n,e)=>n+e.size,0);if(total>3900000000||entries.length>60000)throw Error('此方案超过浏览器 ZIP 上限，请使用本机版（支持 ZIP64）。');
 const central=[];let offset=0,done=0;
 const put=async b=>{await sink.write(b);offset+=b.byteLength;};
 for(const e of entries){
  const name=enc.encode(e.name),start=offset,flags=0x808;
  await put(header(30,[[0,0x04034b50],[4,20,2],[6,flags,2],[26,name.length,2]]));await put(name);
  let crc=0xffffffff,size=0;const reader=e.stream().getReader();
  try{while(true){const r=await reader.read();if(r.done)break;crc=crcUpdate(crc,r.value);size+=r.value.length;done+=r.value.length;await put(r.value);onProgress(done,total,e.name);}}finally{reader.releaseLock();}
  crc=(crc^0xffffffff)>>>0;
  await put(header(16,[[0,0x08074b50],[4,crc],[8,size],[12,size]]));
  central.push({name,start,crc,size,flags});
 }
 const centralStart=offset;
 for(const e of central){await put(header(46,[[0,0x02014b50],[4,20,2],[6,20,2],[8,e.flags,2],[16,e.crc],[20,e.size],[24,e.size],[28,e.name.length,2],[42,e.start]]));await put(e.name);}
 await put(header(22,[[0,0x06054b50],[8,central.length,2],[10,central.length,2],[12,offset-centralStart],[16,centralStart]]));await sink.close();
}
