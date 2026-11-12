"""Original music for the show, synthesised from scratch with numpy (no samples, no loops from
anywhere else, so there is nothing to license). Same identity in all four languages.

  theme.wav   16 bars at 100 BPM in A minor: pad, plucked arpeggio, sub bass, soft kick and hats
  sting.wav   ~1.8 s section transition: filtered-noise sweep into a plucked Am9 chord
  ending.wav  ~4 s final Am9 chord with a long tail
"""
import os
import sys

import numpy as np
import soundfile as sf
from scipy.signal import fftconvolve, butter, sosfilt

SR = 44100
BPM = 100
BEAT = 60 / BPM
BAR = 4 * BEAT
rng = np.random.default_rng(20261112)

CHORDS = [  # (bass midi, pad midis): Am9 - Fmaj7 - Cmaj7 - Gadd9
    (45, [57, 60, 64, 67, 71]),
    (41, [53, 57, 60, 64, 69]),
    (48, [55, 60, 64, 67, 71]),
    (43, [55, 59, 62, 67, 69]),
]


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def t_(n):
    return np.arange(n) / SR


def adsr(n, a, d, s, r):
    env = np.ones(n) * s
    na, nd, nr = int(a * SR), int(d * SR), int(r * SR)
    na = min(na, n); env[:na] = np.linspace(0, 1, na, endpoint=False)
    nd = min(nd, max(0, n - na)); env[na:na + nd] = np.linspace(1, s, nd, endpoint=False)
    if nr:
        nr = min(nr, n); env[-nr:] *= np.linspace(1, 0, nr)
    return env


def saw(f, n, phase=0.0, top=5500):
    """band-limited sawtooth by additive synthesis"""
    t = t_(n); x = np.zeros(n)
    k = 1
    while k * f < top:
        x += ((-1) ** (k + 1)) * np.sin(2 * np.pi * k * f * t + phase * k) / k
        k += 1
    return x * (2 / np.pi)


def lp(x, fc, order=2):
    return sosfilt(butter(order, fc / (SR / 2), "low", output="sos"), x)


def hp(x, fc, order=2):
    return sosfilt(butter(order, fc / (SR / 2), "high", output="sos"), x)


def bp(x, f1, f2):
    return sosfilt(butter(2, [f1 / (SR / 2), f2 / (SR / 2)], "band", output="sos"), x)


def pad_bar(notes, n):
    L = np.zeros(n); R = np.zeros(n)
    for m in notes:
        f = hz(m)
        L += saw(f * 2 ** (-6 / 1200), n, 0.1) + 0.6 * saw(f * 2 ** (4 / 1200), n, 1.3)
        R += saw(f * 2 ** (6 / 1200), n, 0.7) + 0.6 * saw(f * 2 ** (-4 / 1200), n, 2.1)
    env = adsr(n, 0.45, 0.6, 0.85, 0.5)
    L = lp(L, 3200) * env; R = lp(R, 3200) * env
    return L / len(notes), R / len(notes)


def pluck(f, n, tau=0.22):
    t = t_(n)
    x = (np.sin(2 * np.pi * f * t) + 0.45 * np.sin(2 * np.pi * 2 * f * t) + 0.22 * np.sin(2 * np.pi * 3 * f * t)
         + 0.12 * np.sin(2 * np.pi * 4 * f * t) * np.exp(-t / 0.05) + 0.08 * np.sin(2 * np.pi * 6 * f * t) * np.exp(-t / 0.03))
    return x * np.exp(-t / tau) * adsr(n, 0.004, 0, 1, 0.02)


def kick(n=int(0.35 * SR)):
    t = t_(n)
    f = 45 + 75 * np.exp(-t / 0.035)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t / 0.16)


def hat(n=int(0.06 * SR)):
    return hp(rng.standard_normal(n), 7000) * np.exp(-t_(n) / 0.018)


def reverb_ir(seconds=1.6, seed=7):
    r = np.random.default_rng(seed)
    n = int(seconds * SR)
    env = np.exp(-6.9 * t_(n) / seconds)
    L = lp(r.standard_normal(n) * env, 6000); R = lp(r.standard_normal(n) * env, 6000)
    L[0] = R[0] = 0
    return L / np.sqrt((L ** 2).sum()), R / np.sqrt((R ** 2).sum())


def add(dst, src, at):
    i = int(at * SR); j = min(len(dst), i + len(src))
    if j > i:
        dst[i:j] += src[: j - i]


