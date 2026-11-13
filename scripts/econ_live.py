#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CI step (update.yml): the live parts of /calendar/

  data/econ_actual.json  official actuals of the red US releases ({"v": {"<t>|USD|<title>": {"a": "0.4%", "src": "BLS"}}}),
                         keyed like data/ecocal.json events. BLS v1 has a small daily quota, so it is only asked when a
                         supported release from the last 45 days still has no number, and at most every 20 minutes
                         (every run in the 3 hours after a release).
  data/fed.json          the current target range from the latest FOMC statement, Kalshi's odds for every open FOMC
                         meeting, and a history of those odds (one point per 2 h per meeting) for the chart.

Never fails the build: every part is guarded and keeps its previous values.
"""
import json
import os
import sys
import time

import requests

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import econ_src as S  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
NOW = int(time.time())


def load(name, default):
    try:
        with open(os.path.join(DATA, name), encoding="utf-8") as f:
            return json.load(f)
    except Exception:  # noqa: BLE001
        return default


def save(name, obj):
    p = os.path.join(DATA, name)
    tmp = p + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
    os.replace(tmp, p)


def get(url, method="GET", json_body=None, text=False, **kw):
    if "json" in kw:
        json_body = kw.pop("json")
    r = requests.request(method, url, headers=S.UA, json=json_body, timeout=25)
    r.raise_for_status()
    return r.text if text else r.json()


def key(e):
    return f'{e["t"]}|{e["c"]}|{e["n"]}'


def actuals(events, old):
    v = dict(old.get("v") or {})
    out = {"v": v, "_bls_at": old.get("_bls_at", 0), "_fed_at": old.get("_fed_at", 0)}
    past = [e for e in events if S.is_alert_event(e) and NOW - 45 * 86400 < e["t"] <= NOW]
    need = [e for e in past if e["n"] in S.SPECS and key(e) not in v]
    fresh = any(NOW - e["t"] < 3 * 3600 for e in need)
    if need and (fresh or NOW - out["_bls_at"] > 20 * 60):
        try:
            series = S.bls_fetch(get, [S.SPECS[e["n"]][0] for e in need])
            out["_bls_at"] = NOW
            for e in need:
                a = S.actual_from(e["n"], e["t"], series)
                if a:
                    v[key(e)] = {"a": a, "src": "BLS"}
        except Exception as x:  # noqa: BLE001
            print("econ_live: BLS skipped:", x)
    fed_need = [e for e in past if e["n"] in S.FED_TITLES and key(e) not in v]
    if fed_need:
        try:
            st = statements()
            for e in fed_need:
                hit = next((u for ts, u in st if abs(ts - e["t"]) < 3 * 3600), None)
                if hit:
                    r = S.fed_statement(S.html_text(get(hit, text=True)))
                    if r:
                        v[key(e)] = {"a": f'{r["hi"]:.2f}%', "src": "Fed", "move": r["move"], "lo": r["lo"], "hi": r["hi"]}
        except Exception as x:  # noqa: BLE001
            print("econ_live: Fed statement skipped:", x)
    # forget numbers older than the calendar keeps (26 weeks)
    for k in list(v):
        try:
            if NOW - int(k.split("|", 1)[0]) > 190 * 86400:
                v.pop(k)
        except ValueError:
            v.pop(k)
    return out


_ST = []


def statements():
    if not _ST:
        _ST.extend(S.fed_rss(get(S.FED_RSS, text=True)))
    return _ST


def fed(old):
    out = {"src": "Kalshi", "rate": old.get("rate"), "meetings": old.get("meetings") or [], "hist": old.get("hist") or {},
           "t": old.get("t")}
    if not out["rate"] or NOW - (out["rate"] or {}).get("checked", 0) > 6 * 3600:
        try:
            st = statements()
            if st:
                ts, url = st[0]
                r = S.fed_statement(S.html_text(get(url, text=True)))
                if r:
                    r.update({"date": ts, "checked": NOW})
                    out["rate"] = r
        except Exception as x:  # noqa: BLE001
            print("econ_live: rate skipped:", x)
    try:
        ms = S.kalshi_parse(get(S.KALSHI))
        if ms:
            out["meetings"] = [dict(m, exp=S.expected_bp(m["p"])) for m in ms[:8]]
            out["t"] = NOW
            for m in ms[:8]:
                h = out["hist"].setdefault(m["ticker"], [])
                row = [NOW] + [m["p"][k] for k in S.OUT_ORDER]
                if not h or NOW - h[-1][0] >= 2 * 3600:
                    h.append(row)
                else:
                    h[-1] = row
                del h[:-400]
            live = {m["ticker"] for m in ms}
            for tk in list(out["hist"]):
                if tk not in live and NOW - out["hist"][tk][-1][0] > 30 * 86400:
                    out["hist"].pop(tk)
    except Exception as x:  # noqa: BLE001
        print("econ_live: Kalshi skipped:", x)
    return out


def main():
    events = (load("ecocal.json", {}) or {}).get("events") or []
    save("econ_actual.json", actuals(events, load("econ_actual.json", {})))
    f = fed(load("fed.json", {}))
    save("fed.json", f)
    a = load("econ_actual.json", {})
    print(f"econ_live: {len(a.get('v', {}))} actuals, rate {f.get('rate') and f['rate'].get('hi')}, "
          f"{len(f.get('meetings') or [])} meetings")


if __name__ == "__main__":
    main()
