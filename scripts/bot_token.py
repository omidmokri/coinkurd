"""
Token check by contract address (CA) + early scam/rug warnings + new-launch alerts.

Paste a contract address (EVM 0x…, Solana, Tron T…, TON EQ…/UQ…) and the bot answers with
price, market cap, liquidity, volume, buys/sells, pair age, holders, top-10 concentration,
LP lock, taxes and a plain-language risk verdict. Read-only: the bot never asks for keys
and never trades.

Free, key-less sources:
  DexScreener  https://api.dexscreener.com   pairs, price, liquidity, volume, new token profiles
  GoPlus       https://api.gopluslabs.io     contract security (honeypot, taxes, owner powers,
                                             holders, LP holders/locks; EVM, Solana, Tron)
  honeypot.is  https://api.honeypot.is       buy/sell simulation (Ethereum, BSC, Base)
Any source can fail; the card says which checks could not be run instead of guessing.
"""
import logging
import re
import time

import requests

from bot_i18n import pick

log = logging.getLogger("refbot.token")
UA = {"User-Agent": "CoinKurdBot/1.0 (+https://entekhab.net)"}
DEX = "https://api.dexscreener.com"
GOPLUS = "https://api.gopluslabs.io/api/v1"
HONEYPOT = "https://api.honeypot.is/v2/IsHoneypot"

EVM_RE = re.compile(r"\b0x[a-fA-F0-9]{40}\b")
TRON_RE = re.compile(r"\bT[1-9A-HJ-NP-Za-km-z]{33}\b")
TON_RE = re.compile(r"\b[EU]Q[A-Za-z0-9_\-]{46}\b")
SOL_RE = re.compile(r"\b[1-9A-HJ-NP-Za-km-z]{32,44}\b")

GOPLUS_EVM = {"ethereum": "1", "bsc": "56", "base": "8453", "arbitrum": "42161", "polygon": "137",
              "optimism": "10", "avalanche": "43114", "linea": "59144", "blast": "81457", "scroll": "534352",
              "zksync": "324", "fantom": "250", "cronos": "25", "opbnb": "204", "mantle": "5000", "sonic": "146"}
HONEYPOT_CHAINS = {"ethereum": 1, "bsc": 56, "base": 8453}
DEAD = {"0x000000000000000000000000000000000000dead", "0x0000000000000000000000000000000000000000",
        "0xdead000000000000000042069420694206942069"}
_cache = {}


def L(d, lang, /, **kw):
    s = pick(d, lang)
    return s.format(**kw) if kw else s


# ------------------------------------------------------------------ detection
def detect(text):
    """-> address string or None. Order matters: EVM and Tron/TON are unambiguous; Solana last."""
    text = (text or "").strip()
    for rx in (EVM_RE, TRON_RE, TON_RE):
        m = rx.search(text)
        if m:
            return m.group(0)
    # a bare Solana mint: the whole message (or one word of it) is base58 32–44 chars, with digits and mixed case
    for w in text.split():
        w = w.strip(".,;:!?()[]<>\"'")
        if SOL_RE.fullmatch(w) and any(c.isdigit() for c in w) and any(c.islower() for c in w) and any(c.isupper() for c in w):
            return w
    return None


# ------------------------------------------------------------------ http
def _get(url, params=None, ttl=60, timeout=20):
    key = (url, tuple(sorted((params or {}).items())))
    ent = _cache.get(key)
    if ent and time.time() - ent[0] < ttl:
        return ent[1]
    try:
        r = requests.get(url, params=params, headers=UA, timeout=timeout)
        r.raise_for_status()
        data = r.json()
    except Exception as ex:  # noqa: BLE001
        log.info("GET %s failed: %s", url.split("?")[0], ex)
        return ent[1] if ent else None
    _cache[key] = (time.time(), data)
    if len(_cache) > 500:
        for k in sorted(_cache, key=lambda k: _cache[k][0])[:200]:
            _cache.pop(k, None)
    return data


def pairs_for(addrs, batch=5):
    """DexScreener pairs for token addresses (any chain). The endpoint caps the whole answer at ~30 pairs,
    so tokens go in small batches — otherwise one busy token crowds the others out."""
    addrs = [a for a in dict.fromkeys(addrs) if a][:60]
    out = []
    for i in range(0, len(addrs), batch):
        d = _get(f"{DEX}/latest/dex/tokens/{','.join(addrs[i:i + batch])}", ttl=45)
        out += (d or {}).get("pairs") or []
    return out


def best_pair(pairs, addr):
    """the most liquid pair where the token is the base token"""
    a = addr.lower()
    own = [p for p in pairs if ((p.get("baseToken") or {}).get("address") or "").lower() == a]
    if not own:
        return None
    return max(own, key=lambda p: ((p.get("liquidity") or {}).get("usd") or 0))


def goplus(chain, addr):
    if chain == "solana":
        d = _get(f"{GOPLUS}/solana/token_security", {"contract_addresses": addr}, ttl=600)
    elif chain == "tron":
        d = _get(f"{GOPLUS}/token_security/tron", {"contract_addresses": addr}, ttl=600)
    elif chain in GOPLUS_EVM:
        d = _get(f"{GOPLUS}/token_security/{GOPLUS_EVM[chain]}", {"contract_addresses": addr.lower()}, ttl=600)
    else:
        return None
    res = (d or {}).get("result") or {}
    if not res:
        return None
    return res.get(addr) or res.get(addr.lower()) or next(iter(res.values()), None)


def honeypot(chain, addr):
    if chain not in HONEYPOT_CHAINS:
        return None
    return _get(HONEYPOT, {"address": addr, "chainID": HONEYPOT_CHAINS[chain]}, ttl=600)


