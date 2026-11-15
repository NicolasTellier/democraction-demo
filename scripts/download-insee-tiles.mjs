/** Download only the Insee Filosofi 2021 vector tiles meeting our 87-commune bbox.
 * Requires Node 24. Input for build-insee-grid.py; no national archive in the repository.
 * The PMTiles reader is fetched from Insee and checked against its pinned SHA-256.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';

const VENDOR = 'https://www.insee.fr/fr/outil-interactif/7737357/js/vendor/pmtiles-4.4.1.js';
const SOURCE = 'https://tiles.insee.fr/filosofi_2021_carreaux.pmtiles';
const VENDOR_SHA = '36bcbe1ba97cc07b3fc90cee9cba11729b04e25ec8790cf65a0787d5b38e091b';
const output = path.resolve(process.argv[2] || 'tmp/insee-tiles');
const response = await fetch(VENDOR);
if (!response.ok) throw new Error(`Insee PMTiles library unavailable (${response.status})`);
const script = await response.text();
if (crypto.createHash('sha256').update(script).digest('hex') !== VENDOR_SHA)
  throw new Error('Insee PMTiles library changed; review its new version before extraction');
const context = {TextDecoder, TextEncoder, fetch, Response, Request, Headers,
  DecompressionStream, AbortController, URL, Uint8Array, DataView, ArrayBuffer, Blob,
  console, CompressionStream};
vm.createContext(context);
vm.runInContext(script, context, {timeout: 3000});
const archive = new context.pmtiles.PMTiles(SOURCE);
const header = await archive.getHeader();
if (header.specVersion !== 3 || header.minZoom > 10 || header.maxZoom < 11)
  throw new Error('Insee PMTiles zoom levels changed');

const box = [-0.752677, 44.95324, 0.073291, 45.344536];
const tileX = (lon, z) => Math.floor((lon + 180) / 360 * (1 << z));
const tileY = (lat, z) => Math.floor((1 - Math.asinh(Math.tan(lat * Math.PI / 180)) / Math.PI) / 2 * (1 << z));
const tiles = [];
for (const z of [10, 11])
  for (let x = tileX(box[0], z); x <= tileX(box[2], z); x++)
    for (let y = tileY(box[3], z); y <= tileY(box[1], z); y++)
      tiles.push({z, x, y});
let cursor = 0, count = 0;
await Promise.all(Array.from({length: 4}, async () => {
  while (cursor < tiles.length) {
    const {z, x, y} = tiles[cursor++];
    const tile = await archive.getZxy(z, x, y);
    if (!tile) continue;
    const file = path.join(output, String(z), String(x), `${y}.pbf`);
    await fs.mkdir(path.dirname(file), {recursive: true});
    await fs.writeFile(file, new Uint8Array(tile.data));
    count++;
  }
}));
console.log(`${count} tuiles Insee téléchargées dans ${output}`);
