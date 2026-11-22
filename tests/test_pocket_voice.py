#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""The Persian reading on Pocket-TTS. This engine fails SILENTLY in two ways, so both are pinned here.

  * handed Persian script it maps every letter to the unknown token and emits end-of-speech at once: a wav
    full of silence, no error, nothing in the log. So the phoneme stage must never be skipped.
  * handed a reference clip longer than five seconds it reads on from the clip's own words in the right voice
    and ignores the text it was given. So the clip that ships with the repo must be five seconds or under.

Neither shows up as a crash, which is why they are tested rather than trusted.
Run: python3 tests/test_pocket_voice.py"""
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts", "podcast"))

FAILS = []


def ok(what, cond, got=None):
    print(("PASS " if cond else "FAIL ") + what + ("" if cond else "  -> " + repr(got)))
    if not cond:
        FAILS.append(what)


# ---------------------------------------------------------------- the reference clip that ships with the repo
PROMPT = os.path.join(ROOT, "assets", "voice", "fa_male_prompt.wav")
ok("the man's reference clip is in the repository", os.path.exists(PROMPT), PROMPT)
if os.path.exists(PROMPT):
    dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                                "-of", "default=nw=1:nk=1", PROMPT], capture_output=True, text=True).stdout.strip())
    ok("it is five seconds or under, as the model requires", dur <= 5.05, dur)
    ok("it is not so short that there is nothing to clone", dur >= 2.0, dur)
    import wave
    with wave.open(PROMPT) as w:
        ok("it is mono", w.getnchannels() == 1, w.getnchannels())
        ok("it carries actual audio, not silence", w.getnframes() > 1000, w.getnframes())

# ---------------------------------------------------------------- the switch
import produce as P  # noqa: E402

os.environ.pop("PODCAST_FA_POCKET", None)
ok("with the switch off, Persian keeps the voice it has always used",
   P.voice_for("fa").get("backend") == "piper", P.voice_for("fa"))
os.environ["PODCAST_FA_POCKET"] = "1"
v = P.voice_for("fa")
ok("with the switch on, Persian reads through Pocket-TTS", v.get("backend") == "pocket", v)
ok("and it is pointed at the clip in the repository", v.get("prompt") == PROMPT, v.get("prompt"))
ok("the other languages are untouched by the switch",
   P.voice_for("en").get("backend") != "pocket" and P.voice_for("ckb").get("backend") != "pocket",
   (P.voice_for("en"), P.voice_for("ckb")))
os.environ.pop("PODCAST_FA_POCKET", None)

# ---------------------------------------------------------------- the woman's voice is out of the cycle
import glob  # noqa: E402
voices = glob.glob(os.path.join(ROOT, "assets", "voice", "*"))
ok("only the man's clip is kept: the woman's voice was dropped from the cycle",
   [os.path.basename(p) for p in voices if not os.path.basename(p).startswith(".")] == ["fa_male_prompt.wav"],
   [os.path.basename(p) for p in voices])

# ---------------------------------------------------------------- the chunking that keeps a generation ending
import tts as T  # noqa: E402

long_ph = " ".join(["salAm"] * 60)
pieces = T._pocket_chunks(long_ph)
ok("long text is cut into pieces", len(pieces) > 1, len(pieces))
ok("no piece is long enough to run away", all(len(p) <= T.POCKET_CHUNK_CHARS for p in pieces),
   max(len(p) for p in pieces))
ok("cutting loses no word", " ".join(pieces) == long_ph)
ok("a short text stays in one piece", T._pocket_chunks("salAm ?o vaqt bexeyr") == ["salAm ?o vaqt bexeyr"])
ok("nothing in, nothing out", T._pocket_chunks("") == [])

# ---------------------------------------------------------------- the recipe the model's author set out
ok("the phoneme table is the author's, unchanged",
   T.POCKET_PHONEMES == str.maketrans({"/": "a", "a": "A", "@": "?", "$": "S", "c": "C"}))
ok("the reference clip is capped at five seconds in code too", T.POCKET_PROMPT_SECONDS <= 5.0,
   T.POCKET_PROMPT_SECONDS)
src = open(os.path.join(ROOT, "scripts", "podcast", "tts.py"), encoding="utf-8").read()
ok("the ezafe marker is stripped before the model sees the text", '.replace("1", "")' in src)
ok("the question mark is dropped before the phoneme stage", "u061f" in src or "؟" in src)
ok("the reading goes through the phoneme stage, never raw Persian",
   "pocket_phonemise(text)" in src and "synth_pocket" in src)
ok("a runaway generation is retried rather than shipped", "cap" in src and "generate_audio" in src)

print(("\n%d failure(s)" % len(FAILS)) if FAILS else "\npocket voice: 0 failures")
raise SystemExit(1 if FAILS else 0)
