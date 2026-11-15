#!/usr/bin/env python3
"""/world/ 3D globe: the land dots. Natural Earth land at 1:50m (public domain; via the npm package world-atlas@2, a
TopoJSON file) is drawn into an equirectangular mask; points of a Fibonacci sphere that fall on land are kept and written
as little-endian int16 pairs (latitude×100, longitude×100), base64, to assets/world/land.json.
Run: npm pack world-atlas@2 && tar xzf world-atlas-*.tgz && python3 scripts/world_land.py package/land-50m.json"""
import base64
import json
import math
import os
import struct
import sys

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
N, W, H = 18000, 2880, 1440


def decode(topo):
    sc, tr = topo["transform"]["scale"], topo["transform"]["translate"]
    arcs = []
    for a in topo["arcs"]:
        x = y = 0
        pts = []
        for dx, dy in a:
            x += dx
            y += dy
            pts.append((x * sc[0] + tr[0], y * sc[1] + tr[1]))
        arcs.append(pts)

    def ring(ix):
        out = []
        for i in ix:
            seg = arcs[i] if i >= 0 else arcs[~i][::-1]
            out += seg if not out else seg[1:]
        return out
    polys = []
    for g in topo["objects"]["land"]["geometries"]:
        ps = g["arcs"] if g["type"] == "MultiPolygon" else [g["arcs"]]
        for p in ps:
            polys.append([ring(r) for r in p])
    return polys


def main(path):
    polys = decode(json.load(open(path)))
    im = Image.new("1", (W, H), 0)
    dr = ImageDraw.Draw(im)
    px = lambda lon, lat: ((lon + 180) / 360 * W, (90 - lat) / 180 * H)  # noqa: E731
    for p in polys:
        dr.polygon([px(*q) for q in p[0]], fill=1)
        for hole in p[1:]:
            dr.polygon([px(*q) for q in hole], fill=0)
    m = im.load()
    out = []
    for i in range(N):
        y = 1 - (i + 0.5) / N * 2
        lat = math.degrees(math.asin(y))
        lon = math.degrees((i * 2.399963229728653) % (2 * math.pi)) - 180
        X, Y = px(lon, lat)
        if m[min(W - 1, int(X)), min(H - 1, int(Y))] and lat > -60:
            out.append((round(lat * 100), round(lon * 100)))
    b = b"".join(struct.pack("<hh", a, o) for a, o in out)
    json.dump({"src": "Natural Earth 1:50m land (public domain), via world-atlas@2", "n": len(out), "p": base64.b64encode(b).decode()},
              open(os.path.join(ROOT, "assets", "world", "land.json"), "w"), separators=(",", ":"))
    print(len(out), "land points")


if __name__ == "__main__":
    main(sys.argv[1])
