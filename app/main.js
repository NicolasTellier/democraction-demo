import {
  VERSION,
  emptyState,
  norm,
  escapeHTML as esc,
  rate,
  fmtNumber,
  id,
  STATUSES,
  TYPE_ACTIONS,
  parseCsv,
  validateElectionImport,
  validateBackup,
  filteredTerritory,
  summaryByScrutin,
  mergeResults,
  serializeCsv,
  migrateLegacyV2,
} from "./core.js";
import { load, save, download, clearLocal } from "./store.js";
import { parseXlsx } from "./xlsx.js";
import { drawMap, locate, selectionGeometry } from "./map.js?v=20261114map21";
import { validPolygon,validZone } from "./geo-utils.js";
import {
  checkSession,
  login,
  logout,
  fetchRemote,
  pushRemote,
  updateRemoteStatus,
} from "./sync.js";
import { viewPublicProfile, viewElectionHistory } from "./public-data-v3.js";
const NAV = [
  ["dashboard", "Vue d’ensemble", "▦"],
  ["profil", "Profils territoriaux", "◌"],
  ["territoires", "Territoires", "◎"],
  ["carte", "Carte", "⌖"],
  ["actions", "Actions de terrain", "☷"],
  ["contacts", "Contacts consentants", "♙"],
  ["analyse", "Résultats électoraux", "▥"],
  ["imports", "Imports et exports", "⇅"],
  ["communication", "Communication", "✉"],
  ["equipes", "Équipes", "♧"],
  ["memoire", "Mémoire des campagnes", "▤"],
  ["financement", "Financement (simulation)", "€"],
  ["evenements", "Événements publics", "◫"],
  ["config", "Configuration", "⚙"],
];
const STANDARD_TAGS = [
  "Rencontré sur le marché de Saint-André",
  "Rencontré en porte-à-porte",
  "Rencontré en réunion publique",
  "Contact associatif",
  "Contact commerçant",
  "À rappeler",
  "Soutien identifié",
  "À informer",
];
const VOLUNTEER_ACTIONS = [
  "Porte-à-porte",
  "Marchés",
  "Tractage",
  "Boîtage",
  "Réunions publiques",
  "Affichage",
  "Téléphone",
  "Logistique",
];
let serverSession = null,
  serverRevision = null,
  serverConnected = false,
  serverBusy = false,
  serverPending = false;
let territory = null,
  socio = null,
  elections = null,
  app = load(),
  tab = "dashboard",
  filters = {
    canton: "",
    epci: "",
    commune: "",
    query: "",
    socioIndicator: "",
    mapLayer: "participation",
    socioMin: "",
    socioMax: "",
    electionType: "",
    electionYear: "",
    electionTour: "",
    compareLeft: "",
    compareRight: "",
    prioritySocio: "tauxChomage",
    priorityElectoralWeight: "50",
    prioritySocioWeight: "50",
  },
  notice = "",
  noticeLevel = "info",
  mapDrawId = 0,
  modal = "",
  draftText = "",
  editingMission = null;
const root = document.getElementById("root");
let demoContacts = JSON.parse(
    localStorage.getItem("democraction-demo-contacts") || "[]",
  ),
  demoFunds = JSON.parse(
    localStorage.getItem("democraction-demo-funds") || "[]",
  ),
  demoEvents = JSON.parse(
    localStorage.getItem("democraction-demo-events") || "[]",
  ),
  demoSectors = JSON.parse(
    localStorage.getItem("democraction-demo-sectors") || "[]",
  ),
  selectedStreets = [],
  streetSearchResults = [],
  mapSelectedCommunes = [],
  mapMode = "explore",
  missionPrefill = null,
  mapSelection = { kind: "commune", value: "" },
  bureauxLayer = null,
  sectorBeingEdited = null;

const PREFS_KEY = "democraction-demo-preferences";
const PREF_KEYS = ["canton", "epci", "commune", "query", "socioIndicator", "socioMin", "socioMax", "mapLayer", "electionType", "electionYear", "electionTour", "compareLeft", "compareRight", "prioritySocio", "priorityElectoralWeight", "prioritySocioWeight"];
function restorePreferences(preferences) {
  if (!preferences || typeof preferences !== "object") return;
  for (const key of PREF_KEYS)
    if (typeof preferences.filters?.[key] === "string" && preferences.filters[key].length < 160)
      filters[key] = preferences.filters[key];
  if (["commune", "epci", "canton", "bureau", "sector"].includes(preferences.mapSelection?.kind) && typeof preferences.mapSelection.value === "string" && preferences.mapSelection.value.length < 160)
    mapSelection = {kind:preferences.mapSelection.kind,value:preferences.mapSelection.value};
  if (["explore", "compare", "draw", "organize"].includes(preferences.mapMode)) mapMode = preferences.mapMode;
}
function savePreferences() {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify({filters:Object.fromEntries(PREF_KEYS.map(key=>[key,filters[key]])),mapSelection,mapMode})); } catch {}
}
try { restorePreferences(JSON.parse(localStorage.getItem(PREFS_KEY) || "null")); } catch {}

const options = (values, value, all) =>
  `<option value="">${esc(all)}</option>` +
  values
    .map(
      (v) =>
        `<option value="${esc(v)}" ${value === v ? "selected" : ""}>${esc(v)}</option>`,
    )
    .join("");
const choose = (v, display) =>
  `<option ${v === display ? "selected" : ""}>${esc(v)}</option>`;
const attr = (s) => esc(String(s ?? ""));
const unique = (a) =>
  [...new Set(a)]
    .filter(Boolean)
    .sort((a, b) => String(a).localeCompare(String(b), "fr"));
const currentCampaign = () =>
  app.campaigns.find((c) => c.id === app.current) || app.campaigns[0];
const currentMissions = () =>
  app.missions.filter((m) => m.campaignId === app.current);
const currentNotes = () =>
  app.archives.filter((n) => n.campaignId === app.current);
const currentTeam = () => app.team.filter((t) => t.campaignId === app.current);
const currentDrafts = () =>
  app.drafts.filter((d) => d.campaignId === app.current);
const fullEditor = () => !serverSession || serverSession.role === "admin";
const fieldEditor = () => serverSession?.role === "terrain" && serverConnected;
const matching = () =>
  territory ? filteredTerritory(territory.communes, filters) : [];
const MAP_LAYERS = [
  ["participation", "Participation électorale", "%"],
  ["population", "Population", "habitants"],
  ["tauxChomage", "Chômage", "%"],
  ["revenuMedian", "Revenu médian", "€"],
  ["part65plus", "65 ans ou plus", "%"],
  ["partLogementsVacants", "Logements vacants", "%"],
  ["priority", "Priorité d’action", "score"],
];
const PRIORITY_DEFAULT_DIRECTION = {
  population: "high",
  tauxChomage: "high",
  revenuMedian: "low",
  part65plus: "high",
  partLogementsVacants: "high",
};
const latestElectionRows = (year = "") => {
  const ballot = typeof year === "string" && year.includes("_") ? year : "";
  const rows = (elections?.elections || []).filter(
    (row) =>
      row.annee >= 2008 &&
      (ballot
        ? row.id === ballot
        : (!filters.electionType || row.type === filters.electionType) &&
          (!year || String(row.annee) === String(year)) &&
          (!filters.electionTour || row.tour === filters.electionTour)),
  );
  const latest = new Map();
  for (const row of rows) {
    const old = latest.get(row.codeInsee);
    if (
      !old ||
      row.annee > old.annee ||
      (row.annee === old.annee && String(row.tour) > String(old.tour))
    )
      latest.set(row.codeInsee, row);
  }
  return latest;
};
const scale = (value, min, max) => {
  if (value === null || value === undefined || !Number.isFinite(min) || !Number.isFinite(max)) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (max === min) return 0.5;
  return Math.max(0, Math.min(1, (n - min) / (max - min)));
};
const mapSelectionCommunes = () => {
  const { kind, value } = mapSelection;
  if (!value)
    return mapSelectedCommunes.length
      ? mapSelectedCommunes
      : filters.commune
        ? [filters.commune]
        : [];
  if (kind === "commune") return mapSelectedCommunes.length ? mapSelectedCommunes : [value];
  if (kind === "epci")
    return territory.communes.filter((c) => c.epci === value).map((c) => c.nom);
  if (kind === "canton")
    return territory.communes
      .filter((c) => c.canton === value)
      .map((c) => c.nom);
  if (kind === "sector") {
    const sector = demoSectors.find((x) => x.id === value);
    return sector?.commune ? [sector.commune] : [];
  }
  if (kind === "bureau") {
    const feature = (bureauxLayer?.features || []).find(
      (f) =>
        String(
          f.properties?.id || f.properties?.code || f.properties?.bureau || "",
        ) === String(value),
    );
    const code =
      feature?.properties?.codeInsee || feature?.properties?.communeCode;
    const commune = territory.communes.find(
      (c) => String(c.codeInsee) === String(code),
    );
    return commune ? [commune.nom] : [];
  }
  return [];
};
const mapSelectionLabel = () => {
  const { kind, value } = mapSelection;
  if (!value) return "Aucune zone sélectionnée";
  if (kind === "sector") {
    const s = demoSectors.find((x) => x.id === value);
    return `Secteur · ${s?.name || "secteur enregistré"}`;
  }
  if (kind === "bureau") {
    const f = (bureauxLayer?.features || []).find(
      (x) =>
        String(
          x.properties?.id || x.properties?.code || x.properties?.bureau || "",
        ) === String(value),
    );
    return `Bureau de vote · ${f?.properties?.nom || f?.properties?.bureau || value}`;
  }
  return `${kind === "epci" ? "Intercommunalité" : kind === "canton" ? "Canton" : "Commune"} · ${value}`;
};
const bureauFeatures = () =>
  Array.isArray(bureauxLayer?.features) ? bureauxLayer.features : [];
async function loadBureauLayer() {
  if (bureauxLayer) return;
  try {
    const saved = JSON.parse(localStorage.getItem("democraction-demo-bureaux") || "null");
    if (saved?.type === "FeatureCollection" && Array.isArray(saved.features)) { bureauxLayer = saved; if (tab === "carte") render(); return; }
  } catch {}
  const pending = { type: "FeatureCollection", features: [], loading: true };
  bureauxLayer = pending;
  try {
    const r = await fetch("./data/bureaux-de-vote.geojson?v=20261113");
    const loaded = r.ok ? await r.json() : { type: "FeatureCollection", features: [] };
    if (bureauxLayer === pending) bureauxLayer = loaded;
  } catch {
    if (bureauxLayer === pending) bureauxLayer = { type: "FeatureCollection", features: [] };
  }
  if (tab === "carte") render();
}
const mapCommunesFor = (
  layer = filters.mapLayer,
  electionYear = filters.electionYear,
) => {
  const candidates = territory.communes.filter(c =>
    (!filters.canton || c.canton === filters.canton) &&
    (!filters.epci || c.epci === filters.epci) &&
    (!filters.query || norm(c.nom).includes(norm(filters.query)))),
    latest = latestElectionRows(electionYear),
    socioRows = new Map(
      (socio?.indicators || []).map((row) => [row.codeInsee, row]),
    ),
    meta = MAP_LAYERS.find((x) => x[0] === layer) || MAP_LAYERS[0];
  let priorityRows = [];
  if (layer === "priority") {
    const raw = candidates.map((c) => ({
      c,
      e: latest.get(c.codeInsee)?.participation,
      s: socioRows.get(c.codeInsee)?.[filters.prioritySocio] ?? null,
    }));
    const eVals = raw.map((x) => x.e).filter(Number.isFinite),
      sVals = raw.map((x) => x.s).filter(Number.isFinite),
      emin = Math.min(...eVals),
      emax = Math.max(...eVals),
      smin = Math.min(...sVals),
      smax = Math.max(...sVals),
      ew = Math.max(0, Number(filters.priorityElectoralWeight) || 0),
      sw = Math.max(0, Number(filters.prioritySocioWeight) || 0);
    priorityRows = raw.map((x) => {
      const eNorm = scale(x.e, emin, emax),
        sNorm = scale(x.s, smin, smax),
        eScore = eNorm === null ? null : 1 - eNorm,
        sBase = sNorm === null ? null : sNorm,
        sScore =
          sBase === null
            ? null
            : (PRIORITY_DEFAULT_DIRECTION[filters.prioritySocio] || "high") ===
                "low"
              ? 1 - sBase
              : sBase,
        available = (eScore !== null ? ew : 0) + (sScore !== null ? sw : 0),
        score = available
          ? (((eScore === null ? 0 : eScore * ew) +
              (sScore === null ? 0 : sScore * sw)) /
              available) *
            100
          : null;
      return { ...x, score };
    });
  }
  return candidates.map((c) => {
    const row = latest.get(c.codeInsee),
      sr = socioRows.get(c.codeInsee),
      priority = priorityRows.find((x) => x.c.codeInsee === c.codeInsee),
      value =
        layer === "participation"
          ? (row?.participation ?? null)
          : layer === "priority"
            ? priority?.score
            : (sr?.[layer] ?? null);
    let label;
    if (layer === "participation")
      label = row
        ? `${row.libelle} · ${Number(row.participation).toFixed(1).replace(".", ",")} %`
        : "Aucune donnée électorale sélectionnée";
    else if (layer === "priority")
      label = Number.isFinite(value)
        ? `Priorité exploratoire · ${Number(value).toFixed(0)}/100 · participation ${row ? Number(row.participation).toFixed(1).replace(".", ",") : "—"} % · ${filters.prioritySocio} ${Number.isFinite(priority?.s) ? Number(priority.s).toLocaleString("fr-FR") : "—"}`
        : "Données insuffisantes";
    else
      label = Number.isFinite(value)
        ? `${meta[1]} · ${Number(value).toLocaleString("fr-FR")} ${meta[2]}`
        : `${meta[1]} indisponible`;
    return {
      ...c,
      mapValue: Number.isFinite(value) ? value : null,
      mapLabel: label,
    };
  });
};
const mapCommunes = () =>
  mapCommunesFor(filters.mapLayer, filters.electionYear);
