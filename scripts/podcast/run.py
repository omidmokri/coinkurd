#!/usr/bin/env python3
"""Make today's episode end to end, without publishing anything.

  python3 scripts/podcast/run.py --out /tmp/ep            (CI: from the repo root, after models.py)

collect -> write (Gemini, gated) -> voices -> covers -> mix/master -> QC -> episode.json + telegram.json

A language that fails any gate is HELD: it is left out of the album and the site, and the reason is in qc.json.
The Persian master failing holds the whole episode. Exit code 0 when at least one language is publishable.
"""
import argparse
import datetime as dt
import glob
import json
import os
import re
import subprocess
import sys
import traceback

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)
import labels as LB  # noqa: E402

TEHRAN = dt.timezone(dt.timedelta(hours=3, minutes=30))
RELEASE_TEHRAN = (19, 0)                     # the owner's time: every day at 19:00 Tehran (15:30 UTC)
REPO = os.environ.get("GITHUB_REPOSITORY", "omidmokri/coinkurd")
DIGIT = re.compile(r"[0-9۰-۹٠-٩]")


def release_utc(day):
    return dt.datetime(day.year, day.month, day.day, *RELEASE_TEHRAN, tzinfo=TEHRAN).astimezone(dt.timezone.utc)


def episode_number(root, day):
    idx = os.path.join(root, "data", "podcast", "index.json")
    eps = json.load(open(idx, encoding="utf-8")).get("episodes", []) if os.path.exists(idx) else []
    prior = [e for e in eps if e["date"] < day.isoformat()]
    same = [e for e in eps if e["date"] == day.isoformat()]
    return same[0]["n"] if same else len(prior) + 1


def add_display(sc):
    import produce
    d = lambda t: produce.display_text(t, sc["lang"])  # noqa: E731
    sc["display"] = {"title": d(sc["title"]), "seo_title": d(sc["seo_title"]), "meta_description": d(sc["meta_description"]),
                     "summary": d(sc["summary"]), "key_points": [d(k) for k in sc["key_points"]]}
    return sc


def health_problems(h, chapters):
    p = []
    if h["decode_errors"]:
        p.append(f"decode errors: {h['decode_errors'][:100]}")
    if not 300 <= h["duration_s"] <= 1800:
        p.append(f"duration {h['duration_s']} s outside 5-30 min")
    if not -17.5 <= h["lufs"] <= -14.5:
        p.append(f"loudness {h['lufs']} LUFS")
    if h["clipped_samples"]:
        p.append(f"{h['clipped_samples']} clipped samples")
    if h["silences_over_3s"]:
        p.append(f"{h['silences_over_3s']} silences over 3 s")
    if h["chapters"] != chapters or not h["has_cover"]:
        p.append(f"chapters {h['chapters']}/{chapters}, cover {h['has_cover']}")
    return p


