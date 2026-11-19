import { electionTypeLabel } from './election-labels.js';

const hasCount=value=>(typeof value==='number'||typeof value==='string'&&value.trim()!=='')&&Number.isSafeInteger(Number(value));

const validParticipationCounts=row=>hasCount(row.inscrits)&&hasCount(row.votants)&&Number(row.inscrits)>0&&Number(row.votants)>=0&&Number(row.votants)<=Number(row.inscrits);

// Un histogramme compte des communes, sans pondération par population ni classement territorial.
export function participationDistribution(rows,{year,type,tour}={}) {
 if(!Number.isInteger(year)||year<2008||typeof type!=='string'||!type||typeof tour!=='string'||!tour)throw new Error('Un seul scrutin, une année et un tour sont requis.');
 const matching=(rows||[]).filter(row=>row.type===type&&row.tour===tour&&Number(row.annee)===year);
 const codes=new Map();
 for(const row of matching)if(typeof row.codeInsee==='string'&&/^[0-9]{5}$/.test(row.codeInsee))
  codes.set(row.codeInsee,(codes.get(row.codeInsee)||0)+1);
 const bins=Array.from({length:10},(_,index)=>({min:index*10,max:(index+1)*10,includeMax:index===9,count:0}));
 let eligibleCommunes=0;
 for(const row of matching){
  if(codes.get(row.codeInsee)!==1||!validParticipationCounts(row))continue;
  // Comparer les effectifs évite qu'un arrondi de pourcentage déplace une borne.
  let index=0;
  while(index<9&&BigInt(Number(row.votants))*10n>=BigInt(Number(row.inscrits))*BigInt(index+1))index++;
  bins[index].count++;eligibleCommunes++;
 }
 return {selection:{year,type,tour},unit:'communes',bins,eligibleCommunes,
  matchingRows:matching.length,excludedRows:matching.length-eligibleCommunes,
  duplicateCommunes:[...codes.values()].filter(count=>count>1).length};
}

export function historicalParticipation(rows, type, tour) {
  if (!type || !tour) return [];
  const years = new Map();
  for (const row of rows || []) {
    if (row.type !== type || row.tour !== tour) continue;
    if(!validParticipationCounts(row))continue;
    const year = Number(row.annee);
    const registered = Number(row.inscrits);
    const voters = Number(row.votants);
    if (!Number.isInteger(year) || year < 2008 || !Number.isFinite(registered) ||
        !Number.isFinite(voters) || registered <= 0 || voters < 0 || voters > registered) continue;
    const entry = years.get(year) || { year, registered: 0, voters: 0, communes: new Set() };
    entry.registered += registered;
    entry.voters += voters;
    entry.communes.add(String(row.codeInsee || row.commune));
    years.set(year, entry);
  }
  return [...years.values()].sort((a, b) => a.year - b.year).map(({ year, registered, voters, communes }) => ({
    year, registered, voters, communes: communes.size,
    participation: 100 * voters / registered,
    abstention: 100 * (registered - voters) / registered,
  }));
}

