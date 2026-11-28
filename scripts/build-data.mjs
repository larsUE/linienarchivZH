// Baut aus data/linien.yaml und data/linien-historisch.yaml (Tram), data/busse.yaml (Bus) und den
// OSM-Rohdaten die Datei public/data/netz.json.
//
// Ablauf:
//  1. Gleisgraph aus den OSM-Gleisen bilden, dazu die aufgehobenen Strecken aus data/historisch/gleise.json;
//     Gleise mit Betriebszeiten versehen (gleise_zeiten, historische_strecken)
//  2. Haltestellen aus OSM-Haltepunkten bilden (gruppiert nach Namen), dazu die historischen Haltestellen
//     und die Bushaltestellen aus data/bus/
//  3. Für jede Tramversion den Weg auflösen: OSM-Ausschnitte + Wegpunkte,
//     Lücken über den kürzesten Weg im Gleisnetz füllen, das am ersten Tag der Version in Betrieb war.
//     Busversionen sind Haltestellenlisten; der Fahrweg je Abschnitt kommt aus data/bus/kanten.json (GTFS).
//  4. Abschnitte (Kanten zwischen zwei Haltestellen) mit Geometrie ausgeben

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { parse } from 'yaml';

const root = new URL('..', import.meta.url);
const osm = JSON.parse(await readFile(new URL('data/raw/osm-tram.json', root), 'utf8'));
const cfg = parse(await readFile(new URL('data/linien.yaml', root), 'utf8'));
// Tramnetz vor 2010: Versionen bestehender Linien, frühere Linien, aufgehobene Strecken und Haltestellen
const hist = parse(await readFile(new URL('data/linien-historisch.yaml', root), 'utf8'));
const histGleise = JSON.parse(await readFile(new URL('data/historisch/gleise.json', root), 'utf8'));
const lesen = async (p, fn, ersatz) => {
  try {
    return fn(await readFile(new URL(p, root), 'utf8'));
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
    return ersatz;
  }
};
// Busse (optional): Linien, Haltestellen ohne Tram und Fahrwege aus scripts/import/import-fahrplan.mjs --bus
const busCfg = await lesen('data/busse.yaml', parse, { linien: [] });
const busHalte = await lesen('data/bus/haltestellen.json', JSON.parse, []);
const busKanten = await lesen('data/bus/kanten.json', JSON.parse, {});
const gruppe = (l) => (l.art === 'bus' ? 'bus' : 'tram');
// Quellen aus data/linien.yaml, ergänzt um die aus data/busse.yaml (z.B. Wikipedia: Trolleybus Zürich)
const quellen = { ...cfg.quellen, ...(busCfg.quellen ?? {}) };

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
// Jede Gleiskante {a, b, w, zeiten} hängt in beiden Richtungen in adj. zeiten: Betriebszeiträume
// [[von, bis], …] (Tage inklusive, null = offen); ohne zeiten immer befahrbar.
const coord = new Map(); // node id -> [lon, lat]
const adj = new Map(); // node id -> [{to, e}]
const imBauKnoten = new Set();
const historischKnoten = new Set();
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
  for (let i = 1; i < w.nodes.length; i++) verbinde(w.nodes[i - 1], w.nodes[i]);
}
function verbinde(a, b, zeiten) {
  const e = { a, b, w: dist(coord.get(a), coord.get(b)), zeiten };
  adj.get(a).push({ to: b, e });
  adj.get(b).push({ to: a, e });
  return e;
}
const gilt = (zeiten, datum) => !zeiten || zeiten.some(([v, b]) => (!v || v <= datum) && (!b || datum <= b));
const zeitraeume = (z) => z.map(([v, b]) => [v ? isoDate(v) : null, b ? isoDate(b) : null]);

// Nächster Gleisknoten (heute oder historisch) zu einem Punkt
function naechsterGleisknoten(p, filter = () => true) {
  let best = null;
  for (const [id, c] of coord) {
    if (!filter(id)) continue;
    const d = dist(p, c);
    if (!best || d < best.d) best = { id, d };
  }
  return best;
}

