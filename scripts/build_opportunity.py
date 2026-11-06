#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
صفحهٔ «ماشین حساب هزینه فرصت تومان» — /opportunity/  (فارسی / کوردی سورانی / English)

کاربر ارز، تاریخ خرید و مبلغ را می‌دهد؛ صفحه چهار سناریو را کنار هم می‌گذارد:
رمزارز، دلار آزاد، طلای ۱۸ عیار و سپردهٔ بانکی — همه به تومان، با نمودار و دکمهٔ اشتراک‌گذاری تلگرام.
همهٔ محاسبه در مرورگر روی data/opportunity.json انجام می‌شود.
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
    "title": L("ماشین حساب هزینه فرصت تومان", "ژمێرەری تێچووی دەرفەتی تمەن", "Toman Opportunity Cost Calculator"),
    "desc": L("اگر همان پول را به‌جای رمزارز، دلار آزاد یا طلا یا سپردهٔ بانکی نگه می‌داشتید، امروز چقدر داشتید؟ مقایسه به تومان، با دادهٔ واقعی بازار ایران.",
              "ئەگەر هەمان پارەت لە جیاتی کریپتۆ، بە دۆلاری ئازاد یان زێڕ یان پارێزراوی بانکی هێشتبایەوە، ئەمڕۆ چەندت دەبوو؟",
              "If you had held free-market dollars, gold or a bank deposit instead of that coin, what would you have today? Compared in toman, with real Iranian market data."),
    "coin": L("ارز", "دراو", "Coin"),
    "date": L("تاریخ خرید", "بەرواری کڕین", "Purchase date"),
    "amount": L("مبلغ (تومان)", "بڕ (تمەن)", "Amount (toman)"),
    "rate": L("سود سالانهٔ سپرده", "قازانجی ساڵانەی پارێزراو", "Annual deposit rate"),
    "rate_note": L("فرض پیش‌فرض است؛ نرخ بانک خودتان را بگذارید.", "گریمانەیە؛ ڕێژەی بانکی خۆت دابنێ.", "This is an assumption — use your own bank's rate."),
    "calc": L("محاسبه کن", "بیژمێرە", "Calculate"),
    "today": L("ارزش امروز", "نرخی ئەمڕۆ", "Value today"),
    "profit": L("سود", "قازانج", "Gain"),
    "loss": L("زیان", "زیان", "Loss"),
    "best": L("بهترین", "باشترین", "Best"),
    "worst": L("بدترین", "خراپترین", "Worst"),
    "vs_best": L("نسبت به بهترین گزینه", "بەراورد لەگەڵ باشترین", "vs the best option"),
    "chart": L("ارزش هر گزینه از روز خرید تا امروز (تومان)", "نرخی هەر هەڵبژاردەیەک لە ڕۆژی کڕینەوە (تمەن)", "Value of each option since the purchase date (toman)"),
    "share": L("اشتراک‌گذاری نتیجه در تلگرام", "بڵاوکردنەوە لە تەلەگرام", "Share this result on Telegram"),
    "copy": L("کپی متن نتیجه", "کۆپیی دەق", "Copy the result"),
    "copied": L("کپی شد", "کۆپی کرا", "Copied"),
    "range": L("دادهٔ موجود از {a} تا {b} — بازهٔ تاریخی هر روز بلندتر می‌شود.", "داتا لە {a} تا {b} — ڕۆژ بە ڕۆژ درێژتر دەبێت.",
               "Data available from {a} to {b} — the range grows every day."),
    "nodata": L("هنوز دادهٔ کافی جمع نشده؛ به‌زودی.", "هێشتا داتای پێویست کۆ نەبووەتەوە.", "Not enough data collected yet."),
    "pick_date": L("تاریخ را در بازهٔ موجود انتخاب کنید.", "بەروار لە ماوەی بەردەستدا هەڵبژێرە.", "Pick a date inside the available range."),
    "result_for": L("اگر در {d} به ارزش {a} تومان {c} می‌خریدید:", "ئەگەر لە {d} بە بڕی {a} تمەن {c}ت بکڕیایە:", "If on {d} you had put {a} toman into {c}:"),
    "head_note": L("این ابزار آموزشی است و توصیهٔ مالی نیست. گذشته تضمین آینده نیست.",
                   "ئەمە فێرکارییە و ئامۆژگاریی دارایی نییە.", "Educational only — not financial advice. The past does not guarantee the future."),
    "amount_help": L("مثلاً ۱۰۰٬۰۰۰٬۰۰۰", "بۆ نموونە ١٠٠٬٠٠٠٬٠٠٠", "e.g. 100,000,000"),
    "toman": L("تومان", "تمەن", "toman"),
    "method": L("روش محاسبه", "شێوازی ژماردن", "Method"),
    "twins": L("تا وقتی تاریخچهٔ تابلوی داخلی کوتاه است، طلا و سکه درصد یکسانی نشان می‌دهند، چون هر دو از یک انس جهانی و یک دلار ساخته شده‌اند؛ با جمع‌شدن نرخ واقعی روزها از هم جدا می‌شوند.",
               "تا مێژووی تابلۆی ناوخۆیی کورتە، زێڕ و سکە هەمان ڕێژە پیشان دەدەن، چونکە هەردووکیان لە یەک ئۆنس و یەک دۆلارەوە دروست بوون.",
               "While the domestic board history is short, gold and the coin show the same percentage — both are built from the same ounce and the same dollar. They separate as real board days accumulate."),
    "calib": L("طلا و سکه از انس جهانی بازسازی و با نرخ واقعی تابلو کالیبره می‌شوند (ضریب فعلی طلا {g} و سکه {c}).",
               "زێڕ و سکە لە ئۆنسی جیهانییەوە دروست دەکرێنەوە و کالیبرە دەکرێن (زێڕ {g}، سکە {c}).",
               "Gold and the coin are rebuilt from the global ounce and calibrated against the real board (current factors: gold {g}, coin {c})."),
}
METHOD = L(
    ["همهٔ قیمت‌ها روزانه و در ساعت ۱۵:۳۰ تهران نمونه‌برداری می‌شوند.",
     "دلار آزاد و تتر از آرشیو کامل کانال‌های عمومی تیک قیمت (@NerkhDollarIRT و @USDTTetherp) خوانده می‌شوند.",
     "ارزش تومانی رمزارز = قیمت دلاری آن روز در Binance × نرخ تتر بازار ایران در همان روز؛ یعنی همان چیزی که واقعاً در ایران می‌پرداختید یا می‌گرفتید.",
     "طلای ۱۸ عیار و سکه از انس جهانی بازسازی می‌شوند — چون تابلوی داخلی پست‌های قدیمی را پاک می‌کند: (انس ÷ ۳۱٫۱۰۳۵) × عیار × دلار آزاد، سپس با نرخ واقعی روزهایی که داریم کالیبره می‌شود. برای روزهایی که نرخ واقعی تابلو را داریم، همان استفاده می‌شود.",
     "سپردهٔ بانکی با سود مرکب روزانه از نرخ سالانه‌ای که خودتان وارد می‌کنید حساب می‌شود؛ این عدد فرض شماست، نه نرخ اعلام‌شدهٔ بانک.",
     "کارمزد خرید و فروش، مالیات و اختلاف خرید/فروش صرافی در هیچ‌کدام از چهار سناریو حساب نشده است."],
    ["هەموو نرخەکان ڕۆژانە و لە کاتژمێر ١٥:٣٠ی تاران وەردەگیرێن.",
     "دۆلاری ئازاد و تەتەر لە ئەرشیفی کەناڵە گشتییەکانی نرخەوە دێن.",
     "نرخی تمەنیی کریپتۆ = نرخی دۆلاریی ئەو ڕۆژە لە Binance × تەتەری بازاڕی ئێران.",
     "زێڕ و سکە لە ئۆنسی جیهانییەوە دروست دەکرێنەوە و کالیبرە دەکرێن.",
     "پارێزراوی بانکی بە قازانجی ڕۆژانەی لێکدراو لەو ڕێژەیەی خۆت دەینووسیت دەژمێردرێت.",
     "کرێی کڕین و فرۆشتن و جیاوازیی نرخی کڕین/فرۆشتن لە هیچ کام لە چوار دۆخەکەدا نەژمێردراوە."],
    ["Every price is sampled daily at 15:30 Tehran time.",
     "The free dollar and tether come from the full archive of public tick channels (@NerkhDollarIRT, @USDTTetherp).",
     "A coin's toman value = its Binance close that day × the Iranian tether rate the same day — what you would really have paid or received in Iran.",
     "18k gold and the Emami coin are rebuilt from the global ounce, because the domestic board deletes old posts: (ounce ÷ 31.1035) × karat × free dollar, then calibrated against the real board days we do have. Where a real board price exists for a day, it is used instead.",
     "The bank deposit compounds daily from the annual rate you type in; that number is your assumption, not a published bank rate.",
     "Trading fees, taxes and exchange buy/sell spreads are not included in any of the four scenarios."])


