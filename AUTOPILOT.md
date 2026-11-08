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
2. **`/today/` — per-day snapshots.** Page, bot section and home card shipped 2026-11-07. Remaining: per-day
   snapshots (`/daily/<date>/` already archives the market part). Lower value than #3.
3. **The founder and the nightly class.** Home strip (2026-11-07) and `/class/` page + bot section (2026-11-07) shipped.
   Remaining: books/workshops — **blocked on facts** (posts.json has no book titles or syllabus; don't invent them).
5. **Directional study.** Slices 1–2 shipped 2026-11-08 (`stance.py` → `stance.json`; `direction.py` → `direction.json`,
   section on `/track-record/` + bot line). Remaining: drop greeting-line quotes ("با سلام…") as evidence in `stance.py`;
   once ≥30 *bearish* days exist, report bullish/bearish days separately (now 34/4, so the test mostly measures bullish days).
6. **Site ↔ bot identity** (watchlist and alerts follow the person via the bot deep link). Design first; larger.
7. **Owner action, not for the loop:** stray branch `ck-push-test` (left by a push test on 2026-11-07). The proxy
    cannot delete refs and the safety gate refused deleting it from the GitHub UI; the owner can delete it from the
    repository's Branches page. Harmless meanwhile (it points at a commit already on main). Do not retry.

## Log (newest first)

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
