export function validatePollingCatalog(data, communes) {
  if (!Array.isArray(data?.stations)) throw new Error('Référentiel de bureaux invalide');
  const codes = new Map(communes.map(c => [String(c.codeInsee), c.nom]));
  const ids = new Set();
  return data.stations.map(row => {
    const code = String(row.codeInsee || '');
    if (!codes.has(code) || codes.get(code) !== row.commune || !Number.isInteger(row.numero) || row.numero < 1 ||
        row.id !== `${code}-${row.numero}` || ids.has(row.id) || !Number.isInteger(row.reportedValue) || row.reportedValue < 0 ||
        row.geometry !== null || row.geometryStatus !== 'Géométrie absente' ||
        row.valueMeaning !== 'Effectif communiqué, nature et millésime à vérifier')
      throw new Error(`Bureau invalide ou non qualifié : ${row.id || '?'}`);
    ids.add(row.id);
    return row;
  });
}

export function bureauFeature(features, id) {
  return (features || []).find(feature =>
    String(feature.properties?.id || feature.properties?.code || feature.properties?.bureau || '') === String(id));
}
