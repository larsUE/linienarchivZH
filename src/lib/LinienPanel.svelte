<script>
  import LinienBadge from './LinienBadge.svelte';
  import { istAktiv, halteAm, stichtag, vergleicheFolgen, zeitraumText, STATUS } from './netz.js';

  let { netz, linieId, jahr, datum, onjahr, onschliessen } = $props();

  const linie = $derived(netz.linieById.get(linieId));
  const versionen = $derived(netz.versionenProLinie.get(linieId) ?? []);
  const aktuell = $derived(versionen.find((v) => istAktiv(v, datum)) ?? null);
  const vorgaenger = $derived(aktuell ? versionen[versionen.indexOf(aktuell) - 1] ?? null : null);

  // Jahre, in denen bei dieser Linie eine andere Version gilt als im Vorjahr
  const versionProJahr = $derived(new Map(netz.jahre.map((j) => [j, versionen.find((v) => istAktiv(v, stichtag(netz, j)))?.id ?? null])));
  const wechselJahre = $derived(netz.jahre.filter((j, i) => i === 0 || versionProJahr.get(j) !== versionProJahr.get(netz.jahre[i - 1])));
  const vorherigerWechsel = $derived([...wechselJahre].reverse().find((j) => j < jahr && versionProJahr.get(j) !== versionProJahr.get(jahr)));
  const naechsterWechsel = $derived(wechselJahre.find((j) => j > jahr));

  // Zeitband: Position eines Datums zwischen Beginn und Ende des Erfassungszeitraums
  const [start, ende] = netz.meta.zeitraum;
  const pos = (iso, rand) => {
    if (!iso) return rand;
    const d = new Date(iso + 'T12:00:00');
    const j = d.getFullYear() + (d - new Date(d.getFullYear(), 0, 1)) / 3.156e10;
    return Math.min(1, Math.max(0, (j - start) / (ende + 1 - start)));
  };
  const ersteJahr = (v) => netz.jahre.find((j) => istAktiv(v, stichtag(netz, j)));

  const folge = $derived(
    aktuell ? vergleicheFolgen(vorgaenger ? halteAm(vorgaenger, vorgaenger.bis ?? datum) : null, halteAm(aktuell, datum)) : [],
  );
  const endpunkte = $derived.by(() => {
    if (!aktuell) return null;
    const h = halteAm(aktuell, datum);
    return [netz.haltestelleById.get(h[0]).name, netz.haltestelleById.get(h.at(-1)).name];
  });
  const anzahl = $derived.by(() => ({
    neu: folge.filter((f) => f.art === 'neu').length,
    entfallen: folge.filter((f) => f.art === 'entfallen').length,
  }));
</script>

