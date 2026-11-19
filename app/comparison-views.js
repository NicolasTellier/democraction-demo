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
