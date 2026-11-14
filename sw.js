const CACHE = 'democraction-demo-v50';
const SHELL = ['./','./index.html','./manifest.webmanifest','./assets/style.css','./assets/icon.svg','./assets/vendor/leaflet.js','./assets/vendor/leaflet.css','./assets/vendor/images/marker-icon.png','./assets/vendor/images/marker-icon-2x.png','./assets/vendor/images/marker-shadow.png','./app/main.js','./app/public-data-v3.js','./app/core.js','./app/geo-utils.js','./app/roads.js','./app/polling-stations.js','./app/store.js','./app/xlsx.js','./app/map.js','./app/sync.js','./data/territoire-33-11-2026.json','./data/street-catalog-33366.json','./data/voies-33366.geojson','./data/bureaux-referentiel-23.json','./data/socio-demographie-v3.json','./data/elections-2008-2026.json.gz','./data/communes-33-11.geojson'];
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)));
 self.skipWaiting();
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))));
 self.clients.claim();
});
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET')return;
 const url=new URL(event.request.url);
 const refresh=event.request.mode==='navigate'||(url.origin===self.location.origin&&(/\/app\//.test(url.pathname)||/\/assets\/style\.css$/.test(url.pathname)));
 if(refresh){
  event.respondWith(fetch(event.request).then(async response=>{
   if(response.ok){const cache=await caches.open(CACHE);await cache.put(event.request,response.clone())}
   return response;
  }).catch(()=>caches.match(event.request)));
 }else event.respondWith(caches.match(event.request).then(hit=>hit||fetch(event.request)));
});
