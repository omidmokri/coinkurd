#!/usr/bin/env python3
"""Kronos forecasts for Pine Studio (/studio/): the next 24 one-hour candles for the main coins.

Kronos (github.com/shiyu-coder/Kronos, MIT licence, AAAI 2026) is a foundation model pre-trained on K-line sequences.
This script reads the last 400 hourly candles from Binance spot, draws SAMPLES forecasts in one batch, and writes their
average path plus a 15–85 percentile band of the close to data/kronos/<SYMBOL>_1h.json, which the studio draws as
ghost candles. Run hourly by .github/workflows/kronos.yml.

Needs the Kronos source on disk (KRONOS_DIR, default ./Kronos) and torch, pandas, einops, huggingface_hub, safetensors.
--dry uses an untrained model of the same shape (for testing the pipeline without downloading weights)."""
import argparse
import json
import os
import sys
import time
import urllib.request

import numpy as np
import pandas as pd

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "kronos")
COINS = ["BTC", "ETH", "SOL", "BNB", "XRP", "DOGE", "ADA", "TON", "AVAX", "LINK"]
LOOKBACK, PRED, SAMPLES = 400, 24, 8
MODEL, TOKENIZER = "NeoQuasar/Kronos-small", "NeoQuasar/Kronos-Tokenizer-base"


def klines(sym, n):
    u = f"https://data-api.binance.vision/api/v3/klines?symbol={sym}&interval=1h&limit={n}"
    with urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "entekhab.net kronos"}), timeout=30) as r:
        rows = json.load(r)
    df = pd.DataFrame(rows, columns=["t", "open", "high", "low", "close", "volume", "ct", "amount", "n", "tb", "tq", "x"])
    for c in ["open", "high", "low", "close", "volume", "amount"]:
        df[c] = df[c].astype(float)
    df["timestamps"] = pd.to_datetime(df["t"], unit="ms")
    return df


def synthetic():
    n = LOOKBACK
    t = pd.date_range("2026-01-01", periods=n, freq="h")
    c = 100 * np.exp(np.cumsum(np.random.default_rng(1).normal(0, .01, n)))
    df = pd.DataFrame({"open": c, "high": c * 1.004, "low": c * .996, "close": c, "volume": 1000.0, "amount": c * 1000})
    df["timestamps"] = t
    return df


def load(dry):
    sys.path.insert(0, os.environ.get("KRONOS_DIR", os.path.join(ROOT, "Kronos")))
    from model import Kronos, KronosPredictor, KronosTokenizer
    if dry:
        tok = KronosTokenizer(d_in=6, d_model=64, n_heads=2, ff_dim=128, n_enc_layers=1, n_dec_layers=1, ffn_dropout_p=0, attn_dropout_p=0,
                              resid_dropout_p=0, s1_bits=4, s2_bits=4, beta=.05, gamma0=1, gamma=1.1, zeta=.05, group_size=4)
        mod = Kronos(s1_bits=4, s2_bits=4, n_layers=1, d_model=64, n_heads=2, ff_dim=128, ffn_dropout_p=0, attn_dropout_p=0,
                     resid_dropout_p=0, token_dropout_p=0, learn_te=True)
    else:
        tok, mod = KronosTokenizer.from_pretrained(TOKENIZER), Kronos.from_pretrained(MODEL)
    return KronosPredictor(mod, tok, device="cpu", max_context=512)


def forecast(pred, df):
    df = df.tail(LOOKBACK).reset_index(drop=True)
    x_ts = df["timestamps"]
    last = x_ts.iloc[-1]
    y_ts = pd.Series(pd.date_range(last + pd.Timedelta(hours=1), periods=PRED, freq="h"))
    cols = ["open", "high", "low", "close", "volume", "amount"]
    outs = pred.predict_batch([df[cols]] * SAMPLES, [x_ts] * SAMPLES, [y_ts] * SAMPLES, pred_len=PRED, T=1.0, top_p=0.9, sample_count=1, verbose=False)
    A = np.stack([o[["open", "high", "low", "close"]].values for o in outs])          # samples × steps × 4
    mean = A.mean(axis=0)
    lo, hi = np.percentile(A[:, :, 3], 15, axis=0), np.percentile(A[:, :, 3], 85, axis=0)
    rows = []
    for i in range(PRED):
        o, h, l, c = (float(v) for v in mean[i])
        h, l = max(h, o, c), min(l, o, c)                                               # an average of candles is still a valid candle
        rows.append({"t": int(y_ts.iloc[i].value // 10**6), "o": o, "h": h, "l": l, "c": c, "hi": float(hi[i]), "lo": float(lo[i])})
    return rows, float(df["close"].iloc[-1])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry", action="store_true")
    ap.add_argument("--coins", default=",".join(COINS))
    a = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)
    pred = load(a.dry)
    ok = 0
    for c in a.coins.split(","):
        sym = c.strip().upper() + "USDT"
        try:
            t0 = time.time()
            rows, last = forecast(pred, synthetic() if a.dry else klines(sym, LOOKBACK))
            doc = {"symbol": sym, "tf": "1h", "at": int(time.time() * 1000), "model": "Kronos-small" + (" (dry)" if a.dry else ""),
                   "samples": SAMPLES, "lookback": LOOKBACK, "last": last, "forecast": rows,
                   "source": "https://github.com/shiyu-coder/Kronos"}
            if a.dry:
                print(sym, "dry ok", len(rows), "steps", round(time.time() - t0, 1), "s")
                continue
            json.dump(doc, open(os.path.join(OUT, f"{sym}_1h.json"), "w"), separators=(",", ":"))
            ok += 1
            print(sym, "ok", round(time.time() - t0, 1), "s, close +24h", round(rows[-1]["c"], 4), "vs", last)
        except Exception as e:                                                            # one coin failing must not stop the others
            print(sym, "failed:", e)
    if not a.dry and ok == 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