def s(k, lg, **kw):
    t = S[k].get(lg) or S[k]["fa"]
    return t.format(**kw) if kw else t


CSS = """
.oc-form{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,190px),1fr));gap:12px;align-items:end;margin:14px 0}
.oc-f label{display:block;font-size:.82rem;color:var(--mute);margin-bottom:5px}
.oc-f input,.oc-f select{width:100%;background:#000;color:var(--ink);border:1px solid var(--line);border-radius:12px;padding:10px 12px;font:inherit;font-size:.95rem}
.oc-f input:focus,.oc-f select:focus{outline:0;border-color:var(--acc)}
.oc-go{background:var(--acc);color:#000;border:0;border-radius:99px;padding:12px 24px;font:inherit;font-weight:800;cursor:pointer;font-size:.95rem}
.oc-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,215px),1fr));gap:12px;margin:16px 0}
.oc-card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:14px 16px;position:relative;overflow:hidden}
.oc-card.best{border-color:#22c55e;box-shadow:0 0 0 1px rgba(34,197,94,.3)}
.oc-card.worst{border-color:#ef4444}
.oc-card h3{margin:0 0 8px;font-size:.95rem;display:flex;align-items:center;gap:6px}
.oc-val{font-family:'Space Grotesk',Vazirmatn,monospace;font-size:1.35rem;font-weight:800;direction:ltr;unicode-bidi:isolate;display:block}
.oc-chg{font-family:'Space Grotesk',monospace;font-size:1rem;font-weight:700;direction:ltr;unicode-bidi:isolate;display:inline-block}
.oc-tag{position:absolute;inset-inline-start:0;top:0;font-size:.68rem;font-weight:800;padding:2px 9px;border-bottom-right-radius:9px;border-bottom-left-radius:9px}
[dir=rtl] .oc-tag{border-bottom-right-radius:0;border-bottom-left-radius:9px}
.oc-tag.b{background:#22c55e;color:#04210f}.oc-tag.w{background:#ef4444;color:#2a0808}
.oc-lead{font-size:1rem;line-height:2;margin:14px 0 2px}
.oc-acts{display:flex;gap:9px;flex-wrap:wrap;margin:12px 0}
.oc-tg{background:#229ED9;color:#fff;border:0;border-radius:99px;padding:9px 18px;font:inherit;font-weight:700;cursor:pointer;font-size:.88rem}
.oc-cp{background:none;color:var(--ink);border:1px solid var(--line);border-radius:99px;padding:8px 17px;font:inherit;cursor:pointer;font-size:.88rem}
.oc-err{color:#f87171;margin:8px 0}
.oc-res{display:none}.oc-res.on{display:block}
"""

