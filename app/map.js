import {norm,escapeHTML} from './core.js';

const GEO_KEY='democraction-33-geo-v2';
const CONTOUR_KEY='democraction-33-contours-v1';
const maps=new Map();
const mapLayers=new Map();
let currentGeo=[];
let currentContours=[];
let loadingLeaflet=null;

function ensureLeaflet(){
 if(window.L)return Promise.resolve(window.L);
 if(loadingLeaflet)return loadingLeaflet;
 loadingLeaflet=new Promise((resolve,reject)=>{
  const css=document.createElement('link');
  css.rel='stylesheet';css.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  css.integrity='sha256-p4NxAoJBhIIN+hmNHrzxL8Qd6uH9QbCNl8JLf7DqQ70=';css.crossOrigin='anonymous';
  document.head.appendChild(css);
  const fallback=document.createElement('style');
  fallback.textContent='.leaflet-container{overflow:hidden;position:relative}.leaflet-pane,.leaflet-tile,.leaflet-marker-icon,.leaflet-marker-shadow,.leaflet-tile-container,.leaflet-map-pane svg,.leaflet-map-pane canvas{position:absolute;left:0;top:0}.leaflet-pane{z-index:400}.leaflet-tile-pane{z-index:200}.leaflet-overlay-pane{z-index:400}.leaflet-shadow-pane{z-index:500}.leaflet-marker-pane{z-index:600}.leaflet-tooltip-pane{z-index:650}.leaflet-popup-pane{z-index:700}.leaflet-control{position:relative;z-index:800}.leaflet-top,.leaflet-bottom{position:absolute;z-index:1000;pointer-events:none}.leaflet-top{top:0}.leaflet-right{right:0}.leaflet-left{left:0}.leaflet-bottom{bottom:0}.leaflet-top .leaflet-control{margin-top:10px}.leaflet-bottom .leaflet-control{margin-bottom:10px}.leaflet-left .leaflet-control{margin-left:10px}.leaflet-right .leaflet-control{margin-right:10px}.leaflet-control{float:left;clear:both}.leaflet-right .leaflet-control{float:right}.leaflet-tile{max-width:none!important;max-height:none!important}';
  document.head.appendChild(fallback);
  const js=document.createElement('script');js.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
  js.integrity='sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';js.crossOrigin='anonymous';
  js.onload=()=>window.L?resolve(window.L):reject(new Error('Librairie cartographique absente'));
  js.onerror=()=>reject(new Error('Librairie cartographique non téléchargée'));
  document.head.appendChild(js);
 }).catch(e=>{loadingLeaflet=null;throw e});
 return loadingLeaflet;
}

function asFeatureList(data){
 if(data?.type==='FeatureCollection')return data.features||[];
 if(Array.isArray(data))return data.map(row=>({type:'Feature',geometry:row.contour||row.geometry||null,properties:row})).filter(f=>f.geometry);
 return [];
}
function validCoordinates(value){if(!Array.isArray(value)||value.length<2)return false;if(typeof value[0]==='number'||typeof value[0]==='string'&&value[0].trim()!==''){return Number.isFinite(Number(value[0]))&&Number.isFinite(Number(value[1]))}return value.every(validCoordinates)}
function validFeature(feature){return Boolean(feature?.geometry?.type&&validCoordinates(feature.geometry.coordinates))}

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

