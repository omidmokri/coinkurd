import json, urllib.request, urllib.parse, time, statistics
UA={"User-Agent":"entekhab.net/1.0 (+https://entekhab.net)"}
def g(u, n=600, quiet=False):
    t=time.time()
    try:
        r=urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=90)
        b=r.read().decode('utf-8','replace')
        print("==",r.status,u,len(b),"bytes",round(time.time()-t,1),"s"); 
        if not quiet: print(b[:n])
        return b
    except Exception as e:
        print("== ERR",u,str(e)[:300]); return None
B="https://bitview.space/api"
for q in ["price close","close price usd","ohlc"]:
    g(B+"/series/search?"+urllib.parse.urlencode({"q":q,"limit":30}),1500)
g(B+"/series/sopr_24h",1500)
g(B+"/series/age_1d_to_1w_supply",1500)
g(B+"/series/sopr_24h/day1?start=-5",1500)
g(B+"/series/sopr_24h/day1/latest",200)
g(B+"/series/age_1d_to_1w_supply/day1?start=-3",800)
BANDS="under_1h 1h_to_1d 1d_to_1w 1w_to_1m 1m_to_2m 2m_to_3m 3m_to_4m 4m_to_5m 5m_to_6m 6m_to_9m 9m_to_1y 1y_to_18m 18m_to_2y 2y_to_3y 3y_to_4y 4y_to_5y 5y_to_6y 6y_to_7y 7y_to_8y 8y_to_10y 10y_to_12y 12y_to_15y over_15y".split()
names=",".join("age_%s_supply"%b for b in BANDS)
b=g(B+"/series/bulk?"+urllib.parse.urlencode({"series":names,"index":"day1","start":"-3"}),3000)
names2="sopr_24h,sth_sopr_24h,lth_sopr_24h,adjusted_sopr_24h,sth_supply,lth_supply"
g(B+"/series/bulk?"+urllib.parse.urlencode({"series":names2,"index":"day1","start":"-3"}),3000)
# full history size/time
full=g(B+"/series/bulk?"+urllib.parse.urlencode({"series":names,"index":"day1"}),300)
fs=g(B+"/series/bulk?"+urllib.parse.urlencode({"series":"sopr_24h,sth_sopr_24h,lth_sopr_24h,adjusted_sopr_24h","index":"day1"}),300)
# cross-check against BGeometrics (2 requests)
try:
    J=json.loads(fs); print("BULK keys", [ (x.keys() if isinstance(x,dict) else type(x)) for x in J][:1])
except Exception as e: print("parse", e)
bg=g("https://bitcoin-data.com/v1/sopr",300)
open("bg_sopr.json","w").write(bg or "")
open("bv_sopr.json","w").write(fs or "")
open("bv_age.json","w").write(full or "")
bh=g("https://bitcoin-data.com/v1/hodl-waves-supply",300)
open("bg_hodl.json","w").write(bh or "")
