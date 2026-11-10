#!/usr/bin/env python3
"""Probabilistic market-regime radar (BTC) — a Gaussian hidden Markov model in plain Python.

Instead of one hard label ("bull"), this says how likely each regime is today, how sure the model
is, and how likely a switch is. Four hidden states are fitted on daily BTC features and named by what
they turn out to be:  bull · bear · sideways · high_vol.

Features per closed daily bar (log space, standardised on the training window only):
    r1  : the day's log return
    vol : log of 10-day realised volatility (RMS of daily log returns)
    mom : 20-day log return (momentum)

Honesty rules this file keeps:
  * Only closed daily bars; today's open bar is never used.
  * Filtered probabilities only (forward pass): the probability for day t uses days <= t, never later.
  * The regime HISTORY is out-of-sample, walk-forward: for each calendar year from 2019 on, the model is
    fitted only on the days before that year, then run forward through it. So "what followed regime X"
    statistics never benefit from hindsight. Today's probabilities come from a fit on all closed days.
  * The evaluation (forward 30-day return / volatility per regime) is published whatever it shows.

Output: data/regime.json (also read by the Truth Lab to break signal results down by regime).
Run:    python3 scripts/regime.py            (skips if today's closed bar is already done; FORCE=1 to redo)
"""
import math
import os
import random
import sys
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import reality_common as R  # noqa: E402
import regime_rules as RR  # noqa: E402

VERSION = 4          # bump to force a refit when the model or the naming changes
COIN = "BTC"
K = 4
LABELS = ["bull", "bear", "sideways", "high_vol"]
START = datetime(2017, 8, 17, tzinfo=timezone.utc)
OOS_FROM = 2019
SEEDS = (11, 23, 37, 59)
ITERS_FULL, ITERS_WF, TOL = 120, 40, 1e-4
VAR_FLOOR = 1e-3


# ------------------------------------------------------------------ data
def daily_bars():
    now = datetime.now(timezone.utc)
    today0 = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)
    bars = R.klines_range(COIN, "1d", R.ms(START), R.ms(today0) - 1)
    return [b for b in bars if b["t"] < R.ms(today0)]          # closed bars only


def features(bars):
    """rows from day 20 on: (date, close, [r1, vol, mom])"""
    c = [b["c"] for b in bars]
    lr = [0.0] + [math.log(c[i] / c[i - 1]) for i in range(1, len(c))]
    out = []
    for i in range(20, len(c)):
        vol = math.sqrt(sum(x * x for x in lr[i - 9:i + 1]) / 10) or 1e-6
        out.append((R.day(R.from_ms(bars[i]["t"])), c[i], [lr[i], math.log(vol), math.log(c[i] / c[i - 20])]))
    return out


def standardise(X, mu=None, sd=None):
    D = len(X[0])
    if mu is None:
        mu = [sum(x[d] for x in X) / len(X) for d in range(D)]
        sd = [math.sqrt(sum((x[d] - mu[d]) ** 2 for x in X) / len(X)) or 1.0 for d in range(D)]
    return [[(x[d] - mu[d]) / sd[d] for d in range(D)] for x in X], mu, sd


# ------------------------------------------------------------------ Gaussian HMM (diagonal), scaled forward-backward
def log_emis(x, m, v):
    return -0.5 * sum(math.log(2 * math.pi * v[d]) + (x[d] - m[d]) ** 2 / v[d] for d in range(len(x)))


def emissions(X, P):
    """per t: normalised emission probabilities and the log of the normaliser"""
    B, S = [], []
    for x in X:
        lb = [log_emis(x, P["mu"][k], P["var"][k]) for k in range(K)]
        mx = max(lb)
        B.append([math.exp(z - mx) for z in lb])
        S.append(mx)
    return B, S


def forward(X, P, B=None, S=None):
    if B is None:
        B, S = emissions(X, P)
    A, pi = P["A"], P["pi"]
    alpha, cs, ll = [], [], 0.0
    prev = None
    for t in range(len(X)):
        if prev is None:
            a = [pi[k] * B[t][k] for k in range(K)]
        else:
            a = [B[t][j] * sum(prev[i] * A[i][j] for i in range(K)) for j in range(K)]
        c = sum(a) or 1e-300
        a = [z / c for z in a]
        alpha.append(a)
        cs.append(c)
        ll += math.log(c) + S[t]
        prev = a
    return alpha, cs, ll, B