const electionBallots = () => {
  const ballots = new Map();
  for (const row of elections?.elections || []) {
    if (row.annee >= 2008 && row.id && !ballots.has(row.id))
      ballots.set(row.id, { id: row.id, label: row.libelle, type: row.type, tour: row.tour, year: row.annee });
  }
  return [...ballots.values()].sort((a, b) => b.year - a.year || a.type.localeCompare(b.type) || a.tour.localeCompare(b.tour));
};
const comparedBallots = () => {
  const ballots = electionBallots();
  const left = ballots.find(x => x.id === filters.compareLeft) || ballots[0];
  const right = ballots.find(x => x.id === filters.compareRight) ||
    ballots.find(x => x.type === left?.type && x.tour === left?.tour && x.year < left.year) || ballots[1];
  return [left, right];
};
const selectedCommune = () =>
  territory?.communes.find((c) => norm(c.nom) === norm(filters.commune));
async function searchStreets(query, commune) {
  if (!query || !commune) {
    streetSearchResults = [];
    toast("Choisissez une commune et saisissez une rue.", "warning");
    return;
  }
  const code = territory.communes.find((c) => c.nom === commune)?.codeInsee;
  if (code) {
    filters.commune = commune;
    mapSelectedCommunes = [commune];
  }
  if (!code) {
    toast("Code commune indisponible pour cette recherche.", "warning");
    return;
  }
  try {
    const url = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&citycode=${encodeURIComponent(code)}&limit=8&type=street`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Réponse ${response.status}`);
    const data = await response.json();
    streetSearchResults = (data.features || []).map((feature) => ({
      name: feature.properties?.name || feature.properties?.label || query,
      lat: feature.geometry?.coordinates?.[1],
      lon: feature.geometry?.coordinates?.[0],
      citycode: code,
    }));
    render();
  } catch (error) {
    streetSearchResults = [];
    toast(`Recherche de rues indisponible : ${error.message}`, "warning");
  }
}
function saveSector(geometry, editId = null) {
  const name = document.getElementById("sector-name")?.value.trim();
  const color = document.getElementById("sector-color")?.value || "#9c6b2a";
  if (!validPolygon(geometry) || !name) { toast("Nommez le secteur et vérifiez son contour avant l’enregistrement.", "warning"); return; }
  const old = demoSectors.find(x => x.id === editId);
  const sector = {
    id: old?.id || id(),
    name: name.trim().slice(0, 100),
    description: "Secteur dessiné depuis la carte",
    color,
    commune: old?.commune || filters.commune || "",
    geometry,
    created: old?.created || new Date().toISOString(),
  };
  demoSectors = [...demoSectors.filter(x => x.id !== sector.id), sector];
  sectorBeingEdited = null;
  mapSelection = {kind:"sector",value:sector.id};
  localStorage.setItem(
    "democraction-demo-sectors",
    JSON.stringify(demoSectors),
  );
  render();
  toast(`Secteur « ${sector.name} » ${old ? "modifié" : "enregistré"} localement.`);
}
function mapDetail() {
  const c = selectedCommune();
  if ((mapSelection.kind === "epci" || mapSelection.kind === "canton" || (mapSelection.kind === "commune" && mapSelectedCommunes.length > 1)) && mapSelection.value) {
    const names = mapSelectionCommunes();
    const socioByCode = new Map((socio?.indicators || []).map(row => [row.codeInsee, row]));
    const selected = territory.communes.filter(row => names.includes(row.nom));
    const populations = selected.map(row => Number(socioByCode.get(row.codeInsee)?.population)).filter(value => Number.isFinite(value) && value > 0);
    const complete = populations.length === selected.length;
    const title = mapSelection.kind === "commune" ? "Communes sélectionnées" : mapSelection.kind === "epci" ? "Intercommunalité · " + mapSelection.value : "Canton · " + mapSelection.value;
    return panel(esc(title), `<div class="territory-card"><div><span class="kicker">Communes</span><strong>${selected.length}</strong></div><div><span class="kicker">Population Insee 2023</span><strong>${complete ? fmtNumber(populations.reduce((sum,value)=>sum+value,0)) : "Indisponible"}</strong></div><div><span class="kicker">Actions locales</span><strong>${currentMissions().filter(m=>names.includes(m.commune)).length}</strong></div><div><span class="kicker">Secteurs sauvegardés</span><strong>${demoSectors.filter(s=>names.includes(s.commune)).length}</strong></div></div><p class="hint">${esc(names.join(", "))}</p><p class="hint">Population additionnée uniquement lorsque chaque commune dispose d’une valeur. Les périmètres réunissent les contours communaux du référentiel 2026.</p><button class="btn btn-primary" data-action="new-mission-from-map">Créer une action ici</button>`);
  }
  if (mapSelection.kind === "sector") {
    const sector = demoSectors.find(x => x.id === mapSelection.value);
    if (sector) return panel("Secteur · " + esc(sector.name), `<p>${esc(sector.commune || "Secteur libre")}</p><p>Identifiant : ${esc(sector.id)}</p><p>Contour enregistré : ${sector.geometry?.coordinates?.[0]?.length-1 || 0} sommets</p><button class="btn btn-primary" data-action="new-mission-from-map">Créer une action ici</button>`);
  }
  if (mapSelection.kind === "bureau") {
    const feature=bureauFeatures().find(f=>String(f.properties?.id||f.properties?.code||f.properties?.bureau||"")===String(mapSelection.value));
    if(feature)return panel("Bureau de vote · " + esc(feature.properties?.nom||mapSelection.value), `<p>Identifiant : ${esc(mapSelection.value)}</p><p>Commune : ${esc(feature.properties?.commune||feature.properties?.codeInsee||"Non renseignée")}</p><p>Contour importé par l’administrateur.</p>`);
  }
  if (!c)
    return panel(
      "Fiche territoriale",
      empty(
        "Sélectionnez une commune",
        "Cliquez sur un contour ou utilisez la recherche pour ouvrir sa fiche.",
      ),
    );
  const sr = socio?.indicators?.find((x) => x.codeInsee === c.codeInsee);
  const rows = (elections?.elections || [])
    .filter((x) => x.codeInsee === c.codeInsee && x.annee >= 2008)
    .sort((a, b) => b.annee - a.annee);
  const last = rows[0];
  const missions = currentMissions().filter((m) => m.commune === c.nom);
  const sectors = demoSectors.filter((s) => !s.commune || s.commune === c.nom);
  return panel(
    c.nom,
    `<div class="territory-card"><div><span class="kicker">Code INSEE</span><strong>${esc(c.codeInsee || "—")}</strong></div><div><span class="kicker">Canton</span><strong>${esc(c.canton)}</strong></div><div><span class="kicker">Intercommunalité</span><strong>${esc(c.epci)}</strong></div><div><span class="kicker">Population</span><strong>${sr?.population ? fmtNumber(sr.population) : "—"}</strong></div></div><div class="detail-list"><div><span>Dernière participation disponible</span><strong>${last ? `${Number(last.participation).toFixed(1).replace(".", ",")} %` : "—"}</strong></div><div><span>Actions enregistrées</span><strong>${missions.length}</strong></div><div><span>Secteurs sauvegardés</span><strong>${sectors.length}</strong></div></div><div class="button-row"><button class="btn btn-primary" data-action="new-mission-from-map">Créer une action ici</button><button class="btn btn-light" data-nav="analyse">Voir l’historique</button></div><p class="hint">Les résultats et indicateurs sont agrégés à l’échelle de la commune. Ils ne décrivent aucune personne.</p>`,
  );
}

const filteredMissions = () =>
  currentMissions().filter((m) => {
    const geo = territory?.communes.find((c) => c.nom === m.commune);
    return (
      (!filters.commune || m.commune === filters.commune) &&
      (!filters.canton || geo?.canton === filters.canton) &&
      (!filters.epci || geo?.epci === filters.epci) &&
      (!filters.query ||
        norm(m.title + " " + m.commune + " " + m.secteur).includes(
          norm(filters.query),
        ))
    );
  });
const filteredResults = () =>
  app.results.filter((r) => {
    const geo = territory?.communes.find(
      (c) => norm(c.nom) === norm(r.commune),
    );
    return (
      (!filters.commune || norm(r.commune) === norm(filters.commune)) &&
      (!filters.canton || geo?.canton === filters.canton) &&
      (!filters.epci || geo?.epci === filters.epci) &&
      (!filters.query ||
        norm(r.commune + " " + r.scrutin).includes(norm(filters.query)))
    );
  });
const pct = (num, den) => {
  const p = rate(num, den);
  return p === null ? "—" : `${p.toFixed(1).replace(".", ",")} %`;
};
const labels = () => NAV.find((a) => a[0] === tab)?.[1] || "DemocrAction";
const panel = (title, body, extra = "") =>
  `<section class="panel">${title ? `<div class="panel-header"><h2>${title}</h2>${extra}</div>` : ""}${body}</section>`;
const empty = (t, h = "") =>
  `<div class="empty"><strong>${t}</strong>${h ? `<p>${h}</p>` : ""}</div>`;
const navItem = ([key, label, icon]) =>
  `<button class="navitem ${tab === key ? "selected" : ""}" data-nav="${key}" aria-current="${tab === key ? "page" : "false"}"><span class="navicon" aria-hidden="true">${icon}</span><span>${esc(label)}</span></button>`;
