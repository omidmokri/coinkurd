import json, urllib.request, urllib.parse, time
UA={"User-Agent":"entekhab.net/1.0 (+https://entekhab.net)"}
def g(u, n=700):
    try:
        r=urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=60)
        b=r.read().decode('utf-8','replace')
        print("==",r.status,u); print({k:v for k,v in r.headers.items() if 'rate' in k.lower() or 'limit' in k.lower() or 'cache' in k.lower()})
        print(b[:n]); return b
    except Exception as e:
        print("== ERR",u,str(e)[:200]); return None
B="https://bitview.space/api"
for q in ["sopr","spent output profit ratio","age range supply","up to 1d supply","from 1y to 2y","adjusted sopr","short term holder sopr","long term holder sopr"]:
    b=g(B+"/series/search?"+urllib.parse.urlencode({"q":q,"limit":60}),3000)
g(B+"/series/indexes",2000)
g(B+"/series/count",1500)
# full list names containing sopr / age
names=[]
for p in range(0,40):
    b=g(B+f"/series/list?page={p}&per_page=1000",0)
    if not b: break
    j=json.loads(b)
    items=j if isinstance(j,list) else j.get("data") or j.get("series") or j.get("items") or []
    if p==0: print("LISTKEYS", type(j), (list(j.keys()) if isinstance(j,dict) else None))
    if not items: break
    names+= [x if isinstance(x,str) else json.dumps(x) for x in items]
    if len(items)<1000: break
print("TOTAL",len(names))
for kw in ["sopr","age_range","_up_to_","from_","utxos_at_least","supply","realized_cap","hodl"]:
    m=[n for n in names if kw in n]
    print("KW",kw,len(m)); print("\n".join(m[:400]))
g(B+"/server/sync",500)
g("https://bitcoin-data.com/v1/sopr/last",500)
g("https://bitcoin-data.com/v1/hodl-waves-supply/last",1500)