export async function loadContours(communes=[]){
 const codes=communes.map(c=>c.codeInsee).filter(Boolean).sort();
 const requested=codes.join(',');
 if(currentContours.length&&currentContours._requested===requested)return currentContours;
 try{const cached=JSON.parse(localStorage.getItem(CONTOUR_KEY)||'null');if(cached&&cached.requested===requested&&Date.now()-cached.at<1000*3600*24*30){currentContours=cached.data;currentContours._requested=requested;return currentContours}}catch{}
 const params=new URLSearchParams();codes.forEach(code=>params.append('code',code));
 params.set('fields','nom,code,centre');params.set('format','geojson');params.set('geometry','contour');
 let features=[];
 try{
  const r=await fetch(`https://geo.api.gouv.fr/communes?${params.toString()}`,{mode:'cors'});
  if(!r.ok)throw new Error(`Réponse contours ${r.status}`);
  features=asFeatureList(await r.json()).filter(validFeature);
 }catch{
  const batches=[];
  for(let i=0;i<codes.length;i+=8)batches.push(codes.slice(i,i+8));
  const responses=await Promise.all(batches.map(async batch=>{
   const p=new URLSearchParams();batch.forEach(code=>p.append('code',code));p.set('fields','nom,code,centre');p.set('format','geojson');p.set('geometry','contour');
   try{const r=await fetch(`https://geo.api.gouv.fr/communes?${p.toString()}`,{mode:'cors'});return r.ok?asFeatureList(await r.json()):[]}catch{return []}
  }));
  features=responses.flat().filter(validFeature);
 }
 currentContours=features;currentContours._requested=requested;
 try{localStorage.setItem(CONTOUR_KEY,JSON.stringify({at:Date.now(),requested,data:features}))}catch{}
 return currentContours;
}

function colour(value,selected){
 if(selected)return {color:'#143c37',fillColor:'#e4bd6d',fillOpacity:.82,weight:3};
 const n=Number(value);if(!Number.isFinite(n))return {color:'#67857d',fillColor:'#bfd8ce',fillOpacity:.32,weight:1.2};
 return {color:'#507d72',fillColor:n>=70?'#155e75':n>=55?'#267b76':n>=40?'#d97706':'#b91c1c',fillOpacity:.48,weight:1.4};
}

function addDrawingTools(box,map,target,options){
 const tools=document.createElement('div');tools.className='map-overlay-tools';
 tools.innerHTML='<button type="button" class="btn btn-light btn-sm" data-map-draw-start>Dessiner un secteur</button><button type="button" class="btn btn-primary btn-sm" data-map-draw-finish disabled>Terminer</button><button type="button" class="btn btn-light btn-sm" data-map-draw-cancel disabled>Annuler</button>';
 box.appendChild(tools);
 let drawing=false,points=[],preview=null;
 const start=()=>{drawing=true;points=[];preview?.remove();preview=null;tools.querySelector('[data-map-draw-start]').disabled=true;tools.querySelector('[data-map-draw-finish]').disabled=false;tools.querySelector('[data-map-draw-cancel]').disabled=false;tools.classList.add('active');map.getContainer().classList.add('map-drawing');options.onNotice?.('Cliquez au moins trois points sur la carte pour dessiner le secteur.');};
 const cancel=()=>{drawing=false;points=[];preview?.remove();preview=null;tools.querySelector('[data-map-draw-start]').disabled=false;tools.querySelector('[data-map-draw-finish]').disabled=true;tools.querySelector('[data-map-draw-cancel]').disabled=true;tools.classList.remove('active');map.getContainer().classList.remove('map-drawing');};
 const finish=()=>{if(points.length<3){options.onNotice?.('Ajoutez au moins trois points avant d’enregistrer le secteur.','warning');return}const coordinates=points.map(p=>[p.lng,p.lat]);coordinates.push(coordinates[0]);options.onSectorComplete?.({type:'Polygon',coordinates:[coordinates]});cancel();};
 tools.querySelector('[data-map-draw-start]').addEventListener('click',start);tools.querySelector('[data-map-draw-finish]').addEventListener('click',finish);tools.querySelector('[data-map-draw-cancel]').addEventListener('click',cancel);
 map.on('click',e=>{if(!drawing)return;points.push(e.latlng);preview?.remove();preview=window.L.polygon(points,{color:'#b47c2d',weight:2,dashArray:'5 5',fillColor:'#e4bd6d',fillOpacity:.25}).addTo(map);});
}

