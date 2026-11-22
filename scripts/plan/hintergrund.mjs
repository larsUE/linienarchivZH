// Hintergrund für den Liniennetzplan: Zürichsee, Limmat, Sihl, Wald und Stadtgrenze als vereinfachte Flächen.
//
//   node scripts/plan/hintergrund.mjs
//
// Daten: OpenStreetMap (ODbL) über die Overpass-API, zwischengespeichert in data/raw/osm/.
// Die Formen werden geografisch vereinfacht und geglättet und dann mit einer Thin-Plate-Spline durch die
// Haltestellen (geografische Lage -> Planlage) in den Plan verzerrt. Jeder Punkt hat damit eine Lage in
// beiden Ansichten (gleiche Punktzahl), die Karte blendet sie wie die Linien über.
//
// Eingabe: public/data/netz.json (nach scripts/build-data.mjs)
// Ausgabe: public/data/hintergrund.json

import { mkdir, readFile, writeFile } from 'node:fs/promises';

const root = new URL('../../', import.meta.url);
const netz = JSON.parse(await readFile(new URL('public/data/netz.json', root), 'utf8'));
// Nur das Tramnetz: Busse haben (noch) keine Planlage
netz.haltestellen = netz.haltestellen.filter((h) => !h.nurBus);
netz.kanten = netz.kanten.filter((k) => !k.bus);
netz.versionen = netz.versionen.filter((v) => !v.linie.startsWith('bus-'));

// ---------- OSM laden ----------
const BBOX = [47.315, 8.3, 47.47, 8.63]; // s, w, n, o
const ABFRAGE = `[out:json][timeout:180];
(
  relation["natural"="water"]["name"="Zürichsee"];
  way["waterway"="river"]["name"~"^(Limmat|Sihl)$"](${BBOX});
  relation["boundary"="administrative"]["admin_level"="8"]["name"="Zürich"];
  way["landuse"="forest"](${BBOX});
  way["natural"="wood"](${BBOX});
  relation["landuse"="forest"](${BBOX});
  relation["natural"="wood"](${BBOX});
);
out geom qt;`;
const cache = new URL('data/raw/osm/hintergrund.json', root);
let osm;
try {
  osm = JSON.parse(await readFile(cache, 'utf8'));
} catch {
  // öffentliche Server sind oft ausgelastet: abwechselnd und mit wachsender Wartezeit versuchen
  const SERVER = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
  for (let versuch = 0; !osm; versuch++) {
    const url = SERVER[versuch % SERVER.length];
    console.log(`Lade OSM-Daten über ${new URL(url).host} …`);
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'linienarchiv-build' },
      body: new URLSearchParams({ data: ABFRAGE }),
    }).catch((e) => ({ ok: false, status: e.message, text: async () => '' }));
    if (r.ok) osm = await r.json();
    else if (versuch >= 7) throw new Error(`Overpass: ${r.status}`);
    else await new Promise((f) => setTimeout(f, 5000 * 2 ** Math.floor(versuch / 2)));
  }
  await mkdir(new URL('data/raw/osm/', root), { recursive: true });
  await writeFile(cache, JSON.stringify(osm));
  await writeFile(new URL('data/raw/osm/.gitignore', root), '*\n');
}

// ---------- Geometrie in km (winkeltreu um Zürich) ----------
const KOS = Math.cos((47.37 * Math.PI) / 180);
const zuKm = ([lon, lat]) => [lon * KOS * 111.32, lat * 110.574];
const ausKm = ([x, y]) => [x / (KOS * 111.32), y / 110.574];
const pt = (g) => zuKm([g.lon, g.lat]);

