"""Sending an alert out to where people already are.

Telegram has always carried these. The Coin_Kurd Discord server carries the community and the nightly class, so an
alert that matters belongs there too. One webhook, set once, and nothing else to run.

    DISCORD_WEBHOOK   the channel webhook, from Discord: channel → Edit Channel → Integrations → Webhooks

That URL is a credential: anyone holding it can post to the channel as the webhook. It is read from the
environment, never written to a file, and never printed -- failures report the HTTP status and nothing more, so a
build log can be shared without leaking it. Unset means Discord is simply skipped and Telegram carries on.
"""
import json
import os
import urllib.error
import urllib.request

LONG, SHORT, GREY = 0x2ECC71, 0xE74C3C, 0x95A5A6
LEVEL = {"ok": 0x2ECC71, "warn": 0xF1C40F, "error": 0xE74C3C}


def on():
    return bool((os.environ.get("DISCORD_WEBHOOK") or "").strip())


def send(content="", embeds=None):
    """Post to the Discord channel. True when it went out, False when it did not; never raises, never logs the URL."""
    url = (os.environ.get("DISCORD_WEBHOOK") or "").strip()
    if not url:
        return False
    body = {"username": "Entekhab", "allowed_mentions": {"parse": []}}
    if content:
        body["content"] = content[:1900]
    if embeds:
        body["embeds"] = embeds[:10]
    if not content and not embeds:
        return False
    req = urllib.request.Request(url, data=json.dumps(body).encode("utf-8"),
                                 headers={"Content-Type": "application/json", "User-Agent": "entekhab.net"})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return 200 <= r.status < 300
    except urllib.error.HTTPError as e:
        print(f"discord: refused with HTTP {e.code}")          # the URL itself is deliberately not printed
    except Exception as e:                                      # noqa: BLE001
        print(f"discord: {type(e).__name__}")
    return False


def _field(name, value, inline=True):
    return {"name": name, "value": str(value), "inline": inline}


def signal_embed(s, title=None):
    """One trading signal, as Discord shows it: colour by side, the numbers as fields, a link back to the post."""
    side = (s.get("side") or "").lower()
    fields = [_field("Symbol", s.get("sym") or s.get("tv_sym") or "—"),
              _field("Timeframe", s.get("tf") or "—"),
              _field("Side", side.upper() or "—")]
    if s.get("price") is not None:
        fields.append(_field("Price", f"{s['price']:,}"))
    for k, lab in (("sl", "Stop"), ("tp", "Target"), ("tp2", "Target 2")):
        if s.get(k) is not None:
            fields.append(_field(lab, f"{s[k]:,}"))
    if s.get("order"):
        fields.append(_field("Order", s["order"]))
    e = {"title": title or s.get("ind") or "signal",
         "color": LONG if side == "long" else SHORT if side == "short" else GREY,
         "fields": fields,
         "footer": {"text": "entekhab.net · not financial advice"}}
    if s.get("t"):
        e["timestamp"] = s["t"]
    if str(s.get("msg", "")).startswith("http"):
        e["url"] = s["msg"]
    return e


def health_embed(status, rows):
    return {"title": f"entekhab.net — {status}",
            "color": LEVEL.get(status, GREY),
            "description": "\n".join(f"• {r}" for r in rows)[:3900] or "—",
            "footer": {"text": "entekhab.net status"}}