JS = r"""
(function(){var D=null,LOAD=null;
function L(){var l;try{l=localStorage.getItem('ck_lang')}catch(e){}return ['fa','ckb','en'].indexOf(l)>=0?l:'fa'}
function nf(n,d){if(n==null||!isFinite(n))return '—';return Number(n).toLocaleString(L()==='en'?'en-US':'fa-IR',{maximumFractionDigits:d==null?0:d})}
function load(){if(LOAD)return LOAD;LOAD=fetch('/data/opportunity.json',{cache:'no-store'}).then(r=>r.json()).then(j=>{D=j;return j});return LOAD}
function last(a,i){for(var k=i;k>=0;k--)if(a[k]!=null)return a[k];return null}
function tomanSeries(coin){var t=D.toman.USDT,u=D.usd[coin],o=[];for(var i=0;i<D.days.length;i++){var a=last(u,i),b=last(t,i);o.push(a&&b?a*b:null)}return o}
function dayNum(s){var p=s.split('-');return Date.UTC(+p[0],+p[1]-1,+p[2])/86400000}
var JM=['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
function g2j(gy,gm,gd){var m=[0,31,59,90,120,151,181,212,243,273,304,334],y2=gm>2?gy+1:gy;
 var dd=355666+365*gy+((y2+3)/4|0)-((y2+99)/100|0)+((y2+399)/400|0)+gd+m[gm-1],jy=-1595+33*((dd/12053)|0);
 dd%=12053;jy+=4*((dd/1461)|0);dd%=1461;if(dd>365){jy+=((dd-1)/365)|0;dd=(dd-1)%365}
 return dd<186?[jy,1+((dd/31)|0),1+dd%31]:[jy,7+(((dd-186)/30)|0),1+(dd-186)%30]}
function fdate(iso){var p=iso.split('-').map(Number),l=L();
 if(l!=='fa')return iso;
 var j=g2j(p[0],p[1],p[2]);return (j[2]+' '+JM[j[1]-1]+' '+j[0]).replace(/\d/g,function(d){return '۰۱۲۳۴۵۶۷۸۹'[d]})}
function depositSeries(i0,amount,rate){/* compound on real calendar days: the archive can miss a day */
 var o=[],r=Math.pow(1+rate/100,1/365),d0=dayNum(D.days[i0]);
 for(var i=0;i<D.days.length;i++){o.push(i<i0?null:amount*Math.pow(r,dayNum(D.days[i])-d0))}return o}
function run(blk){
 var g=function(s){return blk.querySelector(s)};
 var coin=g('.oc-coin').value,date=g('.oc-date').value,amt=parseFloat(String(g('.oc-amt').value).replace(/[^\d.]/g,'')),rate=parseFloat(g('.oc-rate').value)||0;
 var err=g('.oc-err');err.textContent='';
 var i0=D.days.indexOf(date);
 if(i0<0){err.textContent=blk.dataset.pick;return}
 if(!amt||amt<=0){err.textContent=blk.dataset.pick;return}
 var n=D.days.length-1;
 var series={},start={},end={};
 series[coin]=tomanSeries(coin);
 ['USD','GOLD18','COIN'].forEach(function(k){series[k]=D.toman[k].slice()});
 var rows=[];
 Object.keys(series).forEach(function(k){
   var a=last(series[k],i0),b=last(series[k],n);
   if(!a||!b)return;
   var units=amt/a,val=units*b;
   rows.push({k:k,val:val,chg:(val/amt-1)*100,path:series[k].map(function(v,i){return i<i0||v==null?null:v*units})});
 });
 var dep=depositSeries(i0,amt,rate);
 rows.push({k:'DEPOSIT',val:last(dep,n),chg:(last(dep,n)/amt-1)*100,path:dep});
 rows.sort(function(a,b){return b.val-a.val});
 var best=rows[0],worst=rows[rows.length-1];
 var names=D.names,lg=L();
 var nm=function(k){return k===blk.dataset.coinkey?coin:((names[k]&&(names[k][lg]||names[k].fa))||k)};
 // cards
 g('.oc-cards').innerHTML=rows.map(function(r){
   var cls=r===best?' best':(r===worst?' worst':'');
   var tag=r===best?'<span class="oc-tag b">'+blk.dataset.best+'</span>':(r===worst?'<span class="oc-tag w">'+blk.dataset.worst+'</span>':'');
   var up=r.chg>=0;
   var gap=r===best?'':'<small class="mut"> · '+nf(((r.val/best.val)-1)*100,1)+'% '+blk.dataset.vsbest+'</small>';
   return '<div class="oc-card'+cls+'">'+tag+'<h3>'+(r.k===coin?coin:nm(r.k))+'</h3>'+
     '<span class="oc-val">'+nf(r.val)+'</span><small class="mut">'+blk.dataset.toman+'</small><div><span class="oc-chg '+(up?'up':'down')+'">'+(up?'+':'')+nf(r.chg,1)+'%</span>'+gap+'</div></div>';
 }).join('');
 g('.oc-lead').textContent=blk.dataset.resfor.replace('{d}',fdate(date)).replace('{a}',nf(amt)).replace('{c}',coin);
 // chart
 var colors={USD:'#22c55e',GOLD18:'#eab308',COIN:'#a3a3a3',DEPOSIT:'#60a5fa'};colors[coin]='#f7931a';
 var box=g('.oc-chart');box.innerHTML='';
 if(window.LightweightCharts){
   var c=LightweightCharts.createChart(box,{height:300,layout:{background:{color:'transparent'},textColor:'#9a9a94',fontFamily:'Vazirmatn'},
    grid:{vertLines:{color:'rgba(255,255,255,.05)'},horzLines:{color:'rgba(255,255,255,.05)'}},rightPriceScale:{borderVisible:false},
    timeScale:{borderVisible:false},handleScroll:false,handleScale:false,
    localization:{priceFormatter:function(v){return nf(v/1e6,1)+'M'}}});
   rows.forEach(function(r){
     var s=c.addLineSeries({color:colors[r.k]||'#888',lineWidth:2,priceLineVisible:false,lastValueVisible:false});
     s.setData(D.days.map(function(d,i){return r.path[i]!=null?{time:d,value:r.path[i]}:null}).filter(Boolean));
   });
   c.timeScale().fitContent();new ResizeObserver(function(){if(box.clientWidth)c.applyOptions({width:box.clientWidth})}).observe(box);
 }
 g('.oc-legend').innerHTML=rows.map(function(r){return '<span><i style="background:'+(colors[r.k]||'#888')+'"></i>'+(r.k===coin?coin:nm(r.k))+'</span>'}).join('');
 // shareable text
 var txt=blk.dataset.resfor.replace('{d}',fdate(date)).replace('{a}',nf(amt)).replace('{c}',coin)+'\n'+
   rows.map(function(r){return (r.k===coin?coin:nm(r.k))+': '+nf(r.val)+' '+blk.dataset.toman+' ('+(r.chg>=0?'+':'')+nf(r.chg,1)+'%)'}).join('\n')+
   '\n\nentekhab.net/opportunity/';
 blk.__txt=txt;
 g('.oc-res').classList.add('on');
}
function init(blk){
 load().then(function(){
  var sel=blk.querySelector('.oc-coin');
  sel.innerHTML=D.coins.map(function(c){return '<option value="'+c+'">'+c+'</option>'}).join('');
  var dt=blk.querySelector('.oc-date');
  dt.min=D.from;dt.max=D.to;dt.value=D.from;
  blk.querySelector('.oc-range').textContent=blk.dataset.range.replace('{a}',fdate(D.from)).replace('{b}',fdate(D.to));
  var cal=blk.querySelector('.oc-calib');
  if(cal&&D.calibration)cal.textContent=blk.dataset.calib.replace('{g}',D.calibration.gold_k).replace('{c}',D.calibration.coin_k);
  blk.querySelector('.oc-go').onclick=function(){run(blk)};
  blk.querySelector('.oc-tg').onclick=function(){
    var u='https://t.me/share/url?url='+encodeURIComponent('https://entekhab.net/opportunity/')+'&text='+encodeURIComponent(blk.__txt||'');
    var a=document.createElement('a');a.href=u;a.target='_blank';a.rel='noopener';document.body.appendChild(a);a.click();a.remove();};
  blk.querySelector('.oc-cp').onclick=function(){var b=this;try{navigator.clipboard.writeText(blk.__txt||'');b.textContent=blk.dataset.copied}catch(e){}};
 }).catch(function(){blk.querySelector('.oc-range').textContent=blk.dataset.nodata});
}
document.querySelectorAll('.oc-blk').forEach(init);
})();"""


