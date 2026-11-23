// Berechnet einen oktilinearen Liniennetzplan (Verfahren nach Nöllenburg & Wolff, «Drawing and Labeling
// High-Quality Metro Maps by Mixed-Integer Programming», 2011) mit dem Solver HiGHS.
//
//   node scripts/plan/layout.mjs
//
// Eingabe:  public/data/netz.json (alle Haltestellen und Abschnitte aller Jahre)
//           data/plan.json        (Lage im ZVV-Plan als Ausgangslage; fehlt sie, gilt die Geografie)
// Ausgabe:  data/layout.json      (gleiches Format wie plan.json, y nach unten)
//
// Harte Bedingungen
//   H1  jeder Abschnitt waagrecht, senkrecht oder diagonal (8 Richtungen)
//   H2  Reihenfolge der Abschnitte um jede Haltestelle bleibt wie in der Ausgangslage
//   H3  Mindestlänge: eine Einheit pro Haltestellenabstand
//   H4  nicht benachbarte Abschnitte halten Abstand (nur dort, wo eine Lösung sie verletzt hat; iterativ)
// Ziele
//   S1  wenige und flache Knicke entlang der Linien
//   S2  Richtung möglichst wie in der Ausgangslage
//   S3  kurze Abschnitte (schwach)
//   S4  Lage nahe an der Vorlage (der Plan wird begradigt, nicht neu verteilt)
//
// Ketten von Haltestellen mit genau zwei Nachbarn werden zu geraden Stücken zusammengefasst
// (an markanten Knicken der Ausgangslage geteilt); die Zwischenhalte liegen gleichmässig darauf.

import { readFile, writeFile } from 'node:fs/promises';
import highsLaden from 'highs';

const root = new URL('../../', import.meta.url);
const netz = JSON.parse(await readFile(new URL('public/data/netz.json', root), 'utf8'));
// Nur das Tramnetz: Busse haben (noch) keine Planlage
netz.haltestellen = netz.haltestellen.filter((h) => !h.nurBus);
netz.kanten = netz.kanten.filter((k) => !k.bus);
netz.versionen = netz.versionen.filter((v) => !v.linie.startsWith('bus-'));
let vorlage = null;
try {
  vorlage = JSON.parse(await readFile(new URL('data/plan.json', root), 'utf8'));
} catch {}

const GEWICHT = { knick: Number(process.env.KNICK ?? 3), richtung: 2, lage: 1, laenge: 0.1 };
const STRECKUNG = Number(process.env.STRECKUNG ?? 0.6); // Anteil der Vorlagelänge als Mindestlänge
const ABSTAND = 0.75; // H4: Mindestabstand nicht benachbarter Stücke (in Einheiten)
let M = 2000; // big-M (wird unten aus der Ausdehnung bestimmt)
let SPANNE = 1000;
const ZEITLIMIT = Number(process.env.ZEITLIMIT ?? 120); // Sekunden je Lauf

// ---------- Ausgangslage (y nach oben) ----------
const H = new Map(netz.haltestellen.map((h) => [h.id, h]));
const geo = (h) => [h.lon * Math.cos((47.37 * Math.PI) / 180), h.lat];
const P = new Map();
{
  // fehlende Lagen aus der Geografie per Ähnlichkeitstransformation ergänzen
  const paare = [];
  for (const h of netz.haltestellen) {
    const p = vorlage?.haltestellen[h.id];
    if (p) {
      P.set(h.id, [p[0], -p[1]]);
      if (!vorlage.herkunft?.haltestellen?.[h.id]) paare.push([geo(h), [p[0], -p[1]]]);
    }
  }
  if (paare.length < 3) for (const h of netz.haltestellen) P.set(h.id, geo(h).map((v) => v * 10000));
  else {
    const n = paare.length;
    const mz = paare.reduce((s, [z]) => [s[0] + z[0] / n, s[1] + z[1] / n], [0, 0]);
    const mw = paare.reduce((s, [, w]) => [s[0] + w[0] / n, s[1] + w[1] / n], [0, 0]);
    let re = 0, im = 0, nn = 0;
    for (const [z, w] of paare) {
      const dz = [z[0] - mz[0], z[1] - mz[1]], dw = [w[0] - mw[0], w[1] - mw[1]];
      re += dw[0] * dz[0] + dw[1] * dz[1];
      im += dw[1] * dz[0] - dw[0] * dz[1];
      nn += dz[0] ** 2 + dz[1] ** 2;
    }
    const a = [re / nn, im / nn];
    for (const h of netz.haltestellen) {
      if (P.has(h.id)) continue;
      const z = [geo(h)[0] - mz[0], geo(h)[1] - mz[1]];
      P.set(h.id, [a[0] * z[0] - a[1] * z[1] + mw[0], a[0] * z[1] + a[1] * z[0] + mw[1]]);
    }
  }
}

