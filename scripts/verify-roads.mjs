import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';

const dataDir=resolve(import.meta.dirname,'../data');
const territory=JSON.parse(await readFile(resolve(dataDir,'territoire-33-11-2026.json'),'utf8'));
const manifest=JSON.parse(await readFile(resolve(dataDir,'voies-manifest.json'),'utf8'));
const expected=new Set(territory.communes.map(c=>c.codeInsee));
const codes=new Set();let count=0;
if(expected.size!==87||manifest.communes.length!==87||manifest.meta.failed!==0||manifest.meta.successful!==87)throw new Error('Couverture communale incomplète.');
for(const row of manifest.communes){
 if(!expected.has(row.code)||codes.has(row.code)||row.status!=='ok'||row.file!==`data/voies-${row.code}.geojson.gz`)throw new Error(`Entrée de manifeste invalide : ${row.code}`);
 codes.add(row.code);
 const compressed=await readFile(resolve(dataDir,row.file.slice(5)));
 if(compressed.length!==row.compressedBytes)throw new Error(`Taille compressée incohérente : ${row.code}`);
 if(createHash('sha256').update(compressed).digest('hex')!==row.sha256)throw new Error(`Empreinte SHA-256 incohérente : ${row.code}`);
 const collection=JSON.parse(gunzipSync(compressed));
 if(collection.type!=='FeatureCollection'||collection.meta.commune!==row.code||collection.features.length!==row.count||collection.meta.numberMatched!==row.matched)throw new Error(`Comptage incohérent : ${row.code}`);
 const ids=new Set();
 for(const feature of collection.features){
  const {id,name,code}=feature.properties||{};
  const geometry=feature.geometry;
  const parts=geometry?.type==='MultiLineString'?geometry.coordinates:geometry?.type==='LineString'?[geometry.coordinates]:null;
  if(!id||!name||code!==row.code||ids.has(id)||!Array.isArray(parts)||!parts.length||parts.some(line=>!Array.isArray(line)||line.length<2||line.some(point=>!Array.isArray(point)||point.length<2||!point.slice(0,2).every(Number.isFinite))))throw new Error(`Voie invalide ou en doublon : ${row.code}/${id}`);
  ids.add(id);
 }
 count+=ids.size;
}
if(codes.size!==87)throw new Error('Code commune manquant.');
console.log(`Paquet vérifié : ${codes.size} communes, ${count} géométries de voies nommées, aucun identifiant dupliqué.`);
