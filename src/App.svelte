<script>
  import { onMount } from 'svelte';
  import Karte from './lib/Karte.svelte';
  import Zeitstrahl from './lib/Zeitstrahl.svelte';
  import Uebersicht from './lib/Uebersicht.svelte';
  import LinienPanel from './lib/LinienPanel.svelte';
  import { ladeNetz, stichtag, aenderungen } from './lib/netz.js';

  let netz = $state(null);
  let fehler = $state(null);
  let jahr = $state(null);
  let auswahl = $state(null);
  let ansicht = $state('plan'); // 'plan' oder 'karte'
  let filter = $state('tram'); // 'tram', 'bus' oder 'alle'
  let spielt = $state(false);
  const gruppen = $derived(filter === 'alle' ? ['tram', 'bus'] : [filter]);

  const datum = $derived(netz && jahr ? stichtag(netz, jahr) : null);
  const vorjahrDatum = $derived(netz && jahr && jahr > netz.jahre[0] ? stichtag(netz, jahr - 1) : null);
  const aenderungenJahr = $derived(netz && jahr ? aenderungen(netz, jahr, gruppen) : []);
  const anzahlAenderungen = $derived(
    netz ? new Map(netz.jahre.slice(1).map((j) => [j, aenderungen(netz, j, gruppen).length])) : new Map(),
  );
  const mitBus = $derived(!!netz?.erfasstAb.bus);

  // Zustand in der URL: #/plan/2018, #/karte/bus/2018/bus-33 (Tram ohne Filterteil; ältere Links ohne Ansicht: #/2018/tram-8)
  const ANSICHTEN = ['plan', 'karte'];
  const FILTER = ['tram', 'bus', 'alle'];
  function ausHash() {
    const teile = location.hash.split('/').slice(1);
    if (ANSICHTEN.includes(teile[0])) ansicht = teile.shift();
    filter = FILTER.includes(teile[0]) ? teile.shift() : 'tram';
    if (!mitBus) filter = 'tram';
    const [j, l] = teile;
    const n = Number(j);
    jahr = netz.jahre.includes(n) ? n : netz.jahre.at(-1);
    auswahl = null;
    if (l && netz.linieById.has(l)) waehle(l);
  }
  $effect(() => {
    if (!netz || !jahr) return;
    const ziel = `#/${ansicht}${filter === 'tram' ? '' : '/' + filter}/${jahr}${auswahl ? '/' + auswahl : ''}`;
    if (location.hash !== ziel) history.replaceState(null, '', ziel);
  });

  // Eine Linie öffnen und den Filter erweitern. Busse ohne Planlage (ältere Daten) geografisch zeigen.
  function waehle(id) {
    auswahl = id;
    if (!id) return;
    const g = netz.linieById.get(id).gruppe;
    if (!gruppen.includes(g)) filter = 'alle';
    if (g === 'bus' && !netz.meta.plan?.busse) ansicht = 'karte';
  }

  let timer;
  function spielen() {
    spielt = !spielt;
    clearInterval(timer);
    if (!spielt) return;
    if (jahr === netz.jahre.at(-1)) jahr = netz.jahre[0];
    timer = setInterval(() => {
      const i = netz.jahre.indexOf(jahr);
      if (i >= netz.jahre.length - 1) { spielt = false; clearInterval(timer); return; }
      jahr = netz.jahre[i + 1];
    }, 1400);
  }
  function setzeJahr(j) {
    if (spielt) spielen();
    jahr = j;
  }

  function taste(ev) {
    if (!netz || ev.metaKey || ev.ctrlKey || ev.altKey || ev.target.closest?.('input, textarea')) return;
    const i = netz.jahre.indexOf(jahr);
    if (ev.key === 'ArrowLeft' && i > 0) setzeJahr(netz.jahre[i - 1]);
    else if (ev.key === 'ArrowRight' && i < netz.jahre.length - 1) setzeJahr(netz.jahre[i + 1]);
    else if (ev.key === 'Escape') auswahl = null;
    else if (ev.key === 'p' || ev.key === 'g') ansicht = ev.key === 'p' ? 'plan' : 'karte';
    else return;
    ev.preventDefault();
  }

  onMount(async () => {
    try {
      netz = await ladeNetz();
      ausHash();
    } catch (e) {
      fehler = e.message;
    }
    window.addEventListener('hashchange', ausHash);
    return () => window.removeEventListener('hashchange', ausHash);
  });
