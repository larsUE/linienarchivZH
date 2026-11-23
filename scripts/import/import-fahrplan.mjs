// Liest Haltestellenfolgen der Tram- oder Buslinien aus Fahrplandaten und vergleicht sie mit den erfassten Versionen.
//
//   node scripts/import/import-fahrplan.mjs          Tram (data/linien.yaml)
//   node scripts/import/import-fahrplan.mjs --bus    VBZ-Stadtbuslinien 31–99 (data/busse.yaml)
//
// Quellen (geladen mit scripts/import/fetch-fahrplan.py, nicht im Repository):
//   data/raw/gtfs/<jahr>.zip                 ZVV-GTFS, ein Fahrplanjahr pro Datei (Dezember bis Dezember)
//   data/raw/fahrzeiten/<jahr>/*.csv         VBZ-Fahrzeiten SOLL-IST, eine Stichwoche pro Jahr
//
// Vorgehen:
//   1. Jede Fahrt wird zur Folge unserer Haltestellen (Namen abgeglichen, unbekannte als «?Name»).
//   2. Pro Linie und Kalenderwoche gilt der Linienweg mit den meisten Fahrten × Halten
//      (beide Richtungen zusammen; so setzen sich durchgehende Kurse gegen Teilstrecken durch,
//      Wochentage gegen Sonntagsvarianten).
//   3. Gleiche aufeinanderfolgende Wochen ergeben einen Zeitraum. Kurze Zeiträume sind meist Umleitungen.
//
// Ausgabe:
//   data/import/fahrplan.json   Zeiträume je Linie mit Haltestellenfolge (Bus: data/import/bus/)
//   data/import/bericht.md      Vergleich mit den erfassten Versionen
//
// Nur Bus (Busse fahren auf Strassen, die das Archiv nicht aus OSM lädt):
//   data/bus/haltestellen.json  Bushaltestellen, die keine Tramhaltestelle sind, mit Lage aus den Fahrplandaten
//   data/bus/kanten.json        Fahrweg je Haltestellenpaar, ausgeschnitten aus GTFS shapes.txt

import { spawn } from 'node:child_process';
import { createReadStream, existsSync, readdirSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { parse } from 'yaml';

const root = new URL('../../', import.meta.url);
const pfad = (p) => new URL(p, root).pathname;
const netz = JSON.parse(await readFile(new URL('public/data/netz.json', root), 'utf8'));
const cfg = parse(await readFile(new URL('data/linien.yaml', root), 'utf8'));
const BUS = process.argv.includes('--bus');
const busCfg = existsSync(pfad('data/busse.yaml')) ? parse(await readFile(new URL('data/busse.yaml', root), 'utf8')) : {};
const AUSGABE = BUS ? 'data/import/bus/' : 'data/import/';

// Welche Linien gehören dazu?
// GTFS ist ZVV-weit, Liniennummern wiederholen sich (Stadtbus Winterthur 1–14, mehrere «E»).
// Das Präfix der route_id bezeichnet den Betrieb: 1 VBZ-Tram, 2 VBZ-Trolleybus, 3 VBZ-Bus, 4 VBZ-Auftragslinien.
const nummer = (n) => (/^\d+$/.test(n) ? Number(n) : NaN);
const gtfsLinie = BUS
  ? (typ, routeId, n) => typ === '3' && ['2', '3', '4'].includes(routeId.split('-')[0]) && nummer(n) >= 31 && nummer(n) <= 99
  : (typ) => typ === '0' || typ === '900';
// Die VBZ-Fahrzeiten enthalten nur VBZ-Linien: Tram 2–20, Stadtbus 31–99
const fahrzeitenLinie = BUS ? (n) => nummer(n) >= 31 && nummer(n) <= 99 : (n) => nummer(n) <= 20;
const ARTNAME = BUS ? 'Bus' : 'Tram';

const KURZ = 8; // Zeiträume unter so vielen Wochen gelten als vorübergehend

// ---------- Haltestellennamen abgleichen ----------
const slug = (s) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/strasse\b/g, 'str')
    .replace(/str\./g, 'str')
    .replace(/\bbhf\.?/g, 'bahnhof')
    .replace(/[^a-z0-9]/g, '');
