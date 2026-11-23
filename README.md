# Linienarchiv Zürich – Pilot

Archiv des Zürcher Tram- und Busnetzes mit Zeitstrahl: Tram 2010–2026, VBZ-Stadtbuslinien 2015–2026, als Liniennetzplan und als geografische Karte.

```bash
npm install
npm run dev          # http://localhost:5183
```

```bash
npm run daten:osm    # OSM-Rohdaten neu laden (Overpass)
npm run daten        # public/data/netz.json neu bauen
```

Liniennetzplan neu berechnen (nötig bei neuen Haltestellen oder Abschnitten; dauert einige Minuten):

```bash
npm run plan         # oktilineares Layout -> data/layout.json, dann netz.json und Hintergrund
```

Ausgangslage aus dem ZVV-Plan neu ableiten (nur bei neuem Plan; braucht Python mit `pymupdf`, `numpy`, `scipy`):

```bash
python3 scripts/plan/extract-plan.py ~/Downloads/Liniennetzplan.pdf && npm run plan
```

Prüfen:

```bash
npm test             # Datentests auf public/data/netz.json (tests/)
```

Die CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) läuft bei jedem Pull Request und auf `main`. Sie erzeugt Busstufe und `netz.json` neu und bricht ab, wenn die eingecheckten Dateien nicht dazu passen ([`scripts/pruefen-aktuell.mjs`](scripts/pruefen-aktuell.mjs); Zahlen mit kleiner Toleranz). Sie nutzt die Node-Version aus `.nvmrc`; mit einer anderen Version rechnet `layout-bus.mjs` nicht bitgenau gleich, und das Entspannen der Bushaltestellen verstärkt solche Unterschiede bis zu ganzen Rasterstufen. Danach laufen die Datentests und der Vite-Build. Das Tramlayout und der Hintergrund werden dort nicht neu gerechnet. `npm run daten` schreibt `netz.json` nur, wenn sich der Inhalt ändert, sonst bleibt auch der Zeitstempel `meta.erstellt` stehen.

Die Datentests prüfen:

- Ids sind eindeutig, und Versionen verweisen nur auf bestehende Linien, Haltestellen und Abschnitte.
- Linienwege sind lückenlos.
- Fahrwege enden bei ihren Haltestellen. So fallen verwechselte gleichnamige Haltestellen auf.
- Im Plan hat alles eine Lage, Striche sind waagrecht, senkrecht oder diagonal, und keine zwei Haltestellen liegen aufeinander.

## Funktionen

- **Zwei Ansichten**: Liniennetzplan und geografische Karte. Beim Umschalten wandern Linien und Haltestellen von der einen Lage in die andere. Tasten P und G.
- **Tram und Bus**: Die Übersicht filtert nach Tram (Standard), Bus oder beiden. Busse erscheinen in beiden Ansichten, schmaler als Trams und mit Rand.
- **Zeitstrahl**: Netzstand am 1. Juli jedes Jahres. Die Balken zeigen, wie viele Linien sich gegenüber dem Vorjahr geändert haben. Bedienung mit Klick, Pfeiltasten oder Abspielen.
- **Vergleich zum Vorjahr**: Neue Abschnitte sind gelb unterlegt, weggefallene gestrichelt. Die Seitenleiste listet die geänderten Linien.
- **Linienansicht** (Klick auf eine Linie): Versionsband über alle Jahre, Blättern zur früheren oder späteren Version, Linienweg mit Vergleich zur Vorversion, Status und Quellen.
- Der Zustand steht in der URL, z.B. `#/plan/2018/tram-8`, `#/karte/2018` oder `#/karte/bus/2018/bus-33` (Filter `bus` oder `alle`; ohne Filterteil Tram).

## Datenmodell