# ------------------------------------------------------------------ analysis
def _f(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def _on(x):
    """GoPlus flags are "1"/"0" strings, or {"status": "1"} objects on Solana"""
    if isinstance(x, dict):
        x = x.get("status")
    return str(x) == "1"


FLAG = {
    "honeypot": {"fa": "⛔ هانی‌پات: احتمالاً نمی‌توانی بفروشی", "ckb": "⛔ هانی‌پۆت: لەوانەیە نەتوانیت بیفرۆشیت",
                 "kmr": "⛔ Honeypot: dibe ku tu nikaribî bifiroşî", "ar": "⛔ فخ (Honeypot): قد لا تستطيع البيع",
                 "en": "⛔ Honeypot: you probably can't sell"},
    "cant_sell_all": {"fa": "⛔ فروش کامل موجودی ممکن نیست", "ckb": "⛔ فرۆشتنی هەموو بڕەکە ناکرێت",
                      "kmr": "⛔ Hemû nayê firotin", "ar": "⛔ لا يمكن بيع كامل الرصيد", "en": "⛔ Can't sell the full balance"},
    "frozen_bal": {"fa": "⛔ سازنده می‌تواند موجودی کیف‌ها را تغییر دهد", "ckb": "⛔ دروستکەر دەتوانێت باڵانسی جزدانەکان بگۆڕێت",
                   "kmr": "⛔ Afirîner dikare balansa cûzdanan biguherîne", "ar": "⛔ المطوّر يستطيع تعديل أرصدة المحافظ",
                   "en": "⛔ Owner can change wallet balances"},
    "sell_tax": {"fa": "🔴 مالیات فروش بالا: {v}", "ckb": "🔴 باجی فرۆشتنی بەرز: {v}", "kmr": "🔴 Baca firotinê bilind: {v}",
                 "ar": "🔴 ضريبة بيع مرتفعة: {v}", "en": "🔴 High sell tax: {v}"},
    "buy_tax": {"fa": "🟠 مالیات خرید بالا: {v}", "ckb": "🟠 باجی کڕینی بەرز: {v}", "kmr": "🟠 Baca kirînê bilind: {v}",
                "ar": "🟠 ضريبة شراء مرتفعة: {v}", "en": "🟠 High buy tax: {v}"},
    "closed": {"fa": "🔴 کد قرارداد منتشر نشده (غیرقابل بررسی)", "ckb": "🔴 کۆدی گرێبەست بڵاونەکراوەتەوە",
               "kmr": "🔴 Koda peymanê nehatiye weşandin", "ar": "🔴 كود العقد غير منشور (لا يمكن فحصه)",
               "en": "🔴 Contract source not verified"},
    "mint": {"fa": "🟠 سازنده می‌تواند توکن جدید بسازد (Mint)", "ckb": "🟠 دروستکەر دەتوانێت تۆکنی نوێ دروست بکات",
             "kmr": "🟠 Afirîner dikare tokenên nû çêke (mint)", "ar": "🟠 يمكن للمطوّر سكّ رموز جديدة (Mint)",
             "en": "🟠 Owner can mint new tokens"},
    "freeze": {"fa": "🔴 سازنده می‌تواند کیف‌ها را فریز کند", "ckb": "🔴 دروستکەر دەتوانێت جزدانەکان بوەستێنێت",
               "kmr": "🔴 Afirîner dikare cûzdanan bicemidîne", "ar": "🔴 يمكن للمطوّر تجميد المحافظ",
               "en": "🔴 Owner can freeze wallets"},
    "owner_power": {"fa": "🔴 مالک پنهان/قابل بازگشت یا تغییر موجودی", "ckb": "🔴 خاوەنی شاراوە یان دەسەڵاتی مەترسیدار",
                    "kmr": "🔴 Xwediyê veşartî an hêza xeternak", "ar": "🔴 مالك مخفي أو صلاحيات خطرة",
                    "en": "🔴 Hidden/reclaimable owner or balance control"},
    "pausable": {"fa": "🟠 انتقال توکن قابل توقف است", "ckb": "🟠 گواستنەوە دەتوانرێت بوەستێنرێت", "kmr": "🟠 Veguhastin dikare were rawestandin",
                 "ar": "🟠 يمكن إيقاف التحويلات", "en": "🟠 Transfers can be paused"},
    "blacklist": {"fa": "🟠 لیست سیاه دارد (می‌تواند کیف تو را مسدود کند)", "ckb": "🟠 لیستی ڕەشی هەیە",
                  "kmr": "🟠 Lîsteya reş heye", "ar": "🟠 يحتوي قائمة سوداء (قد يحظر محفظتك)", "en": "🟠 Has a blacklist"},
    "tax_mod": {"fa": "🟠 مالیات قابل تغییر است", "ckb": "🟠 باج دەگۆڕدرێت", "kmr": "🟠 Bac dikare biguhere",
                "ar": "🟠 الضريبة قابلة للتعديل", "en": "🟠 Tax can be changed"},
    "proxy": {"fa": "🟡 قرارداد قابل ارتقا (Proxy)", "ckb": "🟡 گرێبەستی نوێکراوە (Proxy)", "kmr": "🟡 Peymana nûvekirî (proxy)",
              "ar": "🟡 عقد قابل للترقية (Proxy)", "en": "🟡 Upgradeable (proxy) contract"},
    "hook": {"fa": "🟠 Transfer hook / کارمزد انتقال دارد", "ckb": "🟠 Transfer hook / باجی گواستنەوە", "kmr": "🟠 Transfer hook / bac",
             "ar": "🟠 يحتوي transfer hook / رسوم تحويل", "en": "🟠 Transfer hook / transfer fee"},
    "top10": {"fa": "{c} ۱۰ کیف بزرگ {v} عرضه را دارند", "ckb": "{c} ١٠ جزدانی گەورە {v}ی کۆی گشتییان هەیە",
              "kmr": "{c} 10 cûzdanên mezin {v} ji hemûyê hene", "ar": "{c} أكبر 10 محافظ تملك {v} من المعروض",
              "en": "{c} Top-10 wallets hold {v} of supply"},
    "owner_pct": {"fa": "🟠 سازنده/مالک {v} عرضه را دارد", "ckb": "🟠 دروستکەر {v}ی هەیە", "kmr": "🟠 Afirîner {v} digire",
                  "ar": "🟠 المطوّر/المالك يملك {v}", "en": "🟠 Creator/owner holds {v}"},
    "lp_unlocked": {"fa": "🔴 فقط {v} نقدینگی قفل/سوزانده شده (ریسک راگ)", "ckb": "🔴 تەنها {v}ی لیکویدیتی قفڵکراوە (مەترسی ڕاگ)",
                    "kmr": "🔴 Tenê {v} likîdîte kilît e (xetera rug)", "ar": "🔴 فقط {v} من السيولة مقفلة/محروقة (خطر سحب السيولة)",
                    "en": "🔴 Only {v} of liquidity locked/burned (rug risk)"},
    "lp_locked": {"fa": "🟢 {v} نقدینگی قفل/سوزانده شده", "ckb": "🟢 {v}ی لیکویدیتی قفڵکراوە", "kmr": "🟢 {v} likîdîte kilît e",
                  "ar": "🟢 {v} من السيولة مقفلة/محروقة", "en": "🟢 {v} of liquidity locked/burned"},
    "low_liq": {"fa": "🔴 نقدینگی خیلی کم: {v}", "ckb": "🔴 لیکویدیتی زۆر کەم: {v}", "kmr": "🔴 Likîdîte pir kêm: {v}",
                "ar": "🔴 سيولة منخفضة جداً: {v}", "en": "🔴 Very low liquidity: {v}"},
    "thin_liq": {"fa": "🟠 نقدینگی کم: {v}", "ckb": "🟠 لیکویدیتی کەم: {v}", "kmr": "🟠 Likîdîte kêm: {v}",
                 "ar": "🟠 سيولة منخفضة: {v}", "en": "🟠 Thin liquidity: {v}"},
    "new": {"fa": "🟡 جفت معاملاتی تازه است ({v})", "ckb": "🟡 جووتی بازرگانی نوێیە ({v})", "kmr": "🟡 Cotê bazirganiyê nû ye ({v})",
            "ar": "🟡 زوج التداول جديد ({v})", "en": "🟡 New trading pair ({v})"},
    "no_sells": {"fa": "🔴 در ۲۴ ساعت خرید زیاد ولی تقریباً هیچ فروشی نبوده", "ckb": "🔴 کڕینی زۆر بەڵام هیچ فرۆشتنێک نەبووە",
                 "kmr": "🔴 Gelek kirîn lê hema firotin tune", "ar": "🔴 مشتريات كثيرة دون مبيعات تقريباً خلال 24 ساعة",
                 "en": "🔴 Many buys but almost no sells in 24h"},
    "dumped": {"fa": "🔴 سقوط شدید قیمت: {v}", "ckb": "🔴 دابەزینی توند: {v}", "kmr": "🔴 Daketina tund: {v}",
               "ar": "🔴 انهيار حاد في السعر: {v}", "en": "🔴 Price crashed: {v}"},
    "few_holders": {"fa": "🟡 تعداد هولدر کم: {v}", "ckb": "🟡 ژمارەی هۆڵدەر کەمە: {v}", "kmr": "🟡 Hejmara xwedanan kêm e: {v}",
                    "ar": "🟡 عدد الحاملين قليل: {v}", "en": "🟡 Few holders: {v}"},
    "fdv_liq": {"fa": "🟠 نقدینگی نسبت به ارزش بازار خیلی کم است ({v})", "ckb": "🟠 لیکویدیتی بەراورد بە بەهای بازاڕ کەمە ({v})",
                "kmr": "🟠 Likîdîte li gorî nirxa bazarê kêm e ({v})", "ar": "🟠 السيولة ضئيلة مقارنة بالقيمة السوقية ({v})",
                "en": "🟠 Liquidity tiny vs market cap ({v})"},
}
VERDICT = {
    "low": {"fa": "🟢 ریسک پایه: کم", "ckb": "🟢 مەترسی سەرەتایی: کەم", "kmr": "🟢 Xetera destpêkê: kêm", "ar": "🟢 المخاطر الأولية: منخفضة",
            "en": "🟢 Basic risk: low"},
    "mid": {"fa": "🟡 ریسک پایه: متوسط — احتیاط", "ckb": "🟡 مەترسی: مامناوەند — ئاگاداربە", "kmr": "🟡 Xeter: navîn — hişyar be",
            "ar": "🟡 المخاطر: متوسطة — احذر", "en": "🟡 Basic risk: medium — be careful"},
    "high": {"fa": "🟠 ریسک بالا", "ckb": "🟠 مەترسی بەرز", "kmr": "🟠 Xetera bilind", "ar": "🟠 مخاطر عالية", "en": "🟠 High risk"},
    "severe": {"fa": "🔴 ریسک خیلی بالا — احتمال اسکم/راگ", "ckb": "🔴 مەترسی زۆر بەرز — ئەگەری فێڵ", "kmr": "🔴 Xetera pir bilind — dibe ku xapandin be",
               "ar": "🔴 مخاطر عالية جداً — احتمال احتيال", "en": "🔴 Very high risk — likely scam/rug"},
    "scam": {"fa": "⛔ خطر قطعی — خرید نکن", "ckb": "⛔ مەترسی یەکلاکەرەوە — مەیکڕە", "kmr": "⛔ Xetera eşkere — nekire",
             "ar": "⛔ خطر مؤكد — لا تشترِ", "en": "⛔ Critical — do not buy"},
}


def _esc(s):
    return str(s or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _pct(x):
    return f"{x * 100:.1f}%" if x is not None else "—"


def _age_txt(ms):
    if not ms:
        return "?"
    h = (time.time() * 1000 - float(ms)) / 3.6e6
    return f"{h:.0f}h" if h < 48 else f"{h / 24:.0f}d"


def analyze(pair, sec, hp, chain=None):
    """-> {"score", "level", "flags": [(key, kwargs)], "stats": {...}}  — never raises"""
    flags, score, critical = [], 0, False
    st = {}
    chain = chain or (pair or {}).get("chainId")
    p = pair or {}
    liq = _f((p.get("liquidity") or {}).get("usd"))
    mcap = _f(p.get("marketCap")) or _f(p.get("fdv"))
    st.update(liq=liq, mcap=mcap)
    if liq is not None:
        if liq < 10_000:
            flags.append(("low_liq", {"v": _usd(liq)}))
            score += 30
        elif liq < 50_000:
            flags.append(("thin_liq", {"v": _usd(liq)}))
            score += 12
        if mcap and liq / mcap < 0.02 and mcap > 1_000_000:
            flags.append(("fdv_liq", {"v": f"{liq / mcap * 100:.1f}%"}))
            score += 10
    created = p.get("pairCreatedAt")
    if created and (time.time() * 1000 - float(created)) < 24 * 3.6e6:
        flags.append(("new", {"v": _age_txt(created)}))
        score += 10
    tx = (p.get("txns") or {}).get("h24") or {}
    buys, sells = tx.get("buys") or 0, tx.get("sells") or 0
    if buys >= 30 and sells <= max(1, buys * 0.02):
        flags.append(("no_sells", {}))
        score += 40
    ch24 = _f((p.get("priceChange") or {}).get("h24"))
    if ch24 is not None and ch24 <= -70:
        flags.append(("dumped", {"v": f"{ch24:.0f}%"}))
        score += 20

    sec = sec or {}
    if sec:
        if chain == "solana":
            if _on(sec.get("balance_mutable_authority")) or _on(sec.get("non_transferable")):
                flags.append(("frozen_bal", {}))
                critical = True
            if _on(sec.get("mintable")):
                flags.append(("mint", {}))
                score += 20
            if _on(sec.get("freezable")):
                flags.append(("freeze", {}))
                score += 25
            hooks = sec.get("transfer_hook") or []
            fee = sec.get("transfer_fee") or {}
            if hooks or (isinstance(fee, dict) and _f(fee.get("fee_rate")) and _f(fee.get("fee_rate")) > 0):
                flags.append(("hook", {}))
                score += 12
        else:
            if _on(sec.get("is_honeypot")) or _on(sec.get("cannot_buy")):
                flags.append(("honeypot", {}))
                critical = True
            if _on(sec.get("cannot_sell_all")):
                flags.append(("cant_sell_all", {}))
                critical = True
            if _on(sec.get("owner_change_balance")):
                flags.append(("frozen_bal", {}))
                critical = True
            stx, btx = _f(sec.get("sell_tax")), _f(sec.get("buy_tax"))
            st.update(sell_tax=stx, buy_tax=btx)
            if stx is not None and stx > 0.1:
                flags.append(("sell_tax", {"v": _pct(stx)}))
                score += 30 if stx > 0.25 else 18
            if btx is not None and btx > 0.1:
                flags.append(("buy_tax", {"v": _pct(btx)}))
                score += 12
            if str(sec.get("is_open_source")) == "0":
                flags.append(("closed", {}))
                score += 30
            if _on(sec.get("is_mintable")):
                flags.append(("mint", {}))
                score += 15
            if _on(sec.get("hidden_owner")) or _on(sec.get("can_take_back_ownership")) or _on(sec.get("selfdestruct")):
                flags.append(("owner_power", {}))
                score += 25
            if _on(sec.get("transfer_pausable")):
                flags.append(("pausable", {}))
                score += 10
            if _on(sec.get("is_blacklisted")):
                flags.append(("blacklist", {}))
                score += 8
            if _on(sec.get("slippage_modifiable")) or _on(sec.get("personal_slippage_modifiable")):
                flags.append(("tax_mod", {}))
                score += 10
            if _on(sec.get("is_proxy")):
                flags.append(("proxy", {}))
                score += 5
            own = (_f(sec.get("owner_percent")) or 0) + (_f(sec.get("creator_percent")) or 0)
            if own > 0.1:
                flags.append(("owner_pct", {"v": _pct(own)}))
                score += 10
            lp = sec.get("lp_holders") or []
            cex = sec.get("is_in_cex")
            listed = str(cex.get("listed")) == "1" if isinstance(cex, dict) else _on(cex)
            if lp and not listed:
                locked = sum(_f(h.get("percent")) or 0 for h in lp
                             if _on(h.get("is_locked")) or (h.get("address") or "").lower() in DEAD)
                st["lp_locked"] = locked
                if locked < 0.5:
                    flags.append(("lp_unlocked", {"v": _pct(locked)}))
                    score += 25 if locked < 0.2 else 12
                else:
                    flags.append(("lp_locked", {"v": _pct(locked)}))
        hc = sec.get("holder_count")
        st["holders"] = int(_f(hc)) if _f(hc) is not None else None
        if st["holders"] is not None and st["holders"] < 100:
            flags.append(("few_holders", {"v": st["holders"]}))
            score += 10
        pair_addr = (p.get("pairAddress") or "").lower()
        top = 0.0
        for h in (sec.get("holders") or [])[:10]:
            a = (h.get("address") or h.get("account") or "").lower()
            if _on(h.get("is_locked")) or a in DEAD or (pair_addr and a == pair_addr):
                continue
            top += _f(h.get("percent")) or 0
        if sec.get("holders"):
            st["top10"] = top
            if top > 0.5:
                flags.append(("top10", {"c": "🔴", "v": _pct(top)}))
                score += 20
            elif top > 0.3:
                flags.append(("top10", {"c": "🟠", "v": _pct(top)}))
                score += 10
    hp = hp or {}
    if (hp.get("honeypotResult") or {}).get("isHoneypot"):
        if not any(k == "honeypot" for k, _ in flags):
            flags.append(("honeypot", {}))
        critical = True
    sim = hp.get("simulationResult") or {}
    if sim and _f(sim.get("sellTax")) is not None and st.get("sell_tax") is None:
        stx = _f(sim["sellTax"]) / 100
        st["sell_tax"] = stx
        if stx > 0.1:
            flags.append(("sell_tax", {"v": _pct(stx)}))
            score += 30 if stx > 0.25 else 18
    score = min(score, 100)
    lvl = "scam" if critical else ("severe" if score >= 75 else "high" if score >= 50 else "mid" if score >= 25 else "low")
    order = {"⛔": 0, "🔴": 1, "🟠": 2, "🟡": 3, "🟢": 4}
    flags.sort(key=lambda kv: order.get(pick(FLAG[kv[0]], "en")[:1], 5) if kv[0] != "top10" else order.get(kv[1]["c"], 5))
    return {"score": score, "level": lvl, "flags": flags, "stats": st, "checked": {"sec": bool(sec), "hp": bool(hp)}}


def _usd(x):
    if x is None:
        return "—"
    for d, s in ((1e9, "B"), (1e6, "M"), (1e3, "K")):
        if abs(x) >= d:
            return f"${x / d:.2f}{s}"
    return f"${x:,.0f}"


def _price(x):
    x = _f(x)
    if x is None:
        return "—"
    if x >= 1:
        return f"${x:,.4f}".rstrip("0").rstrip(".")
    s = f"{x:.12f}".rstrip("0")
    return "$" + s


# ------------------------------------------------------------------ card
H = {
    "head": {"fa": "🔎 <b>بررسی توکن</b>", "ckb": "🔎 <b>پشکنینی تۆکن</b>", "kmr": "🔎 <b>Kontrola tokenê</b>",
             "ar": "🔎 <b>فحص الرمز</b>", "en": "🔎 <b>Token check</b>"},
    "price": {"fa": "قیمت", "ckb": "نرخ", "kmr": "Biha", "ar": "السعر", "en": "Price"},
    "mcap": {"fa": "ارزش بازار", "ckb": "بەهای بازاڕ", "kmr": "Nirxa bazarê", "ar": "القيمة السوقية", "en": "Market cap"},
    "liq": {"fa": "نقدینگی", "ckb": "لیکویدیتی", "kmr": "Likîdîte", "ar": "السيولة", "en": "Liquidity"},
    "vol": {"fa": "حجم ۲۴س", "ckb": "قەبارەی ٢٤ک", "kmr": "Qebare 24s", "ar": "حجم 24س", "en": "Volume 24h"},
    "tx": {"fa": "خرید/فروش ۲۴س", "ckb": "کڕین/فرۆشتن ٢٤ک", "kmr": "Kirîn/firotin 24s", "ar": "شراء/بيع 24س", "en": "Buys/sells 24h"},
    "age": {"fa": "عمر جفت", "ckb": "تەمەنی جووت", "kmr": "Temenê cotê", "ar": "عمر الزوج", "en": "Pair age"},
    "holders": {"fa": "هولدرها", "ckb": "هۆڵدەرەکان", "kmr": "Xwedan", "ar": "الحاملون", "en": "Holders"},
    "tax": {"fa": "مالیات خرید/فروش", "ckb": "باجی کڕین/فرۆشتن", "kmr": "Bac kirîn/firotin", "ar": "ضريبة الشراء/البيع",
            "en": "Buy/sell tax"},
    "flags": {"fa": "⚠️ <b>هشدارهای اولیه</b>", "ckb": "⚠️ <b>ئاگادارییە سەرەتاییەکان</b>", "kmr": "⚠️ <b>Hişyariyên destpêkê</b>",
              "ar": "⚠️ <b>تحذيرات أولية</b>", "en": "⚠️ <b>Early warnings</b>"},
    "noflags": {"fa": "هشدار مهمی پیدا نشد (یعنی بی‌خطر نیست).", "ckb": "ئاگاداری گرنگ نەدۆزرایەوە (واتای بێمەترسی نییە).",
                "kmr": "Hişyariyeke girîng nehat dîtin (ev nayê wateya bê xeter).", "ar": "لم يُعثر على تحذير مهم (هذا لا يعني أنه آمن).",
                "en": "No major warning found (that does not mean it's safe)."},
    "nosec": {"fa": "ℹ️ بررسی امنیتی قرارداد برای این شبکه در دسترس نبود.", "ckb": "ℹ️ پشکنینی ئاسایشی گرێبەست بەردەست نەبوو.",
              "kmr": "ℹ️ Kontrola ewlehiya peymanê ne amade bû.", "ar": "ℹ️ فحص أمان العقد غير متاح لهذه الشبكة.",
              "en": "ℹ️ Contract security check unavailable for this chain."},
    "notfound": {"fa": "توکنی با این آدرس در صرافی‌های غیرمتمرکز پیدا نشد. آدرس را دوباره بررسی کن.",
                 "ckb": "هیچ تۆکنێک بەم ناونیشانە نەدۆزرایەوە. ناونیشانەکە دووبارە بپشکنە.",
                 "kmr": "Tokenek bi vê navnîşanê nehat dîtin. Navnîşanê dîsa kontrol bike.",
                 "ar": "لم يُعثر على رمز بهذا العنوان في المنصات اللامركزية. تحقق من العنوان.",
                 "en": "No token with this address was found on DEXes. Double-check the address."},
    "disc": {"fa": "🤖 بررسی خودکار و اولیه است؛ ممکن است اشتباه کند. توصیهٔ مالی نیست. ربات هیچ‌وقت کلید خصوصی یا اتصال کیف پول نمی‌خواهد.",
             "ckb": "🤖 پشکنینی خۆکار و سەرەتاییە؛ لەوانەیە هەڵە بکات. ئامۆژگاری دارایی نییە. بۆت هەرگیز کلیلی تایبەت داوا ناکات.",
             "kmr": "🤖 Kontroleke otomatîk û destpêkê ye; dibe ku şaş be. Ne şîreta darayî ye. Bot tu carî mifteya taybet naxwaze.",
             "ar": "🤖 فحص آلي أولي وقد يخطئ. ليس نصيحة مالية. البوت لا يطلب أبداً المفتاح الخاص أو ربط المحفظة.",
             "en": "🤖 Automatic first-pass check; it can be wrong. Not financial advice. The bot never asks for private keys or wallet connections."},
    "b_alert": {"fa": "🔔 هشدار ±{p}٪", "ckb": "🔔 ئاگاداری ±{p}٪", "kmr": "🔔 Hişyarî ±{p}%", "ar": "🔔 تنبيه ±{p}٪", "en": "🔔 Alert ±{p}%"},
    "ask": {"fa": "🔎 آدرس قرارداد توکن (CA) را بفرست — اتریوم، BSC، Base، سولانا، ترون، TON…\nمثال: <code>0x6982508145454Ce325dDbE47a25d4ec3d2311933</code>",
            "ckb": "🔎 ناونیشانی گرێبەستی تۆکن (CA) بنێرە — ئیتریۆم، BSC، Base، سۆلانا، ترۆن، TON…",
            "kmr": "🔎 Navnîşana peymana tokenê (CA) bişîne — Ethereum, BSC, Base, Solana, Tron, TON…",
            "ar": "🔎 أرسل عنوان عقد الرمز (CA) — إيثريوم، BSC، Base، سولانا، ترون، TON…",
            "en": "🔎 Send a token contract address (CA) — Ethereum, BSC, Base, Solana, Tron, TON…\nExample: <code>0x6982508145454Ce325dDbE47a25d4ec3d2311933</code>"},
}


def lookup(addr):
    """-> (pair, sec, hp, analysis) or (None, …) if not found"""
    pairs = pairs_for([addr])
    pair = best_pair(pairs, addr)
    if not pair:
        return None, None, None, None
    chain = pair.get("chainId")
    real = (pair.get("baseToken") or {}).get("address") or addr
    sec = goplus(chain, real)
    hp = honeypot(chain, real)
    return pair, sec, hp, analyze(pair, sec, hp, chain)


def card(addr, lang, esc=lambda x: x):
    """-> (text, keyboard rows)"""
    try:
        pair, sec, hp, a = lookup(addr)
    except Exception:
        log.exception("token lookup failed")
        pair = None
    if not pair:
        return L(H["notfound"], lang) + f"\n<code>{esc(addr)}</code>", []
    bt = pair.get("baseToken") or {}
    st = a["stats"]
    tx = (pair.get("txns") or {}).get("h24") or {}
    pc = pair.get("priceChange") or {}
    vol = (pair.get("volume") or {}).get("h24")
    out = [L(H["head"], lang),
           f"<b>{esc(bt.get('name', '?'))}</b> (${esc(bt.get('symbol', '?'))}) · {esc(pair.get('chainId', ''))} · {esc(pair.get('dexId', ''))}",
           f"<code>{esc(bt.get('address', addr))}</code>", "",
           f"💲 {L(H['price'], lang)}: <b>{_price(pair.get('priceUsd'))}</b>  "
           f"(1h {_f(pc.get('h1')) or 0:+.1f}% · 24h {_f(pc.get('h24')) or 0:+.1f}%)",
           f"🏦 {L(H['mcap'], lang)}: {_usd(st.get('mcap'))}",
           f"💧 {L(H['liq'], lang)}: {_usd(st.get('liq'))}",
           f"📊 {L(H['vol'], lang)}: {_usd(_f(vol))}",
           f"🔁 {L(H['tx'], lang)}: {tx.get('buys', 0)} / {tx.get('sells', 0)}",
           f"⏳ {L(H['age'], lang)}: {_age_txt(pair.get('pairCreatedAt'))}"]
    if st.get("holders") is not None:
        out.append(f"👥 {L(H['holders'], lang)}: {st['holders']:,}")
    if st.get("sell_tax") is not None or st.get("buy_tax") is not None:
        out.append(f"🧾 {L(H['tax'], lang)}: {_pct(st.get('buy_tax'))} / {_pct(st.get('sell_tax'))}")
    out += ["", f"<b>{L(VERDICT[a['level']], lang)}</b>  ({a['score']}/100)", L(H["flags"], lang)]
    if a["flags"]:
        out += ["• " + L(FLAG[k], lang, **kw) for k, kw in a["flags"][:10]]
    else:
        out.append(L(H["noflags"], lang))
    if not a["checked"]["sec"]:
        out.append(L(H["nosec"], lang))
    out += ["", L(H["disc"], lang)]
    real = bt.get("address") or addr
    rows = [[{"text": "🔄", "callback_data": f"tk:{real}"[:64]},
             {"text": L(H["b_alert"], lang, p=20), "callback_data": f"ta:{real}:20"[:64]}],
            [{"text": "📈 DexScreener", "url": pair.get("url") or f"https://dexscreener.com/search?q={real}"}]]
    return "\n".join(out), rows


# ------------------------------------------------------------------ token alerts (price ±% and liquidity pull)
MAX_TALERTS = 0          # 0 = no limit
TA = {
    "set": {"fa": "🔔 هشدار ثبت شد: ${s} اگر ±{p}٪ تکان بخورد یا نقدینگی‌اش نصف شود خبرت می‌کنم. (قیمت فعلی {now})",
            "ckb": "🔔 ئاگاداری تۆمارکرا: ${s} ئەگەر ±{p}٪ جووڵا یان لیکویدیتی نیوە بوو ئاگادارت دەکەم. (ئێستا {now})",
            "kmr": "🔔 Hişyarî hat danîn: ${s} heke ±{p}% biçe an likîdîte nîv bibe, ez ê te agahdar bikim. (niha {now})",
            "ar": "🔔 تم ضبط التنبيه: ${s} سأنبهك إذا تحرك ±{p}٪ أو انخفضت السيولة للنصف. (الآن {now})",
            "en": "🔔 Alert set: ${s} — I'll ping you on a ±{p}% move or if its liquidity halves. (now {now})"},
    "max": {"fa": "حداکثر هشدار توکن پر شده است.", "ckb": "ژمارەی ئاگاداری تۆکن پڕە.", "kmr": "Herî zêde 5 hişyariyên tokenê.",
            "ar": "الحد الأقصى 5 تنبيهات للرموز.", "en": "Max 5 active token alerts."},
    "hit": {"fa": "🚨 <b>${s}</b> {d} {pct}٪ (از {a} به {b})", "ckb": "🚨 <b>${s}</b> {d} {pct}٪ ({a} ← {b})",
            "kmr": "🚨 <b>${s}</b> {d} {pct}% ({a} → {b})", "ar": "🚨 <b>${s}</b> {d} {pct}٪ (من {a} إلى {b})",
            "en": "🚨 <b>${s}</b> {d} {pct}% ({a} → {b})"},
    "rug": {"fa": "🆘 <b>نقدینگی ${s} {pct}٪ کم شد</b> ({a} → {b}). ممکن است نقدینگی کشیده شده باشد (راگ).",
            "ckb": "🆘 <b>لیکویدیتی ${s} {pct}٪ کەم بوو</b> ({a} ← {b}). لەوانەیە ڕاگ بێت.",
            "kmr": "🆘 <b>Likîdîteya ${s} {pct}% kêm bû</b> ({a} → {b}). Dibe ku rug be.",
            "ar": "🆘 <b>انخفضت سيولة ${s} بنسبة {pct}٪</b> ({a} ← {b}). قد تكون السيولة سُحبت (Rug).",
            "en": "🆘 <b>${s} liquidity fell {pct}%</b> ({a} → {b}). Liquidity may have been pulled (rug)."},
    "up": {"fa": "رشد", "ckb": "بەرزبوونەوە", "kmr": "bilind bû", "ar": "ارتفع", "en": "up"},
    "down": {"fa": "افت", "ckb": "دابەزین", "kmr": "daket", "ar": "انخفض", "en": "down"},
}


def add_alert(x, addr, pct, lang):
    al = x.setdefault("talerts", [])
    al[:] = [a for a in al if a["a"].lower() != addr.lower()]
    if MAX_TALERTS and len(al) >= MAX_TALERTS:
        return L(TA["max"], lang)
    pair = best_pair(pairs_for([addr]), addr)
    if not pair:
        return L(H["notfound"], lang)
    sym = _esc((pair.get("baseToken") or {}).get("symbol", "?"))[:20]
    price = _f(pair.get("priceUsd"))
    liq = _f((pair.get("liquidity") or {}).get("usd"))
    al.append({"a": addr, "s": sym, "ref": price, "liq": liq, "pair": pair.get("pairAddress"), "pct": float(pct),
               "at": int(time.time())})
    return L(TA["set"], lang, s=sym, p=int(pct), now=_price(price))


_last_check = [0.0]


def check_alerts(s, send):
    """every 2 min; one DexScreener call per 30 distinct tokens. send(uid, text). -> changed"""
    if time.time() - _last_check[0] < 120:
        return False
    _last_check[0] = time.time()
    watch = {}
    for uid, x in list(s["users"].items()):
        for a in list(x.get("talerts", [])):
            watch.setdefault(a["a"], []).append((uid, x, a))
    if not watch:
        return False
    addrs = list(watch)
    pairs = pairs_for(addrs)
    changed = False
    for addr, subs in watch.items():
        best = best_pair(pairs, addr)
        if not best:
            continue
        for uid, x, a in subs:
            # compare liquidity on the SAME pool; a missing pool in this answer is "unknown", never "rug"
            same = [q for q in pairs if a.get("pair") and q.get("pairAddress") == a["pair"]]
            p = same[0] if same else (best if not a.get("pair") else None)
            if p is None:
                continue
            now, liq = _f(p.get("priceUsd")), _f((p.get("liquidity") or {}).get("usd"))
            lang = x.get("lang", "fa")
            msg = None
            if a.get("liq") and liq is not None and liq < a["liq"] * 0.5:
                msg = L(TA["rug"], lang, s=a["s"], pct=f"{(1 - liq / a['liq']) * 100:.0f}", a=_usd(a["liq"]), b=_usd(liq))
            elif a.get("ref") and now:
                ch = (now / a["ref"] - 1) * 100
                if abs(ch) >= a["pct"]:
                    msg = L(TA["hit"], lang, s=a["s"], d=L(TA["up" if ch > 0 else "down"], lang), pct=f"{ch:+.1f}",
                            a=_price(a["ref"]), b=_price(now))
            if msg:
                send(int(uid), msg, [[{"text": "🔎 " + a["s"], "callback_data": f"tk:{addr}"[:64]}]])
                x["talerts"] = [b for b in x["talerts"] if b is not a]
                changed = True
    return changed


# ------------------------------------------------------------------ new-launch alerts (quality-filtered)
LAUNCH = {
    "head": {"fa": "🚀 <b>لانچ جدید (فیلترشده)</b>", "ckb": "🚀 <b>لانچی نوێ (فلتەرکراو)</b>", "kmr": "🚀 <b>Destpêka nû (parzûnkirî)</b>",
             "ar": "🚀 <b>إطلاق جديد (مُصفّى)</b>", "en": "🚀 <b>New launch (filtered)</b>"},
    "warn": {"fa": "⚠️ توکن‌های تازه پرریسک‌ترین بخش بازارند؛ بیشترشان به صفر می‌رسند. فقط پولی که از دست دادنش مهم نیست. این سیگنال خرید نیست.",
             "ckb": "⚠️ تۆکنە نوێیەکان پڕمەترسیترین بەشی بازاڕن؛ زۆربەیان دەگەنە سفر. ئەمە سیگناڵی کڕین نییە.",
             "kmr": "⚠️ Tokenên nû beşa herî bi xeter a bazarê ne; piraniya wan digihîjin sifirê. Ev ne sînyala kirînê ye.",
             "ar": "⚠️ الرموز الجديدة أخطر جزء في السوق ومعظمها ينتهي إلى الصفر. هذه ليست إشارة شراء.",
             "en": "⚠️ New tokens are the riskiest corner of the market; most go to zero. This is not a buy signal."},
    "why": {"fa": "✅ از فیلتر کیفیت رد شد: نقدینگی ≥ {liq}، حجم، فروش ممکن، بدون هانی‌پات، مالیات ≤ ۱۰٪، تمرکز هولدر قابل قبول.",
            "ckb": "✅ لە فلتەری کوالیتی تێپەڕی: لیکویدیتی ≥ {liq}، قەبارە، فرۆشتن دەکرێت، بێ هانی‌پۆت، باج ≤ ١٠٪.",
            "kmr": "✅ Ji parzûna kalîteyê derbas bû: likîdîte ≥ {liq}, qebare, firotin gengaz, ne honeypot, bac ≤ 10%.",
            "ar": "✅ اجتاز فلتر الجودة: سيولة ≥ {liq}، حجم، البيع ممكن، ليس فخاً، ضريبة ≤ 10٪.",
            "en": "✅ Passed the quality filter: liquidity ≥ {liq}, real volume, sellable, not a honeypot, tax ≤ 10%, holders not too concentrated."},
}
LAUNCH_MIN_LIQ = 30_000
LAUNCH_MAX_PER_HOUR = 4
_launch_last = [0.0]


def quality(pair, a):
    """the filter that decides if a brand-new token is worth showing at all"""
    if not pair or not a or a["level"] in ("scam", "severe", "high"):
        return False
    liq = a["stats"].get("liq") or 0
    tx1 = (pair.get("txns") or {}).get("h1") or {}
    vol1 = _f((pair.get("volume") or {}).get("h1")) or 0
    ch1 = _f((pair.get("priceChange") or {}).get("h1")) or 0
    age_h = (time.time() * 1000 - float(pair.get("pairCreatedAt") or 0)) / 3.6e6
    top = a["stats"].get("top10")
    taxes_ok = (a["stats"].get("sell_tax") or 0) <= 0.10 and (a["stats"].get("buy_tax") or 0) <= 0.10
    return (taxes_ok and liq >= LAUNCH_MIN_LIQ and vol1 >= 20_000 and (tx1.get("buys") or 0) >= 30 and (tx1.get("sells") or 0) >= 10
            and ch1 > -30 and age_h <= 72 and a["checked"]["sec"] and (top is None or top <= 0.4))


def scan_launches(s, send_many):
    """every 5 min: new DexScreener token profiles → full check → subscribers. send_many(text, rows, langs_text_fn)"""
    if time.time() - _launch_last[0] < 300:
        return False
    _launch_last[0] = time.time()
    subs = [(uid, x) for uid, x in list(s["users"].items()) if (x.get("subs") or {}).get("launch")]
    if not subs:
        return False
    first = "launch_seen" not in s
    seen = s.setdefault("launch_seen", [])
    prof = _get(f"{DEX}/token-profiles/latest/v1", ttl=240) or []
    if first:                                   # first run: remember what exists, alert only on later launches
        seen += [p.get("tokenAddress") for p in prof if isinstance(p, dict) and p.get("tokenAddress")]
        return True
    new = []
    for p in prof if isinstance(prof, list) else []:
        a = p.get("tokenAddress")
        if a and a not in seen:
            seen.append(a)
            new.append(a)
    del seen[:-600]
    if not new:
        return True
    pairs = pairs_for(new[:30])
    hour = int(time.time() // 3600)
    sent = s.setdefault("launch_sent", {"h": hour, "n": 0})
    if sent["h"] != hour:
        sent.update(h=hour, n=0)
    for addr in new[:30]:
        if sent["n"] >= LAUNCH_MAX_PER_HOUR:
            break
        pair = best_pair(pairs, addr)
        if not pair:
            continue
        # cheap pre-filter before the security calls
        if (_f((pair.get("liquidity") or {}).get("usd")) or 0) < LAUNCH_MIN_LIQ:
            continue
        chain = pair.get("chainId")
        sec = goplus(chain, addr)
        hp = honeypot(chain, addr)
        a = analyze(pair, sec, hp, chain)
        if not quality(pair, a):
            continue
        sent["n"] += 1
        send_many(subs, addr)
    return True