// Aufgehobene Strecken: Linie aus data/historisch/gleise.json, Enden an den nächsten Gleisknoten
const historischeWege = [];
for (const s of hist.historische_strecken ?? []) {
  const roh = histGleise.strecken[s.id];
  if (!roh) throw new Error(`Historische Strecke ${s.id} fehlt in data/historisch/gleise.json (node scripts/historisch/strecken.mjs)`);
  // alle 20 m ein Knoten, damit Haltestellen und Anschlüsse einen nahen Knoten finden
  const linie = [roh[0]];
  for (let i = 1; i < roh.length; i++) {
    const n = Math.ceil(dist(roh[i - 1], roh[i]) / 20);
    for (let k = 1; k <= n; k++) linie.push([roh[i - 1][0] + ((roh[i][0] - roh[i - 1][0]) * k) / n, roh[i - 1][1] + ((roh[i][1] - roh[i - 1][1]) * k) / n]);
  }
  const zeiten = zeitraeume(s.zeiten);
  const ids = linie.map((p, i) => {
    const id = `h:${s.id}:${i}`;
    coord.set(id, p);
    adj.set(id, []);
    historischKnoten.add(id);
    return id;
  });
  for (let i = 1; i < ids.length; i++) verbinde(ids[i - 1], ids[i], zeiten);
  // Jedes Ende an den nächsten Knoten jedes Gleises im Umkreis von 60 m (beide Richtungsgleise,
  // andere aufgehobene Strecken); weiter entfernt bleibt es ein Stumpfende (z.B. Endstation Glattbrugg).
  for (const i of [0, ids.length - 1]) {
    for (const w of [...ways.map((w) => w.nodes), ...historischeWege]) {
      let best = null;
      for (const id of w) {
        const d = dist(linie[i], coord.get(id));
        if (!best || d < best.d) best = { id, d };
      }
      if (best && best.d < 60) verbinde(ids[i], best.id, zeiten);
    }
  }
  historischeWege.push(ids);
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
// Historische Haltestellen: an den nächsten Knoten jedes Gleises in der Nähe (beide Richtungsgleise)
for (const h of hist.historische_haltestellen ?? []) {
  if (stations.has(h.name) || busHalte.some((b) => b.name === h.name)) throw new Error(`Historische Haltestelle ${h.name} gibt es schon (heutiger Name)`);
  const st = { id: slug(h.name), name: h.name, ort: h.ort ?? null, knoten: new Set(), historisch: true, seit: h.seit ? isoDate(h.seit) : null, bis: h.bis ? isoDate(h.bis) : null };
  const naechst = naechsterGleisknoten(h.lage);
  if (!naechst || naechst.d > 80) throw new Error(`Historische Haltestelle ${h.name}: ${Math.round(naechst?.d)} m vom nächsten Gleis`);
  for (const w of [...ways.map((w) => w.nodes), ...historischeWege]) {
    let best = null;
    for (const id of w) {
      if (!coord.has(id)) continue;
      const d = dist(h.lage, coord.get(id));
      if (!best || d < best.d) best = { id, d };
    }
    if (best && best.d <= naechst.d + 15 && best.d < 80) st.knoten.add(best.id);
  }
  for (const id of st.knoten) knotenZuStation.set(id, st);
  stations.set(h.name, st);
}
// Heutige Haltestellen, die erst später eröffnet wurden
for (const [name, seit] of Object.entries(hist.haltestellen_seit ?? {})) {
  const st = stations.get(name);
  if (!st) throw new Error(`haltestellen_seit: unbekannte Haltestelle "${name}"`);
  st.ab = isoDate(seit);
}
// Bushaltestellen, die keine Tramhaltestelle sind: feste Lage aus den Fahrplandaten
for (const h of busHalte) {
  if (stations.has(h.name)) continue;
  stations.set(h.name, { id: h.id, name: h.name, ort: h.ort, knoten: new Set(), lage: [h.lon, h.lat] });
}
const station = (name) => {
  const st = stations.get(name);
  if (!st) throw new Error(`Unbekannte Haltestelle "${name}"`);
  return st;
};

// ---------- Router: kürzester Weg zwischen zwei Haltestellen ----------
function route(von, bis, datum = null, ohne = null) {
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
      const kanten = [];
      while (prev.has(pfad[0])) {
        const [v, e] = prev.get(pfad[0]);
        pfad.unshift(v);
        kanten.unshift(e);
      }
      return { pfad, kanten, laenge: d };
    }
    for (const { to, e } of adj.get(u)) {
      if (datum && !gilt(e.zeiten, datum)) continue;
      if (ohne?.has(e)) continue;
      const nd = d + e.w;
      if (nd < (D.get(to) ?? Infinity)) { D.set(to, nd); prev.set(to, [u, e]); push(to, nd); }
    }
  }
  return null;
}

