# Linienarchiv Zürich – Pilot

Archiv des Zürcher Tramnetzes mit Zeitstrahl. Tram, 2010–2026, als Liniennetzplan und als geografische Karte.

```bash
npm install
npm run dev          # http://localhost:5183
```

```bash
npm run daten:osm    # OSM-Rohdaten neu laden (Overpass)
npm run daten        # public/data/netz.json neu bauen
```

Plangeometrie neu ableiten (nur nötig bei neuem Plan oder neuen Haltestellen; braucht Python mit `pymupdf`, `numpy`, `scipy`):

```bash
python3 scripts/plan/extract-plan.py ~/Downloads/Liniennetzplan.pdf && npm run daten
```

## Funktionen

- **Zwei Ansichten**: Liniennetzplan und geografische Karte. Beim Umschalten wandern Linien und Haltestellen von der einen Lage in die andere. Tasten P und G.
- **Zeitstrahl**: Netzstand am 1. Juli jedes Jahres. Die Balken zeigen, wie viele Linien sich gegenüber dem Vorjahr geändert haben. Bedienung mit Klick, Pfeiltasten oder Abspielen.
- **Vergleich zum Vorjahr**: Neue Abschnitte sind gelb unterlegt, weggefallene gestrichelt. Die Seitenleiste listet die geänderten Linien.
- **Linienansicht** (Klick auf eine Linie): Versionsband über alle Jahre, Blättern zur früheren oder späteren Version, Linienweg mit Vergleich zur Vorversion, Status und Quellen.
- Der Zustand steht in der URL, z.B. `#/plan/2018/tram-8` oder `#/karte/2018`.

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

### Planlage

[`scripts/plan/extract-plan.py`](scripts/plan/extract-plan.py) liest den ZVV-Liniennetzplan als Vektor-PDF und schreibt [`data/plan.json`](data/plan.json):

1. Linienfarben aus den Nummernschildern, Tramstriche je Farbe als Graph.
2. Haltestellenmarken: weisse Balken und Kreise auf Tramstrichen.
3. Haltestellennamen den Beschriftungen zuordnen (auch mehrzeilig und abgekürzt), dann optimal den Marken. Die Haltestelle liegt dort, wo der Balken die Striche ihrer Linien schneidet.
4. Abschnitte folgen dem Strich der Linienfarbe im Plan.
5. Was der Plan nicht zeigt (Limmattalbahn ausserhalb des Plans, Flughafen, Bahnhofquai/HB), wird aus der Geografie geschätzt und im Plan blasser gezeichnet.

Für einzelne Haltestellen, bei denen die Zuordnung danebenliegt, gibt es im Skript die Liste `FEST`. `npm run daten` legt den Plan mit einer Ähnlichkeitstransformation über das Stadtgebiet. So zeigt dieselbe Kartenansicht beide Lagen. Historische Abschnitte, die der heutige Plan nicht kennt, werden gerade zwischen ihren Haltestellen gezogen.

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
- Schrift ist Barlow (OFL). Die Kartenbeschriftungen nutzen eigene Glyphen in `public/fonts/`, erzeugt mit `npm run glyphen`.
- Die Planlage ist aus dem ZVV-Liniennetzplan abgeleitet (gültig ab 14.12.2025).
- Der Plan zeigt den Stand Dezember 2025, OSM den Stand November 2026. Wo die beiden abweichen, folgt die Planlage dem nächstgelegenen Tramstrich.

## Nächste Etappen

1. Liniennetzplan verfeinern: historische Pläne als weitere Planstände, Beschriftungen wie im Plan.
2. Erfassungswerkzeug für Versionen und Quellen, historische Gleisabschnitte mit Gültigkeit.
3. Busse, weiter zurückliegende Jahre, historische Grundkarten (swisstopo Zeitreise).
