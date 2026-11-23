// Prüft, ob die eingecheckten erzeugten Daten zu den Quellen passen (für die CI).
//
//   node scripts/plan/layout-bus.mjs && npm run daten && node scripts/pruefen-aktuell.mjs
//
// Vergleicht data/layout.json und public/data/netz.json auf der Platte mit dem Stand im letzten Commit.
// Zahlen dürfen leicht abweichen: Fliesskomma-Rechnungen (Thin-Plate-Spline, Entspannung) ergeben auf
// anderen Plattformen und Node-Versionen nicht bitgenau dieselben Werte.

import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const DATEIEN = {
  'data/layout.json': 0.5, // Planpunkte
  'public/data/netz.json': 2e-5, // Grad, rund 2 m
};
const IGNORIEREN = new Set(['meta.erstellt']);

let fehler = 0;
for (const [datei, tol] of Object.entries(DATEIEN)) {
  const alt = JSON.parse(execFileSync('git', ['show', `HEAD:${datei}`], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 }));
  const neu = JSON.parse(await readFile(new URL(datei, root), 'utf8'));
  const abw = [];
  let maxZahl = 0;
  const vergleiche = (a, b, pfad) => {
    if (IGNORIEREN.has(pfad)) return;
    if (typeof a === 'number' && typeof b === 'number') {
      const d = Math.abs(a - b);
      maxZahl = Math.max(maxZahl, d);
      if (d > tol) abw.push(`${pfad}: ${a} -> ${b}`);
    } else if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) abw.push(`${pfad}: Länge ${a.length} -> ${b.length}`);
      else a.forEach((x, i) => vergleiche(x, b[i], `${pfad}[${i}]`));
    } else if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
      for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
        const p = pfad ? `${pfad}.${k}` : k;
        if (!(k in a)) abw.push(`${p}: neu`);
        else if (!(k in b)) abw.push(`${p}: fehlt`);
        else vergleiche(a[k], b[k], p);
      }
    } else if (a !== b) abw.push(`${pfad}: ${JSON.stringify(a)?.slice(0, 80)} -> ${JSON.stringify(b)?.slice(0, 80)}`);
  };
  vergleiche(alt, neu, '');
  console.log(`${datei}: ${abw.length ? `${abw.length} Abweichungen` : 'aktuell'} (grösste Zahlabweichung ${maxZahl.toExponential(2)}, erlaubt ${tol})`);
  for (const z of abw.slice(0, 20)) console.log(`  ${z}`);
  fehler += abw.length;
}
if (fehler) {
  console.log("\nErzeugte Daten passen nicht zu den Quellen. Lokal 'node scripts/plan/layout-bus.mjs && npm run daten' ausführen und committen.");
  process.exit(1);
}