// Nur Tramhaltestellen: Bushaltestellen in netz.json stammen aus einem früheren Import und entstehen hier neu.
const tramHalte = netz.haltestellen.filter((h) => !h.nurBus);
const unsere = new Map();
const ortVon = new Map(tramHalte.map((h) => [h.id, h.ort]));
for (const h of tramHalte) {
  unsere.set(slug(h.name), h.id);
  unsere.set(slug(`${h.ort} ${h.name}`), h.id);
}
// «Zürich, Maienweg» (Bus 40) ist nicht «Maienweg» in Dietikon (Limmattalbahn):
// Steht im Fahrplan ein Ort und liegt unsere Haltestelle auf der anderen Seite der Stadtgrenze, passt der Name nicht.
const ersterOrt = (o) => ((o ?? '').split(/[ ,]/)[0] === 'Zch' ? 'Zürich' : (o ?? '').split(/[ ,]/)[0]);
const ortPasst = (ort, id) => {
  const unser = ersterOrt(ortVon.get(id));
  if (!ort || !unser || ersterOrt(ort) === unser) return true;
  return ersterOrt(ort) !== 'Zürich' && unser !== 'Zürich';
};
// Umbenennungen und Schreibweisen, die sich nicht automatisch zuordnen lassen: Fahrplanname -> unsere id
const ALIAS = Object.fromEntries(
  Object.entries({ ...cfg.fahrplan_alias, ...(BUS ? busCfg.fahrplan_alias : {}) }).map(([k, v]) => [slug(k), v]),
);
const unbekannt = new Map(); // Name -> Anzahl Fahrten
// Depot- und Garagenhalte sowie Aliase mit Wert null (z.B. Wendeschlaufen) gehören nicht zum Linienweg
const ignoriert = (n) => /\b(Depot|Garage)\b/.test(n) || ALIAS[slug(n)] === null;
function haltestelle(roh) {
  // Kantenbuchstaben («Bellevue A», «Bahnhof Altstetten N K») entfernen
  const name = roh.replace(/Altstetten N\b/, 'Altstetten Nord').replace(/(\s[A-Z])+$/, '');
  if (ALIAS[slug(roh)]) return ALIAS[slug(roh)];
  const ohneOrt = name.replace(/^Zürich,\s*/, '');
  const [ort, rest] = name.includes(',') ? name.split(/,\s*/, 2) : ['', name];
  const ortKurz = ort.split(' ').at(-1);
  for (const k of [slug(name), slug(ohneOrt), slug(`${ort} ${rest}`), slug(`${rest} ${ortKurz}`), slug(rest)]) {
    if (ALIAS[k]) return ALIAS[k];
    if (unsere.has(k) && ortPasst(ort, unsere.get(k))) return unsere.get(k);
  }
  return BUS ? busHaltestelle(name) : `?${name}`;
}

// ---------- Bushaltestellen ----------
// Was keine Tramhaltestelle ist, wird eine eigene Bushaltestelle. Die Id bildet build-data.mjs gleich (aus dem Namen).
const idAus = (s) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const busHalte = new Map(); // id -> {id, name, ort, fahrplanNamen:Set, lage: Map(quelle -> Map(punkt -> [lon, lat]))}
function busHaltestelle(name) {
  const [ort, rest] = name.includes(',') ? name.split(/,\s*/, 2) : ['Zürich', name];
  let anzeige = ort === 'Zürich' ? rest : `${ort}, ${rest}`;
  // gleichnamige Tramhaltestelle anderswo: Ort dazuschreiben, z.B. «Maienweg (Zürich)»
  if (tramHalte.some((h) => (h.name === anzeige || h.id === idAus(anzeige)))) anzeige = `${rest} (${ort})`;
  const id = idAus(anzeige);
  if (!busHalte.has(id)) busHalte.set(id, { id, name: anzeige, ort, fahrplanNamen: new Set(), lage: new Map() });
  busHalte.get(id).fahrplanNamen.add(name);
  return id;
}
// Lage eines Haltepunkts merken (pro Quelle, damit am Ende die neueste gilt)
function lageMerken(id, quelle, punkt, lonlat) {
  const h = busHalte.get(id);
  if (!h || !lonlat || lonlat.some((x) => !Number.isFinite(x))) return;
  if (!h.lage.has(quelle)) h.lage.set(quelle, new Map());
  h.lage.get(quelle).set(punkt, lonlat);
}

