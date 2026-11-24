#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""/unlocks/ — when locked tokens are due to reach the market.

The schedule itself is collected by scripts/unlocks.py into data/obs/unlocks.json, which the live run refreshes
a few projects at a time. This writes the page that reads that file in the reader's own browser, so what is on
screen is as fresh as the last run rather than as fresh as the last deploy.

Nothing here is a forecast. An unlock is a date and a number of tokens written into a project's own schedule; what
a market does with it on the day is not in the data and is not claimed.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_pages as BP  # noqa: E402
import build_reality as BR  # noqa: E402
import reality_common as R  # noqa: E402

e = BP.e
L = R.L

S = {
    "title": L("تقویم آنلاک توکن‌ها", "ڕۆژژمێری کردنەوەی تۆکنەکان", "Token unlock calendar"),
    "desc": L("کدام توکن‌ها در روزهای آینده از قفل درمی‌آیند، چه مقدار و چند درصد از کل عرضه — از دادهٔ باز DefiLlama.",
              "کام تۆکنەکان لە ڕۆژانی داهاتوودا لە قوفڵ دەردەچن، چەند و چەند لەسەدی کۆی دابینکراو — لە داتای کراوەی DefiLlama.",
              "Which tokens come out of lock in the days ahead, how many and what share of the supply — from DefiLlama's open data."),
    "lead": L("تیم، سرمایه‌گذاران اولیه و خزانهٔ هر پروژه توکن‌هایشان را طبق برنامه‌ای زمان‌بندی‌شده تحویل می‌گیرند. "
              "روزی که یک بخش از قفل درمی‌آید، آن توکن‌ها قابل فروش می‌شوند؛ این یکی از معدود چیزهایی است که از قبل دربارهٔ یک کوین می‌دانیم. "
              "این صفحه فقط همان تاریخ‌ها و مقدارها را نشان می‌دهد؛ اینکه بازار در آن روز چه می‌کند در دادهٔ هیچ‌کس نیست.",
              "تیم، وەبەرهێنەرانی سەرەتایی و گەنجینەی هەر پڕۆژەیەک تۆکنەکانیان بەپێی خشتەیەکی کاتی وەردەگرن. "
              "ئەو ڕۆژەی بەشێک لە قوفڵ دەردەچێت، ئەو تۆکنانە دەتوانرێن بفرۆشرێن؛ ئەمە یەکێکە لەو کەم شتانەی پێشوەخت دەربارەی دراوێک دەزانرێت. "
              "ئەم پەڕەیە تەنها هەمان بەروار و بڕەکان پیشان دەدات؛ ئەوەی بازاڕ لەو ڕۆژەدا دەیکات لە داتای کەسدا نییە.",
              "A project hands tokens to its team, its early backers and its treasury on a schedule. On the day a tranche "
              "unlocks those tokens can be sold, which makes it one of the few things about a coin that is known in advance. "
              "This page shows those dates and amounts; what a market does on the day is in nobody's data."),
    "when": L("روز", "ڕۆژ", "Date"),
    "left": L("مانده", "ماوە", "In"),
    "proj": L("پروژه", "پڕۆژە", "Project"),
    "toks": L("توکن", "تۆکن", "Tokens"),
    "share": L("از عرضه", "لە دابینکراو", "Of supply"),
    "value": L("ارزش تقریبی", "بەهای نزیکەیی", "Value"),
    "who": L("سهم چه کسی", "بەشی کێ", "Promised to"),
    "days": L("روز", "ڕۆژ", "d"),
    "today": L("امروز", "ئەمڕۆ", "today"),
    "w30": L("۳۰ روز", "٣٠ ڕۆژ", "30 days"),
    "w90": L("۹۰ روز", "٩٠ ڕۆژ", "90 days"),
    "w365": L("یک سال", "ساڵێک", "a year"),
    "sum": L("در این بازه {n} آنلاک از {p} پروژه، روی هم حدود {v}.",
             "لەم ماوەیەدا {n} کردنەوە لە {p} پڕۆژە، بە گشتی نزیکەی {v}.",
             "{n} unlocks from {p} projects in this window, about {v} in all."),
    "empty": L("برای این بازه آنلاکی در داده نیست.", "بۆ ئەم ماوەیە هیچ کردنەوەیەک لە داتادا نییە.",
               "No unlock in the data for this window."),
    "wait": L("در حال خواندن داده…", "خوێندنەوەی داتا…", "Reading the data…"),
    "down": L("دادهٔ آنلاک‌ها در دسترس نیست.", "داتای کردنەوەکان بەردەست نییە.", "The unlock data is not available."),
    "cats": {
        "insiders": L("تیم و سرمایه‌گذاران", "تیم و وەبەرهێنەران", "insiders"),
        "publicSale": L("فروش عمومی", "فرۆشتنی گشتی", "public sale"),
        "privateSale": L("فروش خصوصی", "فرۆشتنی تایبەت", "private sale"),
        "airdrop": L("ایردراپ", "ئێردڕۆپ", "airdrop"),
        "farming": L("پاداش شبکه", "خەڵاتی تۆڕ", "farming"),
        "noncirculating": L("خارج از گردش", "دەرەوەی سووڕان", "non-circulating"),
        "liquidity": L("نقدینگی", "شلەیی", "liquidity"),
    },
    "note": L("چه چیزی اینجا هست و چه چیزی نیست", "چی لێرەیە و چی نییە", "What this page is, and is not"),
    "note_b": L(
        "تاریخ‌ها و مقدارها از دادهٔ باز DefiLlama می‌آید (رایگان، بدون کلید) و همان چیزی است که خود پروژه‌ها اعلام کرده‌اند. "
        "«ارزش تقریبی» یعنی مقدار توکن ضربدر قیمت لحظهٔ خواندن داده — نه پیش‌بینی قیمت آن روز. "
        "«از عرضه» نسبت به کل عرضهٔ اعلام‌شدهٔ پروژه است. آنلاک خطی (linear) در طول زمان پخش می‌شود و آنلاک پله‌ای (cliff) یک‌باره. "
        "این صفحه توصیهٔ خرید و فروش نیست.",
        "بەروار و بڕەکان لە داتای کراوەی DefiLlama دێن (بەخۆڕایی، بەبێ کلیل) و هەمان ئەوەن کە خودی پڕۆژەکان ڕایانگەیاندووە. "
        "«بەهای نزیکەیی» واتە بڕی تۆکن لە نرخی کاتی خوێندنەوەی داتا — نەک پێشبینیی نرخی ئەو ڕۆژە. "
        "«لە دابینکراو» بەرامبەر بە کۆی دابینکراوی ڕاگەیەنراوی پڕۆژەیە. کردنەوەی هێڵی بە درێژایی کات دابەش دەبێت و کردنەوەی پلەیی یەکجارە. "
        "ئەم پەڕەیە ئامۆژگاریی کڕین و فرۆشتن نییە.",
        "The dates and amounts come from DefiLlama's open data (free, no key) and are what the projects themselves published. "
        "“Value” is the number of tokens at the price when the data was read — not a forecast of the price on the day. "
        "“Of supply” is against the project's own stated supply. A linear unlock is spread over time; a cliff arrives at once. "
        "This page is not advice to buy or sell."),
    "src": L("منبع", "سەرچاوە", "Source"),
    "upd": L("تازه‌ترین به‌روزرسانی داده", "دوایین نوێکردنەوەی داتا", "Data last refreshed"),
}


