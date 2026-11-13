# AUTOPILOT — the site's autonomous improvement loop

> **برای مالک سایت:** این فایل دفتر کار خودکار سایت است. هر یک ساعت یک بار، یک جلسهٔ تازهٔ Claude این فایل را می‌خواند،
> یکی از نیازهای واقعی تریدرها را انتخاب می‌کند، آن را می‌سازد، آزمایش می‌کند و منتشر می‌کند، و همین‌جا (بخش «Log») ثبت می‌کند
> چه کرد، چرا و چطور بررسی شد. هر تغییر در تاریخچهٔ git هم با پیشوند `autopilot:` دیده می‌شود.

Every hour a fresh Claude session with no memory of earlier runs opens this file. It is the only memory the loop has:
the mission, the rules, how to work, the backlog and the log. **Read all of it before doing anything.**

## Mission

entekhab.net (repo `omidmokri/coinkurd`, GitHub Pages) is the site of the Persian/Kurdish crypto channel Coin_Kurd
(founder: Omid Dabbaghchi Mokri; Telegram @Kurdistan_coin; nightly class 20:00 Tehran on the Coin Kurd Discord).
The owner gave the loop full authority to improve the site without asking: each run finds **one** real, unmet need of
traders (Iranian and Kurdish traders first), builds the best possible answer to it, verifies it and publishes it.

