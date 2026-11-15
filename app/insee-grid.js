/** Insee Filosofi 2021 gridded statistics, published in an official vector tile set.
 * Cells are public aggregates. No cell is an address or a person's record.
 */
const SOURCE = 'https://www.insee.fr/fr/statistiques/8735243';
const cache = new Map();

export function gridStatus(cell) {
  if (cell?.properties?.status === 'A') return 'Valeur diffusée par l’Insee';
  if (cell?.properties?.status === 'I') return 'Valeur imputée par l’Insee';
  return 'Statut statistique non précisé';
}

export function gridCellLabel(cell) {
  const status = gridStatus(cell);
  const resolution = cell?.properties?.id?.includes('RES200m') ? '200 m' : '1 km';
  const value = cell?.properties?.status === 'A' && Number.isFinite(cell.properties.ind)
    ? `${Number(cell.properties.ind).toLocaleString('fr-FR', {maximumFractionDigits: 0})} individus au sens fiscal`
    : 'Effectif non affiché';
  return `Carreau ${resolution} · ${value} · ${status} · Insee, Filosofi 2021`;
}

export function gridCellStyle(cell, resolution) {
  const imputed = cell.properties.status !== 'A';
  const value = Number(cell.properties.ind);
  const thresholds = resolution === 200 ? [20, 50] : [100, 300];
  return {
    className: 'insee-grid-cell',
    color: imputed ? '#696673' : '#263952', weight: 0.7,
    dashArray: imputed ? '3 3' : undefined,
    fillColor: imputed ? '#cbd7d6' : value < thresholds[0] ? '#b7e1d0' : value < thresholds[1] ? '#67bca5' : '#217c70',
    fillOpacity: imputed ? 0.18 : 0.48,
  };
}

export function validateGrid(data, resolution, code) {
  if (data?.millesime !== 2021 || data?.source !== SOURCE || !Array.isArray(data.grids?.[resolution]))
    throw new Error('Référentiel de carreaux incompatible');
  for (const cell of data.grids[resolution]) {
    if (!cell?.properties?.id?.startsWith(`CRS3035RES${resolution}mN`) ||
        !cell.properties.codes?.includes(code) ||
        !['A', 'I', ''].includes(cell.properties.status) ||
        !Array.isArray(cell.geometry?.coordinates?.[0]) ||
        !cell.geometry.coordinates[0].every(point => Array.isArray(point) && point.length === 2 && point.every(Number.isFinite)))
      throw new Error('Carreau géographique invalide');
  }
  return data.grids[resolution];
}

export async function loadGrid(resolution, code, fetcher = fetch) {
  if (![200, 1000].includes(resolution) || !/^33\d{3}$/.test(String(code)))
    throw new Error('Commune ou résolution invalide');
  const key = String(code);
  if (!cache.has(key)) cache.set(key, (async () => {
    const url = new URL(`../data/insee-grid/${key}.json.gz`, import.meta.url);
    const response = await fetcher(url);
    if (!response.ok || !response.body || typeof DecompressionStream !== 'function')
      throw new Error('Carroyage indisponible sur cet appareil');
    return new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).json();
  })().catch(error => { cache.delete(key); throw error; }));
  try { return validateGrid(await cache.get(key), resolution, code); }
  catch (error) { cache.delete(key); throw error; }
}

/** Adds a bounded, selectable public overlay without retaining data in localStorage. */
export async function attachGrid(map, leaflet, {resolution, code, active, onStatus}) {
  if (![200, 1000].includes(resolution)) return;
  if (!/^33\d{3}$/.test(String(code || ''))) {
    onStatus?.('Choisissez une commune pour afficher les carreaux Insee.');
    return;
  }
  onStatus?.(`Chargement du carroyage Insee ${resolution === 200 ? '200 m' : '1 km'}…`);
  const cells = await loadGrid(resolution, code);
  if (!active()) return;
  let layer = null;
  const minZoom = resolution === 200 ? 12 : 9;
  const refresh = () => {
    if (!active()) return;
    if (map.getZoom() < minZoom) {
      layer?.remove(); layer = null;
      onStatus?.(`${cells.length} carreaux disponibles · zoomez au niveau ${minZoom} pour les afficher.`);
      return;
    }
    if (!layer) {
      layer = leaflet.geoJSON({type: 'FeatureCollection', features: cells}, {
        style: cell => gridCellStyle(cell, resolution),
        onEachFeature: (cell, shape) => {
          // Leaflet sets the SVG class when the layer is added. Its later
          // setStyle() call does not apply className from the style callback.
          shape.options.className = 'insee-grid-cell';
          const label = gridCellLabel(cell);
          shape.bindTooltip(label, {sticky: true});
          shape.bindPopup(`<strong>${label}</strong><br><a href="${SOURCE}" target="_blank" rel="noopener noreferrer">Méthode et source Insee</a>`);
        },
      }).addTo(map);
    }
    onStatus?.(`${cells.length} carreaux affichés pour la commune · les pointillés signalent une valeur imputée. Insee, Filosofi 2021.`);
  };
  map.on('zoomend', refresh);
  refresh();
}