// ---------- Abschnitte, die eine Folge anderer Abschnitte abkürzen ----------
// (z.B. A~C aus der Zeit, bevor die Haltestelle B dazwischen eröffnet wurde): verlaufen sie auf
// denselben Gleisen, werden sie im Plan über diese Folge gezeichnet und nicht eigens platziert.
const meter = ([lon, lat]) => [lon * 111320 * Math.cos((47.37 * Math.PI) / 180), lat * 110574];
const laengeM = (c) => c.reduce((s, p, i) => (i ? s + Math.hypot(...meter(p).map((v, k) => v - meter(c[i - 1])[k])) : 0), 0);
const adj = new Map();
for (const k of netz.kanten) {
  for (const [x, y] of [[k.a, k.b], [k.b, k.a]]) {
    if (!adj.has(x)) adj.set(x, []);
    adj.get(x).push({ nach: y, kante: k });
  }
}
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
const ueber = new Map(); // Kante -> Haltestellenfolge, über die sie gezeichnet wird
for (const k of netz.kanten) {
  // kürzester anderer Weg (höchstens 4 Abschnitte)
  const L = laengeM(k.coords);
  let best = null;
  const suche = (pfad, coords, laenge) => {
    const v = pfad.at(-1);
    if (laenge > 1.3 * L + 50) return;
    if (v === k.b && pfad.length > 2) {
      if (!best || laenge < best.laenge) best = { pfad: [...pfad], coords: [...coords], laenge };
      return;
    }
    if (pfad.length > 5) return;
    for (const { nach, kante } of adj.get(v) ?? []) {
      if (kante === k || pfad.includes(nach)) continue;
      const c = kante.a === v ? kante.coords : [...kante.coords].reverse();
      suche([...pfad, nach], [...coords, ...c], laenge + laengeM(kante.coords));
    }
  };
  suche([k.a], [], 0);
  if (best && k.coords.every((p) => abstandZuLinie(p, best.coords) < 40)) ueber.set(k.id, best.pfad);
}
const kanten = netz.kanten.filter((k) => !ueber.has(k.id));

// ---------- Ketten zu geraden Stücken zusammenfassen ----------
const nachbarn = new Map();
for (const k of kanten) {
  for (const [x, y] of [[k.a, k.b], [k.b, k.a]]) {
    if (!nachbarn.has(x)) nachbarn.set(x, new Set());
    nachbarn.get(x).add(y);
  }
}
const fest = new Set();
for (const [v, n] of nachbarn) if (n.size !== 2) fest.add(v);
for (const v of netz.versionen) {
  fest.add(v.haltestellen[0]);
  fest.add(v.haltestellen.at(-1));
}

function ketten() {
  const besucht = new Set();
  const out = [];
  const key = (a, b) => (a < b ? `${a}~${b}` : `${b}~${a}`);
  for (const s of fest) {
    for (const n of nachbarn.get(s) ?? []) {
      if (besucht.has(key(s, n))) continue;
      const kette = [s];
      let vor = s, akt = n;
      besucht.add(key(s, n));
      while (!fest.has(akt)) {
        kette.push(akt);
        const weiter = [...nachbarn.get(akt)].find((x) => x !== vor);
        besucht.add(key(akt, weiter));
        vor = akt;
        akt = weiter;
      }
      kette.push(akt);
      out.push(kette);
    }
  }
  // reine Ringe ohne feste Haltestelle
  for (const [v] of nachbarn) {
    if (fest.has(v) || [...nachbarn.get(v)].every((n) => besucht.has(key(v, n)))) continue;
    fest.add(v);
    return ketten();
  }
  return out;
}

