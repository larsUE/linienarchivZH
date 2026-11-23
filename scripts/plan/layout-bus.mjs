// Busnetz im Liniennetzplan: legt die Busse oktilinear über das feste Tramlayout.
//
//   node scripts/plan/layout-bus.mjs      (nach scripts/plan/layout.mjs)
//
// Eingabe:  public/data/netz.json, data/layout.json (Tramteil)
// Ausgabe:  data/layout.json mit Bushaltestellen und Busabschnitten (bus:a~b) dazu
//
// Ein volles MIP mit festem Tramnetz war zu eng und zu gross (unlösbar oder ohne Lösung in Minuten).
// Darum ein schnelles Verfahren:
//   1. Tramhaltestellen bleiben, wo sie sind. Reine Bushaltestellen bekommen ihre Lage über eine
//      Thin-Plate-Spline durch die Tramhaltestellen (geografisch -> Plan); Knoten werden aufs Raster gesetzt.
//   2. Busabschnitte zwischen denselben Haltestellen wie ein Tram (oder entlang einer Tramfolge)
//      laufen über den Tramabschnitt; die Karte legt sie dort neben das Trambündel.
//   3. Jede übrige Kette zwischen zwei Knoten (Verzweigung, Endpunkt, Tramhaltestelle) wird ein
//      oktilinearer Zug mit höchstens einem Knick. Der Knick liegt dort, wo der verzerrte Fahrweg verläuft.
//      Die Zwischenhalte liegen gleichmässig darauf.

import { readFile, writeFile } from 'node:fs/promises';
import { tps } from './tps.mjs';

const root = new URL('../../', import.meta.url);
const EINHEIT = 12; // Planpunkte pro Haltestellenabstand (wie layout.mjs)
const RASTER = 0.5; // Knoten der Busse auf halbe Einheiten
const LAYOUT = new URL(process.env.AUSGABE ?? 'data/layout.json', root);
const netz = JSON.parse(await readFile(new URL('public/data/netz.json', root), 'utf8'));
const layout = JSON.parse(await readFile(LAYOUT, 'utf8'));

const H = new Map(netz.haltestellen.map((h) => [h.id, h]));
const K = new Map(netz.kanten.map((k) => [k.id, k]));
for (const id of Object.keys(layout.haltestellen)) if (H.get(id)?.nurBus || !H.has(id)) delete layout.haltestellen[id];
for (const id of Object.keys(layout.kanten)) if (id.startsWith('bus:')) delete layout.kanten[id];

// ---------- Lage in Einheiten (y nach oben) ----------
const FIX = new Map(Object.entries(layout.haltestellen).map(([id, [x, y]]) => [id, [x / EINHEIT, -y / EINHEIT]]));
const fehlt = netz.haltestellen.filter((h) => !h.nurBus && !FIX.has(h.id));
if (fehlt.length) throw new Error(`Tramhaltestellen ohne Lage in data/layout.json (zuerst scripts/plan/layout.mjs): ${fehlt.map((h) => h.name).join(', ')}`);
const KOS = Math.cos((47.37 * Math.PI) / 180);
const km = ([lon, lat]) => [lon * KOS * 111.32, lat * 110.574];
const tram = netz.haltestellen.filter((h) => !h.nurBus);
const verzerren = tps(tram.map((h) => km([h.lon, h.lat])), tram.map((h) => FIX.get(h.id)), 0.05);
const P = new Map(netz.haltestellen.map((h) => [h.id, h.nurBus ? verzerren(km([h.lon, h.lat])) : FIX.get(h.id)]));