def form(lg):
    d = {"pick": s("pick_date", lg), "best": s("best", lg), "worst": s("worst", lg), "vsbest": s("vs_best", lg),
         "toman": s("toman", lg), "resfor": S["result_for"].get(lg) or S["result_for"]["fa"],
         "range": S["range"].get(lg) or S["range"]["fa"], "nodata": s("nodata", lg),
         "calib": S["calib"].get(lg) or S["calib"]["fa"], "coinkey": "__coin__"}
    attrs = " ".join(f'data-{k}="{e(v)}"' for k, v in d.items())
    return (f'<div class="oc-blk" {attrs}>'
            f'<p class="note oc-range">…</p>'
            f'<div class="oc-form">'
            f'<div class="oc-f"><label>{s("coin", lg)}</label><select class="oc-coin"></select></div>'
            f'<div class="oc-f"><label>{s("date", lg)}</label><input class="oc-date" type="date"></div>'
            f'<div class="oc-f"><label>{s("amount", lg)}</label><input class="oc-amt" type="text" inputmode="numeric" placeholder="{s("amount_help", lg)}" value="100000000"></div>'
            f'<div class="oc-f"><label>{s("rate", lg)} <span class="mut">%</span></label><input class="oc-rate" type="number" min="0" max="80" step="0.5" value="20"></div>'
            f'<div class="oc-f"><button type="button" class="oc-go">{s("calc", lg)}</button></div>'
            f'</div><p class="note">{s("rate_note", lg)}</p><p class="oc-err"></p>'
            f'<div class="oc-res"><p class="oc-lead"></p><div class="oc-cards"></div>'
            f'<h2>{s("chart", lg)}</h2><div class="oc-chart rc-chart" style="height:300px"></div><div class="rc-legend oc-legend"></div>'
            f'<div class="oc-acts"><button type="button" class="oc-tg">✈ {s("share", lg)}</button>'
            f'<button type="button" class="oc-cp">{s("copy", lg)}</button></div></div></div>')