// Douglas-Peucker auf der Ausgangslage: markante Knicke bleiben feste Punkte
function knicke(kette, tol) {
  if (kette.length < 3) return [];
  const a = P.get(kette[0]), b = P.get(kette.at(-1));
  let imax = -1, dmax = 0;
  for (let i = 1; i < kette.length - 1; i++) {
    const p = P.get(kette[i]);
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    const d = Math.abs((p[0] - a[0]) * dy - (p[1] - a[1]) * dx) / l;
    if (d > dmax) [imax, dmax] = [i, d];
  }
  if (dmax <= tol) return [];
  return [...knicke(kette.slice(0, imax + 1), tol), kette[imax], ...knicke(kette.slice(imax), tol).map((x) => x)];
}
const typAbstand = (() => {
  const d = kanten.map((k) => Math.hypot(P.get(k.a)[0] - P.get(k.b)[0], P.get(k.a)[1] - P.get(k.b)[1])).sort((a, b) => a - b);
  return d[Math.floor(d.length / 2)];
})();
const MAXSTUECK = 6;
let stuecke = [];
function stueckeBilden() {
  stuecke = [];
  for (const kette of ketten()) {
    for (const k of knicke(kette, typAbstand * 0.6)) fest.add(k);
  }
  for (const kette of ketten()) {
    // lange Ketten teilen
    if (kette.length - 1 > MAXSTUECK) {
      const teile = Math.ceil((kette.length - 1) / MAXSTUECK);
      for (let t = 1; t < teile; t++) fest.add(kette[Math.round((t * (kette.length - 1)) / teile)]);
    }
  }
  const alle = ketten();
  // gleiche Endpunkte bei zwei Stücken (z.B. Schleifen): längeres in der Mitte teilen
  const paar = new Map();
  for (const k of alle) {
    const key = [k[0], k.at(-1)].sort().join('~');
    if (paar.has(key)) {
      const lang = k.length >= paar.get(key).length ? k : paar.get(key);
      if (lang.length < 3) throw new Error(`Doppelte Verbindung ohne Zwischenhalt: ${key}`);
      fest.add(lang[Math.floor(lang.length / 2)]);
      return stueckeBilden();
    }
    paar.set(key, k);
  }
  stuecke = alle.map((k, i) => ({ id: i, u: k[0], v: k.at(-1), halte: k, l: k.length - 1 }));
}
stueckeBilden();
const knoten = [...fest].filter((v) => nachbarn.has(v));
{
  const xs = knoten.map((v) => P.get(v)[0]), ys = knoten.map((v) => P.get(v)[1]);
  SPANNE = Math.ceil((1.6 * Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys))) / typAbstand) + 10;
  M = 4 * SPANNE + 10;
}
console.log(`${netz.kanten.length} Abschnitte (${ueber.size} über andere gezeichnet), ${knoten.length} Knoten, ${stuecke.length} Stücke, Spanne ${SPANNE}`);

// ---------- Modell ----------
const RICHT = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
const sektor = (d) => ((Math.round(Math.atan2(d[1], d[0]) / (Math.PI / 4)) % 8) + 8) % 8;
const vn = (v) => `n${knoten.indexOf(v)}`;
// Richtungskandidaten: eindeutige Stücke (nahe an einer der 8 Richtungen) behalten ihre Richtung,
// unklare bekommen die beiden nächsten, Stücke mit gleicher Richtung am selben Knoten alle drei.
for (const s of stuecke) {
  const a = P.get(s.u), b = P.get(s.v);
  const w = Math.atan2(b[1] - a[1], b[0] - a[0]) / (Math.PI / 4);
  s.sek = ((Math.round(w) % 8) + 8) % 8;
  const abw = w - Math.round(w); // in Achteln (-0.5 … 0.5)
  s.kand = Math.abs(abw) < 0.27 ? [s.sek] : [s.sek, (s.sek + (abw > 0 ? 1 : 7)) % 8];
  // Mindestlänge: eine Einheit pro Haltestellenabstand, wo die Vorlage mehr Platz lässt (Innenstadt) entsprechend mehr
  const geschaetzt = s.halte.some((h) => vorlage?.herkunft?.haltestellen?.[h]);
  const vorlageLaenge = Math.hypot(b[0] - a[0], b[1] - a[1]) / typAbstand;
  s.min = geschaetzt ? s.l : Math.max(s.l, Math.round(STRECKUNG * vorlageLaenge * 2) / 2);
}
for (const v of knoten) {
  const inz = stuecke.filter((s) => s.u === v || s.v === v);
  const r = inz.map((s) => (s.u === v ? s.sek : (s.sek + 4) % 8));
  inz.forEach((s, i) => {
    if (r.filter((x) => x === r[i]).length > 1) s.kand = [(s.sek + 7) % 8, s.sek, (s.sek + 1) % 8];
  });
}
console.log(`Richtungen: ${stuecke.filter((s) => s.kand.length === 1).length} fest, ${stuecke.filter((s) => s.kand.length > 1).length} frei`);
// ausgehende Richtung eines Stücks an einem Knoten als Term
const raus = (s, v) => s.kand.map((i) => [s.u === v ? i : (i + 4) % 8, `a${s.id}_${i}`]);

