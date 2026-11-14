import {norm,escapeHTML} from './core.js';
import {validPolygon,classification,classIndex} from './geo-utils.js';

const GEO_KEY='democraction-33-geo-v2';
const CONTOUR_KEY='democraction-33-contours-v5';
const maps=new Map();
const mapLayers=new Map();
const generations=new Map();
let currentGeo=[];
let currentContours=[];
let loadingLeaflet=null;

function ensureLeaflet(){
 if(window.L)return Promise.resolve(window.L);
 if(loadingLeaflet)return loadingLeaflet;
 loadingLeaflet=new Promise((resolve,reject)=>{
  const css=document.createElement('link');
  css.rel='stylesheet';css.href=new URL('../assets/vendor/leaflet.css',import.meta.url).href;
  document.head.appendChild(css);
  const fallback=document.createElement('style');
  fallback.textContent='.leaflet-container{overflow:hidden;position:relative}.leaflet-pane,.leaflet-tile,.leaflet-marker-icon,.leaflet-marker-shadow,.leaflet-tile-container,.leaflet-map-pane svg,.leaflet-map-pane canvas{position:absolute;left:0;top:0}.leaflet-pane{z-index:400}.leaflet-tile-pane{z-index:200}.leaflet-overlay-pane{z-index:400}.leaflet-shadow-pane{z-index:500}.leaflet-marker-pane{z-index:600}.leaflet-tooltip-pane{z-index:650}.leaflet-popup-pane{z-index:700}.leaflet-control{position:relative;z-index:800}.leaflet-top,.leaflet-bottom{position:absolute;z-index:1000;pointer-events:none}.leaflet-top{top:0}.leaflet-right{right:0}.leaflet-left{left:0}.leaflet-bottom{bottom:0}.leaflet-top .leaflet-control{margin-top:10px}.leaflet-bottom .leaflet-control{margin-bottom:10px}.leaflet-left .leaflet-control{margin-left:10px}.leaflet-right .leaflet-control{margin-right:10px}.leaflet-control{float:left;clear:both}.leaflet-right .leaflet-control{float:right}.leaflet-tile{max-width:none!important;max-height:none!important}';
  document.head.appendChild(fallback);
  const js=document.createElement('script');js.src=new URL('../assets/vendor/leaflet.js',import.meta.url).href;
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
 const codes=communes.map(c=>String(c.codeInsee||'')).filter(Boolean).sort();
 const requested=codes.join(',');
 if(currentContours.length&&currentContours._requested===requested)return currentContours;
 try{const cached=JSON.parse(localStorage.getItem(CONTOUR_KEY)||'null');if(cached&&cached.requested===requested&&Date.now()-cached.at<1000*3600*24*30){currentContours=cached.data;currentContours._requested=requested;return currentContours}}catch{}
 let features=[];
 try{
  const r=await fetch(new URL('../data/communes-33-11.geojson',import.meta.url));
  if(!r.ok)throw new Error('Contours statiques indisponibles');
  const data=await r.json();const wanted=new Set(codes);
  features=asFeatureList(data).filter(f=>wanted.has(String(f.properties?.code||''))&&validFeature(f));
 }catch{}
 if(!features.length){
  try{
   const r=await fetch('https://geo.api.gouv.fr/departements/33/communes?fields=nom,code&format=geojson&geometry=contour',{mode:'cors'});
   if(r.ok){const data=await r.json();const wanted=new Set(codes);features=asFeatureList(data).filter(f=>wanted.has(String(f.properties?.code||'')))}
  }catch{}
 }
 currentContours=features;currentContours._requested=requested;
 try{localStorage.setItem(CONTOUR_KEY,JSON.stringify({at:Date.now(),requested,data:features}))}catch{}
 return currentContours;
}

export function selectionGeometry(codes=[]){
 const wanted=new Set(codes.map(String)),parts=[];
 for(const feature of currentContours){
  if(!wanted.has(String(feature.properties?.code)))continue;
  if(feature.geometry?.type==='Polygon')parts.push(feature.geometry.coordinates);
  else if(feature.geometry?.type==='MultiPolygon')parts.push(...feature.geometry.coordinates);
 }
 return parts.length?{type:'MultiPolygon',coordinates:parts}:null;
}

function colour(value,selected,legend){
 const i=classIndex(value,legend),fill=i<0?'#c8d0d7':legend.colors[i];
 return {color:selected?'#16163f':'#5f667c',fillColor:selected?'#ffb71b':fill,fillOpacity:selected?.67:.68,weight:selected?3:1};
}

function addDrawingTools(box,map,target,options){
 const tools=document.createElement('div');tools.className='map-overlay-tools';
 tools.innerHTML='<button type="button" class="btn btn-light btn-sm" data-map-draw-start>Dessiner un secteur</button><button type="button" class="btn btn-primary btn-sm" data-map-draw-finish disabled>Enregistrer le contour</button><button type="button" class="btn btn-light btn-sm" data-map-draw-cancel disabled>Annuler</button>';
 box.appendChild(tools);
 window.L.DomEvent.disableClickPropagation(tools);
 let drawing=false,points=[],preview=null,handles=[];
 const refresh=()=>{preview?.remove();handles.forEach(h=>h.remove());handles=[];if(!points.length)return;
  preview=window.L.polygon(points,{color:'#16163f',weight:2,dashArray:'5 5',fillColor:'#ffb71b',fillOpacity:.24}).addTo(map);
  points.forEach((p,i)=>{const h=window.L.marker(p,{draggable:true,icon:window.L.divIcon({className:'sector-vertex',html:'<span></span>',iconSize:[18,18]})}).addTo(map);
   h.on('dragend',()=>{points[i]=h.getLatLng();refresh()});h.on('contextmenu',()=>{if(points.length>3){points.splice(i,1);refresh()}});handles.push(h)});
  if(points.length>1)points.forEach((p,i)=>{const next=points[(i+1)%points.length];const mid=window.L.latLng((p.lat+next.lat)/2,(p.lng+next.lng)/2);
   const h=window.L.marker(mid,{icon:window.L.divIcon({className:'sector-midpoint',html:'<span>+</span>',iconSize:[16,16]})}).addTo(map);
   h.on('click',e=>{window.L.DomEvent.stopPropagation(e);points.splice(i+1,0,mid);refresh()});handles.push(h)});
 };
 const start=()=>{drawing=true;points=[];refresh();tools.querySelector('[data-map-draw-start]').disabled=true;tools.querySelector('[data-map-draw-finish]').disabled=false;tools.querySelector('[data-map-draw-cancel]').disabled=false;tools.classList.add('active');map.getContainer().classList.add('map-drawing');options.onNotice?.('Cliquez trois points ou plus. Déplacez un sommet, cliquez sur + pour en ajouter, clic droit pour en supprimer.');};
 const cancel=()=>{drawing=false;points=[];refresh();tools.querySelector('[data-map-draw-start]').disabled=false;tools.querySelector('[data-map-draw-finish]').disabled=true;tools.querySelector('[data-map-draw-cancel]').disabled=true;tools.classList.remove('active');map.getContainer().classList.remove('map-drawing');};
 const finish=()=>{if(points.length<3){options.onNotice?.('Ajoutez au moins trois points.','warning');return}const coordinates=points.map(p=>[p.lng,p.lat]);coordinates.push([...coordinates[0]]);const geometry={type:'Polygon',coordinates:[coordinates]};if(!validPolygon(geometry)){options.onNotice?.('Contour invalide : vérifiez les croisements et les sommets.','warning');return}options.onSectorComplete?.(geometry,options.editSector?.id||null);cancel();};
 tools.querySelector('[data-map-draw-start]').addEventListener('click',start);tools.querySelector('[data-map-draw-finish]').addEventListener('click',finish);tools.querySelector('[data-map-draw-cancel]').addEventListener('click',cancel);
 // Capture clicks on the container: vector layers and their popups can consume
 // Leaflet's bubbled map click, especially when the selected commune fills it.
 box.addEventListener('click',event=>{
  if(!drawing||event.target.closest('.map-overlay-tools,.leaflet-control,.leaflet-marker-icon,.leaflet-popup'))return;
  event.stopPropagation();
  points.push(map.mouseEventToLatLng(event));
  refresh();
 },true);
 if(options.editSector?.geometry?.type==='Polygon'){
  start();points=options.editSector.geometry.coordinates[0].slice(0,-1).map(([lng,lat])=>window.L.latLng(lat,lng));refresh();map.fitBounds(window.L.polygon(points).getBounds().pad(.25));
 }
}

function addLegend(map,legend,options){
 const control=window.L.control({position:'bottomleft'});
 control.onAdd=()=>{const el=window.L.DomUtil.create('div','map-legend');window.L.DomEvent.disableClickPropagation(el);
  const format=n=>Number(n).toLocaleString('fr-FR',{maximumFractionDigits:1});
  let previous=legend.method==='fixed-percent'?0:null;
  const classes=legend.breaks.map((limit,i)=>{const low=previous;previous=limit;return `<span><i style="background:${legend.colors[i]}"></i>${low===null?'≤ '+format(limit):`${format(low)}–${format(limit)}`} ${escapeHTML(legend.unit)}</span>`}).join('');
  el.innerHTML=`<strong>${escapeHTML(options.legendTitle||'Indicateur')}</strong><small>${escapeHTML(options.sourceLabel||'Données agrégées')} · ${legend.method==='quantile'?'classes par quantiles':'intervalles réguliers'}</small><div>${classes}<span><i style="background:#c8d0d7"></i>Indisponible</span></div>`;return el};control.addTo(map);
}

export async function drawMap(target,communes,notify,options={}){
 const generation=(generations.get(target)||0)+1;generations.set(target,generation);
 const previous=maps.get(target);if(previous){previous.remove();maps.delete(target)}
 const box=document.getElementById(target);if(!box)return;
 const active=()=>generations.get(target)===generation&&document.getElementById(target)===box;
 box.innerHTML='<div class="map-loading">Chargement des contours communaux officiels…</div>';
 try{
  await ensureLeaflet();
  if(!active())return;
  const contours=await loadContours(communes);
  if(!active())return;
  box.innerHTML='';const map=window.L.map(box,{zoomControl:true,scrollWheelZoom:true}).setView([45.07,-0.48],9);maps.set(target,map);
  const ign='https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&FORMAT=image/png&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}';
  window.L.tileLayer(ign,{attribution:'© <a href="https://www.ign.fr/" target="_blank" rel="noopener noreferrer">IGN</a> — données géographiques françaises',maxZoom:18}).addTo(map);
  const contourIndex=new Map(contours.map(f=>[String(f.properties?.code||''),f]));
  const group=window.L.featureGroup(),selectedGroup=window.L.featureGroup(),selection=new Set((options.selectedNames||[]).map(norm));
  const legend=classification(options.legendValues||communes.map(c=>c.mapValue),{unit:options.legendUnit||'%',method:options.legendMethod||'quantile'});
  let rendered=0;
  for(const c of communes){
   const code=String(c.codeInsee||'');const feature=contourIndex.get(code);const selected=selection.has(norm(c.nom));
   if(feature){try{
    const layer=window.L.geoJSON(feature,{style:colour(c.mapValue,selected,legend),onEachFeature:(_,polygon)=>{
     polygon.bindTooltip(`${escapeHTML(c.nom)} · ${escapeHTML(c.mapLabel||'Donnée indisponible')}`,{sticky:true});
     polygon.bindPopup(`<strong>${escapeHTML(c.nom)}</strong><div>${escapeHTML(c.epci||'')}</div><div>${escapeHTML(c.mapLabel||'Donnée indisponible')}</div><small>Contour communal officiel · Source : geo.api.gouv.fr</small>`);
     polygon.on('click',event=>{if(!map.getContainer().classList.contains('map-drawing'))options.onSelect?.(c,event)});
    }}).addTo(map);group.addLayer(layer);if(selected)selectedGroup.addLayer(layer);rendered++;
   }catch(error){notify?.(`Contour ${c.nom} invalide : ${error.message}`,'warning')}}
  }
  for(const bureau of options.bureauFeatures||[]){if(!validFeature(bureau))continue;const p=bureau.properties||{},key=String(p.id||p.code||p.bureau||''),selected=(options.selectedBureauIds||[]).includes(key);const layer=window.L.geoJSON(bureau,{style:{color:selected?'#ee4b23':'#7a1838',weight:selected?3:1.2,dashArray:selected?null:'4 4',fillColor:selected?'#ffb71b':'#7a1838',fillOpacity:selected ? .34 : .08},onEachFeature:(_,polygon)=>{polygon.bindTooltip(escapeHTML(p.nom||p.bureau||'Bureau de vote'));polygon.bindPopup('<strong>'+escapeHTML(p.nom||p.bureau||'Bureau de vote')+'</strong><small>Strate géographique · contour fourni par la collectivité</small>');polygon.on('click',e=>options.onBureauSelect?.(key,e))}}).addTo(map);if(selected)selectedGroup.addLayer(layer)}
  for(const sector of options.sectors||[]){if(!validPolygon(sector.geometry)||sector.id===options.editSector?.id)continue;const selected=options.selectedSectorId===sector.id;const layer=window.L.geoJSON(sector.geometry,{style:{color:selected?'#16163f':sector.color||'#7a1838',weight:selected?4:2,dashArray:selected?null:'7 5',fillColor:selected?'#ffb71b':sector.color||'#ffb71b',fillOpacity:selected?.5:.16},onEachFeature:(_,polygon)=>{polygon.bindTooltip(escapeHTML(sector.name||'Secteur enregistré'));polygon.on('click',e=>options.onSectorSelect?.(sector.id,e))}}).addTo(map);if(selected)selectedGroup.addLayer(layer)}
  for(const mission of options.missions||[]){if(!validFeature({geometry:mission.zoneGeometry}))continue;window.L.geoJSON(mission.zoneGeometry,{style:{color:mission.status==='Terminée'?'#2b6e46':mission.status==='En cours'?'#ee4b23':'#1e3ac8',weight:2,dashArray:'4 4',fillOpacity:.06},onEachFeature:(_,polygon)=>polygon.bindPopup(`<strong>${escapeHTML(mission.title)}</strong><div>${escapeHTML(mission.status)}</div><small>Action enregistrée localement</small>`)}).addTo(map)}
  for(const street of options.streets||[]){if(Number.isFinite(Number(street.lat))&&Number.isFinite(Number(street.lon)))window.L.circleMarker([Number(street.lat),Number(street.lon)],{radius:6,weight:2,color:'#fff',fillColor:'#6d3e8c',fillOpacity:.95}).addTo(map).bindPopup(`<strong>${escapeHTML(street.name)}</strong><small>Voie sélectionnée · API Adresse</small>`);}
  if(group.getLayers().length)map.fitBounds(group.getBounds().pad(.08),{maxZoom:11});
  if(options.focusSelection&&selectedGroup.getLayers().length)map.fitBounds(selectedGroup.getBounds().pad(.2),{maxZoom:13});
  addLegend(map,legend,options);
  if(options.allowDraw)addDrawingTools(box,map,target,options);
  if(target==='map-left'||target==='map-right'){
   const other=maps.get(target==='map-left'?'map-right':'map-left');
   if(other){let moving=false;for(const [a,b] of [[map,other],[other,map]])a.on('moveend',()=>{if(moving)return;moving=true;b.setView(a.getCenter(),a.getZoom(),{animate:false});moving=false});}
  }
  setTimeout(()=>map.invalidateSize(),150);
  notify?.(`Contours affichés : ${rendered} / ${communes.length} communes.`,rendered?'info':'warning');
 }catch(e){if(active()){box.innerHTML='<div class="map-loading">Contours indisponibles : le fichier géographique local n’a pas pu être chargé. Réessayez en ligne.</div>';notify?.(String(e.message||e),'warning')}}
}

export function locate(){const map=[...maps.values()][0];if(!map)return false;if(!navigator.geolocation)return false;navigator.geolocation.getCurrentPosition(p=>{const {latitude,longitude}=p.coords;window.L.marker([latitude,longitude]).addTo(map).bindPopup('Position ponctuelle (non enregistrée)').openPopup();map.setView([latitude,longitude],13)},()=>{alert('Géolocalisation refusée ou indisponible. Aucune position n’est stockée.')},{enableHighAccuracy:false,timeout:10000});return true}
