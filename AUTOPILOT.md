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
- **No invented numbers.** Every figure shown as data is computed by code from a real source. Missing data shows
  "no data yet", never a placeholder value. Claims of an edge need a proper baseline and a stated significance test.
- **Not financial advice.** No buy/sell recommendations; keep the not-financial-advice line on finance pages.
- **No third-party adverts, logos or images** (`scripts/adpics.py` lists flagged ones).
- **No messages.** Never send Telegram messages to users, the channel or the group, and never change how the bot posts or
  broadcasts. Bot changes are limited to read-only sections and menu entries that mirror site pages.
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
- Site assistant knowledge: `scripts/assistant_kb.py` `FEATURES` (path, bot keys, extension tab) → `build_assistant.py`.
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

- `/kids/` — **Bitcoin for Juniors** (6 modules, 21 activities, ages 8-12; fa · ckb · en). Lesson text lives ONLY in
  `content/b4j/{en,fa,ckb}/**.md` (see `content/b4j/README.md`, provenance in `content/b4j/SOURCE.json`);
  `scripts/b4j_md.py` parses it and proves each translation has the English block skeleton; `scripts/build_kids.py`
  renders the pages (output is git-ignored and rebuilt by `update.yml` / `pages.yml`); `scripts/kids_check.py` checks
  the built pages; `scripts/b4j_check.py` checks the translations; `scripts/b4j_import.py` re-imports the English from a
  clone of `MyFirstBitcoin/mfb-curriculum` (run with `python3 -I`; asserted repairs; writes SOURCE.json). UI strings and the
  About page are in `build_kids.py` (`UI`, `page_about`). Bot screen: `bot_learn.kids_screen` (links only). Nav entry:
  `chrome.py` (`/kids/`). Old addresses `/kids/start|money|chain|safe|chart|studio/` are small redirect pages.

## Backlog (top = next)
- **Combined alerts in /me/ and the bot** (owner's comparison file, 2026-11-10): one alert that fires on price AND
  regime AND a scanner finding on a watched coin (e.g. "SOL scanner bullish while the confirmed regime is not bear").
- **Shared paper-trading leaderboard** (owner's priority list, 2026-11-10) — WAITING FOR THE OWNER'S CHOICE, do not
  build before: self-reported results from /me/ can be forged in the browser, so the proposed design records paper
  trades in the bot (server time, server price from Binance), opt-in, nickname only, min 10 closed trades, ranked
  after fees by return with drawdown/Sortino shown, user can delete. Owner was asked on 2026-11-10.
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
