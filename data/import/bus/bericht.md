# Abgleich Fahrplandaten – erfasste Versionen (Bus)

Erstellt 2026-11-22 mit `scripts/import/import-fahrplan.mjs`.

Quellen:

- `vbz-fahrzeiten-2015`: 2015-10-04 – 2015-10-10 (Stichwoche)
- `vbz-fahrzeiten-2016`: 2016-05-08 – 2016-05-14 (Stichwoche)
- `vbz-fahrzeiten-2017`: 2017-05-07 – 2017-05-13 (Stichwoche)
- `vbz-fahrzeiten-2018`: 2018-05-06 – 2018-05-12 (Stichwoche)
- `gtfs-2019`: 2018-12-09 – 2019-12-14
- `gtfs-2020`: 2019-12-15 – 2020-12-12
- `gtfs-2021`: 2020-12-13 – 2021-12-11
- `gtfs-2022`: 2020-12-13 – 2022-12-18
- `gtfs-2023`: 2022-12-11 – 2023-12-09
- `gtfs-2024`: 2023-12-10 – 2024-12-14
- `gtfs-2025`: 2024-12-15 – 2025-12-13
- `gtfs-2026`: 2025-12-14 – 2026-12-12

Zeiträume unter 8 Wochen oder zwischen zwei Zeiträumen mit gleichem Weg sind als *vorübergehend* markiert (Umleitungen, Baustellen).

## Linie 31

- **2015-09-28 – 2015-10-04** (1 Wo., vbz-fahrzeiten-2015): Hegibachplatz – Schlieren, Zentrum, 28 Halte
  - Version `bus-31@2014-12-14` (belegt): gleich
- **2016-05-02 – 2016-05-08** (1 Wo., vbz-fahrzeiten-2016): Hegibachplatz – Schlieren, Zentrum, 28 Halte
  - Version `bus-31@2014-12-14` (belegt): gleich
- **2017-05-01 – 2017-05-07** (1 Wo., vbz-fahrzeiten-2017): Hegibachplatz – Schlieren, Zentrum, 28 Halte
  - Version `bus-31@2014-12-14` (belegt): gleich
- **2018-04-30 – 2018-05-06** (1 Wo., vbz-fahrzeiten-2018): Farbhof – Kienastenwies, 33 Halte
  - Version `bus-31@2017-12-10` (belegt): gleich
- **2018-12-03 – 2019-07-14** (32 Wo., gtfs-2019): Farbhof – Kienastenwies, 33 Halte
  - Version `bus-31@2017-12-10` (belegt): gleich
- **2019-07-15 – 2021-05-30** (98 Wo., gtfs-2019, gtfs-2020, gtfs-2022): Bahnhof Altstetten – Kienastenwies, 31 Halte
  - Version `bus-31@2019-07-15` (belegt): gleich
- **2021-05-31 – 2025-07-13** (215 Wo., gtfs-2022, gtfs-2023, gtfs-2024, gtfs-2025): Hermetschloo – Kienastenwies, 35 Halte
  - Version `bus-31@2021-05-31` (belegt): gleich
- **2025-07-14 – 2025-08-03** (3 Wo., gtfs-2025) *vorübergehend*: Bahnhofplatz/HB – Hermetschloo, 17 Halte
  - Version `bus-31@2021-05-31` (belegt): abweichend
  - nur erfasst: Central, Neumarkt, Kunsthaus, Sprecherstrasse, Kreuzplatz, Signaustrasse, Hegibachplatz, Freiestrasse, Klusplatz, Kapfstrasse, Schlyfi, Drusbergstrasse, Waserstrasse, Zentrum Witikon, Berghaldenstrasse, Loorenstrasse, Zweiackerstrasse, Kienastenwies
- **2025-08-04 – 2026-12-13** (71 Wo., gtfs-2025, gtfs-2026): Hermetschloo – Kienastenwies, 35 Halte
  - Version `bus-31@2021-05-31` (belegt): gleich

## Linie 32

- **2015-09-28 – 2015-10-04** (1 Wo., vbz-fahrzeiten-2015): Holzerhurd – Strassenverkehrsamt, 26 Halte
  - Version `bus-32@2014-12-14` (belegt): gleich
- **2016-05-02 – 2016-05-08** (1 Wo., vbz-fahrzeiten-2016): Holzerhurd – Strassenverkehrsamt, 26 Halte
  - Version `bus-32@2014-12-14` (belegt): gleich
- **2017-05-01 – 2017-05-07** (1 Wo., vbz-fahrzeiten-2017): Holzerhurd – Strassenverkehrsamt, 26 Halte
  - Version `bus-32@2014-12-14` (belegt): gleich
- **2018-04-30 – 2018-05-06** (1 Wo., vbz-fahrzeiten-2018): Holzerhurd – Strassenverkehrsamt, 26 Halte
  - Version `bus-32@2014-12-14` (belegt): gleich
- **2018-12-03 – 2026-10-04** (409 Wo., gtfs-2019, gtfs-2020, gtfs-2022, gtfs-2023, gtfs-2024, gtfs-2025, gtfs-2026): Holzerhurd – Strassenverkehrsamt, 26 Halte
  - Version `bus-32@2014-12-14` (belegt): gleich
- **2026-10-05 – 2026-10-11** (1 Wo., gtfs-2026) *vorübergehend*: Limmatplatz – Strassenverkehrsamt, 14 Halte
  - Version `bus-32@2014-12-14` (belegt): abweichend
  - nur erfasst: Holzerhurd, Hungerbergstrasse, Zehntenhausplatz, Einfangstrasse, Glaubtenstrasse, Neuaffoltern, Birchdörfli, Brunnenhof, Bucheggplatz, Lägernstrasse, Rotbuchstrasse, Nordstrasse
- **2026-10-12 – 2026-12-13** (9 Wo., gtfs-2026): Holzerhurd – Strassenverkehrsamt, 26 Halte
  - Version `bus-32@2014-12-14` (belegt): gleich

## Linie 33

- **2015-09-28 – 2015-10-04** (1 Wo., vbz-fahrzeiten-2015): Bahnhof Tiefenbrunnen – Triemli, 34 Halte
  - Version `bus-33@2014-12-14` (belegt): gleich
- **2016-05-02 – 2016-05-08** (1 Wo., vbz-fahrzeiten-2016): Hegibachplatz – Triemli, 31 Halte
  - Version `bus-33@2015-12-13` (belegt): gleich
- **2017-05-01 – 2017-05-07** (1 Wo., vbz-fahrzeiten-2017): Bahnhof Tiefenbrunnen – Triemli, 34 Halte
  - Version `bus-33@2016-12-11` (belegt): gleich
- **2018-04-30 – 2018-05-06** (1 Wo., vbz-fahrzeiten-2018): Bahnhof Tiefenbrunnen – Triemli, 34 Halte
  - Version `bus-33@2016-12-11` (belegt): gleich
- **2018-12-03 – 2019-07-14** (32 Wo., gtfs-2019): Kirche Fluntern – Triemli, 23 Halte
  - Version `bus-33@2018-12-09` (belegt): gleich
- **2019-07-15 – 2023-08-20** (214 Wo., gtfs-2019, gtfs-2020, gtfs-2022, gtfs-2023): Bahnhof Tiefenbrunnen – Triemli, 34 Halte
  - Version `bus-33@2019-07-15` (belegt): gleich
- **2023-08-21 – 2023-10-15** (8 Wo., gtfs-2023): Bahnhof Tiefenbrunnen – Triemli, 33 Halte
  - Version `bus-33@2023-08-21` (belegt): gleich
- **2023-10-16 – 2023-10-22** (1 Wo., gtfs-2023) *vorübergehend*: Bahnhof Tiefenbrunnen – Triemli, 33 Halte
  - Version `bus-33@2023-08-21` (belegt): abweichend
  - nur im Fahrplan: Freiestrasse, Hinterbergstrasse
  - nur erfasst: Toblerplatz, Bethanien
- **2023-10-23 – 2023-12-03** (6 Wo., gtfs-2023) *vorübergehend*: Bahnhof Tiefenbrunnen – Triemli, 33 Halte
  - Version `bus-33@2023-08-21` (belegt): gleich
- **2023-12-04 – 2023-12-10** (1 Wo., gtfs-2024) *vorübergehend*: Bahnhof Tiefenbrunnen – Triemli, 33 Halte
  - Version `bus-33@2023-08-21` (belegt): abweichend
  - nur im Fahrplan: Freiestrasse, Hinterbergstrasse
  - nur erfasst: Toblerplatz, Bethanien
- **2023-12-11 – 2024-06-02** (25 Wo., gtfs-2024) *vorübergehend*: Bahnhof Tiefenbrunnen – Triemli, 34 Halte
  - Version `bus-33@2023-08-21` (belegt): abweichend
  - nur im Fahrplan: Freiestrasse
- **2024-06-03 – 2024-07-07** (5 Wo., gtfs-2024) *vorübergehend*: Bahnhof Tiefenbrunnen – Triemli, 33 Halte
  - Version `bus-33@2023-08-21` (belegt): abweichend
  - nur im Fahrplan: Freiestrasse, Hinterbergstrasse
  - nur erfasst: Toblerplatz, Bethanien
- **2024-07-08 – 2024-07-14** (1 Wo., gtfs-2024) *vorübergehend*: Bahnhof Tiefenbrunnen – Triemli, 34 Halte
  - Version `bus-33@2023-08-21` (belegt): abweichend
  - nur im Fahrplan: Freiestrasse
- **2024-07-15 – 2024-07-28** (2 Wo., gtfs-2024) *vorübergehend*: Bahnhof Tiefenbrunnen – Triemli, 33 Halte
  - Version `bus-33@2023-08-21` (belegt): abweichend
  - nur im Fahrplan: Freiestrasse, Hinterbergstrasse
  - nur erfasst: Toblerplatz, Bethanien
- **2024-07-29 – 2024-09-22** (8 Wo., gtfs-2024): Bahnhof Tiefenbrunnen – Triemli, 34 Halte
  - Version `bus-33@2024-07-29` (belegt): gleich
- **2024-09-23 – 2024-09-29** (1 Wo., gtfs-2024) *vorübergehend*: Kirche Fluntern – Triemli, 22 Halte
  - Version `bus-33@2024-07-29` (belegt): abweichend
  - nur im Fahrplan: Hinterbergstrasse
  - nur erfasst: Bahnhof Tiefenbrunnen, Wildbachstrasse, Fröhlichstrasse, Höschgasse, Botanischer Garten, Hegibachplatz, Freiestrasse, Klusplatz, Hölderlinsteig, Klosbach, Hofstrasse, Toblerplatz, Bethanien
- **2024-09-30 – 2026-11-01** (109 Wo., gtfs-2024, gtfs-2025, gtfs-2026): Bahnhof Tiefenbrunnen – Triemli, 34 Halte
  - Version `bus-33@2024-07-29` (belegt): gleich