def em(X, P, iters):
    T, D = len(X), len(X[0])
    last = -1e300
    for _ in range(iters):
        alpha, cs, ll, B = forward(X, P)
        A = P["A"]
        beta = [[1.0] * K for _ in range(T)]
        for t in range(T - 2, -1, -1):
            nb = [B[t + 1][j] * beta[t + 1][j] for j in range(K)]
            beta[t] = [sum(A[i][j] * nb[j] for j in range(K)) / cs[t + 1] for i in range(K)]
        gamma = []
        for t in range(T):
            g = [alpha[t][k] * beta[t][k] for k in range(K)]
            s = sum(g) or 1e-300
            gamma.append([z / s for z in g])
        xi = [[0.0] * K for _ in range(K)]
        for t in range(T - 1):
            nb = [B[t + 1][j] * beta[t + 1][j] for j in range(K)]
            s = 0.0
            tmp = [[0.0] * K for _ in range(K)]
            for i in range(K):
                ai = alpha[t][i]
                for j in range(K):
                    v = ai * A[i][j] * nb[j]
                    tmp[i][j] = v
                    s += v
            s = s or 1e-300
            for i in range(K):
                for j in range(K):
                    xi[i][j] += tmp[i][j] / s
        newA = []
        for i in range(K):
            row = [xi[i][j] + 1e-6 for j in range(K)]
            rs = sum(row)
            newA.append([z / rs for z in row])
        mu, var = [], []
        for k in range(K):
            w = sum(gamma[t][k] for t in range(T)) or 1e-9
            m = [sum(gamma[t][k] * X[t][d] for t in range(T)) / w for d in range(D)]
            v = [max(VAR_FLOOR, sum(gamma[t][k] * (X[t][d] - m[d]) ** 2 for t in range(T)) / w) for d in range(D)]
            mu.append(m)
            var.append(v)
        P = {"pi": gamma[0], "A": newA, "mu": mu, "var": var}
        if abs(ll - last) < TOL * abs(last):
            break
        last = ll
    _, _, ll, _ = forward(X, P)
    return P, ll


def init_params(X, seed):
    rng = random.Random(seed)
    D = len(X[0])
    pick = rng.sample(range(len(X)), K)
    return {"pi": [1.0 / K] * K, "A": [[0.9 if i == j else 0.1 / (K - 1) for j in range(K)] for i in range(K)],
            "mu": [list(X[p]) for p in pick], "var": [[1.0] * D for _ in range(K)]}


def fit(X, iters, warm=None):
    best = None
    starts = [warm] if warm else [init_params(X, s) for s in SEEDS]
    for P0 in starts:
        P, ll = em(X, P0, iters)
        if best is None or ll > best[1]:
            best = (P, ll)
    return best


def stationary(A):
    """long-run share of days in each hidden state (power iteration on the transition matrix)"""
    k = len(A)
    w = [1.0 / k] * k
    for _ in range(500):
        w2 = [sum(w[i] * A[i][j] for i in range(k)) for j in range(k)]
        if max(abs(x - y) for x, y in zip(w, w2)) < 1e-12:
            break
        w = w2
    return w


def name_states(P, sd, mu0):
    """map hidden states to labels from what they are: lowest 20-day momentum -> bear, highest -> bull;
    the states in between are split by volatility: the calmer half sideways, the more volatile half high_vol.
    With K = 4 that is one state each; with more states a label gathers several (their probabilities add up)."""
    k = len(P["A"])
    vol = [P["mu"][j][1] for j in range(k)]
    mom = [P["mu"][j][2] for j in range(k)]
    by_mom = sorted(range(k), key=lambda j: mom[j])
    mid = sorted(by_mom[1:-1], key=lambda j: vol[j])
    half = (len(mid) + 1) // 2
    names = {by_mom[0]: "bear", by_mom[-1]: "bull"}
    names.update({j: "sideways" for j in mid[:half]})
    names.update({j: "high_vol" for j in mid[half:]})
    w = stationary(P["A"])
    tr = trans_by_label(P, names, w)
    real = {}
    for lb in LABELS:
        js = [j for j in range(k) if names[j] == lb]
        if not js:
            continue
        ws = sum(w[j] for j in js) or 1e-12
        avg = lambda f: sum(w[j] * f(j) for j in js) / ws  # noqa: E731
        stay = tr[lb][lb]
        real[lb] = {"mom20_pct": round(100 * (math.exp(avg(lambda j: P["mu"][j][2]) * sd[2] + mu0[2]) - 1), 2),
                    "vol10_pct": round(100 * math.exp(avg(lambda j: P["mu"][j][1]) * sd[1] + mu0[1]), 2),
                    "stay": round(stay, 4), "mean_days": round(1 / max(1e-6, 1 - stay), 1), "states": len(js)}
    return names, real