export function viewParticipationTimeline({ rows, type, tour, meta, esc, fmtNumber, panel }) {
  const title = 'Évolution de la participation et de l’abstention';
  if (!type || !tour) return panel(title, '<p class="hint">Sélectionnez un type de scrutin et un tour pour comparer des scrutins de même nature dans le temps.</p>');
  const series = historicalParticipation(rows, type, tour);
  if (series.length < 2) return panel(title, '<p class="hint">Il faut au moins deux années comparables pour tracer cette courbe. Modifiez le type de scrutin ou le tour.</p>');
  const minYear = series[0].year;
  const span = series.at(-1).year - minYear;
  const x = item => 50 + 600 * (item.year - minYear) / span;
  const y = value => 190 - 1.5 * value;
  const format = value => value.toFixed(1).replace('.', ',');
  const line = key => series.map(item => `${x(item)},${y(item[key])}`).join(' ');
  const dots = (key, className) => series.map(item =>
    `<circle class="${className}" cx="${x(item)}" cy="${y(item[key])}" r="4"><title>${item.year} : ${format(item[key])} %</title></circle>`).join('');
  const grid = [0, 25, 50, 75, 100].map(value =>
    `<line x1="50" y1="${y(value)}" x2="650" y2="${y(value)}"/><text x="43" y="${y(value) + 4}" text-anchor="end">${value} %</text>`).join('');
  const labels = series.map(item => `<text x="${x(item)}" y="214" text-anchor="middle">${item.year}</text>`).join('');
  const caption = `${electionTypeLabel(type)} · ${tour === 't1' ? '1er tour' : tour === 't2' ? '2e tour' : tour}`;
  const table = series.map(item => `<tr><th scope="row">${item.year}</th><td class="num">${item.communes}</td><td class="num">${fmtNumber(item.registered)}</td><td class="num">${format(item.participation)} %</td><td class="num">${format(item.abstention)} %</td></tr>`).join('');
  const bars = series.map(item => `<li class="history-bars-year" data-year="${item.year}"><h4>${item.year} <small>${item.communes} commune(s) · ${fmtNumber(item.registered)} inscrits</small></h4>${[['participation','Participation'],['abstention','Abstention']].map(([key,label])=>`<div class="history-bar-row"><span>${label}</span><span class="history-bar-track" aria-hidden="true"><i class="history-bar-${key}" style="width:${item[key]}%"></i></span><strong>${format(item[key])} %</strong></div>`).join('')}</li>`).join('');
  const barsView = `<details class="history-bars-details"><summary>Voir l’historique en barres</summary><figure class="history-bars" aria-label="${esc(caption)} : participation et abstention en barres"><figcaption>${esc(caption)} · échelle de 0 à 100 %</figcaption><ol>${bars}</ol></figure></details>`;
  const stacked = series.map(item=>`<li class="history-stacked-year" data-year="${item.year}"><h4>${item.year} <small>${item.communes} commune(s) · ${fmtNumber(item.registered)} inscrits</small></h4><div class="history-stacked-track" aria-hidden="true"><i class="history-stacked-participation" style="width:${item.participation}%"></i><i class="history-stacked-abstention" style="width:${item.abstention}%"></i></div><div class="history-stacked-values"><span>Participation : <strong>${format(item.participation)} %</strong></span><span>Abstention : <strong>${format(item.abstention)} %</strong></span></div></li>`).join('');
  const stackedView = `<details class="history-stacked-details"><summary>Voir l’historique en barres empilées</summary><figure class="history-stacked" aria-label="${esc(caption)} : participation et abstention empilées"><figcaption>${esc(caption)} · chaque barre représente 100 % des inscrits</figcaption><ol>${stacked}</ol></figure></details>`;
  const areaValues=series.map(item=>`<li class="history-area-year" data-year="${item.year}"><strong>${item.year}</strong> · Participation ${format(item.participation)} % · Abstention ${format(item.abstention)} %<small>${item.communes} commune(s) · ${fmtNumber(item.registered)} inscrits</small></li>`).join('');
  const areaFirst=x(series[0]),areaLast=x(series.at(-1));
  const areaParticipation=`${areaFirst},190 ${line('participation')} ${areaLast},190`;
  const areaAbstention=`${areaFirst},40 ${areaLast},40 ${series.slice().reverse().map(item=>x(item)+','+y(item.participation)).join(' ')}`;
  const areaView=`<details class="history-area-details"><summary>Voir l’historique en aires empilées</summary><figure class="history-area" aria-label="${esc(caption)} : aires de participation et d’abstention"><figcaption>${esc(caption)} · échelle de 0 à 100 % des inscrits</figcaption><p class="hint">Surfaces reliées entre les dates observées, sans résultat mesuré pour les années intermédiaires. La couverture peut varier à chaque scrutin.</p><div class="timeline-legend"><span class="participation-key">Participation</span><span class="abstention-key">Abstention</span></div><svg class="history-area-svg" viewBox="-25 0 725 225" role="img" aria-label="Aires empilées, dates observées de ${minYear} à ${series.at(-1).year}"><polygon class="history-area-participation" points="${areaParticipation}"/><polygon class="history-area-abstention" points="${areaAbstention}"/><g class="timeline-grid">${grid}${labels}</g><polyline class="history-area-boundary" points="${line('participation')}"/>${dots('participation','history-area-point')}</svg><ol>${areaValues}</ol></figure></details>`;
  const source = meta?.source || 'Ministère de l’Intérieur, via data.gouv.fr';
  const updated = meta?.miseAJour ? ` · mise à jour ${esc(meta.miseAJour)}` : '';
  return panel(title, `<p class="description">${esc(caption)} · périmètre territorial sélectionné. Le filtre Année ne limite pas cette courbe, afin de conserver la série historique. Les taux sont calculés sur les effectifs inscrits et votants agrégés, sans moyenne de pourcentages communaux.</p><div class="timeline-legend"><span class="participation-key">Participation</span><span class="abstention-key">Abstention</span></div><div class="timeline-scroll"><svg class="election-timeline" viewBox="0 0 700 225" role="img" aria-label="${esc(caption)} : évolution agrégée de la participation et de l’abstention de ${minYear} à ${series.at(-1).year}"><g class="timeline-grid">${grid}${labels}</g><polyline class="timeline-participation" points="${line('participation')}"/><polyline class="timeline-abstention" points="${line('abstention')}"/>${dots('participation', 'timeline-point-participation')}${dots('abstention', 'timeline-point-abstention')}</svg></div><div class="tablewrap"><table><caption class="sr-only">Valeurs exactes du graphique historique</caption><thead><tr><th>Année</th><th>Communes</th><th>Inscrits</th><th>Participation</th><th>Abstention</th></tr></thead><tbody>${table}</tbody></table></div>${barsView}${stackedView}${areaView}<p class="hint">Source : ${esc(source)}${updated}. La couverture territoriale peut varier selon l’année ; le nombre de communes est indiqué pour chaque point. Ces écarts ne mesurent pas des transferts individuels de voix.</p>`);
}

