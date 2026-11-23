<script>
  import LinienBadge from './LinienBadge.svelte';
  import { zustand, halteAm, erfasst, GRUPPEN } from './netz.js';

  let { netz, jahr, datum, filter, gruppen, ansicht, aenderungen, onfilter, onkarte, onlinie } = $props();

  const aktiv = $derived(zustand(netz, datum, gruppen));
  const linien = $derived(netz.linien.filter((l) => aktiv.has(l.id)));
  const anzahlHalte = $derived(new Set([...aktiv.values()].flatMap((v) => halteAm(v, datum))).size);
  const TEXT = { neu: 'neue Linie', eingestellt: 'eingestellt', 'geändert': 'Linienweg geändert' };
  const TITEL = { tram: 'Tramnetz', bus: 'Busnetz', alle: 'Tram- und Busnetz' };
  const mitBus = $derived(!!netz.erfasstAb.bus);
  const busFehlt = $derived(gruppen.includes('bus') && !erfasst(netz, 'bus', jahr));
  // Im Vorjahr noch nicht erfasste Verkehrsmittel: kein Vergleich möglich
  const ohneVergleich = $derived(gruppen.filter((g) => !erfasst(netz, g, jahr - 1)));
</script>

<section class="panel">
  {#if mitBus}
    <div class="block filter">
      <div class="umschalter" role="group" aria-label="Verkehrsmittel">
        {#each [['tram', 'Tram'], ['bus', 'Bus'], ['alle', 'Beide']] as [wert, text] (wert)}
          <button aria-pressed={filter === wert} class:aktiv={filter === wert} onclick={() => onfilter(wert)}>{text}</button>
        {/each}
      </div>
    </div>
  {/if}

  <div class="block">
    <h2>{TITEL[filter]} am 1. Juli {jahr}</h2>
    <p class="still">{linien.length} Linien · {anzahlHalte} Haltestellen</p>
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
        {#if gruppen.length > 1}<h3 class="gruppe">{GRUPPEN[g]}</h3>{/if}
        <div class="badges">
          {#each liste as l (l.id)}
            <button onclick={() => onlinie(l.id)} aria-label="{GRUPPEN[l.gruppe]} {l.nummer} öffnen"><LinienBadge linie={l} /></button>
          {/each}
        </div>
      {/if}
    {/each}
  </div>

  <div class="block">
    <h3>Gegenüber {jahr - 1}</h3>
    {#if ohneVergleich.length === gruppen.length}
      <p class="still">Beginn des Erfassungszeitraums.</p>
    {:else if aenderungen.length === 0}
      <p class="still">Keine Änderungen am Linienweg.</p>
      {#if ohneVergleich.length}<p class="still klein">{ohneVergleich.map((g) => GRUPPEN[g]).join(', ')}: erst ab {jahr} erfasst, kein Vergleich.</p>{/if}
    {:else}
      <ul class="aenderungen">
        {#each aenderungen as a (a.linie)}
          <li>
            <button onclick={() => onlinie(a.linie)}>
              <LinienBadge linie={netz.linieById.get(a.linie)} />
              <span>
                <b>{TEXT[a.art]}</b>
                {#if a.art !== 'eingestellt' && a.version.notiz}<br /><span class="still">{a.version.notiz}</span>{/if}
              </span>
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  </div>

  <div class="block legende">
    <h3>Legende</h3>
    <p><span class="muster neu"></span> neuer Abschnitt seit dem Vorjahr</p>
    <p><span class="muster weg"></span> seit dem Vorjahr nicht mehr befahren</p>
    <p><span class="muster bau"></span> Baulinie</p>
    {#if mitBus}<p><span class="muster bus"></span> Buslinie (Trolleybusse farbig)</p>{/if}
    <p class="still klein">Klick auf eine Linie öffnet ihren Verlauf. Pfeiltasten blättern durch die Jahre, P und G wechseln zwischen Plan und Karte.</p>
  </div>
</section>

<style>
  .block {
    padding: 14px 18px;
    border-bottom: 1px solid var(--rand);
  }
  h2 {
    margin: 0 0 2px;
    font-size: 17px;
  }
  h3 {
    margin: 0 0 10px;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--grau);
  }
  p {
    margin: 0 0 6px;
    font-size: 13px;
  }
  .still {
    color: var(--grau);
  }
  .klein {
    font-size: 12px;
  }
  .umschalter {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    background: #ebe8e1;
    border-radius: 6px;
    padding: 3px;
  }
  .umschalter button {
    border: 0;
    background: none;
    padding: 5px 8px;
    border-radius: 4px;
    font: 600 13px var(--schrift);
    color: var(--tinte);
    cursor: pointer;
  }
  .umschalter button.aktiv {
    background: white;
    box-shadow: 0 1px 2px rgb(0 0 0 / 0.12);
  }
  .umschalter button:not(.aktiv):hover {
    background: rgb(255 255 255 / 0.5);
  }
  .filter {
    padding-top: 12px;
    padding-bottom: 12px;
  }
  .hinweis {
    margin: 10px 0 0;
    padding: 8px 10px;
    background: #f3efe4;
    border-radius: 6px;
    font-size: 13px;
    line-height: 1.4;
  }
  .link {
    border: 0;
    background: none;
    padding: 0;
    font: 600 13px var(--schrift);
    color: var(--tinte);
    text-decoration: underline;
    cursor: pointer;
  }
  h3.gruppe {
    margin: 14px 0 0;
  }
  .badges {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 10px;
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
  .badges button:hover {
    transform: translateY(-1px);
  }
  .aenderungen {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 10px;
  }
  .aenderungen button {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    font-size: 13px;
    line-height: 1.4;
  }
  .aenderungen button:hover b {
    text-decoration: underline;
  }
  .muster {
    display: inline-block;
    width: 26px;
    height: 8px;
    vertical-align: middle;
    margin-right: 6px;
    border-radius: 4px;
  }
  .muster.neu {
    background: #f2c94c;
    opacity: 0.7;
  }
  .muster.weg {
    height: 0;
    border-top: 2px dashed #7d7a73;
    border-radius: 0;
  }
  .muster.bus {
    height: 5px;
    background: white;
    border: 1.5px solid #55524c;
    border-radius: 3px;
  }
  .muster.bau {
    height: 0;
    border-top: 4px dashed var(--tinte);
    border-radius: 0;
  }
</style>