def trans_by_label(P, names, w=None):
    """one-day transition probabilities between labels: states of a label are weighted by their long-run share"""
    k = len(P["A"])
    w = w or stationary(P["A"])
    out = {}
    for a in LABELS:
        ia = [i for i in range(k) if names[i] == a]
        wa = sum(w[i] for i in ia)
        if not ia or wa <= 0:
            continue
        out[a] = {b: sum(w[i] * sum(P["A"][i][j] for j in range(k) if names[j] == b) for i in ia) / wa
                  for b in LABELS if any(names[j] == b for j in range(k))}
    return out


def by_label(probs, names):
    out = {lb: 0.0 for lb in LABELS}
    for k in range(K):
        out[names[k]] += probs[k]
    return out


def fng_history():
    """{date: Fear & Greed} — full history from alternative.me, else the strategy-lab copy"""
    try:
        j = R.http_json("https://api.alternative.me/fng/", {"limit": 0, "format": "json"})
        out = {R.day(R.from_ms(int(x["timestamp"]) * 1000)): int(x["value"]) for x in j.get("data") or []}
        if out:
            return out
    except Exception as ex:  # noqa: BLE001
        print("regime: fng history failed:", ex)
    lc = R.load("lab_context.json", {})
    if lc.get("fng"):
        d0 = datetime.strptime(lc["from"], "%Y-%m-%d")
        return {(d0 + timedelta(days=i)).strftime("%Y-%m-%d"): v for i, v in enumerate(lc["fng"]) if v is not None}
    return {}


def rule_layer(dates, closes, idx, _labels, summ, fwd, od, tops):
    try:
        st = (R.load("silent_exit_store.json", {}).get("daily") or {}).get("BTC") or {}
        fund = {d: v["f"] for d, v in st.items() if v.get("f") is not None}
        _, raw, conf, rows = RR.compute(dates, closes, fng_history(), fund)
    except Exception as ex:  # noqa: BLE001
        print("regime: rule layer failed:", ex)
        return None
    i = len(dates) - 1
    r = rows[i]
    if not r:
        return None
    pend_lab, pend_n = r["pending"]
    dims = [{"k": k, "v": None if v is None else round(v, 4), "vote": r["votes"][k], "th": RR.TH[k]} for k, v in r["dims"].items()]
    daily = {dates[j]: LABELS.index(conf[j]) for j in range(len(dates)) if conf[j]}
    rawd = {dates[j]: raw[j] for j in range(len(dates)) if raw[j]}
    oos = [d for d in sorted(daily) if d >= f"{OOS_FROM}-01-01"]
    groups = {lb: [] for lb in LABELS}
    allv = []
    for d in oos:
        f = fwd(idx[d])
        if f:
            groups[LABELS[daily[d]]].append(f)
            allv.append(f)
    ev = {lb: summ(groups[lb]) for lb in LABELS}
    ev["all"] = summ(allv)
    ch = [{"d": oos[j], "from": LABELS[daily[oos[j - 1]]], "to": LABELS[daily[oos[j]]]}
          for j in range(1, len(oos)) if daily[oos[j]] != daily[oos[j - 1]]]
    run = 1
    for j in range(len(oos) - 1, 0, -1):
        if daily[oos[j - 1]] != daily[oos[-1]]:
            break
        run += 1
    hmm_daily = {d: t for d, t in zip(od, tops)}
    return {
        "confirm_days": RR.CONFIRM,
        "now": {"date": dates[i], "label": conf[i], "raw": raw[i], "score": round(r["score"], 3),
                "vol_pct": None if r["vpct"] is None else round(r["vpct"], 3), "dims": dims, "days_in": run,
                "pending": {"to": pend_lab, "days": pend_n, "need": RR.CONFIRM} if pend_lab else None},
        "daily": daily,
        "history": [{"d": d, "l": daily[d], "h": LABELS.index(hmm_daily[d]) if d in hmm_daily else None} for d in oos[-420:]],
        "changes": ch[-30:],
        "flips": {"rule": RR.flips_per_year({d: daily[d] for d in oos}), "raw": RR.flips_per_year({d: rawd[d] for d in oos if d in rawd}),
                  "hmm": RR.flips_per_year(hmm_daily)},
        "eval": ev,
    }


