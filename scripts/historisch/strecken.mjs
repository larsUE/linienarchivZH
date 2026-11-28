// Rekonstruiert die Lage aufgehobener Tramstrecken über das heutige Strassennetz.
//
//   node scripts/historisch/strecken.mjs          (Strassen aus dem Zwischenspeicher)
//   node scripts/historisch/strecken.mjs --neu    (Strassen neu aus Overpass laden)
//
// Eingabe:  data/linien-historisch.yaml (historische_strecken, historische_haltestellen)
//           data/raw/osm-tram.json      (Lage der heutigen Haltestellen)
// Ausgabe:  data/historisch/gleise.json (eine Linie je Strecke, [Länge, Breite])
//
// Je Strecke wird zwischen aufeinanderfolgenden Wegpunkten der kürzeste Weg im Strassennetz gesucht.
// Strassen aus der Liste «strassen» zählen nur halb so lang, damit der Weg ihnen folgt, auch wenn es
// eine etwas kürzere Abkürzung gäbe. Das Ergebnis ist eine Rekonstruktion: Gleise lagen meist in der
// Strassenmitte, Kurven und Wendeschlaufen sind nicht bekannt.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { parse } from 'yaml';

const root = new URL('../../', import.meta.url);
const cfg = parse(await readFile(new URL('data/linien-historisch.yaml', root), 'utf8'));
const osm = JSON.parse(await readFile(new URL('data/raw/osm-tram.json', root), 'utf8'));
const CACHE = new URL('data/raw/osm/strassen-historisch.json', root);

const KOS = Math.cos((47.37 * Math.PI) / 180);
const meter = ([lon1, lat1], [lon2, lat2]) => Math.hypot((lon2 - lon1) * 111320 * KOS, (lat2 - lat1) * 110574);

// ---------- Wegpunkte ----------
const haltepunkte = new Map(); // Name -> [[lon, lat], ...]
for (const e of osm.elements) {
  const t = e.tags ?? {};
  if (e.type !== 'node' || !t.name || !(t.public_transport === 'stop_position' || t.railway === 'tram_stop')) continue;
  if (!haltepunkte.has(t.name)) haltepunkte.set(t.name, []);
  haltepunkte.get(t.name).push([e.lon, e.lat]);
}
for (const h of cfg.historische_haltestellen ?? []) haltepunkte.set(h.name, [h.lage]);
const lageVon = (p, id) => {
  if (Array.isArray(p)) return p;
  const pts = haltepunkte.get(p);
  if (!pts) throw new Error(`${id}: unbekannter Wegpunkt "${p}"`);
  return [pts.reduce((s, q) => s + q[0], 0) / pts.length, pts.reduce((s, q) => s + q[1], 0) / pts.length];
};
const strecken = cfg.historische_strecken ?? [];
const wegpunkte = new Map(strecken.map((s) => [s.id, s.punkte.map((p) => lageVon(p, s.id))]));

// ---------- Strassen laden ----------
const RAND = 0.006; // rund 500 m um die Wegpunkte
const boxen = strecken.map((s) => {
  const pts = wegpunkte.get(s.id);
  const lons = pts.map((p) => p[0]), lats = pts.map((p) => p[1]);
  return [Math.min(...lats) - RAND, Math.min(...lons) - RAND, Math.max(...lats) + RAND, Math.max(...lons) + RAND].map((v) => v.toFixed(4)).join(',');
});
let strassen = null;
if (!process.argv.includes('--neu')) strassen = await readFile(CACHE, 'utf8').then(JSON.parse, () => null);
if (strassen && strassen.boxen?.join('|') !== boxen.join('|')) strassen = null; // Wegpunkte geändert
if (!strassen) {
  const art = '^(motorway_link|trunk|trunk_link|primary|primary_link|secondary|secondary_link|tertiary|tertiary_link|unclassified|residential|living_street|pedestrian|service|road)$';
  const query = `[out:json][timeout:180];(${boxen.map((b) => `way["highway"~"${art}"](${b});`).join('')});out body geom;`;
  console.log(`Lade Strassen für ${strecken.length} Strecken aus Overpass …`);
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'linienarchiv-pilot/0.1' },
    body: 'data=' + encodeURIComponent(query),
    signal: AbortSignal.timeout(200_000),
  });
  if (!res.ok) throw new Error(`Overpass: ${res.status}`);
  const json = await res.json();
  strassen = { boxen, osmStand: json.osm3s?.timestamp_osm_base ?? null, ways: json.elements.filter((e) => e.type === 'way') };
  await mkdir(new URL('data/raw/osm/', root), { recursive: true });
  await writeFile(CACHE, JSON.stringify(strassen));
}

// ---------- Strassengraph ----------
const coord = new Map();
const adj = new Map();
for (const w of strassen.ways) {
  w.nodes.forEach((id, i) => {
    coord.set(id, [w.geometry[i].lon, w.geometry[i].lat]);
    if (!adj.has(id)) adj.set(id, []);
  });
  for (let i = 1; i < w.nodes.length; i++) {
    const a = w.nodes[i - 1], b = w.nodes[i];
    const d = meter(coord.get(a), coord.get(b));
    adj.get(a).push({ to: b, d, name: w.tags.name ?? null });
    adj.get(b).push({ to: a, d, name: w.tags.name ?? null });
  }
}

