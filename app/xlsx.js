/** Lecteur XLSX minimal sans dépendances : feuille n°1, chaînes partagées et inline, pas de formules. */
function u16(v,o){return v.getUint16(o,true)}
function u32(v,o){return v.getUint32(o,true)}
async function unzipFirstSheets(bytes){
 const dv=new DataView(bytes), end=(()=>{for(let i=bytes.byteLength-22;i>=Math.max(0,bytes.byteLength-65558);i--)if(u32(dv,i)===0x06054b50)return i;throw new Error('Archive XLSX non reconnue.')})();
 let offset=u32(dv,end+16);const entries=new Map();const decoder=new TextDecoder();
 for(let i=0,n=u16(dv,end+10);i<n;i++){
  if(u32(dv,offset)!==0x02014b50)throw new Error('Entrée ZIP invalide.');
  const method=u16(dv,offset+10),compressed=u32(dv,offset+20),nameLen=u16(dv,offset+28),extraLen=u16(dv,offset+30),commentLen=u16(dv,offset+32),localOffset=u32(dv,offset+42);
  const name=decoder.decode(new Uint8Array(bytes,offset+46,nameLen));
  if(name==='xl/sharedStrings.xml'||name==='xl/worksheets/sheet1.xml'||name==='xl/workbook.xml')entries.set(name,{method,compressed,localOffset});
  offset+=46+nameLen+extraLen+commentLen;
 }
 const unpack=async entry=>{
  if(!entry)return '';
  const off=entry.localOffset;if(u32(dv,off)!==0x04034b50)throw new Error('En-tête ZIP invalide.');
  const start=off+30+u16(dv,off+26)+u16(dv,off+28),raw=new Uint8Array(bytes,start,entry.compressed);
  if(entry.method===0)return decoder.decode(raw);
  if(entry.method!==8||!globalThis.DecompressionStream)throw new Error('Ce navigateur ne prend pas en charge la décompression XLSX. Exporter en CSV UTF-8 depuis Excel.');
  const stream=new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  const ab=await new Response(stream).arrayBuffer();if(ab.byteLength>20e6)throw new Error('Feuille XLSX trop volumineuse.');return decoder.decode(ab);
 };
 return {shared:await unpack(entries.get('xl/sharedStrings.xml')),sheet:await unpack(entries.get('xl/worksheets/sheet1.xml'))};
}
export async function parseXlsx(file){
 if(file.size>5e6)throw new Error('Maximum 5 Mo par fichier XLSX.');
 const data=await file.arrayBuffer(),{shared,sheet}=await unzipFirstSheets(data);
 if(!sheet)throw new Error('La première feuille XLSX est introuvable.');
 const dom=new DOMParser();const parse=s=>dom.parseFromString(s,'application/xml');
 const sharedStrings=shared?[...parse(shared).getElementsByTagName('si')].map(si=>[...si.getElementsByTagName('t')].map(t=>t.textContent).join('')):[];
 const worksheet=parse(sheet),all=[...worksheet.getElementsByTagName('row')];
 if(all.length>20001)throw new Error('Maximum 20 000 lignes.');
 const rows=all.map(row=>{
  const cells={};for(const c of row.getElementsByTagName('c')){
   const ref=c.getAttribute('r')||'',letters=(ref.match(/^[A-Z]+/)||['A'])[0];let idx=0;for(const ch of letters)idx=idx*26+ch.charCodeAt(0)-64;idx--;
   const t=c.getAttribute('t'),v=c.getElementsByTagName('v')[0]?.textContent||'';
   cells[idx]=t==='s'?(sharedStrings[Number(v)]||''):t==='inlineStr'?[...c.getElementsByTagName('t')].map(x=>x.textContent).join(''):v;
  }
  return cells;
 });
 if(rows.length<2)throw new Error('La feuille ne contient aucune ligne de données.');
 const idxs=Object.keys(rows[0]).map(Number).sort((a,b)=>a-b);const max=Math.max(...idxs);
 const headers=Array.from({length:max+1},(_,i)=>String(rows[0][i]??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/[\s\-]+/g,'_'));
 const records=rows.slice(1).filter(r=>Object.values(r).some(v=>String(v).trim())).map(r=>Object.fromEntries(headers.map((h,i)=>[h,String(r[i]??'').trim()])));
 return {headers,rows:records};
}