def sources(ep, sc_fa, inputs, facts):
    used = set(sc_fa.get("news_used", []))
    news = [n for n in inputs["news"] if n["id"] in used or n["url"] in used]
    posts = [p for p in inputs["posts"] if p["url"] in used]
    pages = sorted({f["page"] for f in facts["facts"].values()})
    return {"site": pages, "channel": [p["url"] for p in posts],
            "news": [{"title": n["title"], "outlets": n["outlets"], "urls": n["urls"] or [n["url"]]} for n in news],
            "data": "Every figure comes from entekhab.net's data files at the snapshot time (facts.json)."}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--root", default=ROOT)
    ap.add_argument("--date", help="YYYY-MM-DD (default: today in Tehran)")
    ap.add_argument("--langs", default=",".join(LB.LANGS))
    ap.add_argument("--skip-write", action="store_true", help="use the script_*.json already in --out")
    ap.add_argument("--no-asr", action="store_true")
    a = ap.parse_args()
    ep = os.path.abspath(a.out)
    os.makedirs(ep, exist_ok=True)
    day = dt.date.fromisoformat(a.date) if a.date else dt.datetime.now(TEHRAN).date()
    rel = release_utc(day)
    n = episode_number(a.root, day)
    langs = [l for l in LB.LANGS if l in a.langs.split(",")]
    held, qcrep = {}, {"date": day.isoformat(), "n": n, "release_utc": rel.isoformat(), "langs": {}}

    def hold(lang, why):
        held.setdefault(lang, why)
        print(f"HOLD {lang}: {why}")

    # 1. facts
    import collect
    facts = collect.collect(a.root)
    json.dump(facts, open(os.path.join(ep, "facts.json"), "w"), ensure_ascii=False, indent=1, default=str)
    inputs = collect.inputs(a.root, facts["meta"]["snapshot_utc"])
    json.dump(inputs, open(os.path.join(ep, "inputs.json"), "w"), ensure_ascii=False, indent=1)
    qcrep["facts_missing"] = facts["meta"]["missing"]
    print("facts", len(facts["facts"]), "news", len(inputs["news"]), "posts", len(inputs["posts"]), "missing", facts["meta"]["missing"])

    # 2. scripts
    if not a.skip_write:
        import write
        rep = write.write_all(ep, day, n, rel, langs=tuple(l for l in langs if l != "fa"))
        qcrep["write_log"] = rep["log"]
        for line in rep["log"]:                      # in the job log: the artifact is not always reachable
            print("write:", line[:1500])
        for l, why in rep["held"].items():
            hold(l, f"writing: {why}")
    scripts = {}
    for l in langs:
        if l in held:
            continue
        p = os.path.join(ep, f"script_{l}.json")
        if not os.path.exists(p):
            hold(l, "no script"); continue
        scripts[l] = add_display(json.load(open(p, encoding="utf-8")))
        json.dump(scripts[l], open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    if "fa" not in scripts:
        qcrep["held"] = held
        json.dump(qcrep, open(os.path.join(ep, "qc.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        sys.exit("the Persian master is held: no episode today")

    # 3. voices
    import produce
    for l in list(scripts):
        try:
            m = produce.build(ep, l)
            qcrep["langs"].setdefault(l, {})["voice"] = {"duration": m["duration"], "wpm": m["wpm"], "words": m["words"]}
            print(l, "voice", m["duration"], "s")
        except Exception as ex:  # noqa: BLE001
            traceback.print_exc()
            hold(l, f"voice: {ex!r}")
    live = [l for l in scripts if l not in held]
    if l_ckb := ("ckb" if "ckb" in live else None):
        import ckb
        tl = json.load(open(os.path.join(ep, "timeline_ckb.json"), encoding="utf-8"))["timeline"]
        wrong = [(x["text"], v, w, back) for x in tl if "text" in x for v, w, back in ckb.check_numbers(x["text"])
                 if back is None or abs(back - v) > 1e-9]
        qcrep["langs"]["ckb"]["numbers_spoken"] = {"wrong": wrong[:5], "checked": sum(len(ckb.check_numbers(x["text"])) for x in tl if "text" in x)}
        if wrong:
            hold(l_ckb, f"{len(wrong)} number(s) read wrongly, e.g. {wrong[0]}")

    # 4. music, covers, master
    music = os.path.join(ep, "music")
    if not os.path.exists(os.path.join(music, "ending.wav")):
        subprocess.run([sys.executable, os.path.join(HERE, "music.py"), music], check=True)
    import covers
    import finalize
    live = [l for l in scripts if l not in held]
    covers.make(ep, a.root, os.path.join(a.root, "assets"), langs=live)
    for l in live:
        try:
            o = finalize.finalize(ep, l, music)
            p = health_problems(o["health"], len(LB.SECTION_IDS))
            qcrep["langs"][l]["audio"] = o["health"]
            if p:
                hold(l, "audio: " + "; ".join(p))
        except Exception as ex:  # noqa: BLE001
            traceback.print_exc()
            hold(l, f"mix: {ex!r}")

    # 5. listening test (Whisper cannot hear Sorani; its numbers are checked above instead)
    import qc
    if not a.no_asr:
        for l in [x for x in scripts if x not in held and x != "ckb"]:
            try:
                r = qc.asr_sample(ep, l, n=12)
                qcrep["langs"][l]["asr"] = {k: r[k] for k in ("pcer_mean", "numbers_heard_correctly")}
                print(l, "asr", json.dumps({k: v for k, v in r.items() if k != "rows"}, ensure_ascii=False)[:600])
                for it in (r.get("rows") or [])[:12]:
                    print("  asr", json.dumps(it, ensure_ascii=False)[:400])
                json.dump(r, open(os.path.join(ep, f"qc_asr_{l}.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
                if r["pcer_mean"] > 0.35:
                    hold(l, f"listening test: phonetic error {r['pcer_mean']}")
            except Exception as ex:  # noqa: BLE001
                traceback.print_exc()
                qcrep["langs"][l]["asr"] = {"error": repr(ex)}

    # 6. the episode record (site + Telegram)
    live = [l for l in scripts if l not in held]
    base = f"https://github.com/{REPO}/releases/download/podcast-{day.isoformat()}"
    rec = {"date": day.isoformat(), "n": n, "release_utc": rel.isoformat(), "snapshot_utc": facts["meta"]["snapshot_utc"],
           "sources": sources(ep, scripts["fa"], inputs, facts), "langs": {}, "held": {l: held[l] for l in held}}
    for l in live:
        sc, mx = scripts[l], json.load(open(os.path.join(ep, f"mix_{l}.json"), encoding="utf-8"))
        tl = json.load(open(os.path.join(ep, f"timeline_{l}.json"), encoding="utf-8"))["timeline"]
        tr = []
        for s in sc["sections"]:
            paras = {}
            for x in tl:
                if x.get("section") == s["id"] and "text" in x:
                    paras.setdefault(x["para"], []).append(x["text"])
            tr.append({"id": s["id"], "title": s["title"], "paras": [" ".join(v) for _, v in sorted(paras.items())]})
        rec["langs"][l] = {"show": sc["show"], "episode_label": sc["episode_label"], "date_label": sc["date_label"], **sc["display"],
                           "chapters": mx["chapters"], "duration": mx["duration"], "size_mb": mx["health"]["size_mb"],
                           "audio": f"{base}/podcast_{l}.mp3", "srt": f"{base}/podcast_{l}.srt", "cover": f"{base}/cover_{l}.jpg",
                           "social": f"{base}/social_{l}.jpg", "transcript": tr}
    json.dump(rec, open(os.path.join(ep, "episode.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    qcrep["held"], qcrep["publishable"] = held, live
    json.dump(qcrep, open(os.path.join(ep, "qc.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    if live:
        import telegram
        plan = telegram.build(ep, live)
        for it in plan["items"]:
            print("telegram", it["lang"], it["chars"], "chars")
    print("publishable:", live, "held:", list(held))
    sys.exit(0 if live else 1)


if __name__ == "__main__":
    main()