// ---------- Betriebszeiten heutiger Gleise ----------
// Weg durch die Wegpunkte suchen und markieren, danach dasselbe ohne die markierten Gleise, um das
// Gleis der Gegenrichtung zu finden: Es muss überall höchstens 25 m neben dem ersten Weg liegen.
function abstandZuLinie(p, linie) {
  const kx = 111320 * Math.cos((p[1] * Math.PI) / 180), ky = 110574;
  let best = Infinity;
  for (let i = 1; i < linie.length; i++) {
    const [ax, ay] = [(linie[i - 1][0] - p[0]) * kx, (linie[i - 1][1] - p[1]) * ky];
    const [bx, by] = [(linie[i][0] - p[0]) * kx, (linie[i][1] - p[1]) * ky];
    const [dx, dy] = [bx - ax, by - ay];
    const l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / l2)) : 0;
    best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return best;
}
for (const g of hist.gleise_zeiten ?? []) {
  const zeiten = g.zeiten ? zeitraeume(g.zeiten) : [[isoDate(g.eroeffnet), g.stillgelegt ? isoDate(g.stillgelegt) : null]];
  const halte = g.strecke.map(station);
  const markiert = new Set();
  for (let k = 1; k < halte.length; k++) {
    const erste = route(halte[k - 1], halte[k], null, markiert);
    if (!erste) throw new Error(`gleise_zeiten: kein Gleisweg ${halte[k - 1].name} → ${halte[k].name}`);
    const linie = erste.pfad.map((id) => coord.get(id));
    for (const e of erste.kanten) markiert.add(e);
    for (let runde = 0; runde < 3; runde++) {
      const r = route(halte[k - 1], halte[k], null, markiert);
      if (!r || r.laenge > 1.25 * erste.laenge || r.pfad.some((id) => abstandZuLinie(coord.get(id), linie) > 25)) break;
      for (const e of r.kanten) markiert.add(e);
    }
  }
  // Gemeinsame Stücke zweier Einträge (Weichen, Haltestellenbereiche) gelten ab der früheren Eröffnung
  for (const e of markiert) if (!e.zeiten || (e.zeiten[0][0] ?? '') > (zeiten[0][0] ?? '')) e.zeiten = zeiten;
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

const kanten = new Map(); // key -> {id, a, b, coords, imBau} (Bus: id "bus:a~b", bus: true)
const laengeVon = (coords) => coords.reduce((s, p, i) => (i ? s + dist(coords[i - 1], p) : 0), 0);
function kanteFuer(stA, stB, pfad) {
  const [a, b] = [stA.id, stB.id].sort();
  let coords = pfad.map((id) => coord.get(id));
  if (stA.id !== a) coords = coords.reverse();
  const laenge = laengeVon(coords);
  // Dasselbe Haltestellenpaar über ein anderes Gleis (z.B. früher über eine aufgehobene Strecke):
  // eigener Abschnitt mit Zusatz ~2, ~3 …
  for (let n = 1; ; n++) {
    const key = n === 1 ? `${a}~${b}` : `${a}~${b}~${n}`;
    const k = kanten.get(key);
    if (k && Math.abs(laengeVon(k.coords) - laenge) > Math.max(100, 0.2 * laenge)) continue;
    if (!k) {
      const imBau = pfad.some((id) => imBauKnoten.has(id));
      const historisch = pfad.some((id) => historischKnoten.has(id));
      kanten.set(key, { id: key, a, b, coords, imBau, ...(historisch ? { historisch: true } : {}) });
    }
    return { id: key, vorwaerts: stA.id === a };
  }
}

// Haltestelle während der Version in Betrieb? (historische Haltestellen; OSM-start_date siehe halteAb)
const inBetrieb = (st, von, bis) =>
  (!st.ab || !bis || st.ab <= bis) && (!st.historisch || ((!st.bis || von <= st.bis) && (!st.seit || !bis || st.seit <= bis)));

function loeseWeg(weg, label, von, bis) {
  // Gleise und historische Haltestellen am ersten Tag der Version; ohne Beginn wie heute
  const datum = von ?? bis ?? '9999-12-31';
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
    const r = route(halte.at(-1), wegpunkte[k], datum);
    if (!r) throw new Error(`${label}: kein Gleisweg ${halte.at(-1).name} → ${wegpunkte[k].name}`);
    // Haltestellen, an denen der Weg unterwegs vorbeiführt, werden eingefügt
    let start = 0;
    for (let i = 1; i < r.pfad.length - 1; i++) {
      const st = knotenZuStation.get(r.pfad[i]);
      if (!st || st === halte.at(-1) || st === wegpunkte[k] || !inBetrieb(st, datum, bis)) continue;
      kantenListe.push(kanteFuer(halte.at(-1), st, r.pfad.slice(start, i + 1)));
      halte.push(st);
      eingefuegt.push(st.name);
      const ab = st.ab ?? st.seit;
      if (ab && (!von || ab > von)) halteAb[st.id] = ab;
      start = i;
    }
    kantenListe.push(kanteFuer(halte.at(-1), wegpunkte[k], r.pfad.slice(start)));
    halte.push(wegpunkte[k]);
  }
  if (eingefuegt.length) warn(`${label}: vom Router eingefügt: ${eingefuegt.join(', ')}`);
  return { halte, kantenListe, halteAb };
}

