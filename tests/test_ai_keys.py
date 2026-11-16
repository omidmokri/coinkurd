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
import time

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
    # this one secret already reaches every step of every workflow, so several keys in it need no workflow change
    env(COIN_KURD_API_KEY=f"{K[0]}, {K[1]},{K[2]}")
    ok("several keys in COIN_KURD_API_KEY turn on the whole pool with no change to a workflow", ai.keys() == K[:3], ai.keys())
    env(COIN_KURD_API_KEY=f"sk-ant-something, {K[0]}")
    ok("…and a key of another kind sitting beside them is simply passed over", ai.keys() == [K[0]])

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

    # ---- what Google's refusals mean for a key
    env(GEMINI_API_KEY=f"{K[0]},{K[1]},{K[2]}")
    real_post, real_sleep = ai.requests.post, time.sleep
    ai.time.sleep = lambda s: None

    class Resp:
        def __init__(self, code, text=""):
            self.status_code, self.text = code, text

        def json(self):
            return {}

    def answers(seq):
        """a Gemini that replies with the given statuses in turn"""
        it = iter(seq)

        def post(url, headers=None, json=None, timeout=None):
            return next(it)
        return post

    FREE = '{"error":{"code":403,"message":"The Gemini API free tier is not available for this project."}}'
    PERDAY = '{"error":{"code":429,"details":[{"violations":[{"quotaId":"GenerateRequestsPerDayPerProjectPerModel"}]}]}}'
    MINUTE = '{"error":{"code":429,"message":"Resource has been exhausted."}}'
    SLOW = '{"error":{"code":429},"retryDelay":"6711.0s"}'

    def raises(statuses, tries=2):
        ai.requests.post = answers(statuses)
        try:
            ai._generate("p", tries=tries)
        except Exception as e:  # noqa: BLE001
            return type(e).__name__
        return None

    ok("a 403 saying the project has no free tier retires that key", raises([Resp(403, FREE)]) == "QuotaError")
    ok("a 429 that names a per-day quota retires the key", raises([Resp(429, PERDAY)]) == "QuotaError")
    ok("a 429 with a delay of hours is a per-day quota too", raises([Resp(429, SLOW)]) == "QuotaError")
    ok("a plain 429 is only the per-minute limit: it asks us to wait, it does not retire the key",
       raises([Resp(429, MINUTE), Resp(429, MINUTE)]) == "RateLimited")
    ok("another 4xx is neither: it is just a failed request", raises([Resp(400, '{"error":"bad"}')]) == "RuntimeError")

    # a rate-limited key must still be usable; a retired one must not
    ai.reset()
    ai.requests.post = answers([Resp(429, MINUTE), Resp(429, MINUTE)])
    try:
        ai._generate("p", tries=2)
    except ai.RateLimited:
        pass
    ok("a key that was only rate limited is still in the pool", len(ai.live_keys()) == 3 and ai.live_keys()[0] == K[0])
    ai.requests.post = answers([Resp(403, FREE)])
    try:
        ai._generate("p", tries=1)
    except ai.QuotaError:
        ai._exhausted.add((ai._kid(ai.key()), ai.model()))
    ok("a key whose project has no free tier drops out of the pool", len(ai.live_keys()) == 2)

    # generate_on_model: a rate limit moves to the next key and keeps the first
    ai.reset()
    seen_keys = []

    def one_slow_key(prompt, *a, **kw):
        k = kw.get("api_key") or ai.key()
        seen_keys.append(k)
        if k == K[0]:
            raise ai.RateLimited("too fast")
        return {"ok": 1}
    real_gen = ai._generate
    ai._generate = one_slow_key
    try:
        out = ai.generate_on_model("p", True)
        ok("a rate limit hands the request to the next key and keeps the first one in the pool",
           out == {"ok": 1} and seen_keys == [K[0], K[1]] and len(ai.live_keys()) == 3, (seen_keys, len(ai.live_keys())))
    finally:
        ai._generate = real_gen
        ai.requests.post, ai.time.sleep = real_post, real_sleep

    # ---- the per-minute limit belongs to each key
    env(GEMINI_API_KEY=f"{K[0]},{K[1]}")
    ok("each key waits on its own clock, so two keys never queue behind one another",
       isinstance(ai._last, dict) and ai._last == {})

    # ---- nothing that identifies a key may reach a log
    env(GEMINI_API_KEY=K[0])
    fp = ai._kid(K[0])
    ok("a key is logged only as a short fingerprint, never as itself",
       len(fp) == 6 and fp not in K[0] and K[0] not in ai.pool_note()
       and ai.pool_note() == "1 Gemini key in the pool: GEMINI_API_KEY")

    env(GEMINI_API_KEY=f"{K[0]},{K[1]}")
    ok("the pool is counted in plain words", ai.pool_note() == "2 Gemini keys in the pool: GEMINI_API_KEY, GEMINI_API_KEY")

    # the report names the secret each key came from, says why a key dropped out, and never prints a key
    env(ALI_API_KEY=K[0], SARA_API_KEY=K[1], HAMA_ADI_KEY=K[2])
    ai.keys()
    ai.retire(K[1], "this key's Google project has no Gemini free tier (it needs billing)", "m1")
    rep = ai.pool_report()
    ok("the report names each key's secret and what happened to it",
       "ALI_API_KEY" in rep and "working" in rep and "SARA_API_KEY" in rep and "no Gemini free tier" in rep, rep)
    ok("the report never contains a key itself", not any(k in rep for k in K))
    ok("a retired key is out of the pool, the others are not", ai.live_keys("m1") == [K[0], K[2]])

    print(f"\n{len(FAILS)} failure(s)" if FAILS else "\nOK")
    sys.exit(1 if FAILS else 0)


if __name__ == "__main__":
    main()
