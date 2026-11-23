// Erzeugt data/busse.yaml aus dem Bus-Import (data/import/bus/fahrplan.json).
//
//   node scripts/import/import-fahrplan.mjs --bus     zuerst
//   node scripts/import/bus-versionen.mjs [--neu]
//
// Einmaliger Ausgangspunkt: Danach wird data/busse.yaml von Hand gepflegt wie data/linien.yaml,
// der Import vergleicht nur noch. Ohne --neu wird eine bestehende Datei nicht überschrieben.
//
// Regeln:
//  - Vorübergehende Zeiträume (Umleitungen, Baustellen) entfallen, gleiche Wege rundherum werden zusammengefasst.
//  - Wechsel in den GTFS-Daten liegen auf einem Wochenbeginn; liegt ein Fahrplanwechsel in der Woche davor,
//    gilt sein Datum.
//  - Wechsel zwischen zwei Stichwochen (2015–2018) werden auf den Fahrplanwechsel dazwischen gesetzt.
//    Der Weg der ersten Stichwoche (Oktober 2015) gilt ab dem Fahrplanwechsel Dezember 2014.

import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { parse } from 'yaml';

const root = new URL('../../', import.meta.url);
const ziel = new URL('data/busse.yaml', root);
if (existsSync(ziel) && !process.argv.includes('--neu')) {
  console.error('data/busse.yaml besteht schon (wird von Hand gepflegt). Mit --neu überschreiben.');
  process.exit(1);
}
// Bestehende Zuordnungen von Haltestellennamen bleiben erhalten
const alias = existsSync(ziel) ? parse(await readFile(ziel, 'utf8'))?.fahrplan_alias ?? {} : {};
const json = async (p) => JSON.parse(await readFile(new URL(p, root), 'utf8'));
const { quellen, linien, linienInfo } = await json('data/import/bus/fahrplan.json');
const netz = await json('public/data/netz.json');
const busHalte = await json('data/bus/haltestellen.json');
const NAME = new Map([...netz.haltestellen, ...busHalte].map((h) => [h.id, h.name]));