// Knicke: aufeinanderfolgende Stücke entlang der Linienwege
const stueckZwischen = new Map();
for (const s of stuecke) {
  for (let i = 1; i < s.halte.length; i++) {
    stueckZwischen.set(`${s.halte[i - 1]}>${s.halte[i]}`, { s, vor: true });
    stueckZwischen.set(`${s.halte[i]}>${s.halte[i - 1]}`, { s, vor: false });
  }
}
const knickPaare = new Map();
for (const ver of netz.versionen) {
  const folge = [];
  for (let i = 1; i < ver.haltestellen.length; i++) {
    const a = ver.haltestellen[i - 1], b = ver.haltestellen[i];
    const k = netz.kanten.find((x) => (x.a === a && x.b === b) || (x.a === b && x.b === a));
    const pfad = k && ueber.has(k.id) ? (ueber.get(k.id)[0] === a ? ueber.get(k.id) : [...ueber.get(k.id)].reverse()) : [a, b];
    for (let j = 1; j < pfad.length; j++) {
      const t = stueckZwischen.get(`${pfad[j - 1]}>${pfad[j]}`);
      if (t && folge.at(-1)?.s !== t.s) folge.push(t);
    }
  }
  for (let i = 1; i < folge.length; i++) {
    const e1 = folge[i - 1], e2 = folge[i];
    const v = e1.vor ? e1.s.v : e1.s.u;
    const key = [e1.s.id, e2.s.id].sort().join('-');
    if (!knickPaare.has(key)) knickPaare.set(key, { e1: e1.s, e2: e2.s, v });
  }
}

