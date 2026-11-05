# Entekhab trading bot — English quickstart

## What this is

An Entekhab-branded **distribution** of the open-source [Freqtrade](https://www.freqtrade.io/)
trading bot: a conservative configuration, 465 community strategies, and Persian/Kurdish/English
documentation. The engine itself is unmodified upstream Freqtrade, pulled from the official
Docker image. See [`../NOTICE.md`](../NOTICE.md) for copyright, licence and the full list of
changes Entekhab made.

Entekhab is **not affiliated with, nor endorsed by, the Freqtrade project**.

## What this is not

- Not a hosted service. You run it on your own machine; your exchange keys never leave it.
- Not financial advice, and not a promise of profit.
- Not a new trading engine.

## Install

```bash
git clone https://github.com/omidmokri/coinkurd.git
cd coinkurd/entekhab-bot
./install.sh
```

Requires Docker and Docker Compose v2. `dry_run` is `true` by default — the bot paper-trades
until you deliberately change it.

## First run

```bash
# 1. historical data
docker compose run --rm entekhab-bot download-data --timerange 20240101- -t 5m 1h

# 2. migrate an old strategy to the v3 interface (462 of 465 need this)
docker compose run --rm entekhab-bot strategy-updater --strategy-list NotAnotherSMAOffsetStrategyHO

# 3. check for look-ahead bias BEFORE trusting any backtest number
docker compose run --rm entekhab-bot lookahead-analysis --strategy NotAnotherSMAOffsetStrategyHO

# 4. backtest, broken down by month
docker compose run --rm entekhab-bot backtesting --strategy NotAnotherSMAOffsetStrategyHO \
    --timerange 20250101-20251101 --breakdown month

# 5. paper-trade
docker compose up -d && docker compose logs -f
```

## Read this before going live

- **462 of 465** strategies still use the Freqtrade **v2** interface and will not run on a
  current Freqtrade without migration.
- **239 of 465** carry hyperopt parameters hard-coded into the file. They were tuned on one
  past period. A backtest over that same period tells you almost nothing about the future.
- The upstream strategy repository is **archived** and has not changed since **February 2024**.
- Some popular strategies use a very wide stop-loss (`NotAnotherSMAOffsetStrategyHO` uses
  `-0.35`, i.e. a 35% loss per trade). That is where much of their backtested edge comes from,
  and it is also how a sustained downtrend wipes an account.
- Disable withdrawals on every API key you give the bot, and keep the REST API bound to
  `127.0.0.1`.

Full risk notes (Persian): [`02-risk.fa.md`](02-risk.fa.md)

## Licence

GPL-3.0. See [`../LICENSE`](../LICENSE) and [`../NOTICE.md`](../NOTICE.md). Distributed
WITHOUT ANY WARRANTY.