function flaeche(r) {
  let a = 0;
  for (let i = 0; i < r.length; i++) {
    const [x1, y1] = r[i], [x2, y2] = r[(i + 1) % r.length];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
}
// Douglas-Peucker
function vereinfachen(p, tol, ring = false) {
  if (ring) {
    // an zwei weit auseinanderliegenden Punkten aufteilen
    let j = 0, d = 0;
    for (let i = 1; i < p.length; i++) {
      const di = Math.hypot(p[i][0] - p[0][0], p[i][1] - p[0][1]);
      if (di > d) [j, d] = [i, di];
    }
    const a = vereinfachen(p.slice(0, j + 1), tol), b = vereinfachen([...p.slice(j), p[0]], tol);
    return [...a.slice(0, -1), ...b.slice(0, -1)];
  }
  if (p.length < 3) return p;
  const [a, b] = [p[0], p.at(-1)];
  const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy);
  let imax = 0, dmax = 0;
  for (let i = 1; i < p.length - 1; i++) {
    const d = l ? Math.abs((p[i][0] - a[0]) * dy - (p[i][1] - a[1]) * dx) / l : Math.hypot(p[i][0] - a[0], p[i][1] - a[1]);
    if (d > dmax) [imax, dmax] = [i, d];
  }
  if (dmax <= tol) return [a, b];
  return [...vereinfachen(p.slice(0, imax + 1), tol).slice(0, -1), ...vereinfachen(p.slice(imax), tol)];
}
// Chaikin: Ecken abrunden (gleiche Punktzahl bei gleicher Eingabelänge, daher für Karte und Plan gleich anwendbar)
function glaetten(p, ring, runden = 2) {
  for (let r = 0; r < runden; r++) {
    const q = [];
    const n = p.length;
    if (!ring) q.push(p[0]);
    for (let i = 0; i < (ring ? n : n - 1); i++) {
      const a = p[i], b = p[(i + 1) % n];
      q.push([0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]], [0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]]);
    }
    if (!ring) q.push(p.at(-1));
    p = q;
  }
  return p;
}
// Ring an einem Rechteck zuschneiden (Sutherland-Hodgman)
function zuschneiden(ring, [x0, y0, x1, y1]) {
  const kanten = [
    [(p) => p[0] >= x0, (a, b) => [x0, a[1] + ((b[1] - a[1]) * (x0 - a[0])) / (b[0] - a[0])]],
    [(p) => p[0] <= x1, (a, b) => [x1, a[1] + ((b[1] - a[1]) * (x1 - a[0])) / (b[0] - a[0])]],
    [(p) => p[1] >= y0, (a, b) => [a[0] + ((b[0] - a[0]) * (y0 - a[1])) / (b[1] - a[1]), y0]],
    [(p) => p[1] <= y1, (a, b) => [a[0] + ((b[0] - a[0]) * (y1 - a[1])) / (b[1] - a[1]), y1]],
  ];
  let out = ring;
  for (const [innen, schnitt] of kanten) {
    const ein = out;
    out = [];
    for (let i = 0; i < ein.length; i++) {
      const a = ein[(i + ein.length - 1) % ein.length], b = ein[i];
      if (innen(b)) {
        if (!innen(a)) out.push(schnitt(a, b));
        out.push(b);
      } else if (innen(a)) out.push(schnitt(a, b));
    }
    if (!out.length) break;
  }
  return out;
}
// Wege zu Ringen bzw. Linienzügen zusammenhängen
function zusammenhaengen(wege) {
  const offen = wege.map((w) => [...w]);
  const fertig = [];
  const gleich = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-6;
  while (offen.length) {
    let z = offen.shift();
    let weiter = true;
    while (weiter) {
      weiter = false;
      for (let i = 0; i < offen.length; i++) {
        const w = offen[i];
        if (gleich(z.at(-1), w[0])) z = [...z, ...w.slice(1)];
        else if (gleich(z.at(-1), w.at(-1))) z = [...z, ...[...w].reverse().slice(1)];
        else if (gleich(z[0], w.at(-1))) z = [...w, ...z.slice(1)];
        else if (gleich(z[0], w[0])) z = [...[...w].reverse(), ...z.slice(1)];
        else continue;
        offen.splice(i, 1);
        weiter = true;
        break;
      }
    }
    fertig.push(z);
  }
  return fertig;
}
const aussenringe = (rel) =>
  zusammenhaengen(rel.members.filter((m) => m.type === 'way' && m.role !== 'inner' && m.geometry).map((m) => m.geometry.map(pt)));

// ---------- Ausschnitt: Netz plus Rand ----------
const halteKm = netz.haltestellen.map((h) => zuKm([h.lon, h.lat]));
const RAND = 1.5;
const rahmen = [
  Math.min(...halteKm.map((p) => p[0])) - RAND,
  Math.min(...halteKm.map((p) => p[1])) - RAND,
  Math.max(...halteKm.map((p) => p[0])) + RAND,
  Math.max(...halteKm.map((p) => p[1])) + RAND,
];
const drin = ([x, y]) => x >= rahmen[0] && x <= rahmen[2] && y >= rahmen[1] && y <= rahmen[3];

// ---------- Formen sammeln (geografisch, km) ----------
const formen = []; // { art, ring: bool, p: [[x,y]] }
for (const e of osm.elements) {
  const t = e.tags ?? {};
  if (e.type === 'relation' && t.name === 'Zürichsee') {
    for (const r of aussenringe(e)) {
      const c = zuschneiden(vereinfachen(r, 0.04, true), rahmen);
      if (c.length > 2) formen.push({ art: 'see', ring: true, p: c });
    }
  } else if (e.type === 'relation' && t.boundary === 'administrative') {
    for (const r of aussenringe(e)) if (flaeche(r) > 10) formen.push({ art: 'stadt', ring: true, p: vereinfachen(r, 0.08, true) });
  } else if (t.landuse === 'forest' || t.natural === 'wood') {
    const ringe = e.type === 'way' ? [e.geometry.map(pt)] : e.type === 'relation' ? aussenringe(e) : [];
    for (const r of ringe) {
      if (r.length < 4 || flaeche(r) < 0.12) continue;
      const c = zuschneiden(vereinfachen(r, 0.05, true), rahmen);
      if (c.length > 2 && flaeche(c) > 0.08) formen.push({ art: 'wald', ring: true, p: c });
    }
  }
}
// Flüsse: Wege je Name zusammenhängen, auf den Ausschnitt beschränken
for (const name of ['Limmat', 'Sihl']) {
  const wege = osm.elements.filter((e) => e.type === 'way' && e.tags?.waterway === 'river' && e.tags.name === name).map((e) => e.geometry.map(pt));
  for (const z of zusammenhaengen(wege)) {
    // längste zusammenhängende Teilstücke im Ausschnitt
    let teil = [];
    for (const p of [...z, null]) {
      if (p && drin(p)) teil.push(p);
      else {
        if (teil.length > 5) formen.push({ art: 'fluss', name, ring: false, p: vereinfachen(teil, 0.05) });
        teil = [];
      }
    }
  }
}

