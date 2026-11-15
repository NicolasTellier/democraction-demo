// Display names only: keep the original election codes in the data and filters.
const TYPES = Object.freeze({
  CANT: 'Cantonales',
  DPMT: 'Départementales',
  EURO: 'Européennes',
  LEGI: 'Législatives',
  MUNI: 'Municipales',
  PRES: 'Présidentielles',
  REGI: 'Régionales',
});

export function electionTypeLabel(code) {
  const original = String(code ?? '').trim();
  return TYPES[original.toUpperCase()] || (original ? `Autre scrutin (${original})` : 'Scrutin inconnu');
}

export function electionBallotLabel(row) {
  const code = String(row?.type ?? '').trim().toUpperCase();
  if (!TYPES[code]) return String(row?.libelle || electionTypeLabel(code));
  const year = Number.isInteger(Number(row?.annee)) && Number(row.annee) > 1800
    ? ` ${row.annee}` : '';
  const tour = /^t([1-9])$/i.exec(String(row?.tour ?? ''));
  return `${TYPES[code]}${year}${tour ? ` — tour ${tour[1]}` : ''}`;
}

export function importedScrutinLabel(value) {
  const original = String(value ?? '').trim();
  return TYPES[original.toUpperCase()] || original;
}
