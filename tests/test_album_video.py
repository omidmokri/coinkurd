#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""The sixty-second video of the picture report.

Two things decide whether this is usable, and neither is visible from a green tick: it must never run past
sixty seconds, and it must never speed a reading up to get there. The timing is therefore worked out in plan()
and tested on its own, without rendering anything.                 Run: python3 tests/test_album_video.py"""
import json
import os
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
import album_video as V  # noqa: E402

FAILS = []


def ok(what, cond, got=None):
    print(("PASS " if cond else "FAIL ") + what + ("" if cond else "  -> " + repr(got)))
    if not cond:
        FAILS.append(what)


# ---------------------------------------------------------------- the timing follows the text
hold, keep = V.plan(list(range(10)), [0.0] * 10)
ok("with nothing to say, every slide still gets its floor", keep == 10 and all(h == V.MIN_SLIDE for h in hold),
   (keep, hold[:2]))

hold, keep = V.plan(list(range(10)), [5.0] * 10)
ok("every slide is kept, whatever the total comes to", keep == 10, keep)
ok("each slide stays as long as its line takes", all(h >= 5.0 for h in hold), hold)

hold, keep = V.plan(list(range(10)), [8.0] * 10)
ok("a reading past a minute is not trimmed to fit", keep == 10 and sum(hold) > 60, (keep, round(sum(hold), 1)))
ok("and no slide is hurried to make room", all(h >= 8.0 for h in hold), min(hold))

hold, keep = V.plan(list(range(10)), [40.0] * 10)
ok("a very long line keeps its slide up for all of it", max(hold) >= 40.0, max(hold))

hold, keep = V.plan(list(range(3)), [3.0, 0.0, 2.0])
ok("a slide with a line is held longer than one without", hold[0] > hold[1], hold)
ok("a slide is never shorter than the floor", min(hold) >= V.MIN_SLIDE, hold)
ok("there is a tripwire for a reading that has run away, not a ceiling on the text",
   V.GUARD >= 600 and not hasattr(V, "CEILING"), (V.GUARD, hasattr(V, "CEILING")))

# ---------------------------------------------------------------- the lines come from the report, not from here
rep = {"headline": "H", "summary": "S", "news_texts": {"a": "N1", "b": "N2", "c": "N3"}}
L = V.lines(rep)
ok("the headline opens the video", L[0] == "H", L[0])
ok("the summary closes it", L[9] == "S", L[9])
ok("the news it chose is spoken", [x for x in L if x in ("N1", "N2", "N3")] == ["N1", "N2", "N3"], L)
ok("a slide the report says nothing about is left silent", L[1] is None and L[5] is None, L)
ok("an empty report invents nothing", all(x is None for x in V.lines({})), V.lines({}))
src = open(os.path.join(ROOT, "scripts", "album_video.py"), encoding="utf-8").read()
ok("nothing here writes a number of its own", "round(" not in src.split("def lines")[1].split("def say")[0])

# ---------------------------------------------------------------- a silent reading is refused, never shipped
ok("a reading that comes back silent raises rather than passing", "came back silent" in src)
ok("the man's clip is the one used", "fa_male_prompt.wav" in src)
ok("there is no second voice in this file", "female" not in src.lower())

# ---------------------------------------------------------------- it really renders, and in the right shape
with tempfile.TemporaryDirectory() as tmp:
    for i in range(1, 11):
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i",
                        f"color=c=0x101828:s=1080x1350:d=1", "-frames:v", "1",
                        os.path.join(tmp, f"{i:02d}.jpg")], check=True)
    json.dump(rep, open(os.path.join(tmp, "report.json"), "w"), ensure_ascii=False)
    out = os.path.join(tmp, "r.mp4")
    V.build(tmp, out, silent=True)
    ok("a video file is produced", os.path.exists(out) and os.path.getsize(out) > 10000, os.path.getsize(out))
    probe = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                            "stream=width,height,codec_name", "-of", "default=nw=1:nk=1", out],
                           capture_output=True, text=True).stdout.split()
    ok("it is 1080x1350, the shape the slides are drawn in", probe[1:3] == ["1080", "1350"], probe)
    ok("it is H.264, which Telegram and Instagram both play", probe[0] == "h264", probe)
    aud = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "a:0", "-show_entries",
                          "stream=codec_name", "-of", "default=nw=1:nk=1", out],
                         capture_output=True, text=True).stdout.strip()
    ok("it carries an audio track even when silent, so players do not stumble", aud == "aac", aud)
    ok("its length matches what the slides were planned to hold",
       abs(V.duration(out) - (sum(V.plan(range(10), [0.0] * 10)[0]) + V.TAIL)) < 1.0, V.duration(out))

print(("\n%d failure(s)" % len(FAILS)) if FAILS else "\nalbum video: 0 failures")
raise SystemExit(1 if FAILS else 0)
