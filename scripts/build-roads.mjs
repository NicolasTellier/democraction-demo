// Reproducible, bounded export of public BD TOPO named-road geometry.
// Run: node scripts/build-roads.mjs [--refresh] [--code=33001]
// Completed, validated commune files are reused after interruption.
import {readFile,writeFile,rename,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';

const ROOT=resolve(import.meta.dirname,'..');
const DATA=resolve(ROOT,'data');
const WFS='https://data.geopf.fr/wfs/ows';
const TYPE='BDTOPO_V3:voie_nommee';
const PAGE_SIZE=500;
const MAX_MATCHED=4000;
const WORKERS=3;
const REFRESH=process.argv.includes('--refresh');
const onlyCode=process.argv.find(arg=>arg.startsWith('--code='))?.slice(7);

function validLine(geometry){
 const parts=geometry?.type==='LineString'?[geometry.coordinates]:geometry?.type==='MultiLineString'?geometry.coordinates:null;
 return Array.isArray(parts)&&parts.length>0&&parts.every(line=>Array.isArray(line)&&line.length>=2&&line.every(point=>Array.isArray(point)&&point.length>=2&&point.slice(0,2).every(Number.isFinite)&&Math.abs(point[0])<=180&&Math.abs(point[1])<=90));
}

function normalise(collection,code,asOf){
 const byId=new Map();let rejected=0,merged=0;
 for(const feature of collection.features){
  const p=feature?.properties||{};
  const city=String(p.insee_commune||'');
  const id=String(p.identifiant_voie_ban||p.cleabs||feature?.id||'');
  const name=String(p.nom_voie_ban||p.nom_collaboratif||'').trim();
  if(city!==code||!id||!name||!validLine(feature?.geometry)){rejected++;continue}
  const alt=String(p.nom_collaboratif||'').trim();
  const parts=feature.geometry.type==='LineString'?[feature.geometry.coordinates]:feature.geometry.coordinates;
  if(byId.has(id)){
   byId.get(id).geometry.coordinates.push(...parts);
   merged++;
   continue;
  }
  byId.set(id,{type:'Feature',id:feature.id||id,geometry:{type:'MultiLineString',coordinates:[...parts]},properties:{
   id,name,code:city,type:p.type_voie||null,alternateName:alt&&alt!==name?alt:null,
   sourceName:p.source_voie_ban||null,updated:p.date_modification||null
  }});
 }
 const features=[...byId.values()].sort((a,b)=>a.properties.name.localeCompare(b.properties.name,'fr')||a.properties.id.localeCompare(b.properties.id));
 if(!features.length)throw new Error('Aucune géométrie de voie valide.');
 return {type:'FeatureCollection',meta:{source:'IGN BD TOPO voie_nommee WFS',url:WFS,typeName:TYPE,commune:code,retrievedAt:asOf,numberMatched:collection.numberMatched,numberReturned:collection.features.length,rejected,merged},features};
}

function urlFor(code,start,count){
 const url=new URL(WFS);
 for(const [key,value] of Object.entries({SERVICE:'WFS',VERSION:'2.0.0',REQUEST:'GetFeature',TYPENAMES:TYPE,OUTPUTFORMAT:'application/json',SRSNAME:'EPSG:4326',CQL_FILTER:`insee_commune='${code}'`,STARTINDEX:start,COUNT:count}))url.searchParams.set(key,String(value));
 return url;
}

async function fetchCollection(code){
 const features=[];let matched=null;
 do{
  if(features.length>=MAX_MATCHED)throw new Error('Limite de 4 000 objets atteinte.');
  const response=await fetch(urlFor(code,features.length,Math.min(PAGE_SIZE,MAX_MATCHED-features.length)),{signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw new Error(`WFS HTTP ${response.status}`);
  const page=await response.json();
  if(page?.type!=='FeatureCollection'||!Array.isArray(page.features))throw new Error('Réponse WFS invalide.');
  const count=Number(page.numberMatched??page.totalFeatures);
  if(!Number.isSafeInteger(count)||count<0||count>MAX_MATCHED)throw new Error(`Nombre d'objets invalide : ${page.numberMatched}.`);
  if(matched!==null&&count!==matched)throw new Error('Nombre de résultats modifié pendant la pagination.');
  matched=count;
  if(!page.features.length&&features.length<matched)throw new Error('Pagination WFS incomplète.');
  features.push(...page.features);
  if(features.length>matched)throw new Error('Pagination WFS incohérente.');
 }while(features.length<matched);
 return {features,numberMatched:matched};
}

async function atomicJSON(path,data){
 const temporary=`${path}.${process.pid}.tmp`;
 await writeFile(temporary,JSON.stringify(data));
 await rename(temporary,path);
}

async function atomicGzip(path,data){
 const temporary=`${path}.${process.pid}.tmp`;
 const bytes=gzipSync(Buffer.from(JSON.stringify(data)),{level:9,mtime:0});
 await writeFile(temporary,bytes);
 await rename(temporary,path);
 return {compressedBytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
}

async function validExisting(code){
 try{
  const data=JSON.parse(await readFile(resolve(DATA,`voies-${code}.geojson`),'utf8'));
  if(data?.type!=='FeatureCollection'||data.meta?.commune!==code||data.features?.length<1||data.meta?.numberMatched<data.features.length||data.features.some(f=>f.properties?.code!==code||!f.properties?.id||!validLine(f.geometry)))return null;
  return data;
 }catch{return null}
}

function rowFor(code,commune,collection,status='ok'){
 const meta=collection.meta;
 return {code,nom:commune.nom,file:`data/voies-${code}.geojson.gz`,status,count:collection.features.length,matched:meta.numberMatched,rejected:meta.rejected??Math.max(0,meta.numberMatched-collection.features.length),merged:meta.merged??0,asOf:meta.retrievedAt,source:meta.source};
}

await mkdir(DATA,{recursive:true});
const territory=JSON.parse(await readFile(resolve(DATA,'territoire-33-11-2026.json'),'utf8'));
const communes=territory.communes.filter(c=>!onlyCode||c.codeInsee===onlyCode);
if(communes.length!==(onlyCode?1:87)||communes.some(c=>!/^33\d{3}$/.test(c.codeInsee)))throw new Error('Liste des communes invalide.');
let cursor=0;
const rows=[];
async function worker(){
 while(cursor<communes.length){
  const commune=communes[cursor++],code=commune.codeInsee;
  try{
   const existing=!REFRESH&&await validExisting(code);
   const collection=existing||normalise(await fetchCollection(code),code,new Date().toISOString());
   if(!existing)await atomicJSON(resolve(DATA,`voies-${code}.geojson`),collection);
   const integrity=await atomicGzip(resolve(DATA,`voies-${code}.geojson.gz`),collection);
   rows.push({...rowFor(code,commune,collection),...integrity});
   process.stdout.write(`${code} ${commune.nom}: ${collection.features.length}/${collection.meta.numberMatched} voies ${existing?'(reprise)':''}\n`);
  }catch(error){
   rows.push({code,nom:commune.nom,file:null,status:'error',error:String(error.message).slice(0,160)});
   process.stderr.write(`${code} ${commune.nom}: ${error.message}\n`);
  }
 }
}
await Promise.all(Array.from({length:Math.min(WORKERS,communes.length)},worker));
rows.sort((a,b)=>a.code.localeCompare(b.code));
const manifest={meta:{source:'IGN BD TOPO voie_nommee WFS',url:WFS,typeName:TYPE,generatedAt:new Date().toISOString(),scope:'11e circonscription de la Gironde',expectedCommunes:87,successful:rows.filter(r=>r.status==='ok').length,failed:rows.filter(r=>r.status==='error').length,scopeOfThisRun:onlyCode||'all',note:'Les voies nommées ne garantissent pas l’exhaustivité des chemins, lieux-dits ou adresses BAN/BAL. Données géométriques publiques uniquement.'},communes:rows};
if(!onlyCode)await atomicJSON(resolve(DATA,'voies-manifest.json'),manifest);
if(manifest.meta.failed)process.exitCode=1;
