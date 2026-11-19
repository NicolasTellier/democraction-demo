/* Résultats agrégés définitifs par bureau, distincts du référentiel fourni et du CRM. */
const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const format=new Intl.NumberFormat('fr-FR');
const number=value=>format.format(value);
const percent=(part,total)=>total?`${(part*100/total).toFixed(1).replace('.',',')} %`:'—';

export function validateOfficialBureauResults(data,catalog){
 if(data?.schemaVersion!==1||!Array.isArray(catalog)||catalog.length!==23||data.scrutins?.length!==1||data.scrutinsSansLigne?.length!==1)
  throw new Error('Résultats officiels incomplets.');
 const first=data.scrutins[0],second=data.scrutinsSansLigne[0];
 if(data.producer!=="Ministère de l'intérieur"||first.id!=='legislatives-2024-t1'||first.date!=='2024-06-30'||first.tour!==1||first.coverage?.expected!==23||first.coverage?.matched!==22||
    JSON.stringify(first.coverage.missing)!=='["33114-2"]'||first.bureaux?.length!==22||
    first.source?.license!=='Licence Ouverte / Open Licence version 2.0'||
    first.source?.sha256!=='b9e007644f0f060948f0d7215e95d4eec87e69d95f3027dd27067f376155a518'||
    !/^https:\/\/www\.data\.gouv\.fr\/datasets\//.test(first.source?.dataset||'')||
    second.id!=='legislatives-2024-t2'||second.coverage?.matched!==0||second.coverage?.sourceCommuneRows!==0||
    second.coverage?.missing?.length!==23||second.source?.sha256!=='2c0c2a5abfdf96002f89dfe5388d79a614a5a4427be31cb40de4b3edf08bff75'||
    second.status!=='scrutin_non_tenu_dans_les_communes_cibles'||Object.hasOwn(second,'bureaux'))
  throw new Error('Provenance ou couverture des résultats invalide.');
 const stations=new Map(catalog.map(row=>[row.id,row]));
 const used=new Set();
 for(const row of first.bureaux){
  if(!stations.has(row.bureauId)||used.has(row.bureauId)||row.bureauId==='33114-2'||
     row.bureauId!==`${row.codeInsee}-${row.numero}`||stations.get(row.bureauId).commune!==row.commune||
     ![row.inscrits,row.votants,row.abstentions,row.blancs,row.nuls,row.exprimes].every(value=>Number.isSafeInteger(value)&&value>=0)||
     row.inscrits!==row.votants+row.abstentions||row.votants!==row.exprimes+row.blancs+row.nuls||
     !Array.isArray(row.candidats)||!row.candidats.length||
     row.candidats.some(candidate=>!candidate.name||!candidate.nuance||!Number.isSafeInteger(candidate.votes)||candidate.votes<0)||
     row.exprimes!==row.candidats.reduce((sum,candidate)=>sum+candidate.votes,0))
   throw new Error(`Résultat par bureau invalide : ${row.bureauId||'?'}`);
  used.add(row.bureauId);
 }
 if([...stations.keys()].filter(id=>!used.has(id)).join(',')!=='33114-2')throw new Error('Couverture des bureaux incohérente.');
 return data;
}

const bureauSummary=record=>record?{
 bureauId:record.bureauId,
 codeInsee:record.codeInsee,
 numero:record.numero,
 commune:record.commune,
 inscrits:record.inscrits,
 votants:record.votants,
 abstentions:record.abstentions,
 blancs:record.blancs,
 nuls:record.nuls,
 exprimes:record.exprimes,
 participationRate:record.inscrits?record.votants*100/record.inscrits:null,
 abstentionRate:record.inscrits?record.abstentions*100/record.inscrits:null
}:null;

export function compareOfficialBureauResults(data,firstId,secondId){
 if(typeof firstId!=='string'||typeof secondId!=='string'||!firstId||!secondId||firstId===secondId)
  throw new Error('Deux bureaux distincts sont requis.');
 const election=data?.scrutins?.[0];
 if(!election||!Array.isArray(election.bureaux))throw new Error('Résultats officiels indisponibles.');
 const first=bureauSummary(election.bureaux.find(row=>row.bureauId===firstId));
 const second=bureauSummary(election.bureaux.find(row=>row.bureauId===secondId));
 return {
  scrutin:{id:election.id,label:election.label,date:election.date,tour:election.tour,source:{...election.source}},
  first,
  second,
  delta:{
   participation:first&&second&&first.participationRate!==null&&second.participationRate!==null?second.participationRate-first.participationRate:null,
   abstention:first&&second&&first.abstentionRate!==null&&second.abstentionRate!==null?second.abstentionRate-first.abstentionRate:null
  }
 };
}