// ---------- Fahrwege (nur Bus, aus GTFS shapes.txt) ----------
const R = 6371000, RAD = Math.PI / 180;
const abstand = ([a, b], [c, d]) => {
  const x = (c - a) * RAD * Math.cos(((b + d) / 2) * RAD), y = (d - b) * RAD;
  return R * Math.hypot(x, y);
};
// Douglas-Peucker mit Toleranz in Metern
function vereinfachen(pts, tol = 2) {
  if (pts.length < 3) return pts;
  const k = Math.cos(pts[0][1] * RAD) * R * RAD, m = R * RAD;
  const xy = pts.map(([lon, lat]) => [lon * k, lat * m]);
  const behalten = new Uint8Array(pts.length);
  behalten[0] = behalten[pts.length - 1] = 1;
  const stapel = [[0, pts.length - 1]];
  while (stapel.length) {
    const [i, j] = stapel.pop();
    const [ax, ay] = xy[i], [bx, by] = xy[j];
    const L = Math.hypot(bx - ax, by - ay) || 1;
    let max = 0, idx = -1;
    for (let n = i + 1; n < j; n++) {
      const d = Math.abs((bx - ax) * (ay - xy[n][1]) - (ax - xy[n][0]) * (by - ay)) / L;
      if (d > max) [max, idx] = [d, n];
    }
    if (max > tol) {
      behalten[idx] = 1;
      stapel.push([i, idx], [idx, j]);
    }
  }
  return pts.filter((_, i) => behalten[i]);
}
// Ausschnitt eines Fahrwegs zwischen zwei Distanzen (Meter ab Fahrtbeginn)
function ausschnitt(shape, d0, d1) {
  const { pts, d } = shape;
  const bei = (x) => {
    let i = 0;
    while (i < d.length - 2 && d[i + 1] < x) i++;
    const f = d[i + 1] > d[i] ? Math.min(1, Math.max(0, (x - d[i]) / (d[i + 1] - d[i]))) : 0;
    return [i, [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f]];
  };
  const [i, a] = bei(d0), [j, b] = bei(d1);
  return [a, ...pts.slice(i + 1, j + 1), b];
}
// Nächster Punkt des Fahrwegs ab einer Distanz (falls stop_times keine Distanzen hat)
function projizieren(shape, lonlat, ab) {
  let best = Infinity, bd = ab;
  for (let i = 0; i < shape.pts.length; i++) {
    if (shape.d[i] < ab) continue;
    const a = abstand(shape.pts[i], lonlat);
    if (a < best) [best, bd] = [a, shape.d[i]];
  }
  return bd;
}
const fahrwege = new Map(); // "a~b" -> {quelle, coords (a -> b)}

