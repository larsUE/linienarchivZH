// Lädt das heutige Tramnetz aus OpenStreetMap: Linienrelationen, Haltepunkte und Gleise.
// Gleise und Haltestellen im Bau werden mitgeladen, weil frühere Linien sie befahren haben
// (z.B. Bahnhofquai/HB).
import { writeFile } from 'node:fs/promises';

const BBOX = '47.31,8.33,47.48,8.65';
const query = `
[out:json][timeout:180];
relation["route"="tram"](${BBOX})->.routes;
.routes out body;
(
  node(r.routes);
  node["railway"="tram_stop"](${BBOX});
  node["public_transport"="stop_position"]["tram"="yes"](${BBOX});
  node["construction:railway"="tram_stop"](${BBOX});
);
out body;
(
  way(r.routes)["railway"];
  way["railway"="tram"](${BBOX});
  way["construction:railway"="tram"](${BBOX});
  way["railway"="construction"]["construction"="tram"](${BBOX});
);
out geom;
`;

const SERVERS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
let json;
for (const url of SERVERS) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'linienarchiv-pilot/0.1' },
      body: 'data=' + encodeURIComponent(query),
      signal: AbortSignal.timeout(200_000),
    });
    if (!res.ok) throw new Error(`${res.status}`);
    json = await res.json();
    break;
  } catch (err) {
    console.warn(`${url} fehlgeschlagen: ${err.message}`);
  }
}
if (!json) throw new Error('Kein Overpass-Server erreichbar');
await writeFile(new URL('../data/raw/osm-tram.json', import.meta.url), JSON.stringify(json));
const count = (t) => json.elements.filter((e) => e.type === t).length;
console.log(`OSM-Stand ${json.osm3s?.timestamp_osm_base}: ${count('relation')} Relationen, ${count('node')} Knoten, ${count('way')} Gleise`);