export function officialBureauResultHtml(data,bureauId){
 if(!data)return '<section class="official-bureau-result"><h3>Résultat officiel par bureau</h3><p class="hint">Source officielle indisponible pour le moment.</p></section>';
 const election=data.scrutins[0],record=election.bureaux.find(row=>row.bureauId===bureauId);
 const source=`<a href="${escapeHTML(election.source.dataset)}" target="_blank" rel="noopener noreferrer">Ministère de l’Intérieur, résultats définitifs par bureau ↗</a>`;
 const t2='<p class="hint">Second tour des législatives 2024 : aucun résultat pour ces communes dans le fichier définitif ; scrutin non tenu à ce tour. Cette absence ne représente pas une abstention.</p>';
 if(!record)return `<section class="official-bureau-result"><h3>Législatives 2024 · 1er tour</h3><p>Aucun résultat officiel apparié pour ce numéro de bureau dans le fichier de 2024.</p><p class="hint">Cavignac comptait un seul bureau dans la source de 2024. L’identifiant 33114-2 du référentiel fourni n’y figure pas.</p><p class="hint">Source : ${source}.</p>${t2}</section>`;
 const candidates=record.candidats.map(candidate=>`<li><span>${escapeHTML(candidate.name)} <small>(${escapeHTML(candidate.nuance)})</small></span><strong>${number(candidate.votes)} voix · ${percent(candidate.votes,record.exprimes)}</strong></li>`).join('');
 return `<section class="official-bureau-result"><h3>Législatives 2024 · 1er tour (30 juin)</h3><div class="detail-list"><div><span>Inscrits</span><strong>${number(record.inscrits)}</strong></div><div><span>Votants</span><strong>${number(record.votants)} · ${percent(record.votants,record.inscrits)}</strong></div><div><span>Abstentions</span><strong>${number(record.abstentions)} · ${percent(record.abstentions,record.inscrits)}</strong></div><div><span>Exprimés</span><strong>${number(record.exprimes)}</strong></div><div><span>Blancs et nuls</span><strong>${number(record.blancs)} + ${number(record.nuls)}</strong></div></div><h4>Voix par candidat</h4><ul class="official-bureau-candidates">${candidates}</ul><p class="hint">Source : ${source}. Nuances et voix issues du fichier officiel, pour le scrutin indiqué.</p><p class="hint">Correspondance par code INSEE et numéro de bureau. Le périmètre géographique de ce bureau en 2024 n’a pas été vérifié par rapport au référentiel actuel.</p>${t2}</section>`;
}