- **2026-11-02 – 2026-12-13** (6 Wo., gtfs-2026) *vorübergehend*: Hegibachplatz – Triemli, 29 Halte
  - Version `bus-33@2024-07-29` (belegt): abweichend
  - nur erfasst: Bahnhof Tiefenbrunnen, Wildbachstrasse, Fröhlichstrasse, Höschgasse, Botanischer Garten

## Linie 34

- **2015-09-28 – 2015-10-04** (1 Wo., vbz-fahrzeiten-2015): Kienastenwies – Klusplatz, 10 Halte
  - Version `bus-34@2014-12-14` (belegt): gleich
- **2016-05-02 – 2016-05-08** (1 Wo., vbz-fahrzeiten-2016): Kienastenwies – Klusplatz, 10 Halte
  - Version `bus-34@2014-12-14` (belegt): gleich
- **2017-05-01 – 2017-05-07** (1 Wo., vbz-fahrzeiten-2017): Kienastenwies – Klusplatz, 10 Halte
  - Version `bus-34@2014-12-14` (belegt): gleich

## Linie 35

- **2015-09-28 – 2015-10-04** (1 Wo., vbz-fahrzeiten-2015): Friedhof Eichbühl – Solidapark, 12 Halte
  - Version `bus-35@2014-12-14` (belegt): gleich
- **2016-05-02 – 2016-05-08** (1 Wo., vbz-fahrzeiten-2016): Friedhof Eichbühl – Solidapark, 12 Halte
  - Version `bus-35@2014-12-14` (belegt): gleich
- **2017-05-01 – 2017-05-07** (1 Wo., vbz-fahrzeiten-2017): Friedhof Eichbühl – Solidapark, 12 Halte
  - Version `bus-35@2014-12-14` (belegt): gleich
- **2018-04-30 – 2018-05-06** (1 Wo., vbz-fahrzeiten-2018): Farbhof – Friedhof Eichbühl, 10 Halte
  - Version `bus-35@2017-12-10` (belegt): gleich
- **2018-12-03 – 2018-12-09** (1 Wo., gtfs-2019) *vorübergehend*: Farbhof – Friedhof Eichbühl, 10 Halte
  - Version `bus-35@2017-12-10` (belegt): gleich
- **2018-12-10 – 2019-07-14** (31 Wo., gtfs-2019): Friedhof Eichbühl – Solidapark, 12 Halte
  - Version `bus-35@2018-12-09` (belegt): gleich
- **2019-07-15 – 2021-05-30** (98 Wo., gtfs-2019, gtfs-2020, gtfs-2022): Bahnhof Altstetten – Dunkelhölzli, 9 Halte
  - Version `bus-35@2019-07-15` (belegt): gleich
- **2021-05-31 – 2022-01-16** (33 Wo., gtfs-2022) *vorübergehend*: Bahnhof Altstetten – Dunkelhölzli, 10 Halte
  - Version `bus-35@2019-07-15` (belegt): abweichend
  - nur im Fahrplan: Bristenstrasse
- **2022-01-17 – 2022-09-04** (33 Wo., gtfs-2022) *vorübergehend*: Bahnhof Altstetten – Dunkelhölzli, 9 Halte
  - Version `bus-35@2019-07-15` (belegt): gleich
- **2022-09-05 – 2025-12-14** (171 Wo., gtfs-2022, gtfs-2023, gtfs-2024, gtfs-2025, gtfs-2026): Bahnhof Altstetten – Dunkelhölzli, 10 Halte
  - Version `bus-35@2022-09-05` (belegt): gleich

## Linie 37

- **2015-09-28 – 2015-10-04** (1 Wo., vbz-fahrzeiten-2015): ETH Hönggerberg – Waidhof, 11 Halte
  - Version `bus-37@2014-12-14` (belegt): gleich
- **2016-05-02 – 2016-05-08** (1 Wo., vbz-fahrzeiten-2016): Bahnhof Affoltern – ETH Hönggerberg, 6 Halte
  - Version `bus-37@2015-12-13` (belegt): gleich
- **2017-05-01 – 2017-05-07** (1 Wo., vbz-fahrzeiten-2017): Bahnhof Affoltern – ETH Hönggerberg, 6 Halte
  - Version `bus-37@2015-12-13` (belegt): gleich
- **2018-04-30 – 2018-05-06** (1 Wo., vbz-fahrzeiten-2018): Bahnhof Affoltern – ETH Hönggerberg, 6 Halte
  - Version `bus-37@2015-12-13` (belegt): gleich
- **2018-12-03 – 2023-12-10** (262 Wo., gtfs-2019, gtfs-2020, gtfs-2022, gtfs-2023, gtfs-2024): Bahnhof Affoltern – ETH Hönggerberg, 6 Halte
  - Version `bus-37@2015-12-13` (belegt): gleich
- **2023-12-11 – 2026-12-13** (157 Wo., gtfs-2024, gtfs-2025, gtfs-2026): ETH Hönggerberg – Mühlacker, 9 Halte
  - Version `bus-37@2023-12-10` (belegt): gleich

## Linie 38

- **2015-09-28 – 2015-10-04** (1 Wo., vbz-fahrzeiten-2015): Schützenhaus Höngg – Waidspital, 12 Halte
  - Version `bus-38@2014-12-14` (belegt): gleich
- **2016-05-02 – 2016-05-08** (1 Wo., vbz-fahrzeiten-2016): Schützenhaus Höngg – Waidspital, 12 Halte
  - Version `bus-38@2014-12-14` (belegt): gleich
- **2017-05-01 – 2017-05-07** (1 Wo., vbz-fahrzeiten-2017): Schützenhaus Höngg – Waidspital, 12 Halte
  - Version `bus-38@2014-12-14` (belegt): gleich
- **2018-04-30 – 2018-05-06** (1 Wo., vbz-fahrzeiten-2018): Schützenhaus Höngg – Waidspital, 12 Halte
  - Version `bus-38@2014-12-14` (belegt): gleich
- **2018-12-03 – 2024-08-25** (299 Wo., gtfs-2019, gtfs-2020, gtfs-2022, gtfs-2023, gtfs-2024): Schützenhaus Höngg – Waidspital, 12 Halte
  - Version `bus-38@2014-12-14` (belegt): gleich
- **2024-08-26 – 2025-08-31** (53 Wo., gtfs-2024, gtfs-2025) *vorübergehend*: Friedhof Hönggerberg – Waidspital, 11 Halte
  - Version `bus-38@2014-12-14` (belegt): abweichend
  - nur erfasst: Schützenhaus Höngg
- **2025-09-01 – 2026-12-13** (67 Wo., gtfs-2025, gtfs-2026): Schützenhaus Höngg – Waidspital, 12 Halte
  - Version `bus-38@2014-12-14` (belegt): gleich

## Linie 39

- **2018-12-03 – 2019-12-15** (54 Wo., gtfs-2019, gtfs-2020): Im Klösterli – Letzistrasse, 12 Halte
  - Version `bus-39@2018-12-09` (belegt): gleich
- **2019-12-16 – 2022-06-26** (132 Wo., gtfs-2020, gtfs-2022): Im Klösterli – Letzistrasse, 13 Halte
  - Version `bus-39@2019-12-15` (belegt): gleich
- **2022-06-27 – 2022-07-10** (2 Wo., gtfs-2022) *vorübergehend*: Letzistrasse – Zoo, 12 Halte
  - Version `bus-39@2019-12-15` (belegt): abweichend
  - nur erfasst: Im Klösterli
- **2022-07-11 – 2023-06-04** (47 Wo., gtfs-2022, gtfs-2023): Im Klösterli – Letzistrasse, 13 Halte
  - Version `bus-39@2019-12-15` (belegt): gleich
- **2023-06-05 – 2023-08-27** (12 Wo., gtfs-2023) *vorübergehend*: Im Klösterli – Universität Irchel, 12 Halte
  - Version `bus-39@2019-12-15` (belegt): abweichend
  - nur erfasst: Letzistrasse
- **2023-08-28 – 2026-12-13** (172 Wo., gtfs-2023, gtfs-2024, gtfs-2025, gtfs-2026): Im Klösterli – Letzistrasse, 13 Halte
  - Version `bus-39@2019-12-15` (belegt): gleich

## Linie 40

- **2015-09-28 – 2015-10-04** (1 Wo., vbz-fahrzeiten-2015): Bucheggplatz – Glaubtenstrasse, 8 Halte
  - Version `bus-40@2014-12-14` (belegt): abweichend
  - nur im Fahrplan: Maienweg (Zürich)
  - nur erfasst: Maienweg
  - Notiz der Version: Weg aus der Stichwoche Oktober 2015, ab dem Fahrplanwechsel Dezember 2014 angenommen.
- **2016-05-02 – 2016-05-08** (1 Wo., vbz-fahrzeiten-2016): Bucheggplatz – Seebacherplatz, 15 Halte
  - Version `bus-40@2015-12-13` (belegt): abweichend
  - nur im Fahrplan: Maienweg (Zürich)
  - nur erfasst: Maienweg
  - Notiz der Version: Wechsel zwischen zwei Stichwochen, auf den Fahrplanwechsel 2015-12-13 gesetzt.
- **2017-05-01 – 2017-05-07** (1 Wo., vbz-fahrzeiten-2017): Bucheggplatz – Seebach, 16 Halte
  - Version `bus-40@2016-12-11` (belegt): abweichend
  - nur im Fahrplan: Maienweg (Zürich)
  - nur erfasst: Maienweg
  - Notiz der Version: Wechsel zwischen zwei Stichwochen, auf den Fahrplanwechsel 2016-12-11 gesetzt.
- **2018-04-30 – 2018-05-06** (1 Wo., vbz-fahrzeiten-2018): Bucheggplatz – Seebach, 16 Halte
  - Version `bus-40@2016-12-11` (belegt): abweichend
  - nur im Fahrplan: Maienweg (Zürich)
  - nur erfasst: Maienweg
  - Notiz der Version: Wechsel zwischen zwei Stichwochen, auf den Fahrplanwechsel 2016-12-11 gesetzt.
- **2018-12-03 – 2018-12-16** (2 Wo., gtfs-2019) *vorübergehend*: Bucheggplatz – Seebacherplatz, 15 Halte
  - Version `bus-40@2016-12-11` (belegt): abweichend
  - nur im Fahrplan: Maienweg (Zürich)
  - nur erfasst: Maienweg, Seebach
- **2018-12-17 – 2020-05-17** (74 Wo., gtfs-2019, gtfs-2020): Bucheggplatz – Seebach, 16 Halte
  - Version `bus-40@2016-12-11` (belegt): abweichend
  - nur im Fahrplan: Maienweg (Zürich)
  - nur erfasst: Maienweg
  - Notiz der Version: Wechsel zwischen zwei Stichwochen, auf den Fahrplanwechsel 2016-12-11 gesetzt.
