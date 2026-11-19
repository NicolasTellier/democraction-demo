import { electionTypeLabel } from './election-labels.js';

const hasCount=value=>(typeof value==='number'||typeof value==='string'&&value.trim()!=='')&&Number.isSafeInteger(Number(value));

export function historicalParticipation(rows, type, tour) {
  if (!type || !tour) return [];
  const years = new Map();
  for (const row of rows || []) {
    if (row.type !== type || row.tour !== tour) continue;
    if(!hasCount(row.inscrits)||!hasCount(row.votants))continue;
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
  const source = meta?.source || 'Ministère de l’Intérieur, via data.gouv.fr';
  const updated = meta?.miseAJour ? ` · mise à jour ${esc(meta.miseAJour)}` : '';
  return panel(title, `<p class="description">${esc(caption)} · périmètre territorial sélectionné. Le filtre Année ne limite pas cette courbe, afin de conserver la série historique. Les taux sont calculés sur les effectifs inscrits et votants agrégés, sans moyenne de pourcentages communaux.</p><div class="timeline-legend"><span class="participation-key">Participation</span><span class="abstention-key">Abstention</span></div><div class="timeline-scroll"><svg class="election-timeline" viewBox="0 0 700 225" role="img" aria-label="${esc(caption)} : évolution agrégée de la participation et de l’abstention de ${minYear} à ${series.at(-1).year}"><g class="timeline-grid">${grid}${labels}</g><polyline class="timeline-participation" points="${line('participation')}"/><polyline class="timeline-abstention" points="${line('abstention')}"/>${dots('participation', 'timeline-point-participation')}${dots('abstention', 'timeline-point-abstention')}</svg></div><div class="tablewrap"><table><caption class="sr-only">Valeurs exactes du graphique historique</caption><thead><tr><th>Année</th><th>Communes</th><th>Inscrits</th><th>Participation</th><th>Abstention</th></tr></thead><tbody>${table}</tbody></table></div>${barsView}${stackedView}<p class="hint">Source : ${esc(source)}${updated}. La couverture territoriale peut varier selon l’année ; le nombre de communes est indiqué pour chaque point. Ces écarts ne mesurent pas des transferts individuels de voix.</p>`);
}