def s(k, lg, **kw):
    v = S[k][lg]
    return v.format(**kw) if kw else v


JS = r"""
(function(){
  var F=document.getElementById('ulTbl'),SUM=document.getElementById('ulSum'),UPD=document.getElementById('ulUpd');
  var W=document.getElementById('ulWin'),T=window.__UL||{},lg=document.documentElement.lang||'fa';
  var days=30;
  function esc(x){return String(x==null?'':x).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function dg(x){return lg==='en'?String(x):String(x).replace(/[0-9]/g,function(d){return '۰۱۲۳۴۵۶۷۸۹'[+d]})}
  function nf(n,d){if(!isFinite(n))return '—';var v=Math.abs(n)>=1e9?(n/1e9).toFixed(2)+'B':Math.abs(n)>=1e6?(n/1e6).toFixed(2)+'M':Math.abs(n)>=1e3?(n/1e3).toFixed(1)+'K':n.toFixed(d==null?2:d);return dg(v)}
  function usd(n){return n>0?'$'+nf(n):'—'}
  function day(t){var d=new Date(t*1000);return d.toISOString().slice(0,10)}
  function left(t){var d=Math.round((t*1000-Date.now())/86400000);return d<=0?T.today:dg(d)+' '+T.days}
  function rows(store){
    var now=Date.now()/1000,out=[],k;
    for(k in store.coins){var c=store.coins[k];if(!c||!c.ev)continue;
      for(var i=0;i<c.ev.length;i++){var e=c.ev[i];
        if(!(e.t>=now&&e.t<=now+days*86400))continue;
        var usdv=(e.n||0)*(c.price||0);
        if(c.price&&usdv<50000)continue;
        var tk=c.token||'';if(tk.indexOf('0x')===0||tk.length>12)tk='';   /* a contract address is no ticker */
        out.push({t:e.t,name:c.name||k,tok:tk,n:e.n||0,c:e.c||'',k:e.k||'',usd:usdv,
          pct:c.supply?(e.n||0)/c.supply*100:0});}}
    out.sort(function(a,b){return (b.usd-a.usd)||(a.t-b.t)});
    return out}
  function paint(store){
    var r=rows(store),head=[T.when,T.left,T.proj,T.toks,T.share,T.value,T.who];
    if(!r.length){F.innerHTML='<p class="note">'+esc(T.empty)+'</p>';SUM.textContent='';return}
    var tot=0,seen={};r.forEach(function(x){tot+=x.usd;seen[x.name]=1});
    SUM.textContent=T.sum.replace('{n}',dg(r.length)).replace('{p}',dg(Object.keys(seen).length)).replace('{v}',usd(tot));
    F.innerHTML='<div class="tscroll"><table><thead><tr>'+head.map(function(h){return '<th>'+esc(h)+'</th>'}).join('')+
      '</tr></thead><tbody>'+r.slice(0,80).map(function(x){
        var cat=T.cats[x.c]||x.c||'—';
        return '<tr><td dir="ltr">'+esc(day(x.t))+'</td><td>'+esc(left(x.t))+'</td><td><b>'+esc(x.name)+'</b>'+
          (x.tok?' <small class="mut" dir="ltr">'+esc(x.tok)+'</small>':'')+'</td><td dir="ltr">'+esc(nf(x.n,0))+'</td><td dir="ltr">'+
          (x.pct?esc(dg(x.pct.toFixed(2))+'%'):'—')+'</td><td dir="ltr">'+esc(usd(x.usd))+'</td><td>'+esc(cat)+
          (x.k==='linear'?' <small class="mut">(linear)</small>':'')+'</td></tr>'}).join('')+'</tbody></table></div>';}
  [].forEach.call(W.querySelectorAll('button'),function(b){b.addEventListener('click',function(){
    days=+b.dataset.d;[].forEach.call(W.querySelectorAll('button'),function(o){o.classList.toggle('on',o===b)});
    if(window.__ULD)paint(window.__ULD);})});
  fetch('/data/obs/unlocks.json?v='+Math.floor(Date.now()/3e5),{credentials:'omit'}).then(function(r){
    if(!r.ok)throw 0;return r.json()}).then(function(j){
      if(!j||typeof j!=='object'||!j.coins)throw 0;
      window.__ULD=j;paint(j);
      if(j.updated_at)UPD.textContent=T.upd+': '+esc(String(j.updated_at).slice(0,16).replace('T',' '))+' UTC';
    }).catch(function(){F.innerHTML='<p class="note">'+esc(T.down)+'</p>';SUM.textContent=''});
})();
"""


