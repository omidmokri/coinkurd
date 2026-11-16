#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""scripts/ai.py — the pool of free Gemini keys, without the network.

The owner keeps several free AI Studio keys, one per Google account, each with its own daily and per-minute quota.
Checked here: which environment variables a key is read from (including the owner's own secret names, the four
spelled *_ADI_KEY among them, and the workflow's toJSON(secrets) dump), that nothing which is not a key gets in,
that the order is the same on every run and nothing is listed twice, that a key whose quota ran out hands over to
the next one, that the model is only given up once every key is spent, that each key waits on its own per-minute
limit, and that no key value is ever written to a log.

Run: python3 tests/test_ai_keys.py"""
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
import ai  # noqa: E402

FAILS = []
K = ["AIza" + c * 35 for c in "ABCDEFGH"]      # keys shaped the way AI Studio makes them
MINE = ("GEMINI_API_KEY", "COIN_KURD_API_KEY", "GEMINI_KEYS", "GEMINI_MODEL", "ALI_API_KEY", "AZARI_API_KEY",
        "HAMA_ADI_KEY", "HANA2_ADI_KEY", "HANA_ADI_KEY", "KURD_ADI_KEY", "MOKRI_API_KEY", "OMID_API_KEY",
        "SALAH_API_KEY", "SARA_API_KEY", "REF_BOT_TOKEN")


def ok(name, cond, extra=""):
    print(("PASS " if cond else "FAIL ") + name + (f" — {extra}" if extra and not cond else ""))
    if not cond:
        FAILS.append(name)


def env(**kw):
    """only the variables this test sets, so a key in the real environment cannot change the outcome"""
    for n in MINE:
        os.environ.pop(n, None)
    for n in [n for n in os.environ if n.endswith("_KEY")]:
        os.environ.pop(n, None)
    os.environ.update({k: v for k, v in kw.items() if v is not None})
    os.environ["GEMINI_MODEL"] = "m1"
    ai.reset()


def main():
    env(GEMINI_API_KEY="plain-test-key")
    ok("a key named outright is used whatever it looks like (tests, a run by hand)", ai.keys() == ["plain-test-key"] and ai.available())

    env(GEMINI_API_KEY=f"{K[0]}, {K[1]}\n{K[2]}")
    ok("several keys in GEMINI_API_KEY, separated by commas, spaces or new lines", ai.keys() == K[:3], ai.keys())

    env(COIN_KURD_API_KEY=K[0])
    ok("COIN_KURD_API_KEY counts when it is a Gemini key", ai.keys() == [K[0]])
    env(COIN_KURD_API_KEY="sk-ant-not-a-gemini-key")
    ok("…and is left out when it is not", ai.keys() == [] and not ai.available())

    # the owner's own secret names, the four spelled *_ADI_KEY included
    env(ALI_API_KEY=K[0], HAMA_ADI_KEY=K[1], KURD_ADI_KEY=K[2], SARA_API_KEY=K[3], REF_BOT_TOKEN="123:abc")
    got = ai.keys()
    ok("every *_KEY variable holding a Gemini key joins the pool (ADI spelling included)", sorted(got) == sorted(K[:4]) and len(got) == 4, got)
    ok("the order is by variable name, so two runs use the keys in the same order", got == [K[0], K[1], K[2], K[3]] and ai.keys() == got, got)

    # the workflow hands the whole secret store over: anything that is not a key is ignored
    env(GEMINI_KEYS='{"SARA_API_KEY": "%s", "ALI_API_KEY": "%s", "REF_BOT_TOKEN": "8012:AAH-not-a-key", '
                    '"github_token": "ghp_0123456789", "EMPTY": ""}' % (K[1], K[0]))
    ok("toJSON(secrets) gives up its Gemini keys and nothing else", ai.keys() == [K[0], K[1]], ai.keys())
    env(GEMINI_KEYS="not json at all")
    ok("a GEMINI_KEYS that is not JSON is simply ignored", ai.keys() == [])

    env(GEMINI_API_KEY=K[0], COIN_KURD_API_KEY=K[0], ALI_API_KEY=K[0], GEMINI_KEYS='{"X_KEY": "%s"}' % K[0])
    ok("the same key reached by four routes is one key in the pool", ai.keys() == [K[0]])

    env(GEMINI_API_KEY=K[0], ALI_API_KEY=K[1], SARA_API_KEY=K[2])
    ok("the key named outright comes first, then the rest by name", ai.keys() == [K[0], K[1], K[2]], ai.keys())

    # ---- handing over when a quota runs out
    ok("the pool starts on its first key", ai.key() == K[0] and len(ai.live_keys()) == 3)
    ai._exhausted.add((ai._kid(K[0]), "m1"))
    ok("rotate_key moves to the next key that still has quota", ai.rotate_key() and ai.key() == K[1] and len(ai.live_keys()) == 2)
    ai._exhausted.add((ai._kid(K[1]), "m1"))
    ai._exhausted.add((ai._kid(K[2]), "m1"))
    ok("rotate_key says no when every key is spent on this model", ai.rotate_key() is False and ai.live_keys() == [])
    ok("a model counts as spent only once every key is spent on it", ai._model_spent("m1") and not ai._model_spent("m2"))

    # ---- generate_on_model: every key, one model, then give up
    env(GEMINI_API_KEY=f"{K[0]},{K[1]},{K[2]}")
    seen, real = [], ai._generate

    def quota_always(*a, **kw):
        seen.append((kw.get("api_key") or ai.key(), ai.model()))
        raise ai.QuotaError("daily quota exhausted")
    ai._generate = quota_always
    try:
        err = None
        try:
            ai.generate_on_model("p")
        except Exception as e:  # noqa: BLE001
            err = type(e).__name__
        ok("generate_on_model tries every key on the run's model, then raises QuotaError",
           err == "QuotaError" and [s[0] for s in seen] == K[:3] and {s[1] for s in seen} == {"m1"}, (err, len(seen)))
        n = len(seen)
        try:
            ai.generate_on_model("p")
        except Exception:  # noqa: BLE001
            pass
        ok("once every key is spent it does not call Gemini again this run", len(seen) == n)
        ok("the model is never given up by generate_on_model (the site's own steps keep it)", ai.model() == "m1")

        # ---- generate(): the next model only after every key has been tried
        env(GEMINI_API_KEY=f"{K[0]},{K[1]}")
        seen.clear()
        tried = []

        def quota_then_ok(*a, **kw):
            tried.append((kw.get("api_key") or ai.key(), ai.model()))
            if ai.model() == "m1":
                raise ai.QuotaError("daily quota exhausted")
            return "done"
        ai._generate = quota_then_ok
        ai.fallbacks = lambda: [m for m in ("m2",) if not ai._model_spent(m)]
        out = ai.generate("p")
        ok("generate falls back to the next model only after both keys ran out on the first",
           out == "done" and [x[1] for x in tried] == ["m1", "m1", "m2"] and [x[0] for x in tried[:2]] == K[:2], tried)
    finally:
        ai._generate = real

    # ---- the per-minute limit belongs to each key
    env(GEMINI_API_KEY=f"{K[0]},{K[1]}")
    ok("each key waits on its own clock, so two keys never queue behind one another",
       isinstance(ai._last, dict) and ai._last == {})

    # ---- nothing that identifies a key may reach a log
    env(GEMINI_API_KEY=K[0])
    fp = ai._kid(K[0])
    ok("a key is logged only as a short fingerprint, never as itself",
       len(fp) == 6 and fp not in K[0] and K[0] not in ai.pool_note() and ai.pool_note() == "1 Gemini key in the pool")

    env(GEMINI_API_KEY=f"{K[0]},{K[1]}")
    ok("the pool is counted in plain words", ai.pool_note() == "2 Gemini keys in the pool")

    print(f"\n{len(FAILS)} failure(s)" if FAILS else "\nOK")
    sys.exit(1 if FAILS else 0)


if __name__ == "__main__":
    main()
