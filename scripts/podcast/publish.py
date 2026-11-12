#!/usr/bin/env python3
"""Publish a finished episode (GitHub Actions only): release files -> site data -> site rebuild -> Telegram album.

  python3 scripts/podcast/publish.py --ep /tmp/ep [--dry-run]

1. GitHub Release `podcast-<date>`: the MP3s, subtitles, covers, the lossless FLAC archive and the QC report
   (audio lives there, not in the Pages site, which has a 1 GB ceiling).
2. data/podcast/<date>.json + data/podcast/index.json are committed to main; pages.yml is dispatched so
   /podcast/<date>/ goes live; the page is checked for HTTP 200.
3. At 19:00 Tehran the album goes to @Coin_Kurd — once: the ledger ("telegram" in data/podcast/<date>.json on
   origin/main) is read first, and written right after a successful post.
--dry-run does everything that changes nothing: it checks the files, the captions and the bot's rights, and stops.
"""
import argparse
import datetime as dt
import json
import os
import subprocess
import sys
import time
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)
import labels as LB  # noqa: E402
import telegram  # noqa: E402

SITE = "https://entekhab.net"


def sh(*cmd, check=True, cwd=ROOT):
    print("+", " ".join(cmd))
    return subprocess.run(cmd, check=check, cwd=cwd, capture_output=True, text=True, errors="replace")


def release(ep, rec, live):
    tag = f"podcast-{rec['date']}"
    files = []
    for l in live:
        wav, flac = os.path.join(ep, f"podcast_{l}.wav"), os.path.join(ep, f"podcast_{l}.flac")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", wav, "-c:a", "flac", "-compression_level", "8", flac], check=True)
        files += [os.path.join(ep, f"{k}_{l}.{x}") for k, x in (("podcast", "mp3"), ("podcast", "srt"), ("podcast", "flac"),
                                                                 ("cover", "jpg"), ("social", "jpg"), ("thumb", "jpg"))]
    files += [os.path.join(ep, "qc.json"), os.path.join(ep, "episode.json")]
    title = f"{LB.SHOW['fa'][0]} · {rec['date']} · {LB.SHOW['en'][0]} #{rec['n']}"
    notes = (f"Daily podcast of entekhab.net / Coin_Kurd — {rec['date']}. Versions: {', '.join(live)}. "
             f"Page: {SITE}/podcast/{rec['date']}/ — analysis and information, not financial advice.")
    if sh("gh", "release", "view", tag, check=False).returncode == 0:
        sh("gh", "release", "upload", tag, "--clobber", *files)
    else:
        sh("gh", "release", "create", tag, "--title", title, "--notes", notes, "--latest=false", *files)
    for l in live:                                    # every audio link the page and the album use must answer
        url = rec["langs"][l]["audio"]
        for i in range(6):
            try:
                with urllib.request.urlopen(urllib.request.Request(url, method="HEAD"), timeout=60) as r:
                    if r.status == 200:
                        break
            except Exception as ex:  # noqa: BLE001
                print("audio not reachable yet", url, ex)
            time.sleep(10)
        else:
            raise SystemExit(f"release asset missing: {url}")


def commit(paths, msg):
    for i in range(4):
        sh("git", "add", *paths)
        if sh("git", "diff", "--cached", "--quiet", check=False).returncode == 0:
            return
        sh("git", "commit", "-m", msg)
        sh("git", "pull", "--rebase", "origin", "main", check=False)
        if sh("git", "push", "origin", "HEAD:main", check=False).returncode == 0:
            return
        time.sleep(15 * (i + 1))
    raise SystemExit("could not push the episode data")


