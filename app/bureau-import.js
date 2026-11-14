import {validPolygon} from './geo-utils.js';

const MAX_KML_BYTES = 2_000_000;
const MAX_ARCHIVE_ENTRIES = 128;
const MAX_FEATURES = 500;

export function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

async function inflateRawBounded(bytes, declaredSize) {
  if (typeof DecompressionStream !== 'function') throw new Error('Décompression KMZ indisponible dans ce navigateur.');
  const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      length += value.length;
      if (length > MAX_KML_BYTES || length > declaredSize) throw new Error('Taille KML extraite incohérente ou excessive.');
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  }
  if (length !== declaredSize) throw new Error('Taille KML extraite incohérente.');
  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  return result;
}

export async function extractKmlFromKmz(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.length < 22 || bytes.length > 4_000_000) throw new Error('Archive KMZ vide ou supérieure à 4 Mo.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let pos = bytes.length - 22; pos >= Math.max(0, bytes.length - 65_557); pos--) {
    if (view.getUint32(pos, true) === 0x06054b50 && pos + 22 + view.getUint16(pos + 20, true) === bytes.length) { end = pos; break; }
  }
  if (end < 0 || view.getUint16(end + 4, true) || view.getUint16(end + 6, true)) throw new Error('Archive KMZ invalide ou multi-disques.');
  const count = view.getUint16(end + 10, true);
  const centralSize = view.getUint32(end + 12, true);
  const centralOffset = view.getUint32(end + 16, true);
  if (!count || count > MAX_ARCHIVE_ENTRIES || count !== view.getUint16(end + 8, true) ||
      centralOffset + centralSize > end) throw new Error('Index KMZ invalide ou trop volumineux.');
  let pos = centralOffset;
  const kmlEntries = [];
  for (let i = 0; i < count; i++) {
    if (pos + 46 > centralOffset + centralSize || view.getUint32(pos, true) !== 0x02014b50) throw new Error('Index KMZ corrompu.');
    const flags = view.getUint16(pos + 8, true), method = view.getUint16(pos + 10, true);
    const checksum = view.getUint32(pos + 16, true), compressedSize = view.getUint32(pos + 20, true);
    const size = view.getUint32(pos + 24, true), nameLength = view.getUint16(pos + 28, true);
    const extraLength = view.getUint16(pos + 30, true), commentLength = view.getUint16(pos + 32, true);
    const localOffset = view.getUint32(pos + 42, true);
    const next = pos + 46 + nameLength + extraLength + commentLength;
    if (next > centralOffset + centralSize) throw new Error('Nom KMZ invalide.');
    const name = new TextDecoder('utf-8', {fatal:true}).decode(bytes.subarray(pos + 46, pos + 46 + nameLength));
    if (/\.kml$/i.test(name)) kmlEntries.push({name,flags,method,checksum,compressedSize,size,localOffset});
    pos = next;
  }
  if (pos !== centralOffset + centralSize || kmlEntries.length !== 1) throw new Error('Le KMZ doit contenir un seul fichier KML.');
  const entry = kmlEntries[0];
  if (entry.name.startsWith('/') || entry.name.includes('..') || entry.name.includes('\\') ||
      entry.flags & 1 || ![0,8].includes(entry.method) || entry.size > MAX_KML_BYTES ||
      !entry.size || entry.localOffset + 30 > centralOffset) throw new Error('Entrée KML du KMZ non prise en charge.');
  const local = entry.localOffset;
  if (view.getUint32(local, true) !== 0x04034b50 || view.getUint16(local + 8, true) !== entry.method) throw new Error('Entrée KML du KMZ corrompue.');
  const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
  if (start + entry.compressedSize > centralOffset) throw new Error('Entrée KML hors archive.');
  const compressed = bytes.subarray(start, start + entry.compressedSize);
  const extracted = entry.method === 0 ? compressed : await inflateRawBounded(compressed, entry.size);
  if (extracted.length !== entry.size || crc32(extracted) !== entry.checksum) throw new Error('Contrôle d’intégrité du KMZ échoué.');
  return new TextDecoder('utf-8', {fatal:true}).decode(extracted);
}

function children(element, localName) {
  return Array.from(element?.children || []).filter(child => child.localName === localName);
}
function firstChild(element, localName) { return children(element, localName)[0]; }
function ringFrom(boundary) {
  const text = firstChild(firstChild(boundary, 'LinearRing'), 'coordinates')?.textContent?.trim();
  if (!text) throw new Error('Anneau KML sans coordonnées.');
  const ring = text.split(/\s+/).map(tuple => {
    const parts = tuple.split(',');
    if (parts.length < 2 || parts.length > 3 || parts[0] === '' || parts[1] === '') throw new Error('Coordonnées KML invalides.');
    return [Number(parts[0]), Number(parts[1])];
  });
  if (ring.length > 1000) throw new Error('Anneau KML trop détaillé.');
  if (ring[0]?.[0] !== ring.at(-1)?.[0] || ring[0]?.[1] !== ring.at(-1)?.[1]) ring.push([...ring[0]]);
  if (!validPolygon({type:'Polygon',coordinates:[ring]})) throw new Error('Contour KML invalide.');
  return ring;
}

