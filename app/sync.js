/** Échanges même origine, cookies HttpOnly, jeton CSRF. Le client ne conserve pas le mot de passe. */
async function call(path,options={}){
 const res=await fetch('/api/'+path,{credentials:'same-origin',headers:{'Accept':'application/json',...(options.body?{'Content-Type':'application/json'}:{}),...options.headers},...options});
 const data=await res.json().catch(()=>({error:'Réponse non JSON ou serveur indisponible'}));
 if(!res.ok){const error=new Error(data.error||`Erreur HTTP ${res.status}`);error.status=res.status;error.revision=data.currentRevision;throw error}
 return data;
}
export const checkSession=()=>call('session');
export const login=(username,password)=>call('login',{method:'POST',body:JSON.stringify({username,password})});
export const logout=csrf=>call('logout',{method:'POST',headers:{'X-CSRF-Token':csrf},body:'{}'});
export const fetchRemote=()=>call('state');
export const updateRemoteStatus=(missionId,status,previousStatus,csrf)=>call('missions/'+encodeURIComponent(missionId)+'/status',{method:'PATCH',headers:{'X-CSRF-Token':csrf},body:JSON.stringify({status,previousStatus})});
export const pushRemote=(state,revision,csrf)=>call('state',{method:'PUT',headers:{'X-CSRF-Token':csrf},body:JSON.stringify({state,revision})});
