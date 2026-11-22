// Erzeugt MapLibre-Glyphen (SDF, PBF) aus Barlow für die Kartenbeschriftungen.
//
//   node scripts/build-glyphs.mjs
//
// Schreibt public/fonts/<schrift>/<von>-<bis>.pbf. Die Karte leitet Glyphen-Anfragen für «Barlow …»
// dorthin um (transformRequest in Karte.svelte); die Grundkarte behält ihre eigene Schrift.
// Parameter wie beim lokalen Glyphen-Zeichnen von MapLibre: 24 px, Rand 3, Radius 8, Cutoff 0.25.

import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import TinySDF from '@mapbox/tiny-sdf';
import Pbf from 'pbf';

const require = createRequire(import.meta.url);
const root = new URL('..', import.meta.url);

const SCHRIFTEN = [{ name: 'Barlow Medium', ordner: 'barlow-medium', gewicht: 500 }];
// Latin-1, Lateinisch erweitert-A, allgemeine Satzzeichen (– ’ …)
const BEREICHE = [
  [0, 255, 'latin'],
  [256, 511, 'latin-ext'],
  [8192, 8447, 'latin'],
];

class Sdf extends TinySDF {
  _createCanvas(size) {
    return createCanvas(size, size);
  }
}

for (const s of SCHRIFTEN) {
  for (const teil of ['latin', 'latin-ext']) {
    GlobalFonts.registerFromPath(
      require.resolve(`@fontsource/barlow/files/barlow-${teil}-${s.gewicht}-normal.woff`),
      `Barlow-${teil}-${s.gewicht}`,
    );
  }
  const ordner = new URL(`public/fonts/${s.ordner}/`, root);
  await mkdir(ordner, { recursive: true });

  for (const [von, bis, teil] of BEREICHE) {
    const sdf = new Sdf({ fontSize: 24, buffer: 3, radius: 8, cutoff: 0.25, fontFamily: `Barlow-${teil}-${s.gewicht}` });
    const pbf = new Pbf();
    pbf.writeMessage(1, (_, p) => {
      p.writeStringField(1, s.name);
      p.writeStringField(2, `${von}-${bis}`);
      for (let id = von; id <= bis; id++) {
        const g = sdf.draw(String.fromCharCode(id));
        const leer = !g.glyphWidth || !g.glyphHeight;
        p.writeMessage(3, (_, q) => {
          q.writeVarintField(1, id);
          if (!leer) q.writeBytesField(2, g.data);
          q.writeVarintField(3, leer ? 0 : g.glyphWidth);
          q.writeVarintField(4, leer ? 0 : g.glyphHeight);
          q.writeSVarintField(5, Math.round(g.glyphLeft + 0.5));
          q.writeSVarintField(6, Math.round(g.glyphTop - 27));
          q.writeVarintField(7, Math.round(g.glyphAdvance));
        });
      }
    });
    await writeFile(new URL(`${von}-${bis}.pbf`, ordner), pbf.finish());
  }
  console.log(`${s.name}: ${BEREICHE.length} Bereiche in public/fonts/${s.ordner}/`);
}