export function officialBureauComparisonHtml(data,firstId,secondId=''){
 if(!data)return '';
 const election=data.scrutins[0];
 const first=election.bureaux.find(row=>row.bureauId===firstId);
 const choices=election.bureaux.filter(row=>row.bureauId!==firstId);
 const selected=choices.some(row=>row.bureauId===secondId)?secondId:'';
 const options=choices.map(row=>`<option value="${escapeHTML(row.bureauId)}" ${row.bureauId===selected?'selected':''}>${escapeHTML(row.commune)} · Bureau ${number(row.numero)} (${escapeHTML(row.bureauId)})</option>`).join('');
 const result=selected?compareOfficialBureauResults(data,firstId,selected):null;
 const pct=value=>value===null?'—':value.toFixed(1).replace('.',',')+' %';
 const delta=value=>value===null?'—':(value>=0?'+':'')+value.toFixed(1).replace('.',',')+' points';
 const body=!first?'<p class="hint">Bureau A : aucun résultat officiel apparié. Aucun écart ne peut être calculé.</p>':
 !result?'<p class="hint">Choisissez un bureau B pour afficher les effectifs et les écarts.</p>':
 `<div class="tablewrap"><table class="bureau-comparison-table"><caption>Comparaison descriptive des bureaux · écarts B − A</caption><thead><tr><th scope="col">Indicateur</th><th scope="col">A · ${escapeHTML(result.first.commune)} · Bureau ${number(result.first.numero)}</th><th scope="col">B · ${escapeHTML(result.second.commune)} · Bureau ${number(result.second.numero)}</th><th scope="col">Écart B − A</th></tr></thead><tbody>${
 [['Inscrits','inscrits'],['Votants','votants'],['Abstentions','abstentions'],['Exprimés','exprimes'],['Blancs','blancs'],['Nuls','nuls']].map(([label,key])=>`<tr><th scope="row">${label}</th><td>${number(result.first[key])}</td><td>${number(result.second[key])}</td><td>—</td></tr>`).join('')}
 <tr><th scope="row">Participation</th><td>${pct(result.first.participationRate)}</td><td>${pct(result.second.participationRate)}</td><td>${delta(result.delta.participation)}</td></tr>
 <tr><th scope="row">Abstention</th><td>${pct(result.first.abstentionRate)}</td><td>${pct(result.second.abstentionRate)}</td><td>${delta(result.delta.abstention)}</td></tr></tbody></table></div>`;
 return `<section class="official-bureau-comparison"><h3>Comparer deux bureaux</h3><p>${escapeHTML(election.label)} · ${escapeHTML(election.date)}</p><p class="hint">Couverture : ${election.coverage.matched}/${election.coverage.expected} bureaux appariés dans le référentiel fourni. Le périmètre géographique historique des bureaux n’a pas été vérifié ; ces écarts descriptifs ne prouvent aucun transfert individuel de voix.</p><label>Bureau B<select id="bureau-comparison-b" ${first?'':'disabled'}><option value="">Choisir un bureau apparié</option>${options}</select></label>${body}${result?.first&&result?.second?'<button type="button" class="btn btn-light" data-action="export-bureau-comparison">Exporter ces deux bureaux (CSV)</button>':''}<p class="hint">Source : <a href="${escapeHTML(election.source.dataset)}" target="_blank" rel="noopener noreferrer">Ministère de l’Intérieur · résultats définitifs ↗</a>. Date du scrutin : ${escapeHTML(election.date)}. Taux arrondis uniquement à l’affichage ; écarts en points.</p></section>`;
}

export const BUREAU_COMPARISON_FIELDS=[
 'scrutin','date_scrutin','tour','bureau_a','commune_a','inscrits_a','votants_a','abstentions_a','exprimes_a','blancs_a','nuls_a','participation_a','abstention_a',
 'bureau_b','commune_b','inscrits_b','votants_b','abstentions_b','exprimes_b','blancs_b','nuls_b','participation_b','abstention_b',
 'ecart_participation_points','ecart_abstention_points','source','ressource','empreinte_source','licence','couverture','perimetres_historiques'
];
export function officialBureauComparisonRecords(data,firstId,secondId){
 const election=data?.scrutins?.[0];
 const known=new Set([...(election?.bureaux||[]).map(row=>row.bureauId),...(election?.coverage?.missing||[])]);
 if(!known.has(firstId)||!known.has(secondId))throw new Error('Bureau absent du référentiel des résultats.');
 const comparison=compareOfficialBureauResults(data,firstId,secondId);
 const row={scrutin:comparison.scrutin.id,date_scrutin:comparison.scrutin.date,tour:comparison.scrutin.tour,
  ecart_participation_points:comparison.delta.participation,ecart_abstention_points:comparison.delta.abstention,
  source:election.source.dataset,ressource:election.source.resource,empreinte_source:election.source.sha256,licence:election.source.license,
  couverture:election.coverage.matched+'/'+election.coverage.expected,perimetres_historiques:'Non vérifiés'};
 for(const [suffix,id,record] of [['a',firstId,comparison.first],['b',secondId,comparison.second]]){
  row['bureau_'+suffix]=id;row['commune_'+suffix]=record?.commune??null;
  for(const key of ['inscrits','votants','abstentions','exprimes','blancs','nuls'])row[key+'_'+suffix]=record?.[key]??null;
  row['participation_'+suffix]=record?.participationRate??null;row['abstention_'+suffix]=record?.abstentionRate??null;
 }
 return [row];
}