def build(lg="fa"):
    import json

    words = {k: (S[k][lg] if isinstance(S[k], dict) and lg in S[k] else S[k]) for k in
             ("when", "left", "proj", "toks", "share", "value", "who", "days", "today", "sum", "empty", "down", "upd")}
    words["cats"] = {k: v[lg] for k, v in S["cats"].items()}
    body = [f"<h1>{e(s('title', lg))}</h1>", f"<p class='lead'>{e(s('lead', lg))}</p>"]
    body.append('<div class="ul-win" id="ulWin">'
                + "".join(f'<button type="button" data-d="{d}"{" class=\'on\'" if d == 30 else ""}>{e(s(k, lg))}</button>'
                          for d, k in ((30, "w30"), (90, "w90"), (365, "w365")))
                + "</div>")
    body.append(f"<p class='note' id='ulSum'></p>")
    body.append(f"<div id='ulTbl'><p class='note'>{e(s('wait', lg))}</p></div>")
    body.append(f"<p class='note' id='ulUpd'></p>")
    body.append(BR.sec(e(s("note", lg)), f"<p>{e(s('note_b', lg))}</p>"
                       f"<p class='note'>{e(s('src', lg))}: DefiLlama (defillama-datasets.llama.fi)</p>"))
    css = (".ul-win{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}"
           ".ul-win button{background:none;border:1px solid var(--line);color:var(--mute);border-radius:99px;"
           "padding:5px 14px;cursor:pointer;font:inherit;font-size:.84rem}"
           ".ul-win button.on{border-color:var(--acc);color:var(--ink);background:rgba(247,147,26,.14)}"
           "#ulTbl table{width:100%;border-collapse:collapse}#ulTbl th,#ulTbl td{padding:7px 10px;border-bottom:1px solid var(--line);"
           "text-align:start;font-size:.86rem;white-space:nowrap}#ulTbl th{color:var(--mute);font-weight:600;font-size:.78rem}"
           "#ulTbl tbody tr:hover{background:rgba(255,255,255,.03)}.tscroll{overflow-x:auto}")
    extra = f"<style>{BR.RCSS}{css}</style>"
    html = "".join(body) + f"<script>window.__UL={json.dumps(words, ensure_ascii=False)};</script><script>{JS}</script>"
    return BP.page("unlocks/", s("title", lg) + " — entekhab", s("desc", lg), html, extra, lang=lg)


def main():
    url = build("fa")
    BR.add_to_sitemap([url])
    print("unlocks page:", url)


if __name__ == "__main__":
    main()