<section class="panel" aria-label="Linie {linie.nummer}">
  <header>
    <button class="zurueck" onclick={onschliessen} aria-label="Zurück zur Übersicht">←</button>
    <LinienBadge {linie} gross />
    <div class="titel">
      <h2>{{ baulinie: 'Baulinie', bus: 'Bus' }[linie.art] ?? 'Tram'} {linie.nummer}</h2>
      {#if endpunkte}
        <p>{endpunkte[0]} – {endpunkte[1]}</p>
      {:else}
        <p class="still">verkehrt am 1. Juli {jahr} nicht</p>
      {/if}
    </div>
  </header>

  <div class="block">
    <div class="zeile">
      <h3>Versionen</h3>
      <div class="blaettern">
        <button disabled={vorherigerWechsel === undefined} onclick={() => onjahr(vorherigerWechsel)}>‹ frühere</button>
        <button disabled={naechsterWechsel === undefined} onclick={() => onjahr(naechsterWechsel)}>spätere ›</button>
      </div>
    </div>
    <div class="band" aria-label="Versionen im Zeitverlauf" style:--n={netz.jahre.length}>
      {#if (netz.erfasstAb[linie.gruppe] ?? start) > start}
        <!-- Jahre ohne Daten für dieses Verkehrsmittel (Busse vor 2015) -->
        <span class="nicht-erfasst" style:width="{pos(`${netz.erfasstAb[linie.gruppe]}-01-01`, 0) * 100}%" title="vor {netz.erfasstAb[linie.gruppe]} nicht erfasst"></span>
      {/if}
      {#each versionen as v (v.id)}
        {@const a = pos(v.von, 0)}
        {@const b = pos(v.bis, 1)}
        {@const j = ersteJahr(v)}
        <button
          class="segment {v.status}"
          class:aktiv={v === aktuell}
          style:left="{a * 100}%"
          style:width="max(4px, {(b - a) * 100}%)"
          style:--farbe={linie.farbe}
          disabled={j === undefined}
          onclick={() => j !== undefined && onjahr(j)}
          title="{zeitraumText(v)} · {STATUS[v.status].text}"
        ></button>
      {/each}
      <span class="marke" style:left="{pos(datum, 0) * 100}%"></span>
    </div>
    <div class="band-skala"><span>{start}</span><span>{ende}</span></div>
  </div>

  {#if aktuell}
    <div class="block meta">
      <p class="zeitraum">{zeitraumText(aktuell)}</p>
      <p>
        <span class="status {aktuell.status}">{STATUS[aktuell.status].text}</span>
        <span class="still">{linie.art === 'bus' && aktuell.status === 'belegt' ? 'Linienweg und Haltestellen aus den Fahrplandaten.' : STATUS[aktuell.status].erklaerung}</span>
      </p>
      {#if aktuell.notiz}<p>{aktuell.notiz}</p>{/if}
      <p class="quellen">
        Quellen:
        {#each aktuell.quellen as q, i}
          {@const quelle = netz.quellen[q]}
          <a href={quelle.url} target="_blank" rel="noreferrer">{quelle.titel}</a>{i < aktuell.quellen.length - 1 ? ', ' : ''}
        {/each}
      </p>
    </div>

    <div class="block">
      <div class="zeile">
        <h3>Linienweg</h3>
        {#if vorgaenger}
          <span class="still klein">gegenüber {zeitraumText(vorgaenger)}: {anzahl.neu} neu, {anzahl.entfallen} entfallen</span>
        {/if}
      </div>
      <ol class="linienband" style:--farbe={linie.farbe}>
        {#each folge as f, i (f.id + f.art + i)}
          <li class={f.art}>
            <span class="punkt"></span>
            <span class="name">{netz.haltestelleById.get(f.id).name}</span>
            {#if f.art === 'neu' && vorgaenger}<span class="marker">neu</span>{/if}
            {#if f.art === 'entfallen'}<span class="marker">entfallen</span>{/if}
          </li>
        {/each}
      </ol>
    </div>
  {:else}
    <div class="block">
      <p class="still">Wähle eine Version im Band oben, um zu ihrem Netzstand zu springen.</p>
    </div>
  {/if}
</section>

<style>
  .panel {
    display: flex;
    flex-direction: column;
    gap: 0;
  }
  header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px 18px;
    border-bottom: 1px solid var(--rand);
  }
  .zurueck {
    border: 0;
    background: none;
    font-size: 20px;
    cursor: pointer;
    padding: 4px;
    color: var(--grau);
  }
  h2 {
    margin: 0;
    font-size: 18px;
  }
  header p {
    margin: 2px 0 0;
    font-size: 14px;
  }
  h3 {
    margin: 0;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--grau);
  }
  .block {
    padding: 14px 18px;
    border-bottom: 1px solid var(--rand);
  }
  .zeile {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
    margin-bottom: 10px;
  }
  .blaettern button {
    border: 1px solid var(--rand);
    background: white;
    border-radius: 4px;
    padding: 3px 8px;
    font: 500 12px var(--schrift);
    cursor: pointer;
  }
  .blaettern button:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .band {
    position: relative;
    height: 22px;
    background: repeating-linear-gradient(90deg, transparent 0 calc(100% / var(--n) - 1px), var(--rand) calc(100% / var(--n) - 1px) calc(100% / var(--n)));
    border-radius: 3px;
  }
  .segment {
    position: absolute;
    top: 3px;
    bottom: 3px;
    border: 0;
    border-radius: 3px;
    background: var(--farbe);
    opacity: 0.45;
    cursor: pointer;
    padding: 0;
    border-right: 2px solid var(--papier);
  }
  .segment.unsicher {
    background: repeating-linear-gradient(135deg, var(--farbe) 0 4px, transparent 4px 7px);
  }
  .segment.aktiv {
    opacity: 1;
    top: 0;
    bottom: 0;
  }
  .nicht-erfasst {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    background: repeating-linear-gradient(135deg, transparent 0 4px, rgb(0 0 0 / 0.08) 4px 5px);
  }
  .marke {
    position: absolute;
    top: -4px;
    bottom: -4px;
    width: 2px;
    margin-left: -1px;
    background: var(--tinte);
    pointer-events: none;
  }
  .band-skala {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: var(--grau);
    margin-top: 4px;
  }
  .meta p {
    margin: 0 0 6px;
    font-size: 13px;
    line-height: 1.45;
  }
  .zeitraum {
    font-weight: 700;
    font-size: 14px !important;
  }
  .status {
    display: inline-block;
    padding: 1px 6px;
    border-radius: 3px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-right: 4px;
    color: white;
  }
  .status.belegt { background: var(--belegt); }
  .status.abgeleitet { background: var(--abgeleitet); }
  .status.unsicher { background: var(--unsicher); }
  .quellen a {
    color: inherit;
  }
  .still {
    color: var(--grau);
  }
  .klein {
    font-size: 12px;
  }
  .linienband {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .linienband li {
    position: relative;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 3px 0 3px 26px;
    font-size: 14px;
  }
  .linienband li::before {
    content: '';
    position: absolute;
    left: 8px;
    top: 0;
    bottom: 0;
    width: 5px;
    background: var(--farbe);
  }
  .linienband li:first-child::before { top: 50%; }
  .linienband li:last-child::before { bottom: 50%; }
  .punkt {
    position: absolute;
    left: 5px;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: white;
    border: 2px solid var(--tinte);
  }
  .linienband li:first-child .punkt,
  .linienband li:last-child .punkt {
    width: 9px;
    height: 9px;
    left: 4px;
    border-width: 2.5px;
  }
  .linienband li:first-child .name,
  .linienband li:last-child .name {
    font-weight: 700;
  }
  .linienband .neu .name {
    background: #fbefc4;
    padding: 0 3px;
    margin-left: -3px;
  }
  .linienband .entfallen::before {
    background: repeating-linear-gradient(var(--grau) 0 3px, transparent 3px 6px);
    width: 2px;
    left: 9.5px;
  }
  .linienband .entfallen .punkt {
    border-color: var(--grau);
    border-style: dashed;
  }
  .linienband .entfallen .name {
    color: var(--grau);
    text-decoration: line-through;
  }
  .marker {
    font-size: 11px;
    color: var(--grau);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
</style>
