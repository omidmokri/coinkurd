#!/usr/bin/env python3
"""Probe free market-data sources from a CI runner. Standard library only."""
import csv, io, json, lzma, re, sys, urllib.request, urllib.error

UA = "Mozilla/5.0 (compatible; entekhab-data-probe)"
RESULTS = []


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()


def day(ms):
    import datetime
    return datetime.datetime.utcfromtimestamp(ms / 1000).strftime("%Y-%m-%d")


def parse_csv(body, date_col=0, close_col=None, skip_header=True):
    rows = list(csv.reader(io.StringIO(body.decode("utf-8", "replace"))))
    if skip_header and rows:
        rows = rows[1:]
    out = []
    for r in rows:
        try:
            c = r[close_col if close_col is not None else -1]
            float(c)
            out.append((r[date_col], c))
        except Exception:
            pass
    if not out:
        raise ValueError("no numeric rows")
    out.sort()
    return "%d rows, newest %s close %s, oldest %s" % (len(out), out[-1][0], out[-1][1], out[0][0])


def p_stooq(body):
    return parse_csv(body, 0, 4)


def p_fred(body):
    return parse_csv(body, 0, 1)


def p_yahoo(body):
    j = json.loads(body)
    res = j["chart"]["result"][0]
    ts = res["timestamp"]
    cl = res["indicators"]["quote"][0]["close"]
    pairs = [(t, c) for t, c in zip(ts, cl) if c is not None]
    return "%d rows, newest %s close %s, oldest %s" % (len(pairs), day(pairs[-1][0] * 1000), pairs[-1][1], day(pairs[0][0] * 1000))


def p_binance(body):
    j = json.loads(body)
    assert isinstance(j, list) and j
    return "%d rows, newest %s close %s, oldest %s" % (len(j), day(j[-1][0]), j[-1][4], day(j[0][0]))


def p_bybit(body):
    j = json.loads(body)
    l = j["result"]["list"]
    assert l
    return "%d rows, newest %s close %s, oldest %s" % (len(l), day(int(l[0][0])), l[0][4], day(int(l[-1][0])))


def p_okx(body):
    j = json.loads(body)
    l = j["data"]
    assert l
    return "%d rows, newest %s close %s, oldest %s" % (len(l), day(int(l[0][0])), l[0][4], day(int(l[-1][0])))


def p_duka(body):
    raw = lzma.LZMADecompressor(format=lzma.FORMAT_AUTO).decompress(body)
    n = len(raw) // 24
    assert n > 0
    import struct
    t, o, c, lo, h, v = struct.unpack(">IIIIIf", raw[-24:])
    return "decompressed %d bytes, %d records (len/24), last record offset %ds closeraw %d" % (len(raw), n, t, c)


def p_alpha(body):
    j = json.loads(body)
    ts = j["Time Series (Daily)"]
    d = sorted(ts)
    return "%d rows, newest %s close %s, oldest %s" % (len(d), d[-1], ts[d[-1]]["4. close"], d[0])


def p_twelve(body):
    j = json.loads(body)
    v = j["values"]
    return "%d rows, newest %s close %s, oldest %s" % (len(v), v[0]["datetime"], v[0]["close"], v[-1]["datetime"])


def p_frank_range(body):
    j = json.loads(body)
    r = j["rates"]
    d = sorted(r)
    return "%d rows, newest %s USD %s, oldest %s" % (len(d), d[-1], r[d[-1]]["USD"], d[0])


def p_frank_latest(body):
    j = json.loads(body)
    return "date %s rates %d, e.g. EUR %s" % (j["date"], len(j["rates"]), j["rates"].get("EUR"))


def p_ecb(body):
    rows = list(csv.DictReader(io.StringIO(body.decode())))
    rows.sort(key=lambda r: r["TIME_PERIOD"])
    return "%d rows, newest %s close %s, oldest %s" % (len(rows), rows[-1]["TIME_PERIOD"], rows[-1]["OBS_VALUE"], rows[0]["TIME_PERIOD"])


def p_status(body):
    return None  # status-only


def probe(name, market, url, parser, ok_status_only=False):
    try:
        status, body = get(url)
    except Exception as e:
        line = "%s | %s | ERR | 0 | %s | FAIL" % (name, market, str(e)[:120].replace("\n", " "))
        print(line, flush=True)
        return
    head = body[:120].decode("utf-8", "replace") if not url.endswith(".bi5") and not url.endswith(".zip") else repr(body[:20])
    head = re.sub(r"\s+", " ", head)[:120]
    verdict = "FAIL"
    detail = ""
    if status == 200:
        try:
            if parser is p_status:
                verdict, detail = "OK(status only)", ""
            else:
                detail = parser(body)
                verdict = "OK"
        except Exception as e:
            verdict, detail = "FAIL(parse)", "%s: %s" % (type(e).__name__, str(e)[:80])
    elif ok_status_only:
        pass
    print("%s | %s | %s | %d | %s | %s %s" % (name, market, status, len(body), head, verdict, detail), flush=True)


