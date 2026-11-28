<script>
  import LinienBadge from './LinienBadge.svelte';
  import { zustand, halteAm, erfasst, GRUPPEN, trolleybusAm } from './netz.js';

  let { netz, jahr, datum, filter, gruppen, ansicht, aenderungen, onfilter, onkarte, onlinie } = $props();

  const aktiv = $derived(zustand(netz, datum, gruppen));
  const linien = $derived(netz.linien.filter((l) => aktiv.has(l.id)));
  const anzahlHalte = $derived(new Set([...aktiv.values()].flatMap((v) => halteAm(v, datum))).size);
  const TITEL = { tram: 'Tramnetz', bus: 'Busnetz', alle: 'Tram- und Busnetz' };
  const mitBus = $derived(!!netz.erfasstAb.bus);
  const busFehlt = $derived(gruppen.includes('bus') && !erfasst(netz, 'bus', jahr));
  // Im Vorjahr noch nicht erfasste Verkehrsmittel: kein Vergleich möglich
  const ohneVergleich = $derived(gruppen.filter((g) => !erfasst(netz, g, jahr - 1)));

  // Änderungen nach Art gruppiert, damit die Art nur einmal dasteht
  const ARTEN = [
    ['neu', 'Neue Linien'],
    ['eingestellt', 'Eingestellt'],
    ['geändert', 'Linienweg geändert'],
    ['umgestellt', 'Umgestellt'],
  ];
  // Buslinien getrennt nach Trolleybus und Autobus
  const unterGruppen = (g, liste) =>
    g !== 'bus'
      ? [{ titel: GRUPPEN[g], liste }]
      : [
          { titel: 'Trolleybus', liste: liste.filter((l) => trolleybusAm(l, datum)) },
          { titel: 'Autobus', liste: liste.filter((l) => !trolleybusAm(l, datum)) },
        ].filter((u) => u.liste.length);
  const arten = $derived(
    ARTEN.map(([art, titel]) => ({ art, titel, liste: aenderungen.filter((a) => a.art === art) })).filter((g) => g.liste.length),
  );
</script>

<section class="panel">
  <div class="block">
    {#if mitBus}
      <div class="umschalter" role="group" aria-label="Verkehrsmittel">
        {#each [['tram', 'Tram'], ['bus', 'Bus'], ['alle', 'Tram und Bus']] as [wert, text] (wert)}
          <button aria-pressed={filter === wert} onclick={() => onfilter(wert)}>{text}</button>
        {/each}
      </div>
    {/if}
    <h2>{TITEL[filter]} am 1. Juli {jahr}</h2>
    <p class="still">{linien.length} Linien, {anzahlHalte} Haltestellen</p>
    {#if busFehlt}
      <p class="hinweis">Busse sind erst ab {netz.erfasstAb.bus} erfasst. Für frühere Jahre fehlen offene Fahrplandaten.</p>
    {:else if gruppen.includes('bus') && ansicht === 'plan' && !netz.meta.plan?.busse}
      <p class="hinweis">
        Busse haben noch keine Lage im Liniennetzplan und erscheinen nur in der geografischen Karte.
        <button class="link" onclick={onkarte}>Geografisch zeigen</button>
      </p>
    {/if}
    {#each gruppen as g (g)}
      {@const liste = linien.filter((l) => l.gruppe === g)}
      {#if liste.length}
        {@const teile = unterGruppen(g, liste)}
        {#each teile as u (u.titel)}
          {#if gruppen.length > 1 || teile.length > 1}<h3>{u.titel}</h3>{/if}
          <div class="badges">
            {#each u.liste as l (l.id)}
              <button onclick={() => onlinie(l.id)} aria-label="{u.titel} {l.nummer} öffnen"><LinienBadge linie={l} /></button>
            {/each}
          </div>
        {/each}
      {/if}
    {/each}
  </div>

  <div class="block">
    <h2>Gegenüber {jahr - 1}</h2>
    {#if ohneVergleich.length === gruppen.length}
      <p class="still">Beginn des Erfassungszeitraums.</p>
    {:else}
      {#if ohneVergleich.length}<p class="still">{ohneVergleich.map((g) => GRUPPEN[g]).join(', ')} erst ab {jahr} erfasst, kein Vergleich.</p>{/if}
      {#if aenderungen.length === 0}
        <p class="still">Keine Änderungen am Linienweg.</p>
      {/if}
      {#each arten as g (g.art)}
        <h3>{g.titel}</h3>
        <ul class="aenderungen">
          {#each g.liste as a (a.linie)}
            <li>
              <button onclick={() => onlinie(a.linie)}>
                <LinienBadge linie={netz.linieById.get(a.linie)} />
                <span class="notiz">
                  {#if a.art === 'umgestellt'}Auf {a.zu} umgestellt.{:else if a.art !== 'eingestellt' && a.version.notiz}{a.version.notiz}{/if}
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
    {#if mitBus}
      <p><span class="muster bus"></span>Autobus</p>
      <p><span class="muster trolley"></span>Trolleybus, Strich in der Mitte: Fahrleitung</p>
      <p><span class="muster trolley akku"></span>Trolleybus ohne Fahrleitung, mit Akku</p>
    {/if}
    <p class="tastenhinweis">Linie anklicken für ihren Verlauf. Pfeiltasten wechseln das Jahr, P und G die Ansicht.</p>
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
  /* Verkehrsmittel: Wörter wie der Ansichtsumschalter, das gewählte unterstrichen */
  .umschalter {
    display: flex;
    gap: 14px;
    margin: 4px 0 14px;
  }
  .umschalter button {
    border: 0;
    background: none;
    padding: 1px 0;
    font: 500 14px var(--schrift);
    color: var(--grau);
    cursor: pointer;
    border-bottom: 2px solid transparent;
  }
  .umschalter button:hover {
    color: var(--tinte);
  }
  .umschalter button[aria-pressed='true'] {
    color: var(--tinte);
    border-bottom-color: var(--tinte);
  }
  .hinweis {
    margin-top: 8px;
    color: var(--grau);
    line-height: 1.4;
  }
  .link {
    border: 0;
    background: none;
    padding: 0;
    font: 500 13px var(--schrift);
    color: var(--tinte);
    text-decoration: underline;
    text-underline-offset: 2px;
    cursor: pointer;
  }
  .badges {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 12px;
  }
  h3 + .badges {
    margin-top: 0;
  }
  .badges button :global(.badge) {
    min-width: 30px;
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
  .aenderungen {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 8px;
  }
  .aenderungen button {
    display: grid;
    grid-template-columns: 34px 1fr;
    gap: 8px;
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
    padding: 16px 0 0;
    margin: 0 var(--innen);
    border-top: 1px solid var(--rand);
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
  .muster.bus {
    height: 4px;
    background: #75bee9;
  }
  /* Trolleybus: Linienfarbe (hier die der 31) mit dunklem Mittelstrich wie in der Karte */
  .muster.trolley {
    height: 5px;
    border-radius: 2.5px;
    background: linear-gradient(transparent 2px, #3a3833 2px 3px, transparent 3px), #a5a2c6;
  }
  .muster.trolley.akku {
    background:
      linear-gradient(90deg, #a5a2c6 0 2.5px, transparent 2.5px) 0 2px / 5px 1px repeat-x,
      linear-gradient(transparent 2px, #3a3833 2px 3px, transparent 3px),
      #a5a2c6;
  }
  .tastenhinweis {
    margin-top: 8px;
    font-size: 12px;
  }
</style>
