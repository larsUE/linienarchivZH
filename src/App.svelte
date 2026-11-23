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
  let spielt = $state(false);

  const datum = $derived(netz && jahr ? stichtag(netz, jahr) : null);
  const vorjahrDatum = $derived(netz && jahr && jahr > netz.jahre[0] ? stichtag(netz, jahr - 1) : null);
  const aenderungenJahr = $derived(netz && jahr ? aenderungen(netz, jahr) : []);
  const anzahlAenderungen = $derived(
    netz ? new Map(netz.jahre.slice(1).map((j) => [j, aenderungen(netz, j).length])) : new Map(),
  );

  // Zustand in der URL: #/plan/2018 oder #/karte/2018/tram-8 (ältere Links ohne Ansicht: #/2018/tram-8)
  const ANSICHTEN = ['plan', 'karte'];
  function ausHash() {
    const teile = location.hash.split('/').slice(1);
    if (ANSICHTEN.includes(teile[0])) ansicht = teile.shift();
    const [j, l] = teile;
    const n = Number(j);
    jahr = netz.jahre.includes(n) ? n : netz.jahre.at(-1);
    auswahl = l && netz.linieById.has(l) ? l : null;
  }
  $effect(() => {
    if (!netz || !jahr) return;
    const ziel = `#/${ansicht}/${jahr}${auswahl ? '/' + auswahl : ''}`;
    if (location.hash !== ziel) history.replaceState(null, '', ziel);
  });

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
      <Karte {netz} {datum} {vorjahrDatum} {auswahl} {ansicht} onlinie={(id) => (auswahl = id)} />
    </main>

    <aside class="seitenleiste">
      <div class="kopf">
        <div>
          <h1>Linienarchiv Zürich</h1>
          <p>Tramnetz {netz.jahre[0]}–{netz.jahre.at(-1)}, Pilot</p>
        </div>
        <div class="ansicht" role="group" aria-label="Kartenansicht">
          <button aria-pressed={ansicht === 'plan'} onclick={() => (ansicht = 'plan')} title="Taste P">Plan</button>
          <button aria-pressed={ansicht === 'karte'} onclick={() => (ansicht = 'karte')} title="Taste G">Karte</button>
        </div>
      </div>
      <div class="inhalt">
        {#if auswahl}
          <LinienPanel {netz} linieId={auswahl} {jahr} {datum} onjahr={setzeJahr} onschliessen={() => (auswahl = null)} />
        {:else}
          <Uebersicht {netz} {jahr} {datum} aenderungen={aenderungenJahr} onlinie={(id) => (auswahl = id)} />
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
    grid-template-columns: var(--seite) 1fr;
    grid-template-rows: minmax(0, 1fr) auto;
    grid-template-areas: 'seite karte' 'zeit zeit';
  }
  .kartenflaeche {
    grid-area: karte;
    position: relative;
  }
  .seitenleiste {
    grid-area: seite;
    background: var(--papier);
    border-right: 1px solid var(--rand);
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  .kopf {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    padding: 18px var(--innen) 16px;
  }
  h1 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    line-height: 1.2;
  }
  .kopf p {
    margin: 2px 0 0;
    color: var(--grau);
    font-size: 13px;
  }
  /* Ansicht: zwei Wörter, das gewählte unterstrichen */
  .ansicht {
    display: flex;
    gap: 14px;
    padding-top: 2px;
  }
  .ansicht button {
    border: 0;
    background: none;
    padding: 2px 0;
    font: 500 14px var(--schrift);
    color: var(--grau);
    cursor: pointer;
    border-bottom: 2px solid transparent;
  }
  .ansicht button:hover {
    color: var(--tinte);
  }
  .ansicht button[aria-pressed='true'] {
    color: var(--tinte);
    border-bottom-color: var(--tinte);
  }
  .inhalt {
    overflow-y: auto;
    min-height: 0;
    flex: 1;
  }
  .zeitleiste {
    grid-area: zeit;
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
      grid-template-rows: 45vh minmax(0, 1fr) auto;
      grid-template-areas: 'karte' 'seite' 'zeit';
    }
    .seitenleiste {
      border-right: 0;
      border-top: 1px solid var(--rand);
    }
  }
</style>
