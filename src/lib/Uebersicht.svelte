<script>
  import LinienBadge from './LinienBadge.svelte';
  import { zustand, halteAm } from './netz.js';

  let { netz, jahr, datum, aenderungen, onlinie } = $props();

  const aktiv = $derived(zustand(netz, datum));
  const linien = $derived(netz.linien.filter((l) => aktiv.has(l.id)));
  const anzahlHalte = $derived(new Set([...aktiv.values()].flatMap((v) => halteAm(v, datum))).size);

  // Änderungen nach Art gruppiert, damit die Art nur einmal dasteht
  const ARTEN = [
    ['neu', 'Neue Linien'],
    ['eingestellt', 'Eingestellt'],
    ['geändert', 'Linienweg geändert'],
  ];
  const gruppen = $derived(
    ARTEN.map(([art, titel]) => ({ art, titel, liste: aenderungen.filter((a) => a.art === art) })).filter((g) => g.liste.length),
  );
</script>

<section class="panel">
  <div class="block">
    <h2>Am 1. Juli {jahr}</h2>
    <p class="still">{linien.length} Linien, {anzahlHalte} Haltestellen</p>
    <div class="badges">
      {#each linien as l (l.id)}
        <button onclick={() => onlinie(l.id)} aria-label="Linie {l.nummer} öffnen"><LinienBadge linie={l} /></button>
      {/each}
    </div>
  </div>

  <div class="block">
    <h2>Gegenüber {jahr - 1}</h2>
    {#if jahr === netz.jahre[0]}
      <p class="still">Beginn des Erfassungszeitraums.</p>
    {:else if aenderungen.length === 0}
      <p class="still">Keine Änderungen am Linienweg.</p>
    {:else}
      {#each gruppen as g (g.art)}
        <h3>{g.titel}</h3>
        <ul class="aenderungen">
          {#each g.liste as a (a.linie)}
            <li>
              <button onclick={() => onlinie(a.linie)}>
                <LinienBadge linie={netz.linieById.get(a.linie)} />
                <span class="notiz">
                  {#if a.art !== 'eingestellt' && a.version.notiz}{a.version.notiz}{/if}
                </span>
              </button>
            </li>
          {/each}
        </ul>
      {/each}
    {/if}
  </div>

  <div class="block legende">
    <p><span class="muster neu"></span>Neu seit dem Vorjahr</p>
    <p><span class="muster weg"></span>Seit dem Vorjahr nicht mehr befahren</p>
    <p><span class="muster bau"></span>Baulinie</p>
    <p class="hinweis">Linie anklicken für ihren Verlauf. Pfeiltasten wechseln das Jahr, P und G die Ansicht.</p>
  </div>
</section>

<style>
  .panel {
    padding-bottom: 8px;
  }
  .block {
    padding: 0 var(--innen) 24px;
  }
  h2 {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
  }
  h3 {
    margin: 14px 0 8px;
    font-size: 13px;
    font-weight: 500;
    color: var(--grau);
  }
  p {
    margin: 0;
    font-size: 13px;
  }
  .still {
    color: var(--grau);
  }
  .badges {
    display: grid;
    grid-template-columns: repeat(auto-fill, 30px);
    gap: 6px;
    margin-top: 12px;
  }
  .badges button,
  .aenderungen button {
    border: 0;
    background: none;
    padding: 0;
    cursor: pointer;
    font: inherit;
    color: inherit;
    text-align: left;
  }
  .badges button :global(.badge) {
    width: 100%;
  }
  .aenderungen {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 8px;
  }
  .aenderungen button {
    display: grid;
    grid-template-columns: 30px 1fr;
    gap: 10px;
    align-items: start;
    width: 100%;
    font-size: 13px;
    line-height: 1.4;
  }
  .notiz {
    padding-top: 1px;
  }
  .aenderungen button:hover .notiz {
    text-decoration: underline;
    text-decoration-color: var(--hell);
    text-underline-offset: 2px;
  }
  .legende {
    display: grid;
    gap: 4px;
    padding-top: 16px;
    border-top: 1px solid var(--rand);
    margin: 0 var(--innen);
    padding-left: 0;
    padding-right: 0;
    color: var(--grau);
  }
  .muster {
    display: inline-block;
    width: 22px;
    height: 6px;
    vertical-align: middle;
    margin-right: 8px;
    border-radius: 3px;
  }
  .muster.neu {
    background: var(--neu);
    opacity: 0.7;
  }
  .muster.weg {
    height: 0;
    border-top: 2px dashed var(--hell);
    border-radius: 0;
  }
  .muster.bau {
    height: 0;
    border-top: 3px dashed var(--grau);
    border-radius: 0;
  }
  .hinweis {
    margin-top: 8px;
    font-size: 12px;
  }
</style>
