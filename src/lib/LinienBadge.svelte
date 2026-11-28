<script>
  import { istHell } from './netz.js';

  let { linie, gross = false } = $props();
  // Helle Linienfarben brauchen dunkle Schrift
  const hell = $derived(istHell(linie.farbe));
</script>

<span
  class="badge"
  class:gross
  class:bau={linie.art === 'baulinie'}
  class:bus={linie.art === 'bus'}
  class:lang={linie.nummer.length > 3}
  style:background={linie.art === 'baulinie' ? 'white' : linie.farbe}
  style:color={linie.art === 'baulinie' ? linie.farbe : hell ? '#1d1d1b' : 'white'}
  style:border-color={linie.art === 'bus' && hell ? '#55524c' : linie.farbe}>{linie.nummer}</span
>

<style>
  .badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 26px;
    height: 20px;
    padding: 0 5px;
    border-radius: 3px;
    border: 2px solid;
    font: 700 13px/1 var(--schrift);
    font-variant-numeric: tabular-nums;
    box-sizing: border-box;
  }
  .gross {
    min-width: 44px;
    height: 34px;
    font-size: 20px;
    border-radius: 5px;
  }
  /* Namen statt Nummern (Linien vor 1906): kleinere Schrift */
  .lang {
    font-size: 11px;
    letter-spacing: 0.01em;
  }
  .gross.lang {
    font-size: 15px;
  }
  .bau {
    border-style: dashed;
  }
  /* Busse: abgerundet, helle Linienfarben (helle Trolleybusse) mit dunklem Rand */
  .bus {
    border-radius: 10px;
    border-width: 1.5px;
  }
  .bus.gross {
    border-radius: 17px;
  }
</style>
