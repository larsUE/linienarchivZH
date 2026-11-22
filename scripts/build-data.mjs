// Baut aus data/linien.yaml und den OSM-Rohdaten die Datei public/data/netz.json.
//
// Ablauf:
//  1. Haltestellen aus OSM-Haltepunkten bilden (gruppiert nach Namen)
//  2. Gleisgraph aus den OSM-Gleisen bilden
//  3. Für jede Linienversion den Weg auflösen: OSM-Ausschnitte + Wegpunkte,
//     Lücken über den kürzesten Weg im Gleisnetz füllen
//  4. Abschnitte (Kanten zwischen zwei Haltestellen) mit Geometrie ausgeben

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { parse } from 'yaml';

const root = new URL('..', import.meta.url);
const osm = JSON.parse(await readFile(new URL('data/raw/osm-tram.json', root), 'utf8'));
const cfg = parse(await readFile(new URL('data/linien.yaml', root), 'utf8'));

const warnungen = [];
const warn = (msg) => warnungen.push(msg);

// ---------- OSM-Elemente ----------
const nodes = new Map();
const relations = new Map();
const ways = [];
for (const e of osm.elements) {
  if (e.type === 'node') nodes.set(e.id, e);
  else if (e.type === 'relation') relations.set(e.id, e);
  else if (e.type === 'way') ways.push(e);
}

// ---------- Gleisgraph ----------
const coord = new Map(); // node id -> [lon, lat]
const adj = new Map(); // node id -> [{to, w}]
const imBauKnoten = new Set();
const dist = ([lon1, lat1], [lon2, lat2]) => {
  const R = 6371000, toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad, dLon = (lon2 - lon1) * toRad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
};
for (const w of ways) {
  const imBau = w.tags.railway !== 'tram';
  w.nodes.forEach((id, i) => {
    const g = w.geometry[i];
    coord.set(id, [g.lon, g.lat]);
    if (imBau) imBauKnoten.add(id);
    if (!adj.has(id)) adj.set(id, []);
  });
  for (let i = 1; i < w.nodes.length; i++) {
    const a = w.nodes[i - 1], b = w.nodes[i];
    const d = dist(coord.get(a), coord.get(b));
    adj.get(a).push({ to: b, w: d });
    adj.get(b).push({ to: a, w: d });
  }
}

// ---------- Haltestellen ----------
const slug = (s) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const stations = new Map(); // name -> {id, name, ort, knoten:Set}
const knotenZuStation = new Map();
const addStopNode = (n, name) => {
  if (!adj.has(n.id)) return; // nicht auf einem Gleis
  let st = stations.get(name);
  if (!st) {
    const uic = n.tags.uic_name ?? '';
    const ort = uic.includes(',') ? uic.split(',')[0].trim() : null;
    st = { id: slug(name), name, ort, knoten: new Set() };
    stations.set(name, st);
  }
  st.knoten.add(n.id);
  knotenZuStation.set(n.id, st);
  // OSM-Eröffnungsdatum der Haltestelle (z.B. später eingefügte Halte)
  const sd = n.tags.start_date;
  if (/^\d{4}-\d{2}-\d{2}$/.test(sd ?? '') && (!st.seit || sd > st.seit)) st.seit = sd;
};
for (const n of nodes.values()) {
  const t = n.tags ?? {};
  if (t.name && (t.public_transport === 'stop_position' || t.railway === 'tram_stop')) addStopNode(n, t.name);
}
for (const z of cfg.zusatz_haltestellen ?? []) {
  for (const id of z.osm_knoten) {
    const n = nodes.get(id);
    if (!n) throw new Error(`Zusatzhaltestelle ${z.name}: OSM-Knoten ${id} fehlt in den Rohdaten`);
    addStopNode(n, z.name);
  }
}
const station = (name) => {
  const st = stations.get(name);
  if (!st) throw new Error(`Unbekannte Haltestelle "${name}"`);
  return st;
};

