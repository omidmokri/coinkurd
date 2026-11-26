import json
d = json.load(open("trader/setups.json"))
print("coins", d["coins"], "errors", d["errors"])
for fam, F in d["fams"].items():
    print("==", fam, json.dumps(F["stats"]), F["qualified"])
    for c, v in F["per_coin"].items():
        print("  ", c, "L", {k: v["long"].get(k) for k in ("n", "ev", "p1")}, "S", {k: v["short"].get(k) for k in ("n", "ev", "p1")})
print("setups", json.dumps(d["setups"])[:3000])
print("watch", json.dumps(d["watch"])[:3000])
