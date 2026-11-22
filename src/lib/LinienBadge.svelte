<script>
  let { linie, gross = false } = $props();
  // Helle Linienfarben brauchen dunkle Schrift
  const hell = $derived.by(() => {
    const h = linie.farbe.replace('#', '');
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
    return 0.299 * r + 0.587 * g + 0.114 * b > 160;
  });
</script>

<span
  class="badge"
  class:gross
  class:bau={linie.art === 'baulinie'}
  style:background={linie.art === 'baulinie' ? 'white' : linie.farbe}
  style:color={linie.art === 'baulinie' ? linie.farbe : hell ? '#1d1d1b' : 'white'}
  style:border-color={linie.farbe}>{linie.nummer}</span
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
  .bau {
    border-style: dashed;
  }
</style>