// ---------- Thin-Plate-Spline: geografisch -> Plan ----------
function tps(quelle, ziel, lambda) {
  const n = quelle.length;
  const U = (r2) => (r2 > 0 ? r2 * Math.log(r2) * 0.5 : 0); // r² log r
  const N = n + 3;
  const A = Array.from({ length: N }, () => new Float64Array(N));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const dx = quelle[i][0] - quelle[j][0], dy = quelle[i][1] - quelle[j][1];
      A[i][j] = U(dx * dx + dy * dy) + (i === j ? lambda : 0);
    }
    A[i][n] = A[n][i] = 1;
    A[i][n + 1] = A[n + 1][i] = quelle[i][0];
    A[i][n + 2] = A[n + 2][i] = quelle[i][1];
  }
  const loesen = (b) => {
    const M = A.map((r) => Float64Array.from(r));
    const x = Float64Array.from(b);
    for (let k = 0; k < N; k++) {
      let p = k;
      for (let i = k + 1; i < N; i++) if (Math.abs(M[i][k]) > Math.abs(M[p][k])) p = i;
      [M[k], M[p]] = [M[p], M[k]];
      [x[k], x[p]] = [x[p], x[k]];
      for (let i = k + 1; i < N; i++) {
        const f = M[i][k] / M[k][k];
        if (!f) continue;
        for (let j = k; j < N; j++) M[i][j] -= f * M[k][j];
        x[i] -= f * x[k];
      }
    }
    for (let k = N - 1; k >= 0; k--) {
      let s = x[k];
      for (let j = k + 1; j < N; j++) s -= M[k][j] * x[j];
      x[k] = s / M[k][k];
    }
    return x;
  };
  const wx = loesen([...ziel.map((p) => p[0]), 0, 0, 0]);
  const wy = loesen([...ziel.map((p) => p[1]), 0, 0, 0]);
  return ([x, y]) => {
    let fx = wx[n] + wx[n + 1] * x + wx[n + 2] * y;
    let fy = wy[n] + wy[n + 1] * x + wy[n + 2] * y;
    for (let i = 0; i < n; i++) {
      const dx = x - quelle[i][0], dy = y - quelle[i][1];
      const u = U(dx * dx + dy * dy);
      fx += wx[i] * u;
      fy += wy[i] * u;
    }
    return [fx, fy];
  };
}
const mitPlan = netz.haltestellen.filter((h) => h.plan);
const verzerren = tps(
  mitPlan.map((h) => zuKm([h.lon, h.lat])),
  mitPlan.map((h) => zuKm(h.plan)),
  Number(process.env.GLAETTUNG ?? 0.5),
);

// ---------- Ausgabe ----------
const r5 = ([x, y]) => [Math.round(x * 1e5) / 1e5, Math.round(y * 1e5) / 1e5];
const aus = { quelle: 'OpenStreetMap-Mitwirkende (ODbL), vereinfacht', flaechen: [], fluesse: [] };
const ORDNUNG = { stadt: 0, wald: 1, see: 2 };
formen.sort((a, b) => (ORDNUNG[a.art] ?? 3) - (ORDNUNG[b.art] ?? 3));
for (const f of formen) {
  const g = glaetten(f.p, f.ring);
  const p = glaetten(f.p.map(verzerren), f.ring);
  const zu = (pts) => (f.ring ? [...pts, pts[0]] : pts).map(ausKm).map(r5);
  (f.ring ? aus.flaechen : aus.fluesse).push({ art: f.art, g: zu(g), p: zu(p) });
}
await writeFile(new URL('public/data/hintergrund.json', root), JSON.stringify(aus));
const zahl = (art) => formen.filter((f) => f.art === art).length;
console.log(
  `public/data/hintergrund.json: ${zahl('see')} See, ${zahl('fluss')} Flussstücke, ${zahl('wald')} Waldflächen, ${zahl('stadt')} Stadtgrenze, ` +
    `${formen.reduce((s, f) => s + f.p.length, 0)} Punkte vor dem Glätten`,
);
