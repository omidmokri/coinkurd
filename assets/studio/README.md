# Pine Studio (entekhab.net/studio/)

Run Pine Script v5/v6 live on a Binance chart, back-test strategies, scan the market with Pine filters, and add
Smart Money Concepts and Kronos forecast layers. Everything runs in the visitor's browser.

- `studio.js`: the page (chart, editor, live data, strategy tester, Pine screener, SMC and Kronos layers)
- `worker.js`: runs scripts off the main thread with PineTS
- `smc.js`: Smart Money Concepts (swings, BOS/CHoCH, order blocks, FVG, liquidity, previous highs/lows, premium/discount)
- `pinets.min.js`: PineTS 0.13.1 by LuxAlgo (https://github.com/LuxAlgo/PineTS), unmodified browser build

Licence: the files in this folder are free software under the GNU Affero General Public License v3
(see `PINETS-LICENSE.txt`), because they include and run PineTS. The rest of the entekhab.net site is not part of this
work. Kronos forecasts come from `scripts/kronos_forecast.py` using Kronos (https://github.com/shiyu-coder/Kronos, MIT).
Pine Script is a trademark of TradingView; this project is not affiliated with TradingView.
