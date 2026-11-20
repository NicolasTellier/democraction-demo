export const COMPARISONS_KEY = 'democraction-demo-comparison-views';
const MAX_VIEWS = 8;
const code = value => typeof value === 'string' && /^\d{5}$/.test(value);
const short = (value, max = 160) => typeof value === 'string' && value.length > 0 && value.length <= max;
const normalize = item => {
  if (!item || item.version !== 1 || !short(item.id, 80) ||
      !short(item.ballotA) || !short(item.ballotB) || item.ballotA === item.ballotB ||
      !short(item.type, 80) || !short(item.tour, 20) ||
      !Array.isArray(item.communeCodes) || item.communeCodes.length < 2 || item.communeCodes.length > 5 ||
      !item.communeCodes.every(code) || new Set(item.communeCodes).size !== item.communeCodes.length ||
      !short(item.savedAt, 40) || !Number.isFinite(Date.parse(item.savedAt)) ||
      !short(item.source, 200) || typeof item.sourceDate !== 'string' || item.sourceDate.length > 40) return null;
  return { version: 1, id: item.id, ballotA: item.ballotA, ballotB: item.ballotB,
    type: item.type, tour: item.tour, communeCodes: [...item.communeCodes],
    savedAt: item.savedAt, source: item.source, sourceDate: item.sourceDate };
};
export function parseComparisonViews(raw) {
  try {
    const data = JSON.parse(raw || '[]');
    return Array.isArray(data) ? data.map(normalize).filter(Boolean).slice(0, MAX_VIEWS) : [];
  } catch { return []; }
}
export function addComparisonView(views, candidate) {
  const item = normalize(candidate);
  if (!item) throw new Error('Choisissez deux scrutins comparables et deux à cinq communes.');
  const signature = value => [value.ballotA, value.ballotB, ...value.communeCodes.slice().sort()].join('|');
  if (views.some(value => signature(value) === signature(item)))
    throw new Error('Cette comparaison est déjà enregistrée.');
  return [item, ...views].slice(0, MAX_VIEWS);
}
export function findComparisonView(views, id, ballots, communeCodes) {
  const view = views.find(item => item.id === id);
  if (!view) throw new Error('Vue enregistrée introuvable.');
  const first = ballots.find(ballot => ballot.id === view.ballotA);
  const second = ballots.find(ballot => ballot.id === view.ballotB);
  if (!first || !second || first.type !== second.type || first.tour !== second.tour ||
      first.type !== view.type || first.tour !== view.tour ||
      view.communeCodes.some(codeInsee => !communeCodes.includes(codeInsee)))
    throw new Error('Un scrutin ou une commune de cette vue ne figure plus dans les données disponibles.');
  return view;
}

export const SYNTHETIC_COMPARISONS_KEY='democraction-demo-synthetic-list-views';
export const SYNTHETIC_DATASET_ID='synthetic-lists-v1';
const normalizeSyntheticView=item=>{
 const p=item?.params;
 if(item?.version!==1||!short(item.datasetId,80)||!short(item.id,80)||
    !short(item.savedAt,40)||!Number.isFinite(Date.parse(item.savedAt))||!p||
    ![p.firstId,p.secondId,p.listAId,p.listBId].every(v=>short(v))||p.firstId===p.secondId||
    !['votes','share'].includes(p.metric)||!Array.isArray(p.codes)||p.codes.length<1||p.codes.length>3||
    !p.codes.every(code)||new Set(p.codes).size!==p.codes.length)return null;
 return{version:1,datasetId:item.datasetId,id:item.id,savedAt:item.savedAt,
  params:{codes:[...p.codes],firstId:p.firstId,secondId:p.secondId,listAId:p.listAId,listBId:p.listBId,metric:p.metric}};
};
export function parseSyntheticComparisonViews(raw){
 try{const data=JSON.parse(raw||'[]');return Array.isArray(data)?data.map(normalizeSyntheticView).filter(Boolean).filter((v,i,a)=>a.findIndex(x=>x.id===v.id)===i).slice(0,MAX_VIEWS):[];}catch{return [];}
}
export function addSyntheticComparisonView(views,candidate){
 const item=normalizeSyntheticView(candidate);
 if(!item||item.datasetId!==SYNTHETIC_DATASET_ID)throw new Error('Choix fictifs incomplets ou format incompatible.');
 const signature=v=>JSON.stringify([v.datasetId,v.params.firstId,v.params.secondId,v.params.listAId,v.params.listBId,v.params.metric,[...v.params.codes].sort()]);
 if(views.some(v=>v.id===item.id||signature(v)===signature(item)))throw new Error('Cette comparaison fictive est déjà enregistrée.');
 return[item,...views].slice(0,MAX_VIEWS);
}
export function findSyntheticComparisonView(views,id,data,communeCodes){
 const view=normalizeSyntheticView(views.find(v=>v.id===id));
 if(!view)throw new Error('Vue fictive introuvable ou format incompatible.');
 const p=view.params,first=data.ballots.find(b=>b.id===p.firstId),second=data.ballots.find(b=>b.id===p.secondId);
 const hasList=(ballotId,listId)=>data.results.some(r=>r.ballotId===ballotId&&r.listes.some(l=>l.id===listId));
 if(view.datasetId!==data.datasetId||data.synthetic!==true||!first||!second||
    first.type!==second.type||first.tour!==second.tour||p.codes.some(c=>!communeCodes.includes(c))||
    !hasList(p.firstId,p.listAId)||!hasList(p.secondId,p.listBId))
  throw new Error('Référence fictive périmée : jeu, scrutin, liste ou commune indisponible.');
 return view;
}
