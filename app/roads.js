import {norm} from './core.js';
import {readRoadCache,writeRoadCache,listRoadCache,roadCoverage,ROAD_CACHE_AGE_MS} from './road-cache.js';

const WFS='https://data.geopf.fr/wfs/ows';
const localRoads=new Map();
const localAddresses=new Map();
const MAX_ROADS=4000;
let manifestPromise;

async function roadManifest(){
 if(!manifestPromise)manifestPromise=(async()=>{
  const response=await fetch(new URL('../data/voies-manifest.json',import.meta.url));
  if(!response.ok)throw new Error('Inventaire des voies indisponible.');
  const data=await response.json();
  if(!Array.isArray(data.communes)||data.communes.some(row=>
   !/^33\d{3}$/.test(row.code)||![`data/voies-${row.code}.geojson`,`data/voies-${row.code}.geojson.gz`].includes(row.file)||
   !Number.isSafeInteger(row.count)||row.count<1||!Number.isSafeInteger(row.matched)||row.matched<row.count||
   !Number.isFinite(Date.parse(row.asOf))))throw new Error('Inventaire des voies invalide.');
  if(new Set(data.communes.map(row=>row.code)).size!==data.communes.length)throw new Error('Communes dupliquées dans l’inventaire.');
  return data.communes;
 })().catch(()=>[{code:'33366',file:'data/voies-33366.geojson',count:303,matched:303,asOf:'2026-11-14T12:54:20.986Z'}]);
 return manifestPromise;
}

function line(geometry){
 const parts=geometry?.type==='LineString'?[geometry.coordinates]:geometry?.type==='MultiLineString'?geometry.coordinates:null;
 return Array.isArray(parts)&&parts.length>0&&parts.every(points=>Array.isArray(points)&&points.length>=2&&points.every(p=>Array.isArray(p)&&p.length>=2&&Number.isFinite(p[0])&&Number.isFinite(p[1])&&Math.abs(p[0])<=180&&Math.abs(p[1])<=90));
}

export function normalizeRoads(data,code){
 if(data?.type!=='FeatureCollection'||!Array.isArray(data.features))throw new Error('Réponse de voies invalide.');
 const seen=new Set(),features=[];
 for(const feature of data.features){
  const p=feature?.properties||{};
  const city=String(p.code||p.insee_commune||'');
  const id=String(p.id||p.identifiant_voie_ban||p.cleabs||feature?.id||'');
  const name=String(p.name||p.nom_voie_ban||p.nom_collaboratif||'').trim();
  if(city!==code||!id||!name||!line(feature?.geometry)||seen.has(id))continue;
  seen.add(id);
  features.push({type:'Feature',id,geometry:feature.geometry,properties:{id,name,code:city,updated:p.updated||p.date_modification||null}});
 }
 return features.sort((a,b)=>a.properties.name.localeCompare(b.properties.name,'fr'));
}

function urlFor(type,filter,startIndex,count,sort){
 const url=new URL(WFS);
 for(const [k,v] of Object.entries({SERVICE:'WFS',VERSION:'2.0.0',REQUEST:'GetFeature',TYPENAMES:type,OUTPUTFORMAT:'application/json',SRSNAME:'EPSG:4326',CQL_FILTER:filter,STARTINDEX:startIndex,COUNT:count}))url.searchParams.set(k,String(v));
 if(sort)url.searchParams.set('SORTBY','id');
 return url;
}

