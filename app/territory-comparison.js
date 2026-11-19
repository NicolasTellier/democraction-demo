import { electionBallotLabel } from './election-labels.js';

const hasCount = value => (typeof value === 'number' || typeof value === 'string' && value.trim() !== '') &&
  Number.isFinite(Number(value));
const validRow = row => hasCount(row.inscrits) && Number(row.inscrits) > 0 &&
  hasCount(row.votants) && Number(row.votants) >= 0 && Number(row.votants) <= Number(row.inscrits);

export function comparableBallots(rows, type = '', tour = '') {
  const ballots = new Map();
  for (const row of rows || []) {
    if ((type && row.type !== type) || (tour && row.tour !== tour) || !validRow(row)) continue;
    if (!ballots.has(row.id)) ballots.set(row.id, { id: row.id, type: row.type, tour: row.tour, annee: row.annee, label: electionBallotLabel(row) });
  }
  return [...ballots.values()].sort((a, b) => Number(b.annee) - Number(a.annee) || a.label.localeCompare(b.label, 'fr'));
}

export function territoryComparison(rows, codes, firstId, secondId = '') {
  const index = new Map((rows || []).filter(row => validRow(row) && (row.id === firstId || secondId && row.id === secondId))
    .map(row => [`${row.codeInsee}|${row.id}`, row]));
  return [...new Set(codes || [])].map(codeInsee => {
    const first = index.get(`${codeInsee}|${firstId}`);
    const second = secondId ? index.get(`${codeInsee}|${secondId}`) : null;
    const rate = row => row ? 100 * Number(row.votants) / Number(row.inscrits) : null;
    const a = rate(first), b = rate(second);
    return { codeInsee, first, second, a, b, delta: a === null || b === null ? null : b - a };
  });
}