export async function drawMap(target,communes,notify,options={}){
 const previous=maps.get(target);if(previous){previous.remove();maps.delete(target)}
 const box=document.getElementById(target);if(!box)return;
 box.innerHTML='<div class="map-loading">Chargement des contours communaux officiels…</div>';
 try{
  await ensureLeaflet();
  const [coords,contours]=await Promise.all([loadGeodata(),loadContours(communes)]);
  if(!document.getElementById(target))return;
  box.innerHTML='';const map=window.L.map(box,{zoomControl:true,scrollWheelZoom:true});maps.set(target,map);
  const ign='https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&FORMAT=image/png&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}';
  window.L.tileLayer(ign,{attribution:'© <a href="https://www.ign.fr/" target="_blank" rel="noopener noreferrer">IGN</a> — données géographiques françaises',maxZoom:18}).addTo(map);
  const coordIndex=new Map(coords.map(c=>[String(c.code||''),c]));
  const contourIndex=new Map(contours.map(f=>[String(f.properties?.code||''),f]));
  const group=window.L.featureGroup(),fitPoints=[],selection=new Set((options.selectedNames||[]).map(norm));
  const byName=new Map(communes.map(c=>[norm(c.nom),c]));
  for(const c of communes){
   const code=String(c.codeInsee||'');const feature=contourIndex.get(code);const selected=selection.has(norm(c.nom));
   if(feature&&validFeature(feature)){try{
    const layer=window.L.geoJSON(feature,{style:colour(c.mapValue,selected),onEachFeature:(_,polygon)=>{
     polygon.bindTooltip(`${escapeHTML(c.nom)} · ${escapeHTML(c.mapLabel||'Donnée indisponible')}`,{sticky:true});
     polygon.bindPopup(`<strong>${escapeHTML(c.nom)}</strong><div>${escapeHTML(c.epci||'')}</div><div>${escapeHTML(c.mapLabel||'Donnée indisponible')}</div><small>Contour communal officiel · Source : geo.api.gouv.fr</small>`);
     polygon.on('click',event=>options.onSelect?.(c,event));
    }}).addTo(map);group.addLayer(layer);
   }catch{}}
   const point=coordIndex.get(code)?.centre?.coordinates;const lat=Number(point?.[1]),lon=Number(point?.[0]);if(Number.isFinite(lat)&&Number.isFinite(lon)){fitPoints.push([lat,lon]);
    const marker=window.L.circleMarker([lat,lon],{radius:selected?4:2,weight:1,color:'#fff',fillColor:'#173f39',fillOpacity:.8});
    marker.bindTooltip(escapeHTML(c.nom));marker.addTo(map);group.addLayer(marker);
   }
  }
  for(const sector of options.sectors||[]){if(!sector.geometry)continue;window.L.geoJSON(sector.geometry,{style:{color:sector.color||'#9c6b2a',weight:3,dashArray:'7 5',fillColor:sector.color||'#e4bd6d',fillOpacity:.2}}).addTo(map);}
  for(const street of options.streets||[]){if(Number.isFinite(Number(street.lat))&&Number.isFinite(Number(street.lon)))window.L.circleMarker([Number(street.lat),Number(street.lon)],{radius:6,weight:2,color:'#fff',fillColor:'#6d3e8c',fillOpacity:.95}).addTo(map).bindPopup(`<strong>${escapeHTML(street.name)}</strong><small>Voie sélectionnée · API Adresse</small>`);}
  if(fitPoints.length)map.fitBounds(fitPoints,{maxZoom:12,paddingTopLeft:[18,18],paddingBottomRight:[18,18]});else map.setView([45.07,-0.48],9);
  addDrawingTools(box,map,target,options);
  setTimeout(()=>map.invalidateSize(),150);
  notify?.(`Contours affichés : ${contours.length} / ${communes.length} communes.`,contours.length?'info':'warning');
 }catch(e){box.innerHTML='<div class="map-loading">Les contours ne sont pas disponibles. Vérifiez la connexion à l’API géographique ; la liste des communes reste utilisable.</div>';notify?.(String(e.message||e),'warning')}
}

export function locate(){const map=[...maps.values()][0];if(!map)return false;if(!navigator.geolocation)return false;navigator.geolocation.getCurrentPosition(p=>{const {latitude,longitude}=p.coords;window.L.marker([latitude,longitude]).addTo(map).bindPopup('Position ponctuelle (non enregistrée)').openPopup();map.setView([latitude,longitude],13)},()=>{alert('Géolocalisation refusée ou indisponible. Aucune position n’est stockée.')},{enableHighAccuracy:false,timeout:10000});return true}
