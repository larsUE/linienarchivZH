# Linienarchiv Zürich – Pilot

Archiv des Zürcher Tramnetzes mit Zeitstrahl. Etappe 1: geografische Karte, Tram, 2010–2026.

```bash
npm install
npm run dev          # http://localhost:5183
```

```bash
npm run daten:osm    # OSM-Rohdaten neu laden (Overpass)
npm run daten        # public/data/netz.json neu bauen
```

## Funktionen

- **Zeitstrahl**: Netzstand am 1. Juli jedes Jahres. Die Balken zeigen, wie viele Linien sich gegenüber dem Vorjahr geändert haben. Bedienung mit Klick, Pfeiltasten oder Abspielen.
- **Vergleich zum Vorjahr**: Neue Abschnitte sind gelb unterlegt, weggefallene gestrichelt. Die Seitenleiste listet die geänderten Linien.
- **Linienansicht** (Klick auf eine Linie): Versionsband über alle Jahre, Blättern zur früheren oder späteren Version, Linienweg mit Vergleich zur Vorversion, Status und Quellen.
- Der Zustand steht in der URL, z.B. `#/2018/tram-8`.

## Datenmodell

Die einzige Datenquelle ist [`data/linien.yaml`](data/linien.yaml). Jede Linie hat **Versionen** mit `von`/`bis` (taggenau, `null` = offen). Der Linienweg einer Version wird aus Bausteinen zusammengesetzt:

| Baustein | Bedeutung |
|---|---|
| `{osm: 2807094}` | ganze heutige OSM-Linienrelation |
| `{osm: 2807094, von: Bellevue, bis: Farbhof}` | Ausschnitt daraus, auch rückwärts |
| `"Paradeplatz"` | Wegpunkt; die Lücke füllt der Router über das OSM-Gleisnetz |

[`scripts/build-data.mjs`](scripts/build-data.mjs) löst die Wege auf und schreibt `public/data/netz.json`:

- `haltestellen`: OSM-Haltepunkte, nach Namen gruppiert
- `kanten`: Abschnitte zwischen zwei Haltestellen, mit Gleisgeometrie
- `versionen`: Haltestellenfolge und Abschnitte pro Linienversion

Der Build bricht ab, wenn sich Versionen einer Linie zeitlich überschneiden oder eine Haltestelle unbekannt ist. Halte, die der Router selbst eingefügt hat, werden als Hinweis ausgegeben.

Jede Version trägt einen **Status**:

- `belegt`: Der Linienweg ist durch eine Quelle belegt.
- `abgeleitet`: Die Endpunkte sind belegt, die Zwischenhalte sind rekonstruiert.
- `unsicher`: Die Quellen widersprechen sich.

## Quellen und Grenzen des Pilots

- Haltestellen und Gleise stammen aus OpenStreetMap (Stand November 2026, ODbL). Die Linienwege stammen aus den Wikipedia-Artikeln *Strassenbahn Zürich* und *Linienchronik der Strassenbahn Zürich*.
- **Die historischen Stände sind nicht mit Primärquellen geprüft.** Viele Zwischenhalte sind aus heutigen Linienwegen zusammengesetzt. Historische Netzpläne oder Fahrpläne fehlen noch.
- Strecken, die es heute nicht mehr gibt, können nicht dargestellt werden, weil der Router nur das heutige Gleisnetz kennt. Ausnahme: Gleise, die in OSM als «im Bau» erfasst sind, z.B. am Bahnhofquai.
- Linienfarben sind die heutigen. Kurse in der Hauptverkehrszeit, Teilstrecken und temporäre Linien sind nicht erfasst, z.B. Linie 16 im Jahr 2026.
- Die Grundkarte ist die Light Base Map von swisstopo.

## Nächste Etappen

1. Schematischer Liniennetzplan: Schema-Koordinaten pro Haltestelle aus dem ZVV-Plan, Überblendung zwischen Plan und Karte. Vorher die Rechte am Plan klären.
2. Erfassungswerkzeug für Versionen und Quellen, historische Gleisabschnitte mit Gültigkeit.
3. Busse, weiter zurückliegende Jahre, historische Grundkarten (swisstopo Zeitreise).
