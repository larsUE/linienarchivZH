// Prüft die erzeugte public/data/netz.json auf innere Stimmigkeit.
//
//   npm test
//
// Der Build (scripts/build-data.mjs) bricht bei groben Fehlern selbst ab. Diese Tests fangen,
// was er durchlässt: verwechselte Haltestellen, Lücken in Linienwegen, schiefe Planstriche.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const netz = JSON.parse(await readFile(new URL('../public/data/netz.json', import.meta.url), 'utf8'));
const H = new Map(netz.haltestellen.map((h) => [h.id, h]));
const K = new Map(netz.kanten.map((k) => [k.id, k]));
const L = new Map(netz.linien.map((l) => [l.id, l]));

const KOS = Math.cos((47.37 * Math.PI) / 180);
const meter = ([lon1, lat1], [lon2, lat2]) => Math.hypot((lon2 - lon1) * 111320 * KOS, (lat2 - lat1) * 110574);
const kurz = (liste, n = 8) => (liste.length > n ? [...liste.slice(0, n), `… (${liste.length})`] : liste).join(', ');

test('Ids sind eindeutig', () => {
  for (const [name, liste] of Object.entries({ linien: netz.linien, versionen: netz.versionen, haltestellen: netz.haltestellen, kanten: netz.kanten })) {
    const doppelt = liste.map((x) => x.id).filter((id, i, a) => a.indexOf(id) !== i);
    assert.deepEqual(doppelt, [], `${name}: doppelte Ids`);
  }
});

test('Linien haben Nummer und Farbe', () => {
  const falsch = netz.linien.filter((l) => !l.nummer || !/^#[0-9A-Fa-f]{6}$/.test(l.farbe ?? '')).map((l) => l.id);
  assert.deepEqual(falsch, []);
});

test('Versionen verweisen auf bestehende Linien, Haltestellen und Abschnitte', () => {
  const fehler = [];
  for (const v of netz.versionen) {
    if (!L.has(v.linie)) fehler.push(`${v.id}: Linie ${v.linie}`);
    for (const h of v.haltestellen) if (!H.has(h)) fehler.push(`${v.id}: Haltestelle ${h}`);
    for (const k of v.kanten) if (!K.has(k.replace(/^-/, ''))) fehler.push(`${v.id}: Abschnitt ${k}`);
    if (v.von && v.bis && v.von > v.bis) fehler.push(`${v.id}: von ${v.von} nach bis ${v.bis}`);
  }
  assert.deepEqual(fehler, []);
});

test('Linienwege sind lückenlos von der ersten bis zur letzten Haltestelle', () => {
  const fehler = [];
  for (const v of netz.versionen) {
    let ort = v.haltestellen[0];
    for (const id of v.kanten) {
      const k = K.get(id.replace(/^-/, ''));
      const [von, nach] = id.startsWith('-') ? [k.b, k.a] : [k.a, k.b];
      if (von !== ort) {
        fehler.push(`${v.id}: ${id} beginnt bei ${von}, erwartet ${ort}`);
        break;
      }
      ort = nach;
    }
    if (ort !== v.haltestellen.at(-1) && !fehler.at(-1)?.startsWith(v.id)) fehler.push(`${v.id}: endet bei ${ort}, nicht ${v.haltestellen.at(-1)}`);
  }
  assert.deepEqual(fehler, []);
});

test('Fahrwege beginnen und enden bei ihren Haltestellen (keine verwechselten Namen)', () => {
  // Gleichnamige Haltestellen an verschiedenen Orten (Maienweg Zürich / Dietikon) fallen hier auf:
  // Der Fahrweg endet dann kilometerweit von der Haltestelle entfernt.
  const fehler = [];
  for (const k of netz.kanten) {
    for (const [ende, h] of [[k.coords[0], H.get(k.a)], [k.coords.at(-1), H.get(k.b)]]) {
      const d = meter(ende, [h.lon, h.lat]);
      if (d > 300) fehler.push(`${k.id}: ${h.name} ${Math.round(d)} m`);
    }
  }
  assert.deepEqual(fehler, [], kurz(fehler));
});

test('Im Plan hat jede Haltestelle und jeder Abschnitt eine Lage', { skip: !netz.meta.plan && 'kein Plan' }, () => {
  const ohne = [
    ...netz.haltestellen.filter((h) => !h.plan).map((h) => h.id),
    ...netz.kanten.filter((k) => !(k.planCoords?.length >= 2)).map((k) => k.id),
  ];
  // Busse fehlen im Plan nur, wenn der Plan ausdrücklich ohne Busse ist
  const erlaubt = (id) => !netz.meta.plan.busse && (id.startsWith('bus:') || H.get(id)?.nurBus);
  assert.deepEqual(ohne.filter((id) => !erlaubt(id)), []);
});

test('Planstriche verbinden ihre Haltestellen', { skip: !netz.meta.plan && 'kein Plan' }, () => {
  const fehler = [];
  for (const k of netz.kanten) {
    if (!k.planCoords || k.planGeschaetzt) continue;
    for (const [ende, h] of [[k.planCoords[0], H.get(k.a)], [k.planCoords.at(-1), H.get(k.b)]]) {
      if (!h.plan) continue;
      const d = meter(ende, h.plan);
      if (d > 30) fehler.push(`${k.id}: ${h.name} ${Math.round(d)} m`);
    }
  }
  assert.deepEqual(fehler, [], kurz(fehler));
});

test('Planstriche sind waagrecht, senkrecht oder diagonal', { skip: !netz.meta.plan?.quelle?.includes('oktilinear') && 'kein oktilineares Layout' }, () => {
  // Der Plan liegt mit gleichem Massstab in Metern über der Karte: Winkel in Metern messen, nicht in Grad.
  const fehler = [];
  for (const k of netz.kanten) {
    if (!k.planCoords || k.planGeschaetzt) continue;
    for (let i = 1; i < k.planCoords.length; i++) {
      const [x0, y0] = k.planCoords[i - 1], [x1, y1] = k.planCoords[i];
      const dx = (x1 - x0) * KOS, dy = y1 - y0;
      if (Math.hypot(dx, dy) < 1e-5) continue;
      const w = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 45;
      if (Math.min(w, 45 - w) > 1.5) fehler.push(`${k.id} (Stück ${i}): ${w.toFixed(1)}° neben 45°-Raster`);
    }
  }
  assert.deepEqual(fehler, [], kurz(fehler));
});

test('Keine zwei Haltestellen liegen im Plan aufeinander', { skip: !netz.meta.plan && 'kein Plan' }, () => {
  const mit = netz.haltestellen.filter((h) => h.plan && !h.planGeschaetzt);
  const fehler = [];
  for (let i = 0; i < mit.length; i++)
    for (let j = i + 1; j < mit.length; j++)
      if (meter(mit[i].plan, mit[j].plan) < 5) fehler.push(`${mit[i].name} / ${mit[j].name}`);
  assert.deepEqual(fehler, [], kurz(fehler));
});
