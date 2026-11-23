// Zeitlogik des Linienarchivs: Welche Linienversion gilt an welchem Datum?

export async function ladeNetz() {
  const res = await fetch('/data/netz.json');
  if (!res.ok) throw new Error(`Netzdaten nicht ladbar (${res.status})`);
  const netz = await res.json();
  for (const l of netz.linien) l.gruppe ??= l.art === 'bus' ? 'bus' : 'tram';
  netz.linieById = new Map(netz.linien.map((l, i) => [l.id, { ...l, rang: i }]));
  // Erstes erfasstes Jahr je Verkehrsmittel: { tram: 2010, bus: 2015 }
  netz.erfasstAb = netz.meta.erfasstAb ?? { tram: netz.meta.zeitraum[0] };
  netz.haltestelleById = new Map(netz.haltestellen.map((h) => [h.id, h]));
  netz.kanteById = new Map(netz.kanten.map((k) => [k.id, k]));
  netz.versionenProLinie = new Map();
  for (const v of netz.versionen) {
    if (!netz.versionenProLinie.has(v.linie)) netz.versionenProLinie.set(v.linie, []);
    netz.versionenProLinie.get(v.linie).push(v);
  }
  for (const vs of netz.versionenProLinie.values()) vs.sort((a, b) => (a.von ?? '').localeCompare(b.von ?? ''));
  const [start, ende] = netz.meta.zeitraum;
  netz.jahre = Array.from({ length: ende - start + 1 }, (_, i) => start + i);
  return netz;
}

export const stichtag = (netz, jahr) => `${jahr}-${netz.meta.stichtag}`;

export const istAktiv = (v, datum) => (!v.von || v.von <= datum) && (!v.bis || datum <= v.bis);

export const GRUPPEN = { tram: 'Tram', bus: 'Bus' };

/** Ist das Verkehrsmittel im Jahr erfasst? (Busse erst ab 2015) */
export const erfasst = (netz, gruppe, jahr) => netz.erfasstAb[gruppe] !== undefined && jahr >= netz.erfasstAb[gruppe];

/** Alle gültigen Versionen an einem Datum, je Linie höchstens eine; optional nur die gezeigten Verkehrsmittel. */
export function zustand(netz, datum, gruppen = null) {
  const proLinie = new Map();
  for (const v of netz.versionen) {
    if (!istAktiv(v, datum)) continue;
    if (gruppen && !gruppen.includes(netz.linieById.get(v.linie).gruppe)) continue;
    proLinie.set(v.linie, v);
  }
  return proLinie;
}

/** Haltestellen einer Version an einem Datum (später eröffnete Halte ausgeblendet). */
export function halteAm(version, datum) {
  if (!version.halteAb) return version.haltestellen;
  return version.haltestellen.filter((id) => !version.halteAb[id] || version.halteAb[id] <= datum);
}

const gleicherWeg = (a, b, datumA, datumB) => {
  const ha = halteAm(a, datumA).join('|');
  const hb = halteAm(b, datumB);
  return ha === hb.join('|') || ha === [...hb].reverse().join('|');
};

/** Änderungen zwischen dem Stand des Vorjahres und dem Stand des Jahres (nur Verkehrsmittel, die im Vorjahr schon erfasst sind). */
export function aenderungen(netz, jahr, gruppen = ['tram']) {
  const d1 = stichtag(netz, jahr - 1);
  const d2 = stichtag(netz, jahr);
  const vergleichbar = gruppen.filter((g) => erfasst(netz, g, jahr - 1));
  const vorher = zustand(netz, d1, vergleichbar);
  const nachher = zustand(netz, d2, vergleichbar);
  const liste = [];
  for (const l of netz.linien) {
    const a = vorher.get(l.id);
    const b = nachher.get(l.id);
    if (!a && b) liste.push({ linie: l.id, art: 'neu', version: b });
    else if (a && !b) liste.push({ linie: l.id, art: 'eingestellt', version: a });
    else if (a && b && !gleicherWeg(a, b, d1, d2)) liste.push({ linie: l.id, art: 'geändert', version: b, vorher: a });
  }
  return liste;
}

/** Vergleich zweier Haltestellenfolgen (LCS), Richtung der alten Folge wird angeglichen. */
export function vergleicheFolgen(alt, neu) {
  if (!alt) return neu.map((id) => ({ id, art: 'gleich' }));
  const lcs = (x, y) => {
    const m = x.length, n = y.length;
    const T = Array.from({ length: m + 1 }, () => new Uint16Array(n + 1));
    for (let i = m - 1; i >= 0; i--)
      for (let j = n - 1; j >= 0; j--)
        T[i][j] = x[i] === y[j] ? T[i + 1][j + 1] + 1 : Math.max(T[i + 1][j], T[i][j + 1]);
    return T;
  };
  const vorwaerts = lcs(alt, neu);
  const rueck = [...alt].reverse();
  const rueckT = lcs(rueck, neu);
  const [x, T] = rueckT[0][0] > vorwaerts[0][0] ? [rueck, rueckT] : [alt, vorwaerts];
  const out = [];
  let i = 0, j = 0;
  while (i < x.length || j < neu.length) {
    if (i < x.length && j < neu.length && x[i] === neu[j]) { out.push({ id: neu[j], art: 'gleich' }); i++; j++; }
    else if (j < neu.length && (i >= x.length || T[i][j + 1] >= T[i + 1][j])) { out.push({ id: neu[j], art: 'neu' }); j++; }
    else { out.push({ id: x[i], art: 'entfallen' }); i++; }
  }
  return out;
}

const fmt = new Intl.DateTimeFormat('de-CH', { day: 'numeric', month: 'numeric', year: 'numeric' });
export const datum = (iso) => (iso ? fmt.format(new Date(iso + 'T12:00:00')) : null);

export function zeitraumText(v) {
  if (!v.von && !v.bis) return 'ganzer Erfassungszeitraum';
  if (!v.von) return `bis ${datum(v.bis)}`;
  if (!v.bis) return `seit ${datum(v.von)}`;
  return `${datum(v.von)} – ${datum(v.bis)}`;
}

export const STATUS = {
  belegt: { text: 'belegt', erklaerung: 'Linienweg durch Quelle belegt, Haltestellen aus OpenStreetMap.' },
  abgeleitet: { text: 'abgeleitet', erklaerung: 'Endpunkte belegt, Zwischenhalte rekonstruiert.' },
  unsicher: { text: 'unsicher', erklaerung: 'Quellen widersprüchlich oder nur sinngemäss geprüft.' },
};

// Busblau des ZVV-Liniennetzplans (Buslinien ohne eigene Farbe)
export const BUSBLAU = '#75BEE9';

// Helle Linienfarben (helle Trolleybusse) brauchen dunkle Schrift und einen dunklen Rand.
// Das Busblau ist zwar hell, trägt aber wie im ZVV-Plan weisse Schrift ohne Rand.
export function istHell(farbe) {
  if (farbe.toUpperCase() === BUSBLAU) return false;
  const h = farbe.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.299 * r + 0.587 * g + 0.114 * b > 160;
}