export function viewParticipationDistribution({rows,year,type,tour,meta,esc,fmtNumber,panel}){
 const title='Distribution des communes par participation';
 if(!year||!type||!tour)return panel(title,'<p class="hint">Sélectionnez un type de scrutin, une année et un tour pour afficher l’histogramme.</p>');
 const result=participationDistribution(rows,{year:Number(year),type,tour});
 const source=esc(meta?.source||'Ministère de l’Intérieur, via data.gouv.fr');
 const updated=meta?.miseAJour?' · mise à jour '+esc(meta.miseAJour):'';
 const coverage=fmtNumber(result.eligibleCommunes)+' commune(s) admissible(s) · '+fmtNumber(result.excludedRows)+' ligne(s) exclue(s) · '+fmtNumber(result.duplicateCommunes)+' commune(s) en doublon';
 const provenance='<p class="hint">Source : '+source+updated+'. La couverture dépend des données disponibles pour ce scrutin et ce périmètre.</p>';
 if(!result.eligibleCommunes)return panel(title,'<p class="description">Aucune commune admissible pour cet histogramme.</p><p class="hint">'+coverage+'</p>'+provenance);
 const bins=result.bins.map(bin=>'<tr class="distribution-bin" data-min="'+bin.min+'" data-count="'+bin.count+'"><th scope="row">'+bin.min+' à '+bin.max+' %'+(bin.includeMax?' inclus':' exclu')+'</th><td>'+fmtNumber(bin.count)+'</td><td><span class="distribution-track" aria-hidden="true"><i style="width:'+bin.count*100/result.eligibleCommunes+'%"></i></span><span class="sr-only">'+(bin.count*100/result.eligibleCommunes).toFixed(1).replace('.',',')+' % des communes admissibles</span></td></tr>').join('');
 return panel(title,'<details class="distribution-details"><summary>Voir l’histogramme des communes</summary><figure class="participation-distribution"><figcaption>'+esc(electionTypeLabel(type))+' · '+esc(String(year))+' · '+esc(tour==='t1'?'1er tour':'2e tour')+'</figcaption><p class="hint">'+coverage+'</p><p class="hint">Chaque commune compte une fois, sans pondération par population. Borne basse incluse ; borne haute exclue sauf 100 %. Les barres représentent 0 à 100 % des communes admissibles.</p><table><caption class="sr-only">Communes par classe de taux de participation</caption><thead><tr><th scope="col">Participation</th><th scope="col">Communes</th><th scope="col">Fréquence</th></tr></thead><tbody>'+bins+'</tbody></table>'+provenance+'</figure></details>');
}
