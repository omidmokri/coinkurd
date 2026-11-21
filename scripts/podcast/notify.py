#!/usr/bin/env python3
"""Tell the owner, on Telegram, when today's episode did not reach the channel.

Nothing watched this before: the podcast failed every evening from 14 to 21 November 2026 and the only trace was a
red tick in the Actions tab. One short message per failed run, to the same alert chat scripts/health.py uses
(TG_BOT_TOKEN + TG_ALERT_CHAT). It says which languages were held and why, so the cause is in hand straight away.
Never sent when the episode goes out.
"""
import json
import os
import sys

import requests

tok, chat = os.environ.get("TG_BOT_TOKEN"), os.environ.get("TG_ALERT_CHAT")
if not (tok and chat):
    print("no alert channel configured (TG_BOT_TOKEN / TG_ALERT_CHAT)")
    sys.exit(0)

ep, run = sys.argv[1], os.environ.get("RUN_URL", "")
lines = ["⚠️ پادکست «نبض کریپتو» امروز منتشر نشد."]
try:
    qc = json.load(open(os.path.join(ep, "qc.json"), encoding="utf-8"))
    live = qc.get("publishable") or []
    lines.append(f"زبان‌های آماده: {'، '.join(live) if live else 'هیچ'}")
    for lang, why in (qc.get("held") or {}).items():
        lines.append(f"• {lang}: {str(why)[:200]}")
except Exception as ex:  # noqa: BLE001
    lines.append(f"قسمت امروز ساخته نشد ({ex.__class__.__name__}).")
if run:
    lines.append(run)
try:
    requests.post(f"https://api.telegram.org/bot{tok}/sendMessage",
                  json={"chat_id": chat, "text": "\n".join(lines), "disable_web_page_preview": True},
                  timeout=20).raise_for_status()
    print("owner told")
except Exception as e:  # noqa: BLE001
    print(f"alert failed: {e}")
