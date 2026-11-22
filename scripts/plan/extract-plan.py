"""Schema-Koordinaten aus dem ZVV-Liniennetzplan (Vektor-PDF) ableiten.

    python3 scripts/plan/extract-plan.py <Liniennetzplan.pdf>

Benötigt PyMuPDF, NumPy und SciPy (pip install pymupdf numpy scipy). Liest public/data/netz.json und schreibt
data/plan.json mit
  - haltestellen: id -> [x, y]   Lage im Plan (PDF-Punkte, y nach unten)
  - kanten:       id -> [[x, y], …]   Linienführung im Plan
  - herkunft:     id -> "plan" | "geschaetzt"

Vorgehen:
  1. Tramstriche nach Linienfarbe sammeln (Farben aus den Liniennummern-Schildern).
  2. Haltestellenmarken: weisse Flächen, die auf einem Tramstrich liegen.
  3. Haltestellennamen den Beschriftungen zuordnen, dann der nächsten Marke.
  4. Abschnitte: kürzester Weg auf dem Strich der passenden Linienfarbe.
  5. Was nicht im Plan steht, wird aus der Geografie interpoliert.

Das PDF selbst liegt nicht im Repository.
"""

import heapq
import json
import math
import re
import sys
import unicodedata
from collections import defaultdict
from pathlib import Path

import pymupdf

WURZEL = Path(__file__).resolve().parents[2]
NETZ = WURZEL / "public/data/netz.json"
ZIEL = WURZEL / "data/plan.json"

# Beschriftungen, die sich nicht aus dem Namen ableiten lassen
ALIAS = {
    "museum-fur-gestaltung": "Museum f. Gestaltung",
    "altes-krematorium": "Altes|Krematorium",
}
# Von Hand geprüfte Lagen (Planpunkte), wo die automatische Zuordnung danebenliegt.
# Der Punkt wird auf den nächsten Tramstrich gesetzt.
FEST = {
    "bahnhof-stadelhofen": (499.4, 818.0),
    "seebach": (585.1, 250.0),
    "seebacherplatz": (565.9, 267.9),
    # die Zuordnung landet sonst östlich der Hardbrücke; die Haltestelle liegt zwischen Schiffbau und Hardplatz
    "bahnhof-hardbrucke": (268.0, 613.9),
}

