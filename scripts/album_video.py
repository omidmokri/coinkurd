#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""A sixty-second video of the twice-daily picture report, read aloud.

The owner's brief: instead of sending ten pictures to the channel, send one video built from those same
pictures, narrated, short enough that Telegram and Instagram both take it without cutting it up.

What this does and does not do
  * it uses the slides album.py has already drawn. It draws nothing itself and invents no number: every figure
    it speaks is read back out of the report album.py wrote beside those slides.
  * the reading is the man's voice, for both the morning and the evening edition. The owner listened to the
    alternatives and kept this one; the woman's voice was dropped from the cycle, so there is no slot for it.
  * sixty seconds is a hard ceiling, not a target. Slides are given the time their line needs and the rest are
    dropped from the end rather than the whole thing being sped up, because a report read too fast to follow
    is worth nothing.

Why 1080x1350: that is the shape album.py already draws, it is the tallest frame Instagram shows in full, and
Telegram plays it without re-encoding.

    python3 scripts/album_video.py --from OUT_DIR --out report.mp4          # OUT_DIR from album.py --render
    python3 scripts/album_video.py --from OUT_DIR --out report.mp4 --silent # assembly only, no reading
"""
import argparse
import json
import os
import subprocess
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "podcast"))

W, H = 1080, 1350
CEILING = 60.0           # seconds; the brief's own limit
MIN_SLIDE = 2.2          # no slide flashes past before it can be read
MAX_SLIDE = 9.0          # and none outstays its line
TAIL = 0.6               # a breath at the end so the last word is not clipped
FPS = 30
PROMPT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                      "assets", "voice", "fa_male_prompt.wav")


def sh(cmd):
    return subprocess.run(cmd, check=True, capture_output=True, text=True).stdout


def duration(path):
    return float(sh(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                     "-of", "default=nw=1:nk=1", path]).strip())


def lines(report):
    """One short line per slide, taken from what album.py already wrote. Nothing is composed here.

    The slides are, in order: cover, market, news, bitcoin, alts, flows, macro, opportunities, calendar,
    summary. The report carries the headline, the news it chose and the closing summary; for the slides it
    says nothing about, the video says nothing either and the picture stands on its own."""
    news = [t for t in (report.get("news_texts") or {}).values() if isinstance(t, str) and t.strip()]
    if isinstance(report.get("news_texts"), list):
        news = [t for t in report["news_texts"] if isinstance(t, str) and t.strip()]
    out = [None] * 10
    if report.get("headline"):
        out[0] = report["headline"]
    for i, t in enumerate(news[:3]):
        if 2 + i < 9:
            out[2 + i] = t
    if report.get("summary"):
        out[9] = report["summary"]
    return out


def say(text, out_wav):
    """Read one line in the man's voice. Raises rather than returning silence: this engine's way of failing
    is to produce a silent file, and a silent report is worse than no report."""
    import numpy as np
    import soundfile as sf
    import tts
    a, sr = tts.synth_pocket(text, PROMPT)
    if a is None or len(a) < sr * 0.3 or float(np.max(np.abs(a))) < 0.01:
        raise RuntimeError(f"the reading came back silent for: {text[:60]!r}")
    sf.write(out_wav, a, sr)
    return len(a) / sr


def plan(slides, spoken):
    """How long each slide stays up, and which ones make the cut.

    A slide with a line stays as long as its line takes; one without gets the floor. Then, if the whole runs
    past the ceiling, slides come off the END until it fits. Nothing is sped up."""
    want = []
    for i in range(len(slides)):
        d = spoken[i] + 0.45 if spoken[i] else MIN_SLIDE
        want.append(max(MIN_SLIDE, min(MAX_SLIDE, d)))
    keep = len(want)
    while keep > 1 and sum(want[:keep]) + TAIL > CEILING:
        keep -= 1
    return want[:keep], keep


def build(src, out, silent=False):
    report = json.load(open(os.path.join(src, "report.json"), encoding="utf-8"))
    slides = sorted(p for p in os.listdir(src) if p.endswith(".jpg"))
    if not slides:
        raise SystemExit(f"no slides in {src}: run album.py --render first")
    text = lines(report)[:len(slides)]

    with tempfile.TemporaryDirectory() as tmp:
        spoken, wavs = [], []
        for i, t in enumerate(text):
            if silent or not t:
                spoken.append(0.0)
                wavs.append(None)
                continue
            w = os.path.join(tmp, f"say{i:02d}.wav")
            spoken.append(say(t, w))
            wavs.append(w)

        hold, keep = plan(slides, spoken)
        print(f"{keep} of {len(slides)} slides, {sum(hold) + TAIL:.1f}s", flush=True)

        # the pictures: a slow push in on each, so a still frame does not read as a frozen video
        parts = []
        for i in range(keep):
            seg = os.path.join(tmp, f"seg{i:02d}.mp4")
            n = max(1, int(hold[i] * FPS))
            sh(["ffmpeg", "-v", "error", "-y", "-loop", "1", "-i", os.path.join(src, slides[i]),
                "-vf", f"scale={W * 2}:{H * 2},zoompan=z='min(zoom+0.0006,1.06)':d={n}:"
                       f"x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s={W}x{H}:fps={FPS},"
                       f"format=yuv420p",
                "-t", f"{hold[i]:.3f}", "-r", str(FPS), "-c:v", "libx264", "-preset", "medium",
                "-crf", "20", "-pix_fmt", "yuv420p", seg])
            parts.append(seg)

        lst = os.path.join(tmp, "parts.txt")
        with open(lst, "w", encoding="utf-8") as fh:
            for p in parts:
                fh.write(f"file '{p}'\n")
        mute = os.path.join(tmp, "mute.mp4")
        sh(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", mute])

        # the reading, laid under the pictures so each line starts when its slide appears
        narr = os.path.join(tmp, "narration.wav")
        if any(wavs[:keep]):
            inputs, filt, at = [], [], 0.0
            for i in range(keep):
                if wavs[i]:
                    inputs += ["-i", wavs[i]]
                    filt.append(f"[{len(inputs) // 2 - 1}:a]adelay={int(at * 1000)}|{int(at * 1000)}[a{i}]")
                at += hold[i]
            mix = "".join(f"[a{i}]" for i in range(keep) if wavs[i])
            n = sum(1 for i in range(keep) if wavs[i])
            sh(["ffmpeg", "-v", "error", "-y"] + inputs +
               ["-filter_complex", ";".join(filt) + f";{mix}amix=inputs={n}:normalize=0[out]",
                "-map", "[out]", "-ar", "48000", "-ac", "2", narr])
        else:
            sh(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i",
                f"anullsrc=r=48000:cl=stereo:d={sum(hold) + TAIL:.3f}", narr])

        sh(["ffmpeg", "-v", "error", "-y", "-i", mute, "-i", narr,
            "-c:v", "copy", "-c:a", "aac", "-b:a", "128k", "-ar", "48000", "-ac", "2",
            "-shortest" if False else "-t", f"{sum(hold) + TAIL:.3f}",
            "-movflags", "+faststart", out])

    d = duration(out)
    if d > CEILING + 0.5:
        raise SystemExit(f"the video came out at {d:.1f}s, past the {CEILING:.0f}s ceiling")
    print(f"written {out} — {d:.1f}s, {W}x{H}")
    return 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--from", dest="src", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--silent", action="store_true", help="assemble the pictures without reading them")
    a = ap.parse_args()
    return build(a.src, a.out, a.silent)


if __name__ == "__main__":
    sys.exit(main())
