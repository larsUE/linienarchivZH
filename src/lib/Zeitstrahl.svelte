<script>
  let { jahre, jahr, anzahlAenderungen, spielt, onjahr, onspielen } = $props();

  const max = $derived(Math.max(1, ...jahre.map((j) => anzahlAenderungen.get(j) ?? 0)));
  const index = $derived(jahre.indexOf(jahr));
  // Über viele Jahrzehnte: schmale Balken, beschriftet sind nur die Zehnerjahre
  const dicht = $derived(jahre.length > 40);
  const beschriftung = (j) => (!dicht ? String(j).slice(2) : j % 10 === 0 ? String(j) : '');
</script>

<div class="zeitstrahl" role="group" aria-label="Zeitstrahl">
  <div class="links">
    <div class="jahr-gross" aria-live="polite">{jahr}</div>
    <div class="steuerung">
      <button onclick={() => onjahr(jahre[Math.max(0, index - 1)])} disabled={index <= 0} aria-label="Vorheriges Jahr">‹</button>
      <button class="spielen" onclick={onspielen} aria-label={spielt ? 'Anhalten' : 'Abspielen'}>{spielt ? '❚❚' : '▶'}</button>
      <button onclick={() => onjahr(jahre[Math.min(jahre.length - 1, index + 1)])} disabled={index >= jahre.length - 1} aria-label="Nächstes Jahr">›</button>
    </div>
  </div>

  <ol class="skala" class:dicht>
    {#each jahre as j}
      {@const n = anzahlAenderungen.get(j) ?? 0}
      <li class:zehner={j % 10 === 0} class:fuenfzig={j % 50 === 0}>
        <button class="jahr" class:aktiv={j === jahr} onclick={() => onjahr(j)} aria-label="{j}, {n} Änderungen" aria-current={j === jahr}>
          <span class="balken" style:height="{(n / max) * 100}%" title="{n} Linien geändert"></span>
          <span class="zahl">{beschriftung(j)}</span>
        </button>
      </li>
    {/each}
  </ol>
</div>

<style>
  .zeitstrahl {
    display: grid;
    grid-template-columns: var(--seite) 1fr;
    align-items: stretch;
    background: var(--papier);
    border-top: 1px solid var(--rand);
  }
  .links {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px var(--innen);
    border-right: 1px solid var(--rand);
  }
  .jahr-gross {
    font: 600 34px/1 var(--schrift);
    letter-spacing: -0.01em;
    font-variant-numeric: tabular-nums;
  }
  .steuerung {
    display: flex;
    align-items: center;
    gap: 2px;
  }
  .steuerung button {
    width: 32px;
    height: 32px;
    border: 0;
    border-radius: 50%;
    background: none;
    font-size: 18px;
    line-height: 1;
    color: var(--tinte);
    cursor: pointer;
  }
  .steuerung button:hover:not(:disabled) {
    background: var(--rand);
  }
  .steuerung button:disabled {
    color: var(--hell);
    cursor: default;
  }
  .steuerung .spielen {
    font-size: 11px;
    border: 1.5px solid var(--tinte);
  }
  .skala {
    display: flex;
    list-style: none;
    margin: 0;
    padding: 12px 40px 10px;
    gap: 2px;
    height: 44px;
  }
  .skala li {
    flex: 1;
    min-width: 0;
  }
  .skala.dicht {
    gap: 0;
  }
  .skala.dicht .balken {
    width: 70%;
    max-width: 6px;
  }
  /* Zehnerjahre: Beschriftung ragt über die schmalen Nachbarn hinaus */
  .skala.dicht .zahl {
    /* Breite 0: die Beschriftung zählt nicht zur Mindestbreite und steht mittig über ihrem Jahr */
    width: 0;
    height: 12px;
    display: flex;
    justify-content: center;
    white-space: nowrap;
  }
  .skala.dicht .zehner .balken {
    background: var(--hell);
  }
  .skala.dicht .jahr.aktiv .balken {
    background: var(--akzent);
  }
  .jahr {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    align-items: center;
    gap: 5px;
    border: 0;
    background: none;
    cursor: pointer;
    padding: 0;
    color: var(--hell);
  }
  .jahr:hover {
    color: var(--tinte);
  }
  .balken {
    width: 40%;
    max-width: 12px;
    min-height: 2px;
    background: var(--rand);
    border-radius: 1px;
  }
  .jahr:hover .balken {
    background: var(--hell);
  }
  .zahl {
    font: 500 12px/1 var(--schrift);
    font-variant-numeric: tabular-nums;
  }
  .jahr.aktiv {
    color: var(--tinte);
  }
  .jahr.aktiv .balken {
    background: var(--akzent);
  }
  .jahr.aktiv .zahl {
    font-weight: 700;
  }
  @media (max-width: 700px) {
    .zeitstrahl {
      grid-template-columns: 1fr;
    }
    .links {
      border-right: 0;
      padding-bottom: 0;
    }
    .jahr-gross {
      font-size: 28px;
    }
    .skala {
      padding: 10px var(--innen);
    }
    /* Auf schmalen Bildschirmen nur 1900, 1950, 2000 beschriften */
    .skala.dicht li:not(.fuenfzig) .zahl {
      visibility: hidden;
    }
  }
</style>
