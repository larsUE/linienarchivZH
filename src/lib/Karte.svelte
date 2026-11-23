<script>
  import { onMount } from 'svelte';
  import maplibregl from 'maplibre-gl';
  import { zustand, halteAm, erfasst } from './netz.js';

  let { netz, datum, vorjahrDatum, auswahl = null, ansicht = 'plan', gruppen = ['tram'], onlinie } = $props();

  let container;
  let map = $state(null);
  let bereit = $state(false);

  // Rand um das Netz; die Seitenleiste liegt neben der Karte, nicht darüber
  const polster = () => (container.clientWidth > 700 ? 40 : 20);

  const STIL = 'https://vectortiles.geo.admin.ch/styles/ch.swisstopo.lightbasemap.vt/style.json';
  const leer = { type: 'FeatureCollection', features: [] };
  const DAUER = 900; // Überblendung in ms

  // Linienbreite und Versatz paralleler Linien in Pixeln, abhängig vom Zoom
  const breite = ['interpolate', ['linear'], ['zoom'], 11, 2, 13, 3.5, 16, 7];
  // Busse schmaler, in der Karte mit dunklem Rand (Busblau wie im ZVV-Plan, Trolleybusse in eigener Farbe)
  const BUS = [1.4, 2.2, 4.4]; // Strichbreite bei Zoom 11, 13, 16
  const busBreite = (plus = 0) => ['interpolate', ['linear'], ['zoom'], 11, BUS[0] + plus, 13, BUS[1] + plus, 16, BUS[2] + plus];
  const istBus = ['==', ['get', 'gruppe'], 'bus'];
  // Versatz aus Anteilen von Tram- und Busbreiten (aT, aB): so können Busse im Plan neben dem Trambündel laufen
  const TRAMSCHRITT = [2, 3.5, 7];
  const BUSSCHRITT = [BUS[0] + 1, BUS[1] + 1.2, BUS[2] + 1.6];
  const versatzMisch = ['interpolate', ['linear'], ['zoom'],
    ...[11, 13, 16].flatMap((z, i) => [z, ['+', ['*', ['get', 'aT'], TRAMSCHRITT[i]], ['*', ['get', 'aB'], BUSSCHRITT[i]]]])];
  // Busse mit Planlage bleiben im Plan sichtbar (sonst blenden sie zum Plan hin aus)
  const busImPlan = !!netz.meta.plan?.busse;

  // ---------- Geometrie: geografisch und im Plan, mit gleicher Punktzahl ----------
  // Beide Linienzüge werden an denselben relativen Positionen abgetastet (Vereinigung ihrer Stützpunkte),
  // so bleiben Ecken in beiden Ansichten erhalten und die Überblendung ist eine einfache Interpolation.
  function anteile(coords) {
    const d = [0];
    for (let i = 1; i < coords.length; i++) d.push(d[i - 1] + Math.hypot(coords[i][0] - coords[i - 1][0], coords[i][1] - coords[i - 1][1]));
    const L = d.at(-1) || 1;
    return d.map((x) => x / L);
  }
  function abtasten(coords, t, ts) {
    const out = [];
    let i = 0;
    for (const s of ts) {
      while (i < coords.length - 2 && t[i + 1] < s) i++;
      const f = t[i + 1] > t[i] ? Math.min(1, Math.max(0, (s - t[i]) / (t[i + 1] - t[i]))) : 0;
      out.push([coords[i][0] + (coords[i + 1][0] - coords[i][0]) * f, coords[i][1] + (coords[i + 1][1] - coords[i][1]) * f]);
    }
    return out;
  }
  function angleichen(g, p) {
    const tg = anteile(g);
    const tp = anteile(p);
    const ts = [...new Set([...tg, ...tp].map((x) => Math.round(x * 1e5) / 1e5))].sort((a, b) => a - b);
    return { g: abtasten(g, tg, ts), p: abtasten(p, tp, ts) };
  }
  // Rohgeometrie je Abschnitt; «imPlan»: hat eine eigene Planlage (sonst wird nicht abgerundet)
  const roh = new Map(netz.kanten.map((k) => [k.id, { g: k.coords, p: k.planCoords ?? k.coords, imPlan: !!k.planCoords, geschaetzt: !!k.planGeschaetzt }]));
  const lage = new Map(netz.haltestellen.map((h) => [h.id, { g: [h.lon, h.lat], p: h.plan ?? [h.lon, h.lat] }]));

  // Überblendungsgrad: 0 = geografisch, 1 = Plan
  let t = ansicht === 'plan' ? 1 : 0;
  const mischen = (a, b) => (t === 0 ? a : t === 1 ? b : [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  /** Linienzug einer angeglichenen Geometrie {g, p} beim aktuellen Überblendungsgrad */
  const linienzug = ({ g, p }) => (t === 0 ? g : t === 1 ? p : g.map((x, i) => mischen(x, p[i])));
  // Im Plan kann eine Haltestelle auf die Mitte eines Bogens rücken (siehe «Abgerundete Ecken»)
  const punkt = (id, planLage) => {
    const l = lage.get(id);
    return mischen(l.g, planLage ?? l.p);
  };

  // ---------- Abgerundete Ecken im Plan ----------
  // Im Plan liegen die Knicke an den Haltestellen. Jede Linie biegt dort in einem Kreisbogen ab, wie im ZVV-Plan:
  // die eine Hälfte des Bogens gehört zum ankommenden, die andere zum abgehenden Abschnitt.
  // Der Radius wächst mit der Bündelbreite, damit auch die inneren Linien eines Bündels noch einen Bogen haben,
  // und ist durch die halbe Länge der beiden Abschnitte begrenzt.
  // Biegen an einer Haltestelle nicht alle Linien gleich ab (Verzweigung, Endhalt), bleibt die Haltestelle an ihrem Ort;
  // dann ist der Bogen so eng, dass er höchstens ENG_TOLERANZ neben ihr vorbeiführt.
  const KOS = Math.cos((47.37 * Math.PI) / 180);
  const MPG = 111320; // Meter pro Breitengrad
  const zuM = ([x, y]) => [x * KOS * MPG, y * MPG];
  const ausM = ([x, y]) => [x / (KOS * MPG), y / MPG];
  const R_GRUND = 160; // Radius in Metern für eine einzelne Linie
  const R_PRO_LINIE = 70; // zusätzlich je Linie neben der Mitte des Bündels
  const ENG_TOLERANZ = 25; // Meter zwischen Bogenmitte und Haltestelle an Verzweigungen (etwa eine halbe Linienbreite)
  const BOGEN_SCHRITT = Math.PI / 36; // ein Stützpunkt je 5°

  function abgangPunkte(p, q) {
    const [px, py] = zuM(p), [qx, qy] = zuM(q);
    const L = Math.hypot(qx - px, qy - py) || 1;
    return { d: [(qx - px) / L, (qy - py) / L], L };
  }
  // Richtung und Länge des ersten Stücks von Abschnitt kid ab Haltestelle h
  function abgang(kid, h) {
    const c = roh.get(kid).p;
    return netz.kanteById.get(kid).a === h ? abgangPunkte(c[0], c[1]) : abgangPunkte(c.at(-1), c.at(-2));
  }
  // Halber Bogen an der Ecke S (Grad), von der Tangente auf dem eigenen Stück bis zur Bogenmitte.
  // eigen/ander: Abgänge von S mit der höchstens nutzbaren Länge L; eng: Bogenmitte nahe an S halten.
  function halbbogen(S, eigen, ander, R, eng = false) {
    const knick = Math.PI - Math.acos(Math.max(-1, Math.min(1, eigen.d[0] * ander.d[0] + eigen.d[1] * ander.d[1])));
    if (knick < 0.02 || knick > Math.PI - 0.05) return null; // geradeaus oder Wende
    const tanH = Math.tan(knick / 2);
    const sek = 1 / Math.cos(knick / 2);
    const r = Math.min(R, eigen.L / tanH, ander.L / tanH, eng ? ENG_TOLERANZ / (sek - 1) : Infinity);
    const s = zuM(S);
    const bx = eigen.d[0] + ander.d[0], by = eigen.d[1] + ander.d[1];
    const bl = Math.hypot(bx, by);
    const bis = [bx / bl, by / bl]; // ins Innere der Ecke
    const C = [s[0] + bis[0] * r * sek, s[1] + bis[1] * r * sek];
    const T = [s[0] + eigen.d[0] * r * tanH, s[1] + eigen.d[1] * r * tanH];
    const Mi = [C[0] - bis[0] * r, C[1] - bis[1] * r];
    const a0 = Math.atan2(T[1] - C[1], T[0] - C[0]);
    let da = Math.atan2(Mi[1] - C[1], Mi[0] - C[0]) - a0;
    da = Math.atan2(Math.sin(da), Math.cos(da));
    const n = Math.max(2, Math.ceil(Math.abs(da) / BOGEN_SCHRITT));
    return Array.from({ length: n + 1 }, (_, i) => ausM([C[0] + r * Math.cos(a0 + (da * i) / n), C[1] + r * Math.sin(a0 + (da * i) / n)]));
  }
  // Radius für den Übergang zwischen zwei Bündeln (symmetrisch, damit beide Hälften zusammenpassen)
  const radius = (n1, n2) => R_GRUND + (R_PRO_LINIE * (Math.max(n1, n2) - 1)) / 2;
  const halb = (x) => ({ ...x, L: x.L / 2 });

  /**
   * Plan-Linienzug eines Abschnitts (Richtung a -> b) mit Bögen an den Enden und an inneren Ecken.
   * endeA/endeB: { nachbar, R, eng } oder null (Endhalt, geradeaus).
   */
  function planZug(kid, endeA, endeB) {
    const k = netz.kanteById.get(kid);
    const { p: c, imPlan } = roh.get(kid);
    if (!imPlan) return c;
    // nur die halbe Länge jedes Stücks, damit die Bögen an beiden Enden Platz haben
    const aussen = (h, ende, S) => ende && halbbogen(S, halb(abgang(kid, h)), halb(abgang(ende.nachbar, h)), ende.R, ende.eng);
    const anfang = aussen(k.a, endeA, c[0]);
    const schluss = aussen(k.b, endeB, c.at(-1));
    const out = anfang ? [...anfang].reverse() : [c[0]];
    for (let i = 1; i < c.length - 1; i++) {
      const vor = halb(abgangPunkte(c[i], c[i - 1])), nach = halb(abgangPunkte(c[i], c[i + 1]));
      const h1 = halbbogen(c[i], vor, nach, R_GRUND);
      const h2 = halbbogen(c[i], nach, vor, R_GRUND);
      if (h1 && h2) out.push(...h1, ...[...h2].reverse().slice(1));
      else out.push(c[i]);
    }
    out.push(...(schluss ?? [c.at(-1)]));
    return out;
  }

  // Angeglichene Geometrien {g, p, geschaetzt}, je Abschnitt und Bögen an den Enden zwischengespeichert
  const geoCache = new Map();
  function geometrie(kid, endeA = null, endeB = null) {
    const schluessel = (e) => (e ? `${e.nachbar}@${Math.round(e.R)}${e.eng ? 'e' : ''}` : '');
    const key = `${kid}|${schluessel(endeA)}|${schluessel(endeB)}`;
    if (!geoCache.has(key)) {
      const r = roh.get(kid);
      geoCache.set(key, { ...angleichen(r.g, planZug(kid, endeA, endeB)), geschaetzt: r.geschaetzt });
    }
    return geoCache.get(key);
  }

  // ---------- Inhalt je Stichtag (unabhängig von der Ansicht) ----------
  let inhalt = null;

  // ---------- Reihenfolge paralleler Linien ----------
  // Auf jedem Abschnitt liegen die Linien so nebeneinander, wie sie später auseinanderlaufen:
  // wer an der nächsten Verzweigung nach links abbiegt, liegt links (sonst rückwärts gesucht, sonst Linienrang).
  // So bleibt die Reihenfolge entlang gemeinsamer Strecken gleich, und Linien kreuzen sich nur, wo es nötig ist.
  const planXY = (id) => {
    const [x, y] = lage.get(id).p;
    return [x * KOS, y];
  };
  function wende(p, c, n) {
    const [a, b, d] = [planXY(p), planXY(c), planXY(n)];
    const u = [b[0] - a[0], b[1] - a[1]], v = [d[0] - b[0], d[1] - b[1]];
    return Math.atan2(u[0] * v[1] - u[1] * v[0], u[0] * v[0] + u[1] * v[1]);
  }
  function knotenFolge(v) {
    const folge = [];
    for (const s of v.kanten) {
      const rueck = s.startsWith('-');
      const k = netz.kanteById.get(rueck ? s.slice(1) : s);
      if (!folge.length) folge.push(rueck ? k.b : k.a);
      folge.push(rueck ? k.a : k.b);
    }
    return folge;
  }
  // Positiv, wenn A rechts von B liegen soll (Blickrichtung start -> weiter über fa/fb)
  function seite(fa, fb, vorher, start) {
    let p = vorher, c = start;
    for (let i = 0; i < Math.min(fa.length, fb.length); i++) {
      if (fa[i] !== fb[i]) return wende(p, c, fb[i]) - wende(p, c, fa[i]);
      [p, c] = [c, fa[i]];
    }
    return 0;
  }

  // Im Plan liegt ein Busabschnitt zwischen denselben Haltestellen wie ein Tramabschnitt auf diesem: ein gemeinsames Bündel
  const buendelVon = (id) => {
    if (!busImPlan || !id.startsWith('bus:')) return id;
    const tram = id.slice(4);
    return netz.kanteById.has(tram) ? tram : id;
  };

  /** Ein Eintrag pro (Abschnitt, Linie). Linien auf demselben Abschnitt liegen nebeneinander. */
  function linienEintraege(proLinie) {
    const proKante = new Map();
    for (const v of proLinie.values()) {
      const folge = knotenFolge(v);
      v.kanten.forEach((signiert, i) => {
        const eigen = signiert.startsWith('-') ? signiert.slice(1) : signiert;
        const id = buendelVon(eigen);
        const k = netz.kanteById.get(id);
        if (!proKante.has(id)) proKante.set(id, []);
        const liste = proKante.get(id);
        if (liste.some((e) => e.linie === v.linie)) return;
        // weiterer Weg in Richtung a -> b und zurück ab a
        const vorwaerts = folge[i] === k.a;
        const nach = folge.slice(i + 2), vor = folge.slice(0, i).reverse();
        // Abschnitte, in die die Linie am Anfang und am Ende des eigenen Abschnitts weiterfährt
        const ohne = (s) => s?.replace(/^-/, '') ?? null;
        const [kVor, kNach] = [ohne(v.kanten[i - 1]), ohne(v.kanten[i + 1])];
        const eigenVorwaerts = folge[i] === netz.kanteById.get(eigen).a;
        liste.push({
          linie: v.linie,
          kante: eigen,
          vor: vorwaerts ? nach : vor,
          zur: vorwaerts ? vor : nach,
          nachbarA: eigenVorwaerts ? kVor : kNach,
          nachbarB: eigenVorwaerts ? kNach : kVor,
        });
      });
    }
    const eintraege = [];
    for (const [id, liste] of proKante) {
      const k = netz.kanteById.get(id);
      const rang = (e) => netz.linieById.get(e.linie).rang;
      liste.sort((A, B) => seite(A.vor, B.vor, k.a, k.b) || -seite(A.zur, B.zur, k.b, k.a) || rang(A) - rang(B));
      // Lage im Bündel: getrennt nach Tram und Bus (Karte) und gemeinsam (Plan), beim Überblenden gemischt
      const bus = (e) => netz.linieById.get(e.linie).gruppe === 'bus';
      const nT = liste.filter((e) => !bus(e)).length, nB = liste.length - nT;
      let iT = 0, iB = 0;
      liste.forEach((e) => {
        const l = netz.linieById.get(e.linie);
        const b = bus(e);
        const getrennt = b ? [0, iB - (nB - 1) / 2] : [iT - (nT - 1) / 2, 0];
        const gemeinsam = [iT + (b ? 0 : 0.5) - nT / 2, iB + (b ? 0.5 : 0) - nB / 2];
        if (b) iB++;
        else iT++;
        eintraege.push({
          kante: e.kante,
          nachbarA: e.nachbarA,
          nachbarB: e.nachbarB,
          getrennt,
          gemeinsam,
          properties: { kante: e.kante, linie: l.id, nummer: l.nummer, farbe: l.farbe, art: l.art, gruppe: l.gruppe, gs: roh.get(e.kante).geschaetzt },
        });
      });
    }
    // Bündelbreite je Abschnitt (nur Linien auf genau diesem Abschnitt) für die Haltestellenbalken
    const breite = new Map();
    for (const liste of proKante.values()) for (const e of liste) breite.set(e.kante, (breite.get(e.kante) ?? 0) + 1);

    // Bögen je Linie. Eine Haltestelle ist «einheitlich», wenn alle Linien dort zwischen denselben zwei Bündeln wechseln.
    const anzahl = (id) => proKante.get(buendelVon(id))?.length ?? 1;
    const wechsel = new Map(); // Haltestelle -> Set der Übergänge
    for (const e of eintraege) {
      if (!roh.get(e.kante).imPlan) continue;
      const k = netz.kanteById.get(e.kante);
      for (const [h, nachbar] of [[k.a, e.nachbarA], [k.b, e.nachbarB]]) {
        const paar = nachbar ? [buendelVon(e.kante), buendelVon(nachbar)].sort().join('|') : `ende:${buendelVon(e.kante)}`;
        if (!wechsel.has(h)) wechsel.set(h, new Set());
        wechsel.get(h).add(paar);
      }
    }
    const ende = (id, h, nachbar) =>
      nachbar ? { nachbar, R: radius(anzahl(id), anzahl(nachbar)), eng: (wechsel.get(h)?.size ?? 1) > 1 } : null;
    for (const e of eintraege) {
      const k = netz.kanteById.get(e.kante);
      e.geo = geometrie(e.kante, ende(e.kante, k.a, e.nachbarA), ende(e.kante, k.b, e.nachbarB));
    }
    return { eintraege, kanten: new Set([...proKante.values()].flatMap((l) => l.map((e) => e.kante))), breite };
  }

  function inhaltBerechnen() {
    const jetzt = zustand(netz, datum, gruppen);
    // Vergleich nur für Verkehrsmittel, die im Vorjahr schon erfasst sind (Busse ab 2015)
    const vergleichbar = vorjahrDatum ? gruppen.filter((g) => erfasst(netz, g, Number(vorjahrDatum.slice(0, 4)))) : [];
    const vorher = vorjahrDatum ? zustand(netz, vorjahrDatum, gruppen) : null;
    const istBusKante = (id) => netz.kanteById.get(id).bus;
    const { eintraege, kanten, breite: buendel } = linienEintraege(jetzt);
    const vorherInhalt = vorher ? linienEintraege(vorher) : null;
    const vorherKanten = vorherInhalt ? vorherInhalt.kanten : kanten;
    // Geometrie je Abschnitt (mit Bögen) für die Hervorhebung neuer und weggefallener Abschnitte
    const geoJe = (liste) => {
      const m = new Map();
      for (const e of liste) if (!m.has(e.kante)) m.set(e.kante, e.geo);
      return m;
    };
    const geoJetzt = geoJe(eintraege);
    const geoVorher = vorherInhalt ? geoJe(vorherInhalt.eintraege) : new Map();

    // Lage im Plan: Biegen alle Linien an einer Haltestelle gleich ab, rückt sie auf die Mitte ihres Bogens
    const enden = new Map(); // Haltestelle -> [{ geo, amAnfang, kante }]
    for (const e of eintraege) {
      if (!roh.get(e.kante).imPlan) continue;
      const k = netz.kanteById.get(e.kante);
      for (const [h, amAnfang] of [[k.a, true], [k.b, false]]) {
        if (!enden.has(h)) enden.set(h, []);
        enden.get(h).push({ geo: e.geo, amAnfang, kante: e.kante });
      }
    }
    const endpunkt = (x) => (x.amAnfang ? x.geo.p[0] : x.geo.p.at(-1));
    const gleich = (a, b) => Math.abs(a[0] - b[0]) < 1e-7 && Math.abs(a[1] - b[1]) < 1e-7;

    const halte = new Map();
    for (const v of jetzt.values()) {
      const ids = halteAm(v, datum);
      const bus = netz.linieById.get(v.linie).gruppe === 'bus';
      ids.forEach((id, i) => {
        const end = i === 0 || i === ids.length - 1;
        const h = halte.get(id) ?? { linien: [], endTram: false, endBus: false, tram: false };
        h.linien.push(v.linie);
        if (bus) h.endBus ||= end;
        else h.endTram ||= end;
        h.tram ||= !bus;
        halte.set(id, h);
      });
    }
    const vergleich = (id) => vergleichbar.includes(istBusKante(id) ? 'bus' : 'tram');
    const props = (id) => ({ bus: !!istBusKante(id) });
    inhalt = {
      linien: eintraege,
      neu: [...kanten].filter((k) => !vorherKanten.has(k) && vergleich(k)).map((id) => ({ geo: geoJetzt.get(id), properties: props(id) })),
      weg: [...vorherKanten]
        .filter((k) => !kanten.has(k) && vergleich(k))
        .map((id) => ({ geo: geoVorher.get(id) ?? geometrie(id), properties: props(id) })),
      halte: [...halte].map(([id, h]) => {
        // Balken quer über das breiteste Bündel an der Haltestelle (Tram vor Bus)
        let kante = null, n = 1;
        for (const k of kantenAn.get(id) ?? []) {
          if (h.tram && k.bus) continue;
          if ((buendel.get(k.id) ?? 0) > n || (!kante && buendel.has(k.id))) [kante, n] = [k, buendel.get(k.id)];
        }
        const an = enden.get(id) ?? [];
        const p0 = an.length ? endpunkt(an[0]) : null;
        const planLage = p0 && an.every((x) => gleich(endpunkt(x), p0)) ? p0 : null;
        // Ausrichtung des Balkens: ein Linienzug des gewählten Bündels, der genau an der Haltestelle endet
        const ziel = planLage ?? lage.get(id).p;
        const fuerWinkel =
          an.find((x) => x.kante === kante?.id && gleich(endpunkt(x), ziel)) ??
          (kante ? { geo: geometrie(kante.id), amAnfang: kante.a === id } : null);
        return {
          id,
          planLage,
          fuerWinkel,
          properties: {
            id,
            name: netz.haltestelleById.get(id).name,
            end: h.endTram || h.endBus,
            // Name nur als Bus-Endpunkt: blendet im Plan mit den Bussen aus
            endBus: !h.endTram,
            bus: !h.tram,
            linien: h.linien.join(' '),
            bild: `balken-${Math.min(n, MAXBUENDEL)}`,
          },
        };
      }),
    };
  }

  // Abschnitte je Haltestelle
  const kantenAn = new Map();
  for (const k of netz.kanten) {
    for (const h of [k.a, k.b]) {
      if (!kantenAn.has(h)) kantenAn.set(h, []);
      kantenAn.get(h).push(k);
    }
  }
  // Drehung des Balkens (Grad im Uhrzeigersinn, Bildschirm): quer zur Richtung des Abschnitts an der Haltestelle
  function balkenWinkel(h) {
    if (!h.fuerWinkel) return 0;
    const c = linienzug(h.fuerWinkel.geo);
    const [p, q] = h.fuerWinkel.amAnfang ? [c[0], c[1]] : [c.at(-2), c.at(-1)];
    const breitengrad = (p[1] * Math.PI) / 180;
    return (Math.atan2(-(q[1] - p[1]) / Math.cos(breitengrad), q[0] - p[0]) * 180) / Math.PI + 90;
  }

  // Balkenbilder für 1 bis MAXBUENDEL parallele Linien, gezeichnet für eine Linienbreite von REF Pixeln
  const MAXBUENDEL = 10;
  const REF = 10;
  function balkenBilder() {
    const pr = 2;
    for (let n = 1; n <= MAXBUENDEL; n++) {
      const w = (n * REF + 6) * pr, h = (REF + 4) * pr;
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const g = c.getContext('2d');
      const r = h / 2 - 1.5 * pr;
      g.beginPath();
      g.roundRect(1.5 * pr, 1.5 * pr, w - 3 * pr, h - 3 * pr, r);
      g.fillStyle = '#ffffff';
      g.fill();
      g.lineWidth = 2.5 * pr;
      g.strokeStyle = '#1d1d1b';
      g.stroke();
      map.addImage(`balken-${n}`, g.getImageData(0, 0, w, h), { pixelRatio: pr });
    }
  }

  // ---------- Hintergrund im Plan: Stadtgebiet, Wald, See, Flüsse (public/data/hintergrund.json) ----------
  let hintergrund = null;
  const HINTERGRUND = [
    // Ebene, Eigenschaft, Deckkraft im Plan
    ['flaeche-stadt', 'fill-opacity', 1],
    ['flaeche-wald', 'fill-opacity', 0.55],
    ['flaeche-see', 'fill-opacity', 1],
    ['fluss', 'line-opacity', 1],
    ['stadtgrenze', 'line-opacity', 0.8],
  ];
  function hintergrundZeichnen() {
    if (!hintergrund) return;
    for (const [id, eig, wert] of HINTERGRUND) map.setPaintProperty(id, eig, wert * t);
    if (t === 0) return; // in der Karte unsichtbar
    const zug = (f) => (t === 1 ? f.p : f.g.map((x, i) => mischen(x, f.p[i])));
    const fc = (features) => ({ type: 'FeatureCollection', features });
    map.getSource('flaechen').setData(
      fc(hintergrund.flaechen.map((f) => ({ type: 'Feature', properties: { art: f.art }, geometry: { type: 'Polygon', coordinates: [zug(f)] } }))),
    );
    map.getSource('fluesse').setData(
      fc(hintergrund.fluesse.map((f) => ({ type: 'Feature', properties: { art: f.art }, geometry: { type: 'LineString', coordinates: zug(f) } }))),
    );
  }

  // ---------- Zeichnen mit dem aktuellen Überblendungsgrad ----------
  function zeichnen() {
    if (!bereit || !inhalt) return;
    const fc = (features) => ({ type: 'FeatureCollection', features });
    const linie = (geo, properties = {}) => ({ type: 'Feature', properties, geometry: { type: 'LineString', coordinates: linienzug(geo) } });
    const mix = (a, b) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    map.getSource('linien').setData(
      fc(
        inhalt.linien.map((e) => {
          const [aT, aB] = t === 0 ? e.getrennt : t === 1 ? e.gemeinsam : mix(e.getrennt, e.gemeinsam);
          return linie(e.geo, { ...e.properties, aT, aB });
        }),
      ),
    );
    map.getSource('neu').setData(fc(inhalt.neu.map((e) => linie(e.geo, e.properties))));
    map.getSource('weg').setData(fc(inhalt.weg.map((e) => linie(e.geo, e.properties))));
    map.getSource('halte').setData(
      fc(
        inhalt.halte.map((h) => ({
          type: 'Feature',
          properties: { ...h.properties, winkel: balkenWinkel(h) },
          geometry: { type: 'Point', coordinates: punkt(h.id, h.planLage) },
        })),
      ),
    );
    map.setPaintProperty('papier', 'background-opacity', t);
    hintergrundZeichnen();
    deckkraft();
  }

  // Deckkraft je nach Auswahl und Überblendung. Busse haben keine Planlage und blenden zum Plan hin aus.
  function deckkraft() {
    if (!bereit) return;
    const hat = !!auswahl;
    const istGewaehlt = ['==', ['get', 'linie'], auswahl ?? ''];
    const b = busImPlan ? 1 : 1 - t; // Busse
    // Im Plan sind geschätzte Abschnitte (ausserhalb des Plans) blasser
    const basis = ansicht === 'plan' ? ['case', ['get', 'gs'], 0.45, 1] : 1;
    map.setPaintProperty('linien', 'line-opacity', hat ? ['case', istGewaehlt, basis, 0.12] : basis);
    map.setPaintProperty('busse', 'line-opacity', hat ? ['case', istGewaehlt, b, 0.12 * b] : b);
    // Dunkler Rand nur in der geografischen Karte (hebt die Busse von der Grundkarte ab), im Plan ohne
    const r = b * (1 - t);
    map.setPaintProperty('busse-rand', 'line-opacity', hat ? ['case', istGewaehlt, r, 0.12 * r] : r);
    const haltGewaehlt = ['in', auswahl ?? '§', ['get', 'linien']];
    const haltBasis = ['case', ['get', 'bus'], b, 1];
    map.setPaintProperty('halte', 'icon-opacity', hat ? ['case', haltGewaehlt, haltBasis, ['*', 0.25, haltBasis]] : haltBasis);
    // Namen: bei Auswahl alle Halte der Linie, sonst Endpunkte; reine Busnamen blenden im Plan aus
    map.setPaintProperty('halte-name', 'text-opacity', ['case', ['get', hat ? 'bus' : 'endBus'], b, 1]);
    map.setPaintProperty('neu', 'line-opacity', hat ? 0 : ['case', ['get', 'bus'], 0.55 * b, 0.55]);
    map.setPaintProperty('weg', 'line-opacity', hat ? 0 : ['case', ['get', 'bus'], 0.9 * b, 0.9]);
  }
  function auswahlAnwenden() {
    if (!bereit) return;
    const hat = !!auswahl;
    const istGewaehlt = ['==', ['get', 'linie'], auswahl ?? ''];
    for (const id of ['linien', 'busse-rand', 'busse']) map.setLayoutProperty(id, 'line-sort-key', hat ? ['case', istGewaehlt, 1, 0] : 0);
    const haltGewaehlt = ['in', auswahl ?? '§', ['get', 'linien']];
    map.setFilter('halte-name', hat ? haltGewaehlt : ['==', ['get', 'end'], true]);
    deckkraft();
  }

  $effect(() => {
    void datum; void vorjahrDatum; void gruppen;
    if (!bereit) return;
    inhaltBerechnen();
    zeichnen();
  });
  $effect(() => {
    void auswahl; void ansicht;
    auswahlAnwenden();
  });

  // Überblendung zwischen Karte und Plan
  let animation = 0;
  $effect(() => {
    const ziel = ansicht === 'plan' ? 1 : 0;
    if (!bereit || t === ziel) return;
    cancelAnimationFrame(animation);
    const start = t;
    const t0 = performance.now();
    const reduziert = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const schritt = (jetzt) => {
      const f = reduziert ? 1 : Math.min(1, (jetzt - t0) / DAUER);
      const e = f < 0.5 ? 4 * f * f * f : 1 - (-2 * f + 2) ** 3 / 2;
      t = f === 1 ? ziel : Math.min(1, Math.max(0, start + (ziel - start) * e));
      zeichnen();
      if (f < 1) animation = requestAnimationFrame(schritt);
    };
    animation = requestAnimationFrame(schritt);
  });

  // Bei Auswahl einer Linie auf alle ihre Linienwege (über alle Jahre) zoomen
  $effect(() => {
    if (!bereit || !auswahl) return;
    const imPlan = ansicht === 'plan';
    const b = [Infinity, Infinity, -Infinity, -Infinity];
    for (const v of netz.versionenProLinie.get(auswahl) ?? []) {
      for (const id of v.haltestellen) {
        const l = lage.get(id);
        const [x, y] = imPlan ? l.p : l.g;
        b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y);
        b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y);
      }
    }
    map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: polster(), maxZoom: 15, duration: 600 });
  });

  function startAusschnitt() {
    // Stadtgebiet Zürich (die Limmattalbahn reicht weit nach Westen), in der gerade gezeigten Ansicht
    const b = [Infinity, Infinity, -Infinity, -Infinity];
    for (const h of netz.haltestellen) {
      if (h.ort !== 'Zürich' || (t === 1 && h.planGeschaetzt)) continue;
      const [x, y] = t === 1 ? lage.get(h.id).p : lage.get(h.id).g;
      b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y);
      b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y);
    }
    return [[b[0], b[1]], [b[2], b[3]]];
  }

  onMount(() => {
    map = new maplibregl.Map({
      container,
      style: STIL,
      bounds: startAusschnitt(),
      fitBoundsOptions: { padding: polster() },
      attributionControl: {
        compact: true,
        customAttribution: 'Linien- und Hintergrunddaten © OpenStreetMap-Mitwirkende (ODbL), Wikipedia · Planlage nach ZVV-Liniennetzplan',
      },
      maxZoom: 18,
      // Eigene Beschriftungen in Barlow: Glyphen aus public/fonts (scripts/build-glyphs.mjs), Grundkarte unverändert
      transformRequest: (url, art) => {
        if (art !== 'Glyphs' || !url.includes('Barlow')) return undefined;
        const [, bereich] = url.match(/\/(\d+-\d+)\.pbf/) ?? [];
        return { url: new URL(`${import.meta.env.BASE_URL}fonts/barlow-medium/${bereich}.pbf`, location.href).href };
      },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    map.on('load', () => {
      // Grundkarte zurücknehmen, damit das Netz im Vordergrund steht
      for (const layer of map.getStyle().layers) {
        if (layer.type !== 'symbol') continue;
        if (/poi|transportation|road_number|housenumber/.test(layer.id)) map.setLayoutProperty(layer.id, 'visibility', 'none');
        else map.setPaintProperty(layer.id, 'text-opacity', 0.55);
      }
      for (const id of ['linien', 'neu', 'weg', 'halte']) map.addSource(id, { type: 'geojson', data: leer });

      // Papier über der Grundkarte: im Plan deckend, in der Karte unsichtbar
      map.addLayer({ id: 'papier', type: 'background', paint: { 'background-color': '#f5f5f2', 'background-opacity': t } });

      // Hintergrundflächen des Plans, vereinfacht und mit den Linien überblendet
      map.addSource('flaechen', { type: 'geojson', data: leer });
      map.addSource('fluesse', { type: 'geojson', data: leer });
      const flaeche = (art, farbe) =>
        map.addLayer({ id: `flaeche-${art}`, type: 'fill', source: 'flaechen', filter: ['==', ['get', 'art'], art], paint: { 'fill-color': farbe, 'fill-opacity': 0 } });
      flaeche('stadt', '#ffffff');
      flaeche('wald', '#e4e9de');
      flaeche('see', '#d3e5ef');
      map.addLayer({
        id: 'fluss', type: 'line', source: 'fluesse',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#d3e5ef', 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 4, 13, 8, 16, 22], 'line-opacity': 0 },
      });
      map.addLayer({
        id: 'stadtgrenze', type: 'line', source: 'flaechen', filter: ['==', ['get', 'art'], 'stadt'],
        layout: { 'line-join': 'round' },
        paint: { 'line-color': '#d6d6d0', 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 1, 16, 2], 'line-opacity': 0 },
      });
      fetch(`${import.meta.env.BASE_URL}data/hintergrund.json`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          hintergrund = d;
          hintergrundZeichnen();
        })
        .catch(() => {});
      map.addLayer({
        id: 'neu', type: 'line', source: 'neu',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#f2c94c', 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 10, 16, 30], 'line-blur': 2, 'line-opacity': 0.55 },
      });
      map.addLayer({
        id: 'weg', type: 'line', source: 'weg',
        paint: { 'line-color': '#7d7a73', 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 1.5, 16, 4], 'line-dasharray': [1.5, 1.5] },
      });
      map.addLayer({
        id: 'busse-rand', type: 'line', source: 'linien', filter: istBus,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#55524c', 'line-width': busBreite(1.6), 'line-offset': versatzMisch },
      });
      map.addLayer({
        id: 'busse', type: 'line', source: 'linien', filter: istBus,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': ['get', 'farbe'], 'line-width': busBreite(), 'line-offset': versatzMisch },
      });
      map.addLayer({
        id: 'linien', type: 'line', source: 'linien', filter: ['!', istBus],
        layout: { 'line-cap': 'butt', 'line-join': 'round' },
        paint: {
          'line-color': ['get', 'farbe'],
          'line-width': breite,
          'line-offset': versatzMisch,
          'line-dasharray': ['case', ['==', ['get', 'art'], 'baulinie'], ['literal', [2, 1]], ['literal', [1, 0]]],
        },
      });
      balkenBilder();
      map.addLayer({
        id: 'halte', type: 'symbol', source: 'halte',
        layout: {
          'icon-image': ['get', 'bild'],
          // Bildbreite folgt der Linienbreite (siehe «breite»)
          // Haltestellen nur mit Bus: Balken für die schmaleren Busstriche
          'icon-size': [
            'interpolate', ['linear'], ['zoom'],
            11, ['case', ['get', 'bus'], (BUS[0] + 1.2) / REF, 2 / REF],
            13, ['case', ['get', 'bus'], (BUS[1] + 1.4) / REF, 3.5 / REF],
            16, ['case', ['get', 'bus'], (BUS[2] + 1.8) / REF, 7 / REF],
          ],
          'icon-rotate': ['get', 'winkel'],
          'icon-rotation-alignment': 'map',
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
      });
      map.addLayer({
        id: 'halte-name', type: 'symbol', source: 'halte',
        filter: ['==', ['get', 'end'], true],
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Barlow Medium'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 11, 11, 16, 14],
          'text-offset': [0.8, 0],
          'text-anchor': 'left',
          'text-optional': true,
        },
        paint: { 'text-color': '#1d1d1b', 'text-halo-color': '#ffffff', 'text-halo-width': 1.6 },
      });

      const tip = new maplibregl.Popup({ closeButton: false, closeOnClick: false, className: 'linien-tip', offset: 8 });
      // Busse sind im Plan ausgeblendet und dann nicht anwählbar
      const ebenen = () => (busImPlan || t < 0.5 ? ['linien', 'busse'] : ['linien']);
      map.on('mousemove', (ev) => {
        const f = map.queryRenderedFeatures(ev.point, { layers: ebenen() });
        if (!f.length) {
          map.getCanvas().style.cursor = '';
          tip.remove();
          return;
        }
        map.getCanvas().style.cursor = 'pointer';
        const nummern = [...new Set(f.map((x) => x.properties.nummer))];
        tip.setLngLat(ev.lngLat).setHTML(nummern.map((n) => `<b>${n}</b>`).join(' ')).addTo(map);
      });
      map.on('mouseout', () => tip.remove());
      map.on('click', (ev) => {
        const r = 6; // Trefferradius in Pixeln
        const f = map.queryRenderedFeatures([[ev.point.x - r, ev.point.y - r], [ev.point.x + r, ev.point.y + r]], { layers: ebenen() });
        // Bei Auswahl hat die gewählte Linie Vorrang, sonst die oberste
        const treffer = f.find((x) => x.properties.linie === auswahl) ?? f[0];
        onlinie?.(treffer ? treffer.properties.linie : null);
      });

      map.resize();
      map.fitBounds(startAusschnitt(), { padding: polster(), animate: false });

      bereit = true;
    });

    // Grösse nachführen, falls sich das Layout nach dem Start noch ändert
    const ro = new ResizeObserver(() => map.resize());
    ro.observe(container);

    return () => {
      cancelAnimationFrame(animation);
      ro.disconnect();
      map.remove();
    };
  });
</script>

<div class="karte" bind:this={container}></div>

<style>
  .karte {
    position: absolute;
    inset: 0;
  }
  :global(.linien-tip .maplibregl-popup-content) {
    padding: 4px 8px;
    font: 600 13px/1.2 var(--schrift);
    border-radius: 4px;
    box-shadow: 0 2px 6px rgb(0 0 0 / 0.15);
  }
  :global(.linien-tip b) {
    margin-right: 4px;
  }
</style>