The site's strategy (agreed with the owner, 2026-11-07):
1. **Measured honesty is the product.** The site publishes numbers that can make it look bad (signal ledger, scanner
   accuracy, the channel's own record). Make that the spine: accountability where decisions are made, not on a side page.
1. **One spine instead of thirty islands.** Breadth without a starting point loses newcomers; build toward a daily page
   that ties the tools together.
2. **The human is the moat.** Seven years of daily posts, two books, university workshops, a nightly class — make them visible.

## How to work (every run)

1. **Setup.** `cd /home/claude/coinkurd` (clone `https://github.com/omidmokri/coinkurd` there if missing), then
   `git fetch origin && git checkout -B autopilot origin/main`.
2. **Choose.** Take the top unfinished item of the Backlog — unless you find a clearly more valuable trader need; then add
   it to the Backlog with the reasoning and do it. `grep` first: never rebuild something that exists; improving an
   existing feature beats adding a new one.
3. **Build** inside the existing patterns (see Architecture). Trilingual (fa / ckb / en), RTL-correct, mobile-first,
   matching the design system (dark, `var(--card)`, `var(--line)`, orange `var(--acc)`, 16–18px radii, pill buttons).
3. **Test before you publish.**
   - `python3 -m py_compile` every changed script; run every builder you touched.
   - Numbers: unit-test any computation on synthetic data where the right answer is known (see `trackrecord.py` tests
     in the Log entry of 2026-11-07 for the standard: null case, planted effect, edge cases, a hand-checked value).
   - UI: serve the repo copy (`python3 -m http.server`), screenshot with Playwright + `/usr/bin/google-chrome` at
     1280px and 390px, in fa and en; **look at the screenshots**; zero JS errors.
4. **Publish.** One commit per run, message starting `autopilot:` and ending with the attribution lines the session asks
   for. `git pull --rebase origin main && git push origin HEAD:main` (re-rebase and retry up to 3 times if rejected).
   The same commit adds your entry at the top of **Log**.
5. **Check the deploy.** `gh run list -R omidmokri/coinkurd -L 6` — the "Sync Telegram → Site" run after your commit must
   succeed. If your change broke it, fix it in this run or `git revert` your commit (never force-push).
6. **Size.** Finish within ~40 minutes. If the item is bigger, ship the first useful slice and leave the rest in Backlog.

### Environment facts (learned the hard way)
- From the sandbox only GitHub and package registries are reachable. **Binance, Telegram and entekhab.net are not.**
  Anything that needs live market data runs in CI (`.github/workflows/update.yml`); verify it by reading the committed
  `data/*.json` after the next sync run (`git fetch && git show origin/main:data/<file>.json`).
- `git push` to main works through the proxy. GitHub API writes (`gh api -X POST/PUT/DELETE`) are blocked (403), and so
  are ref deletions. `gh run list/view` and `gh workflow run` work.
- The sync workflow chains itself (~every 10–15 min) and commits `data/` each time: always rebase before pushing, and
  never hand-edit `data/*.json` in the repo (use a scratch copy such as `/tmp/bld` for render tests with fake data).

## Guardrails (non-negotiable)
- **⚠️ THE EXTENSION LOGO RULE — the owner's, stated more than once ("بارهای بار تأکید کن که غفلت نشه"): the browser
  extension's logo is NEVER covered.** No badge text, no badge colour, no repainted toolbar icon, nothing positioned
  over the logo in the popup — not shorter, not smaller, not as an option. The price lives in the icon's tooltip.
  `scripts/build_extension.py` (`logo_guard`) stops the site build if this breaks; `tests/test_extension_logo.py`
  (CI: `extension-guard.yml`) renders the popup in every language and fails if anything overlaps the logo. Run that
  test before any change to `chrome-extension/`.
- **No invented numbers.** Every figure shown as data is computed by code from a real source. Missing data shows
  "no data yet", never a placeholder value. Claims of an edge need a proper baseline and a stated significance test.
- **Not financial advice.** No buy/sell recommendations; keep the not-financial-advice line on finance pages.
- **No third-party adverts, logos or images** (`scripts/adpics.py` lists flagged ones).
- **No messages.** Never send Telegram messages to users, the channel or the group, and never change how the bot posts or
  broadcasts. Bot changes are limited to read-only sections and menu entries that mirror site pages.
  **One exception, set by the owner on 2026-11-12: the daily podcast album.** `.github/workflows/podcast.yml` posts
  one album (four audios) in @Coin_Kurd every day at 19:00 Tehran. Keep it running; don't change its schedule, its
  captions or its gates without the owner, and never post from anywhere else.
- **Nothing destructive.** Don't delete pages, data or history; no force-push or history rewriting; don't touch secrets,
  the `refbot-state` branch or existing page URLs; don't change the visual identity.
- **If it fails, don't ship it.** If tests or builds fail and you cannot fix them within the run, push only a Log entry
  saying what failed and what you learned.
- **`/kids/` is somebody else's open work.** The text in `content/b4j/**` is the My First Bitcoin curriculum
  (CC BY-SA 4.0) and our translations of it. Keep the attribution, the licence link and `/kids/about/`; never present
  it as official or as ours; never edit a translated file without keeping the exact block structure of the English
  file (`python3 -I scripts/b4j_check.py fa|ckb` and `python3 scripts/kids_check.py` must stay at 0 errors/problems);
  never add images or text from elsewhere into those pages; never bring back the old games/films/songs academy
  (the owner replaced it on purpose on 2026-11-07).
- **Indicator code never enters this repo (owner, 2026-11-10, absolute).** This repository is public. The closed
  (invite-only) indicators' source exists only on TradingView (protected) and in the owner's PRIVATE engine repository.
  Never add Pine Script (`*.pine`, `//@version=`), ports of closed indicators, or `engine/indicators/` here — only their
  OUTPUTS travel to the site (`#ESTATE`/`#ESIG` relay lines → `data/live.json`; `data/engine.json` from the private
  engine, whitelisted by `clean_engine()` in `scripts/signals.py`). `scripts/leak_guard.py` runs before every commit of
  data and every deploy and stops them on a leak; never weaken or bypass it.
- Owner's standing rules: verify before publishing; whatever changes on the site is mirrored in the Telegram bot and the
  app (the app is a WebView of the site, so pages appear there automatically; add a bot section/menu entry when a new
  user-facing feature has one natural home in the bot).

## Architecture (where things live)
- Page shell: `scripts/build_pages.py` → `BP.page(path, title, desc, body, extra_head)`; most pages are built there.
- Reality-style pages (trilingual, server-side): helpers in `scripts/build_reality.py` — `BR.tri`, `BR.finish`, `BR.sec`,
  `BR.table`, `BR.nf`, `BR.fdate`, `BR.crumbs`, `BR.updated`, `BR.RCSS`, `BR.add_to_sitemap`. Examples:
  `scripts/build_trackrecord.py`, `scripts/build_opportunity.py`.
- Menu (header + footer of every page): `scripts/chrome.py`, groups of `(path, icon, title L(), description L())`.
  **The footer is short on purpose (owner's brief, 2026-11-13):** four layers — seven quick links (`FOOT_QUICK`), four
  columns of five (`FOOT_COLS`), brand + social icons + app badges, the legal line. It is not the map of the site any
  more (the header menu is; «همهٔ بخش‌ها» in the legal line opens it). A new page goes in `NAV`, not in the footer.
- Site assistant knowledge: `scripts/assistant_kb.py` `FEATURES` (path, bot keys, extension tab) → `build_assistant.py`.
- `/market/` (live market workspace): static `market/index.html` + `assets/pro/*.js|css` + `assets/vendor/lwc5.js`;
  strings in `assets/pro/i18n.js` (fa, ckb, ar, en; `tests/test_pro_i18n.py` checks them); calendar data
  `data/ecocal.json` from `scripts/ecocal.py` + `ecocal_tr.py`; bot side `scripts/bot_pro.py`. Tests: `tests/test_pro_ind.py`,
  `test_pro_i18n.py`, `test_ecocal.py`, `test_bot_pro.py`, `pro_e2e.js` (`ONLY=phones|ar` runs one block).
- Market map — `/heatmap/` `/bubbles/` `/money-flow/` `/liquidity/` `/etf/` (one app, five addresses): static pages
  from `scripts/build_mm.py` (then `chrome.py`), engine `assets/mm/{i18n,core,heat,bubbles,space3d,panel,flow,liq,etf}.js`
  + `mm.css`, three.js only when 3D is asked for. Data: `scripts/mm_data.py` → `data/mm.json` (top 250, 9 timeframes,
  sectors), `data/mm_flow.json` (Binance taker flow per window, depth bands, stablecoins), `data/logos/atlas-<hash>.webp`
  + `atlas.json` (the name changes with the content: the service worker keeps pictures by path); `scripts/etf.py` →
  `data/etf.json` (Farside ETF flows, CoinGecko treasuries). Strings `assets/mm/i18n.js` (fa, ckb, ar, en). Bot side
  `scripts/bot_mm.py` (section `mmap`). Tests: `tests/test_mm_data.py`, `test_etf.py`, `test_mm_i18n.py`, `test_bot_mm.py`,
  `mm_e2e.py` (`python3 tests/mm_fixture.py /tmp/mmfx` first; `ONLY=heatmap|bubbles|flow|liq|etf|arlayer|langs`).
- Telegram bot: labels in `scripts/bot_menu.py` `S` (fa, ckb, kmr, ar, en) and `GROUPS`; reality sections in
  `scripts/bot_reality.py` `SECTIONS`; other sections in `scripts/refbot.py` `SECTIONS` via `scripts/bot_data.py`.
  The bot restarts from main about hourly, so menu changes go live on their own.
- Workflows: `update.yml` (data + full rebuild + deploy; add data steps with `continue-on-error: true` and page builders
  near the end), `pages.yml` (light rebuild, dispatched by the bot).
- Data: `data/posts.json` (archive), `impact.json` (post outcomes), `trackrecord.json` (tested channel record),
  `ledger.json`, `scanstats.json`, `scanlog.json`, `market.json`, `score.json`, `brain.json`, `friction.json`, …
- Learning: the academy's content is `scripts/academy_content/f<n>.py` (65 lessons, 195 cited sources in f1–f4 and f13);
  `/learn/` and `/glossary/` come from `scripts/learn_data.py` inside `build_pages.build_learn()`. **`/map/` is the view
  over all of it** — `scripts/build_map.py` + `scripts/map_data.py` (Kurdish titles and the map's own strings) +
  `assets/map.{css,js}`, and it writes `data/map.json` for the bot. The map holds no teaching content of its own: it
  collects what already exists and checks every internal link against the built tree, so adding an academy faculty
  grows the map by itself. Put new Kurdish lesson titles in `map_data.LES_CKB`.

- **The Observatory — `/charts/` and one address per chart** (owner, 2026-11-13: "everything Glassnode, CoinGlass and
  CryptoQuant offer", built in stages — see the Log and the Backlog): static pages from `scripts/build_obs.py` (it puts
  the header/footer/CSP in itself; its folders join `chrome.STATIC` by `build_obs.folders()`, the sitemap by the same
  list, and the assistant by `build_obs.catalog()`), app `assets/obs/{i18n,core,src,liqmodel,liq,ts,deriv}.js` +
  `obs.css` (bump `V` in build_obs.py and `OB.V` in core.js with every change). `core.js` holds the shell, the tabs
  (`OB.PAGES` = the builder's `PAGES`, the i18n test checks it) and the toolbar pieces every view uses (`OB.ui`: coin
  picker, segments, actions). `src.js` reads public data in the visitor's browser — Binance futures, Bybit, OKX,
  Bitget, Hyperliquid (POST), Gate (every host is in the CSP's connect-src) — and brings everything to one unit:
  price per coin, size in coins (1000PEPE → PEPE × 1000, kPEPE likewise), funding per 8 hours from each contract's
  OWN interval (never assumed: Bitget's comes from a second list, and without it the rate stays empty).
  `liqmodel.js` is the liquidation-level model: pure, documented at its top, never changed without
  `node tests/test_obs_liq.js`. `ts.js` is `OB.TS`, the time-series chart of the other pages: stacked panes on one
  time axis (two measures never share a pane), line/area/step/bars/candle, legend switches, crosshair, zoom, PNG.
  `deriv.js` = open interest, funding rates, long/short. The hub's `HUB["todo"]` in build_obs.py is the honest
  "not built yet" list: move an item into `HUB["secs"]` only when its page exists. Bot: `scripts/bot_obs.py` (section
  `obs`, one Web App button per chart). Tests: `node tests/test_obs_liq.js`, `python3 tests/test_obs_i18n.py`,
  `python3 tests/obs_e2e.py` (`ONLY=data|heat|map|oi|funding|ls|hub|langs|errors`; the exchanges are mocked in their
  real formats and units, so totals, shares and 8-hour rates are known in advance), `python3 tests/test_bot_obs.py`.
- **"Deep" — the depth layer of every page except the homepage** (owner, 2026-11-13; it is part of the visual identity
  now, like the homepage stage): `assets/deep.css` (a fixed sky behind the page: stars, the warm light above and the
  cold one to the side, a floor that runs to a lit horizon; glass surfaces; the candle before section titles; the lit
  footer edge; the 404 orbit) and `assets/deep.js` (blocks arrive on scroll, light under the pointer, reading-progress
  line, rail of sections on wide screens, Ctrl/⌘+K search with live results). The switch is in `scripts/chrome.py`
  (`DEEP_VER`, `DEEP_OFF` = `battle|market|kids`, class `ek-deep` on `<html>`, interface v3 only). Colours are the
  brand's own; nothing moves under `prefers-reduced-motion` or `.nx-lite`. A new card class gets the glass by adding
  it to the two `:is(...)` lists in deep.css (and to `LIT` in deep.js for the pointer light). Bump `DEEP_VER` with
  every change. Test: `python3 tests/deep_e2e.py <built tree>` (needs a built copy; see its docstring).
- `scripts/seo_struct.py` — last build step after `seo_tidy.py` (both workflows): adds a BreadcrumbList, the default
  preview picture, a canonical and a WebPage block to every indexable page that lacks one, on the built tree only.
  Test: `python3 tests/test_seo_struct.py`.

- `/battle/` — «نبرد من», the live market as a 3D battle (three.js r128). The model kits are `battle/gfx3.js` to
  `gfx6.js` (units, environment, navy, carriers and robots). The engine is `battle/battle.js` (WORLD, ARMY, FX, CINE,
  THREATS, DIRECTOR, HUD) and ground navigation is `battle/nav.js`. Raise the `?v=` tags in `battle/index.html` with
  every change. Before shipping, run `tests/battle_ground.py`, `tests/battle_geometry.py` and `tests/battle_navy.py`
  (harness: `tests/battle_harness.py`).

- `/kids/` — **Bitcoin for Juniors** (6 modules, 21 activities, ages 8-12; fa · ckb · en). Lesson text lives ONLY in
  `content/b4j/{en,fa,ckb}/**.md` (see `content/b4j/README.md`, provenance in `content/b4j/SOURCE.json`);
  `scripts/b4j_md.py` parses it and proves each translation has the English block skeleton; `scripts/build_kids.py`
  renders the pages (output is git-ignored and rebuilt by `update.yml` / `pages.yml`); `scripts/kids_check.py` checks
  the built pages; `scripts/b4j_check.py` checks the translations; `scripts/b4j_import.py` re-imports the English from a
  clone of `MyFirstBitcoin/mfb-curriculum` (run with `python3 -I`; asserted repairs; writes SOURCE.json). UI strings and the
  About page are in `build_kids.py` (`UI`, `page_about`). Bot screen: `bot_learn.kids_screen` (links only). Nav entry:
  `chrome.py` (`/kids/`). Old addresses `/kids/start|money|chain|safe|chart|studio/` are small redirect pages.

## Backlog (top = next)
- **The Observatory, next stages** (owner's request 2026-11-13, see the Log entry of that day; one page per run is fine):
  each is a page under `/charts/` built with `scripts/build_obs.py` + `assets/obs/`, moved from `HUB["todo"]` to
  `HUB["secs"]` when it exists. Done 2026-11-13: (1) open interest across exchanges, (2) funding rates, (3) long/short
  ratios — see the Log. Left: (4) options from Deribit (open interest by strike and expiry, max pain, put/call, DVOL;
  www.deribit.com is already in the CSP); (5) on-chain
  from CoinMetrics community (CC BY-NC, name the source): MVRV, realized price, NUPL, MVRV-Z, exchange reserve and
  net flow, active addresses, hash rate, issuance and Puell — a CI step that commits one daily file; (6) cycle
  indicators from price (Mayer, 200-week MA, Pi cycle, 2-year MA). Not possible without a paid source and to be
  said so on the hub rather than faked: SOPR, CDD, HODL waves, long/short-term holder metrics.
- **Why four regimes? BIC model selection on /regime/** (owner's repo list 2026-11-10, idea from DaruFinance/strategy-regime):
  fit K = 2..6 in regime.py (same features, same seeds), publish log-likelihood, parameter count and BIC per K, and
  say on the page whether K = 4 is the BIC choice. Check the CI run time first: today's fit is 4 seeds × 120 iterations.
- **Combined alerts in /me/ and the bot** (owner's comparison file, 2026-11-10): one alert that fires on price AND
  regime AND a scanner finding on a watched coin (e.g. "SOL scanner bullish while the confirmed regime is not bear").
1. **Owner's site review (2026-11-09, received as a document mid-run) — work top-down:**
   - **Broken images — done 2026-11-09** (slice 1: site-wide hide-on-error; slice 2 dropped: no page renders the
     Persian-feed images — `news.js` `noPic` shows Persian news text-only by the owner's choice, and a full build has no
     Iranian-CDN `<img>` anywhere — so caching them in CI would buy nothing). Re-open only if a page starts showing them.
   - **Regime radar stability:** the HMM flips regimes too fast. Add an explainable rule layer (Mayer Multiple, MA200
     slope, weekly RSI, funding z-score) + multi-day hysteresis. Needs the trackrecord.py-style synthetic tests.
   - **Scanner plain-language "why this coin?"** per finding + a "send to roundtable" button.
   - **User strategy lab:** personal rule backtest + permutation test + walk-forward (big; slice it).
   - **/predict/ engagement:** 0 participants on site; show results/leaderboard on the site itself.
   - Medium/low from the review: home-page weight (lazy-load, lighter star animation on mobile), roundtable seat
     history once ≥5 votes, archive search/filter, mobile layout of terminal/lab, onchain/whale caching, a11y
     (alt/contrast/keyboard), mixed UTC/Jalali dates.
2. **`/today/` — per-day snapshots.** Done 2026-11-08 (pages + bot link, which appears by itself from the 2nd recorded day).
3. **The founder and the nightly class.** Home strip (2026-11-07) and `/class/` page + bot section (2026-11-07) shipped.
   Remaining: books/workshops — **blocked on facts** (posts.json has no book titles or syllabus; don't invent them).
5. **Directional study.** Slices 1–2 shipped 2026-11-08 (`stance.py` → `stance.json`; `direction.py` → `direction.json`,
   section on `/track-record/` + bot line). Greeting-quote guard shipped 2026-11-08. Remaining:
   once ≥30 *bearish* days exist, report bullish/bearish days separately (now 65/6 of 71 days, so the test mostly measures bullish days).
6. **Site ↔ bot identity** — design done 2026-11-08; build in slices:
   - Facts: the site's watchlist is `localStorage['ek_watch']` (JSON list of symbols, star buttons from
     `build_pages.WATCH_JS`; read by `assets/news.js`). The bot already routes `?start=s_<section>` (refbot.py ~1161)
     and has per-user alert state (`bot_watch.py`, `refbot.watch_loop`). No server, no accounts: the link is the identity.
   - **Slice A shipped 2026-11-08 (read-only variant):** the bot has no per-user coin list (`x["watch"]` is the tether
     alert), and the guardrail limits the bot to read-only sections, so `w_` shows a market.json snapshot of the coins
     (`scripts/bot_wlink.py`, self-test `python3 scripts/bot_wlink.py`) instead of storing them. Original plan below.
   - Slice A (site→bot, one-way, user-initiated): a "send my watchlist to the bot" pill wherever stars appear →
     `t.me/<bot>?start=w_BTC-ETH-SOL` (Telegram limit: 64 chars of `[A-Za-z0-9_-]`, so ≤ ~12 symbols; longer lists
     are cut with a visible note). Bot: on `w_` show the parsed list and an "add these to my watchlist" button — the
     user confirms, nothing is posted anywhere. Validate symbols against the bot's known coin list; unit-test parsing
     (empty, junk, >64 chars, duplicates, lower-case).
   - **Slice B shipped 2026-11-08** (home `/?w=` + `assets/wimport.js`, not `/news/`, which does not exist). Original plan:
     Slice B (bot→site): bot "open my list on the site" button → `https://entekhab.net/news/?w=BTC,ETH`; the site merges
     `?w=` into `ek_watch` only after a click on "save to this browser" (no silent overwrite).
   - Not planned: secrets/tokens in URLs, cross-device sync server, any change to broadcasting.
7. **Owner action, not for the loop:** stray branch `ck-push-test` (left by a push test on 2026-11-07). The proxy
    cannot delete refs and the safety gate refused deleting it from the GitHub UI; the owner can delete it from the
    repository's Branches page. Harmless meanwhile (it points at a commit already on main). Do not retry.

## Log (newest first)
### 2026-11-13 · /calendar/ + bot: each user's own time zone and alert times (owner's request in chat, not by the loop)
- Page (`calendar/cal.js`): besides Tehran / Erbil / UTC / device, a city list (summer time through Intl) or any fixed
  UTC offset (−12 … +14, :30/:45 included). Every time on the page, the clock, the reminders' texts and the bot link follow it.
- Lead time: 5 min … 1 day or any custom minutes, for the browser reminders and the .ics alarm; a new switch rings for
  every red US release automatically. The bot button carries the zone and lead over: `?start=ec_<o±min|zArea-City>_l<min>`.
- Bot (`scripts/bot_econ.py`): «📅 تقویم اقتصادی» gets «منطقهٔ زمانی» (`ec:tz` → `ez:<IANA|o±min>`, same 16 cities +
  38 offsets) and «زمان هشدار» (`ec:ld` → `el:<min>`, several at once: 5/10/15/30/60/120/240/1440). Private heads-ups
  now go per user at each chosen lead, written in the user's clock; one message covers leads passed while the bot was
  down; nothing under a minute before. The group posts (topic 47540, 30 min, Tehran/Erbil/UTC) are unchanged.
- Checks: bot_econ self-test 20/20 (offsets incl. Berlin winter/summer, leads, deep link, late start), offline drive
  of the callbacks and `/start ec_…`, test_bot_v2 / test_bot_pro / test_ecocal pass, Playwright fa/ckb/en at 1280/390
  (times shift right, links, .ics TRIGGER, auto reminder rings, no overflow, no JS errors).

### 2026-11-13 · /dashboard/: the confirmed market regime at the top (owner's request in chat, not by the loop)
- `build_pages.regime_hero()` (+ `RH_CSS`): the confirmed regime of `data/regime.json` `rule.now` (label, days in it,
  a pending change with its days of the confirmation window), its five votes (Mayer, MA200 slope, weekly RSI,
  fear & greed, funding) with their values, four readings — sentiment (`market.json` fng), breadth
  (`brain.json` up/range/down of n coins), BTC momentum (24 h, RSI), risk (HMM top state's probability and switch
  risk) — and the last 180 days of the confirmed regime as a coloured strip (old → new, left → right). Any missing
  source leaves its part out. `RH_` names because `REG_FA` already exists further down (another vocabulary).
- Verified: real data from main, screenshots at 1280 px (fa, en shell) and 390 px; 0 JS errors; deep_e2e 104.
### 2026-11-13 · /market/: Faraz's feature list, done fully — backtests, optimizer, alerts, market watch, news, help, QR (owner's request in chat, not by the loop)
- Backtesting (`assets/pro/backtest.js`, new): one account model for replay and the strategy tester — balance, size (% of
  equity), leverage with liquidation (margin lost, 0.5% maintenance), fee per side, slippage (none on limit fills and
  targets), fixed or trailing stop, limit/stop orders. Each bar is walked as TradingView's broker emulator does (open →
  nearer extreme → farther extreme → close; ties go to the stop; a gap fills at the open). Strategy tester: EMA cross,
  golden/death cross, MACD, RSI, Bollinger, SuperTrend, Parabolic SAR, Donchian/turtles, and on BTC the published
  Kurdistani signals (acted on at the open after their daily bar closed — checked: their price is that bar's close).
  Up to 20,000 bars (older history fetched in windows, no gaps). Optimizer: every combination of ranges (capped by
  bars × runs), ranked by return, PF, Sharpe, win rate or drawdown. Report: 21 figures, equity curve with drawdown,
  trades table, CSV. Replay bar: order form, SL/TP editor, cancel, report, account settings; a new start keeps the results.
- Alerts (`panels.js`): % moves from the price at creation (up, down, either; «every» re-bases), alerts that follow a
  sloped trend line, ray, extended line or both sides of a channel (from the drawing's bell), an end date with a log
  entry, and new indicator conditions (EMA cross, SuperTrend flip, Stochastic level, volume spike ≥ n× average).
- News: a «news on the chart» layer (data/news.json, per bar, coloured by category, click → headlines with links, in the
  reader's language) and news alerts from data/newsreel.json (~13 KB, every 5 min while open; off / watchlist /
  important / all; the first read is a baseline).
- Market watch (`P.screener`): every Binance coin or Iran's market with 24h change, volume, 24h range, the site's 1 h RSI
  and trend; sort, filters (gainers, losers, top volume, RSI < 30 / > 70, at the 24h high/low), breadth, top movers.
- Help & support side panel (guide, shortcuts, assistant, Telegram group/admin, nightly class); QR code of the share
  link (vendored `assets/vendor/qrcode.js`, MIT, loaded only when sharing); CSV with a BOM, a local-time column and a
  file name for every market, plus one CSV for every chart of the layout; tabs of one browser stay in step (storage events
  reload drawings, alerts, lists).
- B-ADJ continuous futures (second push, same day): probed from the owner's browser at entekhab.net — Binance futures
  (fapi/dapi) and data.binance.vision fail there; Bybit and OKX answer with CORS, and Bybit serves expired coin-margined
  quarterlies. `BTC_F1` / `ETH_F1` (shown as BTC1! / ETH1!, kind `fut` in markets.js): the front quarterly (BTCUSD +
  H/M/U/Z + year), a bar belongs to the contract still trading when it closes, roll at expiry (last Friday of the quarter
  month, 08:00 UTC — checked against Bybit's deliveryTime), live bar polled every 5 s, list prices from Bybit's ticker.
  B-ADJ (legend button, remembered per symbol in `ek_pro_badj`): each roll's gap (next − expiring, at the expiring
  contract's last bar) added to every earlier bar. Checked on Bybit's real data in the owner's browser: 1,500 daily bars
  each for BTC and ETH back to 2022-10, 16 rolls, no gaps, every adjusted roll equal to the next contract's real price,
  latest price equal to Bybit's ticker. Tests: `tests/test_pro_fut.js` (17) and the E2E block `fut`.
- Bot «بازار زنده» text (5 languages), the assistant FAQ, the menu line and the page's own text updated. Apps are WebView
  shells of the site.
- Verified: `tests/test_pro_bt.js` (50 hand-worked account/strategy checks), `tests/test_pro_i18n.py`, new E2E blocks
  (bt, al2, news, scr, help) and the full suite.
### 2026-11-13 · The Observatory, stage 1: liquidation heatmap and liquidation map (owner's request in chat, not by the loop)
- **Why:** the owner asked for everything Glassnode, CoinGlass and CryptoQuant offer, at their quality or better, and
  gave CoinGlass's liquidation heatmap as the example. That is months of work, so it is built in stages; stage 1 is
  his example, done properly, plus the frame the rest hangs on (`/charts/`).
- **What:** `/charts/liquidation-heatmap/` — estimated liquidation levels over time and price for every coin with a
  perpetual on Binance or Bybit (both together or each alone), ten ranges (12 h … 1 y), three models, leverage tiers
  5x–100x switched one by one, four colour scales, threshold, zoom/pan/pinch, crosshair read-out, the levels standing
  now as a profile, the largest clusters above and below the price as tables, PNG, share link, full screen; under
  the chart a strip of the REAL liquidation orders (OKX history page by page, Binance or Bybit live from the socket).
  `/charts/liquidation-map/` — the present levels by price band and leverage with running totals from the price,
  look-back 24 h … 1 month, width ±5 … ±20 %. `/charts/` — the hub: these two, the related pages the site already
  had, and a plainly labelled "in the works" list. کوردی · فارسی · العربية · English.
- **Model (assets/obs/liqmodel.js, written out at its top):** a rise in open interest in a candle = new contracts, one
  long and one short each; entries spread over the candle's range; a long at leverage L is liquidated at
  entry × (1 − 1/L + maintenance margin), a short at entry × (1 + 1/L − mm); a level the price reaches is removed, and
  every level shrinks by the share open interest falls. Model 2 weighs the sides by the accounts' long share, model 3
  adds 10 % of volume as turnover. Maximum leverage and maintenance margin come from Bybit's public specification.
  Older, coarser candles before the window (30 days … 2 years) build the levels the window opens with.
  What is assumption and not data — the tiers, their equal weights, the 10 % — is said on the page.
- **Facts learned about the sources (measured from the owner's browser on entekhab.net, 2026-11-13):**
  fapi.binance.com and api.bybit.com answer with CORS; OKX `public/` and `market/` do, its `rubik/` statistics do not;
  Binance's open-interest history reaches back 30 days only and refuses an older `startTime` with HTTP 400 (the loader
  clips; the e2e mock refuses too), Bybit's reaches years; OKX liquidation orders come 100 a page, newest first.
  Also reachable with CORS and unused so far: Deribit, Hyperliquid (POST), Bitget, Gate, dYdX, CoinMetrics community.
  Not usable: BGeometrics' free API (its terms forbid passing the data on; SOPR/HODL-wave style metrics need a paid
  source), DefiLlama's CEX files in the browser (tens of MB: CI only).
- **Verified:** `tests/test_obs_liq.js` 78 checks on candles with hand-computed answers (null case, one jump, sweep,
  decay, tiers, the three models, wide candles, warm-up, sums, clusters, conservation); `tests/obs_e2e.py` 196 checks
  in Chrome with the exchanges mocked in their real formats (the data the model is fed equals the mock, a planted jump
  of open interest appears as the planted contracts at the computed price, every control, long ranges, the map's
  totals, four languages at 1280 and 390 px, unreachable exchanges); `tests/test_obs_i18n.py`; `tests/test_bot_obs.py`
  through refbot's real handlers in five languages; leak guard clean. **Live with real data (owner's browser):** BTC's
  open interest on the page = Binance 99,534 + Bybit 69,835 BTC = $11.71 B, the same as the two exchanges' own
  endpoints; maintenance margin 0.33 % and 150x from Bybit's specification; the bands end where the day's fall crossed
  them, as on CoinGlass's map of the same hours.
- **Changed after seeing real data:** the colour scale is nearly linear now (gamma 0.95, threshold 6 %): at 0.55 every
  band of a month of levels glowed and nothing stood out; clusters are peaks down to half their height (the first rule
  merged a whole band into one "cluster" $4,000 wide); the real liquidations moved from rings over the candles to a
  strip under the chart and are paged back to the start of the window.
- **Limits (also on the page):** an estimate, not positions; only Binance and Bybit feed the model; positions opened
  before the data begins are invisible; OKX's liquidation feed is one exchange.
- **Bot / apps / assistant:** bot section «🔭 رصدخانه» (`scripts/bot_obs.py`, in «تحلیل», Web App buttons for the three
  pages); the menu's «بازار» group lists the heatmap and the hub; assistant FEATURES; sitemap. The Android and Windows
  apps load the site, so they have it as is.
- **Next stages (Backlog):** open interest and funding across exchanges, long/short ratios, options (Deribit), then the
  on-chain charts CoinMetrics' community data allows (MVRV, realized price, NUPL, exchange reserve and flows, Puell…)
  and the cycle indicators computed from price.
### 2026-11-13 · /dna/: «اثر انگشت دارایی» — the 8 genes as one radar shape (owner's request in chat, not by the loop)
- New section on the DNA page (template `dna/index.html`, copied to every `/dna/<coin>/` by `build_dna()`): an SVG
  radar of the coin's 8 gene percentiles from `data/dna.json`, a dashed median ring, and up to two coins laid over
  it (choices: the 3 most similar coins + BTC/ETH/SOL), each with its similarity from the same file. No new number:
  every point is a gene value the page already shows. fa · ckb · en strings (Arabic from the English layer).
- Verified: screenshots at 1280 px (fa, en) and 390 px; no sideways scroll, 0 JS errors; `tests/deep_e2e.py` 104.
### 2026-11-13 · Knowledge network: grouped site search + related-page links (owner's request in chat, not by the loop)
- `scripts/build_links.py` (both workflows, after the builders, before seo_tidy): writes `/search.json` (777 rows:
  coins, glossary terms in fa/ckb/en, academy lessons, encyclopedia entries, indicators, DNA; ~24 kB gzipped,
  fetched only when search opens; git-ignored) and adds a «شبکهٔ دانش این صفحه» block to coin, glossary-term and
  DNA pages: DNA ↔ coin, comparisons, the glossary terms the page's own text uses (≥2 times), lessons whose text
  names the coin/term (≥2 times), the encyclopedia entry with the same English name. Every link is found in the
  pages, never invented; idempotent between `<!--ek:rel-->` markers. 164 pages linked on the first run.
- `assets/deep.js` search shows results in labelled groups (sections, coins, glossary, lessons, indicators, DNA,
  encyclopedia, archive); arrows skip the labels; on phones the descriptions are hidden. `DEEP_VER` 2.
- Verified: `tests/test_build_links.py` (made-up site, known answers, idempotence), `tests/deep_e2e.py` 104 checks,
  0 JS errors, screenshots at 1280 and 390 px.
### 2026-11-13 · /calendar/ «تقویم اقتصادی»: ForexFactory's calendar + FedWatch-style odds, in four languages, with Telegram alerts (owner's request in chat, not by the loop)
- **Page** `calendar/{index.html,cal.js,cal.css}` (built by the session, chrome.py STATIC, first block of the «بازار» menu
  after /market/, sitemap, assistant FEATURES → bot "events"). fa · ckb · en in the page's `I.*` dictionaries + `CAL_KINDS`
  (what each US release is and why it matters for crypto); Arabic from the English through i18n_ar/ar.js.
  Every currency and impact from `data/ecocal.json` (26 weeks), week navigation Sat–Fri, time zone Tehran / Erbil-Baghdad
  / UTC / device, impact + currency filters, "only what moves bitcoin", search, the next red release with a countdown and a
  "volatile window" banner (±30 min). Each row: actual (coloured hawkish/dovish for bitcoin), forecast, previous, BTC 1h/4h
  after the release; click → explanation, how to read a beat or a miss, the last 10 releases of the same title with BTC
  reactions and a bar chart. Bell → browser reminder 15/30/60 min (localStorage `ek_cal_rem`, sound + Notification while
  the page is open), a .ics file with a 30-min alarm, or the bot. "All red US releases this week" as one .ics.
- **Fed odds** (`#fed`): current target range from the latest FOMC statement, Kalshi's odds for every open meeting
  (bars, table, implied rate path, history chart). CME's FedWatch data is not used; the page names Kalshi.
- **Data** `scripts/econ_live.py` (update.yml step after ecocal, continue-on-error) → `data/econ_actual.json` (official
  actuals: BLS v1 API without a key for CPI, core CPI, PPI, core PPI, payrolls, unemployment, hourly earnings — at most
  every 20 min, every run for 3 h after a release; the Fed's statement for the rate) and `data/fed.json` (rate + Kalshi +
  history, one point per 2 h). Logic in `scripts/econ_src.py` (self-test 23 checks: series checked against
  ForexFactory's "previous" — Sept CPI 0.6%, PPI 1.3%, core PPI 0.7%).
- **Telegram** `scripts/bot_econ.py`, called from `refbot.minute_jobs`: 30 min before every red US release (elections
  excluded) a heads-up in @Coin_Kurd_Group topic 47540 (Persian; time, forecast/previous, BTC's past 1h moves, how to read
  it, Kalshi odds), then the result as a reply (official number via BLS/the Fed — site file first —, beat/miss, BTC since the
  release minute from Binance 1m klines). The same two messages go privately to users who opted in (owner's choice: opt-in
  only): section «📅 تقویم اقتصادی» (key "events", now EC.section with an on/off button), callbacks `ec:on`/`ec:off`, deep
  link `?start=ec`. State in `s["econ"]` (state branch); a release missed while the bot was down is never posted late.
- Checked: self-tests (econ_src 23, bot_econ 8), tests/test_bot_v2.py, test_bot_pro.py, test_ecocal.py pass; Playwright
  fa/ckb/en at 1280/390 with real ecocal.json and realistic fed.json: 0 overflow, 0 JS errors; reminder stored, .ics files
  valid, English/UTC switch. The live BLS, Fed RSS/statement and Kalshi formats were read from the owner's browser.

### 2026-11-13 · Every page except the homepage: depth ("Deep" layer), reading tools, search-as-you-type, structured data (owner's request in chat, not by the loop)
- **Why:** the owner sent a redesign brief for the inner pages (UI depth, UX, SEO) and asked for it to be applied with
  the site's own colours, the homepage untouched. The brief's navy/cyan palette was not used: the brand's black, bitcoin
  orange, gold and the far teal stay. Its ideas were applied where the site did not already have them (it already had
  page transitions, breadcrumbs on most generated pages, related links, FAQ blocks, focus rings and hreflang).
- **Look (`assets/deep.css`):** three fixed layers behind the page (two star fields, the light, a vector floor to a lit
  horizon that stays out of the text column), glass on the existing cards with a lit upper edge and a deeper shadow,
  a candle mark before section titles, the breadcrumb as a capsule, a lit edge where the footer begins, orbits on the
  404 page. With scroll timelines (Chrome/Edge/WebView) the stars slip and the floor comes toward the reader.
- **Behaviour (`assets/deep.js`):** blocks below the first screen rise into place once; cards take light under the
  pointer; a progress line on long pages; a rail of the page's sections in the free margin (≥1100 px, ≥3 sections);
  Ctrl/⌘+K opens the site search, which now lists matching sections (from the page's own menu, in all languages)
  and coin pages (from `/api/v1/index.json`) while typing — plain Enter still searches the archive as before.
- **Not touched:** the homepage, `/battle/`, `/market/`, `/kids/` (`DEEP_OFF`); the encyclopedia app has its own
  shell and theme and does not load the site switch. No text, layout, URL or colour of the brand changed.
- **SEO (`scripts/seo_struct.py`, both workflows):** audit of 5,861 built pages — titles, descriptions, one visible
  h1, hreflang and sitemap were already in order; missing were a BreadcrumbList on ~4,300 indexable pages, a preview
  picture on 1,520 encyclopedia pages, any structured data on ~60 pages and a canonical on /lab/. After the step:
  4,966 pages completed, every indexable page has all four; second run changes 0.
- **Also fixed:** `/dna/<coin>/`, `/indicators/<id>/` and `/signals/` are copies of hand-written templates and went
  out with the stale switch of the committed file (ui2.css?v=3, nx.css?v=7); `build_pages.py` now refreshes the
  templates first.
- **Verified:** `tests/deep_e2e.py` on a full build — 100 checks at 1280 and 390 px (layer on/off per page, no
  sideways scroll, every block arrives, progress, rail, search incl. Persian query / coin page / markup-as-text /
  keyboard, reduced motion, lite mode, no JavaScript), 0 JS errors; `tests/test_seo_struct.py` (made-up site with
  known answers, idempotence); `tests/mm_e2e.py` 263/263 with the layer on; `kids_check.py` 0 problems; leak guard
  clean; screenshots looked at: 32 page families at 1280 px in Persian, samples at 390 px and in English.
- **Bot / apps:** the Android and Windows apps load the site, so they show it as is. Nothing here has a place
  in the Telegram bot (no new section or data).
### 2026-11-13 · «نبرد من»: no physical errors, every element fights, Hollywood cinema (owner's request in chat, not by the loop)
- **Nothing passes through anything.** New `battle/nav.js` (hull-exact A* with turn room). Vehicles drive planned routes
  of straight, arc, pivot and reverse legs, each checked against every solid at 0.25 m steps with the hull's own size.
  Each base has a motor-pool shed (`GFX5.GAR`) with a roll-up door that takes one vehicle at a time, and a gate that
  passes one direction at a time; inbound vehicles wait in holding bays. Soldiers, robots and dogs step aside for
  vehicles. Ships keep loops that never bring two hulls, or a hull and the pier, together.
- **Nothing floats or vanishes.** Radar and microwave dishes are solid shells (`G.dishGeo`), so no angle hides them.
  Floating parts (ship superstructure, shed slats, ruin slab) were seated. The pier's bare poles are now real lamp
  posts with an arm, a head and a lit lens, standing clear of the crane's load.
- **Every element has a battle role.** Radars and searchlights track incoming aircraft and missiles (`THREATS`).
  Drones spot targets for the guns. Strikes of tier 5 and up hit an enemy site (dump, yard, hangar, barracks, comm,
  dome, TEL or SAM); the SAM intercepts about 45%, and a hit site burns for 40 s. Helicopters use base helipads, or
  the carrier. Patrol boats fire. Comm masts relay.
- **Cinema** (`CINE` in battle.js): acts (theatre, armies, yard, front, sea, sky) and a shot for each big event (guns,
  heli, jets, missile, raid, wall, naval, robots, sat, sub, win). Hard cuts, FOV punch, shake and handheld drift; the
  camera never sits inside a model, and it side-steps a lamp or flag pole near the lens so no pole splits the frame
  (`CINE.poles`, found live in the owner's browser and fixed the same day).
- **Verified:** `tests/battle_ground.py` (160 s, exact hull against every shape: zero violations),
  `tests/battle_geometry.py` + `battle_audit.js` (no part floats), `tests/battle_navy.py` (no hull touches another or
  the pier); harness `tests/battle_harness.py` (Playwright + SwiftShader); screenshots of bases, harbour and cinema.
- **Bot:** `battle_text` in five languages gained the "nothing is just for show" bullet and the Hollywood camera.
  **App:** it loads the site, so it shows this as is.
### 2026-11-13 · /bitcoin/ «درک بیت‌کوین»: the halving page + a film in Persian and Kurdish (owner's request in chat, not by the loop)
- Static page `bitcoin/index.html` + `bitcoin/bitcoin.{js,css}` (page and films went up 2026-11-12 in 7316fa0; the wiring
  followed 2026-11-13): chrome.py STATIC, «آموزش» menu right after the map, GLOW; sitemap list in build_pages.py;
  assistant FEATURES; a URL button at the top of the bot's Learn menu in 5 languages. Text is fa · ckb · en in the
  page's `I.*` dictionaries (Arabic comes from the English through i18n_ar/ar.js). Edit the dictionaries in
  index.html directly.
- Every supply / reward / halving figure is computed in the browser from Bitcoin Core's rule (50 BTC in sats `>>`
  halvings): max 2,099,999,997,690,000 sats; 20 M at block 939,999; last 40 years 2.4948 BTC; 99% ≈ 2035;
  20,999,000 ≈ 2066. Live values: mempool.space (tip, hash, price, hashrate), Binance price fallback, then
  `/data/btcinfo.json`. The halving ETA uses the 10-minute target (bitcoinblockhalf.com's convention).
- The owner's seven images are redrawn natively (no third-party pictures): his halving table with his "probable price"
  column (labelled as the Coin Kurd model, not a forecast), the binary right-shift table, coin stacks, a 33-notch clock,
  nested halves (area = coins of each era), a monthly log chart with the halvings, days per price decade, a live
  proof-of-work card and (2026-11-13) world wealth in bitcoin: UBS's > $470 trillion ÷ live price vs coins in
  existence (≈ 340× at $68.8k; the owner's Dec-2023 picture said 500×). Plus the retirement-funnel calculator, a DCA
  mini calculator (links to /dca/), wallet-safety steps, the quantum note (BIP-360 not active) and 22 "future headlines".
- 2026-11-13, owner's request: the homepage hero's second button now opens /bitcoin/ «درک بیت‌کوین» instead of
  /satoshi/ (`assets/nx-home.js` template + `scripts/nx_prerender.py` run on index.html). /satoshi/ stays in the menus.
- 2026-11-13 fixes: era legend said "next 25 eras: 0.1%" — it is 27 eras, 1.5625% (≈ 328 k BTC); legend percentages
  no longer show trailing zeros in Persian/Kurdish digits.
- Film: `bitcoin/film-{fa,ckb}.mp4` (2:33, 1280×720, H.264 + AAC, ~8 MB each, preload="none") and posters/og.jpg,
  rendered frame by frame from a deterministic HTML stage with the site's font, coin and logo; the score was
  synthesized in code (no samples). Stage and score sources are not in the repo.
- Checked: Playwright 1280/390 in fa/ckb/en with mempool mocked in its real formats, 0 overflow, 0 JS errors, no video
  bytes before play; bot menu in 5 languages; assistant index lists it. Published from the owner's browser through
  GitHub's upload page (the cloud session had no push credential).

### 2026-11-13 · /market/: toman markets, every Binance coin, and the rest of Faraz's list (owner's request in chat, not by the loop)
- Iran's market in toman (`assets/pro/markets.js`, symbols `IR_<KEY>`): dollar, euro and 19 more currencies, 18k/24k gold,
  mesghal, the melted-gold rate, ounce, five coins and the coin bubble, silver and tether — tgju.org public data in the browser
  (history from its TradingView datafeed, latest price from its tables, `ajax.json` as fallback; rial ÷ 10; 5-minute bars
  at least, tether daily). Any Binance coin in toman (`BTC_IRT`…) is computed: the Binance bar × tether's toman rate
  (daily closes interpolated, today's tick live) and says so. Toman prices: no decimals, grouped digits. CSP: tgju hosts.
- Watchlists: «همهٔ بایننس» (every USDT pair that has a logo; rows on screen stream, the rest get one REST snapshot),
  «بازار ایران», a filter box, search tabs by market, and sections (headers that fold, rename, remove, «move to
  section»; the site-wide `ek_watch` stays symbols only — its headers live in `ek_pro_watch.lay.site`). `scripts/logos.py`
  now fetches logos for every Binance base (CoinGecko pages + CoinCap, 220 a run): a coin without a logo stays hidden.
- The rest of Faraz's list: 17 chart types (volume candles, high-low and HLC area as a custom series; Renko, Line Break,
  Kagi and Point & Figure rebuilt from closes with an ATR(14) box or the user's own, indicators and replay on the rebuilt
  bars); 70 indicators (48 new: HMA, DEMA, TEMA, VWMA, SMMA, ALMA, LSMA, McGinley, MA cross, ribbon, envelopes, Alligator
  drawn ahead, fractals, pivot points by auto period, ZigZag, AO, AC, momentum, TRIX, UO, PPO, TSI, CMO, Connors RSI,
  Fisher, RVGI, KST, Coppock, DPO, Aroon, Vortex, Choppiness, Mass, Bull/Bear power, BOP, %B, BandWidth, stdev, HV, RVI,
  ADR, CMF, A/D, Chaikin osc., EFI, EOM, PVT, volume osc.); calendar ranges (today / tomorrow / this week Sat–Fri / next
  week) and alerts before releases (per event 0–60 min, or every high-impact event of the chosen currencies: toast,
  sound, notification, alert log, once each); «sync indicators» across charts; 20 s / 45 s; replay of all charts on one
  clock with replay intervals.
- Maths fix found by the references: rolling sums over a window of exact zeros now give exactly 0 and stdev drops
  deviations under 1e-10 (relative), as TradingView does — 0/0 cases (no volume, flat stretches) show nothing, not noise.
- Bot: `t_<ASSET>_<PRICE>` links from toman alerts (USD, EUR, GBP, AED, TRY, GOLD_18, GOLD_MESGHAL, COIN_EMAMI, USDT) are
  offered and stored on «add» (`pt:`) as toman alerts through `parse_alert`; the «بازار زنده» text in 5 languages, the
  assistant's FAQ, the home card and the page's own text in 4 languages updated. The Android/Windows apps are WebView
  shells of the site, so they get it all with the deploy.
- Verified: 146,725 indicator values against the Python references (70 indicators × 3 data sets, pivots on 15 m and 1 D),
  i18n in 4 languages, `tests/pro_e2e.js` 99 checks with Binance and tgju mocked in their real formats (new blocks: toman,
  replay2, cal, types, inds2, sections, syncind), bot flows in 5 languages (toman links included), leak guard clean.
- Limits: tgju.org is a third-party public source (named on the page); coin prices in toman are an estimate; the
  calendar still has no "actual" values (the feed has none); price-only chart types use closes.
- Live check after publishing (owner's built-in browser, real tgju/Binance data): the dollar 266,900 toman = tgju's
  2,669,000 rial exactly; all 35 Iranian instruments priced with their icons; BTC in toman = Binance × 270,382; the
  calendar's today/this-week filters and bells on real events; Renko/Kagi/P&F on real BTC; all 70 indicators give values.
  One bug found and fixed the same hour: a live tgju tick on a timeframe that is native on Binance (1h, 1d…) became a bar
  of its own at the tick's second, and tgju's history repeats a few timestamps — both made the chart library throw
  «Value is null» (seen on the ounce and tether, which trade on Fridays). Ticks now go into the bar of tgju's own grid
  (Tehran's :30 hours, 00:00 UTC days), repeated times are merged, and the test mock sends tgju's real alignment and
  repeats (`ONLY=toman`: fails on the old code, passes now; full suite 100 checks).
- «Every Binance coin», checked against Binance's own list (518 bases trading against USDT): the first logo run met
  CoinGecko's 429 and an alphabetical cut-off (406 had logos after two runs). `logos.py` now waits and retries on 429,
  takes the coins CoinGecko knows first, maps multiplier tokens to their coin (1000SATS → SATS, 1MBABYDOGE → BABYDOGE),
  searches CoinGecko by exact symbol for the rest (≤25 a run) and stays inside a 6-minute step. One-letter coins (S, W,
  T, A, G, C, F, U) were shut out by a 2-character symbol rule on the site, in `logos.py` and in the bot's `a_`/`pa:`/`w_`
  parsing — now 1–12. Left out on purpose: Binance's 75 tokenized US stocks (AAPLB, NVDAB…: not crypto, and their only
  logos are the companies' marks) and two tokens with Chinese names (no A–Z symbol).

### 2026-11-12 · The market map: coin360-style heatmap, cryptobubbles-style bubbles, money flow, liquidity, ETFs (owner's request in chat, not by the loop)
- Five addresses, one app (tabs switch in place): `/heatmap/` (squarified treemap by sector, sizes by market cap /
  volume / move / flow / equal, zoom into a sector, search, filters, PNG; **3D "market city"**: a tower per coin on its
  sector's platform, height = move, logo on the roof), `/bubbles/` (physics, drag and throw, ranges of 100, **3D** glass
  spheres), `/money-flow/` (taker-flow river between sectors, leaders, flow-vs-price quadrants, stablecoin supply,
  dominance, leverage), `/liquidity/` (Bookmap-style live order-book heatmap kept by Binance's documented
  snapshot + diff-stream sync, depth, live liquidations, liquidity table), `/etf/` (SoSoValue-style: daily US spot BTC/ETH
  ETF flows per fund, cumulative, streaks; company treasuries; sector movers; distribution). Nine timeframes everywhere:
  5m 15m 1h 2h 4h 1D 1W 1M 1Y. fa · ckb · ar · en; RTL-correct charts (labels mirrored, numbers isolated).
- Tap a coin anywhere: one panel with overview (market, supply, ATH/ATL, toman converter, peers), candles
  (Lightweight Charts), money flow (window table, minute CVD, large trades live), order book (depth, walls), derivatives
  (OKX funding/OI live, long/short, liquidations), and Entekhab's own data (scanner, news, coin/DNA links, price alert
  handed to the bot exactly as `/market/` does).
- Data (update.yml, both `continue-on-error`): `scripts/mm_data.py` (CoinGecko top 250 + categories a few per run,
  Binance klines for 5m–1D and taker flow, depth bands, DefiLlama stablecoins; a Binance pair is used only when its
  price is within 15 % of CoinGecko's) and `scripts/etf.py` (Farside at most hourly; a day not reported yet is not a
  zero). Logos: every coin on the map has its own (placeholders refused), packed in one hashed WebP sheet.
- Bot: section «🗺 نقشهٔ بازار» (`scripts/bot_mm.py`, second item of «تحلیل», also linked from «بازار»): live summary from
  the same files + the five pages as Web App buttons. Assistant: FEATURES for the five pages.
- `scripts/i18n_ar.py` now skips `translate="no"` (as `assets/ar.js` always did): the map has its own Arabic.
- Fixed on the way: in Arabic the map sets `<html lang="en">` like every page in Arabic (the shared header shows its
  English labels for ar.js) — with `lang="ar"` ar.js takes the page for a real /ar/p/ post and sends a reader leaving
  Arabic to `/p/undefined/`. Checked live: Arabic and back to Persian stay on /heatmap/.
- Verified: unit tests for both data scripts with fixtures in the real API formats; i18n parity/digits; bot flows in 5
  languages through refbot's real handlers; Playwright (mm_e2e.py) with Binance/OKX REST and both WebSockets mocked:
  every view and the panel, 3D in SwiftShader, 4 languages × 1280/390 (no sideways scroll, labels inside charts and
  nodes, text at real size), Arabic with ar.js as CI deploys it, language switches both ways.
- Limits: the order-book heatmap builds up while the page is open (no public history of the book); ETF days come from
  Farside's public tables; Binance flow counts Binance only.
- First live run (09:50 UTC, 13 Nov): 246 coins, every one with its own logo (154 fetched, sheet 197 kB), 113 Binance
  pairs (XMR, LIT, BEAM and AUTO refused by the 15 % price check), ETF 2026-11-12 BTC −$47.7M / ETH −$8.0M. CoinGecko's
  `bridged-tokens` list turned out to hold native coins too (SPX6900 showed as "wrapped"): no longer used.

### 2026-11-12 · /market/: the live market — faraz.io's advanced features for every visitor (owner's request in chat, not by the loop)
- New static page `market/index.html` (chrome.py STATIC, first item of the «بازار» menu, sitemap, home CTA in the live
  market box) running `assets/pro/{i18n,ind,data,draw,app,panels,replay}.js` + `pro.css` on a vendored
  `assets/vendor/lwc5.js` (TradingView Lightweight Charts 5.3.0, Apache-2.0, attribution on the page). fa · ckb · ar · en.
- Faraz's list, one by one: 10 chart types (incl. hollow candles, Heikin-Ashi); 1–16 synced charts (symbol, timeframe,
  crosshair, time); seconds timeframes 1/5/10/15/30 s and any custom one (built by aggregation, 00:00 UTC aligned);
  bar replay at 9 speeds with practice trades; 22 indicators matching TradingView's definitions; 19 drawing tools
  (Fibonacci, Gann fan, Andrews pitchfork, long/short positions…); watchlists with six colour flags; price alerts and
  indicator alerts (RSI/MA/MACD/BB on bar close); the economic calendar as a panel and as flags on the chart; templates;
  CSV/JSON export; automatic saving, named layouts and a share link. Entekhab's own layers (posts with outcomes,
  Kurdistani signals, live states) are drawn from their OUTPUT files only. TSE adjusted charts do not apply to crypto
  (said on the page).
- Data: Binance public data in the browser (REST + one shared WebSocket for every chart), OKX REST fallback, then the
  site's own `/data/candles/` snapshot (says so). Data saver for slow Iranian connections. Personal state only in
  localStorage (`ek_pro*`); nothing leaves the browser except the share link the user makes.
- Calendar: `scripts/ecocal.py` (update.yml step, continue-on-error) keeps every currency's events as history in
  `data/ecocal.json` (26 weeks), titles translated deterministically by `scripts/ecocal_tr.py` (fa/ckb/ar), BTC's 1 h and
  4 h move measured from the open of the event's hour. ForexFactory's feed has no "actual" values, so none are shown.
- Bot: section «📈 بازار زنده» (`scripts/bot_pro.py`, first item of «تحلیل») with a Web App button and a browser button;
  the site's ✈ on a price alert opens `t.me/<bot>?start=a_<COIN>_<PRICE>` — the bot only OFFERS it, stores it on «add»
  through the usual `parse_alert` (crypto only, exact price kept). Site assistant: FEATURES + one FAQ entry.
- Verified: indicator maths against an independent Python reference (51,665 values, 0 failures); i18n keys in 4 languages
  (`tests/test_pro_i18n.py`); calendar (`tests/test_ecocal.py`); bot flows in 5 languages through refbot's real handlers
  (`tests/test_bot_pro.py`); Playwright with Binance mocked in its real formats (`tests/pro_e2e.js`, 53 checks: desktop tour,
  4 languages at 1280/390, phones as first opened, Arabic as CI deploys it with ar.js, the logo rule, offline fallback);
  the real Binance/OKX endpoints and socket checked from the owner's browser on entekhab.net (formats, 1 s klines); leak guard clean.
- Limits: alerts on the site sound while the page is open (the bot carries them otherwise); calendar history starts with
  the first CI run (seeded with the USD history of events.json).
- Live check after publishing (owner's built-in browser, real data): 1 s / 5 s bars live, one socket, 4 charts, Arabic via
  ar.js, phone layout. Four fixes followed the same evening: (1) the workspace started from a `setTimeout` that could
  fire between two deferred scripts on a slow connection, leaving the side panel empty and the calendar/alerts unstarted —
  it now starts on DOMContentLoaded (lesson: never boot from a timer in a deferred script; `ONLY=slow` reproduces it);
  (2) opening the page wrote default stars into the site-wide `ek_watch` — now shown, saved only when edited;
  (3) the first real calendar run left 22 of 116 titles in English — dictionary extended (self-test 22 checks);
  (4) a hidden tab kept the socket streaming — it now closes after a minute hidden and catches up on return (`ONLY=hide`).

### 2026-11-12 · Daily podcast «نبض کریپتو» in four languages, posted to the channel at 19:00 Tehran (asked for by the owner)
- **What:** every day `podcast.yml` (13:50 UTC) collects the day's facts from `data/` (`scripts/podcast/collect.py`),
  has Gemini write a Persian master and native Sorani, English and Arabic versions (`write.py`), voices them (Piper
  fa ganji_adabi / ar kareem, Kokoro en, Vekol for Sorani — the site reader's voice), adds original code-made music,
  masters to −16 LUFS MP3 with chapters, cover and SRT (`produce.py`, `mix.py`, `finalize.py`, `covers.py`), checks it
  (`qc.py`, `run.py`) and publishes (`publish.py`): GitHub Release `podcast-<date>` (audio + FLAC archive), then
  `data/podcast/<date>.json` + `index.json`, `/podcast/` pages (`scripts/build_podcast.py`), a menu entry, a bot section
  (`bot_reality.sec_podcast`, key `podcast`), and ONE Telegram album with the four audios, each captioned in its own
  language and tagged (🟢 فارسی · ☀️ کوردی · 🔵 English · 🟠 العربية), four hashtags at the end.
- **Gates:** every figure of the Persian master must trace to facts.json/inputs.json (rounding allowed), the other
  versions must carry the same figures section by section, clock times must be real instants, no Latin left in the
  spoken fa/ckb/ar text, Sorani numbers are read back by an independent parser, audio health (loudness, clipping,
  silences, chapters, cover) and a Whisper listening sample (not Sorani: Whisper has no Kurdish). A failing language
  is held and named on the page; a failing Persian master holds the episode. The Telegram ledger is the `telegram`
  field of `data/podcast/<date>.json`: never posted twice.
- **Voices' licences (told to the owner):** the fa/ar Piper voices derive from a research-only dataset and Vekol is
  CC BY-NC; English (Kokoro) is Apache-2.0. The owner chose to go ahead; a permissive voice would replace them.
- Manual run: Actions → "Daily podcast" → mode `dry-run` (makes and checks, publishes nothing) or `publish`.

### 2026-11-12 · All apps updated and presented on one page; iPhone and Windows added (asked for by the owner)
- **Download center `/app/`** (`scripts/build_apps.py`, built in CI; the old hand-made Android page is gone): one page
  for Android, iPhone & iPad, Windows, the browser extension, the Telegram bot and the trading bot, fa/ckb/en (+ar via
  overlay). The visitor's own platform is detected and its download comes first ("for your device"). Versions, sizes
  and SHA-256 come only from the published files (`app/app.json`, `app/windows.json`, `extension/latest.json`).
- **Windows 64-bit** (`windows/`, C# .NET Framework 4.8 + WebView2, ~0.5 MB installer, NSIS fa/ar/en, per-user):
  `.github/workflows/windows-app.yml` builds on a real Windows runner, runs the app's `--selftest` (site loads, the app
  identifies itself, outside links leave the window, a foreign page is refused), installs silently, runs the installed
  copy, screenshots it, checks a second launch opens no second app, uninstalls (must leave nothing), then publishes
  `app/windows/` + `app/windows.json`. Pictures of every run: branch `ci-windows`. Release = raise both versions.
- **iPhone & iPad:** a web app installed from Safari (the App Store is closed to Iran). `assets/chrome.js` adds the
  iOS tags and draws a splash at the device's exact size (JPEG, once a session) only on iOS; a gentle 14-day prompt
  links to the illustrated guide (`/app/#iphone`, iOS 26 "•••" → Share flow and the older Share button).
- **Extension 1.6.1:** THE LOGO RULE (see Guardrails) — badge removed for good, price in the icon tooltip, old badges
  cleared and the old setting migrated (tested by installing 1.5.2 then upgrading in a real Chromium); four languages
  in the order ckb · fa · ar · en; in-popup update notice (`/extension/latest.json`); popup height adapts to any font.
- **Bot:** new "📲 Apps" section in "Settings & more", five languages. **Android:** the shell is unchanged — its
  signing key is not available in this environment, and a differently signed APK cannot update installed copies; the
  app already shows every site change because it loads the site.

### 2026-11-12 · /satoshi/: the live mempool, as on mempool.space (owner's request in chat, not by the loop)
- assets/btc-live.js (+ CSS in scripts/build_satoshi.py, VER 5). Tapping a waiting cube opens its panel: median fee,
  fee span, total fees, tx count, size, a fee-rate-by-weight curve, and a canvas map of every transaction in that
  projected block (square side ∝ √vsize, packed by fee rate; the grid grows downward rather than drop one). It moves
  live from mempool.space's websocket (`want blocks/stats/mempool-blocks`, `track-mempool-block`, deltas with a
  sequence check that re-asks for the block on a gap). 11 filter chips from mempool's flag bits
  (frontend/src/app/shared/filters.utils.ts; bits past 32 tested arithmetically). Mined blocks get the same map
  from `/v1/block/<hash>/summary` (behind a button for full blocks: ~600 kB). Colour = one orange ramp over the
  block's own 2nd–98th percentile of rates (OKLab L monotonic 0.32→0.95), legend shows the numbers.
- Below it: a live stream of new transactions (ws `transactions`, REST `/mempool/recent` fallback), queue KPIs and
  recent RBF bumps (`track-rbf-summary`). Search now also takes a txid (panel with inputs/outputs, RBF signal,
  CPFP effective rate, rough ETA) and an address (balance, history unless >2,000 txs).
- Data: the socket runs only while the section is on screen and the tab visible, never starts by itself under Data
  Saver / 2g, pauses after 6 quiet minutes (≈300 kB to open the map, then ≈3 kB/s), REST polling is skipped while the
  socket is healthy. CSP: wss://mempool.space added in chrome.py. Bot: next-block + mempool lines in sec_chain and a
  «🔴 live mempool» button to /satoshi/#mempool.
- Verified: message formats against mempool's source and the live socket; unit tests (packing, curve, flags vs
  BigInt, address regexes, scales, ETA); Playwright with a fake socket in the real formats (fa/en/ckb, 1280/390,
  Data Saver); and the exact code against the real network in the owner's browser (map count = nTx, mined block
  2,191/2,191, real tx and address lookups).

### 2026-11-11 · /satoshi/: real 3D block cubes + the way back to block zero (owner's request, done in chat, not by the loop)
- assets/btc-live.js + CSS in scripts/build_satoshi.py (VER 4). Each block is a CSS-3D cube (front/side/top faces, no
  WebGL, no new download); its faces are painted as high as the block was full (weight / 4,000,000). Block 0 is gold.
- New bar above the belt: search by height, block hash or date (Gregorian or Solar Hijri; a date opens its last block,
  UTC), a slider from now to block 0, milestone chips (0, 170, 57,043, 74,638, the four halvings) and an "older blocks"
  cube at the end of the belt that keeps loading 15 more. All from mempool.space in the browser: `/v1/blocks/<h>`,
  `/v1/block/<hash>`, `/v1/mining/blocks/timestamp/<ts>`. Nothing is stored or invented; errors say so in words.
- Checked with Playwright against a mocked API at 1280/390 px, fa + en (height, Persian digits, hash, dates, bad input,
  older ×2 contiguous, slider, chips, back to live; no JS errors) and against the real API in the owner's browser.

### 2026-11-10 · SEO audit (OpenSEO): titles ≤ 60, descriptions ≤ 160 on all 5,498 pages; IndexNow
- build_pages.seo_title / seo_desc (decoration such as ━━━ and emoji removed, cut at a word boundary, "…") in page();
  scripts/seo_tidy.py as the last build step catches the pages with their own templates. og:* tags keep full text.
  Build check: 0 of 5,498 pages over the limits; second run changes nothing. Home title/description shortened.
- IndexNow already ran (scripts/indexnow.py, key 197870bb…, step at update.yml ~315); only OpenSEO's own key file
  79b8346b….txt was added at the root so OpenSEO can verify. (A first version of this change overwrote indexnow.py by
  mistake; it was restored from fe570afc in the next commit.) The OpenSEO project is set to the misspelt domain
  entekhb.net — only the owner can change that in its settings.

### 2026-11-10 · Paper trading in the bot + /leaderboard/ (owner chose "record trades in the bot")
- scripts/bot_paper.py: $10,000 virtual, 12 coins, long/short, 10/25/50% of free cash, 0.1% fee each side, max 5 open,
  no leverage (a short is capped at −100% of its stake). Every open/close is priced by the bot from Binance
  (data-api.binance.vision ticker) at the tap; if no price comes back nothing is recorded. Opt-in with a nickname
  (2–20 chars, no links/@, unique), ranked from 10 closed trades, realised results only; "delete account" removes
  everything. State in s["paper"] (refbot-state); bot_hub.export writes data/leaderboard.json (7/30/90/all).
- Bot: menu "paper" (More group), /paper, deep link t.me/Kurd_kurdistan_bot?start=s_paper, pp:* callbacks,
  "paper_nick" await. Site: /leaderboard/ (build_leaderboard.py + assets/leaderboard.js), home toolbox card, nav.
- Checked: P/L formulas against hand calculation (long +10% → $489.01, short −10% → $257.24, short capped at stake),
  max-open and no-price refusals, nickname rules, opt-in/delete through refbot.handle_callback/handle_private with a
  fake Telegram, board ordering, the page in 3 languages.

### 2026-11-10 · Strategy lab: PBO (CSCV) and Deflated Sharpe on the walk-forward parameter sweep
- When a parameter is optimised, the lab now also reports the Probability of Backtest Overfitting (8 blocks, 70
  combinations, Bailey/Borwein/López de Prado/Zhu 2014) and the Deflated Sharpe Ratio of the best value (Bailey &
  López de Prado 2014), with verdicts. Both match an independent SciPy implementation exactly on fixed data
  (PBO 0.6714, DSR 0.54335 on a random walk — correctly flagged as overfit).

### 2026-11-10 · Owner's priority list: /derivatives/, /dca/ (+ buy-only grid), Calmar, Altcoin Season
- /derivatives/ (build_derivatives.py + assets/derivatives.js, live from data/derivatives.json): BTC/ETH/SOL tabs, four
  cards (funding 8h + APR + extreme tag ≥0.05%/8h + 7-day avg once recorded, OI + 24h change + vs 7-day avg,
  liquidations long/short over a real 24 h from data/liq_store.json — OKX only returns the latest ~100 orders, so
  derivatives.py now keeps every order for 24 h, deduplicated —, long/short accounts) with plain explanations,
  72 h / 48 h charts, hottest/coldest funding, roundtable link. Bot section: SOL, OI 24h, 24 h liquidations.
- /dca/: lump sum vs DCA vs buy-only grid (limits checked against the daily low); every-start-date test.
  Checked against an independent Python implementation on fixed data, and live on real Binance data.
- Lab: Calmar. Deploy: one retry when deploy-pages hits its hard 10-minute cap.

### 2026-11-10 · Live analysis window on every indicator, outputs only (asked for by the owner)
- **Need:** traders tap any indicator and see the live market analysis it produces, while the closed indicators' code
  can never leak (owner: "under no circumstances").
- **Built:** `#ESTATE` relay line (TradingView `alert()` → webhook → Telegram relay channel → `scripts/signals.py`) and
  `data/engine.json` from the owner's private engine, merged into `data/live.json` (latest state per indicator/symbol/
  timeframe, open positions, last signal). `/indicators/`: every card has «📊 تحلیل زنده» with a status line; the modal
  and the detail page show the live window (decision, fields, live Binance chart with entry/SL/TP/Body Way, freshness,
  20 s price refresh, 60 s data refresh). Bot: live block in the Indicators section. Leak guard added to both workflows.
- **Not on yet:** needs the relay channel name in `scripts/make_indicators.py` → `relay.channel`, the owner's alerts,
  and the private engine repo (kit delivered to the owner, not stored here).
- **Checks:** `tests/test_live.py` (23 checks: parsing, paging stop, merge order, engine whitelist); Playwright at
  1280/390 fa+en with synthetic data (not committed), 0 JS errors; leak guard fires on a planted `//@version=6`.
  `tests/test_bot_v2.py` already failed before this change (NameError `page` in the alerts section) — not fixed here.

### 2026-11-10 · Owner's two review files: frozen no-JS snapshot fixed, scanner grouped per coin, daily prediction in the group
- **Root cause of most "critical" items:** the home page's prerendered (no-JS) snapshot — what crawlers, link
  previews and AI reviewers read — had been frozen since 2026-11-07 15:09 UTC. The committed index.html held a
  filled copy and `prerender()` only replaced empty placeholders. `refill()` in build_pages.py now finds each region
  by id (empty or filled, keeping the page's own classes) and refreshes it every build; the committed template was
  emptied again. Two builds in a row give identical output. **Never commit build output over index.html.**
- Scanner: one card per coin (strongest finding first; the rest listed with "all agree" / "conflicting"); same in
  the bot (5 languages) and the snapshot. A finding already shown as a confirmation is not repeated. Telegram share
  link on every card.
- Regime: the hourly label is renamed "24-hour market mood" so it is not read as the confirmed regime flipping; the
  radar shows days in the regime and the model's typical stay (brain.py `radar.days_in`, `radar.mean_days`). The scan
  universe is stated on the page.
- Live class line: no more "starts in —" (hidden until the script runs), local digits, "live now" during class.
- Prediction game: the daily question only lived inside the bot menu (0 votes most days); bot_hub now also posts it
  in the group (`GROUP`) and refreshes the tally on each vote with a direct editMessageText (never `edit()`, whose
  fallback re-posts).
- Data older than 3 h shows ⚠️ next to its age. New home strip "Your own research tools" (lab, regime, track
  record, my space, prediction, roundtable).
- Claims in the review that were already wrong: rule layer + 5-day confirmation + typical stay (/regime/), strategy
  lab with permutation and walk-forward (/strategy-lab/), watchlist/alerts/paper/badges (/me/), learning-map
  progress saved (ck_map), plain-language "why" on each finding.
- Checked: 3 languages, no JS errors, 12 scanner cards with no repeated coin, archive button, bot in 5 languages,
  `new_rounds` with a fake poster (group once, no repeat, GROUP=None unchanged).

### 2026-11-09 · Home feed opens on one week; three.js off the critical path (asked for by the owner)
- Feed opens from `data/posts_week.json` (64 posts, 26 KB on the wire) instead of the whole archive (1129, 448 KB);
  the archive loads on search, filters or "Show older posts". `scripts/enrich.py` writes it (`FEED_DAYS=7`,
  `FEED_MIN=40`). three.min.js is fetched after `load`, before land.js/cinema.js.
- 3 Mbps, 390 px: first card 8.3 s → 2.6 s; first screen 1.08 MB / 64 requests.

### 2026-11-09 · Broken images slice 2 investigated and closed without code (Backlog #1)
- **Need checked:** cache the Iranian news-CDN images (donya-e-eqtesad, eghtesadnews, isna, ecoiran) in CI.
- **Found:** those images live only in `data/news.json` → `regional.items[].img`, and nothing displays them: `assets/news.js`
  has `noPic` (Persian news is text-only, owner's choice), no builder or bot section reads regional `img`, and a full
  `build_pages.py` run on a /tmp/bld copy left zero `<img>` pointing at those CDNs (only article links in friction.json).
  Slice 1's hide-on-error already covers any other broken image.
- **Built then discarded:** `scripts/newsimg.py` (download → ≤480px WebP cache, drop on failure; self-test passed) — not
  shipped, because it would add repo weight for images no page shows. Recreate from this note if the owner turns Persian
  news thumbnails on.
- **Next:** Backlog #1 regime radar stability (rule layer + hysteresis, with trackrecord-style synthetic tests).
### 2026-11-09 · Broken images hidden site-wide (owner review, Backlog #1 first item, slice 1)
- **Need:** the owner's review counted ~40 broken-image icons on home/news/archive (dead Iranian news CDNs, missing local
  files) — visible on every visit, makes the site look abandoned.
- **Built:** `assets/chrome.js` (loaded on every page) now starts with a capture-phase `error` listener + a scan of already-failed
  images: a broken `<img>` is hidden, and its wrapper too when it is an otherwise empty thumb/img/figure/picture box.
  `build_pages.post_img` no longer returns a `/data/postimg|deepimg/` path whose file is missing (falls back to the post's
  photo; currently 0 of 1122 posts affected). `chrome.VER` 10→11 to bust caches (builders rewrite `?v=` in all pages).
- **Verified:** py_compile; build_pages on a /tmp/bld copy; Playwright + Chrome, all external requests aborted, an injected
  `/data/postimg/nope.webp` inside `a.thumb` on /, /crypto-news/, /daily/, /tools/ at 1280 fa / 390 fa+en → 0 visible broken
  images, wrapper hidden, zero JS errors; looked at shot.
- **Next:** Backlog #1 broken images slice 2 (cache allowed news images in CI), then regime radar stability.
### 2026-11-09 · Stablecoin peg check (/tools/#peg) + owner's site review filed into Backlog
- **Need:** Iranian/Kurdish traders hold savings in stablecoins and route transfers through USDC/FDUSD/DAI; a depeg
  (even 1–2%) costs them real money and nothing on the site watched it. #5 still waits (bear days 8/85).
- **Built:** `/tools/` card (fa/ckb/en): live Binance spot `ticker/24hr` for USDC, FDUSD, TUSD, USDP, DAI, USDE, USD1 vs
  USDT — price, deviation from 1, largest 24h deviation (high/low), status at a stated 0.5% rule; per-coin "no data yet"
  when a pair is missing; "implied USDT in USD" = 1/median of the others (n shown), since everything is USDT-quoted and
  USDT itself can't be measured directly — stated on the card. Browser-only. Bot: `bot_reality.TOOLS` entry.
- **Verified:** node tests on pegCalc/pegImplied (on-peg 1.0000→0% !off; 0.99 hi 1.0001 lo 0.98→dev −1%, max 2%, off;
  null/zero→null; median of 3 with a null skipped → 1/1.02; <2 valid → null). Playwright + Chrome, ticker calls mocked
  (incl. one 400 → "no data yet" row): 1280 fa / 390 fa+en, overflow 0, zero JS errors, looked at shots. py_compile.
- **Also:** the owner sent a full site review mid-run; filed it as Backlog #1 (broken images first) — next runs start there.
- **Next:** Backlog #1: broken images (onerror fallback + prune dead deepimg/postimg refs in the builders).
### 2026-11-09 · Market-order slippage from live order-book depth (/tools/#slip; new need, Backlog had nothing open)
- **Need:** traders market-buy thin altcoins with $500–5k and are surprised by the fill; nothing showed what the real book
  would cost them. #5 still waits (bear days 8/85). Not a pure calculator: it reads Binance spot depth (limit 1000) in the browser.
- **Built:** `/tools/` card (fa/ckb/en): coin + buy/sell + USDT size → best price, average fill, slippage %, slippage $, levels
  used, bid/ask spread, snapshot time; "book not deep enough, only $X fills" when 1000 levels run out; error text when no
  USDT pair. Fees excluded (stated). Bot: `bot_reality.TOOLS` entry.
- **Verified:** node tests on a synthetic book (buy 100 → 0%; buy 201 → avg 100.5, 0.5%, $1, 2 levels; sell 296 → $1;
  sell 1e6 → short, filled 688; zero/null/empty → null). Playwright + Chrome with the depth call mocked: 1280 fa / 390 fa+en,
  overflow 0, zero JS errors, looked at shots. py_compile bot_reality.
- **Next:** #5 when ≥30 bearish days; otherwise a fresh non-calculator trader need.
### 2026-11-09 · Target-price reality check (/tools/#mcap; new need, Backlog had nothing open)
- **Need:** channel/group members keep asking "can coin X reach $1?"; nobody shows them the market cap that price implies.
  #5 still waits (bear days 8/85). market.json has no supply data, so the card uses only the user's own inputs.
- **Built:** `/tools/` card (fa/ckb/en): current price + current market cap + target → derived circulating supply, market cap
  needed at target, multiple of today; states it assumes constant supply (unlocks make it worse). Bot: `bot_reality.TOOLS`.
- **Verified:** node tests (0.00001/6e9/1 → supply 6e14, need 6e14, ×100000; 2/100/4 → 50/200/×2; zero/negative/NaN → null).
  Playwright + Chrome 1280 fa / 390 fa+en, overflow 0, zero JS errors, looked at shot. py_compile bot_reality.
- **Next:** #5 when ≥30 bearish days; otherwise a fresh non-calculator trader need (tools/ now has 16 cards).
### 2026-11-09 · Address & network check before sending (/tools/#addr; new need, Backlog had nothing open)
- **Need:** Iranian/Kurdish traders move USDT between exchanges and wallets daily; a mistyped address or the wrong network
  (TRC20 vs BEP20/ERC20) loses the money for good, and nothing on the site checked it. #5 still waits (bear days 8/85).
  Confirmed last run's work: committed events.json has `reaction_stats._all` (n 10, 5 wider, p 1.0).
- **Built:** `/tools/` card (fa/ckb/en): paste an address → network (Tron / Ethereum-style, stating it cannot tell ERC20 from
  BEP20 / Bitcoin / Solana) with real checksum checks (Tron & BTC base58check via SubtleCrypto SHA-256, bech32/bech32m for
  bc1), first/last 6 characters to compare, EIP-55 mixed-case note (not verified — stated). Runs only in the browser.
  Bot: added to `bot_reality.TOOLS`.
- **Verified:** node tests on 13 known addresses (USDT-TRC20 contract, USDT-ERC20, genesis 1A1z…, 3J98…, bc1q…, bc1p…,
  USDC mint on Solana valid; one-char changes, short 0x, junk, empty rejected) → 0 fails. Playwright + Chrome 1280 fa /
  390 fa+en+ckb, overflow 0, zero JS errors, looked at shots (fixed monospace wrapping of the network line). py_compile.
- **Next:** #5 when ≥30 bearish days; otherwise a fresh trader need.
### 2026-11-09 · Baseline + significance test for "BTC reaction to economic events" (home calendar + bot; new need)
- **Need:** the home calendar showed "avg 4h range after this event type" (n=1–2) with no baseline, implying that CPI/NFP
  etc. move BTC more — an untested claim, against the guardrails. Traders plan around these releases. #5 still waits (bear 8/85).
- **Built:** `scripts/events.py` — pure `measure()` now also computes `base_range_4h` (mean 4h range of the same UTC window on
  each of the previous 14 days, one 342-candle Binance call per event, re-measures events ≤30 days old that lack it);
  `reaction_stats()` adds `avg_base_4h` per type and `_all` = wider-than-normal count, means, exact two-sided sign test
  (p only when n≥10, else "not enough events"). Home `#eventsBox` (index.html, fa/ckb/en) shows "normal for that hour" next to
  each type's average and the overall test line; bot `bot_data.sec_events` adds the same line (read-only).
- **Verified:** synthetic candles with a planted 3% event window vs 1% normal → range 3.0, base 1.0, 1h +2.0; missing hour → {};
  sign_p(1,10)=22/1024, (0,10)=(10,10)≈0.002, (5,10)=1; 12 planted events p=0.0005; n<10 → p None; empty → n 0. Playwright +
  Chrome on a /tmp/bld copy with fake data: 1280 fa / 390 fa+en+ckb, overflow 0, zero JS errors, looked at shots; bot text in
  fa/ckb/en/ar. py_compile. Real numbers appear after the next CI sync (check `reaction_stats._all` in data/events.json).
- **Next:** confirm `_all` and `base_range_4h` in committed events.json; #5 when ≥30 bearish days; otherwise a fresh need.
### 2026-11-08 · World market hours & funding clock (/tools/#sessions; new need, Backlog had nothing open)
- **Need:** Iranian/Kurdish traders constantly convert Tokyo/London/New York session times and Binance funding times
  (UTC) into local time by hand, and get DST wrong. #5 still waits (bear days 8 of 85 < 30).
- **Built:** `/tools/` card (fa/ckb/en): zone picker (Tehran default fa, Erbil/Baghdad default ckb, Istanbul, device default en),
  time now, each exchange's regular hours in that zone with open/closed now (weekdays, holidays not modelled — stated),
  next 8-hourly Binance funding (00/08/16 UTC) with countdown; refreshes every 30s. Pure `ssCalc()` via Intl time zones
  (DST-correct). Bot: added to `bot_reality.TOOLS`. Jump-to chip appears by itself.
- **Verified:** node tests: Mon 2026-11-09 12:00Z → Tehran TYO 03:30–10:00, LON 11:30–20:00 open, NY 18:00–00:30, next
  funding 16:00Z in 240 min; July (DST) LON 07:00Z, NY 13:30Z; Sunday all closed. Playwright + Chrome 1280 fa / 390 fa+en+ckb,
  overflow 0, zero JS errors, looked at shots. py_compile bot_reality.
- **Next:** #5 when ≥30 bearish days; otherwise a fresh non-calculator trader need.
### 2026-11-08 · "Jump to" chip row on /tools/ (new need, Backlog had nothing open)
- **Need:** /tools/ now holds 13 calculators; on a phone the one you want is many screens down with no way to reach it.
  #5 still waits (bear days 8 of 85 < 30).
- **Built:** `tools/index.html` — a horizontally scrolling pill row under the hero ("پرش به / بچۆ بۆ / Jump to"), generated
  from every `section.card[id]` h2 (so new cards appear by themselves, in the current language); `scroll-margin-top` so
  anchors don't hide under the header. No bot change (bot already has the Calculators section with per-card links).
- **Verified:** Playwright + Chrome 1280 fa / 390 fa+en (switched via header buttons): 13 chips, labels follow language,
  click scrolls to #pnl, overflow 0, zero JS errors, looked at shots.
- **Next:** #5 when ≥30 bearish days; otherwise a fresh non-calculator trader need.
### 2026-11-08 · Futures PnL & ROE calculator (/tools/#pnl; new need, Backlog had nothing open)
- **Need:** leveraged traders ask "at 10x, what do I make/lose if I close here?" — no tool gave $ PnL and ROE on margin
  with fees. #5 still waits (bearish days 13 of 85 < 30).
- **Built:** `/tools/` card (fa/ckb/en): side, entry, exit, leverage, margin, fee/side → position value, qty, move %, gross,
  fees, net, ROE; warning when ROE ≤ −100% (liquidated first). Pure `pnlCalc()`. Bot: added to `bot_reality.TOOLS`.
- **Verified:** in-page tests: long 100→110 10x $100 0.05% → fee 1.05, net 98.95, ROE 98.95% (hand-checked); short
  100→90 5x $200 → +100, ROE 50%; long →85 10x → −150% + warning; entry 0 / lev <1 → null. Playwright + Chrome
  1280 fa / 390 fa+en, overflow 0, zero JS errors, looked at shots. py_compile bot_reality.
- **Next:** #5 bearish split when ≥30 bearish days; otherwise a fresh trader need (not another calculator unless clearly needed).
### 2026-11-08 · Fix 390px header overflow (Backlog #1)
- **Need:** on phones 381–440px wide (most iPhones/Androids) the header's brand text pushed `.ek-tools`/`.ek-appb` 40px
  off-screen → sideways scroll on every page with the shared header.
- **Built:** `assets/chrome.css` hides the brand wordmark up to 440px (was 380px; logo stays); `chrome.py` VER 9→10 to bust caches.
- **Verified:** Playwright + Chrome measured scrollWidth−clientWidth and off-screen header elements on /, /tools/, /dashboard/,
  /track-record/, /map/, /class/ in fa+en at 390/414/430/441/480: 40px before, 0 after everywhere; screenshots 390 fa/en and
  1280 fa looked at; zero JS errors; py_compile.
- **Next:** #5 bearish split when ≥30 bearish days; otherwise a fresh trader need.
### 2026-11-08 · Break-even win-rate card (/tools/#breakeven; new need, Backlog had nothing open)
- **Need:** traders judge a setup by R:R alone and forget fees; nothing showed the win rate a stop/target pair needs to
  break even, or whether their own win rate makes the system profitable. #5 still waits (bearish days < 30).
- **Built:** `/tools/` card (fa/ckb/en): stop %, target %, fee per side %, optional win rate → net R:R, break-even win rate,
  expectancy per trade (% of size and in R), warning if negative. Pure `beCalc()` (net win t−2f, net loss s+2f). Bot: `bot_reality.TOOLS`.
- **Verified:** in-page tests: 2/4/0.1 fee, 40% → R 1.727, BE 36.67%, E +0.20%, 0.091R (hand-checked); 1/1/0 → 50%;
  fee eats target or stop 0 → error; empty win rate → no expectancy (fixed a `null>=0` bug found by the test). Playwright +
  Chrome 1280 fa / 390 fa+en, zero JS errors, looked at shots. Note: pre-existing 40px horizontal overflow at 390px from
  the header's `.ek-tools`/`.ek-appb` (chrome.py), not from this card — worth a fix.
- **Next:** fix the 390px header overflow (chrome.py `.ek-appb`); #5 bearish split when ≥30 bearish days.
### 2026-11-08 · Stop-vs-noise card (/tools/#noise; new need, Backlog had nothing open)
- **Need:** traders set stops tighter than a coin's normal hourly swing and get stopped by noise; no tool related a stop
  distance to the coin's real volatility. #5 still waits (bearish days < 30).
- **Built:** `/tools/` card (fa/ckb/en): coin (from `market.json`, 48 hourly Binance closes), stop %, holding hours →
  hourly σ of log returns, σ×√h, stop in σ units, hit chance under a driftless random walk (2×(1−Φ(k)), labelled as a
  model, not a forecast), warning when k<1. Pure `nzCalc()`/`nzPhi()`. Bot: added to `bot_reality.TOOLS`.
- **Verified:** in-page tests: alternating ±1% closes → σ 2.021% (=0.02·√(48/47)), stop 1%/1h → k 0.497, p 61.9% (hand-checked),
  4%/4h → k 1.01; Φ(0)=0.5, Φ(1.96)=0.975; <10 closes → "no data yet"; stop 0 → error. Playwright + Chrome 1280 fa / 390 fa+en,
  overflow 0, zero JS errors, looked at shots. py_compile + `sec_tools` render.
- **Next:** #5 bearish split when ≥30 bearish days; otherwise a fresh trader need.
### 2026-11-08 · Liquidation-price calculator (/tools/#liq; new need, Backlog had nothing open)
- **Need:** futures traders using leverage often do not know where they get liquidated, or set a stop that sits beyond the
  liquidation price (so the stop never protects them). No site tool showed it. #5 still waits (8 bearish of 85 days).
- **Built:** new `/tools/` card (fa/ckb/en): side, entry, leverage, maintenance-margin %, optional stop → approx. liquidation
  price, distance %, and a warning if the stop is beyond liquidation. Pure `liqCalc()` (linear USDT-M isolated, no fees:
  long E(1−1/L)/(1−MMR), short E(1+1/L)/(1+MMR); tiers/fees stated as not modelled). Bot: added to `bot_reality.TOOLS`.
- **Verified:** in-page tests: long 100/10x/0.5% → 90.452 (=90/0.995), short → 109.453 (=110/1.005), 1x long → 0, entry 0
  or lev <1 → null; stop 85 on long flagged; Playwright + Chrome 1280 fa / 390 fa+en, overflow 0, zero JS errors, looked at shots.
- **Next:** #5 bearish split when ≥30 bearish days; otherwise a fresh trader need.
### 2026-11-08 · Bot section "Calculators" linking every /tools/ card (new need, Backlog had nothing open)
- **Need:** nine trader calculators shipped on `/tools/` in the last runs, but the bot had no way to reach them (owner's
  mirror rule). #5 still waits (8 bearish of 85 days).
- **Built:** `bot_reality.sec_tools` (key `tools`, in the Analysis & tools group after Coin analysis; labels fa/ckb/kmr/ar/en
  in `bot_menu.S`): one line per calculator with its `/tools/#<id>` deep link (fa/ckb/en) and the not-financial-advice line.
  Links only, no numbers. Assistant index maps `/tools/` to the new key too.
- **Verified:** py_compile; every listed id asserted to exist as a `<section id>` in `tools/index.html`; rendered in all 5
  bot languages (9 links each); `import refbot` sees the key; `build_assistant.py` runs. Bot text only, so no screenshots.
- **Next:** #5 bearish split when ≥30 bearish days; otherwise a fresh trader need. When a new /tools/ card is added, add it to `bot_reality.TOOLS`.
### 2026-11-08 · Take-profit ladder calculator (/tools/#ladder; new need, Backlog had nothing open)
- **Need:** traders who close in 2–3 targets (common in the channel's setups) could not see their real average exit, total
  profit, true R:R, or what happens if the stop hits after TP1; the risk calculator only takes one target.
- **Built:** new `/tools/` card (fa/ckb/en): side, size, entry, stop, up to 3 targets with % closed each → loss at stop,
  profit if all hit, average exit, real R:R, result if stopped after TP1, % left open. Pure `tpCalc()`; validates sides
  and Σ% ≤ 100. Fees/funding excluded (stated). No bot change (bot has no calculators).
- **Verified:** node tests on `tpCalc` (long 100/95, 1000$, 105×50/110×30/120×20 → risk 50, profit 95, avg 109.5, R 1.9,
  after-TP1 0 — hand-checked; short 100→90 R 2; stop/target on wrong side, Σ>100, no levels → null; 40% filled → left 60,
  after-TP1 +10); Playwright + Chrome 1280/390 fa/en: same numbers, overflow 0, zero JS errors, looked at shots.
- **Next:** #5 bearish split when ≥30 bearish days; otherwise a fresh trader need (the bot could get a link list to /tools/ cards).
### 2026-11-08 · Loss-recovery calculator (/tools/#recovery; new need, Backlog had nothing open)
- **Need:** traders after a drawdown underestimate the gain needed to get back (−50% needs +100%); no tool showed it.
  #5 still waits (8 bearish of 85 days).
- **Built:** new `/tools/` card (fa/ckb/en): loss % → gain needed; optional user-entered monthly gain → months needed
  (labelled as the user's assumption, not a forecast); reference row for −10/20/30/50/75/90%. Pure `recCalc()`.
  Ids are `rc*` (first try reused `#rOut`, which belongs to the risk calculator — caught in the screenshot). No bot change.
- **Verified:** in-page tests of `recCalc` (50→100, 0→0, 20%@10%/mo→2.34 months, 100 and −1 → null; 30%→42.86 and
  7.3 months at 5% hand-checked: ln(1.4286)/ln(1.05)=7.31); Playwright + Chrome 1280/390 fa/en: overflow 0, zero JS
  errors, looked at shots.
- **Next:** #5 bearish split when ≥30 bearish days; otherwise a fresh trader need.
### 2026-11-08 · Average-entry calculator for scaled-in buys (/tools/#average; new need, Backlog had nothing open)
- **Need:** traders who buy in steps / average down did not know their true average entry, break-even and P/L; no tool did it.
- **Built:** new `/tools/` card (fa/ckb/en): up to 4 buys (price, $ amount), optional fee per buy, current price → total
  invested, units, average entry incl. fees, P/L ($ and %), move to break-even. Pure `avgCalc()`; warning line that averaging
  down does not reduce risk + not-financial-advice. No bot change (the bot has no calculators).
- **Verified:** node tests on `avgCalc` (100/$500 + 80/$500 → 11.25 units, avg 88.889, P/L +$12.5 at 90; single buy at
  current = 0; 1% fee → avg 101.01, P/L −$10; invalid rows → null; no current price → P/L null); Playwright + Chrome
  1280/390 fa/en: same numbers shown, overflow 0, zero JS errors, looked at shots.
- **Next:** #5 bearish split when ≥30 bearish days; otherwise a fresh trader need.
### 2026-11-08 · Funding-cost calculator for held futures (/tools/#funding; new need, Backlog had nothing open)
- **Need:** traders hold perpetual positions for days without knowing funding (paid every 8h) can eat a large share of
  their margin with leverage; the fee-aware size calculator says "funding not included". #5 still waits (8 bearish of 85 days).
- **Built:** new `/tools/` card (fa/ckb/en): size, side, funding %/8h, days, leverage → payments, total funding (signed:
  negative = received), per day, % of size, % of margin, annualised. Coin picker fills the current rate from
  `data/derivatives.json` (OKX, time shown; "no data yet" if missing). Pure `fundCalc()`. No bot change (bot has no calculators).
- **Verified:** node tests on `fundCalc` (1000/0.01%/30d → 90 payments, $9, 0.9%, ann 10.95%; short sign flips; 10x margin
  −9%; negative rate; 0 days; 8h boundary); Playwright + Chrome 1280/390 fa/en: overflow 0, zero JS errors, looked at shots.
- **Next:** #5 bearish split when ≥30 bearish days; otherwise a fresh trader need.
### 2026-11-08 · Exchange fees in the position-size calculator (new need; Backlog had nothing open)
- **Need:** `/tools/#risk` ignored fees, so with leverage the real loss at the stop was larger than the chosen risk and the
  shown R:R/break-even were too rosy. #5's bearish split still waits (8 bearish of 85 days).
- **Built:** optional "fee per side (%)" input (empty = 0, old behaviour unchanged) in fa/ckb/en; position is sized so the
  loss *including* open+close fees equals the risk; new "fees if stopped" cell; profit, R:R and break-even are net of
  fees; warning when fees eat the whole target. Pure `riskCalc()` function. No bot change (the bot has no calculator).
- **Verified:** node unit tests on `riskCalc` (fee 0 = old numbers, loss incl. fees = risk for long and short, liquidation
  110 for 10x short, fee-kills-profit case); hand-check 1000/1%/100/95/110/0.1% → size $192.49, net profit $18.85
  = shown; Playwright + Chrome 1280/390 fa/en: overflow 0, zero JS errors, looked at shots.
- **Next:** #5 bearish split when ≥30 bearish days; otherwise a fresh trader need (e.g. funding cost for held futures).
### 2026-11-08 · "Your list from the bot" on the site (Backlog #6, slice B — #6 done)
- **Need:** the bot's watchlist screen linked `entekhab.net/news/`, a page that does not exist, and coins seen in the bot
  could not get back into the site's ⭐ list (`ek_watch`, used by the home news "My list" filter).
- **Built:** `assets/wimport.js` (loaded by `index.html`): `/?w=BTC,ETH` shows a fa/ckb/en card listing only coins not
  already saved; nothing is stored until "Save to this browser" (merge, dedupe, max 20), then the URL is cleaned and the
  page reloads at `#newsBox`. Bot `bot_wlink.site_link()` now links `https://entekhab.net/?w=…#newsBox`.
- **Verified:** py_compile + `bot_wlink` self-test (link asserted); node tests of `EKW.parse/merge` (junk, dupes, case,
  `<script>`, >20 cap, merge order); Playwright + Chrome 1280/390 fa/en: card shows ETH·SOL when BTC already saved,
  save → `["BTC","ETH","SOL"]`, URL cleaned, overflow 0, zero JS errors, looked at shots.
- **Next:** #5 bearish split when ≥30 bearish days; otherwise pick a fresh trader need.

### 2026-11-08 · "Send my list to the bot" (Backlog #6, slice A)
- **Need:** coins starred on the site were invisible in the bot; traders re-typed them.
- **Built:** on coin pages, next to the ⭐ button, a pill (fa/ckb/en by page lang) opening
  `t.me/Kurd_kurdistan_bot?start=w_BTC-ETH-…` (≤64 chars; longer lists cut with a visible "first N only" note).
  `refbot` `/start w_…` → `bot_wlink.screen`: price + 24h change per coin from data/market.json, "no data yet" for unknown
  coins, data time, site link, not-financial-advice line. Read-only: nothing stored, nothing posted.
- **Verified:** py_compile; `bot_wlink` self-test (empty/junk/dupes/lower-case/>64 chars, rendered values vs input);
  built pages in /tmp/bld; Playwright + Chrome 1280/390: link = `w_BTC-ETH-SOL`, 20-symbol list → 61-char payload with
  "first 10" note, overflow 0, zero JS errors, looked at shots. Bot not live-tested (Telegram unreachable).
- **Next:** #6 slice B (bot→site `?w=` with explicit save), or #5 bearish split when ≥30 bearish days.

### 2026-11-08 · Design for site ↔ bot watchlist hand-off (Backlog #6, design slice)
- **Need:** a trader stars coins on the site, then has to re-type them in the bot; the two halves of the product don't
  know each other. #5's bearish split still waits (8 bearish days of 85).
- **Built:** no code — a concrete two-slice design in Backlog #6 (deep link `?start=w_…` with user confirmation in the bot;
  `?w=` back to the site with an explicit save), grounded in the existing `ek_watch` storage and `s_` deep-link router.
- **Verified:** read `build_pages.WATCH_JS`, `assets/news.js`, `refbot.py` deep-link handler and `bot_watch.py`; checked
  Telegram's 64-char `start` limit is the binding constraint. Docs-only commit, so no build or screenshots.
- **Next:** build #6 slice A (site pill + bot `w_` handler with tests).

### 2026-11-08 · Direction study shows the "always bullish" baseline (Backlog #5, small slice)
- **Need:** with 77 of 85 days labelled bullish, a 56.5% hit rate means little unless the reader sees that simply saying
  "bullish" every day scored the same; the shuffle baseline alone hides that.
- **Built:** `/track-record/` direction section: second card "If every day had simply said bullish" (`up_rate` from
  direction.json) and, while bearish days < 30, a fa/ckb/en note that the test mostly measures bullish days.
- **Verified:** py_compile; built in /tmp/bld; up_rate hand-recomputed from `days` (85 days, r24>0 → 56.5%) = shown;
  Playwright + Chrome 1280/390 fa/en: overflow 0, zero JS errors, looked at shots.
- **Next:** #6 design, or #5 bearish split when ≥30 bearish days (8 now).

### 2026-11-08 · /tools/#streaks — losing-streak & drawdown simulator (new need, ahead of #6)
- **Need:** traders quit working methods after a normal run of losses, or size too big for the streaks to come; the
  position-size calculator says what one loss costs, nothing said what 100 trades can do. (#5 still waits: 8 bearish days.)
- **Built:** new card on `/tools/` (fa/ckb/en): win rate, win size in R, risk %, trades → 5,000 seeded Monte Carlo paths
  (fixed-fraction compounding, no fees): expectancy, break-even win rate, median / worst-5% capital change, share of losing
  paths, longest losing streak and max drawdown (median · 95th pct), P(DD ≥ 20%/50%). Inputs only — no market numbers.
  Bot: `/tools/` link already exists, no new section.
- **Verified:** node unit tests (always-win/always-lose exact values, zero expectancy, p=.5 N=100 median streak 6 and p95 9
  as theory, single-trade loss share .600, determinism); default case hand-checked (exp +0.35 R, median e^{100·E ln}=+40.3%);
  Playwright + Chrome 1280/390 fa/en: overflow 0, zero JS errors, looked at shots.
- **Next:** #6 design, or #5 bearish split when ≥30 bearish days.

### 2026-11-08 · Bot's "today" section links the recorded past days (Backlog #2, finished)
- **Need:** bot users had no way to reach `/today/days/`, the frozen daily record.
- **Built:** `bot_reality.past_days()` counts dated keys in `data/today_days.json`; `sec_today` adds
  "📅 Past days (N recorded): …/today/days/" (fa/ckb/en) only when N ≥ 2, so it appears by itself tomorrow (1 day now).
- **Verified:** py_compile; unit tests (None/{}/1 day → hidden, 2 days + junk key → 2); rendered fa/ckb/en with 1 and
  2 days. Bot text only, no site UI change, so no screenshots.
- **Next:** #6 design (site ↔ bot identity), or #5 bearish split when ≥30 bearish days.

### 2026-11-08 · /today/ now keeps a recorded copy of every day (Backlog #2)
- **Need:** the daily spine vanished every 24 h; traders (and the strategy's "measured honesty") need to look back at what
  the page said on a given day, frozen, not rebuilt with hindsight.
- **Built:** `build_today.py --snapshot` (new CI step right before "Commit data") stores the page's inputs — only the fields
  it renders — under the UTC date in `data/today_days.json`, overwritten each run so the day's last run stays. The builder
  renders `/today/<YYYY-MM-DD>/` (prev/next links, "snapshot taken at … covers the 24 h before it", no class countdown)
  and the hub `/today/days/`; `/today/` links to it. Recording starts today; no earlier day is reconstructed.
- **Verified:** py_compile; YAML parses; in /tmp/bld: snapshot of the live inputs equals them (post ids, finding count),
  same-day overwrite keeps one entry with the later time; built 3 days + hub; Playwright + Chrome 1280/390 fa/en on day page,
  hub and live page: overflow 0, zero JS errors, looked at shots. ~8 KB per day.
- **Next:** after the next sync run confirm `data/today_days.json` is committed; then a bot link, or #6 design.

### 2026-11-08 · The markets library in the home-page archive (asked for by the owner)
The owner asked for a library of films, documentaries, books, tools, free courses and lives,
inside the existing archive on the home page, in all three languages. `#library` in `index.html`
renders it from `data/library.json`; the entries live in `scripts/libdata/*.py` and are rebuilt by
`scripts/libdata/build.py`, which refuses to write an entry that is missing a language, has a bad
level, a non-https link or the wrong digit set. 62 entries; every fact was checked against the page
in its `url` before it was written, and four entries carry no link because no page could be verified.
Covers are drawn in CSS — never copy a poster or a book cover. Every entry carries its caveat in
`note` (dramatised, dated, ideological, exchange-owned, broker-dependent, self-reported data).
Mirrored in the nav (`chrome.py`, under Archive), the assistant index and the bot
(`bot_learn.library_screen`, five languages). Note for later: the home page's own click handler opens
a post for any `[data-id]`, so the library cards use `data-lib`.


### 2026-11-08 · Stance labels: a greeting line is no longer evidence of a direction (Backlog #5)
- **Need:** the directional study is only as honest as its labels; a bullish/bearish label whose verbatim "evidence" is
  just "با سلام…" proves nothing.
- **Built:** `stance.py` `greeting_line`/`weak_quote`: a non-neutral label is rejected when its quote lies only inside the
  post's first line and that line is a greeting (fa/ckb/en list `GREET`); `drop_weak` removes such stored labels each run
  so they are relabelled; the prompt now says not to quote the greeting.
- **Verified:** py_compile; unit tests (greeting-only quote rejected for bullish/bearish, kept for neutral; Sorani greeting
  after a blank line; "سلام" mid-line not treated as greeting; quote repeated in body kept; empty text; drop_weak removes
  only the weak label and its tries). On the live 555 labels: 0 weak directional labels — a guard, results unchanged.
- **Data now:** direction.json 71 days (65 bullish / 6 bearish), 50.7% vs 52.9% expected, p 0.87.
- **Next:** bearish-split waits for ≥30 bearish days; consider #6 design or #2 snapshots.

### 2026-11-08 · Directional study, slice 2: "was the direction right?" on /track-record/ + bot (Backlog #5)
- **Need:** traders ask whether the channel's bullish/bearish calls were right, not just how price moved after posts.
- **Built:** `scripts/direction.py` → `data/direction.json` (CI step after stance). Unit = UTC day (posts of one day share
  one 24 h window): day stance = sign(#bull−#bear) of BTC posts with complete r24h, outcome = mean r24h; hit = sign match.
  Baseline = day stances shuffled across the same days (20 000 draws, seed 20261108), one-sided add-one p; no verdict
  below 30 days. New trilingual section on `/track-record/` (with not-financial-advice line, links to both JSONs) and one
  line in the bot's track-record section (only when ≥30 days).
- **Result on current data:** 38 days (34 bullish, 4 bearish), 50.0% right vs 50.0% expected, p ≈ 0.70 → not better
  than chance. Published as is.
- **Verified:** py_compile; unit tests (null skill → p 0.76; planted 90% skill → p 0.0002; hand-checked 2-day case incl.
  tie day, neutral and ETH exclusion; empty input); built in /tmp/bld; Playwright + Chrome 1280/390 fa/en: section
  found, overflow 0, zero JS errors, looked at shots; bot rendered fa/ckb/en.
- **Next:** confirm `data/direction.json` is committed by the next sync run.

### 2026-11-08 · The sync chain no longer dies when a commit lands (found while checking Backlog #5)
- **Need:** prices, ledger, stance labels etc. must stay fresh. `data/stance.json` had not changed for an hour: the last
  sync run was 00:33 UTC. Cause: a push queues a sync run that *replaces* the chain's pending dispatched run (GitHub keeps
  one pending run per concurrency group), and push runs never chained — so every code push ended the chain until the
  unreliable cron revived it.
- **Built:** `update.yml` "Start next run" now also runs on push, but only when no other sync run is queued/running
  (`gh run list --json … | length`), so a burst of pushes still gives one chain.
- **Verified:** YAML parses; the jq filter run here against the live run list returns 0 as expected. The push of this
  commit is itself the live test: its run must end by dispatching a new "Sync Telegram → Site" run.
- **#5 check:** stance.json has 46 labels (bullish 12 / bearish 14 / neutral 20, gemini-3.5-flash-lite); read all 46
  headlines-as-quotes — stances plausible; a few quotes are greetings ("با سلام…") which pass the verbatim check but are
  weak evidence; consider requiring the quote to be outside the first greeting line.
- **Next:** confirm the chain ran on after this push; once ≥100 labels, build the hit-rate study (#5).

### 2026-11-08 · Directional study, slice 1: quote-verified stance labels in CI (Backlog #5)
- **Need:** the channel's record says how posts moved price, not whether the channel's *direction* was right — the
  honest question traders ask. Needs a stance per post first.
- **Built:** `scripts/stance.py` (Gemini via `ai.py`, batches of 8, ≤48 posts and ≤240 s per run, newest first); a label
  is kept only if its evidence quote appears verbatim in the post (ZWNJ/space/Arabic-letter normalised), else retried up
  to 3 times; writes `data/stance.json` (labels, tries, counts, model). New `update.yml` step with continue-on-error.
  No page or bot section yet — nothing to show until ≥100 labels and a tested baseline.
- **Verified:** py_compile; YAML parses; unit test on synthetic posts (normalised quote accepted, invented quote / bad
  stance / unknown id / too-short quote rejected, coin cleaned, todo skips labelled and exhausted posts). Live labelling
  only runnable in CI — next run must check `data/stance.json`.
- **Next:** verify stance.json after a sync run; spot-check labels; then the hit-rate study slice.

### 2026-11-07 · `/class/` — the nightly class page, from the channel's own posts (Backlog #3 slice 2; closed #7)
- **Need:** newcomers had no single place saying when/where the nightly class is and how to join.
- **Built:** `scripts/class_facts.py` (invite, schedule quote, announcement count, posts referring back to the class —
  all extracted from `data/posts.json`); `scripts/build_class.py` → `/class/` (fa/ckb/en, live countdown + viewer's local
  time, join button, quoted announcement with source link, not-financial-advice line); nav entry (`chrome.py`), assistant
  KB, `update.yml` + `pages.yml`; bot section `class` (`bot_reality.sec_class`, `bot_menu` label, in `g_news`).
- **#7 closed:** videos feed is not broken — `VIDEOS_PER_DAY` defaults to 0 because the owner turned auto-videos off, and
  no page reads `data/videos.json`. No action.
- **Verified:** py_compile; unit test of `class_facts` on synthetic posts (newest invite wins, counts, mention filter,
  empty input); built in /tmp/bld; Playwright + Chrome 1280 fa/en, 390 fa/ckb: overflow 0, zero JS errors, looked at shots;
  bot section rendered in fa/ckb/en/kmr (countdown 16:00 UTC → 30 min, correct).
- **Next:** #5 (directional study with Gemini in CI) — first slice: labelling script + data/stance.json, no page yet.

### 2026-11-07 · Home page no longer wobbles sideways on phones (Backlog #8)
- **Need:** on 390 px phones the home page was 1 px wider than the screen, so it slid sideways under the thumb.
- **Cause:** the header row's contents (brand + search + language pill + app button, with 8 px gaps) summed to 1 px over
  the width; hiding any one item fixed it (found by toggling each element and re-measuring `scrollWidth`).
- **Built:** one rule in `assets/chrome.css` `@media (max-width:640px)`: header gap 8→6 px, tools gap 6→5 px.
  (Tried letting the brand shrink first — it truncated the wordmark to "entekhab.…", rejected.)
- **Verified:** Playwright + Chrome, home at 360/375/390 px in fa, en, ckb: overflow 0 (baseline on main: 1); 1280 px fa
  unchanged; zero JS errors; looked at the shots. No bot change (CSS only).
- **Next:** Backlog #7 (stale videos feed) — concrete and checkable from CI logs; then #3 from post facts.

### 2026-11-07 · `/kids/` replaced by the open "Bitcoin for Juniors" curriculum (asked for by the owner)
The owner judged the home-made kids academy "very weak" and asked for My First Bitcoin's Bitcoin for Juniors in its place,
complete and accurate in three languages. Done as: English imported verbatim (release 26.10, commit 4ad423b, CC BY-SA 4.0)
with nine asserted formatting repairs in six files; Persian and Sorani translated by AI (all 33 files each), compared block-by-block
with the English by `b4j_check.py`, then reviewed by independent AI reviewers (Sorani also got a separate language audit).
No human has reviewed the translations — the About page says so. Not included: the printable appendices A/B/C and the PDF
(they are not in the open repository). The old worlds/games/films/songs/studio pages and their scripts were removed (git
history keeps them). Mirrored in the nav/footer (`chrome.py`), assistant index, bot (`bot_learn.kids_screen`) and the
hourly rebuild. Do not "improve" the lessons here; improve the pages around them (navigation, print, accessibility) and
keep the checks green.

### 2026-11-07 · Accountability inline on every post page (Backlog #4)
- **Need:** the tested record lived on a side page; a reader deciding on a post never saw how that kind of post has fared.
- **Built:** `build_pages.cat_line(cat, lg)` — one line on `/p/<id>/` (fa) and `/en|ckb/p/<id>/`, under the impact box:
  the post category's row from `data/trackrecord.json` (n, BTC 24h mean vs all-hours base, randomisation p, verdict
  "significant" only if p < 0.05), "too few to test" for small categories, "no test yet" when missing; links to
  `/track-record/`. Skipped for low-quality (promo) posts. Class `catrec`. No bot change (post pages have no bot home).
- **Verified:** py_compile; unit tests on synthetic record (significant case, small case, non-significant, missing
  category, empty file); full `build_pages.py` in /tmp/bld; Playwright + Chrome at 1280/390 on fa and en post pages,
  looked at the shots, zero JS errors. Chose this over #3 because #3 needs facts (books, syllabus) the repo doesn't hold.
- **Next:** Backlog #3 only from facts in the posts archive; else #5 or #7 (stale videos feed).

### 2026-11-07 · Nightly class strip on the home page (Backlog #3, slice 1)
- **Need:** the human moat was invisible — nothing on the home page said there is a live class every night.
- **Built:** `#classStrip` (class `clsS`) under the `/today/` card in `index.html`: "Tonight's live class — 20:00 Tehran
  on Discord" with a live countdown (same UTC 16:30 rule as `/today/`), linking to the channel's existing Discord invite.
  I18N keys `hClass`, `hClassIn`, `hClassGo`, `hClsH`, `hClsM` in fa/ckb/en; countdown re-renders on language switch.
  Bot already shows the countdown in `sec_today`, so no bot change.
- **Verified:** served the repo, Playwright + Chrome at 1280 (fa) and 390 (en, ckb); countdown read 19 h 56 min at 20:34
  UTC (= 16:30 next day, correct); zero JS errors after fixing an apostrophe that broke the I18N string. Looked at the shots.
- **Next:** `/class/` page (Backlog #3 remainder), or Backlog #4.

### 2026-11-07 · `/today/` card on the home page (Backlog #2, slice 3)
- **Need:** the spine had no front door — the home page opened on thirty tiles with no "start here".
- **Built:** a full-width orange-bordered card at the top of the command center (`#todayCard`, class `todayC`, outside
  the draggable `.ccT` tiles) linking to `/today/`; text in fa/ckb/en via `I18N` keys `hToday`/`hTodayd`. Static
  index.html edit; `prerender()` untouched.
- **Verified:** served the repo, Playwright + Chrome at 1280/390 in fa and en, looked at the screenshots (RTL arrow
  correct, mirrored in LTR), card text switches language, zero JS errors. No numbers, so no unit tests.
- **Next:** Backlog #3 (nightly class strip + `/class/`).

### 2026-11-07 · `/today/` in the Telegram bot (Backlog #2, slice 2)
- **Need:** the owner's rule — every site feature mirrored in the bot; `/today/` had no bot home.
- **Built:** `bot_reality.sec_today` (key `today`, first item of the News group, labels in fa/ckb/kmr/ar/en in `bot_menu.S`):
  BTC 24h, fear & greed, breadth, top movers, Iran friction + USDT in toman, counts of scanner findings and channel posts
  in the last 24h, countdown to the 20:00 Tehran class; same data files as the page, "no data yet" when empty. Kept out
  of `summary()` (that list is the reality readings). Assistant index maps `/today/` to the new key.
- **Verified:** py_compile; unit tests for `class_wait` (30 min before, exactly at → 1440, after → 1410) and `count_recent`
  (exclusive/inclusive bounds, bad/missing timestamps, future item); rendered fa/ckb/en from real data; `import refbot` ok.
  No site UI changed, so no screenshots.
- **Next:** home-page card for `/today/`, or Backlog #3.

### 2026-11-07 · `/today/` — the daily spine, slice 1 (Backlog #2)
- **Need:** thirty tools and no starting point; a trader opening the site wants "what happened in the last 24h" in one place.
- **Built:** `scripts/build_today.py` → `/today/` (fa/ckb/en): BTC 24h, fear & greed, breadth and biggest movers from
  `brain.json` (+ the machine summary, collapsed, with its time); Iran friction score, USDT in toman and the BTC gap from
  `friction.json`; scanner findings of the last 24h each with its pattern's tested verdict from `scanaudit.json`; channel
  posts of the last 24h; nightly class 20:00 Tehran with a live countdown. Missing data → "no data yet". Menu entry
  (markets group, before Daily report), assistant index, sitemap, `update.yml` + `pages.yml`. Archive: links to `/daily/`.
- **Verified:** py_compile; `recent()` unit test (window boundaries exclusive/inclusive, bad/missing timestamps, order);
  built on a scratch copy with real data; screenshots fa/en at 1280/390, zero JS errors.
- **Next:** finish `/today/` (home card, bot section) or Backlog #3.

### 2026-11-07 · Scanner audit, part 2 — real result published (Backlog #1)
- **Real result (CI, 16:24 UTC, 196 coins, 5,258 findings, 2026-09-27 → 2026-11-06):** all findings together +0.01% vs
  0.00% at other hours (p = 0.96, no edge). Nominally "better": RSI bearish divergence (+2.20% vs +0.53%, p = 0.018) and
  RSI oversold (+0.70% vs −0.62%, p = 0.021); the other 7 show no edge; none "worse". With 9 tests ~0.45 false positives
  are expected and **none survives Bonferroni (p < 0.0056)** — so the two "better" results are weak evidence.
- **Built:** `/track-record/#scanner` table (fa/ckb/en, sorted by p, verdict chips, Bonferroni line computed by
  `build_trackrecord.bonf()`); the home dashboard's client-side scanner list now shows each finding's tested line
  (after vs other hours, p, n, verdict; "under review" if worse) instead of the raw win %, linking to the table;
  `/methodology/` gained a "scanner pattern test" section. Note: the old backlog said `/opportunity/` — that page is the
  toman opportunity-cost calculator, not the scanner, so the table went to /track-record/. Bot already mirrors (part 1).
- **Verified:** py_compile; `bonf` unit test (empty → 0; 2 tested + 1 too_few + _all → m=2, t=0.025, 1 survives; real
  data → 9, 0); built track-record + pages on a scratch copy with the real audit; screenshots 1280/390 fa/en, zero JS errors.
- **Next:** Backlog #1 — `/today/`.

### 2026-11-07 · `/map/` — the learning map (asked for by the owner)
Modelled on learn-anything.xyz: a force-directed graph of 33 topics (13 faculties + their 20 published courses) on
`/map/`, and under each faculty a `/map/<fid>/` checklist of 411 things you can actually do right now — the academy's
own lessons, the 195 outside sources those lessons cite, the matching glossary terms, the lab tools and the learning
path. Ticking is kept in `localStorage.ck_map` and shared by every page, so the hub's cards and the graph nodes show
each topic's progress ring. Trilingual throughout: `map_data.py` adds the Kurdish titles the academy lacks (13
faculties, 20 courses, 65 lessons, 13 summaries) and the page follows the site's active language. Every internal link
is verified against the built tree at build time; `/track-record/` was caught missing this way, which is why the build
step sits after `build_trackrecord.py`. `data/map.json` ships with the site as open data (git-ignored, never committed, so it cannot go stale). Mirrored into the bot (`bot_learn.map_screen`, callback `lm:`, a button in
both the Learn menu and the academy screen, titles in all five bot languages, from the academy data the bot already reads), the header and
bottom nav (`chrome.py`), the home page, the assistant index and the sitemap.
Also on the home page: `.msg` was overriding `.wrap`'s horizontal padding, which pushed the text and the stats block
against the right edge (20px gap instead of 68px), and the Latin display/mono faces were being applied to Persian
(section headings at 86px, broken letter joining in the counters and buttons). Both fixed under `[dir=rtl]`; English
is untouched.

### 2026-11-07 · Scanner audit, part 1 — each pattern tested against other hours (Backlog #1)
- **Need:** the scanner's raw win rates ("RSI overbought wins 70%") mean nothing without a baseline — in a falling market
  every bearish finding "wins" — and some patterns looked worse than chance. Traders see these findings on coin pages
  and in the bot with no warning.
- **Built:** `scripts/scanaudit.py` (CI step after scanlog): for every finding in `scanlog.json`, the 24h move in the
  signal's direction from the next full-hour open; baseline = all findings of a pattern shifted together by every k hours
  (circular, exact test over all shifts — keeps the cross-coin clustering); two-sided p around the shifts' median;
  verdict better / worse ("under review") / no_edge / too_few (n<30) at p<0.05. Writes `data/scanaudit.json`.
  Coin pages show the tested line instead of the raw win % when a verdict exists; the bot marks "under review" under
  each finding in Opportunities and lists every pattern's test in the Track section (fa/ckb/en). Nothing hidden.
- **Verified:** py_compile; unit tests on synthetic random walks — null findings significant 0/10 seeds, planted +4%
  move caught (bull "better" p=0.0012, its bear mirror "worse" p=0.0012), one move hand-checked (+21.82%); coin pages and
  bot sections rendered on a scratch copy with fake audit data; screenshots 1280/390, zero JS errors. Real figures come
  from the next CI run — not yet seen.
- **Next:** Backlog #1 — read the real audit, then the `/opportunity/` table.

### 2026-11-07 · Public `/autopilot/` log page (Backlog #1)
- **Need:** the loop changes the site every hour; readers (and the owner) had no way to see what changed and why on the
  site itself — accountability for the site's own changes, matching the "measured honesty" strategy.
- **Built:** `scripts/build_autopilot.py` parses this file's Log and renders `/autopilot/` (fa/ckb/en frame, entries in
  English, `**bold**`/`code` only, everything escaped) with links to AUTOPILOT.md's git history and a search of
  `autopilot:` commits; footer link "Autopilot log" next to Methodology (`chrome.py`); builder added to `update.yml`
  and `pages.yml`; sitemap entry. No bot entry: it is a meta page with no natural home in the bot.
- **Verified:** py_compile; parser unit test on synthetic markdown (continuation lines, missing title, section end,
  empty input, HTML escaping); built on a scratch copy; screenshots fa/en at 1280/390, zero JS errors.
- **Next:** Backlog #1 — scanner audit.

### 2026-11-07 · One honest number everywhere (Backlog #1)
- **Need:** coin pages, the home/dashboard "post track record" box and the Entekhab Score still used the raw average
  24h move after posts (no baseline) — in a drifting market that flatters the channel.
- **Built:** `score.py` `channel_component()` — the Score's channel part is 50 (neutral) unless the tested record
  (`data/trackrecord.json`, post hours vs matched random hours) has p < 0.05; then 50 + 8 × (post avg − random avg).
  `build_pages.py` `tested_line()` replaces the raw sentence on every coin page and the server-rendered dashboard box;
  the home page's client-side box (`index.html`, fa/ckb/en) now loads `trackrecord.json` and shows post vs random-hour
  BTC move, p and the verdict, linking to /track-record/. `/methodology/` wording updated.
- **Verified:** unit tests on synthetic inputs (empty → 50; real p=0.28 → 50; p=0.01, +1.3 gap → 60.4; clamp at 0;
  p=0.05 boundary → 50); score + page builders run on a scratch copy (BTC/ETH channel = 50.0); screenshots home fa/en and
  BTC coin page at 1280/390, zero JS errors. Bot "track" section already quotes the tested figure (previous run).
- **Next:** Backlog #1 — public `/autopilot/` log page.

### 2026-11-07 · `/track-record/` — the channel's real record
- **Need:** every reader's first question — "does following this channel help?" — had only a misleading answer: the raw
  average 24h move after posts (+0.53%, 58% up over 524 posts) with no comparison. In the same window bitcoin's average
  day was −0.04% (48% up), so the number needed a real test.
- **Built:** `scripts/trackrecord.py` (CI, Binance 1h): entry at the open of the first full hour after each post, 24h
  hold; the same measures for every hour of the window; posts in one hour count once; matched-cluster randomisation
  (each post-day → a random day with the same number of random hours), 10,000 draws, seed 20031222; also the 4h move
  before the post (reaction) and the 24h range (eventfulness), per category, a histogram and a day-cluster bootstrap CI.
  `scripts/build_trackrecord.py` renders `/track-record/` (fa/ckb/en) with a verdict chosen only by p < 0.05.
- **Mirrored:** menu (reality group), site assistant, first card on `/reality/`, Telegram bot section `trackrec` in the
  reality group; the bot's existing "track" section now quotes the tested number instead of the raw average.
- **Verified:** unit tests — null data never significant (0/10 seeds), planted +1.5% effect caught (p=0.0005), a
  "post after the move" pattern flagged as reaction and not as foresight, duplicates counted once, windows across data
  gaps skipped, one window checked by hand; full study runs in ~3.5 s; page screenshots desktop/mobile, fa/en, no JS
  errors. Real figures produced by CI (run 42372862451, 12:36 UTC) and the live page checked in a browser.
- **Result (real data, 2026-08-04 → 2026-11-06):** 508 posts in 259 distinct hours over 88 days. Bitcoin 24h after posts
  **+0.43%** vs **+0.20%** at matched random hours (95% of random results between −0.19% and +0.64%), **p = 0.29 — not
  significant**. Share of gaining windows 56.4% vs 52.9% (p = 0.47). No sign of posting after moves (4h before: −0.02%
  vs +0.04%, p = 0.32); volatility after posts like any hour (3.07% vs 2.84%, p = 0.22). No category significant.
  Note: a quick estimate earlier the same day (posts +0.53% vs a daily-close baseline of −0.04%) overstated the gap —
  it used a shorter window and daily closes. This result supersedes it.
- **Next:** Backlog #1 — use these figures everywhere the raw average is still shown.

### 2026-11-12 · Arabic (MSA) as a fourth language (asked for by the owner)
- **Scope (owner's choice):** the whole site except the encyclopedia (stays fa/ckb/en); posts from the last 30 days and
  every new one get real Arabic pages; older posts are not translated. Modern Standard Arabic, everything at once.
- **How:** `scripts/i18n_ar.py` (CI, after all builds) extracts the English of every page and of the JS string tables,
  translates only new strings (capped per run) into `data/i18n_ar.json`, writes dictionaries to `i18n/ar/` and adds
  `assets/ar.js` to every page; `ar.js` overlays Arabic on the English page (RTL, numbers/dates kept, later text via
  MutationObserver). Posts: `translate.py` arabic pass (30/run) → `tr.ar` → `/ar/p/<id>/` by `build_pages.py`.
- **Gate:** the «ع» button stays hidden until `data/ar_on` exists, so the cache fills before visitors see it
  (`localStorage.ek_ar_test=1` shows it for checking). App = WebView, follows automatically; bot already has `ar`.
- **Verified locally:** home/satoshi/post desktop+mobile, switch in and out, post `/p/<id>/` → `/ar/p/<id>/`, no JS
  errors; fixed `nx.js`/`ui2.js` reading the «ع» button as Persian.
- **Next:** CI fills translations; check quality, then owner approves and `data/ar_on` is created.

### 2026-11-12 · Language order and full names everywhere (asked for by the owner)
- **Order:** کوردی · فارسی · العربية · English — Kurdish first, English last — in the header, the phone sheet, the
  site menu, the library/glossary/learn/kids switchers and the encyclopedia (which keeps its three). Bot texts listing
  languages reordered the same way (its keyboard already started with Kurdish and ended with English).
- **Header fits itself** (`ui2.js` fit): four full names are wider, so instead of fixed breakpoints the switcher becomes
  one «language» button only while the menu and the tools actually collide; scanned 1180–1940 px in fa/ckb/en/ar, no
  overlap left (before: up to 154 px in English). Arabic mode now also turns `<body dir="ltr">` to rtl.
- «العربية» stays hidden for visitors until `data/ar_on` (owner's approval).
- **2026-11-12:** owner approved → `data/ar_on` created; «العربية» is public in every switcher.