TRAM = {"2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "17", "20", "50", "51"}


def norm(s):
    s = unicodedata.normalize("NFKD", s.lower())
    s = "".join(c for c in s if not unicodedata.combining(c)).replace("­", "")
    s = re.sub(r"-\s*\|\s*", "", s).replace("|", " ")
    s = re.sub(r"strasse\b", "str", s)
    s = re.sub(r"str\.", "str", s)
    s = re.sub(r"\bbhf\.?", "bahnhof", s)
    s = re.sub(r"\bf\.\s", "fur ", s)
    s = re.sub(r"\(tram\)", "", s)
    return re.sub(r"[^a-z0-9]", "", s)


def farbe(c):
    return tuple(round(v, 2) for v in c)


def dist_punkt_strecke(p, a, b):
    ax, ay = a
    bx, by = b
    dx, dy = bx - ax, by - ay
    l2 = dx * dx + dy * dy
    t = 0 if l2 == 0 else max(0, min(1, ((p[0] - ax) * dx + (p[1] - ay) * dy) / l2))
    q = (ax + t * dx, ay + t * dy)
    return math.dist(p, q), t, q


def bezier(p0, p1, p2, p3, n=8):
    pts = []
    for i in range(n + 1):
        t = i / n
        u = 1 - t
        pts.append((
            u**3 * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t**3 * p3.x,
            u**3 * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t**3 * p3.y,
        ))
    return pts


# ---------------------------------------------------------------- Laden
pdf = pymupdf.open(sys.argv[1])
seite = pdf[0]
zeichnungen = seite.get_drawings()
netz = json.load(open(NETZ))
text = seite.get_text("dict")

# ---------------------------------------------------------------- 1. Linienfarben
nummern = []
for b in text["blocks"]:
    for l in b.get("lines", []):
        s = l["spans"][0]
        t = "".join(x["text"] for x in l["spans"]).strip()
        if s["font"].endswith("HelveticaNeue-Medium") and t:
            r = pymupdf.Rect(l["bbox"])
            nummern.append((t, (r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2))

farbeVon = defaultdict(lambda: defaultdict(int))  # Liniennummer -> Farbe -> Anzahl
for z in zeichnungen:
    f = z.get("fill")
    if not f or farbe(f) == (1.0, 1.0, 1.0) or z["rect"].width > 25:
        continue
    for t, x, y in nummern:
        if t in TRAM and z["rect"].contains(pymupdf.Point(x, y)):
            farbeVon[t][farbe(f)] += 1
linienFarbe = {t: max(c, key=c.get) for t, c in farbeVon.items()}
tramFarben = set(linienFarbe.values())

# ---------------------------------------------------------------- Striche je Farbe
striche = defaultdict(list)  # Farbe -> Liste von Polylinien
for z in zeichnungen:
    c = z.get("color")
    if not c or not z.get("width") or z["width"] < 2.5 or farbe(c) not in tramFarben:
        continue
    linie = []
    for it in z["items"]:
        if it[0] == "l":
            pts = [(it[1].x, it[1].y), (it[2].x, it[2].y)]
        elif it[0] == "c":
            pts = bezier(*it[1:5])
        else:
            continue
        if linie and math.dist(linie[-1], pts[0]) < 0.3:
            linie.extend(pts[1:])
        else:
            if len(linie) > 1:
                striche[farbe(c)].append(linie)
            linie = pts
    if len(linie) > 1:
        striche[farbe(c)].append(linie)


class Graph:
    """Ungerichteter Graph aus den Strichen einer Farbe; Knoten auf 0.8-pt-Raster verschmolzen."""

    def __init__(self, polylinien):
        self.pos = []
        self.adj = defaultdict(dict)
        self.raster = {}
        self.segmente = []  # (i, j)
        for pl in polylinien:
            ids = [self.knoten(p) for p in pl]
            for i, j in zip(ids, ids[1:]):
                if i != j:
                    self.kante(i, j)
        # Enden, die auf einem anderen Strich derselben Farbe aufliegen, anschliessen (Verzweigungen)
        grad = {k: len(v) for k, v in self.adj.items()}
        for k, g in grad.items():
            if g != 1:
                continue
            p = self.pos[k]
            best = None
            for i, j in self.segmente:
                if k in (i, j) or j in self.adj[k] or i in self.adj[k]:
                    continue
                d, t, q = dist_punkt_strecke(p, self.pos[i], self.pos[j])
                if d < 2.0 and (best is None or d < best[0]):
                    best = (d, i, j, t)
            if best:
                _, i, j, t = best
                n = i if t < 0.05 else j if t > 0.95 else None
                if n is None:
                    n = self.neu(self.punkt_auf(i, j, t))
                    self.teile(i, j, n)
                self.kante(k, n)

    def knoten(self, p):
        key = (round(p[0] / 0.8), round(p[1] / 0.8))
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                k = self.raster.get((key[0] + dx, key[1] + dy))
                if k is not None and math.dist(self.pos[k], p) < 0.8:
                    return k
        k = self.neu(p)
        self.raster[key] = k
        return k

    def neu(self, p):
        self.pos.append(tuple(p))
        return len(self.pos) - 1

    def kante(self, i, j):
        d = math.dist(self.pos[i], self.pos[j])
        self.adj[i][j] = d
        self.adj[j][i] = d
        self.segmente.append((i, j))

    def punkt_auf(self, i, j, t):
        a, b = self.pos[i], self.pos[j]
        return (a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]))

    def teile(self, i, j, n):
        self.adj[i].pop(j, None)
        self.adj[j].pop(i, None)
        self.segmente = [s for s in self.segmente if s not in ((i, j), (j, i))]
        self.kante(i, n)
        self.kante(n, j)

    def projektion(self, p, max_d):
        best = None
        for i, j in self.segmente:
            if j not in self.adj[i]:
                continue
            d, t, q = dist_punkt_strecke(p, self.pos[i], self.pos[j])
            if d < max_d and (best is None or d < best[0]):
                best = (d, i, j, t, q)
        return best

    def weg(self, a, b, max_d=13):
        """Kürzester Weg zwischen den Projektionen zweier Punkte, als Punktliste."""
        pa, pb = self.projektion(a, max_d), self.projektion(b, max_d)
        if not pa or not pb:
            return None
        start = {pa[1]: math.dist(pa[4], self.pos[pa[1]]), pa[2]: math.dist(pa[4], self.pos[pa[2]])}
        ziel = {pb[1]: math.dist(pb[4], self.pos[pb[1]]), pb[2]: math.dist(pb[4], self.pos[pb[2]])}
        if {pa[1], pa[2]} == {pb[1], pb[2]}:
            return [pa[4], pb[4]]
        dist, vor, heap = {}, {}, []
        for k, d in start.items():
            dist[k] = d
            heapq.heappush(heap, (d, k))
        while heap:
            d, k = heapq.heappop(heap)
            if d > dist.get(k, math.inf):
                continue
            for n, w in self.adj[k].items():
                nd = d + w
                if nd < dist.get(n, math.inf):
                    dist[n], vor[n] = nd, k
                    heapq.heappush(heap, (nd, n))
        ende = min(ziel, key=lambda k: dist.get(k, math.inf) + ziel[k])
        if ende not in dist:
            return None
        pfad = [ende]
        while pfad[-1] not in start:
            pfad.append(vor[pfad[-1]])
        return [pa[4]] + [self.pos[k] for k in reversed(pfad)] + [pb[4]]


