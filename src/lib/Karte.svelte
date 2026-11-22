<script>
  import { onMount } from 'svelte';
  import maplibregl from 'maplibre-gl';
  import { zustand, halteAm } from './netz.js';

  let { netz, datum, vorjahrDatum, auswahl = null, ansicht = 'plan', onlinie } = $props();

  let container;
  let map = $state(null);
  let bereit = $state(false);

  // Platz für die Seitenleiste lassen (nur bei breitem Layout überlagert sie die Karte)
  const polster = () =>
    container.clientWidth > 700 ? { top: 30, bottom: 30, left: 390, right: 30 } : { top: 20, bottom: 20, left: 20, right: 20 };

  const STIL = 'https://vectortiles.geo.admin.ch/styles/ch.swisstopo.lightbasemap.vt/style.json';
  const leer = { type: 'FeatureCollection', features: [] };
  const DAUER = 900; // Überblendung in ms

  // Linienbreite und Versatz paralleler Linien in Pixeln, abhängig vom Zoom
  const breite = ['interpolate', ['linear'], ['zoom'], 11, 2, 13, 3.5, 16, 7];
  const versatz = ['interpolate', ['linear'], ['zoom'], 11, ['*', ['get', 'slot'], 2], 13, ['*', ['get', 'slot'], 3.5], 16, ['*', ['get', 'slot'], 7]];

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
  const geom = new Map(netz.kanten.map((k) => [k.id, { ...angleichen(k.coords, k.planCoords ?? k.coords), geschaetzt: !!k.planGeschaetzt }]));
  const lage = new Map(netz.haltestellen.map((h) => [h.id, { g: [h.lon, h.lat], p: h.plan ?? [h.lon, h.lat] }]));

  // Überblendungsgrad: 0 = geografisch, 1 = Plan
  let t = ansicht === 'plan' ? 1 : 0;
  const mischen = (a, b) => (t === 0 ? a : t === 1 ? b : [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  function linienzug(id, rueck = false) {
    const { g, p } = geom.get(id);
    const c = t === 0 ? g : t === 1 ? p : g.map((x, i) => mischen(x, p[i]));
    return rueck ? [...c].reverse() : c;
  }
  const punkt = (id) => {
    const l = lage.get(id);
    return mischen(l.g, l.p);
  };

  // ---------- Inhalt je Stichtag (unabhängig von der Ansicht) ----------
  let inhalt = null;

  /** Ein Eintrag pro (Abschnitt, Linie). Linien auf demselben Abschnitt liegen nebeneinander. */
  function linienEintraege(proLinie) {
    const proKante = new Map();
    for (const v of proLinie.values()) {
      for (const signiert of v.kanten) {
        const rueck = signiert.startsWith('-');
        const id = rueck ? signiert.slice(1) : signiert;
        if (!proKante.has(id)) proKante.set(id, []);
        const liste = proKante.get(id);
        if (!liste.some((e) => e.linie === v.linie)) liste.push({ linie: v.linie, rueck });
      }
    }
    const eintraege = [];
    for (const [id, liste] of proKante) {
      liste.sort((a, b) => netz.linieById.get(a.linie).rang - netz.linieById.get(b.linie).rang);
      // Ausrichtung wie die erste Linie: so bleibt die Reihenfolge entlang gemeinsamer Stammstrecken stabil
      const rueck = liste[0].rueck;
      const n = liste.length;
      liste.forEach((e, i) => {
        const l = netz.linieById.get(e.linie);
        eintraege.push({
          kante: id,
          rueck,
          properties: { kante: id, linie: l.id, nummer: l.nummer, farbe: l.farbe, art: l.art, slot: i - (n - 1) / 2, gs: geom.get(id).geschaetzt },
        });
      });
    }
    return { eintraege, kanten: new Set(proKante.keys()) };
  }

  function inhaltBerechnen() {
    const jetzt = zustand(netz, datum);
    const vorher = vorjahrDatum ? zustand(netz, vorjahrDatum) : null;
    const { eintraege, kanten } = linienEintraege(jetzt);
    const vorherKanten = vorher ? linienEintraege(vorher).kanten : kanten;

    const halte = new Map();
    for (const v of jetzt.values()) {
      const ids = halteAm(v, datum);
      ids.forEach((id, i) => {
        const end = i === 0 || i === ids.length - 1;
        const h = halte.get(id) ?? { linien: [], end: false };
        h.linien.push(v.linie);
        h.end ||= end;
        halte.set(id, h);
      });
    }
    inhalt = {
      linien: eintraege,
      neu: [...kanten].filter((k) => !vorherKanten.has(k)),
      weg: [...vorherKanten].filter((k) => !kanten.has(k)),
      halte: [...halte].map(([id, h]) => ({ id, properties: { id, name: netz.haltestelleById.get(id).name, end: h.end, linien: h.linien.join(' ') } })),
    };
  }

  // ---------- Zeichnen mit dem aktuellen Überblendungsgrad ----------
  function zeichnen() {
    if (!bereit || !inhalt) return;
    const fc = (features) => ({ type: 'FeatureCollection', features });
    const linie = (id, rueck, properties = {}) => ({ type: 'Feature', properties, geometry: { type: 'LineString', coordinates: linienzug(id, rueck) } });
    map.getSource('linien').setData(fc(inhalt.linien.map((e) => linie(e.kante, e.rueck, e.properties))));
    map.getSource('neu').setData(fc(inhalt.neu.map((id) => linie(id))));
    map.getSource('weg').setData(fc(inhalt.weg.map((id) => linie(id))));
    map.getSource('halte').setData(
      fc(inhalt.halte.map((h) => ({ type: 'Feature', properties: h.properties, geometry: { type: 'Point', coordinates: punkt(h.id) } }))),
    );
    map.setPaintProperty('papier', 'background-opacity', t);
  }

  function auswahlAnwenden() {
    if (!bereit) return;
    const hat = !!auswahl;
    const istGewaehlt = ['==', ['get', 'linie'], auswahl ?? ''];
    // Im Plan sind geschätzte Abschnitte (ausserhalb des Plans) blasser
    const basis = ansicht === 'plan' ? ['case', ['get', 'gs'], 0.45, 1] : 1;
    map.setPaintProperty('linien', 'line-opacity', hat ? ['case', istGewaehlt, basis, 0.12] : basis);
    map.setLayoutProperty('linien', 'line-sort-key', hat ? ['case', istGewaehlt, 1, 0] : 0);
    const haltGewaehlt = ['in', auswahl ?? '§', ['get', 'linien']];
    map.setPaintProperty('halte', 'circle-opacity', hat ? ['case', haltGewaehlt, 1, 0.25] : 1);
    map.setPaintProperty('halte', 'circle-stroke-opacity', hat ? ['case', haltGewaehlt, 1, 0.25] : 1);
    map.setFilter('halte-name', hat ? haltGewaehlt : ['==', ['get', 'end'], true]);
    map.setPaintProperty('neu', 'line-opacity', hat ? 0 : 0.55);
    map.setPaintProperty('weg', 'line-opacity', hat ? 0 : 0.9);
  }

  $effect(() => {
    void datum; void vorjahrDatum;
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
        customAttribution: 'Liniendaten © OpenStreetMap-Mitwirkende (ODbL), Wikipedia · Planlage nach ZVV-Liniennetzplan',
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
      map.addLayer({ id: 'papier', type: 'background', paint: { 'background-color': '#f8f6f1', 'background-opacity': t } });
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
        id: 'linien', type: 'line', source: 'linien',
        layout: { 'line-cap': 'butt', 'line-join': 'round' },
        paint: {
          'line-color': ['get', 'farbe'],
          'line-width': breite,
          'line-offset': versatz,
          'line-dasharray': ['case', ['==', ['get', 'art'], 'baulinie'], ['literal', [2, 1]], ['literal', [1, 0]]],
        },
      });
      map.addLayer({
        id: 'halte', type: 'circle', source: 'halte',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, ['case', ['get', 'end'], 3.5, 2], 16, ['case', ['get', 'end'], 9, 6]],
          'circle-color': '#ffffff',
          'circle-stroke-color': '#1d1d1b',
          'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 11, 1, 16, 2],
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
      map.on('mousemove', 'linien', (ev) => {
        map.getCanvas().style.cursor = 'pointer';
        const nummern = [...new Set(ev.features.map((f) => f.properties.nummer))];
        tip.setLngLat(ev.lngLat).setHTML(nummern.map((n) => `<b>${n}</b>`).join(' ')).addTo(map);
      });
      map.on('mouseleave', 'linien', () => {
        map.getCanvas().style.cursor = '';
        tip.remove();
      });
      map.on('click', (ev) => {
        const r = 6; // Trefferradius in Pixeln
        const f = map.queryRenderedFeatures([[ev.point.x - r, ev.point.y - r], [ev.point.x + r, ev.point.y + r]], { layers: ['linien'] });
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