// Entspannen: Wo der Plan das Gebiet staucht (Affoltern zwischen Oerlikon und Seebach), rücken Bushaltestellen
// zusammen und auf Tramstrecken. Sie bleiben nahe an der verzerrten Lage, halten aber Abstand.
{
  const ABSTAND = 1.5; // Einheiten
  const busIds = netz.haltestellen.filter((h) => h.nurBus).map((h) => h.id);
  const ziel = new Map(busIds.map((id) => [id, P.get(id)]));
  const tramStuecke = netz.kanten
    .filter((k) => !k.bus && layout.kanten[k.id])
    .flatMap((k) => layout.kanten[k.id].map(([x, y]) => [x / EINHEIT, -y / EINHEIT]).flatMap((p, i, a) => (i ? [[a[i - 1], p]] : [])));
  const naechster = (p, [a, b]) => {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0;
    return [a[0] + t * dx, a[1] + t * dy];
  };
  for (let it = 0; it < 400; it++) {
    const neu = new Map();
    for (const id of busIds) {
      const p = P.get(id);
      const z = ziel.get(id);
      let f = [0.03 * (z[0] - p[0]), 0.03 * (z[1] - p[1])];
      const schieben = (q, d0) => {
        const dx = p[0] - q[0], dy = p[1] - q[1];
        const d = Math.hypot(dx, dy);
        if (d >= d0) return;
        const r = d > 1e-6 ? [dx / d, dy / d] : [Math.cos(id.length), Math.sin(id.length)];
        f[0] += 0.5 * (d0 - d) * r[0];
        f[1] += 0.5 * (d0 - d) * r[1];
      };
      for (const [id2, q] of P) if (id2 !== id) schieben(q, ABSTAND);
      for (const s of tramStuecke) schieben(naechster(p, s), 0.7);
      neu.set(id, [p[0] + f[0], p[1] + f[1]]);
    }
    for (const [id, p] of neu) P.set(id, p);
  }
}

// ---------- Busabschnitte auf Tramabschnitten ----------
const meter = ([lon, lat]) => [lon * 111320 * KOS, lat * 110574];
const laengeM = (c) => c.reduce((s, p, i) => (i ? s + Math.hypot(...meter(p).map((v, j) => v - meter(c[i - 1])[j])) : 0), 0);
function abstandZuLinie(p, linie) {
  const q = meter(p);
  let best = Infinity;
  for (let i = 1; i < linie.length; i++) {
    const a = meter(linie[i - 1]), b = meter(linie[i]);
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / l2)) : 0;
    best = Math.min(best, Math.hypot(q[0] - a[0] - t * dx, q[1] - a[1] - t * dy));
  }
  return best;
}
const tramNachbarn = new Map();
for (const k of netz.kanten.filter((k) => !k.bus)) {
  for (const [x, y] of [[k.a, k.b], [k.b, k.a]]) {
    if (!tramNachbarn.has(x)) tramNachbarn.set(x, []);
    tramNachbarn.get(x).push({ nach: y, kante: k });
  }
}
const ueber = new Map(); // Busabschnitt -> Haltestellenfolge über Tramabschnitte
for (const k of netz.kanten.filter((k) => k.bus)) {
  if (K.has(`${k.a}~${k.b}`)) {
    ueber.set(k.id, [k.a, k.b]);
    continue;
  }
  if (!FIX.has(k.a) || !FIX.has(k.b)) continue;
  // entlang einer Tramfolge (höchstens 4 Abschnitte), wenn der Fahrweg darauf liegt
  const L = laengeM(k.coords);
  let best = null;
  const suche = (pfad, coords, laenge) => {
    const v = pfad.at(-1);
    if (laenge > 1.3 * L + 60) return;
    if (v === k.b) {
      if (!best || laenge < best.laenge) best = { pfad: [...pfad], coords: [...coords], laenge };
      return;
    }
    if (pfad.length > 4) return;
    for (const { nach, kante } of tramNachbarn.get(v) ?? []) {
      if (pfad.includes(nach)) continue;
      suche([...pfad, nach], [...coords, ...(kante.a === v ? kante.coords : [...kante.coords].reverse())], laenge + laengeM(kante.coords));
    }
  };
  suche([k.a], [], 0);
  if (best && k.coords.every((p) => abstandZuLinie(p, best.coords) < 60)) ueber.set(k.id, best.pfad);
}

