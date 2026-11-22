<script>
  let { jahre, jahr, anzahlAenderungen, spielt, onjahr, onspielen } = $props();

  const max = $derived(Math.max(1, ...jahre.map((j) => anzahlAenderungen.get(j) ?? 0)));
  const index = $derived(jahre.indexOf(jahr));
</script>

<div class="zeitstrahl" role="group" aria-label="Zeitstrahl">
  <div class="steuerung">
    <button class="rund" onclick={() => onjahr(jahre[Math.max(0, index - 1)])} disabled={index <= 0} aria-label="Vorheriges Jahr">‹</button>
    <button class="rund spielen" onclick={onspielen} aria-label={spielt ? 'Anhalten' : 'Abspielen'}>{spielt ? '❚❚' : '▶'}</button>
    <button class="rund" onclick={() => onjahr(jahre[Math.min(jahre.length - 1, index + 1)])} disabled={index >= jahre.length - 1} aria-label="Nächstes Jahr">›</button>
  </div>

  <div class="jahr-gross" aria-live="polite">{jahr}</div>

  <ol class="skala">
    {#each jahre as j}
      {@const n = anzahlAenderungen.get(j) ?? 0}
      <li>
        <button class="jahr" class:aktiv={j === jahr} onclick={() => onjahr(j)} aria-label="{j}, {n} Änderungen" aria-current={j === jahr}>
          <span class="balken" style:height="{(n / max) * 100}%" title="{n} Linien geändert"></span>
          <span class="zahl">{String(j).slice(2)}</span>
        </button>
      </li>
    {/each}
  </ol>
</div>

<style>
  .zeitstrahl {
    display: grid;
    grid-template-columns: auto auto 1fr;
    align-items: end;
    gap: 20px;
    padding: 14px 20px 12px;
    background: var(--papier);
    border-top: 1px solid var(--rand);
  }
  .steuerung {
    display: flex;
    gap: 6px;
    align-self: center;
  }
  .rund {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    border: 1px solid var(--rand);
    background: white;
    font-size: 16px;
    line-height: 1;
    color: var(--tinte);
    cursor: pointer;
  }
  .rund.spielen {
    background: var(--tinte);
    color: white;
    border-color: var(--tinte);
    font-size: 12px;
  }
  .rund:disabled {
    opacity: 0.35;
    cursor: default;
  }
  .jahr-gross {
    font: 700 44px/1 var(--schrift);
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
    min-width: 2.6em;
  }
  .skala {
    display: flex;
    list-style: none;
    margin: 0;
    padding: 0;
    gap: 2px;
    height: 52px;
  }
  .skala li {
    flex: 1;
  }
  .jahr {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    align-items: center;
    gap: 4px;
    border: 0;
    background: none;
    cursor: pointer;
    padding: 0;
    color: var(--grau);
    border-radius: 4px;
  }
  .jahr:hover {
    background: rgb(0 0 0 / 0.04);
  }
  .balken {
    width: 60%;
    max-width: 18px;
    min-height: 2px;
    background: var(--rand);
    border-radius: 2px 2px 0 0;
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
      grid-template-columns: auto 1fr;
      gap: 10px 14px;
    }
    .jahr-gross {
      font-size: 32px;
      justify-self: end;
    }
    .skala {
      grid-column: 1 / -1;
    }
  }
</style>