- **2020-05-18 – 2020-07-19** (9 Wo., gtfs-2020) *vorübergehend*: Bucheggplatz – Seebach, 15 Halte
  - Version `bus-40@2016-12-11` (belegt): abweichend
  - nur im Fahrplan: Maienweg (Zürich)
  - nur erfasst: Maienweg, Hürstholz
- **2020-07-20 – 2026-12-13** (334 Wo., gtfs-2020, gtfs-2022, gtfs-2023, gtfs-2024, gtfs-2025, gtfs-2026): Bucheggplatz – Seebach, 16 Halte
  - Version `bus-40@2016-12-11` (belegt): abweichend
  - nur im Fahrplan: Maienweg (Zürich)
  - nur erfasst: Maienweg
  - Notiz der Version: Wechsel zwischen zwei Stichwochen, auf den Fahrplanwechsel 2016-12-11 gesetzt.

## Linie 42

- **2023-12-11 – 2026-05-03** (125 Wo., gtfs-2024, gtfs-2025, gtfs-2026): ETH Hönggerberg – Seebach, 12 Halte
  - Version `bus-42@2023-12-10` (belegt): gleich
- **2026-05-04 – 2026-05-10** (1 Wo., gtfs-2026) *vorübergehend*: ETH Hönggerberg – Seebach, 10 Halte
  - Version `bus-42@2023-12-10` (belegt): abweichend
  - nur im Fahrplan: Himmeri
  - nur erfasst: Hürstholz, Staudenbühl, Friedhof Schwandenholz
- **2026-05-11 – 2026-12-13** (31 Wo., gtfs-2026): ETH Hönggerberg – Seebach, 12 Halte
  - Version `bus-42@2023-12-10` (belegt): gleich

## Linie 44

- **2025-12-15 – 2026-12-13** (52 Wo., gtfs-2026): ETH Hönggerberg – Reckenholz, 10 Halte
  - Version `bus-44@2025-12-14` (belegt): gleich

## Linie 45

- **2025-12-08 – 2026-04-05** (17 Wo., gtfs-2026): Dunkelhölzli – Werdhölzli, 13 Halte
  - Version `bus-45@2025-12-14` (belegt): gleich
- **2026-04-06 – 2026-09-20** (24 Wo., gtfs-2026): Dunkelhölzli – Werdhölzli, 14 Halte
  - Version `bus-45@2026-04-06` (belegt): gleich
- **2026-09-21 – 2026-12-13** (12 Wo., gtfs-2026): Dunkelhölzli – Werdhölzli, 13 Halte
  - Version `bus-45@2026-09-21` (belegt): gleich

## Linie 46

- **2015-09-28 – 2015-10-04** (1 Wo., vbz-fahrzeiten-2015): Bahnhofquai/HB – Rütihof, 19 Halte
  - Version `bus-46@2014-12-14` (belegt): gleich
- **2016-05-02 – 2016-05-08** (1 Wo., vbz-fahrzeiten-2016): Bahnhofquai/HB – Rütihof, 19 Halte
  - Version `bus-46@2014-12-14` (belegt): gleich
- **2017-05-01 – 2017-05-07** (1 Wo., vbz-fahrzeiten-2017): Bahnhofquai/HB – Rütihof, 19 Halte
  - Version `bus-46@2014-12-14` (belegt): gleich
- **2018-04-30 – 2018-05-06** (1 Wo., vbz-fahrzeiten-2018): Bahnhofquai/HB – Rütihof, 19 Halte
  - Version `bus-46@2014-12-14` (belegt): gleich
- **2018-12-03 – 2022-05-01** (178 Wo., gtfs-2019, gtfs-2020, gtfs-2022): Bahnhofquai/HB – Rütihof, 19 Halte
  - Version `bus-46@2014-12-14` (belegt): gleich
- **2022-05-02 – 2022-05-22** (3 Wo., gtfs-2022) *vorübergehend*: Bahnhofquai/HB – Rütihof, 18 Halte
  - Version `bus-46@2014-12-14` (belegt): abweichend
  - nur im Fahrplan: Nordstrasse
  - nur erfasst: Central, Okenstrasse
- **2022-05-23 – 2023-04-02** (45 Wo., gtfs-2022, gtfs-2023): Bahnhofquai/HB – Rütihof, 19 Halte
  - Version `bus-46@2014-12-14` (belegt): gleich
- **2023-04-03 – 2023-12-03** (35 Wo., gtfs-2023) *vorübergehend*: Bahnhofquai/HB – Rütihof, 19 Halte
  - Version `bus-46@2014-12-14` (belegt): abweichend
  - nur im Fahrplan: Nordstrasse, Rotbuchstrasse, Nürenbergstrasse
  - nur erfasst: Central, Okenstrasse, Lettenstrasse
- **2023-12-04 – 2024-07-14** (32 Wo., gtfs-2024): Bahnhofquai/HB – Rütihof, 19 Halte
  - Version `bus-46@2014-12-14` (belegt): gleich
- **2024-07-15 – 2024-08-04** (3 Wo., gtfs-2024) *vorübergehend*: Bahnhofquai/HB – Rütihof, 19 Halte
  - Version `bus-46@2014-12-14` (belegt): abweichend
  - nur im Fahrplan: Beckenhof, Nordstrasse
  - nur erfasst: Central, Okenstrasse
- **2024-08-05 – 2024-10-13** (10 Wo., gtfs-2024) *vorübergehend*: Bahnhofquai/HB – Rütihof, 19 Halte
  - Version `bus-46@2014-12-14` (belegt): gleich
- **2024-10-14 – 2024-10-20** (1 Wo., gtfs-2024) *vorübergehend*: Bahnhofquai/HB – Rütihof, 19 Halte
  - Version `bus-46@2014-12-14` (belegt): abweichend
  - nur im Fahrplan: Beckenhof, Nordstrasse
  - nur erfasst: Central, Okenstrasse
- **2024-10-21 – 2025-05-04** (28 Wo., gtfs-2024, gtfs-2025) *vorübergehend*: Bahnhofquai/HB – Rütihof, 19 Halte
  - Version `bus-46@2014-12-14` (belegt): gleich
- **2025-05-05 – 2025-05-11** (1 Wo., gtfs-2025) *vorübergehend*: Bahnhofquai/HB – Rütihof, 19 Halte
  - Version `bus-46@2014-12-14` (belegt): abweichend
  - nur im Fahrplan: Beckenhof, Nordstrasse
  - nur erfasst: Central, Okenstrasse
- **2025-05-12 – 2025-05-18** (1 Wo., gtfs-2025) *vorübergehend*: Bahnhofquai/HB – Rütihof, 19 Halte
  - Version `bus-46@2014-12-14` (belegt): gleich
- **2025-05-19 – 2025-05-25** (1 Wo., gtfs-2025) *vorübergehend*: Bahnhofquai/HB – Rütihof, 19 Halte
  - Version `bus-46@2014-12-14` (belegt): abweichend
  - nur im Fahrplan: Beckenhof, Nordstrasse
  - nur erfasst: Central, Okenstrasse
- **2025-05-26 – 2025-06-01** (1 Wo., gtfs-2025) *vorübergehend*: Bahnhofquai/HB – Rütihof, 19 Halte
  - Version `bus-46@2014-12-14` (belegt): gleich
- **2025-06-02 – 2025-07-13** (6 Wo., gtfs-2025) *vorübergehend*: Bahnhofquai/HB – Rütihof, 19 Halte
  - Version `bus-46@2014-12-14` (belegt): abweichend
  - nur im Fahrplan: Beckenhof, Nordstrasse
  - nur erfasst: Central, Okenstrasse
- **2025-07-14 – 2025-08-03** (3 Wo., gtfs-2025) *vorübergehend*: Limmatplatz – Rütihof, 17 Halte
  - Version `bus-46@2014-12-14` (belegt): abweichend
  - nur im Fahrplan: Limmatplatz, Nordstrasse
  - nur erfasst: Bahnhofquai/HB, Central, Stampfenbachplatz, Okenstrasse
- **2025-08-04 – 2026-01-11** (23 Wo., gtfs-2025, gtfs-2026): Bahnhofquai/HB – Rütihof, 19 Halte
  - Version `bus-46@2014-12-14` (belegt): gleich
- **2026-01-12 – 2026-01-18** (1 Wo., gtfs-2026) *vorübergehend*: Bahnhofquai/HB – Rütihof, 19 Halte
  - Version `bus-46@2014-12-14` (belegt): abweichend
  - nur im Fahrplan: Nordstrasse, Rotbuchstrasse
  - nur erfasst: Okenstrasse, Lettenstrasse
- **2026-01-19 – 2026-12-13** (47 Wo., gtfs-2026): Bahnhofquai/HB – Rütihof, 19 Halte
  - Version `bus-46@2014-12-14` (belegt): gleich

## Linie 61

- **2015-09-28 – 2015-10-04** (1 Wo., vbz-fahrzeiten-2015): Mühlacker – Schwamendingerplatz, 18 Halte
  - Version `bus-61@2014-12-14` (belegt): gleich
- **2016-05-02 – 2016-05-08** (1 Wo., vbz-fahrzeiten-2016): Mühlacker – Schwamendingerplatz, 20 Halte
  - Version `bus-61@2015-12-13` (belegt): gleich
- **2017-05-01 – 2017-05-07** (1 Wo., vbz-fahrzeiten-2017): Mühlacker – Schwamendingerplatz, 20 Halte
  - Version `bus-61@2015-12-13` (belegt): gleich
- **2018-04-30 – 2018-05-06** (1 Wo., vbz-fahrzeiten-2018): Mühlacker – Schwamendingerplatz, 20 Halte
  - Version `bus-61@2015-12-13` (belegt): gleich
- **2018-12-03 – 2023-12-10** (262 Wo., gtfs-2019, gtfs-2020, gtfs-2022, gtfs-2023, gtfs-2024): Mühlacker – Schwamendingerplatz, 20 Halte
  - Version `bus-61@2015-12-13` (belegt): gleich
- **2023-12-11 – 2024-08-04** (34 Wo., gtfs-2024): Mühlacker – Wallisellen, Glatt (Bus), 22 Halte
  - Version `bus-61@2023-12-10` (belegt): gleich
- **2024-08-05 – 2024-09-22** (7 Wo., gtfs-2024) *vorübergehend*: Mühlacker – Wallisellen, Glatt (Bus), 24 Halte
  - Version `bus-61@2023-12-10` (belegt): abweichend
  - nur im Fahrplan: Max-Bill-Platz, Bahnhof Oerlikon Ost
