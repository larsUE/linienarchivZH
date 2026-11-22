"""Fahrplandaten aus dem Open-Data-Katalog der Stadt Zürich laden (Lizenz CC0).

    python3 scripts/import/fetch-fahrplan.py

- GTFS (ZVV Tram und Bus) 2019–2026 -> data/raw/gtfs/<jahr>.zip
- VBZ-Fahrzeiten SOLL-IST, je eine Stichwoche 2015–2018 (Mai, 2015 Oktober) -> data/raw/fahrzeiten/<jahr>/
  (2015 gibt es nur als Gesamtarchiv: daraus wird per HTTP-Range nur die Stichwoche gelesen)

Nur Python-Standardbibliothek. Bereits vorhandene Dateien werden übersprungen.
"""

import io
import shutil
import sys
import urllib.request
import zipfile
from pathlib import Path

WURZEL = Path(__file__).resolve().parents[2]
ROH = WURZEL / "data/raw"
BASIS = "https://data.stadt-zuerich.ch/dataset"

GTFS = {j: f"{BASIS}/vbz_fahrplandaten_gtfs/download/{j}_google_transit.zip" for j in range(2019, 2027)}
# Stichwoche: Mitte Mai, ausserhalb der Sommerbaustellen
FAHRZEITEN = {
    2016: "Fahrzeiten_SOLL_IST_20160508_20160514.csv",
    2017: "Fahrzeiten_SOLL_IST_20170507_20170513.csv",
    2018: "Fahrzeiten_SOLL_IST_20180506_20180512.csv",
}
ARCHIV_2015 = f"{BASIS}/vbz_fahrzeiten_ogd_2015/download/vbz_fahrzeiten_ogd_2015.zip"


def laden(url, ziel):
    if ziel.exists():
        print(f"vorhanden: {ziel.relative_to(WURZEL)}")
        return
    ziel.parent.mkdir(parents=True, exist_ok=True)
    tmp = ziel.with_suffix(ziel.suffix + ".teil")
    with urllib.request.urlopen(url) as r, open(tmp, "wb") as f:
        shutil.copyfileobj(r, f, 1 << 20)
    tmp.rename(ziel)
    print(f"geladen: {ziel.relative_to(WURZEL)} ({ziel.stat().st_size / 1e6:.0f} MB)")


class Fernzugriff(io.RawIOBase):
    """Lesbare, suchbare Datei über HTTP-Range-Anfragen (für einzelne Dateien aus grossen ZIP-Archiven)."""

    def __init__(self, url):
        self.url = url
        self.pos = 0
        req = urllib.request.Request(url, headers={"Range": "bytes=0-0"})
        with urllib.request.urlopen(req) as r:
            self.laenge = int(r.headers["Content-Range"].split("/")[1])

    def seekable(self):
        return True

    def readable(self):
        return True

    def seek(self, off, whence=0):
        self.pos = off if whence == 0 else self.pos + off if whence == 1 else self.laenge + off
        return self.pos

    def tell(self):
        return self.pos

    def readinto(self, b):
        if self.pos >= self.laenge:
            return 0
        ende = min(self.pos + len(b), self.laenge) - 1
        req = urllib.request.Request(self.url, headers={"Range": f"bytes={self.pos}-{ende}"})
        with urllib.request.urlopen(req) as r:
            daten = r.read()
        b[: len(daten)] = daten
        self.pos += len(daten)
        return len(daten)


def aus_archiv(url, muster, ordner):
    """Dateien, deren Name eines der Muster enthält, aus einem entfernten ZIP lesen."""
    ordner.mkdir(parents=True, exist_ok=True)
    roh = io.BufferedReader(Fernzugriff(url), buffer_size=8 << 20)
    with zipfile.ZipFile(roh) as z:
        for info in z.infolist():
            name = Path(info.filename).name
            if not any(m in name for m in muster):
                continue
            ziel = ordner / name
            if ziel.exists():
                print(f"vorhanden: {ziel.relative_to(WURZEL)}")
                continue
            with z.open(info) as quelle, open(ziel, "wb") as f:
                shutil.copyfileobj(quelle, f, 1 << 20)
            print(f"entpackt: {ziel.relative_to(WURZEL)} ({ziel.stat().st_size / 1e6:.0f} MB)")


if __name__ == "__main__":
    nur = set(sys.argv[1:])  # optional: "gtfs" oder "fahrzeiten"
    if not nur or "gtfs" in nur:
        for jahr, url in GTFS.items():
            laden(url, ROH / f"gtfs/{jahr}.zip")
    if not nur or "fahrzeiten" in nur:
        for jahr, datei in FAHRZEITEN.items():
            for name in (datei, "Haltestelle.csv", "Haltepunkt.csv"):
                laden(f"{BASIS}/vbz_fahrzeiten_ogd_{jahr}/download/{name}", ROH / f"fahrzeiten/{jahr}/{name}")
        aus_archiv(ARCHIV_2015, ["20151004_20151010", "Haltestelle", "Haltepunkt"], ROH / "fahrzeiten/2015")