# ------------------------------------------------------------------ main
# ------------------------------------------------------------------ how many hidden states?
K_TRY = (3, 4, 5, 6)
K_USE = (4, 5, 6)          # the site names four regime types, so the live model needs at least four states
GAIN_MIN = 0.05            # a state is worth adding only if it raises the out-of-sample information by 5 % or more
SELECT_EVERY = 28          # days between re-runs (the answer moves slowly; it costs a few minutes)


NULL_REPS = 200


def eta2(groups):
    """share of the variance of the next 30-day return explained by the regime label, pooled over year-fits"""
    allf = [f for _, fw in groups for f in fw]
    if not allf:
        return 0.0
    m = sum(allf) / len(allf)
    sst = sum((f - m) ** 2 for f in allf) or 1e-12
    ssb = 0.0
    for tops, fw in groups:
        acc = {}
        for st, f in zip(tops, fw):
            a = acc.setdefault(st, [0.0, 0])
            a[0] += f
            a[1] += 1
        ssb += sum(n * (sm / n - m) ** 2 for sm, n in acc.values())
    return ssb / sst


def select_k(dates, closes, raw):
    """BIC, out-of-sample log-likelihood, out-of-sample information and stability for K = 3..6.
    BIC and likelihood keep improving with every extra state on this data (fat tails and overlapping windows
    reward more Gaussian pieces), so they cannot choose on their own. The choice is the smallest K (of 4..6)
    after which one more state adds under 5 % of information: how much of the next 30-day return the
    out-of-sample regime explains (eta squared, by year-fit) above chance — chance being the same label streaks
    shifted in time, since more labels explain more by luck alone — shown next to how often the regime flips."""
    global K
    keep = K
    T = len(raw)
    years = sorted({int(d[:4]) for d in dates if int(d[:4]) >= OOS_FROM})
    rows = []
    for k in K_TRY:
        K = k
        X, _, _ = standardise(raw)
        _, ll = fit(X, ITERS_FULL)
        npar = (k - 1) + k * (k - 1) + 2 * k * len(raw[0])
        oos_ll = oos_n = 0
        groups, runs = [], []
        warm = None
        for y in years:
            cut = next(i for i, d in enumerate(dates) if int(d[:4]) >= y)
            end = next((i for i, d in enumerate(dates) if int(d[:4]) > y), len(dates))
            tr, mu0, sd0 = standardise(raw[:cut])
            P, _ = fit(tr, ITERS_WF if warm else ITERS_FULL, warm)
            warm = P
            Xa, _, _ = standardise(raw[:end], mu0, sd0)
            al, _, lla, _ = forward(Xa, P)
            _, _, llb, _ = forward(Xa[:cut], P)
            oos_ll += lla - llb
            oos_n += end - cut
            tops = [max(range(k), key=lambda j: al[t][j]) for t in range(cut, end)]
            fw = [closes[t + 30] / closes[t] - 1 for t in range(cut, end) if t + 30 < len(closes)]
            groups.append((tops[:len(fw)], fw))
            r = 1
            for a_, b_ in zip(tops, tops[1:]):
                if a_ == b_:
                    r += 1
                else:
                    runs.append(r)
                    r = 1
            runs.append(r)
        obs = eta2(groups)
        # chance level: the same label sequences shifted in time against the returns (keeps both streaks intact)
        rng = random.Random(5)
        null = []
        for _ in range(NULL_REPS):
            sh = []
            for tops, fw in groups:
                n = len(tops)
                if n < 90:
                    sh.append((tops, fw))
                    continue
                o = rng.randrange(45, n - 45)
                sh.append((tops[o:] + tops[:o], fw))
            null.append(eta2(sh))
        chance = sum(null) / len(null)
        rows.append({"k": k, "bic": round(-2 * ll + npar * math.log(T), 1), "loglik": round(ll, 1), "params": npar,
                     "oos_ll_day": round(oos_ll / max(1, oos_n), 4), "info_raw": round(obs, 4), "info_chance": round(chance, 4),
                     "info": round(obs - chance, 4),
                     "median_run": sorted(runs)[len(runs) // 2], "flips_year": round(len(runs) / max(1, len(years)), 1)})
        print(f"regime select: K={k} bic={rows[-1]['bic']} oos={rows[-1]['oos_ll_day']} info={rows[-1]['info']} "
              f"(raw {rows[-1]['info_raw']} chance {rows[-1]['info_chance']}) "
              f"run={rows[-1]['median_run']} flips/yr={rows[-1]['flips_year']}")
    K = keep
    info = {r["k"]: r["info"] for r in rows}
    if max(info[k] for k in K_USE) <= 0:
        # no number of states explains the coming month better than chance: take the simplest model
        chosen, reason = K_USE[0], "no_info"
    else:
        chosen, reason = K_USE[-1], "info_gain"
        for k in K_USE:
            nxt = info.get(k + 1)
            if nxt is None or nxt - info[k] < GAIN_MIN * max(info[k], 1e-9):
                chosen = k
                break
    bic_best = min(rows, key=lambda r: r["bic"])["k"]
    return {"date": dates[-1], "rows": rows, "chosen": chosen, "bic_best": bic_best, "rule": reason,
            "gain_min": GAIN_MIN, "k_use": list(K_USE)}


def main():
    prev = R.load("regime.json", {})
    bars = daily_bars()
    rows = features(bars)
    last_day = rows[-1][0]
    if prev.get("now", {}).get("date") == last_day and prev.get("version") == VERSION and not os.environ.get("FORCE"):
        print(f"regime: {last_day} already done")
        return
    dates = [r[0] for r in rows]
    closes = [r[1] for r in rows]
    raw = [r[2] for r in rows]

    # ---- number of hidden states: re-chosen every SELECT_EVERY days (select_k)
    global K
    sel = prev.get("select") if prev.get("version") == VERSION else None
    if not sel or (datetime.strptime(last_day, "%Y-%m-%d") - datetime.strptime(sel["date"], "%Y-%m-%d")).days >= SELECT_EVERY \
            or os.environ.get("RESELECT"):
        try:
            sel = select_k(dates, closes, raw)
        except Exception as ex:  # noqa: BLE001
            print("regime select failed:", ex)
            sel = sel or {"chosen": 4, "rows": [], "date": last_day}
    K = sel.get("chosen") or 4

    # ---- walk-forward, out-of-sample history
    hist = {}
    warm = None
    years = sorted({int(d[:4]) for d in dates if int(d[:4]) >= OOS_FROM})
    for y in years:
        cut = dates.index(next(d for d in dates if int(d[:4]) >= y))
        train, mu0, sd0 = standardise(raw[:cut])
        P, _ = fit(train, ITERS_WF if warm else ITERS_FULL, warm)
        warm = P
        names, _ = name_states(P, sd0, mu0)
        Xall, _, _ = standardise(raw, mu0, sd0)
        end = next((i for i, d in enumerate(dates) if int(d[:4]) > y), len(dates))
        alpha, _, _, _ = forward(Xall[:end], P)
        for t in range(cut, end):
            hist[dates[t]] = by_label(alpha[t], names)
        print(f"regime: walk-forward {y}: trained on {cut} days, filtered {end - cut}")

    # ---- today: fit on every closed day
    X, mu0, sd0 = standardise(raw)
    P, ll = fit(X, ITERS_FULL)
    names, states = name_states(P, sd0, mu0)
    alpha, _, _, _ = forward(X, P)
    p_now = by_label(alpha[-1], names)
    nxt_raw = [sum(alpha[-1][i] * P["A"][i][j] for i in range(K)) for j in range(K)]
    p_next = by_label(nxt_raw, names)
    # chance of a different label tomorrow (moving between two states of the same label is not a switch)
    switch = sum(alpha[-1][i] * sum(P["A"][i][j] for j in range(K) if names[j] != names[i]) for i in range(K))
    top = max(p_now, key=p_now.get)

    # ---- run lengths and changes on the out-of-sample history
    od = sorted(hist)
    tops = [max(hist[d], key=hist[d].get) for d in od]
    changes = [{"d": od[i], "from": tops[i - 1], "to": tops[i]} for i in range(1, len(od)) if tops[i] != tops[i - 1]]
    run = 1
    for i in range(len(tops) - 1, 0, -1):
        if tops[i - 1] != tops[-1]:
            break
        run += 1

    # ---- does the regime carry information? forward 30-day return and volatility per OOS regime
    idx = {d: i for i, d in enumerate(dates)}
    lr = [0.0] + [math.log(closes[i] / closes[i - 1]) for i in range(1, len(closes))]

    def fwd(i, h=30):
        if i + h >= len(closes):
            return None
        r = closes[i + h] / closes[i] - 1
        v = math.sqrt(sum(x * x for x in lr[i + 1:i + h + 1]) / h) * math.sqrt(365)
        return r, v

    groups = {lb: [] for lb in LABELS}
    allv = []
    for d, tp in zip(od, tops):
        f = fwd(idx[d])
        if f:
            groups[tp].append(f)
            allv.append(f)

    def summ(g):
        if not g:
            return {"n": 0}
        rs = [x[0] for x in g]
        return {"n": len(g), "fwd30_mean": round(100 * sum(rs) / len(rs), 2), "fwd30_median": round(100 * R.median(rs), 2),
                "fwd30_up": round(100 * sum(1 for x in rs if x > 0) / len(rs), 1),
                "fwd30_vol": round(100 * sum(x[1] for x in g) / len(g), 1)}

    evaluation = {lb: summ(groups[lb]) for lb in LABELS}
    evaluation["all"] = summ(allv)
    # overlapping 30-day windows: effective sample is about n/30 per regime, said on the page

    # ---- explainable rule-based layer with hysteresis (regime_rules.py)
    rule = rule_layer(dates, closes, idx, groups.keys(), summ, fwd, od, tops)

    out = {
        "version": VERSION, "updated_at": R.iso(datetime.now(timezone.utc)), "coin": COIN,
        "model": {"kind": "gaussian_hmm_diag", "K": K, "k_rule": (sel or {}).get("rule"), "features": ["r1", "log_vol10", "mom20"], "fit_days": len(X),
                  "loglik": round(ll, 1), "first_day": dates[0], "oos_from": f"{OOS_FROM}-01-01"},
        "now": {"date": last_day, "price": round(closes[-1], 2), "probs": {k: round(v, 4) for k, v in p_now.items()},
                "top": top, "confidence": round(p_now[top], 4), "switch_risk": round(switch, 4),
                "next": {k: round(v, 4) for k, v in p_next.items()},
                "oos_top": tops[-1] if tops else None, "days_in": run},
        "states": states,
        # full one-day transition matrix of the fitted model, by label: trans[from][to]
        "trans": {a: {b: round(v, 4) for b, v in row.items()} for a, row in trans_by_label(P, names).items()},
        "select": sel,
        "history": [{"d": d, "p": [round(hist[d][lb], 3) for lb in LABELS]} for d in od[-420:]],
        "daily": {d: LABELS.index(t) for d, t in zip(od, tops)},
        "changes": changes[-30:],
        "eval": evaluation,
        # daily closes (from the first feature day, consecutive) so other scripts can build baselines
        "px": {"from": dates[0], "c": [round(x, 2) for x in closes]},
        "rule": rule,
    }
    R.save("regime.json", out)
    if rule:
        print(f"regime rules: {rule['now']['label']} (raw {rule['now']['raw']}, score {rule['now']['score']}), "
              f"switches/yr rules {rule['flips']['rule']} raw {rule['flips']['raw']} hmm {rule['flips']['hmm']}")
    print(f"regime: {last_day} top={top} {p_now[top]:.2f} switch={switch:.2f} days_in={run} "
          f"eval={{{', '.join(f'{k}:{v.get(chr(110))}' for k, v in evaluation.items())}}}")


if __name__ == "__main__":
    main()
