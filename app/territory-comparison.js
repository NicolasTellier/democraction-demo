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

export function territoryComparisonMeasure(rows, codes, firstId, secondId = '', measure = 'participation') {
  if (!['participation', 'abstention'].includes(measure)) throw new Error('Indicateur communal invalide.');
  return territoryComparison(rows, codes, firstId, secondId).map(item => ({
    ...item, measure,
    measureA: item.a === null ? null : measure === 'abstention' ? 100 - item.a : item.a,
    measureB: item.b === null ? null : measure === 'abstention' ? 100 - item.b : item.b,
    measureDelta: item.delta === null ? null : measure === 'abstention' && item.delta !== 0 ? -item.delta : item.delta,
  }));
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


// Adaptateur de données uniquement ; l'affichage cartographique est traité séparément.
export function participationDifferenceLayer(rows, codes, firstId, secondId, meta = {}) {
  if (!Array.isArray(rows) || !Array.isArray(codes)) throw new Error('Jeu de résultats et codes requis.');
  if (typeof firstId !== 'string' || !firstId || typeof secondId !== 'string' || !secondId || firstId === secondId)
    throw new Error('Deux scrutins distincts sont requis.');
  if (codes.some(code => typeof code !== 'string' || !/^[0-9]{5}$/.test(code)))
    throw new Error('Codes INSEE textuels à cinq chiffres requis.');
  const requested = [...new Set(codes)];
  const selected = rows.filter(row => row && (row.id === firstId || row.id === secondId));
  const metadata = id => {
    const entries = selected.filter(row => row.id === id);
    if (!entries.length) throw new Error('Scrutin inconnu : ' + id);
    const valid = row => typeof row.type === 'string' && row.type &&
      typeof row.tour === 'string' && row.tour &&
      Number.isInteger(Number(row.annee)) && Number(row.annee) >= 2008;
    const first = entries[0];
    if (entries.some(row => !valid(row) || row.type !== first.type || row.tour !== first.tour || Number(row.annee) !== Number(first.annee)))
      throw new Error('Métadonnées de scrutin ambiguës : ' + id);
    return { id, type: first.type, tour: first.tour, year: Number(first.annee), label: electionBallotLabel(first) };
  };
  const first = metadata(firstId), second = metadata(secondId);
  if (first.type !== second.type || first.tour !== second.tour)
    throw new Error('Deux scrutins de même type et de même tour sont requis.');
  const strictRow = row => validRow(row) && Number.isSafeInteger(Number(row.inscrits)) && Number.isSafeInteger(Number(row.votants));
  const key = (code, id) => code + '|' + id;
  const groups = new Map();
  for (const row of selected) {
    const id = key(row.codeInsee, row.id);
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(row);
  }
  const status = (code, id) => {
    const entries = groups.get(key(code, id));
    return !entries ? 'missing' : entries.length !== 1 ? 'duplicate' : strictRow(entries[0]) ? 'available' : 'invalid';
  };
  const clean = selected.filter(row => groups.get(key(row.codeInsee, row.id)).length === 1 && strictRow(row));
  const ballots = comparableBallots(clean, first.type, first.tour);
  for (const ballot of [first, second]) ballot.label = ballots.find(item => item.id === ballot.id)?.label || ballot.label;
  const percentage = (row, value) => !row ? null : Number(row.votants) === Number(row.inscrits) ? 100 : Math.max(0, Math.min(100, value));
  const items = territoryComparison(clean, requested, firstId, secondId).map(item => {
    // Des taux égaux restent exactement zéro, même avec des effectifs de tailles différentes.
    const equalRates = item.first && item.second &&
      BigInt(Number(item.first.votants)) * BigInt(Number(item.second.inscrits)) ===
      BigInt(Number(item.second.votants)) * BigInt(Number(item.first.inscrits));
    return {
      codeInsee: item.codeInsee, participationA: percentage(item.first, item.a), participationB: percentage(item.second, item.b),
      mapValue: item.delta === null ? null : equalRates ? 0 : Math.max(-100, Math.min(100, item.delta)),
      statusA: status(item.codeInsee, firstId), statusB: status(item.codeInsee, secondId),
    };
  });
  const paired = items.filter(item => item.mapValue !== null).length;
  return {
    first, second, direction: 'B − A', unit: 'points de participation', domain: [-100, 100],
    source: { label: typeof meta?.source === 'string' ? meta.source : null, updatedAt: typeof meta?.miseAJour === 'string' ? meta.miseAJour : null },
    coverage: { requested: items.length, paired, unavailable: items.length - paired },
    items,
  };
}

/**
 * Contrat de recette synthétique uniquement. Les identifiants de listes sont
 * propres à chaque scrutin et choisis explicitement ; aucun rapprochement par nom.
 * Les résultats contiennent toutes les listes et leur somme égale les exprimés.
 */
export function compareSyntheticListResults(data, {
  codes, firstId, secondId, listAId, listBId, metric = 'votes',
} = {}) {
  const text = value => typeof value === 'string' && value.trim() !== '' && value === value.trim();
  const date = value => text(value) && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value + 'T00:00:00Z')) &&
    new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value;
  const count = value => Number.isSafeInteger(value) && value >= 0;
  if (data?.schemaVersion !== 1 || data.synthetic !== true || !Array.isArray(data.ballots) || !Array.isArray(data.results))
    throw new Error('Contrat synthétique version 1 requis.');
  if (![firstId, secondId, listAId, listBId].every(text) || firstId === secondId)
    throw new Error('Deux scrutins distincts et deux choix de listes explicites sont requis.');
  if (!['votes', 'share'].includes(metric)) throw new Error('Mesure voix ou part des exprimés requise.');
  if (!Array.isArray(codes) || !codes.length || codes.some(code => typeof code !== 'string' || !/^[0-9]{5}$/.test(code)))
    throw new Error('Au moins un code INSEE textuel à cinq chiffres est requis.');
  const ballot = id => {
    const matches = data.ballots.filter(row => row?.id === id);
    if (matches.length !== 1) throw new Error('Scrutin inconnu ou ambigu : ' + id);
    const row = matches[0];
    if (!text(row.type) || !/^t[1-9]$/.test(row.tour) || !Number.isSafeInteger(row.annee) || row.annee < 2008 ||
        !date(row.date) || Number(row.date.slice(0, 4)) !== row.annee ||
        !text(row.source?.label) || !date(row.source?.date))
      throw new Error('Métadonnées, provenance et dates de scrutin requises : ' + id);
    return { id, type: row.type, tour: row.tour, annee: row.annee, date: row.date,
      label: electionBallotLabel(row), source: { label: row.source.label, date: row.source.date } };
  };
  const first = ballot(firstId), second = ballot(secondId);
  if (first.type !== second.type || first.tour !== second.tour)
    throw new Error('Deux scrutins de même type et de même tour sont requis.');
  const requested = [...new Set(codes)];
  const groups = new Map();
  for (const row of data.results) {
    if (!row || !requested.includes(row.codeInsee) || ![firstId, secondId].includes(row.ballotId)) continue;
    const key = row.ballotId + '|' + row.codeInsee;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  const result = (code, id, listId) => {
    const unavailable = (status, expressed = null) => ({
      listId, label: null, status, votes: null, expressed, share: null, shareStatus: status,
    });
    const rows = groups.get(id + '|' + code);
    if (!rows) return unavailable('missing-result');
    if (rows.length !== 1) return unavailable('duplicate-result');
    const row = rows[0];
    if (!count(row.exprimes) || !Array.isArray(row.listes) ||
        row.listes.some(list => !list || !text(list.id) || !text(list.label) || !count(list.votes)))
      return unavailable('invalid-result');
    if (new Set(row.listes.map(list => list.id)).size !== row.listes.length)
      return unavailable('duplicate-list');
    if (row.listes.reduce((sum, list) => sum + BigInt(list.votes), 0n) !== BigInt(row.exprimes))
      return unavailable('invalid-total');
    const list = row.listes.find(list => list.id === listId);
    if (!list) return unavailable('missing-list', row.exprimes);
    return {
      listId, label: list.label, status: 'available', votes: list.votes, expressed: row.exprimes,
      share: row.exprimes > 0 ? list.votes / row.exprimes * 100 : null,
      shareStatus: row.exprimes > 0 ? 'available' : 'zero-denominator',
    };
  };
  const items = requested.map(codeInsee => {
    const first = result(codeInsee, firstId, listAId), second = result(codeInsee, secondId, listBId);
    const a = metric === 'votes' ? first.votes : first.share;
    const b = metric === 'votes' ? second.votes : second.share;
    const equal = a !== null && b !== null && (metric === 'votes' ? a === b :
      BigInt(first.votes) * BigInt(second.expressed) === BigInt(second.votes) * BigInt(first.expressed));
    return { codeInsee, first, second, a, b, delta: a === null || b === null ? null : equal ? 0 : b - a };
  });
  const paired = items.filter(item => item.delta !== null).length;
  return {
    schemaVersion: 1, synthetic: true, first, second, listAId, listBId, metric, direction: 'B − A',
    unit: metric === 'votes' ? 'voix' : 'points des suffrages exprimés',
    coverage: { requested: items.length, firstAvailable: items.filter(item => item.a !== null).length,
      secondAvailable: items.filter(item => item.b !== null).length, paired, unavailable: items.length - paired },
    items,
  };
}
