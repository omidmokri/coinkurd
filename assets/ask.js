/* پشتیبان انتخاب — جستجوگر هوشمند سایت.
   از نمایهٔ /data/assistant.json (ساختهٔ scripts/build_assistant.py) و فایل‌های زندهٔ خود سایت جواب می‌دهد.
   هیچ کلید API در مرورگر نیست و هیچ داده‌ای جایی فرستاده نمی‌شود؛ فقط وقتی کاربر دکمهٔ «گفتگو با پشتیبان»
   را بزند، متن در کلیپ‌بورد کپی و گفتگوی تلگرام باز می‌شود. */
(function () {
  "use strict";
  var IDX = null, LOAD = null, ADMIN = "Kurdistan_Coin", HIST = [];

  function lang() {
    var l; try { l = localStorage.getItem("ck_lang"); } catch (e) {}
    return (["fa", "ckb", "en"].indexOf(l) >= 0) ? l : "fa";
  }
  function T(o) { var l = lang(); return (o && (o[l] || o.fa || o.en)) || ""; }

  var S = {
    title: { fa: "پشتیبان انتخاب", ckb: "پشتگیری Entekhab", en: "Entekhab assistant" },
    sub: { fa: "جستجوی هوشمند در کل سایت", ckb: "گەڕانی زیرەک لە هەموو سایتدا", en: "Smart search across the site" },
    fab: { fa: "پشتیبانی", ckb: "پشتگیری", en: "Help" },
    ph: { fa: "سؤالتان را بنویسید…", ckb: "پرسیارەکەت بنووسە…", en: "Ask a question…" },
    hi: {
      fa: "سلام 👋 من پشتیبان انتخابم. هر چیزی دربارهٔ سایت، ابزارها، آکادمی، دانشنامه یا قیمت‌های لحظه‌ای بپرسید — از محتوای خود سایت برایتان پیدا می‌کنم.",
      ckb: "سڵاو 👋 من پشتگیری Entekhabم. هەر شتێک دەربارەی سایت، ئامرازەکان، ئەکادیمیا یان نرخی ئێستا بپرسە.",
      en: "Hi 👋 I'm the Entekhab assistant. Ask me anything about the site, its tools, the academy, the encyclopedia or live prices — I'll find it in the site's own content."
    },
    none: {
      fa: "چیزی که دقیقاً به این بخورد پیدا نکردم. می‌توانید جور دیگری بپرسید، یا مستقیم با پشتیبان حرف بزنید:",
      ckb: "شتێکی تەواو لەبارم نەدۆزییەوە. بە شێوەیەکی تر بپرسە، یان ڕاستەوخۆ لەگەڵ پشتگیری بدوێ:",
      en: "I couldn't find a close match. Try rephrasing, or talk to a human directly:"
    },
    found: { fa: "این‌ها را پیدا کردم:", ckb: "ئەمانەم دۆزییەوە:", en: "Here's what I found:" },
    maybe: { fa: "دقیقاً مطمئن نیستم؛ شاید منظورتان یکی از این‌ها بود:", ckb: "تەواو دڵنیا نیم؛ لەوانەیە مەبەستت یەکێک لەمانە بێت:", en: "I'm not certain — did you mean one of these?" },
    tg: { fa: "گفتگو با پشتیبان در تلگرام", ckb: "گفتوگۆ لەگەڵ پشتگیری لە تەلەگرام", en: "Talk to a human on Telegram" },
    copied: { fa: "متن گفتگو کپی شد — در تلگرام فقط بچسبانید و بفرستید.", ckb: "دەقەکە کۆپی کرا — لە تەلەگرام تەنها بیلکێنە.", en: "The conversation was copied — just paste it in Telegram." },
    err: { fa: "نتوانستم نمایه را بخوانم. اینترنت را بررسی کنید یا بعداً دوباره امتحان کنید.", ckb: "نەمتوانی ئیندێکس بخوێنمەوە.", en: "I couldn't load the index. Check your connection and try again." },
    load: { fa: "یک لحظه…", ckb: "چرکەیەک…", en: "One moment…" },
    note: { fa: "جواب‌ها از محتوای خود سایت است، نه توصیهٔ مالی.", ckb: "وەڵامەکان لە ناوەڕۆکی سایتەوەن، نەک ئامۆژگاریی دارایی.", en: "Answers come from the site's own content — not financial advice." },
    sug: {
      fa: ["دقت سیگنال‌ها چقدر است؟", "قیمت بیت‌کوین", "اصطکاک ایران", "از کجا شروع کنم؟", "ربات معامله‌گر چیست؟"],
      ckb: ["وردیی سیگناڵەکان؟", "نرخی بیتکۆین", "لێکخشانی ئێران", "لە کوێوە دەست پێ بکەم؟"],
      en: ["How accurate are the signals?", "Bitcoin price", "Iran friction", "Where do I start?"]
    },
    live: {
      fng: { fa: "شاخص ترس و طمع الان", ckb: "پێوەری ترس و تەماح ئێستا", en: "Fear & Greed right now" },
      fr: { fa: "اصطکاک محلی ایران", ckb: "لێکخشانی ناوخۆیی ئێران", en: "Iran local friction" },
      acc: { fa: "دقیق‌ترین منبع در دفتر سیگنال‌ها", ckb: "وردترین سەرچاوە لە تۆمارەکەدا", en: "Most accurate source in the ledger" },
      locked: { fa: "پیش‌بینی قفل‌شده", ckb: "پێشبینیی قوفڵکراو", en: "locked calls" },
      of100: { fa: "از ۱۰۰", ckb: "لە ١٠٠", en: "/ 100" },
      more: { fa: "جزئیات کامل", ckb: "وردەکاریی تەواو", en: "Full details" }
    },
    g: {
      page: { fa: "صفحه", ckb: "پەڕە", en: "Page" }, term: { fa: "دانشنامه", ckb: "زانستنامە", en: "Encyclopedia" },
      post: { fa: "پست کانال", ckb: "پۆستی کەناڵ", en: "Channel post" }, academy: { fa: "آکادمی", ckb: "ئەکادیمیا", en: "Academy" },
      faq: { fa: "راهنما", ckb: "ڕێنمایی", en: "Guide" }, live: { fa: "زنده", ckb: "زیندوو", en: "Live" }
    }
  };

  /* ---------- text normalisation (Persian / Kurdish / English) ---------- */
  var FAD = "۰۱۲۳۴۵۶۷۸۹", ARD = "٠١٢٣٤٥٦٧٨٩";
  function norm(s) {
    s = String(s || "").toLowerCase();
    var o = "";
    for (var i = 0; i < s.length; i++) {
      var c = s[i], k = FAD.indexOf(c); if (k < 0) k = ARD.indexOf(c);
      if (k >= 0) { o += k; continue; }
      if (c === "ي" || c === "ى" || c === "ﻰ") c = "ی";
      else if (c === "ك") c = "ک";
      else if (c === "ۀ" || c === "ة") c = "ه";
      else if (c === "أ" || c === "إ" || c === "آ" || c === "ٱ") c = "ا";
      else if (c === "ؤ") c = "و";
      else if (c === "‌" || c === "‏" || c === "‎" || c === "ً") c = " ";
      else if ("َُِّْـ".indexOf(c) >= 0) continue;
      else if (/[^\p{L}\p{N}]/u.test(c)) c = " ";
      o += c;
    }
    return o.replace(/\s+/g, " ").trim();
  }
  var STOP = { "چیست": 1, "چیه": 1, "است": 1, "را": 1, "به": 1, "از": 1, "در": 1, "که": 1, "با": 1, "این": 1, "برای": 1, "می": 1, "چه": 1, "چطور": 1, "چگونه": 1, "the": 1, "is": 1, "a": 1, "of": 1, "how": 1, "what": 1, "to": 1, "do": 1, "i": 1, "my": 1, "and": 1 };
  function toks(s) { return norm(s).split(" ").filter(function (t) { return t.length > 1 && !STOP[t]; }); }

  /* ---------- index ---------- */
  function load() {
    if (LOAD) return LOAD;
    LOAD = fetch("/data/assistant.json", { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (j) {
      IDX = j; ADMIN = j.admin || ADMIN;
      (j.docs || []).forEach(function (d) { d._h = norm([T(d.t), d.t && d.t.fa, d.t && d.t.en, d.k || "", d.d ? T(d.d) : ""].join(" ")); });
      (j.faq || []).forEach(function (f) { f._h = norm([(f.q || []).join(" "), T(f.t), f.t && f.t.fa, f.t && f.t.en].join(" ")); });
      return j;
    });
    return LOAD;
  }
  var BOOST = { faq: 2.2, page: 1.5, academy: 1.1, term: 1.0, post: .65 };
  function score(hay, tk, q) {
    var s = 0;
    for (var i = 0; i < tk.length; i++) {
      var t = tk[i], at = hay.indexOf(t);
      if (at < 0) continue;
      var whole = (at === 0 || hay[at - 1] === " ") && (at + t.length === hay.length || hay[at + t.length] === " ");
      s += whole ? 3 : 1.4;
    }
    if (q.length > 3 && hay.indexOf(q) >= 0) s += 5;
    return s;
  }
  function search(qs) {
    var tk = toks(qs), q = norm(qs), out = [];
    if (!tk.length || !IDX) return out;
    (IDX.faq || []).forEach(function (f) {
      var s = score(f._h, tk, q); if (s > 0) out.push({ s: s * BOOST.faq, faq: f });
    });
    (IDX.docs || []).forEach(function (d) {
      var s = score(d._h, tk, q); if (s > 0) out.push({ s: s * (BOOST[d.g] || 1), doc: d });
    });
    out.sort(function (a, b) { return b.s - a.s; });
    var min = tk.length >= 2 ? 4 : 2.5;
    var strong = out.filter(function (x) { return x.s >= min; }).slice(0, 5);
    if (strong.length) return strong;
    var weak = out.filter(function (x) { return x.s >= 2.4; }).slice(0, 3);   // "did you mean" rather than a dead end
    weak.forEach(function (x) { x.weak = 1; });
    return weak;
  }

  /* ---------- live answers from the site's own JSON ---------- */
  var CACHE = {};
  function j(url) { if (!CACHE[url]) CACHE[url] = fetch(url, { cache: "no-store" }).then(function (r) { return r.json(); }).catch(function () { return null; }); return CACHE[url]; }
  function fmt(n, d) { if (n === null || n === undefined) return "—"; return Number(n).toLocaleString(lang() === "en" ? "en-US" : "fa-IR", { maximumFractionDigits: d === undefined ? 2 : d }); }

  function liveAnswer(qs) {
    var q = norm(qs);
    if (/تر(س|ش)|طمع|fear|greed|احساسات|تەماح/.test(q)) {
      return j("/data/market.json").then(function (m) {
        if (!m || !m.fng) return null;
        return { html: "<b>" + T(S.live.fng) + ":</b> <span class='ask-big'>" + fmt(m.fng.value, 0) + "</span> <small>" + T(S.live.of100) + "</small> — " + (m.fng.class || ""), u: "/" };
      });
    }
    if (/اصطکاک|تتر|تەتەر|دلار ازاد|حباب|friction|tether|لێکخشان/.test(q)) {
      return j("/data/friction.json").then(function (f) {
        if (!f || f.score === null || f.score === undefined) return null;
        var c = { green: "#22c55e", yellow: "#eab308", red: "#ef4444" }[f.level] || "#ccc";
        var g = (f.components || []).filter(function (x) { return x.id === "c1"; })[0];
        var extra = g && g.value !== null ? "<br>" + (lang() === "en" ? "Tether vs free dollar: " : lang() === "ckb" ? "تەتەر بەرامبەر دۆلار: " : "اختلاف تتر با دلار آزاد: ") + "<span dir='ltr'>" + fmt(g.value) + "%</span>" : "";
        return { html: "<b>" + T(S.live.fr) + ":</b> <span class='ask-big' style='color:" + c + "'>" + fmt(f.score, 0) + "</span> <small>" + T(S.live.of100) + "</small>" + extra, u: "/iran-friction/" };
      });
    }
    if (/دقت|کارنامه|ledger|accurac|accurate|وردی|دفتر سیگنال|track record/.test(q)) {
      return j("/data/ledger.json").then(function (d) {
        if (!d || !d.n) return null;
        var top = (d.board || [])[0], st = top && d.stats ? d.stats[top] : null;
        var nm = top && d.sources && d.sources[top] ? T(d.sources[top].name) : "";
        var line = "<b>" + fmt(d.n, 0) + "</b> " + T(S.live.locked);
        if (st && st.acc !== null) line += "<br>" + T(S.live.acc) + ": <b>" + nm + "</b> — <span dir='ltr'>" + fmt(st.acc, 0) + "%</span>";
        return { html: line, u: "/ledger/" };
      });
    }
    if (/خروج خاموش|نهنگ|silent|whale/.test(q)) {
      return j("/data/silent_exit.json").then(function (d) {
        if (!d || !d.assets) return null;
        var out = Object.keys(d.assets).map(function (c) {
          var lv = d.assets[c].level, col = { none: "#94a3b8", yellow: "#eab308", orange: "#f97316", red: "#ef4444" }[lv] || "#ccc";
          return "<b>" + c + "</b> <span style='color:" + col + "'>" + lv + "</span>";
        }).join(" · ");
        return { html: out, u: "/silent-exit/" };
      });
    }
    /* \b does not work next to Persian/Kurdish letters in JS, so match on spaces instead */
    var m = q.match(/(^|\s)(btc|eth|sol|bnb|xrp|doge|ton|ada|avax|link|dot|trx|ltc|near|sui|apt|arb|op|pepe|shib|uni|atom|bitcoin|ethereum|solana|بیت ?کوین|بیتکۆین|اتریوم|ایتریوم|ئیتریۆم|سولانا|سۆلانا|ریپل|ڕیپڵ|دوج|شیبا|تون|کاردانو)(\s|$)/);
    if (m && /قیمت|نرخ|چند|price|بها|چنده|how much|نرخی/.test(q)) {
      var MAP = { bitcoin: "BTC", ethereum: "ETH", solana: "SOL", "بیت کوین": "BTC", "بیتکوین": "BTC", "بیتکۆین": "BTC", "ئیتریۆم": "ETH", "سۆلانا": "SOL", "ڕیپڵ": "XRP", "اتریوم": "ETH", "ایتریوم": "ETH", "سولانا": "SOL", "ریپل": "XRP", "دوج": "DOGE", "شیبا": "SHIB", "تون": "TON", "کاردانو": "ADA" };
      var sym = (MAP[m[2]] || m[2]).toUpperCase();
      return j("/data/market.json").then(function (d) {
        if (!d || !d.coins) return null;
        var c = d.coins.filter(function (x) { return x.coin === sym; })[0];
        if (!c) return null;
        var up = (c.chg24 || 0) >= 0;
        return {
          html: "<b>" + sym + "</b> <span class='ask-big'>$" + fmt(c.price, c.price >= 1000 ? 0 : 4) + "</span> " +
            "<span style='color:" + (up ? "#22c55e" : "#ef4444") + "' dir='ltr'>" + (up ? "+" : "") + fmt(c.chg24, 2) + "%</span>", u: "/coins/" + sym.toLowerCase() + "/"
        };
      });
    }
    return Promise.resolve(null);
  }

  /* ---------- UI ---------- */
  var panel, body, input, fab;
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function add(cls, html) {
    var d = document.createElement("div");
    d.className = "ask-msg " + cls; d.innerHTML = html;
    body.appendChild(d); body.scrollTop = body.scrollHeight; return d;
  }
  function card(url, title, sub, tag) {
    return "<a class='ask-res' href='" + esc(url) + "'>" + (tag ? "<u>" + esc(tag) + "</u>" : "") + esc(title) +
      (sub ? "<i>" + esc(sub) + "</i>" : "") + "</a>";
  }
  function tgBtn() {
    return "<button class='ask-tg' type='button' data-tg='1'>✈ " + esc(T(S.tg)) + "</button>";
  }
  function chips() {
    var list = T(S.sug) || [];
    return "<div class='ask-chips'>" + list.map(function (q) { return "<button type='button' data-q='" + esc(q) + "'>" + esc(q) + "</button>"; }).join("") + "</div>";
  }

  function ask(qs) {
    qs = (qs || "").trim(); if (!qs) return;
    HIST.push(qs);
    add("ask-me", esc(qs));
    input.value = "";
    var wait = add("ask-bot", esc(T(S.load)));
    Promise.all([load().catch(function () { return null; }), liveAnswer(qs)]).then(function (r) {
      var lv = r[1];
      if (!IDX && !lv) { wait.innerHTML = esc(T(S.err)) + tgBtn(); return; }
      var hits = search(qs), html = "";
      if (lv) html += lv.html + card(lv.u, T(S.live.more), "", T(S.g.live));
      if (hits.length) {
        if (!lv) html += esc(hits[0].weak ? T(S.maybe) : T(S.found));
        hits.forEach(function (h) {
          if (h.faq) html += "<div style='margin-top:7px'>" + esc(T(h.faq.a)) + "</div>" + card(h.faq.u, T(h.faq.t), "", T(S.g.faq));
          else html += card(h.doc.u, T(h.doc.t), h.doc.d ? T(h.doc.d) : (h.doc.dt || ""), T(S.g[h.doc.g] || S.g.page));
        });
      }
      if (!html) html = esc(T(S.none)) + tgBtn();
      else if (!lv && (!hits.length || hits[0].weak)) html += tgBtn();
      wait.innerHTML = html;
      body.scrollTop = body.scrollHeight;
    });
  }

  function toTelegram() {
    var txt = HIST.length ? HIST.join("\n") : "";
    var pre = { fa: "سلام، از سایت entekhab.net آمدم:", ckb: "سڵاو، لە entekhab.net هاتووم:", en: "Hi, I came from entekhab.net:" }[lang()];
    var full = pre + "\n" + txt;
    try { navigator.clipboard && navigator.clipboard.writeText(full); } catch (e) {}
    add("ask-bot", esc(T(S.copied)));
    var a = document.createElement("a");
    a.href = "https://t.me/" + ADMIN; a.target = "_blank"; a.rel = "noopener";
    document.body.appendChild(a); a.click(); a.remove();
  }

  function build() {
    fab = document.createElement("button");
    fab.id = "ask-fab"; fab.type = "button";
    fab.innerHTML = "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M21 11.5a8.4 8.4 0 0 1-9 8.4 8.6 8.6 0 0 1-3.8-.9L3 21l2-5.2A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5Z'/></svg><span class='ask-lbl'>" + esc(T(S.fab)) + "</span>";
    document.body.appendChild(fab);

    panel = document.createElement("div");
    panel.id = "ask-panel";
    panel.innerHTML =
      "<div class='ask-hd'><span class='ask-dot'></span><div><b>" + esc(T(S.title)) + "</b><small>" + esc(T(S.sub)) + "</small></div>" +
      "<button class='ask-x' type='button' aria-label='close'>×</button></div>" +
      "<div class='ask-body'></div>" +
      "<div class='ask-note'>" + esc(T(S.note)) + "</div>" +
      "<div class='ask-ft'><input type='text' placeholder='" + esc(T(S.ph)) + "'><button type='button' aria-label='send'>↑</button></div>";
    document.body.appendChild(panel);
    body = panel.querySelector(".ask-body");
    input = panel.querySelector("input");
    add("ask-bot", esc(T(S.hi)) + chips());

    fab.onclick = function () { panel.classList.toggle("on"); if (panel.classList.contains("on")) { load(); input.focus(); } };
    panel.querySelector(".ask-x").onclick = function () { panel.classList.remove("on"); };
    panel.querySelector(".ask-ft button").onclick = function () { ask(input.value); };
    input.addEventListener("keydown", function (e) { if (e.key === "Enter") ask(input.value); });
    panel.addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      if (b.dataset.q) ask(b.dataset.q);
      else if (b.dataset.tg) toTelegram();
    });
    window.addEventListener("ek-lang", function () { relabel(); });
  }
  function relabel() {
    if (!panel) return;
    fab.querySelector(".ask-lbl").textContent = T(S.fab);
    panel.querySelector(".ask-hd b").textContent = T(S.title);
    panel.querySelector(".ask-hd small").textContent = T(S.sub);
    panel.querySelector(".ask-note").textContent = T(S.note);
    input.placeholder = T(S.ph);
    if (IDX) { (IDX.docs || []).forEach(function (d) { d._h = norm([T(d.t), d.t.fa, d.t.en, d.k || ""].join(" ")); }); }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build); else build();
})();
