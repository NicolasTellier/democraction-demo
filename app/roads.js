import {norm} from './core.js';

const WFS='https://data.geopf.fr/wfs/ows';
const localRoads=new Map();
const localAddresses=new Map();
const MAX_ROADS=4000;

function line(geometry){
 const parts=geometry?.type==='LineString'?[geometry.coordinates]:geometry?.type==='MultiLineString'?geometry.coordinates:null;
 return Array.isArray(parts)&&parts.length>0&&parts.every(points=>Array.isArray(points)&&points.length>=2&&points.every(p=>Array.isArray(p)&&p.length>=2&&Number.isFinite(p[0])&&Number.isFinite(p[1])&&Math.abs(p[0])<=180&&Math.abs(p[1])<=90));
}

export function normalizeRoads(data,code){
 if(data?.type!=='FeatureCollection'||!Array.isArray(data.features))throw new Error('Réponse de voies invalide.');
 const seen=new Set(),features=[];
 for(const feature of data.features){
  const p=feature.properties||{};
  const city=String(p.code||p.insee_commune||'');
  const id=String(p.id||p.identifiant_voie_ban||p.cleabs||feature.id||'');
  const name=String(p.name||p.nom_voie_ban||p.nom_collaboratif||'').trim();
  if(city!==code||!id||!name||!line(feature.geometry)||seen.has(id))continue;
  seen.add(id);
  features.push({type:'Feature',id,geometry:feature.geometry,properties:{id,name,code:city,updated:p.updated||p.date_modification||null}});
 }
 return features.sort((a,b)=>a.properties.name.localeCompare(b.properties.name,'fr'));
}

function urlFor(type,filter,startIndex,count){
 const url=new URL(WFS);
 for(const [k,v] of Object.entries({SERVICE:'WFS',VERSION:'2.0.0',REQUEST:'GetFeature',TYPENAMES:type,OUTPUTFORMAT:'application/json',SRSNAME:'EPSG:4326',CQL_FILTER:filter,STARTINDEX:startIndex,COUNT:count}))url.searchParams.set(k,String(v));
 return url;
}

async function wfsCollection(type,filter,{limit=MAX_ROADS,pageSize=500}={}){
 const features=[];let total=Infinity;
 while(features.length<total){
  if(features.length>=limit)throw new Error(`Plus de ${limit} objets : affinez la commune ou la voie.`);
  const response=await fetch(urlFor(type,filter,features.length,Math.min(pageSize,limit-features.length)),{mode:'cors',signal:AbortSignal.timeout(25000)});
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

export async function loadRoads(code){
 if(!/^33\d{3}$/.test(String(code)))throw new Error('Code de commune invalide.');
 if(localRoads.has(code))return localRoads.get(code);
 let collection,source,asOf;
 if(code==='33366'){
  try{
   const response=await fetch(new URL('../data/voies-33366.geojson',import.meta.url));
   if(!response.ok)throw new Error(String(response.status));
   collection=await response.json();
   if(collection.features?.length!==collection.meta?.numberMatched)throw new Error('Catalogue local incomplet.');
   source='IGN BD TOPO · voie nommée · copie locale';asOf=collection.meta?.retrievedAt;
  }catch{ /* Le WFS officiel prend le relais si le paquet local n'est pas disponible. */ }
 }
 if(!collection){
  const filter=`insee_commune='${code}'`;
  collection=await wfsCollection('BDTOPO_V3:voie_nommee',filter);
  source='IGN BD TOPO · voie nommée · WFS';asOf=new Date().toISOString();
 }
 const features=normalizeRoads(collection,code);
 if(!features.length)throw new Error('Aucune géométrie linéaire exploitable pour cette commune.');
 const result={code,features,source,asOf,matched:collection.numberMatched??collection.meta?.numberMatched??features.length};
 localRoads.set(code,result);return result;
}

export function searchRoads(collection,query){
 const term=norm(query);return term?collection.features.filter(f=>norm(f.properties.name).includes(term)).slice(0,40):collection.features.slice(0,40);
}

export function roadGeometry(roads){
 const coordinates=roads.flatMap(road=>road.geometry?.type==='LineString'?[road.geometry.coordinates]:road.geometry?.type==='MultiLineString'?road.geometry.coordinates:[]);
 return coordinates.length?{type:'MultiLineString',coordinates}:null;
}

export async function loadAddressesForRoad(road){
 const {id,name,code}=road.properties||{};
 if(!/^33\d{3}$/.test(code)||!name)throw new Error('Voie sans commune valide.');
 const key=`${code}:${id}`;
 if(localAddresses.has(key))return localAddresses.get(key);
 const safe=s=>String(s).replaceAll("'","''");
 const filter=/^33\d{3}_[\w-]+$/.test(id)?`code_insee='${code}' AND id_fantoir='${safe(id)}'`:`code_insee='${code}' AND nom_voie='${safe(name)}'`;
 const collection=await wfsCollection('BAN.DATA.GOUV:ban',filter,{limit:800,pageSize:400});
 const seen=new Set(),addresses=[];
 for(const feature of collection.features){
  const p=feature.properties||{},point=feature.geometry?.coordinates;
  const addressId=String(p.id||feature.id||'');
  if(String(p.code_insee)!==code||!addressId||seen.has(addressId)||feature.geometry?.type!=='Point'||!Array.isArray(point)||point.length<2||!point.slice(0,2).every(Number.isFinite))continue;
  seen.add(addressId);
  addresses.push({id:addressId,roadId:id,roadName:name,code,number:String(p.numero||''),suffix:String(p.rep||''),postcode:String(p.code_postal||''),commune:String(p.nom_commune||''),coordinates:point.slice(0,2),certified:String(p.certification_commune)==='1'});
 }
 const result={features:addresses,source:'Base Adresse Nationale · WFS IGN',asOf:new Date().toISOString(),matched:collection.numberMatched};
 localAddresses.set(key,result);return result;
}