- **2024-09-23 – 2026-10-18** (108 Wo., gtfs-2024, gtfs-2025, gtfs-2026): Mühlacker – Wallisellen, Glatt (Bus), 22 Halte
  - Version `bus-61@2023-12-10` (belegt): gleich
- **2026-10-19 – 2026-12-13** (8 Wo., gtfs-2026): Mühlacker – Wallisellen, Glatt (Bus), 22 Halte
  - Version `bus-61@2026-10-19` (belegt): gleich

## Linie 62

- **2015-09-28 – 2015-10-04** (1 Wo., vbz-fahrzeiten-2015): Schwamendingerplatz – Unteraffoltern, 17 Halte
  - Version `bus-62@2014-12-14` (belegt): gleich
- **2016-05-02 – 2016-05-08** (1 Wo., vbz-fahrzeiten-2016): Schwamendingerplatz – Waidhof, 21 Halte
  - Version `bus-62@2015-12-13` (belegt): gleich
- **2017-05-01 – 2017-05-07** (1 Wo., vbz-fahrzeiten-2017): Schwamendingerplatz – Waidhof, 21 Halte
  - Version `bus-62@2015-12-13` (belegt): gleich
- **2018-04-30 – 2018-05-06** (1 Wo., vbz-fahrzeiten-2018): Schwamendingerplatz – Waidhof, 21 Halte
  - Version `bus-62@2015-12-13` (belegt): gleich
- **2018-12-03 – 2024-08-04** (296 Wo., gtfs-2019, gtfs-2020, gtfs-2022, gtfs-2023, gtfs-2024): Schwamendingerplatz – Waidhof, 21 Halte
  - Version `bus-62@2015-12-13` (belegt): gleich
- **2024-08-05 – 2024-09-22** (7 Wo., gtfs-2024) *vorübergehend*: Schwamendingerplatz – Waidhof, 23 Halte
  - Version `bus-62@2015-12-13` (belegt): abweichend
  - nur im Fahrplan: Bahnhof Oerlikon Ost, Max-Bill-Platz
- **2024-09-23 – 2025-03-02** (23 Wo., gtfs-2024, gtfs-2025): Schwamendingerplatz – Waidhof, 21 Halte
  - Version `bus-62@2015-12-13` (belegt): gleich
- **2025-03-03 – 2025-08-03** (22 Wo., gtfs-2025): Schwamendingerplatz – Waidhof, 20 Halte
  - Version `bus-62@2025-03-03` (belegt): gleich
- **2025-08-04 – 2025-08-10** (1 Wo., gtfs-2025) *vorübergehend*: Schwamendingerplatz – Waidhof, 20 Halte
  - Version `bus-62@2025-03-03` (belegt): abweichend
  - nur im Fahrplan: Herzogenmühlestrasse, Aubrücke, Dreispitz
  - nur erfasst: Tulpenstrasse, Herbstweg, Hallenbad Oerlikon
- **2025-08-11 – 2025-08-24** (2 Wo., gtfs-2025) *vorübergehend*: Schwamendingerplatz – Waidhof, 20 Halte
  - Version `bus-62@2025-03-03` (belegt): gleich
- **2025-08-25 – 2026-12-13** (68 Wo., gtfs-2025, gtfs-2026): Schwamendingerplatz – Waidhof, 21 Halte
  - Version `bus-62@2025-08-25` (belegt): gleich

## Linie 63

- **2015-09-28 – 2015-10-04** (1 Wo., vbz-fahrzeiten-2015): Bahnhof Oerlikon – Schwamendingerplatz, 10 Halte
  - Version `bus-63@2014-12-14` (belegt): gleich

## Linie 64

- **2015-09-28 – 2015-10-04** (1 Wo., vbz-fahrzeiten-2015): Bahnhof Oerlikon Nord – Maillartstrasse, 6 Halte
  - Version `bus-64@2014-12-14` (belegt): gleich
- **2016-05-02 – 2016-05-08** (1 Wo., vbz-fahrzeiten-2016): Bahnhof Oerlikon Nord – Maillartstrasse, 6 Halte
  - Version `bus-64@2014-12-14` (belegt): gleich
- **2017-05-01 – 2017-05-07** (1 Wo., vbz-fahrzeiten-2017): Bahnhof Oerlikon Nord – Maillartstrasse, 6 Halte
  - Version `bus-64@2014-12-14` (belegt): gleich
- **2018-04-30 – 2018-05-06** (1 Wo., vbz-fahrzeiten-2018): Bahnhof Oerlikon Nord – Maillartstrasse, 6 Halte
  - Version `bus-64@2014-12-14` (belegt): gleich
- **2018-12-03 – 2023-12-10** (262 Wo., gtfs-2019, gtfs-2020, gtfs-2022, gtfs-2023, gtfs-2024): Bahnhof Oerlikon Nord – Maillartstrasse, 6 Halte
  - Version `bus-64@2014-12-14` (belegt): gleich
- **2023-12-11 – 2026-12-13** (157 Wo., gtfs-2024, gtfs-2025, gtfs-2026): Bahnhof Oerlikon Nord – Bahnhof Oerlikon Nord, 11 Halte
  - Version `bus-64@2023-12-10` (belegt): gleich

## Linie 66

- **2015-09-28 – 2015-10-04** (1 Wo., vbz-fahrzeiten-2015): Morgental – Neubühl, 4 Halte
  - Version `bus-66@2014-12-14` (belegt): gleich
- **2016-05-02 – 2016-05-08** (1 Wo., vbz-fahrzeiten-2016): Morgental – Neubühl, 4 Halte
  - Version `bus-66@2014-12-14` (belegt): gleich
- **2017-05-01 – 2017-05-07** (1 Wo., vbz-fahrzeiten-2017): Morgental – Neubühl, 4 Halte
  - Version `bus-66@2014-12-14` (belegt): gleich
- **2018-04-30 – 2018-05-06** (1 Wo., vbz-fahrzeiten-2018): Morgental – Neubühl, 4 Halte
  - Version `bus-66@2014-12-14` (belegt): gleich
- **2018-12-03 – 2023-01-08** (214 Wo., gtfs-2019, gtfs-2020, gtfs-2022, gtfs-2023): Morgental – Neubühl, 4 Halte
  - Version `bus-66@2014-12-14` (belegt): gleich
- **2023-01-09 – 2023-05-07** (17 Wo., gtfs-2023) *vorübergehend*: Kilchberg ZH, Kirche – Morgental, 10 Halte
  - Version `bus-66@2014-12-14` (belegt): abweichend
  - nur im Fahrplan: Kilchberg ZH, Kirche, Kilchberg ZH, Alterszentrum, Kilchberg ZH, Stockengut, Kilchberg ZH, Breitloo, Kilchberg ZH, Bächlerstrasse, Obere Hornhalde
- **2023-05-08 – 2023-07-02** (8 Wo., gtfs-2023) *vorübergehend*: Morgental – Neubühl, 4 Halte
  - Version `bus-66@2014-12-14` (belegt): gleich
- **2023-07-03 – 2023-07-09** (1 Wo., gtfs-2023) *vorübergehend*: Kilchberg ZH, Kirche – Morgental, 10 Halte
  - Version `bus-66@2014-12-14` (belegt): abweichend
  - nur im Fahrplan: Kilchberg ZH, Kirche, Kilchberg ZH, Alterszentrum, Kilchberg ZH, Stockengut, Kilchberg ZH, Breitloo, Kilchberg ZH, Bächlerstrasse, Obere Hornhalde
- **2023-07-10 – 2023-12-24** (24 Wo., gtfs-2023, gtfs-2024) *vorübergehend*: Morgental – Neubühl, 4 Halte
  - Version `bus-66@2014-12-14` (belegt): gleich
- **2023-12-25 – 2023-12-31** (1 Wo., gtfs-2024) *vorübergehend*: Kilchberg ZH, Kirche – Morgental, 10 Halte
  - Version `bus-66@2014-12-14` (belegt): abweichend
  - nur im Fahrplan: Kilchberg ZH, Kirche, Kilchberg ZH, Alterszentrum, Kilchberg ZH, Stockengut, Kilchberg ZH, Breitloo, Kilchberg ZH, Bächlerstrasse, Obere Hornhalde
- **2024-01-01 – 2024-12-15** (50 Wo., gtfs-2024, gtfs-2025): Morgental – Neubühl, 4 Halte
  - Version `bus-66@2014-12-14` (belegt): gleich
- **2024-12-16 – 2025-05-11** (21 Wo., gtfs-2025): Bahnhof Enge/Bederstrasse – Kilchberg ZH, Kirche, 16 Halte
  - Version `bus-66@2024-12-15` (belegt): gleich
- **2025-05-12 – 2025-08-31** (16 Wo., gtfs-2025) *vorübergehend*: Bahnhof Enge/Bederstrasse – Kilchberg ZH, Alterszentrum, 16 Halte
  - Version `bus-66@2024-12-15` (belegt): abweichend
  - nur im Fahrplan: Waffenplatzstrasse, Kilchberg ZH, Lätten, Kilchberg ZH, Schlimbergstr., Kilchberg ZH, Gottlieb-Binder
  - nur erfasst: Waffenplatz-/Bederstr., Kilchberg ZH, Bächlerstrasse, Kilchberg ZH, Stockengut, Kilchberg ZH, Kirche
- **2025-09-01 – 2026-12-13** (67 Wo., gtfs-2025, gtfs-2026): Bahnhof Enge/Bederstrasse – Kilchberg ZH, Kirche, 16 Halte
  - Version `bus-66@2024-12-15` (belegt): gleich

## Linie 67

- **2015-09-28 – 2015-10-04** (1 Wo., vbz-fahrzeiten-2015): Dunkelhölzli – Schmiede Wiedikon, 14 Halte
  - Version `bus-67@2014-12-14` (belegt): gleich
- **2016-05-02 – 2016-05-08** (1 Wo., vbz-fahrzeiten-2016): Bahnhof Wiedikon – Dunkelhölzli, 15 Halte
  - Version `bus-67@2015-12-13` (belegt): gleich
- **2017-05-01 – 2017-05-07** (1 Wo., vbz-fahrzeiten-2017): Bahnhof Wiedikon – Dunkelhölzli, 15 Halte
  - Version `bus-67@2015-12-13` (belegt): gleich
- **2018-04-30 – 2018-05-06** (1 Wo., vbz-fahrzeiten-2018): Bahnhof Wiedikon – Dunkelhölzli, 15 Halte
  - Version `bus-67@2015-12-13` (belegt): gleich
- **2018-12-03 – 2026-12-13** (419 Wo., gtfs-2019, gtfs-2020, gtfs-2022, gtfs-2023, gtfs-2024, gtfs-2025, gtfs-2026): Bahnhof Wiedikon – Dunkelhölzli, 15 Halte
  - Version `bus-67@2015-12-13` (belegt): gleich

## Linie 69

