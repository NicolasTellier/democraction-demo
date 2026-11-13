import {emptyState,validateBackup,VERSION} from './core.js';
// La clé historique n'est lue qu'une fois, pour conserver les données locales V0.4.
const KEY='democraction-v1-local';
const LEGACY_KEY='territoires-v3-demo';
export function load(){
 try{
  const current=localStorage.getItem(KEY);
  if(current)return validateBackup(JSON.parse(current));
  const prior=localStorage.getItem(LEGACY_KEY);
  if(!prior)return emptyState();
  const migrated=validateBackup(JSON.parse(prior));
  localStorage.setItem(KEY,JSON.stringify(migrated));
  localStorage.removeItem(LEGACY_KEY);
  return migrated;
 }catch(e){console.warn('Données locales inutilisables : exportez une sauvegarde si possible.',e);return emptyState()}
}
export function save(s){const next={...s,version:VERSION,lastSaved:new Date().toISOString()};localStorage.setItem(KEY,JSON.stringify(next));return next}
export function download(content,name,type='application/json'){const a=document.createElement('a');const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),500)}
export function clearLocal(){localStorage.removeItem(KEY);localStorage.removeItem(LEGACY_KEY)}
