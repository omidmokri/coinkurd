#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Discord delivery: scripts/notify.py and the two places that use it.

The webhook URL is a credential -- whoever holds it can post to the channel. Checks:
  * with no webhook set nothing is sent and nothing raises, so Telegram carries on alone;
  * the URL is never printed, not even when Discord refuses the post;
  * a signal becomes an embed with the right colour, the numbers, and a link back to the post;
  * a burst of signals is capped rather than flooding the channel, and reads oldest first;
  * mentions are defanged, so a symbol that looks like @everyone cannot ping a server.
Run: python3 tests/test_notify.py
"""
import io
import json
import os
import sys
import contextlib
import unittest.mock as mock

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))

FAILS = []
SECRET = "https://discord.com/api/webhooks/123456789/SuperSecretTokenValue_do_not_leak"


def ok(what, cond, got=None):
    print(("PASS " if cond else "FAIL ") + what + ("" if cond else f"  -> {got!r}"))
    if not cond:
        FAILS.append(what)


def main():
    import notify

    os.environ.pop("DISCORD_WEBHOOK", None)
    ok("with no webhook set, nothing is sent", notify.send("hi") is False and notify.on() is False)

    sent = {}

    def fake_urlopen(req, timeout=None):
        sent["url"] = req.full_url
        sent["body"] = json.loads(req.data.decode())

        class R:
            status = 204
            def __enter__(self): return self
            def __exit__(self, *a): return False
        return R()

    os.environ["DISCORD_WEBHOOK"] = SECRET
    with mock.patch.object(notify.urllib.request, "urlopen", fake_urlopen):
        ok("with a webhook set, it posts", notify.send("hello") is True)
        ok("it posts to the configured URL", sent["url"] == SECRET)
        ok("mentions cannot ping the server", sent["body"]["allowed_mentions"] == {"parse": []})

    import urllib.error
    def boom(req, timeout=None):
        raise urllib.error.HTTPError(SECRET, 403, "Forbidden", {}, None)

    buf = io.StringIO()
    with mock.patch.object(notify.urllib.request, "urlopen", boom), contextlib.redirect_stdout(buf):
        r = notify.send("x")
    out = buf.getvalue()
    ok("a refusal is reported without raising", r is False and "403" in out)
    ok("the webhook URL is never printed", "SuperSecretToken" not in out and "discord.com/api" not in out, out)

    long_ = {"ind": "x", "sym": "BTCUSDT", "tf": "1h", "side": "long", "price": 60112.92,
             "sl": 59000, "tp": 62000, "t": "2026-11-22T02:00:03+00:00",
             "msg": "https://t.me/Entekhab_Live_Relay/3902"}
    e = notify.signal_embed(long_, "Kurdistani QMDE")
    ok("a long signal is green", e["color"] == notify.LONG)
    ok("a short signal is red", notify.signal_embed(dict(long_, side="short"))["color"] == notify.SHORT)
    ok("the embed carries the title given", e["title"] == "Kurdistani QMDE")
    ok("the embed links back to the post", e["url"] == long_["msg"])
    names = [f["name"] for f in e["fields"]]
    ok("the numbers are shown", {"Symbol", "Timeframe", "Side", "Price", "Stop", "Target"} <= set(names), names)

    ind = {"items": [{"id": "x", "title": "Kurdistani QMDE"}]}
    many = [dict(long_, id=str(i), t=f"2026-11-22T{i:02d}:00:00+00:00") for i in range(24)]
    posts = []
    import signals as S
    with mock.patch.object(notify, "send", lambda **k: posts.append(k) or True), \
         mock.patch.object(notify, "on", lambda: True), contextlib.redirect_stdout(io.StringIO()):
        S.to_discord(many, ind)
    ok("a burst is capped, not flooded", len(posts) == 10, len(posts))
    ts = [p["embeds"][0]["timestamp"] for p in posts]
    ok("they read oldest first", ts == sorted(ts))

    os.environ.pop("DISCORD_WEBHOOK", None)
    print(f"\n{len(FAILS)} failure(s)" if FAILS else "\nOK")
    sys.exit(1 if FAILS else 0)


if __name__ == "__main__":
    main()
