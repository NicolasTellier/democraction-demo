/** Comptages logistiques des missions, sans classement ni estimation de disponibilité. */
import {norm} from './core.js';

const counters=()=>({total:0,todo:0,inProgress:0,completed:0,assigned:0,unassigned:0});
const nonempty=value=>typeof value==='string'&&value.trim().length>0;
const statusKeys=new Map([['À faire','todo'],['En cours','inProgress'],['Terminée','completed']]);

/**
 * Une mission peut contribuer à plusieurs communes, mais une seule fois aux totaux.
 * Pour une campagne donnée, la première occurrence d'un identifiant fait autorité,
 * même si elle est ensuite écartée pour son statut ou sa localisation.
 */
export function summarizeMissionCoverage({communes=[],missions=[],campaignId}={}){
 const byCode=new Map(),byName=new Map();
 for(const commune of Array.isArray(communes)?communes:[]){
  if(!nonempty(commune?.nom)||!nonempty(commune?.codeInsee)||byCode.has(commune.codeInsee))continue;
  const row={codeInsee:commune.codeInsee,commune:commune.nom,...counters()};
  byCode.set(row.codeInsee,row);
  const name=norm(commune.nom);
  if(!byName.has(name))byName.set(name,row);
 }
 const totals=counters(),ignored={cancelled:0,unknownStatus:0,unlocated:0,duplicateId:0,missingId:0},seen=new Set();
 for(const mission of Array.isArray(missions)?missions:[]){
  if(!nonempty(campaignId)||mission?.campaignId!==campaignId)continue;
  if(!nonempty(mission.id)){ignored.missingId++;continue}
  if(seen.has(mission.id)){ignored.duplicateId++;continue}
  seen.add(mission.id);
  if(mission.status==='Annulée'){ignored.cancelled++;continue}
  const status=statusKeys.get(mission.status);
  if(!status){ignored.unknownStatus++;continue}
  const names=[mission.commune,...(Array.isArray(mission.zoneCommunes)?mission.zoneCommunes:[])];
  const locations=new Set(names.filter(nonempty).map(name=>byName.get(norm(name))).filter(Boolean));
  if(!locations.size){ignored.unlocated++;continue}
  const assigned=nonempty(mission.assignee)||(Array.isArray(mission.volunteers)&&mission.volunteers.some(nonempty));
  for(const target of [totals,...locations]){
   target.total++;target[status]++;
   if(status!=='completed')target[assigned?'assigned':'unassigned']++;
  }
 }
 const rows=[...byCode.values()].sort((a,b)=>a.commune.localeCompare(b.commune,'fr',{sensitivity:'base'})||a.codeInsee.localeCompare(b.codeInsee));
 return {rows,totals,ignored};
}
