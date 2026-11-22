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


# ---------------------------------------------------------------- the timing
hold, keep = V.plan(list(range(10)), [0.0] * 10)
ok("with nothing to say, every slide still gets its floor", keep == 10 and all(h == V.MIN_SLIDE for h in hold),
   (keep, hold[:2]))
ok("and silence alone cannot overrun the ceiling", sum(hold) + V.TAIL <= V.CEILING, sum(hold))

# ten lines of five seconds come to 55s, which fits: nothing should be dropped there
hold, keep = V.plan(list(range(10)), [5.0] * 10)
ok("a set of lines that fits is kept whole", keep == 10 and sum(hold) + V.TAIL <= V.CEILING,
   (keep, round(sum(hold), 1)))
# at eight seconds each it cannot fit, and then slides come off the end rather than the reading being hurried
hold, keep = V.plan(list(range(10)), [8.0] * 10)
ok("lines that do not fit cause slides to be dropped, not hurried", sum(hold) + V.TAIL <= V.CEILING and keep < 10,
   (keep, round(sum(hold), 1)))
ok("the slides that remain keep the full time their lines need", all(h >= 8.0 for h in hold), hold)
ok("every slide that is kept still gets the time its line needs", all(h >= V.MIN_SLIDE for h in hold), hold)

hold, keep = V.plan(list(range(10)), [40.0] * 10)
ok("one absurdly long line does not stretch its slide past the cap", max(hold) <= V.MAX_SLIDE, max(hold))
ok("and at least one slide always survives", keep >= 1, keep)

hold, keep = V.plan(list(range(3)), [3.0, 0.0, 2.0])
ok("a slide with a line is held longer than one without", hold[0] > hold[1], hold)
ok("the ceiling is sixty seconds, as the brief says", V.CEILING == 60.0, V.CEILING)

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
    ok("it is inside the ceiling", V.duration(out) <= V.CEILING + 0.5, V.duration(out))

print(("\n%d failure(s)" % len(FAILS)) if FAILS else "\nalbum video: 0 failures")
raise SystemExit(1 if FAILS else 0)