def write_data(rec):
    d = os.path.join(ROOT, "data", "podcast")
    os.makedirs(d, exist_ok=True)
    p = os.path.join(d, f"{rec['date']}.json")
    old = json.load(open(p, encoding="utf-8")) if os.path.exists(p) else {}
    rec = dict(rec, telegram=old.get("telegram"))
    json.dump(rec, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    ip = os.path.join(d, "index.json")
    idx = json.load(open(ip, encoding="utf-8")) if os.path.exists(ip) else {"episodes": []}
    idx["episodes"] = [e for e in idx["episodes"] if e["date"] != rec["date"]]
    idx["episodes"].append({"date": rec["date"], "n": rec["n"], "langs": sorted(rec["langs"]),
                            "titles": {l: v["title"] for l, v in rec["langs"].items()},
                            "minutes": {l: round(v["duration"] / 60) for l, v in rec["langs"].items()}})
    idx["episodes"].sort(key=lambda e: e["date"], reverse=True)
    idx["updated_at"] = dt.datetime.now(dt.timezone.utc).isoformat()
    json.dump(idx, open(ip, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    return [p, ip]


def ledger(date):
    sh("git", "fetch", "origin", "main", check=False)
    r = sh("git", "show", f"origin/main:data/podcast/{date}.json", check=False)
    return json.loads(r.stdout).get("telegram") if r.returncode == 0 else None


def wait_page(date, until):
    url = f"{SITE}/podcast/{date}/"
    while True:
        try:
            with urllib.request.urlopen(url, timeout=30) as r:
                if r.status == 200 and date.encode() in r.read():
                    print("page live:", url); return True
        except Exception as ex:  # noqa: BLE001
            print("page not live yet:", ex)
        if time.time() > until:
            print("::warning::the episode page was not live in time; posting anyway (it follows within minutes)")
            return False
        time.sleep(30)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ep", required=True)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--no-wait", action="store_true", help="post now instead of at the release time")
    a = ap.parse_args()
    ep = a.ep
    rec = json.load(open(os.path.join(ep, "episode.json"), encoding="utf-8"))
    qc = json.load(open(os.path.join(ep, "qc.json"), encoding="utf-8"))
    plan = json.load(open(os.path.join(ep, "telegram.json"), encoding="utf-8"))
    live = [l for l in qc["publishable"] if l in rec["langs"]]
    token = os.environ.get("REF_BOT_TOKEN", "")
    print("publishable:", live, "held:", qc.get("held"))
    if token:
        ok, who = telegram.check_bot(token)
        print("bot check:", ok, who)
        if not ok and not a.dry_run:
            raise SystemExit("the bot cannot post in the channel: " + who)
    if a.dry_run:
        for it in plan["items"]:
            assert it["chars"] <= telegram.LIMIT and os.path.exists(os.path.join(ep, it["file"]))
        print("dry run: nothing released, committed or posted")
        return
    if not token:
        raise SystemExit("REF_BOT_TOKEN is not set")
    release(ep, rec, live)
    commit(write_data(rec), f"podcast: episode {rec['n']} ({rec['date']}) — {', '.join(live)}")
    sh("gh", "workflow", "run", "pages.yml", "--ref", "main", check=False)
    rel = dt.datetime.fromisoformat(rec["release_utc"]).timestamp()
    if a.no_wait or time.time() >= rel:          # a late run: give the page a few minutes, then post
        wait_page(rec["date"], until=time.time() + 12 * 60)
    else:                                        # on time: the page has until the release time, then post on the minute
        wait_page(rec["date"], until=rel)
        if time.time() < rel:
            print("waiting for the release time", rec["release_utc"])
            time.sleep(rel - time.time())
    done = ledger(rec["date"])
    if done:
        print("already posted:", done); return
    items = [it for it in plan["items"] if it["lang"] in live]
    ids = (telegram.publish(ep, token, plan, {l: True for l in live}) if len(items) > 1
           else telegram.publish_single(ep, token, plan, items[0]))
    print("posted, message ids:", ids)
    p = os.path.join(ROOT, "data", "podcast", f"{rec['date']}.json")
    sh("git", "pull", "--rebase", "origin", "main", check=False)
    d = json.load(open(p, encoding="utf-8"))
    d["telegram"] = {"chat": plan["chat"], "message_ids": ids, "langs": [it["lang"] for it in items],
                     "at": dt.datetime.now(dt.timezone.utc).isoformat()}
    json.dump(d, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    commit([p], f"podcast: posted episode {rec['n']} to Telegram")


if __name__ == "__main__":
    main()