def main():
    C = []
    for s in ("xauusd", "xagusd"):
        C.append(("stooq " + s, "gold/silver", "https://stooq.com/q/d/l/?s=%s&i=d" % s, p_stooq))
    for s in ("GC=F", "SI=F", "^GSPC", "^NDX", "^DJI", "AAPL", "EURUSD=X", "DX-Y.NYB"):
        C.append(("yahoo " + s, "yahoo", "https://query1.finance.yahoo.com/v8/finance/chart/%s?range=max&interval=1d" % s.replace("^", "%5E"), p_yahoo))
    for s in ("XAUUSD", "XAGUSD", "USA500IDXUSD", "EURUSD"):
        C.append(("dukascopy min " + s, "dukascopy", "https://datafeed.dukascopy.com/datafeed/%s/2025/10/03/BID_candles_min_1.bi5" % s, p_duka))
    C.append(("dukascopy day XAUUSD", "dukascopy", "https://datafeed.dukascopy.com/datafeed/XAUUSD/2025/BID_candles_day_1.bi5", p_duka))
    C.append(("binance vision PAXGUSDT", "gold", "https://data-api.binance.vision/api/v3/klines?symbol=PAXGUSDT&interval=1d&limit=1000", p_binance))
    C.append(("binance api PAXGUSDT", "gold", "https://api.binance.com/api/v3/klines?symbol=PAXGUSDT&interval=1d&limit=5", p_binance))
    for s in ("XAUUSDT", "XAGUSDT"):
        C.append(("binance fapi " + s, "gold/silver", "https://fapi.binance.com/fapi/v1/klines?symbol=%s&interval=1d&limit=5" % s, p_binance))
    C.append(("bybit linear XAUTUSDT", "gold", "https://api.bybit.com/v5/market/kline?category=linear&symbol=XAUTUSDT&interval=D&limit=5", p_bybit))
    C.append(("bybit spot XAUTUSDT", "gold", "https://api.bybit.com/v5/market/kline?category=spot&symbol=XAUTUSDT&interval=D&limit=5", p_bybit))
    C.append(("okx XAUT-USDT", "gold", "https://www.okx.com/api/v5/market/history-candles?instId=XAUT-USDT&bar=1D&limit=5", p_okx))
    C.append(("binance archive PAXGUSDT", "gold", "https://data.binance.vision/data/spot/monthly/klines/PAXGUSDT/1d/PAXGUSDT-1d-2025-10.zip", p_status))
    for s in ("SP500", "NASDAQCOM", "DJIA", "DEXUSEU", "DTWEXBGS", "DCOILWTICO"):
        C.append(("fred " + s, "macro", "https://fred.stlouisfed.org/graph/fredgraph.csv?id=" + s, p_fred))
    for s in ("^spx", "^ndq", "^dji", "aapl.us", "eurusd"):
        C.append(("stooq " + s, "index/stock/fx", "https://stooq.com/q/d/l/?s=%s&i=d" % s.replace("^", "%5E"), p_stooq))
    C.append(("alphavantage IBM demo", "stock", "https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=IBM&apikey=demo", p_alpha))
    C.append(("twelvedata AAPL demo", "stock", "https://api.twelvedata.com/time_series?symbol=AAPL&interval=1day&apikey=demo", p_twelve))
    C.append(("finnhub quote nokey", "stock", "https://finnhub.io/api/v1/quote?symbol=AAPL", p_status))
    C.append(("frankfurter range", "fx", "https://api.frankfurter.app/1999-01-04..?to=USD&from=EUR", p_frank_range))
    C.append(("frankfurter latest", "fx", "https://api.frankfurter.app/latest?from=USD", p_frank_latest))
    C.append(("ecb sdmx EXR", "fx", "https://data-api.ecb.europa.eu/service/data/EXR/D.USD.EUR.SP00.A?format=csvdata&startPeriod=2025-01-01", p_ecb))
    C.append(("histdata xauusd", "gold", "https://www.histdata.com/download-free-forex-historical-data/?/ascii/1-minute-bar-quotes/xauusd", p_status))
    C.append(("github raw FX-1-Minute-Data", "fx", "https://raw.githubusercontent.com/philipperemy/FX-1-Minute-Data/master/README.md", p_status))
    print("name | market | status | bytes | head120 | verdict")
    for name, market, url, parser in C:
        try:
            probe(name, market, url, parser)
        except Exception as e:
            print("%s | %s | ERR | 0 | %s | FAIL" % (name, market, e), flush=True)


if __name__ == "__main__":
    main()
