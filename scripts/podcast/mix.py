"""Assemble one language: voice + original music -> mastered WAV (archive) and MP3 (publishing),
plus chapters (timestamps) and SRT subtitles taken from the measured sentence timings.

Layout: theme intro (6 s) -> opening over a ducked bed -> sections separated by a short sting
-> closing over the bed -> theme swell -> final chord. Loudness: -16 LUFS integrated, -1.5 dBTP.
"""
import json
import os
import subprocess
import sys

import numpy as np
import soundfile as sf

SR = 44100
BED_DB = -21.0          # music under speech, relative to full level
INTRO_S = 6.0           # music alone before the first word
GAP_S = 2.3             # silence between sections; the sting lives here


def db(x):
    return 10 ** (x / 20)


def load(path):
    x, sr = sf.read(path, dtype="float32", always_2d=True)
    assert sr == SR, (path, sr)
    return x


def ramp(n, a, b):
    return np.linspace(a, b, max(1, n), dtype=np.float32)


def voice_chain(src, dst):
    """Speech polish with ffmpeg: rumble cut, gentle compression, a little presence."""
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", src, "-af",
                    "highpass=f=70,acompressor=threshold=-22dB:ratio=2.2:attack=8:release=120:makeup=2,"
                    "equalizer=f=3200:t=q:w=1.2:g=1.5,equalizer=f=220:t=q:w=1:g=-1",
                    "-ar", str(SR), "-ac", "1", dst], check=True)


def build(ep, lang, music_dir):
    tl = json.load(open(os.path.join(ep, f"timeline_{lang}.json"), encoding="utf-8"))
    vpath = os.path.join(ep, f"voice_{lang}.wav"); vproc = os.path.join(ep, f".voice_{lang}.proc.wav")
    voice_chain(vpath, vproc)
    v = load(vproc)[:, 0]
    theme, sting, ending = (load(os.path.join(music_dir, f)) for f in ("theme.wav", "sting.wav", "ending.wav"))
    marks = [m for m in tl["timeline"] if "section_mark" in m]
    # --- place sections
    pieces, chapters, offset_of = [], [], {}
    t = INTRO_S
    for i, m in enumerate(marks):
        seg = v[int(m["start"] * SR): int(m["end"] * SR)]
        offset_of[m["section_mark"]] = t - m["start"]
        chapters.append({"id": m["section_mark"], "title": m["title"], "start": round(t if i else 0.0, 2)})
        pieces.append((t, seg))
        t += len(seg) / SR
        if i < len(marks) - 1:
            t += GAP_S
    voice_end = t
    total = voice_end + 2 * 2.4 + len(ending) / SR + 0.5
    n = int(total * SR)
    out = np.zeros((n, 2), np.float32)
    vtrack = np.zeros(n, np.float32)
    for st, seg in pieces:
        i = int(st * SR); vtrack[i:i + len(seg)] += seg
    # --- music: intro + bed under the opening
    open_end = pieces[0][0] + len(pieces[0][1]) / SR
    bed = np.zeros((n, 2), np.float32)
    k = min(n, int((open_end + 3.0) * SR))
    loop = np.concatenate([theme] * 4)[:k]
    g = np.ones(k, np.float32)
    a, b = int((INTRO_S - 0.6) * SR), int(INTRO_S * SR)
    g[a:b] = ramp(b - a, 1, db(BED_DB)); g[b:] = db(BED_DB)
    f0 = int(open_end * SR); g[f0:k] *= ramp(k - f0, 1, 0)
    bed[:k] += loop * g[:, None]
    # --- stings between sections
    for (st, seg), (st2, _) in zip(pieces[:-1], pieces[1:]):
        end = st + len(seg) / SR
        i = int((end + 0.35) * SR); j = min(n, i + len(sting))
        out[i:j] += sting[: j - i] * db(-6)
    # --- bed under the closing section, then swell and final chord
    last_st = pieces[-1][0]
    s0 = int((last_st - 1.0) * SR); swell = int(voice_end * SR) + int(0.4 * SR)
    stop = min(n, swell + int(2 * 2.4 * SR))
    loop = np.concatenate([theme] * 6)[: stop - s0]
    g = np.full(stop - s0, db(BED_DB), np.float32)
    g[: int(1.0 * SR)] = ramp(int(1.0 * SR), 0, db(BED_DB))
    w = swell - s0; g[w: w + int(0.8 * SR)] = ramp(int(0.8 * SR), db(BED_DB), 1)[: len(g[w: w + int(0.8 * SR)])]
    g[w + int(0.8 * SR):] = 1.0
    g[-int(0.6 * SR):] *= ramp(int(0.6 * SR), 1, 0.25)
    bed[s0:stop] += loop * g[:, None]
    e0 = stop - int(0.5 * SR); e1 = min(n, e0 + len(ending))
    out[e0:e1] += ending[: e1 - e0] * db(-2)
    # music under speech is high-passed in effect by keeping it low; voice sits on top, centred
    out += bed
    out += vtrack[:, None] * db(-1.0)
    # trim trailing silence
    nz = np.where(np.abs(out).max(1) > 1e-4)[0]
    out = out[: nz[-1] + int(0.3 * SR)]
    raw = os.path.join(ep, f".mix_{lang}.wav")
    sf.write(raw, out, SR, subtype="FLOAT")
    os.remove(vproc)
    return raw, chapters, offset_of, len(out) / SR