// ---------- Ketten ----------
const busKanten = netz.kanten.filter((k) => k.bus && !ueber.has(k.id));
const nachbarn = new Map();
const kanteZwischen = new Map();
for (const k of busKanten) {
  for (const [x, y] of [[k.a, k.b], [k.b, k.a]]) {
    if (!nachbarn.has(x)) nachbarn.set(x, new Set());
    nachbarn.get(x).add(y);
    kanteZwischen.set(`${x}>${y}`, k);
  }
}
const knoten = new Set([...nachbarn.keys()].filter((v) => FIX.has(v) || nachbarn.get(v).size !== 2));
for (const v of netz.versionen) {
  if (!v.linie.startsWith('bus-')) continue;
  for (const h of [v.haltestellen[0], v.haltestellen.at(-1)]) if (nachbarn.has(h)) knoten.add(h);
}
function ketten() {
  const besucht = new Set();
  const key = (a, b) => (a < b ? `${a}~${b}` : `${b}~${a}`);
  const out = [];
  const ablaufen = (s, n) => {
    const kette = [s];
    let vor = s, akt = n;
    besucht.add(key(s, n));
    while (!knoten.has(akt)) {
      kette.push(akt);
      const weiter = [...nachbarn.get(akt)].find((x) => x !== vor);
      besucht.add(key(akt, weiter));
      [vor, akt] = [akt, weiter];
    }
    kette.push(akt);
    return kette;
  };
  for (const s of knoten) for (const n of nachbarn.get(s)) if (!besucht.has(key(s, n))) out.push(ablaufen(s, n));
  // Ringe ohne Knoten
  for (const [v, ns] of nachbarn) {
    if ([...ns].every((n) => besucht.has(key(v, n)))) continue;
    knoten.add(v);
    return ketten();
  }
  // Schleifen teilen
  for (const k of out) {
    if (k[0] === k.at(-1) && k.length > 3) {
      knoten.add(k[Math.floor(k.length / 2)]);
      return ketten();
    }
  }
  return out;
}
const alle = ketten();

// Knoten der Busse aufs Raster
const lage = new Map(FIX);
const raster = (v) => Math.round(v / RASTER) * RASTER;
for (const v of knoten) if (!FIX.has(v)) lage.set(v, P.get(v).map(raster));

// ---------- Oktilineare Züge ----------
// Von a nach b: Diagonale plus Achse, in einer der beiden Reihenfolgen. Gewählt wird die, die dem
// verzerrten Fahrweg (Stichproben) am nächsten liegt.
function zuege(a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const m = Math.min(Math.abs(dx), Math.abs(dy));
  const diag = [Math.sign(dx) * m, Math.sign(dy) * m];
  const achse = [dx - diag[0], dy - diag[1]];
  if (Math.hypot(...achse) < 1e-6 || m < 1e-6) return [[a, b]];
  return [
    [a, [a[0] + diag[0], a[1] + diag[1]], b],
    [a, [a[0] + achse[0], a[1] + achse[1]], b],
  ];
}
function abstand(p, zug) {
  let best = Infinity;
  for (let i = 1; i < zug.length; i++) {
    const [a, b] = [zug[i - 1], zug[i]];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0;
    best = Math.min(best, Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy));
  }
  return best;
}
const laenge = (zug) => zug.reduce((s, p, i) => (i ? s + Math.hypot(p[0] - zug[i - 1][0], p[1] - zug[i - 1][1]) : 0), 0);
function punktBei(zug, s) {
  for (let i = 1; i < zug.length; i++) {
    const l = Math.hypot(zug[i][0] - zug[i - 1][0], zug[i][1] - zug[i - 1][1]);
    if (s <= l || i === zug.length - 1) {
      const f = l ? Math.min(1, s / l) : 0;
      return { p: [zug[i - 1][0] + f * (zug[i][0] - zug[i - 1][0]), zug[i - 1][1] + f * (zug[i][1] - zug[i - 1][1])], i };
    }
    s -= l;
  }
}
// Teil eines Zugs zwischen den Bogenlängen s0 und s1
function teil(zug, s0, s1) {
  const a = punktBei(zug, s0), b = punktBei(zug, s1);
  return [a.p, ...zug.slice(a.i, b.i), b.p].filter((p, i, arr) => !i || Math.hypot(p[0] - arr[i - 1][0], p[1] - arr[i - 1][1]) > 1e-6);
}

