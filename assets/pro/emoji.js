/* entekhab.net — /market/ emoji, stickers and icons for the chart.
   Three kinds of mark, all placed with the one "emoji" drawing tool and stored in its style as a plain string:
     an emoji            the character itself                       drawn as text by the visitor's own emoji font
     "stk:<id>"          a sticker from STK below                   a labelled badge drawn on the canvas by draw.js
     "ico:<id>"          an icon from ICO below                     a vector path stroked in the drawing's own colour
   Nothing here is an image and nothing is fetched: the stickers and icons are this site's own drawings (a rounded
   badge with a word on it, and plain line icons on a 24-unit grid), so they stay sharp at any size, cost nothing to
   load and follow the colour and size settings of the drawing like every other tool.
   P.emoOk() is the one gate a stored value passes through (settings, a saved drawing, another tab): an unknown
   sticker or icon id, markup, or an over-long string is refused and the default star is used instead. */
(function () {
  'use strict';
  var P = window.PRO = window.PRO || {};

  /* ---- emoji, by category (space separated so that multi-codepoint emoji stay whole) */
  var EMO = [
    ['mk', '📈', '📈 📉 📊 💹 💰 💸 💵 💴 💶 💷 🪙 💎 🏦 💳 🧾 ⚖️ 🎯 📌 📍 🚩 🏁 🔔 🔕 ⏰ ⏳ ⌛ 🚀 🛸 🌙 🌕 ☀️ ⚡ 🔥 💥 ❄️ 🌊 🌋 🧨 💣 🛡️ ⚔️ 🔑 🔒 🔓 🧲 🧭 🪤 🎲 🎰 🏆 🥇 🥈 🥉 👑 ₿'],
    ['sm', '😀', '😀 😃 😄 😁 😆 😅 😂 🤣 🙂 🙃 😉 😊 😇 🥰 😍 🤩 😎 🤓 🧐 🤔 🤨 😐 😑 😶 🙄 😏 😬 🤥 😌 😴 🥱 😷 🤒 🤕 🤢 🥵 🥶 😵 🤯 🤠 🥳 😕 😟 🙁 😮 😯 😲 😳 🥺 😦 😧 😨 😰 😥 😢 😭 😱 😖 😣 😞 😓 😩 😫 😤 😡 😠 🤬 😈 💀 🤡 👻 👽 🤖'],
    ['hd', '👍', '👍 👎 👌 ✌️ 🤞 🤟 🤘 🤙 👈 👉 👆 👇 ☝️ ✋ 🤚 🖐️ 🖖 👋 🤝 🙏 ✍️ 💪 👏 🙌 👐 🤲 🫡 🫵 👀 👁️ 🧠 💯 ❤️ 🧡 💛 💚 💙 💜 🖤 🤍 💔'],
    ['an', '🐂', '🐂 🐃 🐻 🐻‍❄️ 🐳 🐋 🦈 🐬 🐙 🦀 🦐 🐟 🦄 🦅 🦉 🦊 🐺 🦁 🐯 🐵 🦍 🐶 🐱 🐭 🐹 🐰 🐼 🐨 🐸 🐢 🐍 🐉 🦖 🐝 🦋 🐜 🕷️ 🐑 🐐 🐎 🐪 🐘 🦏 🐓 🦃 🕊️ 🦆 🦢 🐧'],
    ['ob', '💡', '💡 🔦 🔭 🔬 🧪 ⚙️ 🔧 🔨 ⛏️ 🪓 🧱 ⚓ 🧯 📎 ✂️ 📏 📐 🖊️ ✏️ 📝 📒 📚 📰 🗞️ 📣 📢 🎙️ 📡 💻 🖥️ 📱 ⌚ 📷 🎥 🎬 🎵 🎁 🎉 🎊 🎈 🏠 🏛️ 🏭 🏗️ ⛽ 🚗 ✈️ 🚢 🚂 🗺️ 🌍 🌎 🌏'],
    ['sy', '✅', '✅ ☑️ ✔️ ❌ ❎ ✖️ ➕ ➖ ➗ ❓ ❔ ❗ ❕ ‼️ ⁉️ ⚠️ 🚫 ⛔ 🛑 ♻️ ⭐ 🌟 ✨ 💫 ⬆️ ⬇️ ⬅️ ➡️ ↗️ ↘️ ↙️ ↖️ ↕️ ↔️ 🔄 🔃 🔁 🔼 🔽 ⏫ ⏬ ▶️ ⏸️ ⏹️ ⏺️ 🔴 🟠 🟡 🟢 🔵 🟣 ⚫ ⚪ 🟥 🟧 🟨 🟩 🟦 🟪 ⬛ ⬜ 🔺 🔻 🔶 🔷 🔸 🔹 ♾️ 💲 ©️ ®️ ™️ 🆗 🆕 🆙 🆘 🔝 🔚 🔜'],
    ['fl', '🏳️', '']
  ];
  /* flags: built from ISO 3166 codes. Windows ships no flag glyphs (the browser shows the two letters instead), so
     the category is only offered where the visitor's own font really draws a flag — measured below, not guessed. */
  var ISO = 'AF AL DZ AD AO AG AR AM AU AT AZ BS BH BD BB BY BE BZ BJ BT BO BA BW BR BN BG BF BI KH CM CA CV CF TD CL CN CO KM CG CD CR CI HR CU CY CZ DK DJ DM DO EC EG SV GQ ER EE SZ ET FJ FI FR GA GM GE DE GH GR GD GT GN GW GY HT HN HU IS IN ID IR IQ IE IL IT JM JP JO KZ KE KI KP KR KW KG LA LV LB LS LR LY LI LT LU MG MW MY MV ML MT MH MR MU MX FM MD MC MN ME MA MZ MM NA NR NP NL NZ NI NE NG MK NO OM PK PW PS PA PG PY PE PH PL PT QA RO RU RW KN LC VC WS SM ST SA SN RS SC SL SG SK SI SB SO ZA SS ES LK SD SR SE CH SY TW TJ TZ TH TL TG TO TT TN TR TM TV UG UA AE GB US UY UZ VU VA VE VN YE ZM ZW EU UN';
  function flag(cc) { return String.fromCodePoint(0x1F1E6 + cc.charCodeAt(0) - 65, 0x1F1E6 + cc.charCodeAt(1) - 65); }
  var flagsOk = null;
  P.flagsOk = function () {
    if (flagsOk != null) return flagsOk;
    try {
      var c = document.createElement('canvas').getContext('2d'); c.font = '32px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';
      /* a real flag is one glyph, about as wide as any other emoji; the fallback is two letter boxes side by side */
      flagsOk = c.measureText(flag('FR')).width < c.measureText('😀').width * 1.5;
    } catch (e) { flagsOk = false; }
    return flagsOk;
  };
  P.emoCats = function () {
    return EMO.filter(function (c) { return c[0] !== 'fl' || P.flagsOk(); }).map(function (c) {
      return { id: c[0], tab: c[0] === 'fl' ? '🏳️' : c[1], list: c[0] === 'fl' ? ['🏳️', '🏴', '🏁', '🚩', '🏳️‍🌈', '🏴‍☠️'].concat(ISO.split(' ').map(flag)) : c[2].split(' ') };
    });
  };

  /* ---- stickers: a word on a badge. [label, background, text colour, group] */
  P.STK = {
    buy: ['BUY', '#16a34a', '#fff', 'trade'], sell: ['SELL', '#dc2626', '#fff', 'trade'],
    long: ['LONG', '#059669', '#fff', 'trade'], short: ['SHORT', '#e11d48', '#fff', 'trade'],
    entry: ['ENTRY', '#2563eb', '#fff', 'trade'], exit: ['EXIT', '#7c3aed', '#fff', 'trade'],
    tp: ['TP', '#10b981', '#06281c', 'trade'], tp1: ['TP1', '#10b981', '#06281c', 'trade'], tp2: ['TP2', '#34d399', '#06281c', 'trade'], tp3: ['TP3', '#6ee7b7', '#06281c', 'trade'],
    sl: ['SL', '#ef4444', '#fff', 'trade'], be: ['BREAK-EVEN', '#64748b', '#fff', 'trade'],
    breakout: ['BREAKOUT', '#f7931a', '#1a1207', 'setup'], breakdown: ['BREAKDOWN', '#f7256f', '#fff', 'setup'],
    reversal: ['REVERSAL', '#a855f7', '#fff', 'setup'], retest: ['RETEST', '#0ea5e9', '#04222e', 'setup'],
    fakeout: ['FAKEOUT', '#f59e0b', '#1a1207', 'setup'], squeeze: ['SQUEEZE', '#ec4899', '#fff', 'setup'],
    support: ['SUPPORT', '#22c55e', '#06281c', 'level'], resist: ['RESISTANCE', '#f43f5e', '#fff', 'level'],
    ath: ['ATH', '#facc15', '#1a1207', 'level'], atl: ['ATL', '#38bdf8', '#04222e', 'level'],
    liq: ['LIQUIDITY', '#06b6d4', '#04222e', 'smc'], bos: ['BOS', '#3b82f6', '#fff', 'smc'], choch: ['CHoCH', '#8b5cf6', '#fff', 'smc'],
    fvg: ['FVG', '#14b8a6', '#04222e', 'smc'], ob: ['ORDER BLOCK', '#6366f1', '#fff', 'smc'], sweep: ['SWEEP', '#0891b2', '#fff', 'smc'],
    whale: ['WHALE', '#1d4ed8', '#fff', 'flow'], news: ['NEWS', '#e5e7eb', '#111', 'flow'], event: ['EVENT', '#fbbf24', '#1a1207', 'flow'],
    risk: ['RISK', '#b91c1c', '#fff', 'mind'], warn: ['WARNING', '#f59e0b', '#1a1207', 'mind'],
    profit: ['PROFIT', '#15803d', '#fff', 'mind'], loss: ['LOSS', '#991b1b', '#fff', 'mind'],
    fomo: ['FOMO', '#fb7185', '#2a0610', 'mind'], fud: ['FUD', '#94a3b8', '#0f172a', 'mind'], hodl: ['HODL', '#f7931a', '#1a1207', 'mind'],
    wait: ['PATIENCE', '#475569', '#fff', 'mind'], plan: ['FOLLOW THE PLAN', '#0f766e', '#fff', 'mind'], nope: ['NO TRADE', '#3f3f46', '#fff', 'mind']
  };
  P.STK_GROUPS = ['trade', 'setup', 'level', 'smc', 'flow', 'mind'];

  /* ---- icons: one path each on a 24-unit grid, stroked (round caps) in the drawing's colour */
  P.ICO = {
    up: 'M12 20V4M5 11l7-7 7 7', down: 'M12 4v16M5 13l7 7 7-7', left: 'M20 12H4M11 5l-7 7 7 7', right: 'M4 12h16M13 5l7 7-7 7',
    upright: 'M7 17 17 7M8 7h9v9', downright: 'M7 7l10 10M17 8v9H8', trendup: 'M3 17l6-6 4 4 8-8M15 7h6v6', trenddn: 'M3 7l6 6 4-4 8 8M15 17h6v-6',
    check: 'M4 12l5 5L20 6', cross: 'M5 5l14 14M19 5 5 19', plus: 'M12 4v16M4 12h16', minus: 'M4 12h16',
    circle: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', target: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 11.5v1',
    square: 'M4 4h16v16H4z', diamond: 'M12 3l9 9-9 9-9-9z', triup: 'M12 4l9 16H3z', tridn: 'M12 20 3 4h18z',
    star: 'm12 3 2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.8 6.6 19.7l1.1-6.1L3.2 9.4l6.1-.8z', heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.4A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
    flag: 'M5 21V4h11l-2 4 2 4H5', pin: 'M12 21s-6-5.5-6-10a6 6 0 0 1 12 0c0 4.5-6 10-6 10zM12 9a2 2 0 1 0 0 4 2 2 0 0 0 0-4z',
    bell: 'M6 17v-6a6 6 0 0 1 12 0v6l2 2H4zM10 21h4', clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2',
    bolt: 'M13 2 5 13h6l-1 9 8-11h-6z', lock: 'M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3', shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
    eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
    warn: 'M12 3 2 20h20zM12 10v5M12 17.5v.5', info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v6M12 7.5v.5', ask: 'M9 9a3 3 0 1 1 4.5 2.6c-1 .6-1.5 1.2-1.5 2.4M12 17.5v.5',
    dollar: 'M12 2v20M16 7c0-1.7-1.8-3-4-3S8 5.3 8 7s1.8 3 4 3 4 1.3 4 3-1.8 3-4 3-4-1.3-4-3', bars: 'M5 20V10M12 20V4M19 20v-7',
    candle: 'M8 3v4M6 7h4v10H6zM8 17v4M16 5v3M14 8h4v7h-4zM16 15v4', crown: 'M3 18h18M4 16 3 7l5 4 4-7 4 7 5-4-1 9z',
    stop: 'M8 3h8l5 5v8l-5 5H8l-5-5V8zM8 12h8'
  };

  P.emoOk = function (x) {
    if (typeof x !== 'string' || !x || x.length > 24) return false;
    if (x.slice(0, 4) === 'stk:') return Object.prototype.hasOwnProperty.call(P.STK, x.slice(4));
    if (x.slice(0, 4) === 'ico:') return Object.prototype.hasOwnProperty.call(P.ICO, x.slice(4));
    return !/[<>&"'`\\]/.test(x);
  };
})();
