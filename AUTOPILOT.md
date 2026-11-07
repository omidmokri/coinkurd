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
2. **One spine instead of thirty islands.** Breadth without a starting point loses newcomers; build toward a daily page
   that ties the tools together.
3. **The human is the moat.** Seven years of daily posts, two books, university workshops, a nightly class — make them visible.

## How to work (every run)

1. **Setup.** `cd /home/claude/coinkurd` (clone `https://github.com/omidmokri/coinkurd` there if missing), then
   `git fetch origin && git checkout -B autopilot origin/main`.
2. **Choose.** Take the top unfinished item of the Backlog — unless you find a clearly more valuable trader need; then add
   it to the Backlog with the reasoning and do it. `grep` first: never rebuild something that exists; improving an
   existing feature beats adding a new one.
3. **Build** inside the existing patterns (see Architecture). Trilingual (fa / ckb / en), RTL-correct, mobile-first,
   matching the design system (dark, `var(--card)`, `var(--line)`, orange `var(--acc)`, 16–18px radii, pill buttons).
4. **Test before you publish.**
   - `python3 -m py_compile` every changed script; run every builder you touched.
   - Numbers: unit-test any computation on synthetic data where the right answer is known (see `trackrecord.py` tests
     in the Log entry of 2026-11-07 for the standard: null case, planted effect, edge cases, a hand-checked value).
   - UI: serve the repo copy (`python3 -m http.server`), screenshot with Playwright + `/usr/bin/google-chrome` at
     1280px and 390px, in fa and en; **look at the screenshots**; zero JS errors.
5. **Publish.** One commit per run, message starting `autopilot:` and ending with the attribution lines the session asks
   for. `git pull --rebase origin main && git push origin HEAD:main` (re-rebase and retry up to 3 times if rejected).
   The same commit adds your entry at the top of **Log**.
6. **Check the deploy.** `gh run list -R omidmokri/coinkurd -L 6` — the "Sync Telegram → Site" run after your commit must
   succeed. If your change broke it, fix it in this run or `git revert` your commit (never force-push).
7. **Size.** Finish within ~40 minutes. If the item is bigger, ship the first useful slice and leave the rest in Backlog.

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

## Backlog (top = next)
1. **Scanner audit.** `data/scanstats.json` shows patterns that do worse than chance (e.g. "breakout" 24h win 33%,
   avg −1.42%, n≈398; a bearish "negative divergence" followed by gains 70% of the time). Test each pattern against the
   random-hour baseline with the method of `trackrecord.py`, publish per-pattern verdicts, and mark (don't hide) patterns
   that are significantly worse than random as "under review" in the scanner UI and the bot.
2. **`/today/` — the spine.** One page built every day: what moved and why (`brain.json`), Iran friction today, open
   scanner findings with their tested record, today's posts, the nightly class topic; archived by date for search.
3. **The founder and the nightly class.** A "tonight 20:00 Tehran — Discord class" strip on the home page with a
   countdown, a `/class/` page, the books; Person schema on `/about/` already exists — reuse it.
4. **Accountability inline.** On each post page: the tested record of that kind of post, one line, linking to /track-record/.
5. **Directional study.** Label each post's stance (bullish / bearish / neutral news) with the Gemini key in CI, keep the
   quoted phrase as evidence in `data/stance.json`, and publish directional hit rates against base rates once ≥100 are
   labelled. Keyword rules were tried on 2026-11-07 and are too noisy ("ETF outflow" read as bullish) — don't use them.
6. **Site ↔ bot identity** (watchlist and alerts follow the person via the bot deep link). Design first; larger.
7. **Videos feed stale since 2026-11-02** (`scripts/bot_videos.py` finds no candidates) — investigate.
8. **Owner action, not for the loop:** stray branch `ck-push-test` (left by a push test on 2026-11-07). The proxy
    cannot delete refs and the safety gate refused deleting it from the GitHub UI; the owner can delete it from the
    repository's Branches page. Harmless meanwhile (it points at a commit already on main). Do not retry.

## Log (newest first)

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