async function wfsCollection(type,filter,{limit=MAX_ROADS,pageSize=500,signal,sort=false}={}){
 const features=[];let total=Infinity;
 while(features.length<total){
  if(features.length>=limit)throw new Error(`Plus de ${limit} objets : affinez la commune ou la voie.`);
  const timeout=AbortSignal.timeout(25000);
  const response=await fetch(urlFor(type,filter,features.length,Math.min(pageSize,limit-features.length),sort),{mode:'cors',signal:signal?AbortSignal.any([signal,timeout]):timeout});
  if(!response.ok)throw new Error(`Service IGN indisponible (${response.status}).`);
  const page=await response.json();
  if(page?.type!=='FeatureCollection'||!Array.isArray(page.features))throw new Error('Réponse IGN invalide.');
  total=Number(page.numberMatched??page.totalFeatures??page.features.length);
  if(!Number.isSafeInteger(total)||total<0)throw new Error('Nombre de résultats IGN invalide.');
  if(total>limit)throw new Error(`La requête contient ${total} objets, au-delà de la limite ${limit}.`);
  if(!page.features.length&&features.length<total)throw new Error('Pagination IGN incomplète.');
  features.push(...page.features);
  if(features.length>limit)throw new Error('Réponse IGN trop volumineuse.');
 }
 return {type:'FeatureCollection',features,numberMatched:total};
}

export async function roadInventory(codes){
 let entries=[];
 try{entries=await listRoadCache()}catch{ /* Le WFS reste disponible sans stockage local. */ }
 return roadCoverage(codes,entries,Date.now(),await roadManifest());
}

export async function loadRoads(code,{signal}={}){
 if(!/^33\d{3}$/.test(String(code)))throw new Error('Code de commune invalide.');
 if(localRoads.has(code))return localRoads.get(code);
 let collection,source,asOf,usedPackage=false;
 const packageRow=(await roadManifest()).find(row=>row.code===code);
 if(packageRow){
  try{
   const response=await fetch(new URL(`../${packageRow.file}`,import.meta.url),{signal});
   if(!response.ok)throw new Error(String(response.status));
   collection=packageRow.file.endsWith('.gz')
    ?JSON.parse(await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).text())
    :await response.json();
   if(collection.meta?.commune!==code||collection.features?.length!==packageRow.count||
      normalizeRoads(collection,code).length!==packageRow.count)throw new Error('Catalogue local incomplet.');
   source='IGN BD TOPO · voie nommée · paquet vérifié';asOf=packageRow.asOf;
   usedPackage=true;
  }catch{ /* Le WFS officiel prend le relais si le paquet local n'est pas disponible. */ }
 }
 if(!collection){
  let cached=null;
  try{cached=await readRoadCache(code)}catch{ /* Cache bloqué : continuer en ligne. */ }
  if(cached?.features?.length && Date.now()-Date.parse(cached.asOf)<ROAD_CACHE_AGE_MS){
   const features=normalizeRoads({type:'FeatureCollection',features:cached.features},code);
   if(features.length===cached.features.length){
    const result={code,features,source:cached.source+' · copie locale',asOf:cached.asOf,matched:cached.matched,
     rejected:cached.rejected??Math.max(0,cached.matched-features.length),merged:cached.merged??0,cached:true};
    localRoads.set(code,result);return result;
   }
  }
  const filter=`insee_commune='${code}'`;
  try{
   collection=await wfsCollection('BDTOPO_V3:voie_nommee',filter,{signal});
   source='IGN BD TOPO · voie nommée · WFS';asOf=new Date().toISOString();
  }catch(error){
   if(signal?.aborted)throw error;
   if(cached?.features?.length){
    const features=normalizeRoads({type:'FeatureCollection',features:cached.features},code);
    if(features.length===cached.features.length){
     const result={code,features,source:cached.source+' · copie locale ancienne',asOf:cached.asOf,matched:cached.matched,
      rejected:cached.rejected??Math.max(0,cached.matched-features.length),merged:cached.merged??0,cached:true,stale:true};
     localRoads.set(code,result);return result;
    }
   }
   throw error;
  }
 }
 const features=normalizeRoads(collection,code);
 if(!features.length)throw new Error('Aucune géométrie linéaire exploitable pour cette commune.');
 const matched=collection.numberMatched??collection.meta?.numberMatched??features.length;
 const result={code,features,source,asOf,matched,
  rejected:usedPackage?packageRow.rejected:Math.max(0,matched-features.length),
  merged:usedPackage?packageRow.merged:0};
 if(!usedPackage)try{result.stored=(await writeRoadCache(result))===code}catch{result.stored=false}
 localRoads.set(code,result);return result;
}