- **2015-09-28 – 2015-10-04** (1 Wo., vbz-fahrzeiten-2015): ETH Hönggerberg – Milchbuck, 9 Halte
  - Version `bus-69@2014-12-14` (belegt): gleich
- **2016-05-02 – 2016-05-08** (1 Wo., vbz-fahrzeiten-2016): ETH Hönggerberg – Milchbuck, 9 Halte
  - Version `bus-69@2014-12-14` (belegt): gleich
- **2017-05-01 – 2017-05-07** (1 Wo., vbz-fahrzeiten-2017): ETH Hönggerberg – Milchbuck, 9 Halte
  - Version `bus-69@2014-12-14` (belegt): gleich
- **2018-04-30 – 2018-05-06** (1 Wo., vbz-fahrzeiten-2018): ETH Hönggerberg – Milchbuck, 9 Halte
  - Version `bus-69@2014-12-14` (belegt): gleich
- **2018-12-03 – 2022-07-17** (189 Wo., gtfs-2019, gtfs-2020, gtfs-2022): ETH Hönggerberg – Milchbuck, 9 Halte
  - Version `bus-69@2014-12-14` (belegt): gleich
- **2022-07-18 – 2022-08-21** (5 Wo., gtfs-2022) *vorübergehend*: Bucheggplatz – ETH Hönggerberg, 8 Halte
  - Version `bus-69@2014-12-14` (belegt): abweichend
  - nur erfasst: Milchbuck
- **2022-08-22 – 2023-07-16** (47 Wo., gtfs-2022, gtfs-2023) *vorübergehend*: ETH Hönggerberg – Milchbuck, 9 Halte
  - Version `bus-69@2014-12-14` (belegt): gleich
- **2023-07-17 – 2023-08-20** (5 Wo., gtfs-2023) *vorübergehend*: Bucheggplatz – ETH Hönggerberg, 8 Halte
  - Version `bus-69@2014-12-14` (belegt): abweichend
  - nur erfasst: Milchbuck
- **2023-08-21 – 2024-07-14** (47 Wo., gtfs-2023, gtfs-2024) *vorübergehend*: ETH Hönggerberg – Milchbuck, 9 Halte
  - Version `bus-69@2014-12-14` (belegt): gleich
- **2024-07-15 – 2024-08-18** (5 Wo., gtfs-2024) *vorübergehend*: Bucheggplatz – ETH Hönggerberg, 8 Halte
  - Version `bus-69@2014-12-14` (belegt): abweichend
  - nur erfasst: Milchbuck
- **2024-08-19 – 2026-12-13** (121 Wo., gtfs-2024, gtfs-2025, gtfs-2026): ETH Hönggerberg – Milchbuck, 9 Halte
  - Version `bus-69@2014-12-14` (belegt): gleich

## Linie 70

- **2015-09-28 – 2015-10-04** (1 Wo., vbz-fahrzeiten-2015): Mittelleimbach – Morgental, 10 Halte
  - Version `bus-70@2014-12-14` (belegt): gleich
- **2016-05-02 – 2016-05-08** (1 Wo., vbz-fahrzeiten-2016): Mittelleimbach – Morgental, 10 Halte
  - Version `bus-70@2014-12-14` (belegt): gleich
- **2017-05-01 – 2017-05-07** (1 Wo., vbz-fahrzeiten-2017): Mittelleimbach – Morgental, 10 Halte
  - Version `bus-70@2014-12-14` (belegt): gleich
- **2018-04-30 – 2018-05-06** (1 Wo., vbz-fahrzeiten-2018): Mittelleimbach – Morgental, 10 Halte
  - Version `bus-70@2014-12-14` (belegt): gleich
- **2018-12-03 – 2026-12-13** (419 Wo., gtfs-2019, gtfs-2020, gtfs-2022, gtfs-2023, gtfs-2024, gtfs-2025, gtfs-2026): Bahnhof Wollishofen – Mittelleimbach, 13 Halte
  - Version `bus-70@2018-12-09` (belegt): gleich

## Linie 71

- **2015-09-28 – 2015-10-04** (1 Wo., vbz-fahrzeiten-2015): Friedhof Sihlfeld – Rosengartenstrasse, 8 Halte
  - Version `bus-71@2014-12-14` (belegt): gleich

## Linie 72

- **2015-09-28 – 2015-10-04** (1 Wo., vbz-fahrzeiten-2015): Milchbuck – Morgental, 22 Halte
  - Version `bus-72@2014-12-14` (belegt): gleich
- **2016-05-02 – 2016-05-08** (1 Wo., vbz-fahrzeiten-2016): Milchbuck – Morgental, 22 Halte
  - Version `bus-72@2014-12-14` (belegt): gleich
- **2017-05-01 – 2017-05-07** (1 Wo., vbz-fahrzeiten-2017): Milchbuck – Morgental, 22 Halte
  - Version `bus-72@2014-12-14` (belegt): gleich
- **2018-04-30 – 2018-05-06** (1 Wo., vbz-fahrzeiten-2018): Milchbuck – Morgental, 22 Halte
  - Version `bus-72@2014-12-14` (belegt): gleich
- **2018-12-03 – 2020-02-09** (62 Wo., gtfs-2019, gtfs-2020): Milchbuck – Morgental, 22 Halte
  - Version `bus-72@2014-12-14` (belegt): gleich
- **2020-02-10 – 2026-12-13** (357 Wo., gtfs-2020, gtfs-2022, gtfs-2023, gtfs-2024, gtfs-2025, gtfs-2026): Milchbuck – Morgental, 23 Halte
  - Version `bus-72@2020-02-10` (belegt): gleich

## Linie 73

- **2018-12-03 – 2025-09-07** (353 Wo., gtfs-2019, gtfs-2020, gtfs-2022, gtfs-2023, gtfs-2024, gtfs-2025): Schweighof – Zielweg, 5 Halte
  - Version `bus-73@2018-12-09` (belegt): gleich
- **2025-09-08 – 2025-09-21** (2 Wo., gtfs-2025) *vorübergehend*: Friesenbergstrasse – Zielweg, 4 Halte
  - Version `bus-73@2018-12-09` (belegt): abweichend
  - nur erfasst: Schweighof
- **2025-09-22 – 2026-09-06** (50 Wo., gtfs-2025, gtfs-2026) *vorübergehend*: Schweighof – Zielweg, 5 Halte
  - Version `bus-73@2018-12-09` (belegt): gleich
- **2026-09-07 – 2026-09-20** (2 Wo., gtfs-2026) *vorübergehend*: Friesenbergstrasse – Zielweg, 4 Halte
  - Version `bus-73@2018-12-09` (belegt): abweichend
  - nur erfasst: Schweighof
- **2026-09-21 – 2026-10-18** (4 Wo., gtfs-2026) *vorübergehend*: Schweighof – Zielweg, 5 Halte
  - Version `bus-73@2018-12-09` (belegt): gleich
- **2026-10-19 – 2026-12-13** (8 Wo., gtfs-2026): Friesenbergstrasse – Zielweg, 4 Halte
  - Version `bus-73@2026-10-19` (belegt): gleich

## Linie 75

- **2015-09-28 – 2015-10-04** (1 Wo., vbz-fahrzeiten-2015): Bahnhof Oerlikon Nord – Seebacherplatz, 14 Halte
  - Version `bus-75@2014-12-14` (belegt): gleich
- **2016-05-02 – 2016-05-08** (1 Wo., vbz-fahrzeiten-2016): Schwamendingerplatz – Seebacherplatz, 21 Halte
  - Version `bus-75@2015-12-13` (belegt): gleich
- **2017-05-01 – 2017-05-07** (1 Wo., vbz-fahrzeiten-2017): Schwamendingerplatz – Seebacherplatz, 21 Halte
  - Version `bus-75@2015-12-13` (belegt): gleich
- **2018-04-30 – 2018-05-06** (1 Wo., vbz-fahrzeiten-2018): Schwamendingerplatz – Seebacherplatz, 21 Halte
  - Version `bus-75@2015-12-13` (belegt): gleich
- **2018-12-03 – 2024-09-01** (300 Wo., gtfs-2019, gtfs-2020, gtfs-2022, gtfs-2023, gtfs-2024): Schwamendingerplatz – Seebacherplatz, 21 Halte
  - Version `bus-75@2015-12-13` (belegt): gleich
- **2024-09-02 – 2024-09-08** (1 Wo., gtfs-2024) *vorübergehend*: Auzelg Ost – Seebacherplatz, 26 Halte
  - Version `bus-75@2015-12-13` (belegt): abweichend
  - nur im Fahrplan: Auzelg Ost, Auzelg, Orionstrasse, Aubrücke, Herzogenmühlestrasse
- **2024-09-09 – 2026-01-18** (71 Wo., gtfs-2024, gtfs-2025, gtfs-2026): Schwamendingerplatz – Seebacherplatz, 21 Halte
  - Version `bus-75@2015-12-13` (belegt): gleich
- **2026-01-19 – 2026-02-15** (4 Wo., gtfs-2026) *vorübergehend*: Schwamendingerplatz – Seebacherplatz, 22 Halte
  - Version `bus-75@2015-12-13` (belegt): abweichend
  - nur im Fahrplan: Hertensteinstrasse
  - nur erfasst: Himmeri
- **2026-02-16 – 2026-12-13** (43 Wo., gtfs-2026): Schwamendingerplatz – Seebacherplatz, 21 Halte
  - Version `bus-75@2015-12-13` (belegt): gleich

## Linie 76

- **2015-09-28 – 2015-10-04** (1 Wo., vbz-fahrzeiten-2015): Bahnhof Wiedikon – Binz Center, 7 Halte
  - Version `bus-76@2014-12-14` (belegt): gleich
- **2016-05-02 – 2016-05-08** (1 Wo., vbz-fahrzeiten-2016): Bahnhof Wiedikon – Binz Center, 7 Halte
  - Version `bus-76@2014-12-14` (belegt): gleich
- **2017-05-01 – 2017-05-07** (1 Wo., vbz-fahrzeiten-2017): Bahnhof Wiedikon – Binz Center, 7 Halte
  - Version `bus-76@2014-12-14` (belegt): gleich
- **2018-04-30 – 2018-05-06** (1 Wo., vbz-fahrzeiten-2018): Bahnhof Wiedikon – Binz Center, 7 Halte
  - Version `bus-76@2014-12-14` (belegt): gleich
- **2018-12-10 – 2020-02-09** (61 Wo., gtfs-2019, gtfs-2020): Bahnhof Wiedikon – Binz Center, 7 Halte
  - Version `bus-76@2014-12-14` (belegt): gleich
- **2020-02-10 – 2020-03-29** (7 Wo., gtfs-2020) *vorübergehend*: Bahnhof Wiedikon – Binz Center, 7 Halte
  - Version `bus-76@2014-12-14` (belegt): abweichend
  - nur im Fahrplan: Hertersteg
  - nur erfasst: Grubenstrasse