// ---------- Hilfen ----------
const tag = (s) => new Date(`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T12:00:00Z`);
const iso = (d) => d.toISOString().slice(0, 10);
function montag(d) {
  const m = new Date(d);
  m.setUTCDate(m.getUTCDate() - ((m.getUTCDay() + 6) % 7));
  return iso(m);
}
const plusTage = (isoStr, n) => {
  const d = new Date(`${isoStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
};
function zeilen(datei, eintrag) {
  const quelle = datei.endsWith('.csv') ? createReadStream(datei) : spawn('unzip', ['-p', ...datei.split('#')]).stdout;
  return createInterface({ input: quelle, crlfDelay: Infinity });
}
function felderAus(z) {
  // CSV-Zeile mit Anführungszeichen (Kommas in Namen wie «Zürich, Paradeplatz»)
  if (!z.includes('"')) return z.split(',');
  const out = [];
  let f = '', inQ = false;
  for (let i = 0; i < z.length; i++) {
    const c = z[i];
    if (inQ) {
      if (c === '"' && z[i + 1] === '"') { f += '"'; i++; }
      else if (c === '"') inQ = false;
      else f += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { out.push(f); f = ''; }
    else f += c;
  }
  out.push(f);
  return out;
}
async function csv(datei, fn) {
  let kopf = null;
  for await (const z of zeilen(datei)) {
    const felder = felderAus(z.replace(/^﻿/, ''));
    if (!kopf) kopf = Object.fromEntries(felder.map((f, i) => [f, i]));
    else fn(felder, kopf);
  }
}
const kanon = (folge) => {
  const r = [...folge].reverse();
  return folge.join('|') <= r.join('|') ? folge : r;
};

// Linie -> Woche -> Weg -> Punkte
const wertung = new Map();
const wegFolge = new Map(); // Schlüssel -> Folge
function zaehlen(linie, woche, folge, gewicht) {
  if (folge.length < 2) return;
  const k = kanon(folge);
  const key = k.join('|');
  wegFolge.set(key, k);
  if (!wertung.has(linie)) wertung.set(linie, new Map());
  const proWoche = wertung.get(linie);
  if (!proWoche.has(woche)) proWoche.set(woche, new Map());
  const m = proWoche.get(woche);
  m.set(key, (m.get(key) ?? 0) + gewicht * folge.length);
}
const verdichten = (ids) => ids.filter((h, i) => i === 0 || h !== ids[i - 1]);

// ---------- GTFS ----------
const quellenInfo = {};
const linienInfo = {}; // Liniennummer -> {farbe} (GTFS route_color, neuestes Fahrplanjahr gewinnt)
const wochenBereich = new Map(); // Woche -> Quelle (für Lücken)
async function gtfs(jahr) {
  const zip = pfad(`data/raw/gtfs/${jahr}.zip`);
  const datei = (n) => `${zip}#${n}`;
  const routen = new Map();
  await csv(datei('routes.txt'), (f, k) => {
    if (!gtfsLinie(f[k.route_type], f[k.route_id], f[k.route_short_name])) return;
    routen.set(f[k.route_id], f[k.route_short_name]);
    const farbe = f[k.route_color];
    if (farbe) linienInfo[f[k.route_short_name]] = { ...linienInfo[f[k.route_short_name]], farbe: `#${farbe.toUpperCase()}` };
  });
  // Betriebstage je Dienst, als Tage pro Woche
  const dienst = new Map();
  let von = '99999999', bis = '00000000';
  await csv(datei('calendar.txt'), (f, k) => {
    const tage = new Set();
    const wd = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((w) => f[k[w]] === '1');
    for (let d = tag(f[k.start_date]); d <= tag(f[k.end_date]); d.setUTCDate(d.getUTCDate() + 1)) {
      if (wd[(d.getUTCDay() + 6) % 7]) tage.add(iso(d));
    }
    dienst.set(f[k.service_id], tage);
    if (f[k.start_date] < von) von = f[k.start_date];
    if (f[k.end_date] > bis) bis = f[k.end_date];
  });
  await csv(datei('calendar_dates.txt'), (f, k) => {
    if (!dienst.has(f[k.service_id])) dienst.set(f[k.service_id], new Set());
    const d = iso(tag(f[k.date]));
    if (f[k.exception_type] === '1') dienst.get(f[k.service_id]).add(d);
    else dienst.get(f[k.service_id]).delete(d);
  });
  const proWoche = new Map();
  for (const [id, tage] of dienst) {
    const w = new Map();
    for (const d of tage) w.set(montag(new Date(`${d}T12:00:00Z`)), (w.get(montag(new Date(`${d}T12:00:00Z`))) ?? 0) + 1);
    proWoche.set(id, w);
  }
  const fahrten = new Map(); // trip_id -> {linie, dienst, shape}
  const shapeIds = new Set();
  await csv(datei('trips.txt'), (f, k) => {
    const l = routen.get(f[k.route_id]);
    if (!l) return;
    fahrten.set(f[k.trip_id], { linie: l, dienst: f[k.service_id], shape: f[k.shape_id] });
    if (f[k.shape_id]) shapeIds.add(f[k.shape_id]);
  });
  const halteInfo = new Map(); // stop_id -> {name, lonlat}
  await csv(datei('stops.txt'), (f, k) =>
    halteInfo.set(f[k.stop_id], { name: f[k.stop_name], lonlat: [Number(f[k.stop_lon]), Number(f[k.stop_lat])] }),
  );
  const q = `gtfs-${jahr}`;

  // Fahrwege der Busfahrten
  const shapes = new Map(); // shape_id -> {pts, d}
  if (BUS) {
    await csv(datei('shapes.txt'), (f, k) => {
      const id = f[k.shape_id];
      if (!shapeIds.has(id)) return;
      if (!shapes.has(id)) shapes.set(id, { roh: [] });
      shapes.get(id).roh.push([Number(f[k.shape_pt_sequence]), Number(f[k.shape_pt_lon]), Number(f[k.shape_pt_lat]), f[k.shape_dist_traveled]]);
    });
    for (const s of shapes.values()) {
      s.roh.sort((a, b) => a[0] - b[0]);
      s.pts = s.roh.map(([, lon, lat]) => [lon, lat]);
      // Distanzen aus der Datei oder selbst aufsummiert
      const mitD = s.roh.every((r) => r[3] !== '' && r[3] !== undefined);
      s.d = mitD ? s.roh.map((r) => Number(r[3])) : s.pts.map((_, i, p) => 0);
      if (!mitD) for (let i = 1; i < s.pts.length; i++) s.d[i] = s.d[i - 1] + abstand(s.pts[i - 1], s.pts[i]);
      delete s.roh;
    }
  }

  // Halte je Fahrt (stop_times ist nach Fahrt sortiert)
  let aktuell = null, halte = [];
  const abschliessen = () => {
    if (!aktuell) return;
    const t = fahrten.get(aktuell);
    halte.sort((a, b) => a[0] - b[0]);
    const gueltig = halte.filter(([, h]) => h && !ignoriert(h.name));
    const roh = gueltig.map(([, h]) => h.name);
    const ids = roh.map(haltestelle);
    const folge = verdichten(ids);
    for (const n of roh) if (haltestelle(n).startsWith('?')) unbekannt.set(n, (unbekannt.get(n) ?? 0) + 1);
    for (const [w, tage] of proWoche.get(t.dienst) ?? []) zaehlen(t.linie, w, folge, tage);
    if (!BUS) return;
    gueltig.forEach(([, h, stopId], i) => lageMerken(ids[i], q, stopId, h.lonlat));
    // Fahrweg zwischen aufeinanderfolgenden Haltestellen
    const shape = shapes.get(t.shape);
    if (!shape || shape.pts.length < 2) return;
    let ab = 0;
    const dist = gueltig.map(([, h, , d]) => {
      const x = d !== '' && d !== undefined && Number.isFinite(Number(d)) ? Number(d) : projizieren(shape, h.lonlat, ab);
      ab = x;
      return x;
    });
    for (let i = 1; i < ids.length; i++) {
      const [a, b] = [ids[i - 1], ids[i]];
      if (a === b) continue;
      const key = [a, b].sort().join('~');
      if (fahrwege.get(key)?.quelle === q) continue; // neuester Fahrplan gewinnt
      // Halt a: letzte Stelle mit a vor b
      let coords = ausschnitt(shape, dist[i - 1], dist[i]);
      if (coords.length < 2 || dist[i] <= dist[i - 1]) continue;
      if (a > b) coords = coords.reverse();
      fahrwege.set(key, { quelle: q, coords });
    }
  };
  await csv(datei('stop_times.txt'), (f, k) => {
    const trip = f[k.trip_id];
    if (trip !== aktuell) {
      abschliessen();
      aktuell = fahrten.has(trip) ? trip : null;
      halte = [];
    }
    if (aktuell) halte.push([Number(f[k.stop_sequence]), halteInfo.get(f[k.stop_id]), f[k.stop_id], f[k.shape_dist_traveled]]);
  });
  abschliessen();
  quellenInfo[q] = { von: iso(tag(von)), bis: iso(tag(bis)), art: 'gtfs' };
  for (let w = montag(tag(von)); w <= iso(tag(bis)); w = plusTage(w, 7)) wochenBereich.set(w, q);
  console.log(`GTFS ${jahr}: ${fahrten.size} ${ARTNAME}fahrten, ${iso(tag(von))} – ${iso(tag(bis))}`);
}

// ---------- VBZ-Fahrzeiten (eine Stichwoche) ----------
async function fahrzeiten(jahr) {
  const ordner = pfad(`data/raw/fahrzeiten/${jahr}/`);
  const datei = readdirSync(ordner).find((n) => n.startsWith('Fahrzeiten_SOLL_IST_'));
  const halteName = new Map();
  await csv(`${ordner}Haltestelle.csv`, (f, k) => halteName.set(f[k.halt_id], f[k.halt_lang]));
  // Koordinaten der Haltepunkte (2015 mit Dezimalkomma)
  const punktLage = new Map();
  const zahl = (x) => Number((x ?? '').replace(',', '.'));
  await csv(`${ordner}Haltepunkt.csv`, (f, k) => punktLage.set(f[k.halt_punkt_id], [zahl(f[k.GPS_Longitude]), zahl(f[k.GPS_Latitude])]));
  const fahrten = new Map(); // fahrt_id -> {linie, tage:Set, halte:Map(seq -> [name, punkt])}
  await csv(`${ordner}${datei}`, (f, k) => {
    const linie = f[k.linie];
    if (!fahrzeitenLinie(linie)) return;
    const id = `${f[k.fahrt_id]}`;
    let t = fahrten.get(id);
    if (!t) fahrten.set(id, (t = { linie, tage: new Set(), halte: new Map() }));
    t.tage.add(f[k.betriebsdatum]);
    t.halte.set(Number(f[k.seq_von]), [halteName.get(f[k.halt_id_von]), f[k.halt_punkt_id_von]]);
    t.halte.set(Number(f[k.seq_von]) + 1, [halteName.get(f[k.halt_id_nach]), f[k.halt_punkt_id_nach]]);
  });
  const [, a, b] = datei.match(/(\d{8})_(\d{8})/);
  const woche = montag(tag(a));
  const q = `vbz-fahrzeiten-${jahr}`;
  for (const t of fahrten.values()) {
    const halte = [...t.halte].sort((x, y) => x[0] - y[0]).map(([, h]) => h).filter(([n]) => !ignoriert(n ?? '?'));
    const roh = halte.map(([n]) => n ?? '?');
    const ids = roh.map(haltestelle);
    for (const n of roh) if (haltestelle(n).startsWith('?')) unbekannt.set(n, (unbekannt.get(n) ?? 0) + 1);
    if (BUS) halte.forEach(([, punkt], i) => lageMerken(ids[i], q, punkt, punktLage.get(punkt)));
    zaehlen(t.linie, woche, verdichten(ids), 1);
  }
  quellenInfo[q] = { von: iso(tag(a)), bis: iso(tag(b)), art: 'stichwoche' };
  wochenBereich.set(woche, q);
  console.log(`Fahrzeiten ${jahr}: ${fahrten.size} ${ARTNAME}fahrten in der Woche ${iso(tag(a))} – ${iso(tag(b))}`);
}

for (const j of [2015, 2016, 2017, 2018]) if (existsSync(pfad(`data/raw/fahrzeiten/${j}/`))) await fahrzeiten(j);
for (let j = 2019; j <= 2026; j++) if (existsSync(pfad(`data/raw/gtfs/${j}.zip`))) await gtfs(j);

// ---------- Zeiträume ----------
const ergebnis = {};
for (const [linie, proWoche] of [...wertung].sort((a, b) => Number(a[0]) - Number(b[0]) || a[0].localeCompare(b[0]))) {
  const perioden = [];
  for (const w of [...proWoche.keys()].sort()) {
    const m = proWoche.get(w);
    const [key] = [...m].sort((a, b) => b[1] - a[1])[0];
    const q = wochenBereich.get(w);
    const letzte = perioden.at(-1);
    // Stichwochen stehen für sich; GTFS-Wochen werden zusammengefasst
    if (letzte && letzte.key === key && quellenInfo[q].art === 'gtfs' && quellenInfo[letzte.quellen.at(-1)].art === 'gtfs' && plusTage(letzte.bis, 1) === w) {
      letzte.bis = plusTage(w, 6);
      letzte.wochen++;
      if (!letzte.quellen.includes(q)) letzte.quellen.push(q);
    } else {
      perioden.push({ key, von: w, bis: plusTage(w, 6), wochen: 1, quellen: [q] });
    }
  }
  // Vorübergehend: kurz, oder eingeschoben zwischen zwei Zeiträumen mit gleichem Weg (Baustellen über Monate)
  const gtfsP = (p) => quellenInfo[p.quellen[0]].art === 'gtfs';
  ergebnis[linie] = perioden.map(({ key, ...p }, i) => {
    const vor = perioden[i - 1], nach = perioden[i + 1];
    const eingeschoben = gtfsP(p) && vor && nach && gtfsP(vor) && vor.key === nach.key && vor.key !== key;
    return { ...p, kurz: gtfsP(p) && (p.wochen < KURZ || eingeschoben), halte: wegFolge.get(key) };
  });
}

// ---------- Vergleich mit den erfassten Versionen ----------
const name = (id) =>
  id.startsWith('?') ? `${id.slice(1)} (unbekannt)` : netz.haltestellen.find((h) => h.id === id)?.name ?? busHalte.get(id)?.name ?? id;
const istBus = (l) => l.art === 'bus';
const linieZuId = new Map(netz.linien.filter((l) => istBus(l) === BUS).map((l) => [l.nummer, l.id]));
function unsereVersion(linie, datum) {
  const id = linieZuId.get(linie);
  return netz.versionen.find((v) => v.linie === id && (!v.von || v.von <= datum) && (!v.bis || v.bis >= datum));
}
function vergleich(a, b) {
  const A = new Set(a), B = new Set(b);
  const neu = b.filter((x) => !A.has(x));
  const weg = a.filter((x) => !B.has(x));
  const gleicheMenge = !neu.length && !weg.length;
  const gleicheFolge = gleicheMenge && (a.join('|') === b.join('|') || a.join('|') === [...b].reverse().join('|'));
  return { neu, weg, gleicheFolge, gleicheMenge };
}

const md = [`# Abgleich Fahrplandaten – erfasste Versionen (${ARTNAME})`, '', `Erstellt ${new Date().toISOString().slice(0, 10)} mit \`scripts/import/import-fahrplan.mjs\`.`, ''];
md.push('Quellen:', '');
for (const [q, i] of Object.entries(quellenInfo)) md.push(`- \`${q}\`: ${i.von} – ${i.bis}${i.art === 'stichwoche' ? ' (Stichwoche)' : ''}`);
md.push('', `Zeiträume unter ${KURZ} Wochen oder zwischen zwei Zeiträumen mit gleichem Weg sind als *vorübergehend* markiert (Umleitungen, Baustellen).`, '');
let stimmt = 0, abweichend = 0;
// Nur Linien, die im Archiv erfasst sind; übrige (Dienst-, Sonder-, Baulinien) gesondert aufführen
const andere = Object.keys(ergebnis).filter((l) => !linieZuId.has(l));
for (const [linie, perioden] of Object.entries(ergebnis)) {
  if (!linieZuId.has(linie)) continue;
  md.push(`## Linie ${linie}`, '');
  for (const p of perioden) {
    const mitte = p.von < p.bis ? plusTage(p.von, Math.floor((new Date(p.bis) - new Date(p.von)) / 864e5 / 2)) : p.von;
    const v = unsereVersion(linie, mitte);
    const kopf = `**${p.von} – ${p.bis}** (${p.wochen} Wo., ${p.quellen.join(', ')})${p.kurz ? ' *vorübergehend*' : ''}: ${name(p.halte[0])} – ${name(p.halte.at(-1))}, ${p.halte.length} Halte`;
    if (!v) {
      md.push(`- ${kopf}`, `  - keine erfasste Version`);
      if (!p.kurz) abweichend++;
      continue;
    }
    const c = vergleich(v.haltestellen, p.halte);
    p.version = v.id;
    p.abgleich = c.gleicheFolge ? 'gleich' : c.gleicheMenge ? 'andere Reihenfolge' : 'abweichend';
    if (!p.kurz) c.gleicheFolge ? stimmt++ : abweichend++;
    md.push(`- ${kopf}`, `  - Version \`${v.id}\` (${v.status}): ${p.abgleich}`);
    if (c.neu.length) md.push(`  - nur im Fahrplan: ${c.neu.map(name).join(', ')}`);
    if (c.weg.length) md.push(`  - nur erfasst: ${c.weg.map(name).join(', ')}`);
    if (!c.gleicheFolge && !p.kurz && v.notiz) md.push(`  - Notiz der Version: ${v.notiz}`);
  }
  md.push('');
}
md.push('## Nicht erfasste Linien', '', `Im Fahrplan als ${ARTNAME} geführt, im Archiv (noch) keine Linie:`, '');
for (const linie of andere) {
  const ps = ergebnis[linie];
  md.push(`- **${linie}**: ${ps.map((p) => `${p.von} – ${p.bis} (${name(p.halte[0])} – ${name(p.halte.at(-1))})`).join('; ')}`);
}
md.push('');
const unbek = [...unbekannt].sort((a, b) => b[1] - a[1]);
md.push('## Unbekannte Haltestellennamen', '', 'In `data/linien.yaml` unter `fahrplan_alias` zuordnen oder als neue Haltestelle erfassen.', '');
const inDauerhaftem = new Set(Object.values(ergebnis).flat().filter((p) => !p.kurz).flatMap((p) => p.halte));
for (const [n, c] of unbek) md.push(`- ${n} (${c} Fahrten)${inDauerhaftem.has(`?${n}`) ? ' – **in einem dauerhaften Linienweg**' : ''}`);

// ---------- Bus: Haltestellen und Fahrwege der dauerhaften Linienwege ----------
if (BUS) {
  const benutzt = new Set(), paare = new Set();
  for (const p of Object.values(ergebnis).flat()) {
    if (p.kurz) continue;
    p.halte.forEach((h, i) => {
      benutzt.add(h);
      if (i) paare.add([p.halte[i - 1], h].sort().join('~'));
    });
  }
  const reihenfolge = Object.keys(quellenInfo); // Fahrzeiten 2015–2018, dann GTFS 2019–2026
  const halteListe = [...busHalte.values()]
    .filter((h) => benutzt.has(h.id) && h.lage.size)
    .map((h) => {
      const neueste = [...h.lage.keys()].sort((a, b) => reihenfolge.indexOf(a) - reihenfolge.indexOf(b)).at(-1);
      const pts = [...h.lage.get(neueste).values()];
      const mittel = (i) => +(pts.reduce((s, p) => s + p[i], 0) / pts.length).toFixed(6);
      return { id: h.id, name: h.name, ort: h.ort, lon: mittel(0), lat: mittel(1), fahrplan: [...h.fahrplanNamen].sort() };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
  const ohneLage = [...benutzt].filter((id) => busHalte.has(id) && !busHalte.get(id).lage.size);
  const kanten = Object.fromEntries(
    [...fahrwege]
      .filter(([k]) => paare.has(k))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, { quelle, coords }]) => [k, { quelle, coords: vereinfachen(coords).map(([x, y]) => [+x.toFixed(6), +y.toFixed(6)]) }]),
  );
  const ohneWeg = [...paare].filter((k) => !kanten[k]);
  // Mögliche Umbenennungen: verschiedene Namen, fast gleiche Lage
  const nahe = [];
  for (let i = 0; i < halteListe.length; i++)
    for (let j = i + 1; j < halteListe.length; j++) {
      const [a, b] = [halteListe[i], halteListe[j]];
      if (abstand([a.lon, a.lat], [b.lon, b.lat]) < 60) nahe.push(`${a.name} / ${b.name}`);
    }
  md.push('', '## Bushaltestellen', '', `${halteListe.length} Haltestellen ohne Tram, ${Object.keys(kanten).length} Abschnitte mit Fahrweg aus GTFS.`, '');
  if (ohneLage.length) md.push(`Ohne Lage: ${ohneLage.map(name).join(', ')}`, '');
  if (ohneWeg.length) md.push(`Abschnitte ohne Fahrweg (nur 2015–2018, im Archiv als Gerade): ${ohneWeg.map((k) => k.split('~').map(name).join(' – ')).join('; ')}`, '');
  if (nahe.length) md.push('Weniger als 60 m voneinander entfernt (Umbenennung? dann `fahrplan_alias` in data/busse.yaml):', '', ...nahe.map((n) => `- ${n}`), '');
  await mkdir(new URL('data/bus/', root), { recursive: true });
  await writeFile(new URL('data/bus/haltestellen.json', root), JSON.stringify(halteListe, null, 1));
  await writeFile(new URL('data/bus/kanten.json', root), JSON.stringify(kanten));
  console.log(`Bus: ${halteListe.length} Haltestellen, ${Object.keys(kanten).length} Abschnitte mit Fahrweg, ${ohneWeg.length} ohne`);
}

await mkdir(new URL(AUSGABE, root), { recursive: true });
await writeFile(new URL(`${AUSGABE}fahrplan.json`, root), JSON.stringify({ quellen: quellenInfo, linien: ergebnis, linienInfo }, null, 1));
await writeFile(new URL(`${AUSGABE}bericht.md`, root), md.join('\n') + '\n');
console.log(`Zeiträume (ohne vorübergehende): ${stimmt} stimmen, ${abweichend} weichen ab; ${unbek.length} unbekannte Namen`);
