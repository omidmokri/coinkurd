#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
دادهٔ «ماشین حساب هزینه فرصت تومان» — data/opportunity.json

اگر همان پول را به‌جای رمزارز، دلار آزاد یا طلا یا سپردهٔ بانکی نگه می‌داشتید، امروز چقدر داشتید؟
همهٔ سری‌ها روزانه و تومانی‌اند (نمونه‌برداری ۱۲:۰۰ UTC = ۱۵:۳۰ تهران، همان نقطهٔ ماتریس همبستگی).

  دلار آزاد  : آرشیو کانال عمومی تیک قیمت (@NerkhDollarIRT) — scripts/localcorr.py
  تتر بازار  : @USDTTetherp
  طلای ۱۸    : از انس جهانی بازسازی می‌شود، چون تابلوی داخلی پست‌های قدیمی را پاک می‌کند:
                 گرم ۱۸ عیار = (انس ÷ ۳۱٫۱۰۳۵) × ۰٫۷۵ × دلار آزاد × k
               k از روزهایی که نرخ واقعی تابلو را داریم به‌دست می‌آید (میانگین نسبت واقعی ÷ محاسبه‌شده).
               امروز k ≈ ۰٫۹۸۶ یعنی بازار داخلی کمی زیر قیمت جهانی معامله می‌شود.
  سکه امامی  : همان روش با ۸٫۱۳۳ گرم عیار ۰٫۹۰۰ و ضریب حباب جداگانه
  رمزارزها   : کندل روزانهٔ Binance ضربدر تتر بازار ایران
  سپرده      : نرخ سالانه را خود کاربر در صفحه تعیین می‌کند؛ اینجا فقط سری تومانی ذخیره نمی‌شود

خروجی برای مرورگر فشرده است: هر سری یک آرایهٔ عدد با تاریخ شروع مشترک.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import reality_common as R  # noqa: E402

OZ = 31.1035                 # grams in a troy ounce
K18 = 0.750                  # 18 karat
COIN_G, COIN_K = 8.133, 0.900   # Emami coin: grams and karat
COINS = ["BTC", "ETH", "SOL", "BNB", "XRP", "DOGE", "TON", "ADA", "AVAX", "LINK", "DOT", "TRX",
         "LTC", "NEAR", "SUI", "APT", "ARB", "OP", "PEPE", "SHIB", "UNI", "ATOM", "XLM", "BCH"]
L = R.L
NAMES = {
    "USD": L("دلار آزاد", "دۆلاری ئازاد", "Free-market dollar"),
    "USDT": L("تتر (بازار ایران)", "تەتەر (بازاڕی ئێران)", "Tether (Iran market)"),
    "GOLD18": L("طلای ۱۸ عیار", "زێڕی ١٨ عەیار", "18k gold"),
    "COIN": L("سکه امامی", "سکەی ئیمامی", "Emami gold coin"),
    "DEPOSIT": L("سپردهٔ بانکی", "پارێزراوی بانکی", "Bank deposit"),
}


def calib(actual, computed):
    """average actual/computed over the days we have a real board price for (1.0 when we have none yet)"""
    rs = [actual[d] / computed[d] for d in actual if d in computed and computed[d]]
    if not rs:
        return 1.0, 0
    rs = sorted(rs)[max(0, len(rs) // 2 - 15):len(rs) // 2 + 16]       # middle slice: ignore odd board days
    return sum(rs) / len(rs), len(rs)


def main():
    now = R.now()
    st = R.load("iran_daily.json", {}).get("series", {})
    usd, usdt, xau = st.get("USD", {}), st.get("USDT", {}), st.get("XAU_USD", {})
    if not usd or not xau:
        print("opportunity: the toman series are not ready yet")
        return

    # gold and coin rebuilt from the global ounce, then calibrated against the real board days we do have
    g_raw = {d: (xau[d] / OZ) * K18 * usd[d] for d in usd if d in xau}
    c_raw = {d: (xau[d] / OZ) * COIN_K * COIN_G * usd[d] for d in usd if d in xau}
    kg, ng = calib(st.get("GOLD18", {}), g_raw)
    kc, nc = calib(st.get("COIN", {}), c_raw)
    gold = {d: v * kg for d, v in g_raw.items()}
    coin = {d: v * kc for d, v in c_raw.items()}
    for d, v in (st.get("GOLD18") or {}).items():       # a real board price always beats the reconstruction
        gold[d] = v
    for d, v in (st.get("COIN") or {}).items():
        coin[d] = v

    days = sorted(set(usd) & set(usdt))
    if len(days) < 3:
        print(f"opportunity: only {len(days)} shared days so far — nothing to publish yet")
        return
    d0, d1 = days[0], days[-1]

    # crypto daily closes (USD); toman value is computed in the browser as close × tether of that day
    live = {c["coin"]: c.get("price") for c in R.load("market.json", {}).get("coins", []) if c.get("price")}
    px, missing = {}, []
    for c in COINS:
        try:
            bars = R.klines(c, "1d", limit=1000)
        except Exception as ex:  # noqa: BLE001
            missing.append(c)
            print(f"  {c}: {str(ex)[:60]}")
            continue
        s = {R.day(R.from_ms(b["t"])): b["c"] for b in bars}
        if d1 not in s and live.get(c):       # today's daily candle has not closed yet: use the live price
            s[d1] = live[c]
        got = {d: round(s[d], 8) for d in days if d in s}
        if len(got) >= max(3, len(days) // 2):
            px[c] = got

    def pack(series):
        return [None if d not in series else round(series[d], 4) for d in days]

    out = {"updated_at": R.iso(now), "days": days, "from": d0, "to": d1,
           "names": NAMES,
           "toman": {"USD": pack(usd), "USDT": pack(usdt), "GOLD18": pack(gold), "COIN": pack(coin)},
           "usd": {c: pack(px[c]) for c in px},
           "coins": sorted(px),
           "calibration": {"gold_k": round(kg, 4), "gold_days": ng, "coin_k": round(kc, 4), "coin_days": nc},
           "method": {"sample": "12:00 UTC (15:30 Tehran)",
                      "gold": "(XAU/31.1035) × 0.75 × free dollar × k, k from the real board days",
                      "coin": "(XAU/31.1035) × 0.900 × 8.133 × free dollar × k",
                      "crypto": "Binance daily close × Iranian tether of the same day",
                      "deposit": "compounded daily from the annual rate the reader sets"}}
    R.save("opportunity.json", out)
    size = os.path.getsize(os.path.join(R.D, "opportunity.json")) // 1024
    print(f"opportunity: {len(days)} days {d0}→{d1}, {len(px)} coins, gold k={kg:.4f} ({ng} board days), "
          f"coin k={kc:.4f} ({nc}), {size} KB" + (f", missing {missing}" if missing else ""))


if __name__ == "__main__":
    main()
