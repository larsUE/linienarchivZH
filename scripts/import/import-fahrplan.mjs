// Liest Haltestellenfolgen der Tramlinien aus Fahrplandaten und vergleicht sie mit data/linien.yaml.
//
//   node scripts/import/import-fahrplan.mjs
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
//   data/import/fahrplan.json   Zeiträume je Linie mit Haltestellenfolge
//   data/import/bericht.md      Vergleich mit den erfassten Versionen

import { spawn } from 'node:child_process';
import { createReadStream, existsSync, readdirSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { parse } from 'yaml';

const root = new URL('../../', import.meta.url);
const pfad = (p) => new URL(p, root).pathname;
const netz = JSON.parse(await readFile(new URL('public/data/netz.json', root), 'utf8'));
const cfg = parse(await readFile(new URL('data/linien.yaml', root), 'utf8'));

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
const unsere = new Map();
for (const h of netz.haltestellen) {
  unsere.set(slug(h.name), h.id);
  unsere.set(slug(`${h.ort} ${h.name}`), h.id);
}
// Umbenennungen und Schreibweisen, die sich nicht automatisch zuordnen lassen: Fahrplanname -> unsere id
const ALIAS = Object.fromEntries(Object.entries(cfg.fahrplan_alias ?? {}).map(([k, v]) => [slug(k), v]));
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
    if (unsere.has(k)) return unsere.get(k);
  }
  return `?${name}`;
}

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
const wochenBereich = new Map(); // Woche -> Quelle (für Lücken)
async function gtfs(jahr) {
  const zip = pfad(`data/raw/gtfs/${jahr}.zip`);
  const datei = (n) => `${zip}#${n}`;
  const routen = new Map();
  await csv(datei('routes.txt'), (f, k) => {
    if (f[k.route_type] === '0' || f[k.route_type] === '900') routen.set(f[k.route_id], f[k.route_short_name]);
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
  const fahrten = new Map(); // trip_id -> {linie, dienst}
  await csv(datei('trips.txt'), (f, k) => {
    const l = routen.get(f[k.route_id]);
    if (l) fahrten.set(f[k.trip_id], { linie: l, dienst: f[k.service_id] });
  });
  const namen = new Map();
  await csv(datei('stops.txt'), (f, k) => namen.set(f[k.stop_id], f[k.stop_name]));

  // Halte je Fahrt (stop_times ist nach Fahrt sortiert)
  let aktuell = null, halte = [];
  const abschliessen = () => {
    if (!aktuell) return;
    const t = fahrten.get(aktuell);
    halte.sort((a, b) => a[0] - b[0]);
    const roh = halte.map(([, n]) => n).filter((n) => !ignoriert(n));
    const folge = verdichten(roh.map(haltestelle));
    for (const n of roh) if (haltestelle(n).startsWith('?')) unbekannt.set(n, (unbekannt.get(n) ?? 0) + 1);
    for (const [w, tage] of proWoche.get(t.dienst) ?? []) zaehlen(t.linie, w, folge, tage);
  };
  await csv(datei('stop_times.txt'), (f, k) => {
    const trip = f[k.trip_id];
    if (trip !== aktuell) {
      abschliessen();
      aktuell = fahrten.has(trip) ? trip : null;
      halte = [];
    }
    if (aktuell) halte.push([Number(f[k.stop_sequence]), namen.get(f[k.stop_id])]);
  });
  abschliessen();
  const q = `gtfs-${jahr}`;
  quellenInfo[q] = { von: iso(tag(von)), bis: iso(tag(bis)), art: 'gtfs' };
  for (let w = montag(tag(von)); w <= iso(tag(bis)); w = plusTage(w, 7)) wochenBereich.set(w, q);
  console.log(`GTFS ${jahr}: ${fahrten.size} Tramfahrten, ${iso(tag(von))} – ${iso(tag(bis))}`);
}

// ---------- VBZ-Fahrzeiten (eine Stichwoche) ----------
async function fahrzeiten(jahr) {
  const ordner = pfad(`data/raw/fahrzeiten/${jahr}/`);
  const datei = readdirSync(ordner).find((n) => n.startsWith('Fahrzeiten_SOLL_IST_'));
  const halteName = new Map();
  await csv(`${ordner}Haltestelle.csv`, (f, k) => halteName.set(f[k.halt_id], f[k.halt_lang]));
  const fahrten = new Map(); // fahrt_id -> {linie, tage:Set, halte:[[seq, id]]}
  await csv(`${ordner}${datei}`, (f, k) => {
    const linie = f[k.linie];
    if (!/^\d+$/.test(linie) || Number(linie) > 20) return; // Tram: Linien 2–20
    const id = `${f[k.fahrt_id]}`;
    let t = fahrten.get(id);
    if (!t) fahrten.set(id, (t = { linie, tage: new Set(), halte: new Map() }));
    t.tage.add(f[k.betriebsdatum]);
    t.halte.set(Number(f[k.seq_von]), halteName.get(f[k.halt_id_von]));
    t.halte.set(Number(f[k.seq_von]) + 1, halteName.get(f[k.halt_id_nach]));
  });
  const [, a, b] = datei.match(/(\d{8})_(\d{8})/);
  const woche = montag(tag(a));
  for (const t of fahrten.values()) {
    const roh = [...t.halte].sort((x, y) => x[0] - y[0]).map(([, n]) => n ?? '?').filter((n) => !ignoriert(n));
    for (const n of roh) if (haltestelle(n).startsWith('?')) unbekannt.set(n, (unbekannt.get(n) ?? 0) + 1);
    zaehlen(t.linie, woche, verdichten(roh.map(haltestelle)), 1);
  }
  const q = `vbz-fahrzeiten-${jahr}`;
  quellenInfo[q] = { von: iso(tag(a)), bis: iso(tag(b)), art: 'stichwoche' };
  wochenBereich.set(woche, q);
  console.log(`Fahrzeiten ${jahr}: ${fahrten.size} Tramfahrten in der Woche ${iso(tag(a))} – ${iso(tag(b))}`);
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
const name = (id) => (id.startsWith('?') ? `${id.slice(1)} (unbekannt)` : netz.haltestelleById?.get(id)?.name ?? netz.haltestellen.find((h) => h.id === id)?.name ?? id);
const linieZuId = new Map(netz.linien.map((l) => [l.nummer, l.id]));
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

const md = ['# Abgleich Fahrplandaten – erfasste Versionen', '', `Erstellt ${new Date().toISOString().slice(0, 10)} mit \`scripts/import/import-fahrplan.mjs\`.`, ''];
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
md.push('## Nicht erfasste Linien', '', 'Im Fahrplan als Tram geführt, im Archiv (noch) keine Linie:', '');
for (const linie of andere) {
  const ps = ergebnis[linie];
  md.push(`- **${linie}**: ${ps.map((p) => `${p.von} – ${p.bis} (${name(p.halte[0])} – ${name(p.halte.at(-1))})`).join('; ')}`);
}
md.push('');
const unbek = [...unbekannt].sort((a, b) => b[1] - a[1]);
md.push('## Unbekannte Haltestellennamen', '', 'In `data/linien.yaml` unter `fahrplan_alias` zuordnen oder als neue Haltestelle erfassen.', '');
const inDauerhaftem = new Set(Object.values(ergebnis).flat().filter((p) => !p.kurz).flatMap((p) => p.halte));
for (const [n, c] of unbek) md.push(`- ${n} (${c} Fahrten)${inDauerhaftem.has(`?${n}`) ? ' – **in einem dauerhaften Linienweg**' : ''}`);

await mkdir(new URL('data/import/', root), { recursive: true });
await writeFile(new URL('data/import/fahrplan.json', root), JSON.stringify({ quellen: quellenInfo, linien: ergebnis }, null, 1));
await writeFile(new URL('data/import/bericht.md', root), md.join('\n') + '\n');
console.log(`Zeiträume (ohne vorübergehende): ${stimmt} stimmen, ${abweichend} weichen ab; ${unbek.length} unbekannte Namen`);
