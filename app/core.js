/** Coeur métier pur : exécutable dans navigateur et dans node --test (ES modules). */
import {validZone} from './geo-utils.js';
export const VERSION=3;
export const STATUSES=['À faire','En cours','Terminée'];
export const TYPE_ACTIONS=['Porte-à-porte (couverture)','Distribution','Marché','Réunion publique','Rencontre','Affichage','Autre'];
export const DEFAULT_CAMPAIGN={id:'demo',nom:'Campagne de démonstration',annee:2026,description:'Toutes les informations de démonstration sont fictives.'};
export const emptyState=()=>({version:VERSION,campaigns:[{...DEFAULT_CAMPAIGN}],current:'demo',missions:[],results:[],team:[],archives:[],drafts:[],lastSaved:null});
export const clone=v=>JSON.parse(JSON.stringify(v));
export const id=()=>typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():`id-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
export const norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’']/g,"'").replace(/[‐‑–—]/g,'-').replace(/\s+/g,' ').trim();
export const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const safeCsvValue=s=>{const v=String(s??'');return /^[=+@\-\t\r]/.test(v)?"'"+v:v;};
export const fmtNumber=n=>new Intl.NumberFormat('fr-FR').format(n);
export const rate=(n,d)=>d>0?100*n/d:null;
export function parseCsv(raw){
  const str=String(raw).replace(/^\uFEFF/,'');
  const firstLine=(str.match(/^[^\r\n]*/)||[''])[0];
  const counts={';':0,',':0,'\t':0};let quoted=false;
  for(let i=0;i<firstLine.length;i++){if(firstLine[i]==='"')quoted=!quoted;else if(!quoted&&Object.hasOwn(counts,firstLine[i]))counts[firstLine[i]]++}
  const delimiter=Object.keys(counts).sort((a,b)=>counts[b]-counts[a])[0];
  if(!counts[delimiter])throw new Error('Séparateur CSV introuvable. Utiliser une virgule, un point-virgule ou une tabulation.');
  const rows=[];let row=[],cell='',inside=false;
  for(let i=0;i<str.length;i++){
    const c=str[i];
    if(c==='"'){if(inside&&str[i+1]==='"'){cell+='"';i++}else inside=!inside;continue}
    if(!inside&&c===delimiter){row.push(cell);cell='';continue}
    if(!inside&&(c==='\n'||c==='\r')){if(c==='\r'&&str[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x.trim()!==''))rows.push(row);row=[];cell='';continue}
    cell+=c;
  }
  if(inside)throw new Error('CSV invalide : guillemets non refermés.');
  row.push(cell);if(row.some(x=>x.trim()!==''))rows.push(row);
  if(rows.length<2)throw new Error('Le fichier doit comprendre une ligne d’en-tête et au moins une ligne de données.');
  const headers=rows.shift().map(h=>norm(h).replace(/[\s\-]+/g,'_'));
  if(new Set(headers).size!==headers.length)throw new Error('Colonnes en double.');
  return {headers,rows:rows.map((r,i)=>{if(r.length!==headers.length)throw new Error(`Ligne ${i+2} : ${r.length} cellules au lieu de ${headers.length}.`);return Object.fromEntries(headers.map((h,j)=>[h,r[j].trim()]))}),delimiter};
}
export const APPROVED_COLUMNS=['commune','scrutin','inscrits','votants','exprimes','source','bureau','tour','annee','code_insee'];
const REQUIRED_COLUMNS=['commune','scrutin','inscrits','votants','exprimes','source'];
export function validateElectionImport(headers,rows){
 const extras=headers.filter(h=>!APPROVED_COLUMNS.includes(h));
 if(extras.length)throw new Error(`Colonnes non autorisées : ${extras.join(', ')}. Les données nominatives ne sont pas acceptées.`);
 const missing=REQUIRED_COLUMNS.filter(h=>!headers.includes(h));
 if(missing.length)throw new Error(`Colonnes obligatoires manquantes : ${missing.join(', ')}.`);
 if(rows.length>20000)throw new Error('Fichier trop volumineux (maximum 20 000 lignes).');
 const seen=new Set();
 return rows.map((r,i)=>{
  const nums=['inscrits','votants','exprimes'].map(k=>Number(String(r[k]).trim()));
  if(nums.some(v=>!Number.isSafeInteger(v)||v<0))throw new Error(`Ligne ${i+2} : effectifs non valides.`);
  const [inscrits,votants,exprimes]=nums;
  if(!r.commune||!r.scrutin||!r.source||inscrits===0||exprimes>votants||votants>inscrits)throw new Error(`Ligne ${i+2} : commune, scrutin, source ou effectifs incohérents.`);
  const commune=String(r.commune).trim().slice(0,120),scrutin=String(r.scrutin).trim().slice(0,140),source=String(r.source).trim().slice(0,500);
  const bureau=String(r.bureau??'').trim().slice(0,30),tour=String(r.tour??'').trim().slice(0,24),annee=String(r.annee??'').trim().slice(0,8),codeInsee=String(r.code_insee??'').trim().slice(0,5);
  if(annee&&(!/^\d{4}$/.test(annee)||Number(annee)<1950||Number(annee)>2100))throw new Error(`Ligne ${i+2} : année invalide.`);
  if(codeInsee&&!/^(?:\d{5}|2[AB]\d{3})$/i.test(codeInsee))throw new Error(`Ligne ${i+2} : code INSEE invalide.`);
  const key=[norm(commune),norm(scrutin),bureau,tour,annee].join('|');
  if(seen.has(key))throw new Error(`Doublon détecté à la ligne ${i+2}.`);seen.add(key);
  return {id:key,commune,scrutin,inscrits,votants,exprimes,source,bureau,tour,annee,codeInsee};
 });
}
export function serializeCsv(records,fields){
 const quote=x=>{const safe=safeCsvValue(x).replace(/"/g,'""');return /[;"\r\n]/.test(safe)?`"${safe}"`:safe};
 return '\uFEFF'+[fields.join(';'),...records.map(r=>fields.map(f=>quote(r[f]??'')).join(';'))].join('\r\n');
}
export function mergeResults(state,newRows){
 const known=new Set(state.results.map(r=>r.id));
 const fresh=newRows.filter(r=>!known.has(r.id));
 return {state:{...state,results:[...state.results,...fresh]},added:fresh.length,skipped:newRows.length-fresh.length};
}
const BACKUP_FIELDS={
 campaign:['id','nom','annee','description'],
 mission:['id','campaignId','title','type','commune','secteur','rues','roadIds','tags','satisfaction','assignee','volunteers','status','date','time','objective','report','followUp','documents','notes','notifyApp','notifyEmail','created','zoneKind','zoneId','zoneCommunes','zoneGeometry'],
 result:['id','commune','scrutin','inscrits','votants','exprimes','source','bureau','tour','annee','codeInsee'],
 team:['id','campaignId','name','commune','volunteer','volunteerActions'],
 archive:['id','campaignId','title','category','content','created'],
 draft:['id','campaignId','channel','subject','content','created']
};
function verifyShape(items,allowed,label){for(const [i,item] of items.entries()){if(!item||typeof item!=='object'||Object.keys(item).some(k=>!allowed.includes(k)))throw new Error(`Champs inattendus dans ${label}, enregistrement ${i+1}.`)}}
export function migrateLegacyV2(v2){
 if(!v2||v2.version!==2||!Array.isArray(v2.campaigns)||!Array.isArray(v2.missions)||!Array.isArray(v2.results))throw new Error('Ancienne sauvegarde V0.2 incorrecte.');
 const v3=emptyState(),names=[...new Set(v2.campaigns.filter(n=>typeof n==='string'&&n.length<120))];
 v3.campaigns=names.map((nom,i)=>({id:`legacy-${i}`,nom,annee:2026,description:'Importé depuis V0.2'}));
 if(!v3.campaigns.length)v3.campaigns=[{...DEFAULT_CAMPAIGN}];
 const idFor=nom=>v3.campaigns.find(c=>c.nom===nom)?.id||v3.campaigns[0].id;
 v3.current=idFor(v2.current||v2.campaigns[0]);
 v3.missions=v2.missions.filter(m=>m&&typeof m.title==='string'&&typeof m.commune==='string'&&STATUSES.includes(m.status)).map((m,i)=>({id:`migrated-${i}`,campaignId:idFor(m.campaign),title:m.title.slice(0,140),type:'Autre',commune:m.commune.slice(0,120),secteur:'',assignee:'',status:m.status,date:'',notes:'',created:new Date().toISOString()}));
 v3.results=validateElectionImport(APPROVED_COLUMNS.filter(h=>REQUIRED_COLUMNS.includes(h)),v2.results.map(r=>({commune:r.commune,scrutin:r.scrutin,inscrits:r.inscrits,votants:r.votants,exprimes:r.exprimes,source:r.source}))).map(r=>({...r}));
 return validateBackup(v3);
}
export function validateBackup(obj){
 if(!obj||obj.version!==VERSION||!Array.isArray(obj.campaigns)||!Array.isArray(obj.missions)||!Array.isArray(obj.results)||!Array.isArray(obj.team)||!Array.isArray(obj.archives)||!Array.isArray(obj.drafts))throw new Error('Sauvegarde incompatible ou incomplète.');
 const keys=new Set(['version','campaigns','current','missions','results','team','archives','drafts','lastSaved']);
 if(Object.keys(obj).some(k=>!keys.has(k)))throw new Error('La sauvegarde contient des champs inconnus.');
 if(obj.campaigns.length>100||obj.missions.length>20000||obj.results.length>20000||obj.team.length>500||obj.archives.length>5000||obj.drafts.length>3000)throw new Error('La sauvegarde dépasse les limites prévues.');
 verifyShape(obj.campaigns,BACKUP_FIELDS.campaign,'campagnes');
 verifyShape(obj.missions,BACKUP_FIELDS.mission,'missions');
 verifyShape(obj.results,BACKUP_FIELDS.result,'résultats');
 verifyShape(obj.team,BACKUP_FIELDS.team,'groupes');
 verifyShape(obj.archives,BACKUP_FIELDS.archive,'archives');
 verifyShape(obj.drafts,BACKUP_FIELDS.draft,'brouillons');
 if(!obj.campaigns.every(c=>typeof c.id==='string'&&typeof c.nom==='string'))throw new Error('Campagnes invalides.');
 if(!obj.campaigns.some(c=>c.id===obj.current))throw new Error('Campagne active inconnue.');
 for(const r of obj.results){if(!r||typeof r.commune!=='string'||typeof r.scrutin!=='string'||typeof r.source!=='string'|| !Number.isSafeInteger(r.inscrits)||!Number.isSafeInteger(r.votants)||!Number.isSafeInteger(r.exprimes)||r.exprimes<0||r.exprimes>r.votants||r.votants>r.inscrits)throw new Error('Résultats invalides.');}
 for(const m of obj.missions){if(!m||typeof m.title!=='string'||typeof m.commune!=='string'||!STATUSES.includes(m.status)||typeof m.campaignId!=='string')throw new Error('Missions invalides.');if(m.zoneGeometry!==undefined&&!validZone(m.zoneGeometry))throw new Error('Géométrie de mission invalide.');if(m.zoneCommunes!==undefined&&(!Array.isArray(m.zoneCommunes)||m.zoneCommunes.length>87||m.zoneCommunes.some(c=>typeof c!=='string')))throw new Error('Communes de mission invalides.');if(m.roadIds!==undefined&&(!Array.isArray(m.roadIds)||m.roadIds.length>200||m.roadIds.some(id=>typeof id!=='string'||id.length>100)))throw new Error('Voies de mission invalides.');}
for(const n of obj.archives){if(typeof n.title!=='string'||typeof n.content!=='string'||typeof n.created!=='string'||!Number.isFinite(new Date(n.created).getTime()))throw new Error('Archive invalide.');}
 for(const t of obj.team){if(typeof t.name!=='string'||typeof t.campaignId!=='string')throw new Error('Groupe invalide.');}
 for(const d of obj.drafts){if(typeof d.subject!=='string'||typeof d.content!=='string'||typeof d.campaignId!=='string')throw new Error('Brouillon invalide.');}
 const text=JSON.stringify(obj);
 if(text.length>12e6)throw new Error('Sauvegarde trop volumineuse.');
 // Une sauvegarde ne doit pas servir à contourner la politique « pas de fichiers nominatifs ».
 if(/"(?:prenom|nom_famille|email_contact|telephone_contact|opinion_politique|a_vote|abstention_individuelle|date_naissance)"\s*:/i.test(text))throw new Error('Données nominatives ou politiques détectées dans la sauvegarde.');
 return clone(obj);
}
export function filteredTerritory(communes,f={}){
 return communes.filter(c=>(!f.canton||c.canton===f.canton)&&(!f.epci||c.epci===f.epci)&&(!f.commune||c.nom===f.commune)&&(!f.query||norm(c.nom).includes(norm(f.query))));
}
export function summaryByScrutin(results){
 const map=new Map();
 for(const r of results){const k=[r.scrutin,r.tour,r.annee].join('|');const d=map.get(k)||{key:k,scrutin:r.scrutin,tour:r.tour,annee:r.annee,inscrits:0,votants:0,exprimes:0,count:0};d.inscrits+=r.inscrits;d.votants+=r.votants;d.exprimes+=r.exprimes;d.count++;map.set(k,d)}
 return [...map.values()].sort((a,b)=>a.scrutin.localeCompare(b.scrutin,'fr'));
}