def loudnorm(src, dst_wav, dst_mp3, meta, chapters, cover=None):
    """Two-pass EBU R128 normalisation to -16 LUFS / -1.5 dBTP, then WAV (archive) and MP3 (64 kbps mono)."""
    p = subprocess.run(["ffmpeg", "-hide_banner", "-i", src, "-af", "loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json",
                        "-f", "null", "-"], capture_output=True, text=True)
    js = p.stderr[p.stderr.rfind("{"): p.stderr.rfind("}") + 1]
    m = json.loads(js)
    af = (f"loudnorm=I=-16:TP=-1.5:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:"
          f"measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", src, "-af", af, "-ar", str(SR), "-c:a", "pcm_s16le", dst_wav], check=True)
    # chapters + tags for the MP3
    md = os.path.splitext(dst_mp3)[0] + ".ffmeta"
    with open(md, "w", encoding="utf-8") as f:
        f.write(";FFMETADATA1\n")
        for k, v in meta.items():
            f.write(f"{k}={str(v).replace('=', ' ').replace(chr(10), ' ')}\n")
        dur_ms = int(float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", dst_wav],
                                          capture_output=True, text=True).stdout.strip()) * 1000)
        for i, c in enumerate(chapters):
            end = int(chapters[i + 1]["start"] * 1000) if i + 1 < len(chapters) else dur_ms
            f.write(f"[CHAPTER]\nTIMEBASE=1/1000\nSTART={int(c['start'] * 1000)}\nEND={end}\ntitle={c['title']}\n")
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-i", dst_wav, "-i", md]
    if cover:
        cmd += ["-i", cover, "-map", "0:a", "-map", "2:v", "-c:v", "mjpeg", "-disposition:v", "attached_pic",
                "-metadata:s:v", "title=Cover", "-metadata:s:v", "comment=Cover (front)"]
    else:
        cmd += ["-map", "0:a"]
    cmd += ["-map_metadata", "1", "-map_chapters", "1", "-ac", "1", "-c:a", "libmp3lame", "-b:a", "64k", "-ar", str(SR),
            "-id3v2_version", "3", dst_mp3]
    subprocess.run(cmd, check=True)
    os.remove(md)
    return m


def srt(ep, lang, offset_of, maxc=42):
    tl = json.load(open(os.path.join(ep, f"timeline_{lang}.json"), encoding="utf-8"))["timeline"]
    rlm = "‏" if lang in ("fa", "ar", "ckb") else ""
    cues = []
    for x in tl:
        if "text" not in x:
            continue
        st, en = x["start"] + offset_of[x["section"]], x["end"] + offset_of[x["section"]]
        words, lines, cur = x["text"].split(), [], ""
        for w in words:
            if cur and len(cur) + 1 + len(w) > maxc:
                lines.append(cur); cur = w
            else:
                cur = (cur + " " + w).strip()
        if cur:
            lines.append(cur)
        blocks = [lines[i:i + 2] for i in range(0, len(lines), 2)]
        total = sum(len(" ".join(b)) for b in blocks) or 1
        t = st
        for b in blocks:
            d = (en - st) * len(" ".join(b)) / total
            cues.append((t, t + d, "\n".join(rlm + l for l in b))); t += d

    def ts(s):
        h, r = divmod(s, 3600); m, r = divmod(r, 60)
        return f"{int(h):02d}:{int(m):02d}:{int(r):02d},{int(round((r - int(r)) * 1000)) % 1000:03d}"
    path = os.path.join(ep, f"podcast_{lang}.srt")
    with open(path, "w", encoding="utf-8") as f:
        for i, (a, b, txt) in enumerate(cues, 1):
            f.write(f"{i}\n{ts(a)} --> {ts(b)}\n{txt}\n\n")
    return path, len(cues)


if __name__ == "__main__":
    ep, music = sys.argv[1], sys.argv[2]
    for lang in sys.argv[3:]:
        raw, ch, off, dur = build(ep, lang, music)
        print(lang, "mixed %.1fs" % dur, [c["start"] for c in ch])