- **2020-05-04 – 2020-09-20** (20 Wo., gtfs-2020): Bahnhof Wiedikon – Binz Center, 7 Halte
  - Version `bus-76@2020-05-04` (belegt): gleich
- **2020-09-21 – 2021-12-12** (64 Wo., gtfs-2020, gtfs-2022) *vorübergehend*: Bahnhof Wiedikon – Binz Center, 7 Halte
  - Version `bus-76@2020-05-04` (belegt): abweichend
  - nur im Fahrplan: Grubenstrasse
  - nur erfasst: Hertersteg
- **2021-12-13 – 2023-07-16** (83 Wo., gtfs-2022, gtfs-2023) *vorübergehend*: Bahnhof Wiedikon – Binz Center, 7 Halte
  - Version `bus-76@2020-05-04` (belegt): gleich
- **2023-07-17 – 2023-10-29** (15 Wo., gtfs-2023) *vorübergehend*: Bahnhof Wiedikon – Binz Center, 7 Halte
  - Version `bus-76@2020-05-04` (belegt): abweichend
  - nur im Fahrplan: Grubenstrasse
  - nur erfasst: Hertersteg
- **2023-10-30 – 2025-12-14** (111 Wo., gtfs-2023, gtfs-2024, gtfs-2025, gtfs-2026) *vorübergehend*: Bahnhof Wiedikon – Binz Center, 7 Halte
  - Version `bus-76@2020-05-04` (belegt): gleich
- **2025-12-15 – 2026-12-13** (52 Wo., gtfs-2026): Bahnhof Wiedikon – Binz Center, 7 Halte
  - Version `bus-76@2025-12-14` (belegt): gleich

## Linie 77

- **2015-09-28 – 2015-10-04** (1 Wo., vbz-fahrzeiten-2015): Hegibachplatz – Im Walder, 8 Halte
  - Version `bus-77@2014-12-14` (belegt): gleich
- **2016-05-02 – 2016-05-08** (1 Wo., vbz-fahrzeiten-2016): Hegibachplatz – Im Walder, 8 Halte
  - Version `bus-77@2014-12-14` (belegt): gleich
- **2017-05-01 – 2017-05-07** (1 Wo., vbz-fahrzeiten-2017): Hegibachplatz – Im Walder, 8 Halte
  - Version `bus-77@2014-12-14` (belegt): gleich
- **2018-04-30 – 2018-05-06** (1 Wo., vbz-fahrzeiten-2018): Hegibachplatz – Im Walder, 8 Halte
  - Version `bus-77@2014-12-14` (belegt): gleich
- **2018-12-03 – 2022-12-11** (210 Wo., gtfs-2019, gtfs-2020, gtfs-2022, gtfs-2023): Hegibachplatz – Im Walder, 8 Halte
  - Version `bus-77@2014-12-14` (belegt): gleich
- **2022-12-12 – 2026-01-18** (162 Wo., gtfs-2023, gtfs-2024, gtfs-2025, gtfs-2026): Balgrist – Hegibachplatz, 11 Halte
  - Version `bus-77@2022-12-11` (belegt): gleich
- **2026-01-19 – 2026-06-28** (23 Wo., gtfs-2026) *vorübergehend*: Balgrist – Hegibachplatz, 12 Halte
  - Version `bus-77@2022-12-11` (belegt): abweichend
  - nur im Fahrplan: Bleulerstrasse
- **2026-06-29 – 2026-11-01** (18 Wo., gtfs-2026): Balgrist – Hegibachplatz, 11 Halte
  - Version `bus-77@2022-12-11` (belegt): gleich
- **2026-11-02 – 2026-12-13** (6 Wo., gtfs-2026) *vorübergehend*: Bahnhof Tiefenbrunnen – Balgrist, 11 Halte
  - Version `bus-77@2022-12-11` (belegt): abweichend
  - nur im Fahrplan: Bahnhof Tiefenbrunnen, Wildbachstrasse
  - nur erfasst: Botanischer Garten, Hegibachplatz

## Linie 78

- **2015-09-28 – 2015-10-04** (1 Wo., vbz-fahrzeiten-2015): Bändliweg – Dunkelhölzli, 10 Halte
  - Version `bus-78@2014-12-14` (belegt): gleich
- **2016-05-02 – 2016-05-08** (1 Wo., vbz-fahrzeiten-2016): Bändliweg – Dunkelhölzli, 10 Halte
  - Version `bus-78@2014-12-14` (belegt): gleich
- **2017-05-01 – 2017-05-07** (1 Wo., vbz-fahrzeiten-2017): Bändliweg – Dunkelhölzli, 10 Halte
  - Version `bus-78@2014-12-14` (belegt): gleich
- **2018-04-30 – 2018-05-06** (1 Wo., vbz-fahrzeiten-2018): Bändliweg – Dunkelhölzli, 10 Halte
  - Version `bus-78@2014-12-14` (belegt): gleich
- **2018-12-03 – 2020-07-12** (84 Wo., gtfs-2019, gtfs-2020): Bändliweg – Dunkelhölzli, 10 Halte
  - Version `bus-78@2014-12-14` (belegt): gleich
- **2020-07-13 – 2020-08-16** (5 Wo., gtfs-2020) *vorübergehend*: Dunkelhölzli – Werdhölzli, 12 Halte
  - Version `bus-78@2014-12-14` (belegt): abweichend
  - nur im Fahrplan: Bahnhof Altstetten Nord, Werdhölzli
- **2020-08-17 – 2025-12-14** (278 Wo., gtfs-2020, gtfs-2022, gtfs-2023, gtfs-2024, gtfs-2025, gtfs-2026): Bändliweg – Dunkelhölzli, 10 Halte
  - Version `bus-78@2014-12-14` (belegt): gleich
- **2025-12-15 – 2026-12-13** (52 Wo., gtfs-2026): Dunkelhölzli – Heizenholz, 16 Halte
  - Version `bus-78@2025-12-14` (belegt): gleich

## Linie 79

- **2015-09-28 – 2015-10-04** (1 Wo., vbz-fahrzeiten-2015): Auzelg Ost – Schwamendingerplatz, 6 Halte
  - Version `bus-79@2014-12-14` (belegt): gleich
- **2016-05-02 – 2016-05-08** (1 Wo., vbz-fahrzeiten-2016): Auzelg Ost – Schwamendingerplatz, 6 Halte
  - Version `bus-79@2014-12-14` (belegt): gleich
- **2017-05-01 – 2017-05-07** (1 Wo., vbz-fahrzeiten-2017): Auzelg Ost – Schwamendingerplatz, 6 Halte
  - Version `bus-79@2014-12-14` (belegt): gleich
- **2018-04-30 – 2018-05-06** (1 Wo., vbz-fahrzeiten-2018): Auzelg Ost – Schwamendingerplatz, 6 Halte
  - Version `bus-79@2014-12-14` (belegt): gleich
- **2018-12-10 – 2023-12-10** (261 Wo., gtfs-2019, gtfs-2020, gtfs-2022, gtfs-2023, gtfs-2024): Auzelg Ost – Schwamendingerplatz, 6 Halte
  - Version `bus-79@2014-12-14` (belegt): gleich

## Linie 80

- **2015-09-28 – 2015-10-04** (1 Wo., vbz-fahrzeiten-2015): Bahnhof Oerlikon Nord – Triemlispital, 29 Halte
  - Version `bus-80@2014-12-14` (belegt): gleich
- **2016-05-02 – 2016-05-08** (1 Wo., vbz-fahrzeiten-2016): Bahnhof Oerlikon Nord – Triemlispital, 29 Halte
  - Version `bus-80@2015-12-13` (belegt): gleich
- **2017-05-01 – 2017-05-07** (1 Wo., vbz-fahrzeiten-2017): Bahnhof Oerlikon Nord – Triemlispital, 29 Halte
  - Version `bus-80@2015-12-13` (belegt): gleich
- **2018-04-30 – 2018-05-06** (1 Wo., vbz-fahrzeiten-2018): Bahnhof Oerlikon Nord – Triemlispital, 29 Halte
  - Version `bus-80@2017-12-10` (belegt): gleich
- **2018-12-03 – 2018-12-09** (1 Wo., gtfs-2019) *vorübergehend*: Bahnhof Oerlikon Nord – Triemlispital, 29 Halte
  - Version `bus-80@2017-12-10` (belegt): gleich
- **2018-12-10 – 2018-12-23** (2 Wo., gtfs-2019) *vorübergehend*: Bahnhof Oerlikon Nord – Triemlispital, 29 Halte
  - Version `bus-80@2017-12-10` (belegt): abweichend
  - nur im Fahrplan: Glaubtenstrasse Nord, Winzerstrasse
  - nur erfasst: Glaubtenstrasse, Glaubtenstrasse Süd
- **2018-12-24 – 2019-01-06** (2 Wo., gtfs-2019) *vorübergehend*: Bahnhof Oerlikon Nord – Triemlispital, 29 Halte
  - Version `bus-80@2017-12-10` (belegt): gleich
- **2019-01-07 – 2019-04-14** (14 Wo., gtfs-2019) *vorübergehend*: Bahnhof Oerlikon Nord – Triemlispital, 29 Halte
  - Version `bus-80@2017-12-10` (belegt): abweichend
  - nur im Fahrplan: Glaubtenstrasse Nord, Winzerstrasse
  - nur erfasst: Glaubtenstrasse, Glaubtenstrasse Süd
- **2019-04-15 – 2019-04-21** (1 Wo., gtfs-2019) *vorübergehend*: Bahnhof Oerlikon Nord – Triemlispital, 29 Halte
  - Version `bus-80@2017-12-10` (belegt): gleich
- **2019-04-22 – 2019-04-28** (1 Wo., gtfs-2019) *vorübergehend*: Bahnhof Oerlikon Nord – Triemlispital, 29 Halte
  - Version `bus-80@2017-12-10` (belegt): abweichend
  - nur im Fahrplan: Glaubtenstrasse Nord, Winzerstrasse
  - nur erfasst: Glaubtenstrasse, Glaubtenstrasse Süd
- **2019-04-29 – 2019-05-05** (1 Wo., gtfs-2019) *vorübergehend*: Bahnhof Oerlikon Nord – Triemlispital, 29 Halte
  - Version `bus-80@2017-12-10` (belegt): gleich
- **2019-05-06 – 2019-05-26** (3 Wo., gtfs-2019) *vorübergehend*: Bahnhof Oerlikon Nord – Triemlispital, 29 Halte
  - Version `bus-80@2017-12-10` (belegt): abweichend
  - nur im Fahrplan: Glaubtenstrasse Nord, Winzerstrasse
  - nur erfasst: Glaubtenstrasse, Glaubtenstrasse Süd