</script>

<svelte:window onkeydown={taste} />

{#if fehler}
  <p class="fehler">{fehler}</p>
{:else if netz && jahr}
  <div class="app">
    <main class="kartenflaeche">
      <Karte {netz} {datum} {vorjahrDatum} {auswahl} {ansicht} {gruppen} onlinie={waehle} />
    </main>

    <aside class="seitenleiste">
      <div class="kopf">
        <h1>Linienarchiv Zürich</h1>
        <p>Tram {netz.jahre[0]}–{netz.jahre.at(-1)}{#if mitBus} · Bus ab {netz.erfasstAb.bus}{/if} · Pilot</p>
        <div class="ansicht" role="group" aria-label="Kartenansicht">
          <button aria-pressed={ansicht === 'plan'} class:aktiv={ansicht === 'plan'} onclick={() => (ansicht = 'plan')}>Liniennetzplan</button>
          <button aria-pressed={ansicht === 'karte'} class:aktiv={ansicht === 'karte'} onclick={() => (ansicht = 'karte')}>Geografisch</button>
        </div>
      </div>
      <div class="inhalt">
        {#if auswahl}
          <LinienPanel {netz} linieId={auswahl} {jahr} {datum} onjahr={setzeJahr} onschliessen={() => (auswahl = null)} />
        {:else}
          <Uebersicht
            {netz}
            {jahr}
            {datum}
            {filter}
            {gruppen}
            {ansicht}
            aenderungen={aenderungenJahr}
            onfilter={(f) => (filter = f)}
            onkarte={() => (ansicht = 'karte')}
            onlinie={waehle}
          />
        {/if}
      </div>
    </aside>

    <footer class="zeitleiste">
      <Zeitstrahl jahre={netz.jahre} {jahr} {anzahlAenderungen} {spielt} onjahr={setzeJahr} onspielen={spielen} />
    </footer>
  </div>
{:else}
  <p class="laden">Netz wird geladen …</p>
{/if}

<style>
  .app {
    position: fixed;
    inset: 0;
    display: grid;
    grid-template-columns: 360px 1fr;
    grid-template-rows: 1fr auto;
    grid-template-areas: 'seite karte' 'zeit zeit';
  }
  .kartenflaeche {
    grid-area: karte;
    position: relative;
    grid-column: 1 / -1;
    grid-row: 1;
  }
  .seitenleiste {
    grid-area: seite;
    z-index: 2;
    margin: 12px 0 12px 12px;
    background: var(--papier);
    border: 1px solid var(--rand);
    border-radius: 8px;
    box-shadow: 0 4px 18px rgb(0 0 0 / 0.08);
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }
  .kopf {
    padding: 16px 18px 14px;
    border-bottom: 1px solid var(--rand);
  }
  h1 {
    margin: 0;
    font-size: 20px;
    letter-spacing: -0.01em;
  }
  .kopf p {
    margin: 2px 0 12px;
    color: var(--grau);
    font-size: 13px;
  }
  .ansicht {
    display: grid;
    grid-template-columns: 1fr 1fr;
    background: #ebe8e1;
    border-radius: 6px;
    padding: 3px;
  }
  .ansicht button {
    border: 0;
    background: none;
    padding: 6px 8px;
    border-radius: 4px;
    font: 600 13px var(--schrift);
    color: var(--tinte);
  }
  .ansicht button.aktiv {
    background: white;
    box-shadow: 0 1px 2px rgb(0 0 0 / 0.12);
  }
  .ansicht button {
    cursor: pointer;
  }
  .ansicht button:not(.aktiv):hover {
    background: rgb(255 255 255 / 0.5);
  }
  .inhalt {
    overflow-y: auto;
    min-height: 0;
  }
  .zeitleiste {
    grid-area: zeit;
    z-index: 2;
  }
  .laden,
  .fehler {
    padding: 24px;
  }
  .fehler {
    color: var(--unsicher);
  }
  @media (max-width: 700px) {
    .app {
      grid-template-columns: 1fr;
      grid-template-rows: 45vh 1fr auto;
      grid-template-areas: 'karte' 'seite' 'zeit';
    }
    .kartenflaeche {
      grid-column: 1;
      grid-row: 1;
    }
    .seitenleiste {
      margin: 0;
      border-radius: 0;
      border-width: 1px 0 0;
      box-shadow: none;
    }
  }
</style>