def build():
    def b(lg):
        h = (f'<div class="meta"><a href="/">{BR.s("home", lg)}</a> / <a href="/reality/">{BR.s("hub", lg)}</a> / {e(s("title", lg))}</div>'
              f'<h1>{e(s("title", lg))}</h1><p class="rc-lead">{e(s("desc", lg))}</p>')
        h += form(lg)
        items = "".join(f"<li>{e(x)}</li>" for x in (METHOD.get(lg) or METHOD["fa"]))
        h += (f'<details class="rc-meth"><summary>{s("method", lg)}</summary><ul>{items}</ul>'
              f'<p class="note oc-calib"></p><p class="note">{e(s("twins", lg))}</p></details>')
        h += f'<p class="note">{e(s("head_note", lg))}</p>'
        return h

    body = BR.finish("", BR.tri(b), JS)
    extra = f"<style>{BR.RCSS}{CSS}</style>"
    ld = {"@context": "https://schema.org", "@type": "WebApplication", "name": S["title"]["fa"],
          "url": f"{BP.SITE}/opportunity/", "applicationCategory": "FinanceApplication",
          "operatingSystem": "Any", "offers": {"@type": "Offer", "price": "0", "priceCurrency": "IRR"},
          "description": S["desc"]["fa"]}
    return BP.page("opportunity/", S["title"]["fa"], S["desc"]["fa"], body, extra + f'<script type="application/ld+json">{BP.sj(ld)}</script>')


def main():
    url = build()
    BR.add_to_sitemap([url])
    print("opportunity page:", url)


if __name__ == "__main__":
    main()