export function parseBureauKml(text, commune, communes) {
  if (!commune) throw new Error('Choisissez la commune des bureaux avant un import KML/KMZ.');
  if (text.length > MAX_KML_BYTES || /<!DOCTYPE|<!ENTITY/i.test(text)) throw new Error('KML trop volumineux ou déclaration externe interdite.');
  if (typeof DOMParser !== 'function') throw new Error('Lecture KML indisponible dans ce navigateur.');
  const code = communes.find(row => row.nom === commune)?.codeInsee;
  if (!code) throw new Error('Commune absente du référentiel.');
  const xml = new DOMParser().parseFromString(text,'application/xml');
  if (Array.from(xml.getElementsByTagName('*')).some(node => node.localName === 'parsererror')) throw new Error('XML KML invalide.');
  const placemarks = Array.from(xml.getElementsByTagName('*')).filter(node => node.localName === 'Placemark');
  if (!placemarks.length || placemarks.length > MAX_FEATURES) throw new Error('Le KML doit contenir de 1 à 500 repères.');
  const features = [];
  for (const placemark of placemarks) {
    const polygons = Array.from(placemark.getElementsByTagName('*')).filter(node => node.localName === 'Polygon');
    if (!polygons.length) continue;
    const name = firstChild(placemark, 'name')?.textContent?.trim() || '';
    const match = name.match(/(?:bureau(?:\s+de\s+vote)?|BV)\s*(?:n[°o.]?\s*)?(\d{1,3})\b/i);
    const number = match ? Number(match[1]) : NaN;
    if (!Number.isInteger(number) || number < 1) throw new Error(`Numéro de bureau absent du nom « ${name.slice(0,80)} ».`);
    const coordinates = polygons.map(polygon => {
      const outer = firstChild(polygon, 'outerBoundaryIs');
      if (!outer) throw new Error('Polygone KML sans limite extérieure.');
      return [ringFrom(outer),...children(polygon,'innerBoundaryIs').map(ringFrom)];
    });
    features.push({type:'Feature',properties:{id:`${code}-${number}`,codeInsee:code,commune,numero:number,nom:name.slice(0,120)},
      geometry:coordinates.length === 1 ? {type:'Polygon',coordinates:coordinates[0]} : {type:'MultiPolygon',coordinates}});
  }
  if (!features.length) throw new Error('Aucun contour de bureau dans le KML.');
  return {type:'FeatureCollection',features};
}

function validBureauGeometry(geometry) {
  const polygons = geometry?.type === 'Polygon' ? [geometry.coordinates] :
    geometry?.type === 'MultiPolygon' ? geometry.coordinates : null;
  return Array.isArray(polygons) && polygons.length > 0 && polygons.length <= 100 &&
    polygons.every(rings => Array.isArray(rings) && rings.length > 0 && rings.length <= 50 &&
      rings.every(ring => validPolygon({type:'Polygon',coordinates:[ring]})));
}

export function validateBureauImport(data, communes, {commune = '',source = '',fileName = '',importedAt = new Date().toISOString()} = {}) {
  if (data?.type !== 'FeatureCollection' || !Array.isArray(data.features) || !data.features.length || data.features.length > MAX_FEATURES)
    throw new Error('Collection de bureaux invalide (1 à 500 contours attendus).');
  const byCode = new Map(communes.map(row => [String(row.codeInsee), row.nom]));
  const selectedCode = communes.find(row => row.nom === commune)?.codeInsee;
  const ids = new Set();
  const features = data.features.map(feature => {
    const p = feature?.properties || {};
    const code = String(p.codeInsee || p.communeCode || selectedCode || '');
    if (!byCode.has(code) || selectedCode && selectedCode !== code) throw new Error('Commune du contour absente ou différente de la sélection.');
    const number = Number(p.numero || p.bureau);
    const id = String(p.id || p.code || (Number.isInteger(number) && number > 0 ? `${code}-${number}` : ''));
    if (!id || id.length > 120 || ids.has(id) || !validBureauGeometry(feature.geometry))
      throw new Error(`Identifiant en doublon ou contour de bureau invalide : ${id || '?'}.`);
    ids.add(id);
    return {type:'Feature',geometry:feature.geometry,properties:{
      id,codeInsee:code,commune:byCode.get(code),numero:Number.isInteger(number)&&number>0?number:null,
      nom:String(p.nom || p.name || `Bureau ${number || id}`).slice(0,120),
      source:String(source || p.source || `Fichier local : ${fileName}`).slice(0,200),sourceFile:String(fileName || p.sourceFile || '').slice(0,120),
      importedAt:p.importedAt || importedAt,validationStatus:'À confirmer',originStatus:'Fourni localement'
    }};
  });
  return {type:'FeatureCollection',features};
}

export async function readBureauFile(file, communes, options = {}) {
  if (!file || file.size > 4_000_000) throw new Error('Fichier absent ou supérieur à 4 Mo.');
  const name = file.name.toLowerCase();
  let data;
  if (name.endsWith('.kmz')) data = parseBureauKml(await extractKmlFromKmz(await file.arrayBuffer()),options.commune,communes);
  else if (name.endsWith('.kml')) data = parseBureauKml(await file.text(),options.commune,communes);
  else if (name.endsWith('.geojson') || name.endsWith('.json')) {
    try { data = JSON.parse(await file.text()); } catch { throw new Error('JSON de bureaux invalide.'); }
  } else throw new Error('Format accepté : GeoJSON, KML ou KMZ.');
  return validateBureauImport(data,communes,{...options,fileName:file.name});
}
