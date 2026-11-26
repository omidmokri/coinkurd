import json
d = json.load(open("trader/setups.json"))
print("coins", d["coins"], "errors", d["errors"])
print("stats", json.dumps(d["stats"]))
for c, v in d["per_coin"].items():
    print(c, "L", {k: v["long"].get(k) for k in ("n", "ev", "p1", "p_stop")}, "S", {k: v["short"].get(k) for k in ("n", "ev", "p1", "p_stop")})
print("setups", json.dumps(d["setups"])[:3000])
print("watch", json.dumps(d["watch"])[:3000])
