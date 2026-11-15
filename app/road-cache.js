// Copies of public IGN road geometries, scoped to this browser. No addresses or people.
const DATABASE = 'democraction-public-roads-v1';
const STORE = 'communes';
const INDEX = 'inventory';
export const ROAD_CACHE_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function openDatabase() {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 2);
    request.onupgradeneeded = event => {
      const db = request.result;
      const roads = db.objectStoreNames.contains(STORE) ? request.transaction.objectStore(STORE) : db.createObjectStore(STORE,{keyPath:'code'});
      const index = db.objectStoreNames.contains(INDEX) ? request.transaction.objectStore(INDEX) : db.createObjectStore(INDEX,{keyPath:'code'});
      if (event.oldVersion === 1) roads.openCursor().onsuccess = cursorEvent => {
        const cursor = cursorEvent.target.result;
        if (!cursor) return;
        const {code,features,matched,asOf,source} = cursor.value;
        index.put({code,count:features?.length||0,matched,asOf,source});
        cursor.continue();
      };
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function transaction(storeName, mode, operation) {
  const db = await openDatabase();
  if (!db) return null;
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const request = operation(tx.objectStore(storeName));
      let result;
      request.onsuccess = () => { result = request.result; };
      request.onerror = () => reject(request.error);
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Écriture du cache interrompue.'));
    });
  } finally { db.close(); }
}

export const readRoadCache = code => transaction(STORE,'readonly',store => store.get(code));
export async function writeRoadCache(entry) {
  const db=await openDatabase();
  if(!db)return null;
  try{return await new Promise((resolve,reject)=>{
    const tx=db.transaction([STORE,INDEX],'readwrite');
    tx.objectStore(STORE).put(entry);
    tx.objectStore(INDEX).put({code:entry.code,count:entry.features.length,matched:entry.matched,asOf:entry.asOf,source:entry.source});
    tx.oncomplete=()=>resolve(entry.code);
    tx.onerror=()=>reject(tx.error);
    tx.onabort=()=>reject(tx.error||new Error('Sauvegarde des voies interrompue.'));
  })}finally{db.close()}
}
export const listRoadCache = async () => (await transaction(INDEX,'readonly',store => store.getAll())) || [];

export function roadCoverage(codes, entries, now = Date.now(), packaged = []) {
  const stored = new Map(entries.map(entry => [entry.code, entry]));
  const bundled = new Map(packaged.map(entry => [entry.code, entry]));
  return codes.map(code => {
    const packageRow = bundled.get(code);
    const row = stored.get(code);
    if (packageRow && (!row || Date.parse(packageRow.asOf) >= Date.parse(row.asOf))) {
      const count=Number(packageRow.count), matched=Number(packageRow.matched);
      return {code, state:'paquet', count, matched,
        rejected:Number.isSafeInteger(packageRow.rejected)?packageRow.rejected:Number.isSafeInteger(matched)?Math.max(0,matched-count):null,
        merged:Number.isSafeInteger(packageRow.merged)?packageRow.merged:0, asOf:packageRow.asOf};
    }
    if (code === '33366' && !row && !packageRow) return {code, state:'paquet', count:303, matched:303};
    if (!row) return {code, state:'non chargé', count:0};
    const count = Number.isSafeInteger(row.count) ? row.count : Array.isArray(row.features) ? row.features.length : 0;
    const matched = Number(row.matched);
    const stale = !Number.isFinite(Date.parse(row.asOf)) || now - Date.parse(row.asOf) > ROAD_CACHE_AGE_MS;
    return {code, state:stale?'à actualiser':'indexé', count, matched:Number.isSafeInteger(matched)?matched:null,
      rejected:Number.isSafeInteger(matched)?Math.max(0,matched-count):null, asOf:row.asOf};
  });
}