const busWege = new Map(); // Busabschnitt -> Punkte (Einheiten)
let knicke = 0;
const genutzt = new Map(); // Knotenpaar -> gewählte Variante (parallele Ketten bekommen die andere)
for (const kette of alle) {
  const [a, b] = [lage.get(kette[0]), lage.get(kette.at(-1))];
  // Fahrweg der Kette, verzerrt, als Stichproben
  const proben = [];
  for (let i = 1; i < kette.length; i++) {
    const k = kanteZwischen.get(`${kette[i - 1]}>${kette[i]}`);
    const c = k.coords;
    for (let j = 0; j < c.length; j += Math.max(1, Math.floor(c.length / 6))) proben.push(verzerren(km(c[j])));
  }
  for (const h of kette.slice(1, -1)) proben.push(P.get(h));
  const varianten = zuege(a, b);
  const paar = [kette[0], kette.at(-1)].sort().join('|');
  let wahl = varianten
    .map((zug, i) => ({ zug, i, kosten: proben.reduce((s, p) => s + abstand(p, zug), 0) }))
    .sort((x, y) => x.kosten - y.kosten);
  if (genutzt.has(paar) && wahl.length > 1 && wahl[0].i === genutzt.get(paar)) wahl = [wahl[1]];
  const { zug, i } = wahl[0];
  genutzt.set(paar, i);
  if (zug.length > 2) knicke++;
  // Zwischenhalte gleichmässig
  const L = laenge(zug);
  const n = kette.length - 1;
  kette.forEach((h, j) => {
    if (j > 0 && j < n) lage.set(h, punktBei(zug, (L * j) / n).p);
  });
  for (let j = 1; j <= n; j++) {
    const k = kanteZwischen.get(`${kette[j - 1]}>${kette[j]}`);
    let weg = teil(zug, (L * (j - 1)) / n, (L * j) / n);
    if (kette[j - 1] !== k.a) weg = weg.reverse();
    busWege.set(k.id, weg);
  }
}

// ---------- Ausgabe ----------
const aus = (p) => [Math.round(p[0] * EINHEIT * 10) / 10, Math.round(-p[1] * EINHEIT * 10) / 10];
for (const h of netz.haltestellen) if (h.nurBus && lage.has(h.id)) layout.haltestellen[h.id] = aus(lage.get(h.id));
for (const k of netz.kanten) {
  if (!k.bus) continue;
  if (ueber.has(k.id)) {
    // dem Tramstrich folgen, samt seinen Knicken
    const pfad = ueber.get(k.id);
    const weg = [];
    for (let i = 1; i < pfad.length; i++) {
      const [x, y] = [pfad[i - 1], pfad[i]];
      const vor = layout.kanten[`${x}~${y}`], rueck = layout.kanten[`${y}~${x}`];
      const stueck = vor ?? [...rueck].reverse();
      weg.push(...(weg.length ? stueck.slice(1) : stueck));
    }
    layout.kanten[k.id] = weg;
  }
  else layout.kanten[k.id] = busWege.get(k.id).map(aus);
}
layout.quelle = layout.quelle.replace(/; Busse.*$/, '') + '; Busse: scripts/plan/layout-bus.mjs';
await writeFile(LAYOUT, JSON.stringify(layout));
const ohne = netz.haltestellen.filter((h) => h.nurBus && !lage.has(h.id));
console.log(
  `Busse: ${busKanten.length + ueber.size} Abschnitte (${ueber.size} auf Tramabschnitten), ${alle.length} Züge (${knicke} mit Knick), ` +
    `${netz.haltestellen.filter((h) => h.nurBus).length - ohne.length} Bushaltestellen` +
    (ohne.length ? `; ohne Lage: ${ohne.map((h) => h.name).join(', ')}` : ''),
);