// Zusammenhängende Teilnetze: Beide Enden eines Wegstücks müssen im selben Teilnetz liegen
// (die Strassen werden in getrennten Gebieten geladen; Höfe und Tunnelstutzen führen nirgends hin).
const teilnetz = new Map();
const teilnetze = [];
for (const start of adj.keys()) {
  if (teilnetz.has(start)) continue;
  const teil = [start];
  teilnetz.set(start, teilnetze.length);
  for (let i = 0; i < teil.length; i++)
    for (const { to } of adj.get(teil[i])) if (!teilnetz.has(to)) (teilnetz.set(to, teilnetze.length), teil.push(to));
  teilnetze.push(teil);
}

function naechsterKnoten(p, bevorzugt, teil) {
  let best = null;
  for (const id of teil) {
    const c = coord.get(id);
    // Knoten an bevorzugten Strassen gewinnen bis 40 m Umweg
    const an = adj.get(id).some((e) => bevorzugt.has(e.name));
    const d = meter(p, c) - (an ? 40 : 0);
    if (!best || d < best.d) best = { id, d };
  }
  return best;
}

function endknoten(a, b, bevorzugt) {
  let best = null;
  for (const teil of teilnetze) {
    if (teil.length < 50) continue;
    const [x, y] = [naechsterKnoten(a, bevorzugt, teil), naechsterKnoten(b, bevorzugt, teil)];
    if (!best || x.d + y.d < best.d) best = { d: x.d + y.d, ids: [x.id, y.id] };
  }
  return best.ids;
}

function weg(von, bis, bevorzugt) {
  const D = new Map([[von, 0]]), prev = new Map();
  const heap = [[0, von]];
  const push = (e) => {
    heap.push(e);
    for (let i = heap.length - 1; i > 0; ) {
      const p = (i - 1) >> 1;
      if (heap[p][0] <= heap[i][0]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  };
  const pop = () => {
    const top = heap[0], last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      for (let i = 0; ; ) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
    }
    return top;
  };
  while (heap.length) {
    const [du, u] = pop();
    if (du > D.get(u)) continue;
    if (u === bis) break;
    for (const { to, d, name } of adj.get(u)) {
      const nd = du + d * (bevorzugt.has(name) ? 0.5 : 1);
      if (nd < (D.get(to) ?? Infinity)) {
        D.set(to, nd);
        prev.set(to, u);
        push([nd, to]);
      }
    }
  }
  if (!D.has(bis)) return null;
  const pfad = [bis];
  while (prev.has(pfad[0])) pfad.unshift(prev.get(pfad[0]));
  return pfad;
}

// Douglas-Peucker, Toleranz in Metern
function vereinfachen(pts, tol = 2) {
  if (pts.length < 3) return pts;
  const abstand = (p, a, b) => {
    const [px, py] = [(p[0] - a[0]) * 111320 * KOS, (p[1] - a[1]) * 110574];
    const [bx, by] = [(b[0] - a[0]) * 111320 * KOS, (b[1] - a[1]) * 110574];
    const l2 = bx * bx + by * by;
    const t = l2 ? Math.max(0, Math.min(1, (px * bx + py * by) / l2)) : 0;
    return Math.hypot(px - t * bx, py - t * by);
  };
  let maxD = 0, idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = abstand(pts[i], pts[0], pts.at(-1));
    if (d > maxD) [maxD, idx] = [d, i];
  }
  if (maxD <= tol) return [pts[0], pts.at(-1)];
  return [...vereinfachen(pts.slice(0, idx + 1), tol).slice(0, -1), ...vereinfachen(pts.slice(idx), tol)];
}

const aus = {};
for (const s of strecken) {
  const bevorzugt = new Set(s.strassen ?? []);
  const pts = wegpunkte.get(s.id);
  let linie = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const [a, b] = endknoten(pts[i - 1], pts[i], bevorzugt);
    const pfad = weg(a, b, bevorzugt);
    if (!pfad) throw new Error(`${s.id}: kein Strassenweg zwischen Wegpunkt ${i} und ${i + 1}`);
    linie.push(...pfad.map((id) => coord.get(id)), pts[i]);
  }
  linie = vereinfachen(linie.filter((p, i) => !i || meter(p, linie[i - 1]) > 0.5));
  const laenge = linie.reduce((sum, p, i) => (i ? sum + meter(linie[i - 1], p) : 0), 0);
  aus[s.id] = linie.map((p) => [+p[0].toFixed(6), +p[1].toFixed(6)]);
  console.log(`${s.id.padEnd(20)} ${(laenge / 1000).toFixed(2)} km, ${linie.length} Punkte`);
}

await mkdir(new URL('data/historisch/', root), { recursive: true });
await writeFile(
  new URL('data/historisch/gleise.json', root),
  JSON.stringify({ quelle: 'Rekonstruiert über das Strassennetz aus OpenStreetMap (scripts/historisch/strecken.mjs)', osmStand: strassen.osmStand, strecken: aus }, null, 1) + '\n',
);
console.log('data/historisch/gleise.json geschrieben');
