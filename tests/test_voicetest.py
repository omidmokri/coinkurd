#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""The pitch measure that decides whether a candidate voice is a woman's reading or a man's.

A model card can say "female voice" and be wrong — one of the candidates says exactly that while naming the male
dataset it was trained on — so the decision rests on a measurement. This test holds that measurement to the only
ground truth available: the owner's own two samples, one of each, which must come out on the right side with a
clear gap between them.                                   Run: python3 tests/test_obs_vprofile.py-style, as a script.
"""
import os
import subprocess
import sys
import wave

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts", "podcast"))
import voicetest as V  # noqa: E402

FAILS = []


def ok(what, cond, got=None):
    print(("PASS " if cond else "FAIL ") + what + ("" if cond else "  -> " + repr(got)))
    if not cond:
        FAILS.append(what)


def tone(path, hz, seconds=1.2, sr=16000):
    """A buzz at a known pitch: rich in harmonics, the way a voice is, so the measure has something real to find."""
    t = np.arange(int(sr * seconds)) / sr
    x = sum(np.sin(2 * np.pi * hz * k * t) / k for k in range(1, 12))
    x = (x / np.max(np.abs(x)) * 0.5 * 32767).astype("<i2")
    with wave.open(path, "wb") as w:
        w.setnchannels(1), w.setsampwidth(2), w.setframerate(sr)
        w.writeframes(x.tobytes())


# ---------------------------------------------------------------- the measure finds a pitch it is given
import tempfile  # noqa: E402

with tempfile.TemporaryDirectory() as tmp:
    for want in (110.0, 150.0, 200.0, 260.0):
        p = os.path.join(tmp, f"t{int(want)}.wav")
        tone(p, want)
        got, frames = V.f0_median(p)
        ok(f"a {want:.0f} Hz tone is measured as {want:.0f} Hz", abs(got - want) < want * 0.04, (got, frames))

# ---------------------------------------------------------------- how a reading is named
ok("a high reading is called a woman's range", "woman" in V.reads_as(195.1), V.reads_as(195.1))
ok("a low reading is called a man's range", "man" in V.reads_as(113.5), V.reads_as(113.5))
ok("a reading in between is not guessed at", "listen" in V.reads_as(155.0), V.reads_as(155.0))
ok("silence is reported as silence, not as a voice", "no voiced" in V.reads_as(0.0), V.reads_as(0.0))

# ---------------------------------------------------------------- the only ground truth there is
SAMPLES = {"female": "/mnt/user-data/uploads/9a14181b-female_03.mp3",
           "male": "/mnt/user-data/uploads/cfe9de35-male_03.mp3"}
if all(os.path.exists(p) for p in SAMPLES.values()):
    read = {}
    for who, p in SAMPLES.items():
        hz, frames = V.f0_median(p)
        read[who] = hz
        ok(f"the {who} sample has speech in it", frames > 200, frames)
    ok("the woman's sample is placed in a woman's range", "woman" in V.reads_as(read["female"]),
       (read["female"], V.reads_as(read["female"])))
    ok("the man's sample is placed in a man's range", "man" in V.reads_as(read["male"]),
       (read["male"], V.reads_as(read["male"])))
    ok("the two are far enough apart that the call is not a close one",
       read["female"] - read["male"] > 40, (read["female"], read["male"]))
else:
    print("SKIP  the owner's samples are not on this machine; the tone checks above still ran")

# ---------------------------------------------------------------- the candidates are declared honestly
ok("every candidate names where it comes from", all(c.get("repo") for c in V.CANDIDATES))
ok("every candidate names its licence, 'unknown' included", all(c.get("licence") for c in V.CANDIDATES))
ok("the sentences include one thick with figures",
   any(any(d in s for d in "۰۱۲۳۴۵۶۷۸۹") or "هزار" in s for s in V.SENTENCES), V.SENTENCES)
ok("nothing here publishes anything", "sendMediaGroup" not in open(V.__file__, encoding="utf-8").read())

print(("\n%d failure(s)" % len(FAILS)) if FAILS else "\nvoice test: 0 failures")
raise SystemExit(1 if FAILS else 0)