function toast(text, level = "info") {
  notice = text;
  noticeLevel = level;
  render();
}
function mutate(fn) {
  if (serverSession && serverSession.role !== "admin") {
    toast("Ce compte ne peut pas modifier la base générale.", "warning");
    return;
  }
  const next = fn(app);
  app = save(next || app);
  render();
  enqueueSync();
}
function header() {
  return `<aside class="sidebar"><div class="logo"><div class="logo-mark">D<span>·</span></div><div><strong>DemocrAction</strong><small>La mémoire du terrain</small></div></div><div class="sidebar-kicker">ESPACE DE TRAVAIL</div><nav class="side-nav" aria-label="Navigation principale">${NAV.filter(
    ([key]) =>
      fullEditor() ||
      !["imports", "communication", "equipes", "memoire"].includes(key),
  )
    .map(navItem)
    .join(
      "",
    )}</nav><div class="sidebar-footer"><div class="tag soft">V0.10 · Démonstration</div><p>Usage de démonstration. Ne pas saisir de données personnelles.</p></div></aside>`;
}
function toolbar() {
  let communes = territory ? territory.communes : [];
  if (filters.canton)
    communes = communes.filter((c) => c.canton === filters.canton);
  if (filters.epci) communes = communes.filter((c) => c.epci === filters.epci);
  return `<div class="topbar"><div class="topbar-title"><div class="kicker">11e circonscription · Gironde</div><h1>${esc(labels())}</h1></div><div class="topbar-right"><span class="statusdot"></span><span class="work-mode">${serverConnected ? (serverSession?.role === "terrain" ? "Terrain connecté" : "Synchronisé") : serverSession ? "Connecté · non synchronisé" : "Stockage local"}</span>${fullEditor() ? '<button class="btn btn-subtle" data-action="backup" title="Sauvegarder">Exporter</button>' : ""}</div></div><div class="filters"><label>Campagne<select id="campaign-select">${app.campaigns.map((c) => `<option value="${attr(c.id)}" ${app.current === c.id ? "selected" : ""}>${esc(c.nom)}</option>`).join("")}</select></label><label>Canton<select id="filter-canton">${options(territory?.cantons || [], filters.canton, "Tous les cantons")}</select></label><label>Intercommunalité<select id="filter-epci">${options(territory?.epci || [], filters.epci, "Toutes les intercommunalités")}</select></label><label>Commune<select id="filter-commune">${options(
    communes.map((c) => c.nom).sort((a, b) => a.localeCompare(b, "fr")),
    filters.commune,
    "Toutes les communes",
  )}</select></label><label class="searchwrap">Recherche<input id="filter-query" placeholder="Commune, mission, scrutin..." value="${attr(filters.query)}"/></label><button class="btn btn-light clear" data-action="clear-filters" title="Réinitialiser tous les filtres">Effacer les filtres</button></div>`;
}
function viewDashboard() {
  const ms = filteredMissions(),
    done = ms.filter((m) => m.status === "Terminée").length,
    rs = filteredResults(),
    cs = matching();
  return `<div class="hero"><div><div class="kicker">ESPACE DE DÉMONSTRATION</div><h2>Une campagne. Un territoire.<br/>Une mémoire collective.</h2><p>Coordonnez les missions, explorez les communes et consultez les données électorales agrégées depuis un ordinateur ou un smartphone.</p><div class="hero-actions"><button class="btn btn-primary" data-nav="carte">Ouvrir la carte</button><button class="btn btn-outline" data-nav="actions">${fullEditor() ? "Nouvelle mission" : "Voir les missions"}</button></div></div><div class="hero-decoration" aria-hidden="true"><span class="orbit a"></span><span class="orbit b"></span><span class="orbit c"></span><span class="orb"></span></div></div>
<div class="statgrid"><div class="stat"><span>Communes correspondant aux filtres</span><strong>${cs.length}<small> / 87</small></strong><small>Référentiel 2026</small></div><div class="stat"><span>Missions de la campagne</span><strong>${ms.length}</strong><small>${done} terminée(s)</small></div><div class="stat"><span>Résultats agrégés</span><strong>${rs.length}</strong><small>Lignes exploitables</small></div><div class="stat"><span>Équipes / groupes</span><strong>${currentTeam().length}</strong><small>Rôles logistiques uniquement</small></div></div><div class="twocol">${panel("Carte interactive", `<div id="map-dashboard" class="map-area" role="region" aria-label="Carte interactive des communes"></div><div class="map-caption"><span>Contours officiels des communes</span><button class="linkbtn" data-nav="carte">Ouvrir la carte complète</button></div>`)}${panel("Missions récentes", missionRows(ms.slice(-5).reverse()), '<button class="linkbtn" data-nav="actions">Voir toutes les missions</button>')}${panel("Vos briques", `<div class="module-grid"><button data-nav="territoires">◎ <strong>Territoires</strong><span>87 communes</span></button><button data-nav="imports">⇅ <strong>Import</strong><span>CSV et XLSX</span></button><button data-nav="analyse">▥ <strong>Résultats</strong><span>Participation agrégée</span></button><button data-nav="memoire">▤ <strong>Archives</strong><span>Bilans transmissibles</span></button></div>`)}</div>`;
}
function viewTerritoires() {
  const c = matching();
  const groups = [
    ["Canton", territory.cantons, "canton"],
    ["Intercommunalité", territory.epci, "epci"],
  ]
    .map(
      ([label, items, key]) =>
        `<div><h3>${label}</h3><div class="bar-list">${items
          .map((v) => {
            const n = c.filter((t) => t[key] === v).length;
            return `<div class="bar-row"><span>${esc(v)}</span><strong>${n}</strong><div class="track"><i style="width:${(100 * n) / 87}%"></i></div></div>`;
          })
          .join("")}</div></div>`,
    )
    .join("");
  return `${panel("Territoire de référence", `<p class="description">87 communes, 3 cantons et 5 intercommunalités. Les limites électorales restent distinctes des cantons actuels ; la liste correspond à la circonscription et non à la totalité des cantons.</p><div class="mini-meta"><span>Géographie : 2026</span><span>Périmètre : législatives 33-11</span><span>Centres cartographiques : API publique à la demande</span></div><div class="groupgrid">${groups}</div>`)}${panel(`Communes (${c.length})`, `<div class="tablewrap"><table><thead><tr><th>Commune</th><th>Canton actuel</th><th>Intercommunalité</th></tr></thead><tbody>${c.map((t) => `<tr><td><strong>${esc(t.nom)}</strong></td><td>${esc(t.canton)}</td><td>${esc(t.epci)}</td></tr>`).join("")}</tbody></table></div>`, '<button class="btn btn-light" data-action="export-territory">CSV</button>')}</div>`;
}
function viewCarte() {
  if (mapSelection.kind === "bureau" && !bureauxLayer) void loadBureauLayer();
  const ballots = electionBallots(),
    [leftBallot, rightBallot] = comparedBallots(),
    compareLeft = leftBallot?.id || "",
    compareRight = rightBallot?.id || "",
    selectedNames = mapSelectionCommunes();
  const scopeKinds = [
    ["commune", "Commune"],
    ["epci", "Intercommunalité"],
    ["canton", "Canton"],
    ["bureau", "Bureau de vote"],
    ["sector", "Secteur enregistré"],
  ];
  const scopeOptions =
    mapSelection.kind === "commune"
      ? territory.communes.map((c) => [c.nom, c.nom])
      : mapSelection.kind === "epci"
        ? territory.epci.map((x) => [x, x])
        : mapSelection.kind === "canton"
          ? territory.cantons.map((x) => [x, x])
          : mapSelection.kind === "sector"
            ? demoSectors.map((x) => [
                x.id,
                x.name + (x.commune ? " · " + x.commune : ""),
              ])
            : bureauFeatures().map((f) => {
                const p = f.properties || {};
                return [
                  String(p.id || p.code || p.bureau || ""),
                  p.nom || p.bureau || p.id || "Bureau de vote",
                ];
              });
  const opt = (v, l, sel) =>
    '<option value="' +
    attr(v) +
    '"' +
    (sel ? " selected" : "") +
    ">" +
    esc(l) +
    "</option>";
  const layerOptions = MAP_LAYERS.map((row) =>
    opt(row[0], row[1], filters.mapLayer === row[0]),
  ).join("");
  const scopeKindOptions = scopeKinds
    .map((row) => opt(row[0], row[1], mapSelection.kind === row[0]))
    .join("");
  const scopeValueOptions = scopeOptions.length
    ? scopeOptions
        .map((row) => opt(row[0], row[1], mapSelection.value === row[0]))
        .join("")
    : '<option value="">' +
      (mapSelection.kind === "bureau"
        ? "Contours de bureaux non chargés"
        : "Aucun élément enregistré") +
      "</option>";
  const modeButtons = [
    ["explore", "Explorer"],
    ["compare", "Comparer"],
    ["draw", "Dessiner"],
    ["organize", "Organiser"],
  ]
    .map(
      (row) =>
        '<button class="btn ' +
        (mapMode === row[0] ? "btn-primary" : "btn-light") +
        ' btn-sm" data-map-mode="' +
        row[0] +
        '">' +
        row[1] +
        "</button>",
    )
    .join("");
  const streetOptions = territory.communes
    .map((c) => opt(c.nom, c.nom, filters.commune === c.nom))
    .join("");
  const selectedSector = demoSectors
    .map(
      (x) =>
        '<div class="sector-entry"><button class="sector-item ' +
        (mapSelection.kind === "sector" && mapSelection.value === x.id
          ? "selected"
          : "") +
        '" data-sector-select="' +
        attr(x.id) +
        '">' +
        esc(x.name) +
        "<small>" +
        esc(x.commune || "Secteur intercommunal") +
        '</small></button><button type="button" class="btn btn-light btn-sm" data-sector-edit="' + attr(x.id) + '">Modifier</button><button type="button" class="btn btn-light btn-sm" data-sector-export="' + attr(x.id) + '">GeoJSON</button><button type="button" class="btn btn-danger btn-sm" data-sector-delete="' + attr(x.id) + '">Supprimer</button></div>',
    )
    .join("");
  const comparable = leftBallot?.type === rightBallot?.type && leftBallot?.tour === rightBallot?.tour;
  const compareControls = mapMode === "compare" ? `<section><h3>Comparer deux scrutins</h3><label>Carte A<select id="compare-left">${ballots.map(b => opt(b.id,b.label,b.id===compareLeft)).join("")}</select></label><label>Carte B<select id="compare-right">${ballots.map(b => opt(b.id,b.label,b.id===compareRight)).join("")}</select></label><p class="hint">Participation en % des inscrits ; écart en points. ${comparable ? "Même type de scrutin et même tour." : "Attention : types de scrutin ou tours différents, interprétation prudente."} Les communes sans résultat à un tour restent indisponibles.</p></section>` : "";
  const streetsHtml = `<div class="street-results">${streetSearchResults.map((s,i)=>`<button type="button" class="street-result" data-street-index="${i}"><strong>${esc(s.name)}</strong><small>Ajouter cette voie</small></button>`).join("")}</div><div class="selected-streets">${selectedStreets.map((s,i)=>`<span class="street-chip">${esc(s.name)} <button type="button" data-remove-street="${i}" aria-label="Retirer ${attr(s.name)}">×</button></span>`).join("")}</div>`;
  const activeSector = demoSectors.find(s => s.id === sectorBeingEdited);
  const sectorForm = mapMode === "draw" ? `<section><h3>${activeSector ? "Modifier le secteur" : "Nouveau secteur"}</h3><label>Nom<input id="sector-name" maxlength="100" value="${attr(activeSector?.name||"")}" placeholder="Ex. Bourg centre"></label><label>Couleur<input id="sector-color" type="color" value="${attr(activeSector?.color||"#9c6b2a")}"></label><p class="hint">Dessinez sur la carte, puis cliquez sur Enregistrer le contour. Clic droit sur un sommet pour le retirer.</p></section>` : "";
  const leftRows = mapCommunesFor(filters.mapLayer, compareLeft),rightIndex = new Map(mapCommunesFor(filters.mapLayer, compareRight).map(c=>[c.codeInsee,c]));
  const comparison = mapMode === "compare" ? `<div class="map-compare-table"><strong>Écarts A − B · points de participation</strong><p class="hint">Ministère de l’Intérieur · ${esc(leftBallot?.label || "")} / ${esc(rightBallot?.label || "")}. Seules les communes ayant deux résultats sont comparées.</p><div class="tablewrap"><table><thead><tr><th>Commune</th><th>${esc(leftBallot?.label || "A")}</th><th>${esc(rightBallot?.label || "B")}</th><th>Écart (points)</th></tr></thead><tbody>${leftRows.filter(a=>Number.isFinite(a.mapValue)&&Number.isFinite(rightIndex.get(a.codeInsee)?.mapValue)).map(a=>{const b=rightIndex.get(a.codeInsee),d=a.mapValue-b.mapValue;return `<tr><td>${esc(a.nom)}</td><td>${a.mapValue.toFixed(1)}</td><td>${b.mapValue.toFixed(1)}</td><td>${d>=0?"+":""}${d.toFixed(1)}</td></tr>`}).join("")}</tbody></table></div></div>` : "";
  let priorityControls = "";
  if (filters.mapLayer === "priority") {
    const socioOptions = MAP_LAYERS.filter(
      (x) => !["participation", "priority"].includes(x[0]),
    )
      .map((row) => opt(row[0], row[1], filters.prioritySocio === row[0]))
      .join("");
    priorityControls =
      '<div class="priority-controls"><label>Indicateur socio-démographique<select id="priority-socio">' +
      socioOptions +
      '</select></label><label>Poids électoral <input id="priority-electoral-weight" type="range" min="0" max="100" step="5" value="' +
      attr(filters.priorityElectoralWeight) +
      '"><strong>' +
      filters.priorityElectoralWeight +
      '%</strong></label><label>Poids socio-démographique <input id="priority-socio-weight" type="range" min="0" max="100" step="5" value="' +
      attr(filters.prioritySocioWeight) +
      '"><strong>' +
      filters.prioritySocioWeight +
      "%</strong></label></div>";
  }
  const bureauWarning =
    mapSelection.kind === "bureau" && !bureauFeatures().length
      ? '<section><div class="warning-note">Aucun périmètre officiel de bureau n’est fourni. Importez un GeoJSON validé par la collectivité ; aucune frontière ne sera inventée.</div><label>Importer des bureaux (GeoJSON)<input id="bureau-import" type="file" accept=".geojson,.json,application/geo+json"></label></section>'
      : "";
  const maps =
    mapMode === "compare"
      ? '<div class="compare-maps"><div><div class="map-map-title">Carte A · ' +
        esc(leftBallot?.label || "") +
        '</div><div id="map-left" class="map-area map-compare-area"></div></div><div><div class="map-map-title">Carte B · ' +
        esc(rightBallot?.label || "") +
        '</div><div id="map-right" class="map-area map-compare-area"></div></div></div>'
      : '<div id="map" class="map-area"></div>';
  const modeLabel =
    mapMode === "compare"
      ? "Comparer deux millésimes"
      : mapMode === "draw"
        ? "Dessiner et enregistrer un secteur"
        : mapMode === "organize"
          ? "Organiser les actions"
          : "Explorer les données";
  return (
    '<div class="map-head"><div><div class="kicker">ESPACE CARTOGRAPHIQUE</div><h2>Carte territoriale interactive</h2><p>Résultats électoraux et données socio-démographiques croisés pour repérer les secteurs d’action, avec surbrillance translucide de la zone sélectionnée.</p></div><div class="map-mode-tabs">' +
    modeButtons +
    '</div></div><div class="map-workspace"><aside class="map-rail"><section><h3>Indicateur cartographique</h3><select id="map-layer">' +
    layerOptions +
    '</select><p class="hint">' +
    (filters.mapLayer === "priority"
      ? "Score exploratoire : participation faible + indicateur socio sélectionné. Il aide à prioriser, sans prédire un comportement individuel."
      : filters.mapLayer === "participation"
        ? "Résultats publics agrégés depuis 2008."
        : "Indicateur socio-démographique communal issu du référentiel public.") +
    "</p>" +
    priorityControls + compareControls +
    '</section><section><h3>Zone à surligner</h3><select id="map-scope">' +
    scopeKindOptions +
    '</select><select id="map-scope-value" class="map-scope-value"><option value="">Choisir…</option>' +
    scopeValueOptions +
    '</select><p class="hint">' +
    esc(mapSelectionLabel()) +
    " · " +
    selectedNames.length +
    ' commune(s) concernée(s). La sélection apparaît en transparence au-dessus du fond cartographique.</p><button class="btn btn-light btn-sm map-rail-action" data-action="clear-map-selection">Réinitialiser la sélection</button></section>' +
    bureauWarning +
    '<section><h3>Recherche de rues</h3><form id="street-search-form"><label>Commune<select name="commune"><option value="">Choisir…</option>' +
    streetOptions +
    '</select></label><label>Rue<input name="query" placeholder="Ex. rue Nationale"></label><button class="btn btn-light btn-sm map-rail-action" type="submit">Rechercher dans la BAN</button></form>' + streetsHtml + '<p class="hint">Les rues sélectionnées sont reprises automatiquement dans l’action créée depuis la carte.</p></section>' + sectorForm + '<section><h3>Secteurs enregistrés</h3>' +
    (demoSectors.length
      ? '<div class="sector-list">' + selectedSector + "</div>"
      : empty(
          "Aucun secteur",
          "Dessinez un secteur et enregistrez-le depuis la carte.",
        )) +
    '</section></aside><div class="map-main"><div class="map-mode-note"><strong>' +
    modeLabel +
    "</strong><span>" +
    selectedNames.length +
    " commune(s) dans la sélection</span></div>" +
    maps + comparison +
    '<div class="map-caption"><span>Couleur : ' +
    esc(
      filters.mapLayer === "priority"
        ? "score exploratoire de priorité"
        : "indicateur sélectionné",
    ) +
    '</span><span>© IGN · geo.api.gouv.fr · données agrégées</span></div></div><aside class="map-detail"><div class="map-selection-summary"><strong>' +
    esc(mapSelectionLabel()) +
    "</strong><span>" +
    selectedNames.length +
    " commune(s) surlignée(s)</span><small>" +
    (filters.mapLayer === "priority"
      ? "Le score est calculé à partir de données agrégées et ne décrit aucune personne."
      : "Les contours sélectionnés sont affichés avec une transparence renforcée.") +
    "</small></div>" +
    mapDetail() +
    '<div class="map-source-card"><strong>Sources et méthode</strong><p>Résultats électoraux depuis 2008 et indicateurs socio-démographiques publics. Les données manquantes restent visibles comme indisponibles.</p><a href="https://geo.api.gouv.fr/decoupage-administratif/communes" target="_blank" rel="noopener noreferrer">Documentation geo.api.gouv.fr ↗</a><a href="https://adresse.data.gouv.fr/api-doc/adresse" target="_blank" rel="noopener noreferrer">Documentation API Adresse ↗</a></div><div class="map-action-card"><strong>Action depuis la carte</strong><p>' +
    (mapSelection.value
      ? esc(mapSelectionLabel()) + " · " + selectedNames.length + " commune(s) · " + selectedStreets.length + " rue(s)"
      : "Sélectionnez une commune ou une zone enregistrée.") +
    '</p><button class="btn btn-primary btn-sm" data-action="new-mission-from-map">Créer une action avec cette sélection</button></div></aside></div>'
  );
}
function missionRows(data) {
  return data.length
    ? `<div class="mission-list">${data.map((m) => `<div class="mission-line"><div class="mission-icon">${m.type?.startsWith("Porte") ? "⌂" : "□"}</div><div class="mission-info"><strong>${esc(m.title)}</strong><span>${esc(m.commune)} ${m.secteur ? "· " + esc(m.secteur) : ""}</span><small>${esc(m.type || "Action")} · ${esc(m.assignee || "Non attribuée")}</small></div><span class="status status-${m.status === "Terminée" ? "done" : m.status === "En cours" ? "progress" : "todo"}">${esc(m.status)}</span>${fullEditor() ? `<button class="icon-btn" data-edit-mission="${attr(m.id)}" aria-label="Modifier la mission ${attr(m.title)}">✎</button>` : fieldEditor() ? `<label class="status-editor"><span class="sr-only">Statut de la mission ${attr(m.title)}</span><select data-mission-status="${attr(m.id)}" aria-label="Modifier le statut de ${attr(m.title)}">${STATUSES.map((s) => `<option ${s === m.status ? "selected" : ""}>${esc(s)}</option>`).join("")}</select></label>` : ""}</div>`).join("")}</div>`
    : empty(
        "Aucune mission",
        "Ajoutez une action ou modifiez les filtres géographiques.",
      );
}
function viewActions() {
  let ms = filteredMissions();
  return `${panel("Planifier les actions", `<p class="description">Organisez les actions de terrain, les marchés, les réunions et la couverture des secteurs. Les données nominatives ne sont pas collectées dans cette démo publique.</p>${fullEditor() ? '<button class="btn btn-primary" data-action="new-mission">+ Ajouter une action</button>' : fieldEditor() ? '<p class="hint">Modifiez uniquement le statut des actions ci-dessous. Pour voir les changements des autres appareils, actualisez les actions.</p><button class="btn btn-light" data-action="refresh-server">Actualiser les actions</button>' : '<p class="hint">Mode lecture seule.</p>'}`, `<span class="tag">${currentMissions().length} actions</span>`)}${panel("Tableau des actions", missionRows(ms))}`;
}
function viewAnalyse() {
  const rows = filteredResults(),
    groups = summaryByScrutin(rows),
    max = Math.max(1, ...groups.map((g) => rate(g.votants, g.inscrits) || 0));
  return `${panel("Participation électorale agrégée", `<p class="description">Statistiques descriptives issues de résultats publics importés et documentés. Aucun score individuel, prédiction de vote ou fichier d’électeurs.</p>${groups.length ? `<div class="chartlist">${groups.map((g) => `<div class="chart-item"><div><strong>${esc(g.scrutin)}</strong><small>${esc([g.annee, g.tour].filter(Boolean).join(" · "))} · ${g.count} ligne(s)</small></div><div class="chartbar"><i style="width:${((100 * (rate(g.votants, g.inscrits) || 0)) / max).toFixed(1)}%"></i></div><span class="chartnum">${pct(g.votants, g.inscrits)}</span></div>`).join("")}</div>` : empty("Aucun résultat importé", "Ouvrez « Imports et exports » pour intégrer les données électorales publiques au format CSV ou XLSX.")}`)}${panel(
    "Données disponibles",
    rows.length
      ? `<div class="tablewrap"><table><thead><tr><th>Commune</th><th>Scrutin</th><th>Bureau</th><th>Inscrits</th><th>Votants</th><th>Participation</th><th>Source</th></tr></thead><tbody>${rows
          .slice(0, 250)
          .map(
            (r) =>
              `<tr><td>${esc(r.commune)}</td><td>${esc(r.scrutin)}</td><td>${esc(r.bureau || "—")}</td><td class="num">${fmtNumber(r.inscrits)}</td><td class="num">${fmtNumber(r.votants)}</td><td class="num">${pct(r.votants, r.inscrits)}</td><td title="${attr(r.source)}">${esc(r.source.slice(0, 55))}</td></tr>`,
          )
          .join(
            "",
          )}</tbody></table></div>${rows.length > 250 ? '<p class="hint">250 premières lignes affichées. Utiliser l’export CSV pour obtenir l’ensemble.</p>' : ""}`
      : empty("Aucune donnée disponible"),
  )}`;
}
function viewImports() {
  return `${panel("Importer les résultats électoraux", `<p class="description">Import de fichiers <strong>CSV ou Excel XLSX</strong>, avec vérification des colonnes, des effectifs, des doublons et de la présence d’un lien ou titre de source. L’import est entièrement local.</p><div class="import-zone"><label for="import-results" class="file-label">Sélectionner un fichier CSV / XLSX</label><input type="file" id="import-results" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"/><p>Colonnes : <code>commune; scrutin; inscrits; votants; exprimes; source</code></p><p>Optionnelles : <code>bureau; tour; annee; code_insee</code></p><button class="btn btn-light" data-action="download-example">Télécharger un modèle fictif</button></div><p class="warning-note">Ne pas importer de listes électorales nominatives, listes d’émargement, coordonnées personnelles, opinions politiques ni préférences de vote. Les colonnes non autorisées bloquent l’import.</p>`)}${panel("Sauvegarder et transférer", `<div class="button-row"><button class="btn btn-primary" data-action="backup">Exporter campagnes, actions et secteurs (JSON)</button><button class="btn btn-light" data-action="export-results">Exporter les résultats (CSV)</button><label class="btn btn-light file-label" for="restore-backup">Restaurer une sauvegarde JSON</label><input id="restore-backup" type="file" accept=".json,application/json" class="sr-only"/></div><p class="hint">La sauvegarde inclut les campagnes, résultats importés, actions, groupes, archives, brouillons, secteurs et filtres. Elle exclut les contacts et inscriptions fictifs ainsi que les périmètres de bureaux importés. Conservez-la de façon sécurisée ; aucun compte serveur ni synchronisation dans cette version.</p>`)}`;
}
function viewCommunication() {
  return `${panel("Communications générales", `<p class="description">Préparation des publications, lettres d’information et annonces publiques. Les envois à des contacts individuels nécessiteront un système d’abonnement volontaire et une infrastructure sécurisée, non activés dans ce prototype.</p><form id="draft-form" class="form-grid"><label>Support<select name="channel"><option>E-mail (abonnés volontaires)</option><option>SMS (abonnés volontaires)</option><option>Publication publique</option></select></label><label>Objet / thème<input name="subject" maxlength="120" required placeholder="Information sur la réunion publique"/></label><label class="full">Contenu<textarea name="content" rows="5" maxlength="4000" required placeholder="Rédiger un message général...">${esc(draftText)}</textarea></label><button class="btn btn-primary" type="submit">Enregistrer le brouillon</button></form><p class="hint">Aucun envoi réel, aucun fichier de contacts et aucune segmentation des destinataires.</p>`)}${panel(
    "Brouillons de la campagne",
    currentDrafts().length
      ? `<div class="item-list">${currentDrafts()
          .map(
            (d) =>
              `<div class="note-line"><div><strong>${esc(d.subject)}</strong><small>${esc(d.channel)}</small><p>${esc(d.content).slice(0, 220)}</p></div><div class="note-actions"><button class="btn btn-light btn-sm" data-copy-draft="${attr(d.id)}">Copier</button><button class="icon-btn" data-delete-draft="${attr(d.id)}" aria-label="Supprimer le brouillon">×</button></div></div>`,
          )
          .join("")}</div>`
      : empty("Aucun brouillon enregistré"),
  )}`;
}
function viewEquipes() {
  return `${panel("Coordonner les équipes", `<p class="description">Créez des groupes et associez un volontaire à ses actions souhaitées. La démo publique n’est pas destinée à recevoir des listes nominatives réelles.</p><form id="team-form" class="form-grid"><label>Nom du groupe<input name="name" maxlength="60" required placeholder="Équipe secteur Nord"/></label><label>Commune de référence<select name="commune"><option value="">Toutes</option>${territory.communes.map((c) => `<option>${esc(c.nom)}</option>`).join("")}</select></label><label>Volontaire / identifiant interne<input name="volunteer" maxlength="80" placeholder="À renseigner dans l’espace privé"/></label><label>Actions souhaitées<select name="volunteerActions" multiple size="4">${VOLUNTEER_ACTIONS.map((a) => `<option>${a}</option>`).join("")}</select></label><p class="warning-note full">Les e-mails, téléphones, listes électorales et émargements doivent rester dans l’espace privé sécurisé, jamais dans ce dépôt public.</p><button class="btn btn-primary" type="submit">Créer le groupe / volontaire</button></form>`)}${panel(
    `Groupes de la campagne (${currentTeam().length})`,
    currentTeam().length
      ? `<div class="item-list">${currentTeam()
          .map(
            (t) =>
              `<div class="note-line"><div><strong>${esc(t.name)}</strong><small>${esc(t.commune || "Territoire entier")}${t.volunteer ? " · " + esc(t.volunteer) : ""}${t.volunteerActions?.length ? " · " + esc(t.volunteerActions.join(", ")) : ""}</small></div><button class="icon-btn" data-delete-team="${attr(t.id)}" aria-label="Supprimer le groupe">×</button></div>`,
          )
          .join("")}</div>`
      : empty("Aucun groupe créé"),
  )}`;
}
function viewMemoire() {
  return `${panel("Transmettre la mémoire des campagnes", `<p class="description">Conservez les bilans, bonnes pratiques, décisions et retours d’expérience sans données personnelles. Les notes restent associées à leur campagne d’origine.</p><form id="memo-form" class="form-grid"><label>Titre<input name="title" maxlength="150" required placeholder="Bilan d’une réunion"/></label><label>Catégorie<select name="category"><option>Retour d’expérience</option><option>Organisation</option><option>Document de méthode</option><option>Bilan</option></select></label><label class="full">Note<textarea name="content" rows="4" maxlength="5000" required placeholder="Ce qui a été fait, ce qui a fonctionné, ce qui reste à améliorer..."></textarea></label><button class="btn btn-primary" type="submit">Archiver la note</button></form>`)}${panel(
    `Notes de la campagne (${currentNotes().length})`,
    currentNotes().length
      ? `<div class="item-list">${currentNotes()
          .map(
            (n) =>
              `<div class="note-line"><div><strong>${esc(n.title)}</strong><small>${esc(n.category)} · ${new Date(n.created).toLocaleDateString("fr-FR")}</small><p>${esc(n.content)}</p></div><button class="icon-btn" data-delete-note="${attr(n.id)}" aria-label="Supprimer la note">×</button></div>`,
          )
          .join("")}</div>`
      : empty(
          "Aucune archive",
          "Vous pouvez créer des bilans à réutiliser lors d’une campagne ultérieure.",
        ),
  )}`;
}
function viewConfig() {
  if (!fullEditor())
    return `${panel("Session", `<p class="description">Connecté : <strong>${esc(serverSession.username)}</strong> (${esc(serverSession.role)}). ${serverConnected ? "Les mises à jour de statut sont envoyées au serveur." : "Compte en lecture seule ou hors connexion."}</p><div class="button-row"><button class="btn btn-light" data-action=\"refresh-server\">Actualiser les missions</button><button class="btn btn-light" data-action=\"logout\">Déconnexion</button></div><p class="hint">Aucune donnée relative aux habitants ni opinion politique ne doit être saisie dans les missions.</p>`)}`;
  return `${panel("Connexion au serveur", serverSession ? `<p class="description">Connecté en tant que <strong>${esc(serverSession.username)}</strong> (${esc(serverSession.role)}). ${serverConnected ? "Synchronisation activée." : "Choisir explicitement quelle base utiliser."}</p><div class="button-row"><button class="btn btn-primary" data-action="pull-server">Charger la base du serveur</button>${serverSession.role === "admin" ? '<button class="btn btn-light" data-action="publish-server">Publier cette base locale sur le serveur</button>' : ""}<button class="btn btn-light" data-action="logout">Déconnexion</button></div><p class="hint">La synchronisation s’effectue uniquement après sélection. Les conflits entre appareils ne sont jamais fusionnés automatiquement.</p>` : `<p class="description">Pour synchroniser ordinateur et iPhone, déployer le serveur inclus dans ce projet sur un domaine HTTPS, puis se connecter. Ne pas utiliser de données personnelles pendant cette phase pilote.</p><form id="login-form" class="form-inline"><label>Identifiant<input name="username" autocomplete="username" required/></label><label>Mot de passe<input type="password" name="password" autocomplete="current-password" required/></label><button class="btn btn-primary" type="submit">Connexion</button></form><p class="hint">En mode statique, ce service est indisponible. Un compte doit d’abord être créé sur le serveur.</p>`)}${panel("Gérer les campagnes", `<p class="description">Chaque mission, note, groupe et brouillon appartient à une campagne. Les résultats électoraux publics restent dans une bibliothèque transversale.</p><div class="item-list">${app.campaigns.map((c) => `<div class="note-line"><div><strong>${esc(c.nom)}</strong><small>${esc(c.description || "")} ${app.current === c.id ? "· Active" : ""}</small></div>${app.current !== c.id ? `<button class="btn btn-light btn-sm" data-select-campaign="${attr(c.id)}">Activer</button>` : ""}</div>`).join("")}</div><form id="campaign-form" class="form-inline"><label>Nom de campagne<input name="name" maxlength="100" required placeholder="Élection — Année"/></label><label>Année<input type="number" min="1950" max="2100" name="year" value="2027" required/></label><button class="btn btn-primary" type="submit">Créer</button></form>`)}${panel("Protection et fonctionnement", `<div class="privacy-grid"><div><strong>Stockage local</strong><p>Les données se trouvent uniquement dans ce navigateur ; elles ne sont pas protégées par un compte.</p></div><div><strong>Pas de suivi individuel</strong><p>Aucun historique de vote ou appréciation politique d’une personne n’est admis.</p></div><div><strong>Mode hors connexion</strong><p>Les écrans, les données locales et les listes restent accessibles après la première visite. Les tuiles cartographiques nécessitent un réseau.</p></div><div><strong>Conservation</strong><p>Exporter les sauvegardes régulièrement et supprimer les données devenues inutiles.</p></div></div><div class="button-row"><button class="btn btn-light" data-action="backup">Télécharger une sauvegarde</button><button class="btn btn-danger" data-action="reset">Effacer les données locales</button></div>`)}${panel("Sources officielles", `<div class="links">${territory.meta.sources.map((s) => `<a href="${attr(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.titre)} ↗</a>`).join("")}</div><p class="hint">Avant exploitation réelle, faire vérifier les correspondances géographiques, le statut des sources et les droits de réutilisation.</p>`)}`;
}
function viewFundraising() {
  const total = demoFunds
    .filter((x) => x.status === "confirmée")
    .reduce((n, x) => n + Number(x.amount || 0), 0);
  const count = demoFunds.length;
  return (
    panel(
      "Financement — simulation",
      `<p class="description">Parcours de démonstration inspiré des outils de collecte : registre séparé, suivi des transactions et préparation de pages de collecte. Aucun paiement réel n’est possible ici et aucune donnée bancaire n’est demandée.</p><div class="statgrid"><div class="stat"><span>Montant confirmé</span><strong>${fmtNumber(total)}<small> €</small></strong><small>Données fictives locales</small></div><div class="stat"><span>Transactions</span><strong>${count}</strong><small>À rapprocher ou confirmées</small></div><div class="stat"><span>Structures</span><strong>1</strong><small>Simulation</small></div><div class="stat"><span>Paiement réel</span><strong>Non</strong><small>Activation juridique requise</small></div></div>`,
    ) +
    panel(
      "Enregistrer une transaction fictive",
      `<form id="fundraising-form" class="form-grid"><label>Nature<select name="kind"><option>Don de campagne</option><option>Cotisation d’association</option><option>Don à un parti</option></select></label><label>Montant<input name="amount" type="number" min="0" step="0.01" required></label><label>Statut<select name="status"><option value="à rapprocher">À rapprocher</option><option value="confirmée">Confirmée</option><option value="remboursée">Remboursée</option><option value="refusée">Refusée</option></select></label><label>Référence interne<input name="reference" maxlength="80" placeholder="Référence fictive"></label><button class="btn btn-primary" type="submit">Ajouter la transaction</button></form>`,
    ) +
    panel(
      "Journal financier",
      demoFunds.length
        ? `<div class="tablewrap"><table><thead><tr><th>Nature</th><th>Montant</th><th>Statut</th><th>Référence</th></tr></thead><tbody>${demoFunds
            .slice()
            .reverse()
            .map(
              (x) =>
                `<tr><td>${esc(x.kind)}</td><td class="num">${Number(x.amount).toFixed(2).replace(".", ",")} €</td><td>${esc(x.status)}</td><td>${esc(x.reference || "—")}</td></tr>`,
            )
            .join("")}</tbody></table></div>`
        : empty(
            "Aucune transaction",
            "Ajoutez une transaction fictive pour tester le parcours.",
          ),
    ) +
    panel(
      "Limites du prototype",
      `<p class="hint">Les cartes bancaires, le mandat financier, les reçus fiscaux et les exports réglementaires ne sont pas activés. Le module ne remplace pas la comptabilité ni le contrôle juridique.</p>`,
    )
  );
}
function viewEvents() {
  return (
    panel(
      "Événements publics",
      `<p class="description">Créer des événements ouverts à l’inscription, consulter leur capacité et simuler une confirmation. Aucun e-mail réel n’est envoyé depuis cette démonstration.</p><form id="event-form" class="form-grid"><label>Nom de l’événement<input name="title" maxlength="140" required placeholder="Réunion publique"></label><label>Commune<input name="commune" maxlength="120" required placeholder="Saint-André-de-Cubzac"></label><label>Date<input name="date" type="datetime-local" required></label><label>Nombre de places<input name="capacity" type="number" min="1" max="10000" value="50" required></label><label class="full">Description<textarea name="description" maxlength="600" rows="3" required></textarea></label><button class="btn btn-primary" type="submit">Publier en simulation</button></form>`,
    ) +
    panel(
      "Calendrier public",
      demoEvents.length
        ? `<div class="item-list">${demoEvents
            .slice()
            .sort((a, b) => a.date.localeCompare(b.date))
            .map(
              (x) =>
                `<div class="note-line"><div><strong>${esc(x.title)}</strong><small>${esc(x.commune)} · ${new Date(x.date).toLocaleString("fr-FR")} · ${x.registrations.length}/${x.capacity} place(s)</small><p>${esc(x.description)}</p></div><form class="event-register-form" data-event-id="${attr(x.id)}"><input name="name" maxlength="100" required placeholder="Nom fictif"><input name="email" type="email" maxlength="160" required placeholder="email@example.org"><button class="btn btn-light btn-sm" type="submit" ${x.registrations.length>=x.capacity?"disabled":""}>Simuler l’inscription</button></form></div>`,
            )
            .join("")}</div>`
        : empty(
            "Aucun événement public",
            "Créez un événement pour tester le parcours d’inscription.",
          ),
    ) +
    panel(
      "Règles du prototype",
      `<p class="hint">L’inscription et les préférences de communication restent distinctes. La confirmation électronique réelle sera activée uniquement après branchement d’un fournisseur sécurisé et validation du domaine.</p>`,
    )
  );
}
function viewContacts() {
  const tags = [
    "Contact rencontré",
    "À rappeler",
    "Invitation",
    "Bénévole potentiel",
    "Newsletter consentie",
    "Soutien associatif",
  ];
  return panel(
    "Carnet de terrain — contacts consentants",
    `<div class="notice warning-note"><strong>Usage responsable</strong><p>Cette base ne doit contenir que des personnes ayant accepté d’être recontactées. N’y inscrivez aucune intention de vote, opinion politique, résultat de vote ou déduction personnelle.</p></div><div class="twocol"><div><h3>Ajouter un contact</h3><form id="contact-form" class="form-grid"><label>Prénom<input name="firstName" maxlength="80" required></label><label>Nom<input name="lastName" maxlength="80" required></label><label class="full">Adresse ou point de contact<input name="address" maxlength="180" placeholder="Adresse communiquée volontairement"></label><label>Téléphone<input name="phone" type="tel" maxlength="30"></label><label>E-mail<input name="email" type="email" maxlength="160"></label><label>Commune<select name="commune"><option value="">Choisir…</option>${territory.communes.map((c) => `<option>${esc(c.nom)}</option>`).join("")}</select></label><label>Rencontré par<input name="volunteer" maxlength="100" placeholder="Nom du volontaire"></label><label class="full">Cadre de la rencontre<select name="context"><option>Non précisé</option><option>Porte-à-porte</option><option>Marché</option><option>Réunion publique</option><option>Dans la rue</option><option>Contact associatif</option></select></label><label class="full">Tags<select name="tags" multiple size="5">${tags.map((t) => `<option>${esc(t)}</option>`).join("")}</select></label><label class="full"><input type="checkbox" name="consent" required> La personne a demandé ou accepté d’être recontactée.</label><label class="full">Note de suivi<textarea name="note" maxlength="500" placeholder="Besoin exprimé, prochaine relance, action à proposer…"></textarea></label><div class="button-row"><button class="btn btn-primary" type="submit">Enregistrer le contact</button></div></form></div><div><h3>Contacts enregistrés (${demoContacts.length})</h3>${
      demoContacts.length
        ? `<div class="contact-list">${demoContacts
            .slice()
            .reverse()
            .map(
              (x) =>
                `<article class="contact-card"><div class="contact-card-head"><strong>${esc(x.firstName)} ${esc(x.lastName)}</strong><button class="icon-btn" data-contact-delete="${attr(x.id)}" aria-label="Supprimer ${attr(x.firstName)} ${attr(x.lastName)}">×</button></div><p>${esc(x.commune || "Commune non renseignée")} · ${esc(x.context || "Cadre non précisé")}</p><p>${x.phone ? `Téléphone : ${esc(x.phone)}` : "Téléphone non renseigné"} · ${x.email ? `E-mail : ${esc(x.email)}` : "E-mail non renseigné"}</p><div class="tag-row">${(x.tags || []).map((t) => `<span class="tag soft">${esc(t)}</span>`).join("")}</div><small>Dernière mise à jour : ${new Date(x.updatedAt).toLocaleDateString("fr-FR")}</small>${x.note ? `<p class="hint">${esc(x.note)}</p>` : ""}</article>`,
            )
            .join("")}</div>`
        : empty(
            "Aucun contact consentant",
            "Les contacts ajoutés ici pourront être reliés à des actions de terrain.",
          )
    }</div></div>`,
  );
}
const VIEWS = {
  dashboard: viewDashboard,
  profil: () =>
    viewPublicProfile({
      socio,
      matching,
      filters,
      esc,
      attr,
      fmtNumber,
      panel,
      empty,
    }),
  territoires: viewTerritoires,
  carte: viewCarte,
  actions: viewActions,
  analyse: () =>
    viewElectionHistory({
      elections,
      matching,
      filters,
      esc,
      attr,
      fmtNumber,
      pct,
      rate,
      panel,
      empty,
    }),
  imports: viewImports,
  communication: viewCommunication,
  equipes: viewEquipes,
  memoire: viewMemoire,
  financement: viewFundraising,
  evenements: viewEvents,
  contacts: viewContacts,
  config: viewConfig,
};
function missionModal() {
  if (!modal) return "";
  const m = editingMission || missionPrefill || {};
  const isEditing = Boolean(editingMission?.id);
  const selectedRues = m.rues || [];
  const rues = unique([
    ...(territory.communes.find((c) => c.nom === m.commune)?.rues || []),
    ...selectedRues,
  ]);
  return `<div class="modal-backdrop" id="modal-backdrop"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-title"><h2 id="modal-title">${isEditing ? "Modifier l’action" : "Ajouter une action"}</h2><button class="icon-btn" data-action="close-modal" aria-label="Fermer">×</button></div><form id="mission-form" class="form-grid"><label class="full">Intitulé<input name="title" maxlength="140" value="${attr(m.title || "")}" required placeholder="Présence sur le marché, porte-à-porte…"></label><label>Type<select name="type">${TYPE_ACTIONS.map((t) => `<option ${m.type === t ? "selected" : ""}>${esc(t)}</option>`).join("")}</select></label><label>Commune<select id="mission-commune" name="commune" required><option value="">Choisir…</option>${territory.communes.map((c) => `<option ${m.commune === c.nom ? "selected" : ""}>${esc(c.nom)}</option>`).join("")}</select></label><label>Secteur / rue<select id="mission-streets" name="rues" multiple size="4">${rues.length ? rues.map((r) => `<option ${selectedRues.includes(r) ? "selected" : ""}>${esc(r)}</option>`).join("") : "<option disabled>Veuillez sélectionner une commune avant de pouvoir sélectionner une rue</option>"}</select><small class="hint">Sélection multiple possible. Les secteurs regroupant plusieurs rues seront ajoutés dans l’espace administrateur.</small></label><label>Secteur personnalisé<input name="secteur" maxlength="120" value="${attr(m.secteur || "")}" placeholder="Secteur créé par l’administrateur"/></label><label>Tags<select name="tags" multiple size="4">${STANDARD_TAGS.map((t) => `<option ${(m.tags || []).includes(t) ? "selected" : ""}>${esc(t)}</option>`).join("")}</select></label><label>Retour sur l’action<select name="satisfaction"><option value="">Non renseigné</option>${[0, 1, 2, 3, 4, 5].map((n) => `<option value="${n}" ${String(m.satisfaction ?? "") === String(n) ? "selected" : ""}>${n} / 5</option>`).join("")}</select></label><label>Groupe responsable<select name="assignee"><option value="">Non attribuée</option>${currentTeam()
    .map(
      (t) =>
        `<option ${m.assignee === t.name ? "selected" : ""}>${esc(t.name)}</option>`,
    )
    .join(
      "",
    )}</select></label><label>Statut<select name="status">${STATUSES.map((s) => `<option ${s === (m.status || "À faire") ? "selected" : ""}>${s}</option>`).join("")}</select></label><label>Date prévue<input type="date" name="date" value="${attr(m.date || "")}"/></label><label class="full"><input type="checkbox" name="notifyApp" checked> Notification mobile à prévoir</label><label class="full"><input type="checkbox" name="notifyEmail" checked> Notification e-mail à prévoir</label><label class="full">Compte rendu logistique<textarea name="notes" maxlength="1200" rows="3" placeholder="Matériel, difficulté d’accès, bilan logistique…">${esc(m.notes || "")}</textarea></label><div class="form-actions"><button class="btn btn-light" type="button" data-action="close-modal">Annuler</button>${isEditing ? `<button class="btn btn-danger" type="button" data-action="delete-mission">Supprimer</button>` : ""}<button class="btn btn-primary" type="submit">Enregistrer</button></div></form></div></div>`;
}
function render() {
  if (!territory) return;
  savePreferences();
  root.innerHTML = `<div class="app-shell">${header()}<main class="workspace">${toolbar()}${notice ? `<div class="notice ${noticeLevel}" role="status">${esc(notice)} <button data-action="clear-notice" aria-label="Fermer le message">×</button></div>` : ""}<div class="content">${VIEWS[tab]()}</div><footer class="app-footer"><span>DemocrAction — V0.10</span><span>Prototype local · Pas de données personnelles · Ne pas utiliser en production</span></footer></main><div class="mobile-nav">${[
    ["dashboard", "▦", "Accueil"],
    ["territoires", "◎", "Territoires"],
    ["carte", "⌖", "Carte"],
    ["actions", "☷", "Actions"],
    ["config", "⚙", "Réglages"],
  ]
    .map(
      ([key, icon, text]) =>
        `<button data-nav="${key}" class="${tab === key ? "selected" : ""}"><span>${icon}</span><small>${text}</small></button>`,
    )
    .join("")}</div>${missionModal()}</div>`;
  if (tab === "carte" || tab === "dashboard") {
    const ticket = ++mapDrawId;
    const layer = MAP_LAYERS.find(x => x[0] === filters.mapLayer) || MAP_LAYERS[0];
    const [leftBallot, rightBallot] = comparedBallots();
    const compareA = leftBallot ? mapCommunesFor("participation", leftBallot.id) : [];
    const compareB = rightBallot ? mapCommunesFor("participation", rightBallot.id) : [];
    const mapOptions = {
      selectedNames: mapSelectionCommunes(),
      selectedSectorId:
        mapSelection.kind === "sector" ? mapSelection.value : "",
      bureauFeatures: bureauFeatures(),
      selectedBureauIds:
        mapSelection.kind === "bureau" && mapSelection.value
          ? [mapSelection.value]
          : [],
      sectors: demoSectors,
      missions: currentMissions(),
      editSector: demoSectors.find(s => s.id === sectorBeingEdited),
      allowDraw: tab === "carte" && mapMode === "draw",
      legendTitle: layer[1],
      legendUnit: layer[2],
      legendMethod: ["participation", "priority"].includes(filters.mapLayer) ? "fixed-percent" : "quantile",
      sourceLabel: filters.mapLayer === "participation" ? `Ministère de l’Intérieur · ${filters.electionYear || "dernier scrutin disponible"}` : filters.mapLayer === "priority" ? "Indice exploratoire · données agrégées" : `Insee · ${socio?.meta?.millesime || "millésime inconnu"}`,
      focusSelection: tab === "carte" && Boolean(mapSelection.value),
      streets: selectedStreets,
      onSelect: (commune, event) => {
        if (event?.originalEvent?.shiftKey || event?.originalEvent?.ctrlKey) {
          mapSelectedCommunes = mapSelectedCommunes.includes(commune.nom)
            ? mapSelectedCommunes.filter((name) => name !== commune.nom)
            : [...mapSelectedCommunes, commune.nom];
        } else mapSelectedCommunes = [commune.nom];
        mapSelection = { kind: "commune", value: commune.nom };
        filters.commune = commune.nom;
        render();
      },
      onSectorSelect: sectorId => {mapSelection={kind:"sector",value:sectorId};filters.commune="";render()},
      onBureauSelect: bureauId => {mapSelection={kind:"bureau",value:bureauId};filters.commune="";render()},
      onSectorComplete: saveSector,
      onNotice: (text, level) => console.log("Carte:", text, level),
    };
    requestAnimationFrame(() => {
      if (ticket !== mapDrawId) return;
      if (tab === "carte" && mapMode === "compare") {
        void drawMap(
          "map-left",
          compareA,
          console.log,
          { ...mapOptions, sourceLabel:`Ministère de l’Intérieur · ${leftBallot?.label || ""}`, legendValues:[...compareA,...compareB].map(x=>x.mapValue) },
        );
        void drawMap(
          "map-right",
          compareB,
          console.log,
          { ...mapOptions, sourceLabel:`Ministère de l’Intérieur · ${rightBallot?.label || ""}`, legendValues:[...compareA,...compareB].map(x=>x.mapValue) },
        );
      } else {
        const mapTarget = tab === "carte" ? "map" : "map-dashboard";
        void drawMap(mapTarget, mapCommunes(), console.log, mapOptions);
      }
    });
  }
}
function switchTab(next) {
  if (
    !fullEditor() &&
    ["imports", "communication", "equipes", "memoire"].includes(next)
  )
    next = "dashboard";
  tab = next;
  modal = "";
  missionPrefill = null;
  notice = "";
  window.scrollTo({ top: 0, behavior: "instant" });
  render();
}
function updateFilter(k, v) {
  filters[k] = v;
  if (k === "canton" || k === "epci") {
    const match = territory.communes.some(
      (c) =>
        c.nom === filters.commune &&
        (!filters.canton || c.canton === filters.canton) &&
        (!filters.epci || c.epci === filters.epci),
    );
    if (!match) filters.commune = "";
  }
  render();
}
const dlBackup = () =>
  download(
    JSON.stringify({format:"democraction-demo-backup-v1",application:{...app,lastSaved:new Date().toISOString()},sectors:demoSectors,preferences:{filters:Object.fromEntries(PREF_KEYS.map(key=>[key,filters[key]])),mapSelection,mapMode}},null,2),
    `democraction-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`,
  );