- **2019-05-27 – 2019-06-02** (1 Wo., gtfs-2019) *vorübergehend*: Bahnhof Oerlikon Nord – Triemlispital, 29 Halte
  - Version `bus-80@2017-12-10` (belegt): gleich
- **2019-06-03 – 2022-12-25** (186 Wo., gtfs-2019, gtfs-2020, gtfs-2022, gtfs-2023) *vorübergehend*: Bahnhof Oerlikon Nord – Triemlispital, 29 Halte
  - Version `bus-80@2017-12-10` (belegt): abweichend
  - nur im Fahrplan: Glaubtenstrasse Nord, Winzerstrasse
  - nur erfasst: Glaubtenstrasse, Glaubtenstrasse Süd
- **2022-12-26 – 2023-01-08** (2 Wo., gtfs-2023) *vorübergehend*: Bahnhof Oerlikon Nord – Triemlispital, 29 Halte
  - Version `bus-80@2017-12-10` (belegt): gleich
- **2023-01-09 – 2023-04-02** (12 Wo., gtfs-2023) *vorübergehend*: Bahnhof Oerlikon Nord – Triemlispital, 29 Halte
  - Version `bus-80@2017-12-10` (belegt): abweichend
  - nur im Fahrplan: Glaubtenstrasse Nord, Winzerstrasse
  - nur erfasst: Glaubtenstrasse, Glaubtenstrasse Süd
- **2023-04-03 – 2023-04-16** (2 Wo., gtfs-2023) *vorübergehend*: Bahnhof Oerlikon Nord – Triemlispital, 29 Halte
  - Version `bus-80@2017-12-10` (belegt): gleich
- **2023-04-17 – 2023-04-30** (2 Wo., gtfs-2023) *vorübergehend*: Bahnhof Oerlikon Nord – Triemlispital, 29 Halte
  - Version `bus-80@2017-12-10` (belegt): abweichend
  - nur im Fahrplan: Glaubtenstrasse Nord, Winzerstrasse
  - nur erfasst: Glaubtenstrasse, Glaubtenstrasse Süd
- **2023-05-01 – 2023-05-07** (1 Wo., gtfs-2023) *vorübergehend*: Bahnhof Oerlikon Nord – Triemlispital, 29 Halte
  - Version `bus-80@2017-12-10` (belegt): gleich
- **2023-05-08 – 2023-05-14** (1 Wo., gtfs-2023) *vorübergehend*: Bahnhof Oerlikon Nord – Triemlispital, 29 Halte
  - Version `bus-80@2017-12-10` (belegt): abweichend
  - nur im Fahrplan: Glaubtenstrasse Nord, Winzerstrasse
  - nur erfasst: Glaubtenstrasse, Glaubtenstrasse Süd
- **2023-05-15 – 2023-05-21** (1 Wo., gtfs-2023) *vorübergehend*: Bahnhof Oerlikon Nord – Triemlispital, 29 Halte
  - Version `bus-80@2017-12-10` (belegt): gleich
- **2023-05-22 – 2023-05-28** (1 Wo., gtfs-2023) *vorübergehend*: Bahnhof Oerlikon Nord – Triemlispital, 29 Halte
  - Version `bus-80@2017-12-10` (belegt): abweichend
  - nur im Fahrplan: Glaubtenstrasse Nord, Winzerstrasse
  - nur erfasst: Glaubtenstrasse, Glaubtenstrasse Süd
- **2023-05-29 – 2023-06-04** (1 Wo., gtfs-2023) *vorübergehend*: Bahnhof Oerlikon Nord – Triemlispital, 29 Halte
  - Version `bus-80@2017-12-10` (belegt): gleich
- **2023-06-05 – 2023-07-30** (8 Wo., gtfs-2023) *vorübergehend*: Bahnhof Oerlikon Nord – Triemlispital, 29 Halte
  - Version `bus-80@2017-12-10` (belegt): abweichend
  - nur im Fahrplan: Glaubtenstrasse Nord, Winzerstrasse
  - nur erfasst: Glaubtenstrasse, Glaubtenstrasse Süd
- **2023-07-31 – 2023-08-06** (1 Wo., gtfs-2023) *vorübergehend*: Bahnhof Oerlikon Nord – Triemlispital, 29 Halte
  - Version `bus-80@2017-12-10` (belegt): gleich
- **2023-08-07 – 2023-12-24** (20 Wo., gtfs-2023, gtfs-2024) *vorübergehend*: Bahnhof Oerlikon Nord – Triemlispital, 29 Halte
  - Version `bus-80@2017-12-10` (belegt): abweichend
  - nur im Fahrplan: Glaubtenstrasse Nord, Winzerstrasse
  - nur erfasst: Glaubtenstrasse, Glaubtenstrasse Süd
- **2023-12-25 – 2024-01-07** (2 Wo., gtfs-2024) *vorübergehend*: Bahnhof Oerlikon Nord – Triemlispital, 29 Halte
  - Version `bus-80@2017-12-10` (belegt): gleich
- **2024-01-08 – 2024-03-24** (11 Wo., gtfs-2024) *vorübergehend*: Bahnhof Oerlikon Nord – Triemlispital, 29 Halte
  - Version `bus-80@2017-12-10` (belegt): abweichend
  - nur im Fahrplan: Glaubtenstrasse Nord, Winzerstrasse
  - nur erfasst: Glaubtenstrasse, Glaubtenstrasse Süd
- **2024-03-25 – 2024-04-07** (2 Wo., gtfs-2024) *vorübergehend*: Bahnhof Oerlikon Nord – Triemlispital, 29 Halte
  - Version `bus-80@2017-12-10` (belegt): gleich
- **2024-04-08 – 2024-04-28** (3 Wo., gtfs-2024) *vorübergehend*: Bahnhof Oerlikon Nord – Triemlispital, 29 Halte
  - Version `bus-80@2017-12-10` (belegt): abweichend
  - nur im Fahrplan: Glaubtenstrasse Nord, Winzerstrasse
  - nur erfasst: Glaubtenstrasse, Glaubtenstrasse Süd
- **2024-04-29 – 2024-05-12** (2 Wo., gtfs-2024) *vorübergehend*: Bahnhof Oerlikon Nord – Triemlispital, 29 Halte
  - Version `bus-80@2017-12-10` (belegt): gleich
- **2024-05-13 – 2024-05-19** (1 Wo., gtfs-2024) *vorübergehend*: Bahnhof Oerlikon Nord – Triemlispital, 29 Halte
  - Version `bus-80@2017-12-10` (belegt): abweichend
  - nur im Fahrplan: Glaubtenstrasse Nord, Winzerstrasse
  - nur erfasst: Glaubtenstrasse, Glaubtenstrasse Süd
- **2024-05-20 – 2024-05-26** (1 Wo., gtfs-2024) *vorübergehend*: Bahnhof Oerlikon Nord – Triemlispital, 29 Halte
  - Version `bus-80@2017-12-10` (belegt): gleich
- **2024-05-27 – 2024-07-28** (9 Wo., gtfs-2024) *vorübergehend*: Bahnhof Oerlikon Nord – Triemlispital, 29 Halte
  - Version `bus-80@2017-12-10` (belegt): abweichend
  - nur im Fahrplan: Glaubtenstrasse Nord, Winzerstrasse
  - nur erfasst: Glaubtenstrasse, Glaubtenstrasse Süd
- **2024-07-29 – 2024-08-04** (1 Wo., gtfs-2024) *vorübergehend*: Bahnhof Oerlikon Nord – Triemlispital, 29 Halte
  - Version `bus-80@2017-12-10` (belegt): gleich
- **2024-08-05 – 2024-12-22** (20 Wo., gtfs-2024, gtfs-2025) *vorübergehend*: Bahnhof Oerlikon Nord – Triemlispital, 29 Halte
  - Version `bus-80@2017-12-10` (belegt): abweichend
  - nur im Fahrplan: Glaubtenstrasse Nord, Winzerstrasse
  - nur erfasst: Glaubtenstrasse, Glaubtenstrasse Süd
- **2024-12-23 – 2025-01-05** (2 Wo., gtfs-2025) *vorübergehend*: Bahnhof Oerlikon Nord – Triemlispital, 29 Halte
  - Version `bus-80@2017-12-10` (belegt): gleich
- **2025-01-06 – 2025-04-20** (15 Wo., gtfs-2025): Bahnhof Oerlikon Nord – Triemlispital, 29 Halte
  - Version `bus-80@2025-01-06` (belegt): gleich
- **2025-04-21 – 2025-04-27** (1 Wo., gtfs-2025) *vorübergehend*: Bahnhof Oerlikon Nord – Triemlispital, 29 Halte
  - Version `bus-80@2025-01-06` (belegt): abweichend
  - nur im Fahrplan: Neuaffoltern, Glaubtenstrasse
  - nur erfasst: Glaubtenstrasse Nord, Winzerstrasse
- **2025-04-28 – 2025-06-08** (6 Wo., gtfs-2025) *vorübergehend*: Bahnhof Oerlikon Nord – Triemlispital, 29 Halte
  - Version `bus-80@2025-01-06` (belegt): gleich
- **2025-06-09 – 2025-06-15** (1 Wo., gtfs-2025) *vorübergehend*: Bahnhof Oerlikon Nord – Triemlispital, 29 Halte
  - Version `bus-80@2025-01-06` (belegt): abweichend
  - nur im Fahrplan: Neuaffoltern, Glaubtenstrasse
  - nur erfasst: Glaubtenstrasse Nord, Winzerstrasse
- **2025-06-16 – 2025-06-22** (1 Wo., gtfs-2025) *vorübergehend*: Bahnhof Oerlikon Nord – Triemlispital, 29 Halte
  - Version `bus-80@2025-01-06` (belegt): gleich
- **2025-06-23 – 2025-06-29** (1 Wo., gtfs-2025) *vorübergehend*: Bahnhof Oerlikon Nord – Triemlispital, 29 Halte
  - Version `bus-80@2025-01-06` (belegt): abweichend
  - nur im Fahrplan: Neuaffoltern, Glaubtenstrasse
  - nur erfasst: Glaubtenstrasse Nord, Winzerstrasse
- **2025-06-30 – 2025-07-27** (4 Wo., gtfs-2025) *vorübergehend*: Bahnhof Oerlikon Nord – Triemlispital, 29 Halte
  - Version `bus-80@2025-01-06` (belegt): gleich
- **2025-07-28 – 2025-08-03** (1 Wo., gtfs-2025) *vorübergehend*: Bahnhof Oerlikon Nord – Triemlispital, 29 Halte
  - Version `bus-80@2025-01-06` (belegt): abweichend
  - nur im Fahrplan: Neuaffoltern, Glaubtenstrasse
  - nur erfasst: Glaubtenstrasse Nord, Winzerstrasse
