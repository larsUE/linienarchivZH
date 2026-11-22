<script>
  import { onMount } from 'svelte';
  import maplibregl from 'maplibre-gl';
  import { zustand, halteAm } from './netz.js';

  let { netz, datum, vorjahrDatum, auswahl = null, onlinie } = $props();

  let container;
  let map = $state(null);
  let bereit = $state(false);

  // Platz für die Seitenleiste lassen (nur bei breitem Layout überlagert sie die Karte)
  const polster = () =>
    container.clientWidth > 700 ? { top: 30, bottom: 30, left: 390, right: 30 } : { top: 20, bottom: 20, left: 20, right: 20 };

  const STIL = 'https://vectortiles.geo.admin.ch/styles/ch.swisstopo.lightbasemap.vt/style.json';
  const leer = { type: 'FeatureCollection', features: [] };

  // Linienbreite und Versatz paralleler Linien in Pixeln, abhängig vom Zoom
  const breite = ['interpolate', ['linear'], ['zoom'], 11, 2, 13, 3.5, 16, 7];
  const versatz = ['interpolate', ['linear'], ['zoom'], 11, ['*', ['get', 'slot'], 2], 13, ['*', ['get', 'slot'], 3.5], 16, ['*', ['get', 'slot'], 7]];

  /** Ein Feature pro (Abschnitt, Linie). Linien auf demselben Abschnitt liegen nebeneinander. */
  function linienFeatures(proLinie) {
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
    const features = [];
    for (const [id, eintraege] of proKante) {
      const kante = netz.kanteById.get(id);
      eintraege.sort((a, b) => netz.linieById.get(a.linie).rang - netz.linieById.get(b.linie).rang);
      // Ausrichtung wie die erste Linie: so bleibt die Reihenfolge entlang gemeinsamer Stammstrecken stabil
      const coords = eintraege[0].rueck ? [...kante.coords].reverse() : kante.coords;
      const n = eintraege.length;
      eintraege.forEach((e, i) => {
        const l = netz.linieById.get(e.linie);
        features.push({
          type: 'Feature',
          properties: { kante: id, linie: l.id, nummer: l.nummer, farbe: l.farbe, art: l.art, slot: i - (n - 1) / 2 },
          geometry: { type: 'LineString', coordinates: coords },
        });
      });
    }
    return { features, kanten: new Set(proKante.keys()) };
  }

  function aktualisieren() {
    if (!bereit) return;
    const jetzt = zustand(netz, datum);
    const vorher = vorjahrDatum ? zustand(netz, vorjahrDatum) : null;
    const { features, kanten } = linienFeatures(jetzt);

    // Abschnitte, die seit dem Vorjahr dazugekommen oder weggefallen sind
    const vorherKanten = vorher ? linienFeatures(vorher).kanten : kanten;
    const neu = [...kanten].filter((k) => !vorherKanten.has(k));
    const weg = [...vorherKanten].filter((k) => !kanten.has(k));
    const alsFeature = (id) => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: netz.kanteById.get(id).coords } });

    const halteJetzt = new Map();
    for (const v of jetzt.values()) {
      const ids = halteAm(v, datum);
      ids.forEach((id, i) => {
        const end = i === 0 || i === ids.length - 1;
        const h = halteJetzt.get(id) ?? { linien: [], end: false };
        h.linien.push(v.linie);
        h.end ||= end;
        halteJetzt.set(id, h);
      });
    }
    const halteFeatures = [...halteJetzt].map(([id, h]) => {
      const s = netz.haltestelleById.get(id);
      return {
        type: 'Feature',
        properties: { id, name: s.name, end: h.end, linien: h.linien.join(' ') },
        geometry: { type: 'Point', coordinates: [s.lon, s.lat] },
      };
    });

    map.getSource('linien').setData({ type: 'FeatureCollection', features });
    map.getSource('neu').setData({ type: 'FeatureCollection', features: neu.map(alsFeature) });
    map.getSource('weg').setData({ type: 'FeatureCollection', features: weg.map(alsFeature) });
    map.getSource('halte').setData({ type: 'FeatureCollection', features: halteFeatures });
  }

  function auswahlAnwenden() {
    if (!bereit) return;
    const hat = !!auswahl;
    const istGewaehlt = ['==', ['get', 'linie'], auswahl ?? ''];
    map.setPaintProperty('linien', 'line-opacity', hat ? ['case', istGewaehlt, 1, 0.12] : 1);
    map.setLayoutProperty('linien', 'line-sort-key', hat ? ['case', istGewaehlt, 1, 0] : 0);
    const haltGewaehlt = ['in', auswahl ?? '§', ['get', 'linien']];
    map.setPaintProperty('halte', 'circle-opacity', hat ? ['case', haltGewaehlt, 1, 0.25] : 1);
    map.setPaintProperty('halte', 'circle-stroke-opacity', hat ? ['case', haltGewaehlt, 1, 0.25] : 1);
    map.setFilter('halte-name', hat ? haltGewaehlt : ['==', ['get', 'end'], true]);
    map.setLayoutProperty('halte-name', 'visibility', 'visible');
    map.setPaintProperty('neu', 'line-opacity', hat ? 0 : 0.55);
    map.setPaintProperty('weg', 'line-opacity', hat ? 0 : 0.9);
  }

  $effect(() => {
    void datum; void vorjahrDatum;
    aktualisieren();
    auswahlAnwenden();
  });
  $effect(() => {
    void auswahl;
    auswahlAnwenden();
  });

  // Bei Auswahl einer Linie auf alle ihre Linienwege (über alle Jahre) zoomen
  $effect(() => {
    if (!bereit || !auswahl) return;
    const b = [Infinity, Infinity, -Infinity, -Infinity];
    for (const v of netz.versionenProLinie.get(auswahl) ?? []) {
      for (const id of v.haltestellen) {
        const h = netz.haltestelleById.get(id);
        b[0] = Math.min(b[0], h.lon); b[1] = Math.min(b[1], h.lat);
        b[2] = Math.max(b[2], h.lon); b[3] = Math.max(b[3], h.lat);
      }
    }
    map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: polster(), maxZoom: 15, duration: 600 });
  });

  onMount(() => {
    // Startansicht: Stadtgebiet Zürich (die Limmattalbahn reicht weit nach Westen)
    const [w, s, e, n] = netz.haltestellen
      .filter((h) => h.ort === 'Zürich')
      .reduce(
        (b, h) => [Math.min(b[0], h.lon), Math.min(b[1], h.lat), Math.max(b[2], h.lon), Math.max(b[3], h.lat)],
        [Infinity, Infinity, -Infinity, -Infinity],
      );
    map = new maplibregl.Map({
      container,
      style: STIL,
      bounds: [[w, s], [e, n]],
      fitBoundsOptions: { padding: polster() },
      attributionControl: { compact: true, customAttribution: 'Liniendaten © OpenStreetMap-Mitwirkende (ODbL), Wikipedia' },
      maxZoom: 18,
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
          'text-font': ['Frutiger Neue Regular'],
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
        const t = 6; // Trefferradius in Pixeln
        const f = map.queryRenderedFeatures([[ev.point.x - t, ev.point.y - t], [ev.point.x + t, ev.point.y + t]], { layers: ['linien'] });
        // Bei Auswahl hat die gewählte Linie Vorrang, sonst die oberste
        const treffer = f.find((x) => x.properties.linie === auswahl) ?? f[0];
        onlinie?.(treffer ? treffer.properties.linie : null);
      });

      map.resize();
      map.fitBounds([[w, s], [e, n]], { padding: polster(), animate: false });

      bereit = true;
      aktualisieren();
      auswahlAnwenden();
    });

    // Grösse nachführen, falls sich das Layout nach dem Start noch ändert
    const ro = new ResizeObserver(() => map.resize());
    ro.observe(container);

    return () => {
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