def theme(bars=16):
    n = int(bars * BAR * SR) + int(2 * SR)
    padL, padR, arp, bass, drums = (np.zeros(n) for _ in range(5))
    pattern = [0, 2, 1, 3, 2, 4, 3, 1]
    for b in range(bars):
        root, notes = CHORDS[b % 4]
        start = b * BAR
        L, R = pad_bar(notes, int(BAR * SR) + int(0.5 * SR))
        add(padL, L, start); add(padR, R, start)
        for i, k in enumerate(pattern):  # eighth-note arpeggio one octave up
            if b < 2 and i % 2:  # sparse first two bars: the theme "builds"
                continue
            add(arp, pluck(hz(notes[k % len(notes)] + 12), int(0.5 * SR)) * (0.9 if i % 2 == 0 else 0.7), start + i * BEAT / 2)
        if b >= 1:  # sub bass enters on bar 2
            for beat in (0, 2):
                nb = int(1.6 * BEAT * SR)
                add(bass, np.sin(2 * np.pi * hz(root - 12) * t_(nb)) * adsr(nb, 0.01, 0.2, 0.7, 0.12), start + beat * BEAT)
        if b >= 2:  # drums from bar 3
            for beat in range(4):
                if beat in (0, 2):
                    add(drums, kick(), start + beat * BEAT)
                add(drums, 0.7 * hat(), start + beat * BEAT + BEAT / 2)
                add(drums, 0.35 * hat(), start + beat * BEAT + 3 * BEAT / 4)
    # dotted-eighth echo on the arpeggio, alternating sides
    d = int(0.75 * BEAT * SR)
    arpL, arpR = arp.copy(), arp.copy()
    echo = np.zeros(n); echo[d:] = arp[:-d] * 0.32
    arpL += echo; arpR[d:] += echo[:-d] * 0.6
    # side-chain-like duck of pad and bass under each kick
    duck = np.ones(n)
    for b in range(2, bars):
        for beat in (0, 2):
            i = int((b * BAR + beat * BEAT) * SR); m = int(0.22 * SR)
            duck[i:i + m] = np.minimum(duck[i:i + m], 0.55 + 0.45 * np.linspace(0, 1, m))
    L = 0.36 * padL * duck + 0.34 * arpL + 0.30 * bass * duck + 0.42 * drums
    R = 0.36 * padR * duck + 0.34 * arpR + 0.30 * bass * duck + 0.42 * drums
    irL, irR = reverb_ir()
    L = L + 0.22 * fftconvolve(hp(L, 250), irL)[:n]
    R = R + 0.22 * fftconvolve(hp(R, 250), irR)[:n]
    return master(np.stack([L, R], 1))


def sting():
    n = int(2.4 * SR)
    t = t_(n)
    noise = rng.standard_normal(n)
    sweep = np.zeros(n)
    for i, f in enumerate(np.geomspace(300, 5000, 24)):  # band-pass sweep, 0.9 s
        seg = slice(int(i * 0.9 / 24 * SR), int((i + 1) * 0.9 / 24 * SR))
        sweep[seg] = bp(noise, f * 0.8, min(f * 1.25, 20000))[seg]
    sweep *= np.clip(t / 0.9, 0, 1) ** 2 * (t < 1.0) * 0.35
    chord = np.zeros(n)
    for m in CHORDS[0][1]:
        add(chord, pluck(hz(m + 12), int(1.4 * SR), tau=0.35) / 5, 0.9)
    add(chord, 0.6 * kick(), 0.9)
    irL, irR = reverb_ir(1.2, 3)
    L = sweep + chord; R = sweep + chord
    L = L + 0.3 * fftconvolve(L, irL)[:n]; R = R + 0.3 * fftconvolve(R, irR)[:n]
    x = np.stack([L, R], 1)
    x[-int(0.4 * SR):] *= np.linspace(1, 0, int(0.4 * SR))[:, None]
    return master(x)


def ending():
    n = int(4.5 * SR)
    root, notes = CHORDS[0]
    L, R = pad_bar(notes, n)
    ch = np.zeros(n)
    for m in notes:
        add(ch, pluck(hz(m + 12), n, tau=0.9) / 5, 0)
    b = np.sin(2 * np.pi * hz(root - 12) * t_(n)) * np.exp(-t_(n) / 1.2)
    env = np.exp(-t_(n) / 1.6)
    L = (0.5 * L + 0.4 * ch + 0.35 * b) * env; R = (0.5 * R + 0.4 * ch + 0.35 * b) * env
    irL, irR = reverb_ir(2.0, 11)
    L = L + 0.3 * fftconvolve(L, irL)[:n]; R = R + 0.3 * fftconvolve(R, irR)[:n]
    x = np.stack([L, R], 1)
    x[-int(1.0 * SR):] *= np.linspace(1, 0, int(1.0 * SR))[:, None]
    return master(x)


def master(x):
    x = x - x.mean(0)
    x = np.tanh(1.2 * x / (np.abs(x).max() + 1e-9)) / np.tanh(1.2)
    return (x * 10 ** (-1.5 / 20)).astype(np.float32)


if __name__ == "__main__":
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    sf.write(os.path.join(out, "theme.wav"), theme(), SR, subtype="PCM_16")
    sf.write(os.path.join(out, "sting.wav"), sting(), SR, subtype="PCM_16")
    sf.write(os.path.join(out, "ending.wav"), ending(), SR, subtype="PCM_16")
    print("music written to", out)
