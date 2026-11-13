import {norm,escapeHTML} from './core.js';
const GEO_KEY='democraction-33-centres-v1';
let leafletMap=null;
let currentMarkers=[];
let currentGeo=[];
let loadingLeaflet=null;
function ensureLeaflet(){
 if(window.L)return Promise.resolve(window.L);
 if(loadingLeaflet)return loadingLeaflet;
 loadingLeaflet=new Promise((resolve,reject)=>{
  const css=document.createElement('link');css.rel='stylesheet';css.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';css.integrity='sha256-p4NxAoJBhIIN+hmNHrzxL8Qd6uH9QbCNl8JLf7DqQ70=';css.crossOrigin='anonymous';document.head.appendChild(css);const fallback=document.createElement('style');fallback.textContent='.leaflet-container{overflow:hidden;position:relative}.leaflet-pane,.leaflet-tile,.leaflet-marker-icon,.leaflet-marker-shadow,.leaflet-tile-container,.leaflet-map-pane svg,.leaflet-map-pane canvas{position:absolute;left:0;top:0}.leaflet-pane{z-index:400}.leaflet-tile-pane{z-index:200}.leaflet-overlay-pane{z-index:400}.leaflet-shadow-pane{z-index:500}.leaflet-marker-pane{z-index:600}.leaflet-tooltip-pane{z-index:650}.leaflet-popup-pane{z-index:700}.leaflet-control{position:relative;z-index:800}.leaflet-top,.leaflet-bottom{position:absolute;z-index:1000;pointer-events:none}.leaflet-top{top:0}.leaflet-right{right:0}.leaflet-left{left:0}.leaflet-bottom{bottom:0}.leaflet-top .leaflet-control{margin-top:10px}.leaflet-bottom .leaflet-control{margin-bottom:10px}.leaflet-left .leaflet-control{margin-left:10px}.leaflet-right .leaflet-control{margin-right:10px}.leaflet-control{float:left;clear:both}.leaflet-right .leaflet-control{float:right}.leaflet-tile{max-width:none!important;max-height:none!important}';document.head.appendChild(fallback);
  const js=document.createElement('script');js.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';js.integrity='sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';js.crossOrigin='anonymous';js.onload=()=>window.L?resolve(window.L):reject(new Error('Librairie cartographique absente'));js.onerror=()=>reject(new Error('Librairie cartographique non téléchargée'));document.head.appendChild(js);
 }).catch(e=>{loadingLeaflet=null;throw e});
 return loadingLeaflet;
}
export async function loadGeodata(){
 if(currentGeo.length)return currentGeo;
 try{const cached=JSON.parse(localStorage.getItem(GEO_KEY)||'null');if(cached&&Date.now()-cached.at<1000*3600*24*30){currentGeo=cached.data;return currentGeo}}catch{}
 const endpoints=[
  'https://geo.api.gouv.fr/departements/33/communes?fields=nom,code,centre,codeEpci',
  'https://geo.api.gouv.fr/communes?codeDepartement=33&fields=nom,code,centre,codeEpci'
 ];
 let last;
 for(const endpoint of endpoints){
  try{const r=await fetch(endpoint,{mode:'cors'});if(!r.ok)throw new Error(`Réponse ${r.status}`);const data=await r.json();if(!Array.isArray(data)||data.length<300)throw new Error('Référentiel incomplet');currentGeo=data;try{localStorage.setItem(GEO_KEY,JSON.stringify({at:Date.now(),data}))}catch{}return currentGeo}catch(e){last=e}
 }
 throw last||new Error('API géographique indisponible');
}
export async function drawMap(target,communes,notify){
 if(leafletMap){leafletMap.remove();leafletMap=null}
 const box=document.getElementById(target);if(!box)return;
 box.innerHTML='<div class="map-loading">Chargement de la cartographie publique…</div>';
 try{
  await ensureLeaflet();
  const coords=await loadGeodata();
  if(!document.getElementById(target))return;
  box.innerHTML='';leafletMap=window.L.map(box,{zoomControl:true,scrollWheelZoom:false});
  // Fond de carte public de l'IGN français (API Géoplateforme, WMTS libre d'accès).
  // Les tuiles restent hébergées par l'IGN : aucun service cartographique américain requis.
  const ign='https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&FORMAT=image/png&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}';
  window.L.tileLayer(ign,{attribution:'© <a href="https://www.ign.fr/" target="_blank" rel="noopener noreferrer">IGN</a> — données géographiques françaises',maxZoom:18}).addTo(leafletMap);
  const index=new Map(coords.map(c=>[norm(c.nom),c]));currentMarkers=[];
  for(const c of communes){
    const geo=index.get(norm(c.nom));const pt=geo?.centre?.coordinates;
    if(!pt||pt.length<2)continue;
    const point=[pt[1],pt[0]];
    const value=Number(c.mapValue);const fill=value>=70?'#155e75':value>=55?'#267b76':value>=40?'#d97706':'#b91c1c';const marker=window.L.circleMarker(point,{radius:7,weight:2,color:'#f7faf9',fillColor:fill,fillOpacity:0.9});
    marker.bindPopup(`<strong>${escapeHTML(c.nom)}</strong><div>${escapeHTML(c.epci)}</div><div>${escapeHTML(c.mapLabel||'Carte de mobilisation')}</div><small>Centre de commune approximatif — ne constitue pas une adresse</small>`);
    marker.addTo(leafletMap);currentMarkers.push(marker);
  }
  if(currentMarkers.length){const group=window.L.featureGroup(currentMarkers);leafletMap.fitBounds(group.getBounds().pad(.16),{maxZoom:11})}
  else leafletMap.setView([45.07,-0.48],9);
  setTimeout(()=>leafletMap?.invalidateSize(),150);
  notify?.(`Centres géographiques publics chargés : ${currentMarkers.length} / ${communes.length}.`);
 }catch(e){box.innerHTML='<div class="map-loading">Impossible de charger les centres géographiques. La liste des communes et les filtres restent utilisables sans connexion.</div>';notify?.(String(e.message||e),'warning')}
}
export function locate(){if(!leafletMap)return false;if(!navigator.geolocation)return false;navigator.geolocation.getCurrentPosition(p=>{const {latitude,longitude}=p.coords;window.L.marker([latitude,longitude]).addTo(leafletMap).bindPopup('Position ponctuelle (non enregistrée)').openPopup();leafletMap.setView([latitude,longitude],13)},()=>{alert('Géolocalisation refusée ou indisponible. Aucune position n’est stockée.')},{enableHighAccuracy:false,timeout:10000});return true}