// ---------- Router: kürzester Weg zwischen zwei Haltestellen ----------
function route(von, bis) {
  const D = new Map(), prev = new Map();
  const heap = [];
  const push = (id, d) => {
    heap.push([d, id]);
    let i = heap.length - 1;
    while (i > 0) {
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
      let i = 0;
      for (;;) {
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
  for (const s of von.knoten) { D.set(s, 0); push(s, 0); }
  while (heap.length) {
    const [d, u] = pop();
    if (d > D.get(u)) continue;
    if (bis.knoten.has(u)) {
      const pfad = [u];
      while (prev.has(pfad[0])) pfad.unshift(prev.get(pfad[0]));
      return { pfad, laenge: d };
    }
    for (const { to, w } of adj.get(u)) {
      const nd = d + w;
      if (nd < (D.get(to) ?? Infinity)) { D.set(to, nd); prev.set(to, u); push(to, nd); }
    }
  }
  return null;
}

// ---------- Linienwege auflösen ----------
function osmHaltestellen(relId) {
  const r = relations.get(relId);
  if (!r) throw new Error(`OSM-Relation ${relId} fehlt in den Rohdaten`);
  const namen = [];
  for (const m of r.members) {
    if (m.type !== 'node' || !m.role.startsWith('stop')) continue;
    const n = nodes.get(m.ref);
    const name = n?.tags?.name;
    if (!name) continue;
    if (namen.at(-1) !== name) namen.push(name);
  }
  return namen;
}

function bausteinZuNamen(b) {
  if (typeof b === 'string') return [b];
  const alle = osmHaltestellen(b.osm);
  if (!b.von && !b.bis) return alle;
  const i = b.von ? alle.indexOf(b.von) : 0;
  const j = b.bis ? alle.lastIndexOf(b.bis) : alle.length - 1;
  if (i < 0 || j < 0) throw new Error(`OSM ${b.osm}: "${b.von ?? ''}" oder "${b.bis ?? ''}" nicht im Linienweg`);
  return i <= j ? alle.slice(i, j + 1) : alle.slice(j, i + 1).reverse();
}

const kanten = new Map(); // key -> {id, a, b, coords, imBau}
function kanteFuer(stA, stB, pfad) {
  const [a, b] = [stA.id, stB.id].sort();
  const key = `${a}~${b}`;
  if (!kanten.has(key)) {
    let coords = pfad.map((id) => coord.get(id));
    if (stA.id !== a) coords = coords.reverse();
    const imBau = pfad.some((id) => imBauKnoten.has(id));
    kanten.set(key, { id: key, a, b, coords, imBau });
  }
  return { id: key, vorwaerts: stA.id === a };
}

function loeseWeg(weg, label, von) {
  const namen = [];
  for (const b of weg) for (const n of bausteinZuNamen(b)) if (namen.at(-1) !== n) namen.push(n);
  const wegpunkte = namen.map(station);

  const halte = [wegpunkte[0]];
  const kantenListe = [];
  const eingefuegt = [];
  // Vom Router eingefügte Halte, die laut OSM erst später eröffnet wurden.
  // (OSM-start_date wird nur hier verwendet: bei bestehenden Halten bezeichnet es oft
  // nur die neue Lage des Haltepunkts, nicht die erste Bedienung.)
  const halteAb = {};
  for (let k = 1; k < wegpunkte.length; k++) {
    const r = route(halte.at(-1), wegpunkte[k]);
    if (!r) throw new Error(`${label}: kein Gleisweg ${halte.at(-1).name} → ${wegpunkte[k].name}`);
    // Haltestellen, an denen der Weg unterwegs vorbeiführt, werden eingefügt
    let start = 0;
    for (let i = 1; i < r.pfad.length - 1; i++) {
      const st = knotenZuStation.get(r.pfad[i]);
      if (!st || st === halte.at(-1) || st === wegpunkte[k]) continue;
      kantenListe.push(kanteFuer(halte.at(-1), st, r.pfad.slice(start, i + 1)));
      halte.push(st);
      eingefuegt.push(st.name);
      if (st.seit && (!von || st.seit > von)) halteAb[st.id] = st.seit;
      start = i;
    }
    kantenListe.push(kanteFuer(halte.at(-1), wegpunkte[k], r.pfad.slice(start)));
    halte.push(wegpunkte[k]);
  }
  if (eingefuegt.length) warn(`${label}: vom Router eingefügt: ${eingefuegt.join(', ')}`);
  return { halte, kantenListe, halteAb };
}

// ---------- Linien und Versionen ----------
const farbeAusOsm = new Map();
for (const r of relations.values()) if (r.tags.colour) farbeAusOsm.set(r.tags.ref, r.tags.colour);

const linien = [];
const versionen = [];
for (const l of cfg.linien) {
  linien.push({
    id: l.id,
    nummer: l.nummer,
    art: l.art ?? 'tram',
    farbe: l.farbe ?? farbeAusOsm.get(l.nummer.replace(/\D+$/, '')) ?? '#666666',
  });
  for (const v of l.versionen) {
    const von = v.von ? isoDate(v.von) : null;
    const bis = v.bis ? isoDate(v.bis) : null;
    const label = `Linie ${l.nummer} (${von ?? '…'} – ${bis ?? '…'})`;
    const { halte, kantenListe, halteAb } = loeseWeg(v.weg, label, von);
    versionen.push({
      id: `${l.id}@${von ?? 'anfang'}`,
      linie: l.id,
      von,
      bis,
      status: v.status,
      quellen: v.quellen ?? [],
      notiz: v.notiz ?? null,
      haltestellen: halte.map((s) => s.id),
      kanten: kantenListe.map((k) => (k.vorwaerts ? k.id : `-${k.id}`)),
      ...(Object.keys(halteAb).length ? { halteAb } : {}),
    });
  }
}
function isoDate(d) {
  return d instanceof Date ? d.toISOString().slice(0, 10) : String(d);
}

// Überlappende Gültigkeiten derselben Linie verhindern
for (const l of linien) {
  const vs = versionen.filter((v) => v.linie === l.id);
  for (const a of vs) for (const b of vs) {
    if (a === b) continue;
    const overlap = (a.von ?? '0000') <= (b.bis ?? '9999') && (b.von ?? '0000') <= (a.bis ?? '9999');
    if (overlap) throw new Error(`Linie ${l.nummer}: Versionen ${a.id} und ${b.id} überlappen`);
  }
}

// ---------- Ausgabe ----------
const benutzt = new Set(versionen.flatMap((v) => v.haltestellen));
const haltestellen = [...stations.values()]
  .filter((s) => benutzt.has(s.id))
  .map((s) => {
    const pts = [...s.knoten].map((id) => coord.get(id));
    const lon = pts.reduce((a, p) => a + p[0], 0) / pts.length;
    const lat = pts.reduce((a, p) => a + p[1], 0) / pts.length;
    return { id: s.id, name: s.name, ort: s.ort, lon: +lon.toFixed(6), lat: +lat.toFixed(6) };
  });
const round = (c) => [+c[0].toFixed(6), +c[1].toFixed(6)];

// ---------- Schema-Lage aus dem Liniennetzplan ----------
// data/layout.json (eigenes oktilineares Layout aus scripts/plan/layout.mjs) oder ersatzweise
// data/plan.json (aus scripts/plan/extract-plan.py) enthält Plankoordinaten in Punkten, y nach unten.
// Sie werden mit einheitlichem Massstab und Verschiebung (ohne Drehung)
// über das Stadtgebiet gelegt, damit Plan und Karte in derselben Kartenansicht überblendet werden können.
const kantenListe = [...kanten.values()];
let plan = null;
let planDatei = null;
for (const datei of ['data/layout.json', 'data/plan.json']) {
  try {
    plan = JSON.parse(await readFile(new URL(datei, root), 'utf8'));
    planDatei = datei;
    break;
  } catch {}
}
if (!plan) warn('data/layout.json und data/plan.json fehlen: keine Planansicht');
if (plan) {
  const lat0 = 47.37;
  const k = Math.cos((lat0 * Math.PI) / 180);
  // komplexe Zahlen als [re, im]; Plan-y zeigt nach unten, daher gespiegelt
  const ausPlan = ([x, y]) => [x, -y];
  const ausGeo = (h) => [h.lon * k, h.lat];
  const paare = haltestellen
    .filter((h) => plan.haltestellen[h.id] && !plan.herkunft.haltestellen[h.id])
    .map((h) => [ausPlan(plan.haltestellen[h.id]), ausGeo(h)]);
  // Kleinste Quadrate für w = a·z + b
  const n = paare.length;
  const mz = paare.reduce((s, [z]) => [s[0] + z[0] / n, s[1] + z[1] / n], [0, 0]);
  const mw = paare.reduce((s, [, w]) => [s[0] + w[0] / n, s[1] + w[1] / n], [0, 0]);
  let re = 0, im = 0, nn = 0;
  for (const [z, w] of paare) {
    const dz = [z[0] - mz[0], z[1] - mz[1]];
    const dw = [w[0] - mw[0], w[1] - mw[1]];
    re += dw[0] * dz[0] + dw[1] * dz[1]; // dw · conj(dz)
    im += dw[1] * dz[0] - dw[0] * dz[1];
    nn += dz[0] * dz[0] + dz[1] * dz[1];
  }
  // ohne Drehung: Waagrechte und Diagonalen des Plans bleiben auf dem Bildschirm waagrecht und diagonal
  const a = [Math.hypot(re, im) / nn, 0];
  const b = [mw[0] - (a[0] * mz[0] - a[1] * mz[1]), mw[1] - (a[0] * mz[1] + a[1] * mz[0])];
  const zuKarte = (p) => {
    const z = ausPlan(p);
    const w = [a[0] * z[0] - a[1] * z[1] + b[0], a[0] * z[1] + a[1] * z[0] + b[1]];
    return round([w[0] / k, w[1]]);
  };
  for (const h of haltestellen) {
    const p = plan.haltestellen[h.id];
    if (!p) warn(`Plan: ${h.name} fehlt in ${planDatei} (scripts/plan/layout.mjs neu laufen lassen)`);
    h.plan = p ? zuKarte(p) : [h.lon, h.lat];
    if (!p || plan.herkunft.haltestellen[h.id]) h.planGeschaetzt = true;
  }
  const hById = new Map(haltestellen.map((h) => [h.id, h]));
  for (const kante of kantenListe) {
    const pts = plan.kanten[kante.id];
    kante.planCoords = pts ? pts.map(zuKarte) : [hById.get(kante.a).plan, hById.get(kante.b).plan];
    if (!pts || plan.herkunft.kanten[kante.id]) kante.planGeschaetzt = true;
  }
  const bbox = plan.groesse;
  plan = { quelle: plan.quelle, rahmen: [zuKarte([0, bbox[1]]), zuKarte([bbox[0], 0])] };
}

const out = {
  meta: {
    erstellt: new Date().toISOString(),
    osmStand: osm.osm3s?.timestamp_osm_base ?? null,
    stichtag: cfg.stichtag,
    zeitraum: cfg.zeitraum,
    plan,
  },
  quellen: Object.fromEntries(
    Object.entries(cfg.quellen).map(([k, q]) => [k, { ...q, abgerufen: q.abgerufen ? isoDate(q.abgerufen) : null }]),
  ),
  linien,
  versionen,
  haltestellen,
  kanten: kantenListe.map((k) => ({ ...k, coords: k.coords.map(round) })),
};

await mkdir(new URL('public/data/', root), { recursive: true });
await writeFile(new URL('public/data/netz.json', root), JSON.stringify(out));
console.log(
  `${linien.length} Linien, ${versionen.length} Versionen, ${haltestellen.length} Haltestellen, ${out.kanten.length} Abschnitte`,
);
for (const w of warnungen) console.log('  Hinweis:', w);