function modell(trennen) {
  const z = [], nb = [], bin = [], frei = [];
  const ziel = [];
  for (const v of knoten) {
    const n = vn(v);
    frei.push(`${n}x`, `${n}y`, `${n}p`, `${n}q`);
    nb.push(` ${n}p - ${n}x - ${n}y = 0`, ` ${n}q - ${n}x + ${n}y = 0`);
  }
  // S4 Lage: nahe an der Vorlage bleiben (in Einheiten, Knoten 0 im Ursprung)
  const o = P.get(knoten[0]);
  for (const v of knoten) {
    const n = vn(v);
    const [x0, y0] = [(P.get(v)[0] - o[0]) / typAbstand, (P.get(v)[1] - o[1]) / typAbstand].map((c) => Math.round(c * 1000) / 1000);
    nb.push(` ${n}X - ${n}x >= ${-x0}`, ` ${n}X + ${n}x >= ${x0}`, ` ${n}Y - ${n}y >= ${-y0}`, ` ${n}Y + ${n}y >= ${y0}`);
    ziel.push(`${GEWICHT.lage} ${n}X`, `${GEWICHT.lage} ${n}Y`);
  }
  for (const s of stuecke) {
    const u = vn(s.u), w = vn(s.v);
    nb.push(` ${s.kand.map((i) => `a${s.id}_${i}`).join(' + ')} = 1`);
    for (const i of s.kand) {
      const a = `a${s.id}_${i}`;
      bin.push(a);
      // Achse gleich (Koordinate c), Abstand in Richtung (Koordinate d, Vorzeichen sg)
      const [c, d, sg, f] = [
        ['y', 'x', 1, 1], ['q', 'p', 1, 2], ['x', 'y', 1, 1], ['p', 'q', -1, 2],
        ['y', 'x', -1, 1], ['q', 'p', -1, 2], ['x', 'y', -1, 1], ['p', 'q', 1, 2],
      ][i];
      nb.push(` ${w}${c} - ${u}${c} + ${M} ${a} <= ${M}`, ` ${w}${c} - ${u}${c} - ${M} ${a} >= -${M}`);
      nb.push(` ${sg > 0 ? `${w}${d} - ${u}${d}` : `${u}${d} - ${w}${d}`} - ${M} ${a} >= ${f * s.min - M}`);
    }
    // S2 Richtung, S3 Länge
    ziel.push(`${GEWICHT.richtung} r${s.id}`);
    nb.push(` r${s.id} + a${s.id}_${s.sek} = 1`);
    nb.push(` L${s.id} - ${u}x + ${w}x >= 0`, ` L${s.id} + ${u}x - ${w}x >= 0`);
    nb.push(` K${s.id} - ${u}y + ${w}y >= 0`, ` K${s.id} + ${u}y - ${w}y >= 0`);
    ziel.push(`${GEWICHT.laenge / s.l} L${s.id}`, `${GEWICHT.laenge / s.l} K${s.id}`);
  }
  // H2 Reihenfolge um jeden Knoten
  for (const v of knoten) {
    const inz = stuecke.filter((s) => s.u === v || s.v === v);
    if (inz.length < 2) continue;
    const p = P.get(v);
    const winkel = (s) => {
      const o = P.get(s.u === v ? (s.halte[1]) : s.halte.at(-2));
      return Math.atan2(o[1] - p[1], o[0] - p[0]);
    };
    // Schleifen (u = v) kommen nicht vor; Stücke nach Winkel sortieren
    const sortiert = inz.sort((a, b) => winkel(a) - winkel(b));
    const n = vn(v);
    sortiert.forEach((s, i) => {
      const t = sortiert[(i + 1) % sortiert.length];
      const b = `b${n}_${i}`;
      bin.push(b);
      const dt = raus(t, v).map(([d, a]) => `${d} ${a}`).join(' + ');
      const ds = raus(s, v).map(([d, a]) => `${d} ${a}`).join(' - ');
      nb.push(` ${dt} - ${ds} + 8 ${b} >= 1`);
    });
    nb.push(` ${sortiert.map((_, i) => `b${n}_${i}`).join(' + ')} = 1`);
  }
  // S1 Knicke
  let kn = 0;
  for (const { e1, e2, v } of knickPaare.values()) {
    const id = `k${kn++}`;
    ziel.push(`${GEWICHT.knick} ${id}`);
    for (const [d1, a1] of raus(e1, v)) {
      for (const [d2, a2] of raus(e2, v)) {
        // e1 kommt an (Gegenrichtung von raus), e2 geht weg
        const ein = (d1 + 4) % 8;
        const diff = Math.min(Math.abs(ein - d2), 8 - Math.abs(ein - d2));
        if (diff) nb.push(` ${id} - ${diff} ${a1} - ${diff} ${a2} >= -${diff}`);
      }
    }
  }
  // H4 Abstand für bekannte Konflikte
  let tn = 0;
  for (const [s, t] of trennen) {
    const g = [];
    for (let i = 0; i < 8; i++) {
      const id = `g${tn}_${i}`;
      g.push(id);
      bin.push(id);
      // t liegt in Richtung i von s
      const [d, sg, f] = [['x', 1, 1], ['p', 1, 1.4], ['y', 1, 1], ['q', -1, 1.4], ['x', -1, 1], ['p', -1, 1.4], ['y', -1, 1], ['q', 1, 1.4]][i];
      for (const a of [s.u, s.v]) {
        for (const b of [t.u, t.v]) {
          const lhs = sg > 0 ? `${vn(b)}${d} - ${vn(a)}${d}` : `${vn(a)}${d} - ${vn(b)}${d}`;
          nb.push(` ${lhs} - ${M} ${id} >= ${(ABSTAND * f - M).toFixed(3)}`);
        }
      }
    }
    nb.push(` ${g.join(' + ')} >= 1`);
    tn++;
  }
  const zeilen = (arr) => arr.map((c, i) => ` c${i}:${c}`);
  return [
    'Minimize',
    ` obj: ${ziel.join(' + ')}`,
    'Subject To',
    ...zeilen(nb),
    'Bounds',
    ...frei.map((v) => (/[xy]$/.test(v) ? ` -${SPANNE} <= ${v} <= ${SPANNE}` : ` -${2 * SPANNE} <= ${v} <= ${2 * SPANNE}`)),
    'Binary',
    ...bin.map((b) => ` ${b}`),
    'End',
    '',
  ].join('\n');
}