// Buswege: Haltestellenliste, Fahrweg je Abschnitt aus GTFS, sonst Gerade (geschätzt)
const lage = (st) => st.lage ?? mittel([...st.knoten].map((id) => coord.get(id)));
const mittel = (pts) => [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length];
const ohneFahrweg = [];
function loeseBusWeg(weg, label) {
  const halte = weg.map((b) => {
    if (typeof b !== 'string') throw new Error(`${label}: Busweg nur als Haltestellenliste`);
    return station(b);
  });
  const kantenListe = [];
  for (let i = 1; i < halte.length; i++) {
    const [stA, stB] = [halte[i - 1], halte[i]];
    const [a, b] = [stA.id, stB.id].sort();
    const id = `bus:${a}~${b}`;
    if (!kanten.has(id)) {
      const weg = busKanten[`${a}~${b}`];
      if (!weg) ohneFahrweg.push(`${stA.name} – ${stB.name}`);
      const [la, lb] = [stA.id === a ? stA : stB, stA.id === a ? stB : stA].map(lage);
      kanten.set(id, { id, a, b, coords: weg?.coords ?? [la, lb], imBau: false, bus: true, ...(weg ? {} : { geoGeschaetzt: true }) });
    }
    kantenListe.push({ id, vorwaerts: stA.id === a });
  }
  return { halte, kantenListe, halteAb: {} };
}