const dlResults = () =>
  download(
    serializeCsv(
      filteredResults().map((r) => ({ ...r, code_insee: r.codeInsee })),
      [
        "commune",
        "scrutin",
        "inscrits",
        "votants",
        "exprimes",
        "source",
        "bureau",
        "tour",
        "annee",
        "code_insee",
      ],
    ),
    `resultats-aggreges-${new Date().toISOString().slice(0, 10)}.csv`,
    "text/csv;charset=utf-8",
  );
const dlTerritory = () =>
  download(
    serializeCsv(matching(), ["nom", "canton", "epci"]),
    `communes-33-11.csv`,
    "text/csv;charset=utf-8",
  );
function resetData() {
  if (
    !confirm(
      "Effacer définitivement les missions, résultats, groupes, archives et brouillons enregistrés dans ce navigateur ? Cette opération est irréversible sans sauvegarde.",
    )
  )
    return;
  clearLocal();
  for (const key of ["democraction-demo-sectors", "democraction-demo-bureaux", "democraction-demo-contacts", "democraction-demo-funds", "democraction-demo-events", PREFS_KEY]) localStorage.removeItem(key);
  demoSectors = []; demoContacts = []; demoFunds = []; demoEvents = []; bureauxLayer = null;
  for (const key of PREF_KEYS) filters[key] = key === "mapLayer" ? "participation" : key === "prioritySocio" ? "tauxChomage" : ["priorityElectoralWeight", "prioritySocioWeight"].includes(key) ? "50" : "";
  mapSelection = {kind:"commune",value:""}; mapSelectedCommunes = []; mapMode = "explore"; selectedStreets = []; streetSearchResults = [];
  app = save(emptyState());
  enqueueSync();
  toast("Données locales réinitialisées.");
}
function dispatchAction(action) {
  switch (action) {
    case "backup":
      dlBackup();
      break;
    case "export-results":
      dlResults();
      break;
    case "export-territory":
      dlTerritory();
      break;
    case "download-example":
      download(
        serializeCsv(
          [
            {
              commune: "Commune fictive A",
              scrutin: "Démonstration 2026",
              inscrits: 1000,
              votants: 650,
              exprimes: 632,
              source: "DONNÉES FICTIVES",
              bureau: "",
              tour: "1",
              annee: "2026",
            },
          ],
          [
            "commune",
            "scrutin",
            "inscrits",
            "votants",
            "exprimes",
            "source",
            "bureau",
            "tour",
            "annee",
          ],
        ),
        "modele-resultats-fictifs.csv",
        "text/csv;charset=utf-8",
      );
      break;
    case "new-mission":
      missionPrefill = null;
      editingMission = null;
      modal = "mission";
      render();
      break;
    case "new-mission-from-map":
      const selectedSector=mapSelection.kind==="sector"?demoSectors.find(s=>s.id===mapSelection.value):null;
      const selectedBureau=mapSelection.kind==="bureau"?bureauFeatures().find(f=>String(f.properties?.id||f.properties?.code||f.properties?.bureau||"")===String(mapSelection.value)):null;
      const selectedNames=mapSelectionCommunes();
      const primary=selectedSector?.commune||selectedNames[0]||filters.commune;
      if (!primary) {
        toast(
          "Sélectionnez une commune ou un secteur rattaché à une commune.",
          "warning",
        );
        break;
      }
      missionPrefill = {
        commune: primary,
        rues: selectedStreets.map((x) => x.name),
        secteur: selectedSector?.name || "",
        zoneKind: mapSelection.kind,
        zoneId: selectedSector?.id || mapSelection.value || territory.communes.find(c=>c.nom===primary)?.codeInsee || "",
        zoneCommunes: selectedNames.length ? selectedNames : [primary],
        zoneGeometry: selectedSector?.geometry || selectedBureau?.geometry || selectionGeometry((selectedNames.length?selectedNames:[primary]).map(name=>territory.communes.find(c=>c.nom===name)?.codeInsee).filter(Boolean)),
      };
      editingMission = null;
      modal = "mission";
      render();
      break;
    case "clear-map-selection":
      mapSelectedCommunes = [];
      mapSelection = { kind: "commune", value: "" };
      filters.commune = "";
      selectedStreets = [];
      streetSearchResults = [];
      render();
      break;
    case "close-modal":
      modal = "";
      editingMission = null;
      render();
      break;
    case "delete-mission":
      if (editingMission && confirm("Supprimer cette mission ?")) {
        mutate((s) => ({
          ...s,
          missions: s.missions.filter((m) => m.id !== editingMission.id),
        }));
        modal = "";
        editingMission = null;
        render();
      }
      break;
    case "clear-filters":
      filters = {
        canton: "",
        epci: "",
        commune: "",
        query: "",
        socioIndicator: "",
        mapLayer: "participation",
        socioMin: "",
        socioMax: "",
        electionType: "",
        electionYear: "",
        electionTour: "",
        compareLeft: "",
        compareRight: "",
        prioritySocio: "tauxChomage",
        priorityElectoralWeight: "50",
        prioritySocioWeight: "50",
      };
      mapSelectedCommunes = [];
      mapSelection = { kind: "commune", value: "" };
      selectedStreets = [];
      streetSearchResults = [];
      render();
      break;
    case "clear-notice":
      notice = "";
      render();
      break;
    case "refresh-map":
      render();
      break;
    case "locate":
      if (!locate()) toast("Afficher d’abord la carte en ligne.", "warning");
      break;
    case "reset":
      resetData();
      break;
    case "pull-server":
      void loadFromServer();
      break;
    case "publish-server":
      void publishToServer(true);
      break;
    case "logout":
      void logoutServer();
      break;
    case "refresh-server":
      void refreshFromServer();
      break;
  }
}
root.addEventListener("click", (e) => {
  const t = e.target.closest("[data-contact-delete]");
  if (!t) return;
  if (!confirm("Supprimer ce contact de ce navigateur ?")) return;
  demoContacts = demoContacts.filter((x) => x.id !== t.dataset.contactDelete);
  localStorage.setItem(
    "democraction-demo-contacts",
    JSON.stringify(demoContacts),
  );
  render();
  toast("Contact supprimé.", "info");
});
root.addEventListener("click", async (e) => {
  const t = e.target.closest(
    "[data-nav],[data-action],[data-choose-commune],[data-map-mode],[data-street-index],[data-remove-street],[data-sector-select],[data-sector-edit],[data-sector-export],[data-sector-delete],[data-edit-mission],[data-delete-note],[data-delete-team],[data-delete-draft],[data-copy-draft],[data-select-campaign]",
  );
  if (!t) return;
  if (t.dataset.nav) {
    switchTab(t.dataset.nav);
    return;
  }
  if (t.dataset.mapMode) {
    mapMode = t.dataset.mapMode;
    if(mapMode==="compare")filters.mapLayer="participation";
    if(mapMode!=="draw")sectorBeingEdited=null;
    render();
    return;
  }
  if (t.dataset.sectorSelect) {
    mapSelection = { kind: "sector", value: t.dataset.sectorSelect };
    filters.commune = "";
    mapSelectedCommunes = mapSelectionCommunes();
    render();
    return;
  }
  if (t.dataset.sectorEdit) {
    sectorBeingEdited=t.dataset.sectorEdit;mapSelection={kind:"sector",value:sectorBeingEdited};mapMode="draw";filters.commune=demoSectors.find(s=>s.id===sectorBeingEdited)?.commune||"";render();return;
  }
  if (t.dataset.sectorExport) {
    const s=demoSectors.find(x=>x.id===t.dataset.sectorExport);if(s)download(JSON.stringify({type:"FeatureCollection",features:[{type:"Feature",properties:{id:s.id,name:s.name,color:s.color,commune:s.commune},geometry:s.geometry}]},null,2),`secteur-${s.id}.geojson`);return;
  }
  if (t.dataset.sectorDelete) {
    const s=demoSectors.find(x=>x.id===t.dataset.sectorDelete);if(!s||!confirm(`Supprimer « ${s.name} » de ce navigateur ?`))return;
    demoSectors=demoSectors.filter(x=>x.id!==s.id);localStorage.setItem("democraction-demo-sectors",JSON.stringify(demoSectors));sectorBeingEdited=null;if(mapSelection.value===s.id)mapSelection={kind:"commune",value:""};render();return;
  }
  if (t.dataset.streetIndex) {
    const street = streetSearchResults[Number(t.dataset.streetIndex)];
    if (street && !selectedStreets.some((x) => x.name === street.name))
      selectedStreets.push(street);
    render();
    return;
  }
  if (t.dataset.removeStreet) {
    selectedStreets.splice(Number(t.dataset.removeStreet), 1);
    render();
    return;
  }
  if (t.dataset.action) {
    dispatchAction(t.dataset.action);
    return;
  }
  if (t.dataset.chooseCommune) {
    filters.commune = t.dataset.chooseCommune;
    render();
    return;
  }
  if (t.dataset.editMission) {
    if (!fullEditor()) return;
    editingMission = app.missions.find((x) => x.id === t.dataset.editMission);
    modal = "mission";
    render();
    return;
  }
  if (t.dataset.selectCampaign) {
    app = save({ ...app, current: t.dataset.selectCampaign });
    render();
    enqueueSync();
    return;
  }
  for (const [key, store] of [
    ["deleteNote", "archives"],
    ["deleteTeam", "team"],
    ["deleteDraft", "drafts"],
  ]) {
    if (t.dataset[key]) {
      if (confirm("Supprimer cet élément ?"))
        mutate((s) => ({
          ...s,
          [store]: s[store].filter((x) => x.id !== t.dataset[key]),
        }));
      return;
    }
  }
  if (t.dataset.copyDraft) {
    const d = app.drafts.find((x) => x.id === t.dataset.copyDraft);
    if (d)
      try {
        await navigator.clipboard.writeText(`${d.subject}

${d.content}`);
        toast("Brouillon copié.");
      } catch {
        toast("Copie indisponible dans ce navigateur.", "warning");
      }
  }
});
root.addEventListener("click", (e) => {
  const action = e.target.closest("[data-action]")?.dataset.action;
  if (action === "clear-socio") {
    filters.socioIndicator = "";
    filters.socioMin = "";
    filters.socioMax = "";
    render();
  }
  if (action === "clear-election") {
    filters.electionType = "";
    filters.electionYear = "";
    filters.electionTour = "";
    render();
  }
});
root.addEventListener("change", async (e) => {
  const el = e.target;
  if (el.dataset.missionStatus) {
    void changeMissionStatus(el.dataset.missionStatus, el.value);
    return;
  }
  if (el.id === "campaign-select") {
    app = save({ ...app, current: el.value });
    render();
    enqueueSync();
    return;
  }
  if (el.id === "map-scope") {
    mapSelection = { kind: el.value, value: "" };
    mapSelectedCommunes = [];
    if (el.value === "bureau") void loadBureauLayer();
    render();
    return;
  }
  if (el.id === "map-scope-value") {
    mapSelection.value = el.value;
    if (mapSelection.kind === "commune") filters.commune = el.value;
    else filters.commune = "";
    mapSelectedCommunes = mapSelectionCommunes();
    render();
    return;
  }
  if (el.id === "map-commune") {
    filters.commune = el.value;
    mapSelectedCommunes = el.value ? [el.value] : [];
    mapSelection = { kind: "commune", value: el.value };
    render();
    return;
  }
  if (el.id === "compare-left") {
    filters.compareLeft = el.value;
    render();
    return;
  }
  if (el.id === "compare-right") {
    filters.compareRight = el.value;
    render();
    return;
  }
  if (el.id === "mission-commune") {
    const select = document.getElementById("mission-streets");
    if (select) {
      const rues =
        territory.communes.find((c) => c.nom === el.value)?.rues || [];
      select.innerHTML = rues.length
        ? rues.map((r) => `<option>${esc(r)}</option>`).join("")
        : "<option disabled>Veuillez sélectionner une commune avant de pouvoir sélectionner une rue</option>";
    }
    return;
  }
  if (el.id === "bureau-import") {
    const file=el.files?.[0];if(!file)return;
    try {
      if(file.size>2000000)throw new Error("Fichier supérieur à 2 Mo.");
      const data=JSON.parse(await file.text());
      if(data?.type!=="FeatureCollection"||!Array.isArray(data.features)||!data.features.length||data.features.length>500)throw new Error("Collection GeoJSON invalide.");
      const ids=new Set();for(const feature of data.features){const p=feature.properties||{},id=String(p.id||p.code||p.bureau||"");if(!id||ids.has(id)||feature.geometry===null||!validZone(feature.geometry))throw new Error("Identifiant ou géométrie de bureau invalide.");ids.add(id)}
      localStorage.setItem("democraction-demo-bureaux",JSON.stringify(data));bureauxLayer=data;render();toast(`${ids.size} bureau(x) chargés sur cet appareil.`);
    }catch(error){toast("Import des bureaux refusé : "+error.message,"warning")}
    return;
  }
  for (const name of ["canton", "epci", "commune"])
    if (el.id === "filter-" + name) {
      updateFilter(name, el.value);
      return;
    }
  if (el.id === "import-results") {
    const file = el.files?.[0];
    if (!file) return;
    try {
      if (file.size > 5e6) throw new Error("Fichier de 5 Mo maximum.");
      let parsed;
      if (/\.xlsx$/i.test(file.name)) parsed = await parseXlsx(file);
      else if (/\.csv$/i.test(file.name)) parsed = parseCsv(await file.text());
      else throw new Error("Format accepté : CSV ou XLSX uniquement.");
      const imported = validateElectionImport(parsed.headers, parsed.rows);
      const merged = mergeResults(app, imported);
      if (
        !confirm(
          `Fichier analysé : ${imported.length} lignes agrégées cohérentes. ${merged.added} nouvelles, ${merged.skipped} déjà présentes. Confirmer l’importation locale ?`,
        )
      )
        return;
      app = save(merged.state);
      enqueueSync();
      toast(
        `${merged.added} lignes importées ; ${merged.skipped} doublons ignorés.`,
      );
    } catch (err) {
      toast("Import refusé : " + err.message, "warning");
    }
    return;
  }
  if (el.id === "restore-backup") {
    const file = el.files?.[0];
    if (!file) return;
    try {
      if (file.size > 12e6) throw new Error("Fichier trop volumineux.");
      const source = JSON.parse(await file.text());
      const envelope = source.format === "democraction-demo-backup-v1";
      const next = envelope ? validateBackup(source.application) :
        source.version === 2 ? migrateLegacyV2(source) : validateBackup(source);
      let restoredSectors = null;
      if (envelope) {
        if (!Array.isArray(source.sectors) || source.sectors.length > 500 || source.sectors.some(s=>!s||typeof s.id!=="string"||typeof s.name!=="string"||!validPolygon(s.geometry)) || new Set(source.sectors.map(s=>s.id)).size !== source.sectors.length) throw new Error("Secteurs invalides dans la sauvegarde.");
        restoredSectors = source.sectors;
      }
      if (
        !confirm(
          "Remplacer les campagnes, actions, résultats et secteurs de ce navigateur par cette sauvegarde ? Les contacts et inscriptions fictifs ne sont pas concernés.",
        )
      )
        return;
      app = save(next);
      if (restoredSectors) { demoSectors = restoredSectors; localStorage.setItem("democraction-demo-sectors",JSON.stringify(demoSectors)); restorePreferences(source.preferences); savePreferences(); }
      enqueueSync();
      toast(envelope ? "Sauvegarde et secteurs restaurés." : "Ancienne sauvegarde restaurée ; elle ne contenait pas les secteurs.");
    } catch (err) {
      toast("Restauration impossible : " + err.message, "warning");
    }
    return;
  }
});
root.addEventListener("change", (e) => {
  const map = {
    "socio-indicator": "socioIndicator",
    "socio-min": "socioMin",
    "socio-max": "socioMax",
    "election-type": "electionType",
    "election-year": "electionYear",
    "election-tour": "electionTour",
    "map-layer": "mapLayer",
    "priority-socio": "prioritySocio",
    "priority-electoral-weight": "priorityElectoralWeight",
    "priority-socio-weight": "prioritySocioWeight",
  };
  const key = map[e.target.id];
  if (key) {
    filters[key] = e.target.value;
    render();
  }
});
root.addEventListener("input", (e) => {
  if (e.target.id === "filter-query") {
    filters.query = e.target.value;
    const p = e.target.selectionStart;
    render();
    const el = document.getElementById("filter-query");
    el?.focus();
    el?.setSelectionRange(p, p);
  }
});
root.addEventListener("submit", (e) => {
  const form = e.target;
  if (
    ![
      "mission-form",
      "team-form",
      "memo-form",
      "campaign-form",
      "street-search-form",
      "draft-form",
      "fundraising-form",
      "event-form",
      "event-register-form",
      "contact-form",
      "login-form",
    ].includes(form.id) && !form.classList.contains("event-register-form")
  )
    return;
  e.preventDefault();
  const fd = new FormData(form),
    get = (n) => String(fd.get(n) || "").trim();
  if (form.id === "street-search-form") {
    void searchStreets(get("query"), get("commune"));
    return;
  }
  if (form.id === "login-form") {
    void loginServer(get("username"), get("password"));
    return;
  }
  if (form.id === "contact-form") {
    const item = {
      id: id(),
      firstName: get("firstName"),
      lastName: get("lastName"),
      address: get("address"),
      phone: get("phone"),
      email: get("email"),
      commune: get("commune"),
      volunteer: get("volunteer"),
      context: get("context"),
      tags: fd
        .getAll("tags")
        .map((v) => String(v).trim())
        .filter(Boolean),
      consent: fd.get("consent") === "on",
      note: get("note"),
      updatedAt: new Date().toISOString(),
    };
    if (!item.firstName || !item.lastName || !item.consent) {
      toast(
        "Prénom, nom et consentement explicite sont obligatoires.",
        "warning",
      );
      return;
    }
    demoContacts.push(item);
    localStorage.setItem(
      "democraction-demo-contacts",
      JSON.stringify(demoContacts),
    );
    render();
    toast("Contact consentant enregistré localement.");
    return;
  }
  if (form.id === "fundraising-form") {
    const amount = Number(get("amount"));
    if (!Number.isFinite(amount) || amount <= 0) {
      toast("Montant invalide.", "warning");
      return;
    }
    demoFunds.push({
      id: id(),
      kind: get("kind"),
      amount,
      status: get("status"),
      reference: get("reference"),
      created: new Date().toISOString(),
    });
    localStorage.setItem("democraction-demo-funds", JSON.stringify(demoFunds));
    render();
    toast("Transaction fictive enregistrée.");
    return;
  }
  if (form.id === "event-form") {
    const capacity = Number(get("capacity"));
    if (
      !get("title") ||
      !get("commune") ||
      !get("date") ||
      !Number.isInteger(capacity) ||
      capacity < 1
    ) {
      toast("Événement incomplet.", "warning");
      return;
    }
    demoEvents.push({
      id: id(),
      title: get("title"),
      commune: get("commune"),
      date: get("date"),
      capacity,
      description: get("description"),
      registrations: [],
    });
    localStorage.setItem(
      "democraction-demo-events",
      JSON.stringify(demoEvents),
    );
    render();
    toast("Événement publié en simulation.");
    return;
  }
  if (form.classList.contains("event-register-form")) {
    const eventId = form.dataset.eventId,
      event = demoEvents.find((x) => x.id === eventId);
    if (!event || event.registrations.length >= event.capacity) {
      toast(
        "Inscription impossible : événement complet ou introuvable.",
        "warning",
      );
      return;
    }
    event.registrations.push({
      name: get("name"),
      email: get("email"),
      created: new Date().toISOString(),
    });
    localStorage.setItem(
      "democraction-demo-events",
      JSON.stringify(demoEvents),
    );
    render();
    toast("Inscription fictive enregistrée. Aucun e-mail envoyé.");
    return;
  }

  if (form.id === "mission-form") {
    const title = get("title"),
      commune = get("commune"),
      geo = territory.communes.some((c) => c.nom === commune);
    if (!title || !geo) {
      toast("Intitulé ou commune invalide.", "warning");
      return;
    }
    const item = {
      id: editingMission?.id || id(),
      campaignId: app.current,
      title,
      type: get("type"),
      commune,
      secteur: get("secteur"),
      zoneKind: editingMission?.zoneKind||missionPrefill?.zoneKind||"",
      zoneId: editingMission?.zoneId||missionPrefill?.zoneId||"",
      zoneCommunes: editingMission?.zoneCommunes||missionPrefill?.zoneCommunes||[commune],
      zoneGeometry: editingMission?.zoneGeometry||missionPrefill?.zoneGeometry||null,
      rues: fd
        .getAll("rues")
        .map((v) => String(v).trim())
        .filter(Boolean),
      tags: fd
        .getAll("tags")
        .map((v) => String(v).trim())
        .filter(Boolean),
      satisfaction:
        get("satisfaction") === "" ? null : Number(get("satisfaction")),
      assignee: get("assignee"),
      status: get("status"),
      date: get("date"),
      notes: get("notes"),
      notifyApp: fd.get("notifyApp") === "on",
      notifyEmail: fd.get("notifyEmail") === "on",
      created: editingMission?.created || new Date().toISOString(),
    };
    modal = "";
    editingMission = null;
    missionPrefill = null;
    mutate((s) => ({
      ...s,
      missions: s.missions.some((m) => m.id === item.id)
        ? s.missions.map((m) => (m.id === item.id ? item : m))
        : [...s.missions, item],
    }));
    toast("Mission enregistrée.");
    return;
  }
  if (form.id === "team-form") {
    if (get("name"))
      mutate((s) => ({
        ...s,
        team: [
          ...s.team,
          {
            id: id(),
            campaignId: s.current,
            name: get("name"),
            commune: get("commune"),
            volunteer: get("volunteer"),
            volunteerActions: fd
              .getAll("volunteerActions")
              .map((v) => String(v).trim())
              .filter(Boolean),
          },
        ],
      }));
    return;
  }
  if (form.id === "memo-form") {
    if (get("title") && get("content"))
      mutate((s) => ({
        ...s,
        archives: [
          {
            id: id(),
            campaignId: s.current,
            title: get("title"),
            category: get("category"),
            content: get("content"),
            created: new Date().toISOString(),
          },
          ...s.archives,
        ],
      }));
    return;
  }
  if (form.id === "draft-form") {
    if (get("subject") && get("content"))
      mutate((s) => ({
        ...s,
        drafts: [
          {
            id: id(),
            campaignId: s.current,
            channel: get("channel"),
            subject: get("subject"),
            content: get("content"),
            created: new Date().toISOString(),
          },
          ...s.drafts,
        ],
      }));
    return;
  }
  if (form.id === "campaign-form") {
    const name = get("name"),
      year = Number(get("year"));
    if (name && year >= 1950 && year <= 2100)
      mutate((s) => {
        const c = { id: id(), nom: name, annee: year, description: "" };
        return { ...s, campaigns: [...s.campaigns, c], current: c.id };
      });
    return;
  }
});