export function searchRoads(collection,query){
 const term=norm(query);return term?collection.features.filter(f=>norm(f.properties.name).includes(term)).slice(0,40):collection.features.slice(0,40);
}

export function roadGeometry(roads){
 const coordinates=roads.flatMap(road=>road.geometry?.type==='LineString'?[road.geometry.coordinates]:road.geometry?.type==='MultiLineString'?road.geometry.coordinates:[]);
 return coordinates.length?{type:'MultiLineString',coordinates}:null;
}

function normalizeBanAddresses(features,code,road={}){
 const seen=new Set(),addresses=[];
 for(const feature of features){
  const p=feature?.properties||{},point=feature?.geometry?.coordinates;
  const addressId=String(p.id||feature?.id||'');
  if(String(p.code_insee)!==code||!addressId||seen.has(addressId)||feature.geometry?.type!=='Point'||!Array.isArray(point)||point.length<2||!point.slice(0,2).every(Number.isFinite)||Math.abs(point[0])>180||Math.abs(point[1])>90)continue;
  seen.add(addressId);
  addresses.push({id:addressId,roadId:String(p.id_fantoir||road.id||''),roadName:String(p.nom_voie||road.name||''),code,number:String(p.numero||''),suffix:String(p.rep||''),postcode:String(p.code_postal||''),commune:String(p.nom_commune||''),coordinates:point.slice(0,2),certified:String(p.certification_commune)==='1'});
 }
 return addresses;
}

// Une seule fenêtre de carte à la fois : aucune extraction communale complète.
export async function loadAddressesInBounds(code,bounds,{signal}={}){
 if(!/^33\d{3}$/.test(String(code)))throw new Error('Code de commune invalide.');
 const {west,south,east,north}=bounds||{};
 if(![west,south,east,north].every(Number.isFinite)||west>=east||south>=north||west < -180||east > 180||south < -90||north > 90)throw new Error('Emprise cartographique invalide.');
 if(east-west>.04||north-south>.04)throw new Error('Zoomez davantage pour limiter le nombre d’adresses.');
 const filter=`code_insee='${code}' AND BBOX(geom,${west},${south},${east},${north},'EPSG:4326')`;
 const collection=await wfsCollection('BAN.DATA.GOUV:ban',filter,{limit:500,pageSize:250,signal,sort:true});
 const features=normalizeBanAddresses(collection.features,code).filter(a=>a.coordinates[0]>=west&&a.coordinates[0]<=east&&a.coordinates[1]>=south&&a.coordinates[1]<=north);
 return {features,source:'Base Adresse Nationale · WFS IGN',asOf:new Date().toISOString(),matched:collection.numberMatched};
}

export async function loadAddressesForRoad(road){
 const {id,name,code}=road.properties||{};
 if(!/^33\d{3}$/.test(code)||!name)throw new Error('Voie sans commune valide.');
 const key=`${code}:${id}`;
 if(localAddresses.has(key))return localAddresses.get(key);
 const safe=s=>String(s).replaceAll("'","''");
 const filter=/^33\d{3}_[\w-]+$/.test(id)?`code_insee='${code}' AND id_fantoir='${safe(id)}'`:`code_insee='${code}' AND nom_voie='${safe(name)}'`;
 let collection=await wfsCollection('BAN.DATA.GOUV:ban',filter,{limit:800,pageSize:400});
 // Certaines voies BD TOPO n'ont pas d'identifiant repris dans BAN.
 if(!collection.features.length&&filter.includes('id_fantoir='))
  collection=await wfsCollection('BAN.DATA.GOUV:ban',`code_insee='${code}' AND nom_voie='${safe(name)}'`,{limit:800,pageSize:400});
 const addresses=normalizeBanAddresses(collection.features,code,{id,name});
 const result={features:addresses,source:'Base Adresse Nationale · WFS IGN',asOf:new Date().toISOString(),matched:collection.numberMatched};
 localAddresses.set(key,result);return result;
}