// ---------- Daten ----------
const iso = (d) => d.toISOString().slice(0, 10);
const plusTage = (s, n) => {
  const d = new Date(`${s}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
};
// Fahrplanwechsel: Sonntag nach dem zweiten Samstag im Dezember
function fahrplanwechsel(jahr) {
  const d = new Date(Date.UTC(jahr, 11, 1, 12));
  const ersterSamstag = 1 + ((6 - d.getUTCDay() + 7) % 7);
  return iso(new Date(Date.UTC(jahr, 11, ersterSamstag + 8, 12)));
}
const FPW = Array.from({ length: 15 }, (_, i) => fahrplanwechsel(2013 + i));
const fpwVor = (datum) => FPW.filter((f) => f <= datum).at(-1);
const fpwIn = (von, bis) => FPW.find((f) => f >= von && f <= bis);
const stichwoche = (p) => quellen[p.quellen[0]].art === 'stichwoche';
const datenEnde = Object.values(quellen).map((q) => q.bis).sort().at(-1);

function versionen(perioden) {
  // Fährt die Linie bis zum Ende der Daten (auch vorübergehend umgeleitet), bleibt die letzte Version offen
  const faehrtNoch = perioden.some((p) => plusTage(p.bis, 14) >= datenEnde);
  // dauerhafte Zeiträume, gleiche aufeinanderfolgende Wege zusammenfassen
  const ps = [];
  for (const p of perioden) {
    if (p.kurz || p.halte.length < 2) continue;
    const key = p.halte.join('|');
    const letzte = ps.at(-1);
    if (letzte && letzte.key === key) {
      letzte.bis = p.bis;
      letzte.quellen.push(...p.quellen);
      letzte.stich ||= stichwoche(p);
      letzte.gtfs ||= !stichwoche(p);
    } else {
      ps.push({ key, halte: p.halte, von: p.von, bis: p.bis, quellen: [...p.quellen], stich: stichwoche(p), gtfs: !stichwoche(p), erstStich: stichwoche(p) });
    }
  }
  return ps.map((p, i) => {
    const notiz = [];
    // Beginn
    let von;
    if (p.erstStich) {
      von = fpwVor(p.von);
      notiz.push(
        i === 0 && p.von < '2016-01-01'
          ? 'Weg aus der Stichwoche Oktober 2015, ab dem Fahrplanwechsel Dezember 2014 angenommen.'
          : `Wechsel zwischen zwei Stichwochen, auf den Fahrplanwechsel ${von} gesetzt.`,
      );
    } else {
      von = fpwIn(plusTage(p.von, -1), plusTage(p.von, 6)) ?? p.von;
    }
    // Ende: bis zum Beginn der nächsten Version, sonst offen oder bis zum letzten Betriebstag
    let bis = null;
    const naechste = ps[i + 1];
    if (naechste) {
      const nVon = naechste.erstStich ? fpwVor(naechste.von) : fpwIn(plusTage(naechste.von, -1), plusTage(naechste.von, 6)) ?? naechste.von;
      bis = plusTage(nVon, -1);
    } else if (!faehrtNoch) {
      const f = p.stich && !p.gtfs ? FPW.find((x) => x > p.bis) : fpwIn(plusTage(p.bis, -6), p.bis);
      bis = f ? plusTage(f, -1) : p.bis;
      notiz.push('Linie danach eingestellt oder umnummeriert.');
    }
    const q = [];
    if (p.stich) q.push('vbz-fahrzeiten');
    if (p.gtfs) q.push('gtfs');
    return { von, bis, weg: p.halte.map((id) => NAME.get(id) ?? id), quellen: q, notiz: notiz.join(' ') };
  });
}

// ---------- YAML ----------
const str = (s) => JSON.stringify(s);
const zeilen = [
  '# Linienarchiv Zürich – VBZ-Buslinien ab 2015',
  '#',
  '# Erzeugt mit scripts/import/bus-versionen.mjs aus den Fahrplandaten (data/import/bus/), danach von Hand gepflegt.',
  '# Aufbau wie data/linien.yaml. Der Linienweg ist eine Haltestellenliste: Tramhaltestellen heissen wie in',
  '# data/linien.yaml, Bushaltestellen wie in data/bus/haltestellen.json. Fahrwege stehen in data/bus/kanten.json.',
  '# Quellen (gtfs, vbz-fahrzeiten) sind in data/linien.yaml definiert.',
  '#',
  '# Für die Jahre vor 2015 gibt es keine Busdaten; das Archiv zeigt Busse ab 2015.',
  '',
  'erfasst_ab: 2015',
  '',
  'fahrplan_alias:',
  '  # Haltestellennamen aus den Fahrplandaten -> unsere Haltestelle (Id), wie in data/linien.yaml',
  ...(Object.keys(alias).length ? Object.entries(alias).map(([k, v]) => `  ${str(k)}: ${v === null ? 'null' : v}`) : ['  {}']),
  '',
  'linien:',
];
const BUSBLAU = '#75BEE9';
const nummern = Object.keys(linien).sort((a, b) => Number(a) - Number(b));
const ohne = [];
for (const n of nummern) {
  const vs = versionen(linien[n]);
  if (!vs.length) {
    ohne.push(n);
    continue;
  }
  zeilen.push(`  - id: bus-${n}`, `    nummer: ${str(n)}`, '    art: bus');
  // Linien ohne eigene Farbe (in GTFS weiss) im Busblau des ZVV-Liniennetzplans
  const farbe = linienInfo[n]?.farbe;
  zeilen.push(`    farbe: ${str(farbe && farbe.toUpperCase() !== '#FFFFFF' ? farbe : BUSBLAU)}`);
  zeilen.push('    versionen:');
  for (const v of [...vs].reverse()) {
    zeilen.push(`      - von: ${v.von}`);
    if (v.bis) zeilen.push(`        bis: ${v.bis}`);
    // Haltestellenliste umbrechen
    const teile = [];
    let z = '';
    for (const h of v.weg.map(str)) {
      if (z && (z + ', ' + h).length > 100) {
        teile.push(z + ',');
        z = h;
      } else z = z ? `${z}, ${h}` : h;
    }
    teile.push(z);
    zeilen.push('        weg: [', ...teile.map((t) => `          ${t}`), '        ]');
    zeilen.push('        status: belegt', `        quellen: [${v.quellen.join(', ')}]`);
    if (v.notiz) zeilen.push(`        notiz: ${str(v.notiz)}`);
  }
  zeilen.push('');
}
if (ohne.length) zeilen.push(`# Nur vorübergehend im Fahrplan, keine Version: ${ohne.join(', ')}`, '');
await writeFile(ziel, zeilen.join('\n'));
console.log(`${nummern.length - ohne.length} Buslinien geschrieben${ohne.length ? `, ohne Version: ${ohne.join(', ')}` : ''}`);