graphen = {f: Graph(pl) for f, pl in striche.items()}

# ---------------------------------------------------------------- 2. Haltestellenmarken
alleSegmente = [(g.pos[i], g.pos[j]) for g in graphen.values() for i, j in g.segmente]


def auf_tramstrich(r):
    m = ((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2)
    rad = max(r.width, r.height) / 2 + 1.5
    return any(dist_punkt_strecke(m, a, b)[0] < rad for a, b in alleSegmente)


def teilpfade(z):
    """Ein Zeichenpfad kann mehrere Marken enthalten: in zusammenhängende Teilpfade zerlegen (Punktlisten)."""
    teile, akt, letzter = [], [], None
    for it in z["items"]:
        if it[0] in ("re", "qu"):
            r = pymupdf.Rect(it[1]) if it[0] == "re" else it[1].rect
            teile.append([r.tl, r.tr, r.br, r.bl])
            letzter = None
            continue
        pts = [x for x in it[1:] if isinstance(x, pymupdf.Point)]
        if letzter is None or math.dist(letzter, pts[0]) > 0.3:
            if akt:
                teile.append(akt)
            akt = []
        akt.extend(pts)
        letzter = pts[-1]
    if akt:
        teile.append(akt)
    return teile


def achse(pts):
    """Längsachse eines Haltestellenbalkens (Hauptkomponente), None bei runden Marken."""
    import numpy as np
    a = np.array([(p.x, p.y) for p in pts])
    m = a.mean(axis=0)
    w, v = np.linalg.eigh(np.cov((a - m).T))
    d = v[:, 1]
    proj = (a - m) @ d
    lang, kurz = proj.max() - proj.min(), np.ptp((a - m) @ v[:, 0])
    if lang < 1.6 * kurz:
        return None
    return (tuple(m + d * proj.min()), tuple(m + d * proj.max()))


marken = []
for z in zeichnungen:
    f = z.get("fill")
    if not f or farbe(f) != (1.0, 1.0, 1.0):
        continue
    for pts in teilpfade(z):
        r = pymupdf.Rect(min(p.x for p in pts), min(p.y for p in pts), max(p.x for p in pts), max(p.y for p in pts))
        if max(r.width, r.height) > 70 or max(r.width, r.height) < 2.5:
            continue
        # Weisse Nummernschilder (Bus) aussortieren: ihre Mitte trägt die Liniennummer
        if any(math.dist(((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2), (x, y)) < 3 for _, x, y in nummern):
            continue
        if auf_tramstrich(r):
            marken.append(((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2, r, achse(pts)))
print(f"{len(marken)} Haltestellenmarken auf Tramstrichen", file=sys.stderr)
if len(sys.argv) > 2:  # Fehlersuche: Marken ausgeben
    json.dump([list(m[2]) for m in marken], open(sys.argv[2], "w"))

# ---------------------------------------------------------------- 3. Beschriftungen
# Jede Textzeile als Strecke auf halber x-Höhe, vom ersten bis zum letzten Zeichen
zeilen = []
einzelwoerter = []
for b in seite.get_text("rawdict")["blocks"]:
    for l in b.get("lines", []):
        sp = l["spans"][0]
        if not sp["font"].split("+")[-1].startswith("ZVVBrown") or sp["size"] < 5.5:
            continue
        chars = [c for s in l["spans"] for c in s["chars"]]
        t = "".join(c["c"] for c in chars).strip()
        if not t:
            continue
        dx, dy = l["dir"]
        hoch = (dy * sp["size"] * 0.35, -dx * sp["size"] * 0.35)
        sichtbar = [c for c in chars if c["c"].strip()]
        a0 = sichtbar[0]["origin"]
        a1 = sichtbar[-1]["origin"]
        breite = max(pymupdf.Rect(sichtbar[-1]["bbox"]).width, pymupdf.Rect(sichtbar[-1]["bbox"]).height) * 0.7
        p = (a0[0] + hoch[0], a0[1] + hoch[1])
        q = (a1[0] + dx * breite + hoch[0], a1[1] + dy * breite + hoch[1])
        ox, oy = a0
        r = pymupdf.Rect(l["bbox"])
        zeilen.append(dict(t=t, seg=(p, q), dir=(round(dx, 2), round(dy, 2)), u=ox * dx + oy * dy, v=-ox * dy + oy * dx,
                           w=math.dist(p, q) + 6))
        # Mehrere Namen in einer Zeile (z.B. «Herti Belair»): Wörter zusätzlich einzeln
        woerter, akt = [], []
        for c in chars:
            if c["c"].strip():
                akt.append(c)
            elif akt:
                woerter.append(akt)
                akt = []
        if akt:
            woerter.append(akt)
        if len(woerter) > 1:
            for w in woerter:
                w0, w1 = w[0]["origin"], w[-1]["origin"]
                wb = max(pymupdf.Rect(w[-1]["bbox"]).width, pymupdf.Rect(w[-1]["bbox"]).height) * 0.7
                einzelwoerter.append(("".join(c["c"] for c in w),
                                      ((w0[0] + hoch[0], w0[1] + hoch[1]), (w1[0] + dx * wb + hoch[0], w1[1] + dy * wb + hoch[1]))))
folge = defaultdict(list)
for i, a in enumerate(zeilen):
    for j, b in enumerate(zeilen):
        if i != j and a["dir"] == b["dir"] and 3 < b["v"] - a["v"] < 9 and abs(b["u"] - a["u"]) < a["w"] + 5:
            folge[i].append(j)


def ketten(pfad):
    yield pfad
    if len(pfad) < 3:
        for j in folge[pfad[-1]]:
            yield from ketten(pfad + [j])


beschriftungen = defaultdict(list)  # norm -> [(Strecken, Zusatzkosten)]
for i in range(len(zeilen)):
    for k in ketten([i]):
        # Unvollständige Beschriftung (geht auf der nächsten Zeile weiter) leicht bestrafen
        offen = 6 if folge[k[-1]] else 0
        beschriftungen[norm("|".join(zeilen[j]["t"] for j in k))].append(([zeilen[j]["seg"] for j in k], offen))
for t, seg in einzelwoerter:
    beschriftungen[norm(t)].append(([seg], 4))

hs = {h["id"]: h for h in netz["haltestellen"]}
kandidaten = {}
for h in netz["haltestellen"]:
    varianten = [ALIAS.get(h["id"]), h["name"], re.sub(r"^Bahnhof ", "", h["name"]), h["name"].split("/")[0]]
    for v in varianten:
        if v and beschriftungen.get(norm(v)):
            kandidaten[h["id"]] = beschriftungen[norm(v)]
            break


# ---------------------------------------------------------------- Geografie <-> Plan (Prognose)
def merc(h):
    x = h["lon"] * 111320 * math.cos(math.radians(47.37))
    y = -h["lat"] * 110574
    return (x, y)


def affin(paare):
    """Kleinste Quadrate: plan = A·geo + t"""
    import numpy as np
    G = np.array([[g[0], g[1], 1] for g, _ in paare])
    P = np.array([p for _, p in paare])
    m, *_ = np.linalg.lstsq(G, P, rcond=None)
    return lambda g: tuple(np.array([g[0], g[1], 1]) @ m)


def label_mitte(segs):
    pts = [p for s in segs for p in s]
    return (sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts))


eindeutig = [(merc(hs[k]), label_mitte(v[0][0])) for k, v in kandidaten.items() if len(v) == 1]
prognose = affin(eindeutig)


def rect_dist(r, p):
    dx = max(r.x0 - p[0], 0, p[0] - r.x1)
    dy = max(r.y0 - p[1], 0, p[1] - r.y1)
    return math.hypot(dx, dy)


def label_dist(segs, r):
    """Beschriftungen setzen den Haltestellenbalken fort: Abstand der Marke zu Anfang oder Ende einer Zeile,
    quer zur Schreibrichtung zusätzlich bestraft."""
    m = ((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2)
    halb = max(r.width, r.height) / 2
    best = math.inf
    for p, q in segs:
        L = math.dist(p, q) or 1
        d = ((q[0] - p[0]) / L, (q[1] - p[1]) / L)
        for anker in (p, q):
            v = (m[0] - anker[0], m[1] - anker[1])
            quer = abs(v[0] * d[1] - v[1] * d[0])
            best = min(best, rect_dist(r, anker) + 0.5 * max(0, quer - halb))
    return best


# Linien je Haltestelle (heutiger Stand): die Marke muss auf einem ihrer Striche liegen
heute = [v for v in netz["versionen"] if v["bis"] is None]
linienAn = defaultdict(set)
for v in heute:
    nr = v["linie"].split("-")[1]
    for h in v["haltestellen"]:
        linienAn[h].add(nr)
farbenAn = {h: {linienFarbe[n] for n in ns if n in linienFarbe} for h, ns in linienAn.items()}


def schnitt(p1, p2, p3, p4):
    d = (p2[0] - p1[0]) * (p4[1] - p3[1]) - (p2[1] - p1[1]) * (p4[0] - p3[0])
    if abs(d) < 1e-9:
        return None
    t = ((p3[0] - p1[0]) * (p4[1] - p3[1]) - (p3[1] - p1[1]) * (p4[0] - p3[0])) / d
    u = ((p3[0] - p1[0]) * (p2[1] - p1[1]) - (p3[1] - p1[1]) * (p2[0] - p1[0])) / d
    if -0.05 <= t <= 1.05 and 0 <= u <= 1:
        return (p1[0] + t * (p2[0] - p1[0]), p1[1] + t * (p2[1] - p1[1]))
    return None


def auf_farben(m, farben):
    """Lage der Haltestelle: Mittel der Schnittpunkte des Balkens mit den Strichen ihrer Linienfarben.
    Bei runden Marken die Projektion auf den nächsten Strich."""
    r, ax = m[2], m[3]
    qs = []
    for f in farben or graphen:
        if f not in graphen:
            continue
        g = graphen[f]
        treffer = []
        if ax:
            for i, j in g.segmente:
                if j in g.adj[i]:
                    x = schnitt(ax[0], ax[1], g.pos[i], g.pos[j])
                    if x:
                        treffer.append(x)
        if not treffer:  # runde Marke oder Endhaltestelle (Strich endet im Balken)
            pr = g.projektion((m[0], m[1]), max(r.width, r.height) / 2 + 1.5)
            if pr:
                treffer.append(pr[4])
        qs.extend(treffer)
    if not qs:
        return None
    return (sum(q[0] for q in qs) / len(qs), sum(q[1] for q in qs) / len(qs))


# Kandidatenpaare (Haltestelle, Marke), global nach Abstand zuordnen: jede Marke nur einmal
paare_hm = []
for hid, labels in kandidaten.items():
    if hid in FEST:
        continue
    p = prognose(merc(hs[hid]))
    for segs, offen in labels:
        straf = 0.03 * math.dist(label_mitte(segs), p) + offen
        for mi, m in enumerate(marken):
            d = label_dist(segs, m[2])
            if d < 24:
                lage = auf_farben(m, farbenAn.get(hid))
                fremd = 0
                if not lage:  # Plan zeigt hier eine andere Linie als OSM (z.B. Umleitung beim Planstand)
                    lage, fremd = auf_farben(m, None), 6
                if lage:
                    paare_hm.append((d + straf + fremd, hid, mi, lage))
# Optimale Zuordnung: Summe der Abstände minimal, nicht zugeordnet kostet 30
from scipy.optimize import linear_sum_assignment
import numpy as np

hids = sorted({x[1] for x in paare_hm})
mis = sorted({x[2] for x in paare_hm})
OHNE = 30.0
kosten = np.full((len(hids), len(mis) + len(hids)), 1e6)
lageVon = {}
for c, hid, mi, lage in paare_hm:
    i, j = hids.index(hid), mis.index(mi)
    if c < kosten[i, j]:
        kosten[i, j] = c
        lageVon[(hid, mi)] = lage
for i in range(len(hids)):
    kosten[i, len(mis) + i] = OHNE
zeilenIdx, spaltenIdx = linear_sum_assignment(kosten)
plan = {}
for i, j in zip(zeilenIdx, spaltenIdx):
    if j < len(mis):
        plan[hids[i]] = lageVon[(hids[i], mis[j])]
for hid, punkt in FEST.items():
    # Auf den nächsten Tramstrich setzen
    beste = min((g.projektion(punkt, 4) for g in graphen.values()), key=lambda pr: pr[0] if pr else math.inf)
    plan[hid] = beste[4] if beste else punkt
for hid in kandidaten:
    if hid not in plan:
        print(f"  keine Marke bei «{hs[hid]['name']}»", file=sys.stderr)

# Doppelt belegte Marken melden
belegt = defaultdict(list)
for k, v in plan.items():
    belegt[v].append(k)
for v, ks in belegt.items():
    if len(ks) > 1:
        print(f"  gleiche Marke: {ks}", file=sys.stderr)

# ---------------------------------------------------------------- 5. Fehlende Haltestellen interpolieren
paare = [(merc(hs[k]), v) for k, v in plan.items()]


def lokal(g, k=6):
    """Prognose aus den k nächsten bekannten Haltestellen (gewichteter Versatz zur globalen Affinität)."""
    nah = sorted(paare, key=lambda pr: math.dist(pr[0], g))[:k]
    basis = prognose(g)
    sw, sx, sy = 0, 0, 0
    for gg, pp in nah:
        w = 1 / (math.dist(gg, g) + 50) ** 2
        q = prognose(gg)
        sx += w * (pp[0] - q[0])
        sy += w * (pp[1] - q[1])
        sw += w
    return (basis[0] + sx / sw, basis[1] + sy / sw)


herkunft = {}
for h in netz["haltestellen"]:
    if h["id"] in plan:
        herkunft[h["id"]] = "plan"
    else:
        plan[h["id"]] = lokal(merc(h))
        herkunft[h["id"]] = "geschaetzt"

# ---------------------------------------------------------------- 4. Abschnitte
linienAnKante = defaultdict(set)
for v in netz["versionen"]:
    nr = v["linie"].split("-")[1]
    for k in v["kanten"]:
        linienAnKante[k.lstrip("-")].add(nr)


def verschiebe(pfad, a, b):
    """Pfad so verbiegen, dass er genau in den Marken a und b beginnt und endet."""
    laengen = [0]
    for p, q in zip(pfad, pfad[1:]):
        laengen.append(laengen[-1] + math.dist(p, q))
    L = laengen[-1] or 1
    da = (a[0] - pfad[0][0], a[1] - pfad[0][1])
    db = (b[0] - pfad[-1][0], b[1] - pfad[-1][1])
    out = []
    for p, l in zip(pfad, laengen):
        t = l / L
        out.append((p[0] + (1 - t) * da[0] + t * db[0], p[1] + (1 - t) * da[1] + t * db[1]))
    return out


def vereinfache(pfad, eps=0.25):
    if len(pfad) < 3:
        return pfad
    a, b = pfad[0], pfad[-1]
    i, dmax = 0, 0
    for k in range(1, len(pfad) - 1):
        d = dist_punkt_strecke(pfad[k], a, b)[0]
        if d > dmax:
            i, dmax = k, d
    if dmax <= eps:
        return [a, b]
    return vereinfache(pfad[: i + 1], eps)[:-1] + vereinfache(pfad[i:], eps)


kanten = {}
quelleKante = {}
for k in netz["kanten"]:
    a, b = plan[k["a"]], plan[k["b"]]
    best = None
    if herkunft[k["a"]] == "plan" and herkunft[k["b"]] == "plan":
        eigene = {linienFarbe[nr] for nr in linienAnKante[k["id"]] if nr in linienFarbe}
        # Zuerst auf den Strichen der eigenen Linien, sonst auf irgendeinem Tramstrich (Planstand weicht ab)
        for farben, faktor in ((eigene, 2.2), (set(graphen) - eigene, 1.5)):
            for f in farben:
                if f not in graphen:
                    continue
                w = graphen[f].weg(a, b)
                if not w:
                    continue
                L = sum(math.dist(p, q) for p, q in zip(w, w[1:]))
                if L < faktor * math.dist(a, b) + 8 and (best is None or L < best[0]):
                    best = (L, w)
            if best:
                break
    if best:
        kanten[k["id"]] = vereinfache(verschiebe(best[1], a, b))
        quelleKante[k["id"]] = "plan"
    else:
        kanten[k["id"]] = [a, b]
        quelleKante[k["id"]] = "geschaetzt"

r1 = lambda p: [round(p[0], 1), round(p[1], 1)]
aus = {
    "quelle": "ZVV Liniennetzplan Stadt Zürich, gültig ab 14.12.2025",
    "groesse": [round(seite.rect.width, 1), round(seite.rect.height, 1)],
    "haltestellen": {k: r1(v) for k, v in sorted(plan.items())},
    "kanten": {k: [r1(p) for p in v] for k, v in sorted(kanten.items())},
    "herkunft": {
        "haltestellen": {k: v for k, v in sorted(herkunft.items()) if v != "plan"},
        "kanten": {k: v for k, v in sorted(quelleKante.items()) if v != "plan"},
    },
}
ZIEL.write_text(json.dumps(aus, ensure_ascii=False, separators=(",", ":")))
n_h = sum(1 for v in herkunft.values() if v == "plan")
n_k = sum(1 for v in quelleKante.values() if v == "plan")
print(f"Haltestellen aus dem Plan: {n_h}/{len(herkunft)}, Abschnitte aus dem Plan: {n_k}/{len(quelleKante)}", file=sys.stderr)
print(f"geschätzte Abschnitte: {sorted(k for k, v in quelleKante.items() if v != 'plan')}", file=sys.stderr)
