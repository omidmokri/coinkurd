#!/usr/bin/env bash
# ربات معامله‌گر انتخاب — نصب‌کنندهٔ خودمیزبان
# Entekhab trading bot — self-hosted installer.
#
# This script does NOT install a trading engine of its own: it sets up the official
# Freqtrade container (GNU GPL v3) with the Entekhab configuration, strategies and docs.
# Nothing here places a real order until YOU set "dry_run": false yourself.
set -euo pipefail
cd "$(dirname "$0")"

say() { printf '\033[1;33m%s\033[0m\n' "$*"; }
die() { printf '\033[1;31m%s\033[0m\n' "$*" >&2; exit 1; }

command -v docker >/dev/null 2>&1 || die 'docker پیدا نشد. ابتدا Docker را نصب کنید: https://docs.docker.com/engine/install/'
docker compose version >/dev/null 2>&1 || die 'docker compose (v2) پیدا نشد. افزونهٔ compose را نصب کنید.'

[ -f .env ] || { cp .env.example .env; say '.env ساخته شد — قبل از اجرا آن را ویرایش کنید.'; }
mkdir -p user_data/logs user_data/data user_data/backtest_results user_data/hyperopt_results

ZIP=user_data/strategies/community-strategies.zip
if [ -f "$ZIP" ] && [ ! -d user_data/strategies/community ]; then
    say "باز کردن بستهٔ استراتژی‌ها…"
    if command -v unzip >/dev/null 2>&1; then
        unzip -q -o "$ZIP" -d user_data/strategies/community
    else
        python3 -c "import zipfile;zipfile.ZipFile('$ZIP').extractall('user_data/strategies/community')"
    fi
    say "    $(ls user_data/strategies/community/*.py | wc -l) استراتژی باز شد (کپی دست‌نخوردهٔ GPL-3.0 — NOTICE.md را ببینید)."
fi

say '۱/۳ — دریافت ایمیج رسمی Freqtrade…'
docker compose pull

say '۲/۳ — بررسی پیکربندی…'
docker compose run --rm --no-deps --entrypoint freqtrade entekhab-bot \
    show-config --config /freqtrade/config/config.entekhab.json >/dev/null \
    && say '    پیکربندی معتبر است.'

DRY=$(python3 -c 'import json;print(json.load(open("config/config.entekhab.json"))["dry_run"])' 2>/dev/null || echo True)
if [ "$DRY" = "True" ]; then
    say '    dry_run = true → ربات در حالت آزمایشی (بدون پول واقعی) اجرا می‌شود.'
else
    say '    ⚠ dry_run = false → ربات با پول واقعی معامله می‌کند.'
fi

cat <<'TXT'

۳/۳ — گام بعدی با خودتان است:

  ۱. دادهٔ تاریخی بگیرید:
       docker compose run --rm entekhab-bot download-data --timerange 20240101- -t 5m 1h
  ۲. استراتژی را بک‌تست کنید (نتیجهٔ بک‌تست تضمین نتیجهٔ زنده نیست):
       docker compose run --rm entekhab-bot backtesting --strategy NotAnotherSMAOffsetStrategyHO
  ۳. استراتژی‌های قدیمی را به رابط نسخهٔ ۳ تبدیل کنید (۴۶۲ از ۴۶۵ استراتژی لازم دارند):
       docker compose run --rm entekhab-bot strategy-updater --strategy-list NotAnotherSMAOffsetStrategyHO
  ۴. اجرای آزمایشی:
       docker compose up -d && docker compose logs -f

راهنمای کامل: docs/01-quickstart.fa.md   ·   هشدارهای ریسک: docs/02-risk.fa.md
TXT