// ---------- Linien und Versionen ----------
const farbeAusOsm = new Map();
for (const r of relations.values()) if (r.tags.colour) farbeAusOsm.set(r.tags.ref, r.tags.colour);

// Historische Versionen an die Linien aus linien.yaml anhängen, frühere Linien dazunehmen
const tramLinien = cfg.linien.map((l) => ({ ...l, versionen: [...l.versionen] }));
const historischeVersionen = new Set();
for (const h of hist.linien ?? []) {
  h.versionen.forEach((v) => historischeVersionen.add(v));
  const l = tramLinien.find((x) => x.id === h.id);
  if (l) l.versionen.push(...h.versionen);
  else tramLinien.push(h);
}
const alleLinien = [...tramLinien, ...busCfg.linien];

// Linienwege auflösen. Ein Abschnitt übernimmt die Geometrie der ersten Version, die ihn befährt
// (Richtungsgleis, Haltekante). Darum zuerst die heutigen Versionen, dann die historischen: sonst
// bekäme ein heutiger Abschnitt die Gleislage einer alten Linie, und die Fahrwege passten an den
// Haltestellen nicht mehr aneinander.
const aufgeloest = new Map();
const loese = (l, v) => {
  const art = l.art ?? 'tram';
  const von = v.von ? isoDate(v.von) : null;
  const bis = v.bis ? isoDate(v.bis) : null;
  const label = `Linie ${l.nummer} (${von ?? '…'} – ${bis ?? '…'})`;
  aufgeloest.set(v, { von, bis, ...(art === 'bus' ? loeseBusWeg(v.weg, label) : loeseWeg(v.weg, label, von, bis)) });
};
for (const l of alleLinien) for (const v of l.versionen) if (!historischeVersionen.has(v)) loese(l, v);
for (const l of alleLinien) for (const v of l.versionen) if (historischeVersionen.has(v)) loese(l, v);