- **2025-08-04 – 2025-12-14** (19 Wo., gtfs-2025, gtfs-2026): Bahnhof Oerlikon Nord – Triemlispital, 29 Halte
  - Version `bus-80@2025-01-06` (belegt): gleich
- **2025-12-15 – 2025-12-21** (1 Wo., gtfs-2026) *vorübergehend*: Bahnhof Oerlikon Nord – Triemlispital, 28 Halte
  - Version `bus-80@2025-01-06` (belegt): abweichend
  - nur erfasst: Winzerstrasse Süd
- **2025-12-22 – 2026-01-04** (2 Wo., gtfs-2026) *vorübergehend*: Bahnhof Oerlikon Nord – Triemlispital, 28 Halte
  - Version `bus-80@2025-01-06` (belegt): abweichend
  - nur im Fahrplan: Glaubtenstrasse, Glaubtenstrasse Süd
  - nur erfasst: Glaubtenstrasse Nord, Winzerstrasse Süd, Bristenstrasse
- **2026-01-05 – 2026-04-05** (13 Wo., gtfs-2026): Bahnhof Oerlikon Nord – Triemlispital, 28 Halte
  - Version `bus-80@2026-01-05` (belegt): gleich
- **2026-04-06 – 2026-07-19** (15 Wo., gtfs-2026): Bahnhof Oerlikon Nord – Triemlispital, 29 Halte
  - Version `bus-80@2026-04-06` (belegt): gleich
- **2026-07-20 – 2026-08-09** (3 Wo., gtfs-2026) *vorübergehend*: Bahnhof Oerlikon Nord – Triemlispital, 27 Halte
  - Version `bus-80@2026-04-06` (belegt): abweichend
  - nur erfasst: Zwielplatz, Wartau
- **2026-08-10 – 2026-12-13** (18 Wo., gtfs-2026): Bahnhof Oerlikon Nord – Triemlispital, 29 Halte
  - Version `bus-80@2026-04-06` (belegt): gleich

## Linie 83

- **2016-05-02 – 2016-05-08** (1 Wo., vbz-fahrzeiten-2016): Bahnhof Altstetten – Milchbuck, 17 Halte
  - Version `bus-83@2015-12-13` (belegt): gleich
- **2017-05-01 – 2017-05-07** (1 Wo., vbz-fahrzeiten-2017): Bahnhof Altstetten – Milchbuck, 17 Halte
  - Version `bus-83@2015-12-13` (belegt): gleich
- **2018-04-30 – 2018-05-06** (1 Wo., vbz-fahrzeiten-2018): Bahnhof Altstetten – Milchbuck, 17 Halte
  - Version `bus-83@2015-12-13` (belegt): gleich
- **2018-12-10 – 2022-07-17** (188 Wo., gtfs-2019, gtfs-2020, gtfs-2022): Bahnhof Altstetten – Milchbuck, 17 Halte
  - Version `bus-83@2015-12-13` (belegt): gleich
- **2022-07-18 – 2022-08-21** (5 Wo., gtfs-2022) *vorübergehend*: Bahnhof Altstetten – Bucheggplatz, 16 Halte
  - Version `bus-83@2015-12-13` (belegt): abweichend
  - nur erfasst: Milchbuck
- **2022-08-22 – 2023-07-16** (47 Wo., gtfs-2022, gtfs-2023) *vorübergehend*: Bahnhof Altstetten – Milchbuck, 17 Halte
  - Version `bus-83@2015-12-13` (belegt): gleich
- **2023-07-17 – 2023-08-20** (5 Wo., gtfs-2023) *vorübergehend*: Bahnhof Altstetten – Bucheggplatz, 16 Halte
  - Version `bus-83@2015-12-13` (belegt): abweichend
  - nur erfasst: Milchbuck
- **2023-08-21 – 2024-04-21** (35 Wo., gtfs-2023, gtfs-2024): Bahnhof Altstetten – Milchbuck, 17 Halte
  - Version `bus-83@2015-12-13` (belegt): gleich
- **2024-04-22 – 2024-05-05** (2 Wo., gtfs-2024) *vorübergehend*: Bahnhof Altstetten – Milchbuck, 20 Halte
  - Version `bus-83@2015-12-13` (belegt): abweichend
  - nur im Fahrplan: Siemens, Fellenbergstrasse, Sackzelg
- **2024-05-06 – 2024-07-14** (10 Wo., gtfs-2024): Bahnhof Altstetten – Milchbuck, 17 Halte
  - Version `bus-83@2015-12-13` (belegt): gleich
- **2024-07-15 – 2024-08-18** (5 Wo., gtfs-2024) *vorübergehend*: Bahnhof Altstetten – Bucheggplatz, 16 Halte
  - Version `bus-83@2015-12-13` (belegt): abweichend
  - nur erfasst: Milchbuck
- **2024-08-19 – 2026-12-13** (121 Wo., gtfs-2024, gtfs-2025, gtfs-2026): Bahnhof Altstetten – Milchbuck, 17 Halte
  - Version `bus-83@2015-12-13` (belegt): gleich

## Linie 89

- **2015-09-28 – 2015-10-04** (1 Wo., vbz-fahrzeiten-2015): Heizenholz – Sihlcity, 27 Halte
  - Version `bus-89@2014-12-14` (belegt): gleich
- **2016-05-02 – 2016-05-08** (1 Wo., vbz-fahrzeiten-2016): Heizenholz – Sihlcity, 27 Halte
  - Version `bus-89@2014-12-14` (belegt): gleich
- **2017-05-01 – 2017-05-07** (1 Wo., vbz-fahrzeiten-2017): Heizenholz – Sihlcity, 27 Halte
  - Version `bus-89@2014-12-14` (belegt): gleich
- **2018-04-30 – 2018-05-06** (1 Wo., vbz-fahrzeiten-2018): Heizenholz – Sihlcity, 27 Halte
  - Version `bus-89@2014-12-14` (belegt): gleich
- **2018-12-03 – 2022-05-01** (178 Wo., gtfs-2019, gtfs-2020, gtfs-2022): Heizenholz – Sihlcity, 27 Halte
  - Version `bus-89@2014-12-14` (belegt): gleich
- **2022-05-02 – 2022-05-29** (4 Wo., gtfs-2022) *vorübergehend*: Geeringstrasse – Sihlcity, 26 Halte
  - Version `bus-89@2014-12-14` (belegt): abweichend
  - nur erfasst: Heizenholz
- **2022-05-30 – 2024-04-21** (99 Wo., gtfs-2022, gtfs-2023, gtfs-2024): Heizenholz – Sihlcity, 27 Halte
  - Version `bus-89@2014-12-14` (belegt): gleich
- **2024-04-22 – 2024-05-05** (2 Wo., gtfs-2024) *vorübergehend*: Heizenholz – Sihlcity, 30 Halte
  - Version `bus-89@2014-12-14` (belegt): abweichend
  - nur im Fahrplan: Siemens, Fellenbergstrasse, Sackzelg
- **2024-05-06 – 2025-12-14** (84 Wo., gtfs-2024, gtfs-2025, gtfs-2026): Heizenholz – Sihlcity, 27 Halte
  - Version `bus-89@2014-12-14` (belegt): gleich
- **2025-12-15 – 2026-12-13** (52 Wo., gtfs-2026): Sihlcity – Unterengstringen, Sennenbüel, 30 Halte
  - Version `bus-89@2025-12-14` (belegt): gleich

## Linie 94

- **2015-09-28 – 2015-10-04** (1 Wo., vbz-fahrzeiten-2015): Bahnhof Oerlikon – Wallisellen, Glatt (Bus), 12 Halte
  - Version `bus-94@2014-12-14` (belegt): gleich
- **2016-05-02 – 2016-05-08** (1 Wo., vbz-fahrzeiten-2016): Bahnhof Oerlikon – Wallisellen, Glatt (Bus), 12 Halte
  - Version `bus-94@2014-12-14` (belegt): gleich
- **2017-05-01 – 2017-05-07** (1 Wo., vbz-fahrzeiten-2017): Bahnhof Oerlikon – Wallisellen, Glatt (Bus), 12 Halte
  - Version `bus-94@2014-12-14` (belegt): gleich
- **2018-04-30 – 2018-05-06** (1 Wo., vbz-fahrzeiten-2018): Bahnhof Oerlikon – Wallisellen, Glatt (Bus), 12 Halte
  - Version `bus-94@2014-12-14` (belegt): gleich
- **2018-12-03 – 2023-12-10** (262 Wo., gtfs-2019, gtfs-2020, gtfs-2022, gtfs-2023, gtfs-2024): Bahnhof Oerlikon – Wallisellen, Glatt (Bus), 12 Halte
  - Version `bus-94@2014-12-14` (belegt): gleich

## Linie 95

- **2015-09-28 – 2015-10-04** (1 Wo., vbz-fahrzeiten-2015): Bahnhof Altstetten – Freilagerstrasse, 9 Halte
  - Version `bus-95@2014-12-14` (belegt): gleich

## Linie 99

- **2022-12-05 – 2026-07-12** (188 Wo., gtfs-2023, gtfs-2024, gtfs-2025, gtfs-2026): Balgrist – Zollikon, Bahnhof, 10 Halte
  - Version `bus-99@2022-12-11` (belegt): gleich
- **2026-07-13 – 2026-07-19** (1 Wo., gtfs-2026) *vorübergehend*: Balgrist – Zollikon, Goldhaldenplatz, 9 Halte
  - Version `bus-99@2022-12-11` (belegt): abweichend
  - nur im Fahrplan: Zollikon, Goldhaldenplatz
  - nur erfasst: Zollikon, Dufourplatz, Zollikon, Bahnhof
- **2026-07-20 – 2026-10-04** (11 Wo., gtfs-2026): Balgrist – Zollikon, Bahnhof, 10 Halte
  - Version `bus-99@2026-07-20` (belegt): gleich
- **2026-10-05 – 2026-12-13** (10 Wo., gtfs-2026): Balgrist – Zollikon, Bahnhof, 10 Halte
  - Version `bus-99@2026-10-05` (belegt): gleich

## Nicht erfasste Linien

Im Fahrplan als Bus geführt, im Archiv (noch) keine Linie:


## Unbekannte Haltestellennamen

In `data/linien.yaml` unter `fahrplan_alias` zuordnen oder als neue Haltestelle erfassen.


## Bushaltestellen

234 Haltestellen ohne Tram, 365 Abschnitte mit Fahrweg aus GTFS.

Abschnitte ohne Fahrweg (nur 2015–2018, im Archiv als Gerade): Letzipark – Luggwegstrasse; Bahnhof Altstetten – Luggwegstrasse; Bahnhof Affoltern Süd – Zehntenhausplatz; Bahnhof Affoltern – Bahnhof Affoltern Süd; Freilagerstrasse – Siemens