// ---------- Lösen, Konflikte suchen, nachrechnen ----------
const highs = await highsLaden();
function seg(s, pos) {
  return [pos.get(s.u), pos.get(s.v)];
}
function abstandSeg([a, b], [c, d]) {
  const kreuzt = (p, q, r, s) => {
    const o = (a, b, c) => Math.sign((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
    return o(p, q, r) * o(p, q, s) < 0 && o(r, s, p) * o(r, s, q) < 0;
  };
  if (kreuzt(a, b, c, d)) return 0;
  const pd = (p, a, b) => {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0;
    return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
  };
  return Math.min(pd(a, c, d), pd(b, c, d), pd(c, a, b), pd(d, a, b));
}

// nahe beieinander liegende Stücke von Anfang an trennen (spart Runden)
const trennen = [];
for (let i = 0; i < stuecke.length; i++) {
  for (let j = i + 1; j < stuecke.length; j++) {
    const s = stuecke[i], t = stuecke[j];
    if ([s.u, s.v].some((x) => x === t.u || x === t.v)) continue;
    if (abstandSeg(seg(s, P), seg(t, P)) < 1.5 * typAbstand) trennen.push([s, t]);
  }
}
console.log(`${trennen.length} Paare von Anfang an getrennt`);
let pos = null;
for (let runde = 1; runde <= 12; runde++) {
  const t0 = Date.now();
  const lp = modell(trennen);
  const r = highs.solve(lp, { time_limit: ZEITLIMIT, mip_rel_gap: Number(process.env.LUECKE ?? 0.03), output_flag: false });
  if (!r.Columns || !['Optimal', 'Time limit reached'].includes(r.Status) || !Number.isFinite(r.ObjectiveValue))
    throw new Error(`Solver: ${r.Status} (keine zulässige Lösung in ${ZEITLIMIT} s; ZEITLIMIT erhöhen)`);
  pos = new Map(knoten.map((v) => [v, [r.Columns[`${vn(v)}x`].Primal, r.Columns[`${vn(v)}y`].Primal]]));
  const neu = [];
  for (let i = 0; i < stuecke.length; i++) {
    for (let j = i + 1; j < stuecke.length; j++) {
      const s = stuecke[i], t = stuecke[j];
      if ([s.u, s.v].some((x) => x === t.u || x === t.v)) continue;
      if (trennen.some(([a, b]) => (a === s && b === t) || (a === t && b === s))) continue;
      if (abstandSeg(seg(s, pos), seg(t, pos)) < ABSTAND - 1e-6) neu.push([s, t]);
    }
  }
  console.log(`Runde ${runde}: ${r.Status}, Ziel ${r.ObjectiveValue.toFixed(1)}, ${((Date.now() - t0) / 1000).toFixed(1)} s, ${neu.length} neue Konflikte`);
  if (!neu.length) break;
  trennen.push(...neu);
}

// ---------- Ausgabe ----------
const lage = new Map(pos);
for (const s of stuecke) {
  const [a, b] = [pos.get(s.u), pos.get(s.v)];
  s.halte.forEach((h, i) => {
    if (i > 0 && i < s.halte.length - 1) lage.set(h, [a[0] + ((b[0] - a[0]) * i) / s.l, a[1] + ((b[1] - a[1]) * i) / s.l]);
  });
}
// Haltestellen ohne Abschnitt (sollte nicht vorkommen) an ihrer Ausgangslage
const EINHEIT = 12; // Planpunkte pro Haltestellenabstand
const aus = (p) => [Math.round(p[0] * EINHEIT * 10) / 10, Math.round(-p[1] * EINHEIT * 10) / 10];
const halteAus = {};
for (const h of netz.haltestellen) if (lage.has(h.id)) halteAus[h.id] = aus(lage.get(h.id));
const kantenAus = {};
for (const k of netz.kanten) {
  const pfad = ueber.get(k.id) ?? [k.a, k.b];
  const p = pfad[0] === k.a ? pfad : [...pfad].reverse();
  kantenAus[k.id] = p.map((h) => aus(lage.get(h)));
}
const xs = Object.values(halteAus).map((p) => p[0]), ys = Object.values(halteAus).map((p) => p[1]);
const minX = Math.min(...xs), minY = Math.min(...ys);
const verschieben = (p) => [Math.round((p[0] - minX + 20) * 10) / 10, Math.round((p[1] - minY + 20) * 10) / 10];
for (const k in halteAus) halteAus[k] = verschieben(halteAus[k]);
for (const k in kantenAus) kantenAus[k] = kantenAus[k].map(verschieben);
await writeFile(
  new URL(process.env.AUSGABE ?? 'data/layout.json', root),
  JSON.stringify({
    quelle: 'Eigenes oktilineares Layout (scripts/plan/layout.mjs), Ausgangslage ZVV-Liniennetzplan',
    groesse: [Math.max(...xs) - minX + 40, Math.max(...ys) - minY + 40],
    haltestellen: halteAus,
    kanten: kantenAus,
    herkunft: { haltestellen: {}, kanten: {} },
  }),
);
console.log(`data/layout.json: ${Object.keys(halteAus).length} Haltestellen, ${Object.keys(kantenAus).length} Abschnitte`);