// Ausgabe: nummerierte Linien nach Nummer (4 vor 4E vor 5), die benannten (vor 1906) dahinter in Dateireihenfolge
const nr = (l) => (/^\d/.test(l.nummer ?? '') ? parseInt(l.nummer, 10) : Infinity);
tramLinien.sort((a, b) => nr(a) - nr(b) || (nr(a) < Infinity ? a.nummer.localeCompare(b.nummer) : 0));
const linien = [];
const versionen = [];
const ids = new Set();
for (const l of [...tramLinien, ...busCfg.linien]) {
  if (ids.has(l.id)) throw new Error(`Linie ${l.id} doppelt`);
  ids.add(l.id);
  const art = l.art ?? 'tram';
  linien.push({
    id: l.id,
    nummer: String(l.nummer),
    art,
    gruppe: gruppe({ art }),
    ...(l.name ? { name: l.name } : {}),
    farbe: l.farbe ?? (art === 'bus' ? '#FFFFFF' : farbeAusOsm.get(l.nummer.replace(/\D+$/, '')) ?? '#666666'),
    ...(l.trolleybus ? { trolleybus: l.trolleybus.map(zeitraum) } : {}),
    ...(l.chronik ? { chronik: l.chronik.map(chronikEintrag).sort((a, b) => (a.datum ?? '9999').localeCompare(b.datum ?? '9999')) } : {}),
    ...(frueherErfasst(l, art) ? { erfasstAb: frueherErfasst(l, art) } : {}),
  });
  for (const v of l.versionen) {
    const { von, bis, halte, kantenListe, halteAb } = aufgeloest.get(v);
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
// Buslinien mit Versionen vor dem Beginn der Fahrplandaten (Trolleybusse nach der Chronik): erstes erfasstes Jahr
function frueherErfasst(l, art) {
  if (art !== 'bus') return null;
  // erstes Jahr, dessen Stichtag (1. Juli) eine Version trifft
  const jahre = l.versionen.map((v) => aufgeloest.get(v).von).filter(Boolean).map((d) => Number(d.slice(0, 4)) + (d.slice(5) > cfg.stichtag ? 1 : 0));
  const erstes = Math.min(...jahre);
  return erstes < (busCfg.erfasst_ab ?? cfg.zeitraum[0]) ? erstes : null;
}
function isoDate(d) {
  return d instanceof Date ? d.toISOString().slice(0, 10) : String(d);
}
// Trolleybus-Zeiträume und fahrleitungslose Abschnitte (data/busse.yaml)
function zeitraum(z) {
  for (const q of z.quellen ?? []) if (!quellen[q]) throw new Error(`Unbekannte Quelle ${q}`);
  return { von: z.von ? isoDate(z.von) : null, bis: z.bis ? isoDate(z.bis) : null, quellen: z.quellen ?? [], notiz: z.notiz ?? null };
}
// Chronik: datum als Tag, Monat oder Jahr (String), ohne datum nur bei Vorhaben
function chronikEintrag(c) {
  if (!c.text || (!c.datum && !c.geplant)) throw new Error(`Chronikeintrag unvollständig: ${JSON.stringify(c)}`);
  return { datum: c.datum ? isoDate(c.datum) : null, text: c.text, ...(c.geplant ? { geplant: true } : {}) };
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

// Trolleybus-Zeiträume einer Linie dürfen sich nicht überschneiden
for (const l of linien) {
  const z = l.trolleybus ?? [];
  for (const a of z) for (const b of z) {
    if (a !== b && (a.von ?? '0000') <= (b.bis ?? '9999') && (b.von ?? '0000') <= (a.bis ?? '9999'))
      throw new Error(`Linie ${l.nummer}: Trolleybus-Zeiträume überlappen`);
  }
}

// Fahrleitungslose Abschnitte: Haltestellenfolge -> Busabschnitte (müssen von einer Linie befahren werden)
const fahrleitungslos = (busCfg.fahrleitungslos ?? []).map((f) => {
  const halte = f.strecke.map(station);
  const ids = [];
  for (let i = 1; i < halte.length; i++) {
    const id = `bus:${[halte[i - 1].id, halte[i].id].sort().join('~')}`;
    if (!kanten.has(id)) throw new Error(`fahrleitungslos: kein Busabschnitt ${halte[i - 1].name} – ${halte[i].name}`);
    ids.push(id);
  }
  return { kanten: ids, ...zeitraum(f) };
});

// ---------- Ausgabe ----------
if (ohneFahrweg.length) warn(`Bus: ${ohneFahrweg.length} Abschnitte ohne Fahrweg, als Gerade gezeichnet: ${ohneFahrweg.join(', ')}`);
const istBusVersion = (v) => v.linie.startsWith('bus-');
const benutzt = new Set(versionen.flatMap((v) => v.haltestellen));
const vonTram = new Set(versionen.filter((v) => !istBusVersion(v)).flatMap((v) => v.haltestellen));
const haltestellen = [...stations.values()]
  .filter((s) => benutzt.has(s.id))
  .map((s) => {
    const [lon, lat] = lage(s);
    const zeit = s.historisch ? { historisch: true, ...(s.seit ? { seit: s.seit } : {}), ...(s.bis ? { bis: s.bis } : {}) } : {};
    return { id: s.id, name: s.name, ort: s.ort, lon: +lon.toFixed(6), lat: +lat.toFixed(6), ...zeit, ...(vonTram.has(s.id) ? {} : { nurBus: true }) };
  });
{
  const doppelt = haltestellen.map((h) => h.id).filter((id, i, a) => a.indexOf(id) !== i);
  if (doppelt.length) throw new Error(`Haltestellen-Id mehrfach: ${doppelt.join(', ')}`);
}
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
    // nur Tramhaltestellen bestimmen die Lage des Plans über der Karte
    .filter((h) => plan.haltestellen[h.id] && !plan.herkunft.haltestellen[h.id] && !h.nurBus)
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
    // Busse ohne Planlage (scripts/plan/layout.mjs --busse nicht gelaufen) bleiben geografisch und blenden im Plan aus
    if (h.nurBus && !p) {
      h.plan = [h.lon, h.lat];
      h.planGeschaetzt = true;
      continue;
    }
    if (!p) warn(`Plan: ${h.name} fehlt in ${planDatei} (scripts/plan/layout.mjs neu laufen lassen)`);
    h.plan = p ? zuKarte(p) : [h.lon, h.lat];
    if (!p || plan.herkunft.haltestellen[h.id]) h.planGeschaetzt = true;
  }
  const hById = new Map(haltestellen.map((h) => [h.id, h]));
  for (const kante of kantenListe) {
    const pts = plan.kanten[kante.id];
    // Busabschnitte ohne Planlage: Gerade zwischen den Haltestellen, wenn beide eine eigene Planlage haben
    // (z.B. frühere Trolleybuswege über Tramhaltestellen), sonst nur geografisch
    if (kante.bus && !pts && [kante.a, kante.b].some((id) => hById.get(id).planGeschaetzt)) {
      kante.planGeschaetzt = true;
      continue;
    }
    kante.planCoords = pts ? pts.map(zuKarte) : [hById.get(kante.a).plan, hById.get(kante.b).plan];
    if (!pts || plan.herkunft.kanten[kante.id]) kante.planGeschaetzt = true;
  }
  const bbox = plan.groesse;
  const mitBussen = haltestellen.some((h) => h.nurBus && plan.haltestellen[h.id]);
  plan = { quelle: plan.quelle, rahmen: [zuKarte([0, bbox[1]]), zuKarte([bbox[0], 0])], busse: mitBussen };
}

const out = {
  meta: {
    erstellt: new Date().toISOString(),
    osmStand: osm.osm3s?.timestamp_osm_base ?? null,
    stichtag: cfg.stichtag,
    zeitraum: cfg.zeitraum,
    // Erstes erfasstes Jahr je Verkehrsmittel (Busse erst ab den Fahrplandaten 2015)
    // Trolleybusse reichen nach der Chronik weiter zurück (erfasstAb je Linie)
    erfasstAb: {
      tram: cfg.zeitraum[0],
      ...(busCfg.linien.length ? { bus: busCfg.erfasst_ab ?? cfg.zeitraum[0] } : {}),
      ...(linien.some((l) => l.erfasstAb) ? { trolleybus: Math.min(...linien.filter((l) => l.erfasstAb).map((l) => l.erfasstAb)) } : {}),
    },
    plan,
  },
  quellen: Object.fromEntries(
    Object.entries(quellen).map(([k, q]) => [k, { ...q, abgerufen: q.abgerufen ? isoDate(q.abgerufen) : null }]),
  ),
  linien,
  fahrleitungslos,
  versionen,
  haltestellen,
  kanten: kantenListe.map((k) => ({ ...k, coords: k.coords.map(round) })),
};

await mkdir(new URL('public/data/', root), { recursive: true });
// Inhaltlich gleiche Datei nicht neu schreiben: So bleibt der Build reproduzierbar (CI prüft das),
// und meta.erstellt zeigt, wann sich die Daten zuletzt geändert haben.
const ziel = new URL('public/data/netz.json', root);
const ohneZeit = (n) => JSON.stringify({ ...n, meta: { ...n.meta, erstellt: null } });
const bisher = await readFile(ziel, 'utf8').then(JSON.parse, () => null);
if (bisher && ohneZeit(bisher) === ohneZeit(out)) console.log('public/data/netz.json unverändert');
else await writeFile(ziel, JSON.stringify(out));
console.log(
  `${linien.length} Linien, ${versionen.length} Versionen, ${haltestellen.length} Haltestellen, ${out.kanten.length} Abschnitte`,
);
for (const w of warnungen) console.log('  Hinweis:', w);