export function viewTerritoryComparison({ rows, communes, filters, meta, savedViews = [], esc, attr, fmtNumber, panel }) {
  const ballots = comparableBallots(rows, filters.electionType, filters.electionTour);
  const paired = ballots.find(ballot => ballots.some(other => other.id !== ballot.id && other.type === ballot.type && other.tour === ballot.tour));
  const older = paired && ballots.find(ballot => ballot.id !== paired.id && ballot.type === paired.type && ballot.tour === paired.tour);
  const first = ballots.find(ballot => ballot.id === filters.analysisBallotA) || older || ballots[0];
  const alternatives = ballots.filter(ballot => first && ballot.id !== first.id && ballot.type === first.type && ballot.tour === first.tour);
  const second = alternatives.find(ballot => ballot.id === filters.analysisBallotB) || alternatives.find(ballot => Number(ballot.annee) > Number(first?.annee)) || alternatives[0];
  const available = new Set((communes || []).map(commune => commune.codeInsee));
  const selected = [...new Set(filters.analysisCommuneCodes || [])].filter(code => available.has(code)).slice(0, 5);
  const nameByCode = new Map((communes || []).map(commune => [commune.codeInsee, commune.nom]));
  const comparison = territoryComparison(rows, selected, first?.id, second?.id);
  const pct = n => n === null ? '—' : `${n.toFixed(1).replace('.', ',')} %`;
  const effectif = n => n == null ? '—' : fmtNumber(n);
  const optionsA = ballots.map(ballot => `<option value="${attr(ballot.id)}" ${ballot.id === first?.id ? 'selected' : ''}>${esc(ballot.label)}</option>`).join('');
  const optionsB = alternatives.map(ballot => `<option value="${attr(ballot.id)}" ${ballot.id === second?.id ? 'selected' : ''}>${esc(ballot.label)}</option>`).join('');
  const needle = String(filters.analysisSearch || '').normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase('fr').trim();
  const optionsCommunes = (communes || []).map(commune => {
    const active = selected.includes(commune.codeInsee);
    const label = `${commune.nom} ${commune.codeInsee}`.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase('fr');
    return `<label class="territory-picker-option" ${needle && !active && !label.includes(needle) ? 'hidden' : ''}><input type="checkbox" name="analysis-commune" value="${attr(commune.codeInsee)}" ${active ? 'checked' : ''}><span>${esc(commune.nom)} <small>${esc(commune.codeInsee)}</small></span></label>`;
  }).join('');
  const table = comparison.map(item => `<tr><th scope="row">${esc(nameByCode.get(item.codeInsee) || item.codeInsee)}</th><td class="num">${effectif(item.first?.inscrits)}</td><td class="num">${effectif(item.first?.votants)}</td><td class="num">${pct(item.a)}</td><td class="num">${pct(item.a === null ? null : 100 - item.a)}</td><td class="num">${effectif(item.second?.inscrits)}</td><td class="num">${effectif(item.second?.votants)}</td><td class="num">${pct(item.b)}</td><td class="num">${pct(item.b === null ? null : 100 - item.b)}</td><td class="num">${item.delta === null ? '—' : `${item.delta >= 0 ? '+' : ''}${item.delta.toFixed(1).replace('.', ',')} points`}</td></tr>`).join('');
  const bar = comparison.map(item => `<div class="territory-bars"><strong>${esc(nameByCode.get(item.codeInsee) || item.codeInsee)}</strong><div class="territory-bars-row"><span>A</span><div class="territory-bars-track"><i style="width:${item.a ?? 0}%"></i></div><span>${pct(item.a)}</span></div>${second ? `<div class="territory-bars-row second"><span>B</span><div class="territory-bars-track"><i style="width:${item.b ?? 0}%"></i></div><span>${pct(item.b)}</span></div>` : ''}</div>`).join('');
  const coverage = second ? `A : ${comparison.filter(item => item.a !== null).length}/${selected.length} communes ; B : ${comparison.filter(item => item.b !== null).length}/${selected.length}.` : `A : ${comparison.filter(item => item.a !== null).length}/${selected.length} communes.`;
  const source = meta?.source || 'Ministère de l’Intérieur, via data.gouv.fr';
  const ballotName = new Map(ballots.map(ballot => [ballot.id, ballot.label]));
  const savedHtml = savedViews.length
    ? '<div class="comparison-saved-list"><h4>Comparaisons enregistrées sur cet appareil</h4><ul>' +
      savedViews.map(view => `<li><span><strong>${esc(view.communeCodes.length + ' communes · ' + (ballotName.get(view.ballotA) || view.ballotA) + ' / ' + (ballotName.get(view.ballotB) || view.ballotB))}</strong><small>Enregistrée le ${esc(new Date(view.savedAt).toLocaleDateString('fr-FR'))} · Source : ${esc(view.source)}${view.sourceDate ? ' · mise à jour ' + esc(view.sourceDate) : ''}</small></span><button type="button" class="btn btn-light btn-sm" data-action="open-comparison-view" data-comparison-id="${attr(view.id)}">Ouvrir</button><button type="button" class="btn btn-danger btn-sm" data-action="delete-comparison-view" data-comparison-id="${attr(view.id)}">Supprimer</button></li>`).join('') + '</ul></div>'
    : '<p class="hint">Aucune comparaison enregistrée sur cet appareil.</p>';

  return panel('Comparer plusieurs communes', `<p class="description">Participation et abstention descriptives à partir des effectifs communaux. Sélectionnez des communes du périmètre géographique actif, puis deux années d’un même type de scrutin et d’un même tour. Les écarts portent sur des taux agrégés. Le filtre Année de l’historique ne limite pas ces deux sélecteurs.</p><div class="form-inline profile-controls"><label>Scrutin A<select id="analysis-ballot-a">${optionsA}</select></label><label>Scrutin B · même type et même tour<select id="analysis-ballot-b" ${second ? '' : 'disabled'}>${optionsB || '<option value="">Pas d’autre millésime comparable</option>'}</select></label></div><fieldset class="territory-picker"><legend>Communes à comparer (5 maximum)</legend><label class="territory-picker-search">Rechercher une commune<input id="analysis-commune-search" type="search" value="${attr(filters.analysisSearch || '')}" placeholder="Nom ou code INSEE"></label><div class="territory-picker-list">${optionsCommunes}</div></fieldset>${selected.length ? `<p class="hint">${selected.length} commune(s) sélectionnée(s). ${coverage} Une absence de résultat est signalée par « — » ; elle ne vaut pas zéro.</p><div class="territory-bars-list" role="img" aria-label="Participation comparée pour ${selected.length} communes, scrutin A${second ? ' et scrutin B' : ''}">${bar}</div><div class="tablewrap"><table id="territory-comparison-table"><caption>Effectifs et taux exacts par commune</caption><thead><tr><th scope="col">Commune</th><th scope="col">Inscrits A</th><th scope="col">Votants A</th><th scope="col">Participation A</th><th scope="col">Abstention A</th><th scope="col">Inscrits B</th><th scope="col">Votants B</th><th scope="col">Participation B</th><th scope="col">Abstention B</th><th scope="col">Écart B − A</th></tr></thead><tbody>${table}</tbody></table></div><button class="btn btn-light" data-action="export-territory-comparison">Exporter cette comparaison (CSV)</button> ${selected.length >= 2 && second ? '<button type="button" class="btn btn-light" data-action="save-comparison-view">Enregistrer cette comparaison</button>' : ''}` : '<p class="hint">Cochez au moins deux communes pour une comparaison entre territoires.</p>'}<p class="hint">A : ${esc(first?.label || 'indisponible')}${second ? ` · B : ${esc(second.label)}` : ''}. Source : ${esc(source)}${meta?.miseAJour ? ` · mise à jour ${esc(meta.miseAJour)}` : ''}. La couverture peut varier selon le scrutin. Aucun transfert individuel de voix ne peut être déduit de ces écarts.</p>${savedHtml}`);
}