Die Linien stehen in [`data/linien.yaml`](data/linien.yaml) (Tram) und [`data/busse.yaml`](data/busse.yaml) (Bus, siehe [Busse](#busse)). Jede Linie hat **Versionen** mit `von`/`bis` (taggenau, `null` = offen). Der Linienweg einer Version wird aus Bausteinen zusammengesetzt:

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

Für einzelne Haltestellen, bei denen die Zuordnung danebenliegt, gibt es im Skript die Liste `FEST`.

### Eigenes Layout

[`scripts/plan/layout.mjs`](scripts/plan/layout.mjs) berechnet daraus einen eigenen oktilinearen Plan nach Nöllenburg & Wolff ([Drawing and Labeling High-Quality Metro Maps by Mixed-Integer Programming](https://doi.org/10.1109/TVCG.2010.81), 2011), mit dem Solver [HiGHS](https://highs.dev). Es schreibt [`data/layout.json`](data/layout.json).

- Alle Abschnitte aller Jahre bilden einen Graphen. Ketten von Haltestellen ohne Verzweigung werden zu geraden Stücken zusammengefasst, die Zwischenhalte liegen gleichmässig darauf.
- Harte Bedingungen: jedes Stück waagrecht, senkrecht oder diagonal; Reihenfolge der Abschnitte um jede Haltestelle wie in der Vorlage; Mindestlänge je Haltestellenabstand; kein Stück berührt ein anderes. Abstände werden nur für Paare verlangt, die nahe liegen oder sich in einer Lösung berühren; dann wird nachgerechnet.
- Ziele: wenige und flache Knicke entlang der Linien, Richtungen und Lage nahe an der Vorlage. Der Plan wird so begradigt, aber nicht neu verteilt: Das vergrösserte Zentrum der Vorlage bleibt.
- Abschnitte, die eine Folge anderer abkürzen (z.B. bevor dazwischen ein Halt eröffnet wurde), werden über diese Folge gezeichnet.

`npm run daten` legt den Plan mit Massstab und Verschiebung, aber ohne Drehung über das Stadtgebiet. So zeigt dieselbe Kartenansicht beide Lagen, und Waagrechte bleiben waagrecht. Fehlt `data/layout.json`, nimmt der Build `data/plan.json`.

In der Darstellung liegen parallele Linien so nebeneinander, wie sie später auseinanderlaufen: Wer an der nächsten Verzweigung links abbiegt, liegt links. So kreuzen sie sich nur, wo es nötig ist. Haltestellen sind weisse Balken quer über das ganze Bündel.

### Busse im Plan

[`scripts/plan/layout-bus.mjs`](scripts/plan/layout-bus.mjs) legt die Busse über das fertige Tramlayout und ergänzt `data/layout.json`. `npm run plan` ruft es nach `layout.mjs` auf. Ein gemeinsames MIP mit festem Tramnetz war zu gross und fand keine Lösung, darum ein schnelles Verfahren:

- Tramhaltestellen bleiben, wo sie sind. Reine Bushaltestellen bekommen ihre Lage über eine Thin-Plate-Spline durch die Tramhaltestellen ([`scripts/plan/tps.mjs`](scripts/plan/tps.mjs), wie beim Hintergrund). Wo der Plan ein Gebiet staucht, rücken sie danach auseinander und von den Tramstrecken weg.
- Busabschnitte zwischen denselben Haltestellen wie ein Tram oder entlang einer Tramfolge laufen über den Tramabschnitt. Die Karte legt sie dort neben das Trambündel.
- Jede übrige Kette zwischen zwei Knoten wird ein oktilinearer Zug mit höchstens einem Knick, auf der Seite, auf der der Fahrweg verläuft. Die Zwischenhalte liegen gleichmässig darauf.

Das Ergebnis ist ordentlich, aber nicht optimiert: Buszüge können sich kreuzen oder eng nebeneinander laufen, und Beschriftungen überlappen in dichten Gebieten.

### Hintergrund

[`scripts/plan/hintergrund.mjs`](scripts/plan/hintergrund.mjs) holt Zürichsee, Limmat, Sihl, Wald und die Stadtgrenze aus OpenStreetMap (Overpass, zwischengespeichert in `data/raw/osm/`). Die Formen werden vereinfacht und geglättet. Eine Thin-Plate-Spline durch alle Haltestellen (geografische Lage → Planlage) verzerrt sie in den Plan. Ergebnis ist [`public/data/hintergrund.json`](public/data/hintergrund.json) mit beiden Lagen je Punkt. Im Plan blenden die Flächen mit den Linien über, in der geografischen Karte zeigt die Grundkarte das Original.

Jede Version trägt einen **Status**:

- `belegt`: Der Linienweg ist durch eine Quelle belegt.
- `abgeleitet`: Die Endpunkte sind belegt, die Zwischenhalte sind rekonstruiert.
- `unsicher`: Die Quellen widersprechen sich.

## Busse

Die VBZ-Stadtbuslinien 31–99 (Autobus, Trolleybus und die von Auftragsunternehmen gefahrenen Linien) sind ab 2015 erfasst. Nachtnetz und Regionallinien gehören nicht dazu.

| Datei | Inhalt |
|---|---|
| [`data/busse.yaml`](data/busse.yaml) | Linien und Versionen wie in `linien.yaml`, mit `art: bus`. Der Linienweg ist eine Haltestellenliste. |
| [`data/bus/haltestellen.json`](data/bus/haltestellen.json) | Bushaltestellen, die keine Tramhaltestelle sind, mit Lage aus den Fahrplandaten |
| [`data/bus/kanten.json`](data/bus/kanten.json) | Fahrweg je Haltestellenpaar aus GTFS `shapes.txt` (vereinfacht auf 2 m) |

Busse fahren auf Strassen, die das Archiv nicht aus OSM lädt. Haltestellen und Fahrwege kommen deshalb aus den Fahrplandaten, nicht aus OSM. Haltestellen mit gleichem Namen wie eine Tramhaltestelle sind dieselbe Haltestelle und liegen dort, wo das Tram hält.

```bash
node scripts/import/import-fahrplan.mjs --bus    # Bericht in data/import/bus/, schreibt data/bus/
node scripts/import/bus-versionen.mjs --neu      # data/busse.yaml neu erzeugen (überschreibt Handarbeit!)
npm run daten
```

`bus-versionen.mjs` war der einmalige Ausgangspunkt. Seither wird `data/busse.yaml` von Hand gepflegt; der Import vergleicht nur noch (`data/import/bus/bericht.md`). Umbenannte Bushaltestellen stehen dort unter `fahrplan_alias`. Der Bericht listet Haltestellen, die weniger als 60 m auseinanderliegen, als Kandidaten.

Regeln beim Erzeugen der Versionen:

- Vorübergehende Zeiträume (unter 8 Wochen oder zwischen zwei gleichen Wegen) entfallen, wie beim Tram.
- Ein Wechsel in den GTFS-Daten liegt auf einem Wochenbeginn. Fällt ein Fahrplanwechsel in diese Woche, gilt sein Datum.
- Ein Wechsel zwischen zwei Stichwochen (2015–2018) wird auf den Fahrplanwechsel dazwischen gesetzt. Der Weg der ersten Stichwoche (Oktober 2015) gilt ab dem Fahrplanwechsel Dezember 2014.

Grenzen:

- **Vor 2015 gibt es keine Busdaten.** Die Übersicht zeigt das, und der Zeitstrahl zählt 2015 keine Busse als neue Linien.
- Der Busstand 2015 stammt aus der Stichwoche im Oktober, das Archiv zeigt ihn für den 1. Juli.
- Die Linien 39 und 73 fehlen in den VBZ-Fahrzeiten und sind erst ab Dezember 2018 (GTFS) erfasst.
- Der häufigste Weg verdeckt Äste und Teilstrecken, wie beim Tram.
- Abschnitte, die nur 2015–2018 befahren wurden, haben keinen Fahrweg und sind als Gerade gezeichnet.
- Ein Abschnitt hat einen Fahrweg für beide Richtungen, auch wo Busse in der Gegenrichtung eine andere Strasse nehmen.
- Busse liegen nicht im Bündel mit Trams auf derselben Strasse, sondern daneben.
- Im Liniennetzplan sind die Busse heuristisch dazugelegt (siehe [Busse im Plan](#busse-im-plan)), nicht mit dem Tram zusammen optimiert.

## Fahrplandaten-Import

Die Linienwege ab 2015 werden mit offenen Fahrplandaten der Stadt Zürich (CC0) geprüft:

| Quelle | Zeitraum | Abdeckung |
|---|---|---|
| [GTFS-Fahrplandaten VBZ/ZVV](https://data.stadt-zuerich.ch/dataset/vbz_fahrplandaten_gtfs) | Fahrplanjahre 2019–2026 (ab Dezember 2018) | lückenlos, Woche für Woche |
| [Fahrzeiten SOLL-IST VBZ](https://data.stadt-zuerich.ch/dataset?q=vbz_fahrzeiten_ogd) | 2015–2018 | je eine Stichwoche (Mai, 2015 Oktober) |

```bash
python3 scripts/import/fetch-fahrplan.py         # Rohdaten nach data/raw/gtfs/ und data/raw/fahrzeiten/ (ca. 1,5 GB, nicht im Repo)
npm run daten                                    # netz.json muss aktuell sein
node scripts/import/import-fahrplan.mjs          # ca. 3 Minuten
```

Das Importskript macht aus jeder Tramfahrt (mit `--bus` jeder Busfahrt, siehe [Busse](#busse)) eine Folge unserer Haltestellen. GTFS ist ZVV-weit, und Liniennummern wiederholen sich (z.B. Stadtbus Winterthur 1–14). Die Linien werden deshalb über das Präfix der `route_id` gewählt: `1-` VBZ-Tram, `2-` VBZ-Trolleybus, `3-` VBZ-Bus, `4-` VBZ-Auftragslinien. Pro Linie und Woche gilt der häufigste Linienweg. Gleiche Wochen werden zu Zeiträumen zusammengefasst und mit der jeweils gültigen Version in `linien.yaml` verglichen. Es schreibt:

- [`data/import/bericht.md`](data/import/bericht.md): Zeiträume je Linie, Abgleich mit der erfassten Version, Linien ohne Erfassung und unbekannte Haltestellennamen.
- `data/import/fahrplan.json`: dieselben Zeiträume mit Haltestellenfolgen, maschinenlesbar.

Haltestellennamen, die sich umbenannt haben oder anders heissen als in OSM, stehen in `linien.yaml` unter `fahrplan_alias`. Der Wert `null` blendet einen Halt aus, z.B. eine Wendeschlaufe. Die Versionen werden von Hand in `linien.yaml` nachgeführt. Belegte Wege stehen dort als Haltestellenliste mit dem Status `belegt` und den Quellen `gtfs` oder `vbz-fahrzeiten`.

Grenzen:

- **2010–2014 haben keine Fahrplandaten.** Versionen, die vor 2015 beginnen, sind für diese Jahre angenommen.
- 2015–2018 gibt es nur Stichwochen. Ein Wechsel zwischen zwei Stichwochen ist nur auf das Jahr genau eingegrenzt.
- Als vorübergehend gelten Zeiträume unter 8 Wochen oder solche zwischen zwei Zeiträumen mit gleichem Weg. Sie werden nicht als Version übernommen, z.B. die Linie 13 bis Hardturm von Juli 2022 bis August 2023.
- Die Wochen beginnen am Montag. Wechsel am Fahrplanwechsel werden auf das offizielle Datum gesetzt.
- Der häufigste Weg verdeckt Teilstrecken. Bei Linie 9 wendet die Mehrheit der Kurse in Heuried, deshalb meldet der Bericht dort eine Abweichung.
- In GTFS ist die Limmattalbahn (Linie 20) erst ab dem Fahrplanjahr 2026 als Tram eingetragen.

## Quellen und Grenzen des Pilots

- Haltestellen und Gleise stammen aus OpenStreetMap (Stand November 2026, ODbL). Bushaltestellen, Buswege und Busfahrwege stammen aus den Fahrplandaten der Stadt Zürich (CC0). Die Linienwege stammen aus den Wikipedia-Artikeln *Strassenbahn Zürich* und *Linienchronik der Strassenbahn Zürich*.
- Ab 2015 sind die Linienwege mit Fahrplandaten belegt (siehe [Fahrplandaten-Import](#fahrplandaten-import)). **Die Stände 2010–2014 sind nicht mit Primärquellen geprüft.** Für diese Jahre fehlen noch historische Netzpläne oder Fahrpläne.
- Strecken, die es heute nicht mehr gibt, können nicht dargestellt werden, weil der Router nur das heutige Gleisnetz kennt. Ausnahme: Gleise, die in OSM als «im Bau» erfasst sind, z.B. am Bahnhofquai.
- Linienfarben sind die heutigen. Kurse in der Hauptverkehrszeit, Teilstrecken und temporäre Linien sind nicht erfasst, z.B. Linie 16 im Jahr 2026.
- Die Grundkarte ist die Light Base Map von swisstopo.
- Schrift ist Barlow (OFL). Die Kartenbeschriftungen nutzen eigene Glyphen in `public/fonts/`, erzeugt mit `npm run glyphen`.
- Die Planlage ist ein eigenes oktilineares Layout mit dem ZVV-Liniennetzplan (gültig ab 14.12.2025) als Ausgangslage.
- Der Plan zeigt den Stand Dezember 2025, OSM den Stand November 2026. Wo die beiden abweichen, folgt die Planlage dem nächstgelegenen Tramstrich.

## Nächste Etappen

1. Liniennetzplan verfeinern: historische Pläne als weitere Planstände, Beschriftungen wie im Plan.
2. Erfassungswerkzeug für Versionen und Quellen, historische Gleisabschnitte mit Gültigkeit.
3. Busse im Liniennetzplan (gemeinsames Layout), weiter zurückliegende Jahre, historische Grundkarten (swisstopo Zeitreise).
