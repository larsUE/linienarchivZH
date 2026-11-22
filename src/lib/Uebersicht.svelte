<script>
  import LinienBadge from './LinienBadge.svelte';
  import { zustand, halteAm } from './netz.js';

  let { netz, jahr, datum, aenderungen, onlinie } = $props();

  const aktiv = $derived(zustand(netz, datum));
  const linien = $derived(netz.linien.filter((l) => aktiv.has(l.id)));
  const anzahlHalte = $derived(new Set([...aktiv.values()].flatMap((v) => halteAm(v, datum))).size);
  const TEXT = { neu: 'neue Linie', eingestellt: 'eingestellt', 'geändert': 'Linienweg geändert' };
</script>

<section class="panel">
  <div class="block">
    <h2>Tramnetz am 1. Juli {jahr}</h2>
    <p class="still">{linien.length} Linien · {anzahlHalte} Haltestellen</p>
    <div class="badges">
      {#each linien as l (l.id)}
        <button onclick={() => onlinie(l.id)} aria-label="Linie {l.nummer} öffnen"><LinienBadge linie={l} /></button>
      {/each}
    </div>
  </div>

  <div class="block">
    <h3>Gegenüber {jahr - 1}</h3>
    {#if jahr === netz.jahre[0]}
      <p class="still">Beginn des Erfassungszeitraums.</p>
    {:else if aenderungen.length === 0}
      <p class="still">Keine Änderungen am Linienweg.</p>
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
  .muster.bau {
    height: 0;
    border-top: 4px dashed var(--tinte);
    border-radius: 0;
  }
</style>