async function loginServer(username, password) {
  try {
    serverSession = await login(username, password);
    const remote = await fetchRemote();
    serverRevision = remote.revision;
    if (serverSession.role === "terrain" || serverSession.role === "lecture") {
      app = save(validateBackup(remote.state));
      serverConnected = serverSession.role === "terrain";
      toast(
        serverConnected
          ? "Accès terrain activé. Les statuts sont transmis au serveur."
          : "Compte en lecture seule connecté.",
      );
    } else {
      serverConnected = false;
      toast(
        "Connexion réussie. Choisir « Charger la base du serveur » ou « Publier cette base locale ».",
      );
    }
  } catch (e) {
    toast("Connexion impossible : " + e.message, "warning");
  }
}
async function refreshFromServer() {
  if (!serverSession) return;
  try {
    const remote = await fetchRemote();
    serverRevision = remote.revision;
    app = save(validateBackup(remote.state));
    serverConnected =
      serverSession.role === "terrain" || serverSession.role === "admin";
    toast("Missions actualisées depuis le serveur.");
  } catch (e) {
    serverConnected = false;
    toast("Actualisation impossible : " + e.message, "warning");
  }
}
async function changeMissionStatus(missionId, status) {
  if (!fieldEditor()) return toast("Connexion terrain nécessaire.", "warning");
  const old = app.missions.find((m) => m.id === missionId);
  if (!old) return toast("Mission inconnue.", "warning");
  if (old.status === status) return;
  try {
    await updateRemoteStatus(missionId, status, old.status, serverSession.csrf);
    const remote = await fetchRemote();
    serverRevision = remote.revision;
    app = save(validateBackup(remote.state));
    render();
    toast("Statut transmis au serveur.");
  } catch (e) {
    render();
    toast(
      (e.status === 409 ? "Conflit : " : "Envoi impossible : ") +
        e.message +
        ". Utiliser « Actualiser les missions ».",
      "warning",
    );
  }
}
async function loadFromServer() {
  try {
    if (
      !confirm(
        "Charger la version du serveur ? La base locale de ce navigateur sera remplacée. Exporter d’abord une sauvegarde si nécessaire.",
      )
    )
      return;
    const remote = await fetchRemote();
    app = save(validateBackup(remote.state));
    serverRevision = remote.revision;
    serverConnected = ["admin", "terrain"].includes(serverSession?.role);
    toast(
      "Base distante chargée. " +
        (serverConnected
          ? "Synchronisation activée."
          : "Accès en lecture seule."),
    );
  } catch (e) {
    toast("Chargement serveur impossible : " + e.message, "warning");
  }
}
async function publishToServer(confirmFirst = false) {
  if (!serverSession || serverSession.role !== "admin") return;
  try {
    if (
      confirmFirst &&
      !confirm(
        "Publier la base actuelle sur le serveur ? Les autres appareils verront ces données lors de leur prochaine actualisation.",
      )
    )
      return;
    const ans = await pushRemote(app, serverRevision, serverSession.csrf);
    serverRevision = ans.revision;
    serverConnected = true;
    toast("Base enregistrée sur le serveur ; synchronisation active.");
  } catch (e) {
    serverConnected = false;
    toast(
      "Publication interrompue : " +
        e.message +
        (e.status === 409
          ? " Rechargez la base distante ou restaurez une sauvegarde."
          : ""),
      "warning",
    );
  }
}
async function logoutServer() {
  const terrain = serverSession?.role === "terrain";
  try {
    if (serverSession) await logout(serverSession.csrf);
  } catch {}
  if (terrain) app = save(emptyState());
  serverSession = null;
  serverRevision = null;
  serverConnected = false;
  toast("Session terminée. Les données locales restent sur cet appareil.");
}
async function enqueueSync() {
  if (!serverConnected || !serverSession || serverSession.role !== "admin")
    return;
  serverPending = true;
  if (serverBusy) return;
  serverBusy = true;
  while (serverPending) {
    serverPending = false;
    try {
      const snapshot = JSON.parse(JSON.stringify(app));
      const response = await pushRemote(
        snapshot,
        serverRevision,
        serverSession.csrf,
      );
      serverRevision = response.revision;
    } catch (e) {
      serverConnected = false;
      serverPending = false;
      notice =
        "Synchronisation suspendue : " +
        e.message +
        " Les données locales sont conservées.";
      noticeLevel = "warning";
      render();
      break;
    }
  }
  serverBusy = false;
}
async function init() {
  try {
    const response = await fetch("./data/territoire-33-11-2026.json");
    if (!response.ok) throw new Error(response.status);
    territory = await response.json();
    if (territory.communes.length !== 87)
      throw new Error("Référentiel incomplet");
    try {
      const streets=await fetch("./data/street-catalog-33366.json");
      if(streets.ok){const rows=await streets.json(),sa=territory.communes.find(c=>c.codeInsee==="33366");if(sa&&Array.isArray(rows))sa.rues=unique(rows.filter(r=>r.commune===sa.nom).map(r=>r.name));}
    } catch(error){console.warn("Catalogue de rues indisponible",error)}
    render();
    checkSession()
      .then((s) => {
        if (s.authenticated) {
          serverSession = s;
          fetchRemote()
            .then((remote) => {
              serverRevision = remote.revision;
              if (s.role === "terrain" || s.role === "lecture") {
                app = save(validateBackup(remote.state));
                serverConnected = s.role === "terrain";
              }
              render();
            })
            .catch(() => {});
        }
      })
      .catch(() => {});
    if ("serviceWorker" in navigator && location.protocol !== "file:")
      navigator.serviceWorker
        .register("./sw.js?v=20261114map21")
        .catch(console.warn);
  } catch (e) {
    root.innerHTML = `<main class="fatal"><h1>Chargement du référentiel impossible</h1><p>Ouvrez cette application depuis un serveur web local (par exemple <code>python -m http.server 8080</code>), pas directement par un double clic sur index.html.</p><small>${esc(e.message)}</small></main>`;
  }
}
async function loadCompressedJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(response.status);
  const stream = response.body?.pipeThrough(new DecompressionStream("gzip"));
  if (!stream) throw new Error("Décompression gzip indisponible");
  return responseToJson(await new Response(stream).text());
}
async function responseToJson(text) {
  return JSON.parse(text);
}
async function loadPublicData() {
  try {
    const [socioResponse, electionData] = await Promise.all([
      fetch("./data/socio-demographie-v3.json?v=20261118"),
      loadCompressedJson("./data/elections-2008-2026.json.gz?v=20261113"),
    ]);
    if (!socioResponse.ok) throw new Error("Données publiques indisponibles");
    socio = await socioResponse.json();
    elections = electionData;
    render();
  } catch (error) {
    console.warn("Données publiques:", error);
  }
}
init();
loadPublicData();
