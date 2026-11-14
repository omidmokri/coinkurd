/* entekhab.net — Bitcoin Battlefield 4.0 · engine
   Everything runs in the browser: public Binance / OKX / Bybit streams, three.js r128, Web Audio synthesis. No keys, no server, no files. */
'use strict';
/* ======================= config & helpers ======================= */
const SYMS=['BTC','ETH','SOL','BNB','XRP','DOGE'];let SYM=ls.get('ek_bf_sym','BTC');if(!SYMS.includes(SYM))SYM='BTC';
const REST='https://data-api.binance.vision/api/v3',WSS='wss://data-stream.binance.vision/stream';
const PREF=Object.assign({sky:'auto',quality:'auto',motion:'full',music:false,snd:ls.get('ek_bf_snd',false),vol:{master:.8,music:.55,sfx:.9,amb:.7,voice:.8},cam:'orbit',layers:{units:1,fx:1,depth:1,feed:1}},ls.get('ek_bf_pref',{}));
const savePref=()=>ls.set('ek_bf_pref',PREF);
const REDUCED=()=>PREF.motion==='reduced'||matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp=(v,a,b)=>v<a?a:v>b?b:v,lerp=(a,b,t)=>a+(b-a)*t,rnd=(a=1,b=0)=>b+Math.random()*(a-b);
const sm3=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)},angMix=(a,b,w)=>{const d=b-a;return a+Math.atan2(Math.sin(d),Math.cos(d))*w};   // smooth step · turn from one heading to another the short way
const fmtP=p=>p==null?'—':'$'+p.toLocaleString('en-US',{minimumFractionDigits:p>=1000?2:p>=1?3:5,maximumFractionDigits:p>=1000?2:p>=1?3:5});
const fmtU=v=>v>=1e9?'$'+(v/1e9).toFixed(2)+'B':v>=1e6?'$'+(v/1e6).toFixed(v>=1e7?0:1)+'M':v>=1e3?'$'+(v/1e3).toFixed(0)+'K':'$'+v.toFixed(0);
/* inside Persian or Kurdish text a bare '$1.1M' comes apart (the digits become an "Arabic number" and the $ and the M drift to the other side):
   every amount and every percentage in HUD markup is made its own left-to-right run */
const ltr=s=>`<bdi dir="ltr">${s}</bdi>`,mon=h=>h.replace(/\$\d[\d,.]*[KMB]?/g,ltr);
const niceStep=v=>{const e=Math.pow(10,Math.floor(Math.log10(v)));const m=v/e;return (m<1.5?1:m<3.5?2:m<7.5?5:10)*e};
const now=()=>performance.now();const vt=()=>U.t*1000;   // vt = scene clock in ms (slows down in slow motion)
/* ======================= market models (live + replay) ======================= */
function newModel(){return {price:null,open:null,bids:new Map(),asks:new Map(),bidL:0,askL:0,bidN:0,askN:0,trades:[],liqs:[],round:null,UN:null,step:50,scale:1,walls:new Map(),bk:{b:[],a:[]},prev:new Map(),first:new Map(),pxT:0,lastP:null,armT:-1e9,lastTick:0,rnum:null}}
let L=newModel(),RP=null,VIEW=L;                       // L = live model, RP = replay model, VIEW = what the scene shows
const S={score:ls.get('ek_battle',{bulls:0,bears:0}),feed:[],chip:'all',src:{price:{st:'off',lat:0,t:0},depth:{st:'off',lat:0,t:0,drift:0},liq:{st:'off',lat:0,t:0,names:{}}},regime:null,samples:[],sigma:0,I:0,vol60:0,volMin:[],curMin:{m:0,v:0},pressure:.5,lastBig:null,disc:false,timeScale:1,quality:'high'};
const isView=M=>M===VIEW;
/* round: price range of about ±0.3% around p0; 60 scene units = R */
function newRound(M,p){M.step=niceStep(p*0.00064);const R=Math.max(M.step*3,Math.ceil(p*0.003/M.step)*M.step);M.round={p0:p,low:p-R,high:p+R,R,t:Date.now()};M.scale=60/R;M.walls=new Map();
 if(isView(M)){WORLD.markers();HUD.round();ARMY.reform()}if(M===L){REC.add({k:'round',p0:p,low:M.round.low,high:M.round.high,R,step:M.step});if(BOOK.synced&&!M.bk.b.length){computeBook(M);if(isView(M))bookView(M)}}}
const X=p=>VIEW.round?(p-VIEW.round.p0)*VIEW.scale:0;
/* ======================= order book (Binance diff stream, local book) ======================= */
const BOOK={lastId:0,buf:[],synced:false,syncing:false,snapT:0,timer:null,bkT:0};
function bookReset(){BOOK.lastId=0;BOOK.buf=[];BOOK.synced=false;BOOK.syncing=false;L.bids=new Map();L.asks=new Map()}
async function bookSnapshot(reconcile){if(BOOK.syncing)return;BOOK.syncing=true;const t0=now(),sym=SYM;const d=await j(`${REST}/depth?symbol=${SYM}USDT&limit=1000`);BOOK.syncing=false;if(sym!==SYM)return;
 if(!d||!d.lastUpdateId){S.src.depth.st='bad';if(!BOOK.synced)setTimeout(bookSnapshot,2500);return}
 const nb=new Map(d.bids.map(([p,q])=>[+p,+q])),na=new Map(d.asks.map(([p,q])=>[+p,+q]));
 if(BOOK.synced){/* periodic check: compare the local book with the exchange snapshot; resync only when they drift apart */const vis=(m,lo,hi)=>{let s=0;for(const [p,q] of m)if(p>=lo&&p<=hi)s+=p*q;return s};const r=L.round;if(r){const a=vis(L.bids,r.low-r.R*.3,1e18)+vis(L.asks,0,r.high+r.R*.3),b=vis(nb,r.low-r.R*.3,1e18)+vis(na,0,r.high+r.R*.3);S.src.depth.drift=b?Math.abs(a-b)/b:0;if(S.src.depth.drift>.02){bookResync();return}}if(reconcile)return}
 L.bids=nb;L.asks=na;BOOK.lastId=d.lastUpdateId;BOOK.synced=true;BOOK.snapT=Date.now();S.src.depth.st='ok';S.src.depth.lat=Math.round(now()-t0);
 const buf=BOOK.buf;BOOK.buf=[];let ok=false;for(const e of buf){if(e.u<=BOOK.lastId)continue;if(!ok){if(e.U<=BOOK.lastId+1&&e.u>=BOOK.lastId+1)ok=true;else{bookResync();return}}applyDiff(e,true)}
 bookChanged(true)}
function bookResync(){BOOK.synced=false;BOOK.buf=[];bookSnapshot()}
function applyDiff(d,quiet){if(d.u<=BOOK.lastId)return;if(d.U>BOOK.lastId+1){bookResync();return}
 for(const [p,q] of d.b){const pr=+p,qt=+q;if(qt===0)L.bids.delete(pr);else L.bids.set(pr,qt)}for(const [p,q] of d.a){const pr=+p,qt=+q;if(qt===0)L.asks.delete(pr);else L.asks.set(pr,qt)}
 BOOK.lastId=d.u;if(d.E)S.src.depth.lat=Math.max(0,Date.now()-d.E);S.src.depth.t=Date.now();if(!quiet)bookChanged(false)}
function onDepthEvent(d){if(!BOOK.synced){BOOK.buf.push(d);if(BOOK.buf.length>600)BOOK.buf.shift();if(!BOOK.syncing)bookSnapshot();return}applyDiff(d,false)}
/* buckets: step/5 wide price bins, in USD */
function bucketize(M,levels,lo,hi){const bw=M.step/5,m=new Map();for(const [p,q] of levels){if(p<lo||p>hi)continue;const usd=p*q,k=Math.floor(p/bw);const b=m.get(k);if(b)b.usd+=usd;else m.set(k,{k,p:(k+.5)*bw,w:bw,usd})}return [...m.values()].sort((a,b)=>a.k-b.k)}
function bookChanged(force){const t=now();if(!force&&t-BOOK.bkT<100)return;BOOK.bkT=t;computeBook(L);if(isView(L))bookView(L)}
function computeBook(M){const r=M.round;if(!r)return;const lo=r.low-r.R*1.2,hi=r.high+r.R*1.2,p=M.price||r.p0;
 let bl=0,al=0,bn=0,an=0;for(const [pr,q] of M.bids){const u=pr*q;if(pr>=r.low-r.R*.3)bl+=u;if(pr>=p*.995)bn+=u}for(const [pr,q] of M.asks){const u=pr*q;if(pr<=r.high+r.R*.3)al+=u;if(pr<=p*1.005)an+=u}
 M.bidL=bl;M.askL=al;M.bidN=bn;M.askN=an;if(!M.UN){M.UN=Math.max(500,(bl+al)/ARMY.TARGET)}
 const bb=bucketize(M,M.bids,lo,hi),ab=bucketize(M,M.asks,lo,hi);M.bk={b:bb,a:ab};const tn=Date.now();
 /* the price of one unit follows the visible liquidity slowly (at most every 15 s) so the armies stay near their intended size */
 if(tn-(M.unT||0)>15000){M.unT=tn;const u=(bl+al)/M.UN;if(u>ARMY.TARGET*1.6)M.UN*=1.3;else if(u<ARMY.TARGET*.55)M.UN=Math.max(500,M.UN*.78)}
 /* first-seen (age) + wall / pulled-wall / convoy detection */
 const seen=new Set();for(const side of ['b','a']){for(const b of M.bk[side]){const key=side+b.k;seen.add(key);if(!M.first.has(key))M.first.set(key,tn);const pv=M.prev.get(key);
  if(b.usd>=M.UN*UK.wall&&Math.abs((b.p-r.p0)*M.scale)<XMAX&&!M.walls.has(key)){M.walls.set(key,{t:tn,usd:b.usd,p:b.p,fort:false});if(M===L)evt(M,{k:side==='b'?'wallB':'wallA',usd:b.usd,p:b.p})}
  if(pv&&M===L&&tn-pv.t<2500&&b.usd-pv.usd>=M.UN*UK.convoy&&tn-(ARMY.convoyT[side]||0)>4000){ARMY.convoyT[side]=tn;evt(M,{k:'convoy',usd:b.usd-pv.usd,p:b.p,side})}
  M.prev.set(key,{usd:b.usd,t:tn})}}
 for(const [key,w] of M.walls){if(!seen.has(key)||(M.prev.get(key)||{usd:0}).usd<w.usd*.2){const traded=M.trades.some(x=>tn-x.t<2500&&Math.abs(x.p-w.p)<=M.step/5);M.walls.delete(key);M.first.delete(key);if(!traded&&M===L&&tn-w.t>1500)evt(M,{k:'wallPulled',usd:w.usd,p:w.p,side:key[0]});else if(M===L&&tn-w.t>1500)evt(M,{k:'wallEaten',usd:w.usd,p:w.p,side:key[0]})}
  else if(!w.fort&&tn-w.t>120000&&w.usd>=M.UN*UK.fort){w.fort=true;if(M===L)evt(M,{k:'fort',usd:w.usd,p:w.p,side:key[0]})}}
 for(const key of M.prev.keys())if(!seen.has(key)){M.prev.delete(key);M.first.delete(key)}}
function bookView(M){HUD.liquidity(M);if(R3&&PREF.layers.units)ARMY.update(M);HUD.depth(M)}
/* ======================= trades, liquidations, price ======================= */
function onPrice(M,p,t){M.lastP=M.price;M.price=p;if(!M.round)newRound(M,p);const r=M.round;M.lastTick=t;
 if(p>=r.high||p<=r.low){const side=p>=r.high?'bulls':'bears';if(M.winArm===side&&t-M.winArmT>=120){M.winArm=null;win(M,side);return}if(M.winArm!==side){M.winArm=side;M.winArmT=t}}else M.winArm=null;
 /* round number crossing (multiples of 1% of price, e.g. 80,000) */
 const rn=niceStep(p*.01),a=Math.floor(p/rn),b=M.lastP?Math.floor(M.lastP/rn):a;if(M.lastP&&a!==b&&isView(M)&&M===L){const lvl=(a>b?a:b)*rn;if(M.rnum!==lvl){M.rnum=lvl;evt(M,{k:'roundNum',p:lvl})}}
 if(M===L&&t-M.pxT>=250){M.pxT=t;REC.add({k:'px',p})}
 if(isView(M)){const n=now();if(n-S.pxHud<110)return;S.pxHud=n;HUD.price(M)}}
/* a sweep: one taker order that eats through several price levels at once. The exchange reports it as a run of aggregated trades
   on one side with the same trade time and a new price each; four levels or more and $20k or more calls the machines out
   (measured on BTCUSDT: about one every few minutes in a quiet market, several a minute in a busy one) */
function sweepFeed(M,p,usd,isSell,t){const w=M.sw;if(w&&w.sell===isSell&&t-w.tL<=40){w.usd+=usd;w.tL=t;if(p!==w.pL){w.lv++;w.pL=p}w.at=Date.now();return}sweepEnd(M);M.sw={sell:isSell,tL:t,usd,lv:1,pL:p,at:Date.now()}}
function sweepEnd(M){const w=M.sw;M.sw=null;if(!w||w.lv<4||w.usd<2e4)return;evt(M,{k:w.sell?'sweepSell':'sweepBuy',usd:w.usd,p:w.pL,n:w.lv,side:w.sell?'sell':'buy'})}
function onTrade(M,p,q,isSell,t){if(!M.round)return;const usd=p*q;if(M===L)sweepFeed(M,p,usd,isSell,t);M.trades.push({t,usd,sell:isSell,p});const cut=t-6e4;while(M.trades.length&&M.trades[0].t<cut)M.trades.shift();
 if(M===L){S.curMin.v+=usd;S.src.price.t=Date.now()}
 const show=usd>=800||Math.random()<.15;if(isView(M)&&show)FX.trade(isSell?'sell':'buy',usd,p);
 if(usd>=1e5)evt(M,{k:usd>=5e5?(isSell?'hugeSell':'hugeBuy'):(isSell?'bigSell':'bigBuy'),usd,p,side:isSell?'sell':'buy'});
 else if(M===L&&show)REC.add({k:'tr',usd,p,s:isSell?1:0},t)}
function onLiq(M,side,usd,p,t,src){if(!M.round||usd<1000)return;M.liqs.push({t,usd,side,src});const cut=t-6e5;while(M.liqs.length&&M.liqs[0].t<cut)M.liqs.shift();
 if(M===L){S.src.liq.t=Date.now();S.src.liq.names[src]=(S.src.liq.names[src]||0)+1}
 const cas=cascadeCheck(M,side,t);evt(M,{k:side==='long'?'liqL':'liqS',usd,p,src,side,cas});if(isView(M))DIRECTOR.strike(side,usd,p,cas)}
function cascadeCheck(M,side,t){const same=M.liqs.filter(x=>x.side===side&&t-x.t<1e4),sum60=M.liqs.filter(x=>t-x.t<6e4).reduce((s,x)=>s+x.usd,0);const cas=same.length>=5||sum60>=1e7;
 if(cas&&M===L&&t-(S.casT||0)>60000){S.casT=t;evt(M,{k:'cascade',usd:sum60,side});if(isView(M))DIRECTOR.scenario('cascade',{side,usd:sum60})}return cas}
function win(M,side){if(M===L){S.score[side]++;ls.set('ek_battle',S.score)}evt(M,{k:'win',side,p:M.price});if(isView(M))DIRECTOR.scenario('win',{side});
 newRound(M,M.price);M.pxT=0;computeBook(M);if(isView(M))bookView(M)}
/* ======================= events (feed + recorder + scenarios) ======================= */
function evt(M,e){e.t=e.t||Date.now();if(M===L){REC.add(Object.assign({},e),e.t)}const arr=M===L?S.feed:(S.feedRP||(S.feedRP=[]));arr.unshift(e);if(arr.length>80)arr.length=80;if(!isView(M))return;HUD.feed();
 if(e.usd&&(!S.lastBig||e.usd>S.lastBig.usd||e.t-S.lastBig.t>30000))S.lastBig=e;
 if(e.k==='wallB'||e.k==='wallA'){if(e.usd>=VIEW.UN*UK.scn&&Math.abs(e.p-VIEW.price)/VIEW.price<.005)DIRECTOR.scenario('wall',{side:e.k==='wallB'?'bull':'bear',p:e.p,usd:e.usd})}
 else if(e.k==='wallPulled')DIRECTOR.scenario('pulled',e);else if(e.k==='convoy')DIRECTOR.scenario('convoy',e);else if(e.k==='fort')DIRECTOR.scenario('fort',e);
 else if(e.k==='roundNum')DIRECTOR.scenario('roundNum',e);else if(/^sweep/.test(e.k))DIRECTOR.scenario('sweep',e);else if(/^huge/.test(e.k)&&e.usd>=1e6)DIRECTOR.scenario('bigOrder',e);else if(/^(big|huge)/.test(e.k))AUDIO.play(e.side==='sell'?'cannon':'cannon',{x:X(e.p),z:rnd(30,-30),vol:.5})}
/* ======================= reconnaissance report: what the book, the tape and the liquidation feeds say at this instant ======================= */
function intel(M){const r=M.round;if(!r||!M.bk.b.length&&!M.bk.a.length)return null;const tn=Date.now();
 const top=(arr,side)=>{let b=null;for(const x of arr){if(Math.abs(X(x.p))>XMAX)continue;if(!b||x.usd>b.usd)b=x}return b?{p:b.p,usd:b.usd,w:b.w,age:tn-(M.first.get(side+b.k)||tn)}:null};
 let buy=0,sell=0,big=null;for(const x of M.trades){if(x.sell)sell+=x.usd;else buy+=x.usd;if(!big||x.usd>big.usd)big=x}
 let lL=0,lS=0;for(const x of M.liqs){if(x.side==='long')lL+=x.usd;else lS+=x.usd}
 return {t:tn,p:M.price,bid:top(M.bk.b,'b'),ask:top(M.bk.a,'a'),bidN:M.bidN,askN:M.askN,buy,sell,liqL:lL,liqS:lS,big,sigma:S.sigma,I:S.I}}
/* ======================= metrics (1 s) ======================= */
function metrics(){const M=L,t=Date.now();if(M.price){S.samples.push(M.price);if(S.samples.length>301)S.samples.shift()}
 if(S.samples.length>20){let s=0,s2=0,n=0;for(let i=1;i<S.samples.length;i++){const r=Math.log(S.samples[i]/S.samples[i-1]);s+=r;s2+=r*r;n++}const v=Math.max(0,s2/n-(s/n)*(s/n));S.sigma=Math.sqrt(v)*Math.sqrt(300)*100}
 const m=Math.floor(t/6e4);if(m!==S.curMin.m){if(S.curMin.m)S.volMin.push(S.curMin.v);if(S.volMin.length>60)S.volMin.shift();S.curMin={m,v:0}}
 const b=M.trades.filter(x=>!x.sell).reduce((s,x)=>s+x.usd,0),se=M.trades.filter(x=>x.sell).reduce((s,x)=>s+x.usd,0);S.vol60=b+se;S.pressure=(b+se)?b/(b+se):.5;
 const med=S.volMin.length>=3?[...S.volMin].sort((a,c)=>a-c)[Math.floor(S.volMin.length/2)]:Math.max(S.vol60,1);const liq10=M.liqs.reduce((s,x)=>s+x.usd,0);
 S.I=clamp(.5*S.sigma/.4+.3*S.vol60/(3*Math.max(med,1))+.2*liq10/1e7,0,1);
 if(VIEW===L){HUD.stats(L);WORLD.weather();AUDIO.intensity(S.I)}
 const silent=M.price&&t-S.src.price.t>8000;if(silent&&!S.disc){S.disc=true;evt(L,{k:'disc'});DIRECTOR.scenario('disc')}else if(!silent&&S.disc&&S.src.price.t){S.disc=false;evt(L,{k:'recon'});DIRECTOR.scenario('recon')}
 if(VIEW===L&&L.round&&R3&&!document.hidden&&t-(S.intelT||(S.intelT=t-9e4))>(S.intelGap||(S.intelGap=15e4+Math.random()*6e4))){S.intelGap=0;DIRECTOR.scenario('intel')}
 HUD.status();REC.snapshot()}
/* ======================= recorder (last 15 minutes, memory only) ======================= */
const REC={ev:[],snaps:[],last:0,add(e,t){e.t=t||e.t||Date.now();this.ev.push(e);if(this.ev.length>40000)this.ev.splice(0,5000);this.prune()},
 snapshot(){const t=Date.now();if(t-this.last<10000||!L.round||!L.bk.b.length)return;this.last=t;this.snaps.push({t,b:L.bk.b.map(b=>[b.k,Math.round(b.usd)]),a:L.bk.a.map(b=>[b.k,Math.round(b.usd)]),UN:L.UN,step:L.step,p0:L.round.p0,low:L.round.low,high:L.round.high,R:L.round.R,price:L.price,open:L.open,walls:[...L.walls.entries()].map(([k,w])=>[k,w.t,w.usd,w.p,w.fort])});this.prune()},
 prune(){const cut=Date.now()-9e5;while(this.ev.length&&this.ev[0].t<cut)this.ev.shift();while(this.snaps.length>1&&this.snaps[1].t<cut)this.snaps.shift()},
 span(){return this.ev.length?[Math.min(this.snaps.length?this.snaps[0].t:Infinity,this.ev[0].t),this.ev[this.ev.length-1].t]:null}};
/* ======================= streams ======================= */
const NET={ws:null,retry:0,liq:{},snapTimer:null,okxCT:null};
function connect(){disconnect();const s=SYM.toLowerCase();$('#srcLbl').textContent=`BINANCE SPOT · ${SYM}/USDT`;if(!L.price)$('#px').textContent=T('conn');S.src.price.st='off';S.src.depth.st='off';bookReset();
 try{NET.ws=new WebSocket(`${WSS}?streams=${s}usdt@aggTrade/${s}usdt@bookTicker/${s}usdt@miniTicker/${s}usdt@depth@100ms`)}catch(e){S.src.price.st='bad';return}
 NET.ws.onopen=()=>{NET.retry=0;S.src.price.st='ok';bookSnapshot();NET.snapTimer=setInterval(()=>{if(!document.hidden&&BOOK.synced)bookSnapshot(true)},60000)};
 NET.ws.onmessage=ev=>{let m;try{m=JSON.parse(ev.data)}catch(e){return}const st=m.stream||'',d=m.data||{};
  if(st.endsWith('@depth@100ms'))onDepthEvent(d);
  else if(st.endsWith('@bookTicker')){const mid=(+d.b+(+d.a))/2;if(mid>0){S.src.price.t=Date.now();onPrice(L,mid,Date.now())}}
  else if(st.endsWith('@aggTrade')){if(d.E)S.src.price.lat=Math.max(0,Date.now()-d.E);onTrade(L,+d.p,+d.q,!!d.m,d.T||Date.now())}
  else if(st.endsWith('@miniTicker')){L.open=+d.o;if(!L.price)onPrice(L,+d.c,Date.now())}};
 NET.ws.onclose=()=>{clearInterval(NET.snapTimer);NET.ws=null;S.src.price.st='bad';S.src.depth.st='bad';if(!document.hidden)setTimeout(connect,Math.min(2e4,1500*Math.pow(2,NET.retry++)))};
 NET.ws.onerror=()=>{S.src.price.st='bad'};
 liqConnectAll()}
function disconnect(){clearInterval(NET.snapTimer);if(NET.ws){NET.ws.onclose=null;try{NET.ws.close()}catch(e){}NET.ws=null}for(const k in NET.liq){const c=NET.liq[k];if(c.ws){c.ws.onclose=null;try{c.ws.close()}catch(e){}}clearInterval(c.ping);clearTimeout(c.fb)}NET.liq={}}
/* liquidations: OKX + Bybit always, Binance futures when reachable; every event keeps its source */
function liqConnectAll(){liqBinance();liqOkx();liqBybit()}
function liqState(){const n=S.src.liq.names,ok=Object.keys(NET.liq).filter(k=>NET.liq[k].ok);S.src.liq.st=ok.length?(ok.includes('Binance')?'ok':'fb'):'off';S.src.liq.list=ok;void n}
function liqBinance(){const s=SYM.toLowerCase(),c={ws:null,ok:false};NET.liq.Binance=c;try{c.ws=new WebSocket(`wss://fstream.binance.com/ws/${s}usdt@forceOrder`)}catch(e){return}
 c.ws.onmessage=ev=>{try{const o=JSON.parse(ev.data).o;if(!o)return;if(!c.ok){c.ok=true;liqState()}const px=+o.ap||+o.p,usd=px*(+o.z||+o.q);S.src.liq.lat=Math.max(0,Date.now()-(o.T||Date.now()));onLiq(L,o.S==='SELL'?'long':'short',usd,px,o.T||Date.now(),'Binance')}catch(e){}};
 c.ws.onclose=()=>{c.ok=false;liqState();c.ws=null;if(!document.hidden)c.fb=setTimeout(liqBinance,30000)};c.ws.onerror=()=>{}}
async function liqOkx(){const c={ws:null,ok:false,ping:null};NET.liq.OKX=c;if(!NET.okxCT){const ins=await j('https://www.okx.com/api/v5/public/instruments?instType=SWAP');NET.okxCT={};((ins&&ins.data)||[]).forEach(x=>NET.okxCT[x.instId]={v:+x.ctVal,t:x.ctType})}
 if(NET.liq.OKX!==c)return;try{c.ws=new WebSocket('wss://ws.okx.com/ws/v5/public')}catch(e){return}
 c.ws.onopen=()=>{c.ws.send(JSON.stringify({op:'subscribe',args:[{channel:'liquidation-orders',instType:'SWAP'}]}));c.ping=setInterval(()=>{try{c.ws&&c.ws.readyState===1&&c.ws.send('ping')}catch(e){}},25000)};
 c.ws.onmessage=ev=>{if(ev.data==='pong')return;let m;try{m=JSON.parse(ev.data)}catch(e){return}if(m.event==='subscribe'&&!c.ok){c.ok=true;liqState()}
  (m.data||[]).forEach(it=>{const fam=it.instFamily||'';if(fam!==`${SYM}-USDT`&&fam!==`${SYM}-USD`)return;const ct=NET.okxCT[it.instId]||{v:1,t:'linear'};(it.details||[]).forEach(d=>{const px=+d.bkPx,sz=+d.sz;if(!px||!sz)return;const t=+d.ts||Date.now();S.src.liq.lat=Math.max(0,Date.now()-t);onLiq(L,d.posSide==='long'||(d.posSide==='net'&&d.side==='sell')?'long':'short',ct.t==='inverse'?sz*ct.v:sz*ct.v*px,px,t,'OKX')})})};
 c.ws.onclose=()=>{clearInterval(c.ping);c.ok=false;liqState();c.ws=null;if(!document.hidden)c.fb=setTimeout(liqOkx,6000)};c.ws.onerror=()=>{}}
function liqBybit(){const c={ws:null,ok:false,ping:null};NET.liq.Bybit=c;try{c.ws=new WebSocket('wss://stream.bybit.com/v5/public/linear')}catch(e){return}
 c.ws.onopen=()=>{c.ws.send(JSON.stringify({op:'subscribe',args:[`allLiquidation.${SYM}USDT`]}));c.ping=setInterval(()=>{try{c.ws&&c.ws.readyState===1&&c.ws.send(JSON.stringify({op:'ping'}))}catch(e){}},20000)};
 c.ws.onmessage=ev=>{let m;try{m=JSON.parse(ev.data)}catch(e){return}if(m.op==='subscribe'&&m.success&&!c.ok){c.ok=true;liqState()}if(!m.topic||!m.topic.startsWith('allLiquidation'))return;
  (m.data||[]).forEach(d=>{const px=+d.p,v=+d.v;if(!px||!v)return;const t=+d.T||Date.now();S.src.liq.lat=Math.max(0,Date.now()-t);onLiq(L,d.S==='Buy'?'long':'short',px*v,px,t,'Bybit')})};
 c.ws.onclose=()=>{clearInterval(c.ping);c.ok=false;liqState();c.ws=null;if(!document.hidden)c.fb=setTimeout(liqBybit,8000)};c.ws.onerror=()=>{}}
/* site regime (Market Brain) → sky + music key */
async function loadRegime(){const b=await j('/data/brain.json');const r=b&&(b.regime||(b.now&&b.now.regime)||(b.brain&&b.brain.regime));const reg=typeof r==='string'?r:(r&&(r.regime||r.key))||null;if(!reg)return;
 if(S.regime&&S.regime!==reg){evt(L,{k:'regime',reg});DIRECTOR.scenario('regime',{reg})}S.regime=reg;WORLD.skyMode();AUDIO.key(reg)}
function setSym(s){SYM=s;ls.set('ek_bf_sym',s);L=newModel();if(!RP)VIEW=L;S.feed=[];S.samples=[];S.volMin=[];S.lastBig=null;FX.clear();ARMY.clear();HUD.feed();connect()}
document.addEventListener('visibilitychange',()=>{if(document.hidden)disconnect();else{connect()}});
/* ======================= world: renderer, sky, light, terrain, weather ======================= */
let R3=false,scene,cam,ren,U={t:0};const V3=THREE.Vector3;
function noise2(x,z){return Math.sin(x*.11)*Math.cos(z*.17)+.5*Math.sin(x*.31+1.3)*Math.sin(z*.23)+.25*Math.sin(x*.7)*Math.cos(z*.9+2)+.12*Math.sin(x*1.9+.4)*Math.cos(z*2.3)}
function hasGL(){try{const c=document.createElement('canvas');return !!(window.WebGLRenderingContext&&(c.getContext('webgl')||c.getContext('experimental-webgl')))}catch(e){return false}}
function makeLabel(txt,col,size,font){const cv=document.createElement('canvas');cv.width=256;cv.height=64;const x=cv.getContext('2d');x.font=font||'700 36px "Space Grotesk",monospace';x.textAlign='center';x.textBaseline='middle';x.shadowColor='#000';x.shadowBlur=8;x.fillStyle=col;x.fillText(txt,128,32);
 const tx=new THREE.CanvasTexture(cv);tx.minFilter=THREE.LinearFilter;tx.encoding=THREE.sRGBEncoding;const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tx,transparent:true,depthTest:false,toneMapped:false}));sp.scale.set(size*4,size,1);sp.userData.cv=cv;sp.userData.tx=tx;sp.userData.font=x.font;return sp}
function relabel(sp,txt,col){const cv=sp.userData.cv,x=cv.getContext('2d');x.clearRect(0,0,256,64);x.font=sp.userData.font;x.textAlign='center';x.textBaseline='middle';x.shadowColor='#000';x.shadowBlur=8;x.fillStyle=col;x.fillText(txt,128,32);sp.userData.tx.needsUpdate=true}
function softTex(){const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d');const g=x.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.35,'rgba(255,255,255,.55)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,64,64);const t=new THREE.CanvasTexture(c);return t}
const PRESET={
 day:{top:0x3d7bcc,hor:0xc4daee,bot:0x55644f,sun:0xfff0d4,si:2.3,hsky:0xbcd5ef,hgnd:0x4a5a38,hi:.3,fog:0xb9cfe3,fn:150,ff:560,el:42,az:-38,stars:0,cloud:.38,exp:.88,sat:1.08,tint:0xfff6ea},
 dawn:{top:0x4a6db6,hor:0xf2ad78,bot:0x5a4a44,sun:0xffbf86,si:2.1,hsky:0xe6b99c,hgnd:0x3d392b,hi:.28,fog:0xe0b494,fn:130,ff:500,el:12,az:-78,stars:.1,cloud:.48,exp:.95,sat:1.1,tint:0xffeedd},
 dusk:{top:0x2f346c,hor:0xff9150,bot:0x43302a,sun:0xffa262,si:2.0,hsky:0xd6976b,hgnd:0x38291d,hi:.26,fog:0xc4774c,fn:120,ff:470,el:8,az:62,stars:.3,cloud:.52,exp:1,sat:1.08,tint:0xffe6d6},
 night:{top:0x040814,hor:0x15213c,bot:0x06090f,sun:0xa9bcff,si:.6,hsky:0x23314f,hgnd:0x0b0f0d,hi:.3,fog:0x0f1727,fn:100,ff:420,el:40,az:22,stars:1,cloud:.3,exp:1.35,sat:.85,tint:0xdde6ff},
 storm:{top:0x3a414b,hor:0x6b7381,bot:0x343935,sun:0xd2d8de,si:1.05,hsky:0x7c8491,hgnd:0x2a2f2a,hi:.4,fog:0x5b626a,fn:70,ff:300,el:36,az:-22,stars:0,cloud:.97,exp:1,sat:.82,tint:0xe9eef2}};
const QMAP={ultra:'ultra',high:'high',low:'low',lite:'lite'};
const WORLD={cur:null,tgt:null,sunDir:new V3(),U:{uTime:{value:0},uWind:{value:0}},craters:[],fires:[],wx:0,wind:0,flashT:0,lightT:0,quality:'high',post:null,postOn:false,envT:0,envDirty:true,
 init(){const c=$('#gl');const gi=GFX.gpuInfo();S.gpu=gi;let q0=PREF.quality==='auto'?(gi.soft?'lite':(innerWidth<760||(navigator.hardwareConcurrency||8)<=4)?'low':'high'):(QMAP[PREF.quality]||'high');this.q0=q0;GFX.std=q0!=='lite'&&!gi.soft;
  ren=new THREE.WebGLRenderer({canvas:c,antialias:q0==='lite'&&!gi.soft,powerPreference:'high-performance'});ren.setPixelRatio(Math.min(devicePixelRatio||1,GFX.TIERS[q0].pr));
  ren.outputEncoding=THREE.sRGBEncoding;ren.toneMapping=GFX.std?THREE.ACESFilmicToneMapping:GFX.softRender();ren.toneMappingExposure=1;ren.shadowMap.enabled=true;ren.shadowMap.type=THREE.PCFSoftShadowMap;GFX.aniso=Math.min(ren.capabilities.getMaxAnisotropy(),GFX.TIERS[q0].aniso);
  scene=new THREE.Scene();scene.fog=new THREE.Fog(0xb9cfe3,150,560);cam=new THREE.PerspectiveCamera(46,1,.5,1700);
  this.hemi=new THREE.HemisphereLight(0xbcd5ef,0x4a5a38,.6);scene.add(this.hemi);
  this.sun=new THREE.DirectionalLight(0xfff0d4,3);this.sun.castShadow=true;const sc=this.sun.shadow;sc.mapSize.set(GFX.TIERS[q0].shadow||1024,GFX.TIERS[q0].shadow||1024);sc.camera.left=-120;sc.camera.right=120;sc.camera.top=80;sc.camera.bottom=-80;sc.camera.near=20;sc.camera.far=520;sc.bias=-.0006;sc.normalBias=.035;sc.radius=2.5;scene.add(this.sun);scene.add(this.sun.target);
  this.soft=!GFX.std;this.flashL=new THREE.PointLight(0xdfe8ff,0,320);this.flashL.position.set(0,80,-20);if(!this.soft)scene.add(this.flashL);   /* software renderers get no point lights: each one is paid for at every lit vertex */
  this.sky=GFX.makeSky();scene.add(this.sky.mesh);this.mtn=GFX.mountains();scene.add(this.mtn);if(GFX.std)this.env=GFX.makeEnv(ren);
  const base=GFX.heightFn();this.hgtBase=base;this.hgt=(x,z)=>{let h=base(x,z);for(const k of this.craters){const dx=x-k[0],dz=z-k[1],d=dx*dx+dz*dz;if(d<k[2]*k[2]){const f=1-Math.sqrt(d)/k[2];h-=k[3]*f*f}}return h};
  this.terrain=GFX.terrain(q0,base);scene.add(this.terrain);this.tpos=this.terrain.geometry.attributes.position;this.TU=this.terrain.material.userData.U;
  this.flora(q0);this.bases();this.props();if(window.GFX4)try{this.env4=GFX4.build(scene,(x,z)=>this.hgt(x,z),q0)}catch(e){console.error(e);this.env4=null}if(window.GFX5)try{this.env5=GFX5.build(scene,(x,z)=>this.hgt(x,z),q0)}catch(e){console.error(e);this.env5=null}this.rainBuild();this.frontBuild();this.decals=GFX.decals(scene,48,(x,z)=>this.hgt(x,z));
  if(GFX.TIERS.ultra.post&&THREE.EffectComposer)this.post=GFX.post(ren,scene,cam,q0==='lite'?'low':q0);
  const p=PREF.sky==='auto'?this.regimePreset():PREF.sky==='clock'?this.clockPreset():PRESET[PREF.sky]||PRESET.day;this.cur=this.copy(p);this.tgt=p;this.apply(this.cur,true);this.resize();addEventListener('resize',()=>this.resize());R3=true},
 copy(p){return Object.assign({},p)},
 /* trees, dead trees, rocks, grass */
 flora(q){const T=GFX.TIERS[q],d=new THREE.Object3D(),lite=!GFX.std,std=GFX.std;const M=()=>std?new THREE.MeshStandardMaterial({vertexColors:true,roughness:.92,metalness:0}):new THREE.MeshLambertMaterial({vertexColors:true});
  const pine=new THREE.InstancedMesh(GFX.pineGeo(lite?2:false),M(),T.trees),leaf=new THREE.InstancedMesh(GFX.broadleafGeo(lite?2:false),M(),T.trees),dead=new THREE.InstancedMesh(GFX.deadTreeGeo(),M(),60);
  let np=0,nl=0,nd=0;const tc=new THREE.Color();
  for(let i=0;i<T.trees*6&&(np+nl)<T.trees*1.6;i++){const x=rnd(200,-200),z=rnd(105,-150);const core=Math.abs(x)<74&&z>-50&&z<50;if(core)continue;if(window.GFX4&&GFX4.blocked(x,z))continue;if(z>60&&Math.random()<.6)continue;const h=this.hgtBase(x,z);
   const s=.8+Math.random()*.75;(this.treeL||(this.treeL=[])).push({x,z,y:h,r:2.6*s,h:10*s});d.position.set(x,h-.15,z);d.rotation.set(0,rnd(6.28),0);d.scale.set(s,s*(.85+Math.random()*.4),s);d.updateMatrix();if(window.NAV&&Math.abs(x)<134&&Math.abs(z)<50)NAV.add(NAV.circle(x,z,.42*s,'tree'));
   const bear=x+G_n(x,z)*30>0;const k=.85+Math.random()*.3;if(bear&&Math.random()<.18&&nd<60){dead.setMatrixAt(nd++,d.matrix);continue}
   if((bear?Math.random()<.65:Math.random()<.45)&&np<T.trees){pine.setMatrixAt(np,d.matrix);tc.setRGB(k*(bear?1.08:.95),k*(bear?.92:1),k*(bear?.8:.95));pine.setColorAt(np++,tc)}
   else if(nl<T.trees){leaf.setMatrixAt(nl,d.matrix);tc.setRGB(k*(bear?1.7:.95),k*(bear?1.18:1.02),k*(bear?.45:.9));leaf.setColorAt(nl++,tc)}}
  /* scattered trees along the flanks of the battlefield */
  for(let i=0;i<40;i++){const x=rnd(70,-70),z=(Math.random()<.5?-1:1)*rnd(62,48);if(nl>=T.trees)break;if(window.GFX4&&GFX4.blocked(x,z))continue;d.position.set(x,this.hgtBase(x,z)-.15,z);const s=.7+Math.random()*.6;(this.treeL||(this.treeL=[])).push({x,z,y:this.hgtBase(x,z),r:2.6*s,h:10*s});d.scale.set(s,s,s);if(window.NAV&&Math.abs(z)<50)NAV.add(NAV.circle(x,z,.42*s,'tree'));d.rotation.set(0,rnd(6.28),0);d.updateMatrix();leaf.setMatrixAt(nl,d.matrix);const k=.9+Math.random()*.2;tc.setRGB(k*(x>0?1.6:.95),k*(x>0?1.15:1),k*(x>0?.5:.9));leaf.setColorAt(nl++,tc)}
  [[pine,np],[leaf,nl],[dead,nd]].forEach(([m,n])=>{m.count=n;m.castShadow=!lite;m.receiveShadow=std;m.instanceMatrix.needsUpdate=true;if(m.instanceColor)m.instanceColor.needsUpdate=true;scene.add(m)});
  const rocks=new THREE.InstancedMesh(GFX.rockGeo(),M(),T.rocks);let nr=0;for(let i=0;i<T.rocks*4&&nr<T.rocks;i++){const x=rnd(190,-190),z=rnd(100,-140);if(Math.abs(x)<66&&Math.abs(z)<44)continue;if(window.GFX4&&GFX4.blocked(x,z,1))continue;d.position.set(x,this.hgtBase(x,z)+.1,z);d.rotation.set(rnd(.4),rnd(6.28),rnd(.4));const s=.5+Math.pow(Math.random(),2)*2.6;d.scale.set(s,s*(.7+Math.random()*.5),s);d.updateMatrix();rocks.setMatrixAt(nr++,d.matrix);if(window.NAV&&Math.abs(x)<134&&Math.abs(z)<50)NAV.add(NAV.circle(x,z,1.25*s,'rock'))}
  rocks.count=nr;rocks.castShadow=!lite;rocks.receiveShadow=std;rocks.instanceMatrix.needsUpdate=true;scene.add(rocks);
  const gN=T.grass;const grass=new THREE.InstancedMesh(GFX.grassGeo(),GFX.grassMaterial(this.U),gN);let ng=0;
  for(let i=0;i<gN*3&&ng<gN;i++){const x=rnd(150,-150),z=rnd(80,-110);const rd=Math.abs(z-2*Math.sin(x*.035));if(rd<3.4&&Math.abs(x)<90)continue;if(window.GFX4&&GFX4.blocked(x,z,0))continue;if(Math.abs(x+84)<11&&Math.abs(z)<11||Math.abs(x-84)<11&&Math.abs(z)<11)continue;
   const bear=x+G_n(x*.5,z*.5)*36>0;if(bear&&Math.random()<.35)continue;d.position.set(x,this.hgtBase(x,z)-.03,z);d.rotation.set(0,rnd(6.28),0);const s=.65+Math.random()*.8;d.scale.set(s,s*(bear?.75:1),s);d.updateMatrix();grass.setMatrixAt(ng,d.matrix);
   const k=.85+Math.random()*.3;if(bear)tc.setRGB(.7*k,.58*k,.3*k);else tc.setRGB(.33*k,.55*k,.2*k);tc.convertSRGBToLinear();grass.setColorAt(ng++,tc)}
  grass.count=ng;grass.instanceMatrix.needsUpdate=true;grass.instanceColor.needsUpdate=true;grass.receiveShadow=std;scene.add(grass);this.grass=grass;this.grassN=ng},
 /* HQ compounds, flags, campfires */
 bases(){const std=GFX.std;const mk=(x,team,dir,name,lc)=>{const mat=GFX.vehicleMaterial(GFX.TEAMS[team],std,this.U,{dirt:.4});const grp=GFX.hq(GFX.TEAMS[team],mat,dir),m=dir<0?1:-1;/* built facing its own front, never turned */
   const pole=new THREE.Mesh(new THREE.CylinderGeometry(.1,.13,11,8),std?new THREE.MeshStandardMaterial({color:0xc8c8c8,metalness:.8,roughness:.3}):new THREE.MeshLambertMaterial({color:0xc8c8c8}));pole.position.set(0,5.5,4.8);pole.castShadow=true;grp.add(pole);
   const fg=new THREE.PlaneGeometry(4.6,2.6,14,7);const fc=GFX.lin(GFX.TEAMS[team].flag);const fm=std?new THREE.MeshStandardMaterial({color:fc,side:THREE.DoubleSide,roughness:.8,emissive:fc,emissiveIntensity:.18}):new THREE.MeshLambertMaterial({color:fc,side:THREE.DoubleSide,emissive:fc,emissiveIntensity:.2});
   fm.onBeforeCompile=sh=>{sh.uniforms.uTime=U.flagT=U.flagT||{value:0};sh.uniforms.uAmp=grp.userData.amp={value:.35};sh.vertexShader='uniform float uTime,uAmp;\n'+sh.vertexShader.replace('#include <begin_vertex>','vec3 transformed=position;float fx=(position.x+2.3)/4.6;transformed.z+=sin(fx*6.+uTime*5.)*uAmp*fx;transformed.y+=sin(fx*4.+uTime*3.)*uAmp*.3*fx;')};
   const fl=new THREE.Mesh(fg,fm);fl.position.set(2.35*m,9.6,4.8);fl.scale.x=m;fl.castShadow=true;grp.add(fl);grp.userData.flag=fl;grp.userData.flagY=9.6;
   const lb=GFX.label(name,lc,4.2,{glow:true});lb.position.set(0,15,0);grp.add(lb);grp.scale.setScalar(1.5);grp.position.set(x,this.hgtBase(x,0),0);scene.add(grp);
   /* the compound is solid ground for the navigation; troops come out of its door */
   if(window.NAV)for(const f of grp.userData.foot)NAV.add(f.t==='c'?NAV.circle(x+f.x*1.5,f.z*1.5,f.r*1.5+.1,'hq'):NAV.box(x+f.x*1.5,f.z*1.5,f.hx*1.5,f.hz*1.5,0,'hq'));grp.userData.doorW=[x+grp.userData.door[0]*1.5,grp.userData.door[1]*1.5];return grp};
  this.baseB=mk(-84,'bull',-1,'BULLS','#4ade80');this.baseR=mk(84,'bear',1,'BEARS','#f87171');   /* deep in the base: the yard between the gate and the command post is where units form up */
  const camp=x=>{if(this.soft)return;for(let i=0;i<3;i++){const f=new THREE.PointLight(0xff9a3a,0,16,2);f.position.set(x+rnd(5,-5),1.3,(i?1:-1)*(7.4+rnd(1,0)));scene.add(f);this.fires.push(f)}};camp(-84);camp(84)},
 /* obstacles + defence lines */
 props(){const std=GFX.std,d=new THREE.Object3D();const M=c=>std?new THREE.MeshStandardMaterial({vertexColors:true,roughness:.65,metalness:.45,color:c||0xffffff}):new THREE.MeshLambertMaterial({vertexColors:true});
  const hh=new THREE.InstancedMesh(GFX.hedgehogGeo(),M(),56),ww=new THREE.InstancedMesh(GFX.wireGeo(),M(),40);let nh=0,nw=0;
  [-1,1].forEach(s=>{for(let i=0;i<14;i++){const z=-44+i*6.6+rnd(1.6,-1.6);if(Math.abs(z-2*Math.sin(s*50*.035))<4)continue;const x=s*(50+rnd(3,-3)),sc=.9+Math.random()*.3;d.position.set(x,this.hgtBase(x,z),z);d.rotation.set(0,rnd(6.28),0);d.scale.setScalar(sc);d.updateMatrix();hh.setMatrixAt(nh++,d.matrix);if(window.NAV)NAV.add(NAV.circle(x,z,1.12*sc,'hedgehog'))}
   for(let i=0;i<10;i++){const z=-42+i*9+rnd(1,-1);if(Math.abs(z)<4)continue;const x=s*(44+rnd(1,-1)),ry=rnd(.3,-.3);d.position.set(x,this.hgtBase(x,z),z);d.rotation.set(0,ry,0);d.scale.setScalar(1);d.updateMatrix();ww.setMatrixAt(nw++,d.matrix);if(window.NAV)NAV.add(NAV.capsule(x-2.25*Math.sin(ry),z-2.25*Math.cos(ry),x+2.25*Math.sin(ry),z+2.25*Math.cos(ry),.46,'wire'))}});
  hh.count=nh;ww.count=nw;[hh,ww].forEach(m=>{m.castShadow=std;m.instanceMatrix.needsUpdate=true;scene.add(m)});this.obst=[hh,ww]},
 /* the price front: a living light curtain + ground glow, label above */
 frontBuild(){const U=this.FU={uTime:this.U.uTime,uCol:{value:GFX.lin(0xf7931a)},uOp:{value:1}};
  const m=new THREE.ShaderMaterial({uniforms:U,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,
   vertexShader:'varying vec2 vU;void main(){vU=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
   fragmentShader:'uniform float uTime,uOp;uniform vec3 uCol;varying vec2 vU;float h(float n){return fract(sin(n)*43758.5453);}void main(){float y=vU.y;float band=pow(1.-y,2.2);float scan=.65+.35*sin(vU.x*140.-uTime*6.+sin(vU.x*30.)*2.);float n=h(floor(vU.x*90.)+floor(uTime*8.));float flick=.8+.2*n;float a=band*scan*flick*uOp*(.55+.45*smoothstep(0.,.04,vU.x)*smoothstep(1.,.96,vU.x));gl_FragColor=vec4(uCol*2.2*a,a);\n#include <tonemapping_fragment>\n#include <encodings_fragment>\n}'});
  this.front=new THREE.Group();const cur=new THREE.Mesh(new THREE.PlaneGeometry(88,7,1,1),m);cur.rotation.y=Math.PI/2;cur.position.y=3.5;cur.renderOrder=4;this.front.add(cur);scene.add(this.front);
  if(this.soft){const c=document.createElement('canvas');c.width=64;c.height=4;const x=c.getContext('2d'),g=x.createLinearGradient(0,0,64,0);g.addColorStop(0,'rgba(255,150,40,0)');g.addColorStop(.5,'rgba(255,170,60,.95)');g.addColorStop(1,'rgba(255,150,40,0)');x.fillStyle=g;x.fillRect(0,0,64,4);
   const st=new THREE.Mesh(new THREE.PlaneGeometry(2.4,88),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false}));st.rotation.x=-Math.PI/2;st.position.y=.42;st.renderOrder=3;this.front.add(st)}
  this.frontLbl=makeLabel('—','#ffd59a',4.5);this.frontLbl.position.set(0,10.4,0);scene.add(this.frontLbl);this.markersG=null},
 markers(){if(!scene||!VIEW.round)return;if(this.markersG){scene.remove(this.markersG);this.markersG.traverse(o=>{if(o.material&&o.material.map)o.material.map.dispose()})}const G2=new THREE.Group(),r=VIEW.round,pts=[],st=VIEW.step;
  const k0=Math.ceil(r.low/st),k1=Math.floor(r.high/st);for(let k=k0;k<=k1;k++){const p=k*st,x=X(p);for(let z=-42;z<42;z+=3)pts.push(x,this.hgtBase(x,z)+.09,z,x,this.hgtBase(x,z+3)+.09,z+3);const lb=makeLabel(p.toLocaleString('en-US',{maximumFractionDigits:st<1?Math.max(0,-Math.floor(Math.log10(st))):0}),Math.abs(p-r.low)<1e-9?'#f87171':Math.abs(p-r.high)<1e-9?'#4ade80':'#e8e4d8',2.4);lb.position.set(x,1.5,45);G2.add(lb)}
  const lg=new THREE.BufferGeometry();lg.setAttribute('position',new THREE.Float32BufferAttribute(pts,3));G2.add(new THREE.LineSegments(lg,new THREE.LineBasicMaterial({color:0xffffff,transparent:true,opacity:.16})));
  const mkW=(x,c)=>{const w=new THREE.Mesh(new THREE.PlaneGeometry(86,2.6),new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:.28,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));w.rotation.y=Math.PI/2;w.position.set(x,1.3,0);return w};G2.add(mkW(X(r.low),0xef4444));G2.add(mkW(X(r.high),0x22c55e));scene.add(G2);this.markersG=G2},
 rainBuild(){const N=3200,base=new Float32Array(N*3),spd=new Float32Array(N);for(let i=0;i<N;i++){base[i*3]=rnd(150,-150);base[i*3+1]=Math.random()*90;base[i*3+2]=rnd(90,-120);spd[i]=40+Math.random()*24}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(base,3));g.setAttribute('aSpd',new THREE.BufferAttribute(spd,1));this.rainU={uTime:{value:0},uWind:{value:0},uOp:{value:0},uPR:{value:ren.getPixelRatio()}};
  const m=new THREE.ShaderMaterial({uniforms:this.rainU,transparent:true,depthWrite:false,vertexShader:'attribute float aSpd;uniform float uTime,uWind,uPR;void main(){float yy=mod(position.y-uTime*aSpd,90.);vec3 p=vec3(position.x+uWind*yy*.35,yy,position.z);vec4 mv=modelViewMatrix*vec4(p,1.);gl_PointSize=uPR*max(1.,130./max(1.,-mv.z));gl_Position=projectionMatrix*mv;}',
   fragmentShader:'uniform float uOp;void main(){vec2 c=gl_PointCoord-.5;if(abs(c.x)>.1)discard;gl_FragColor=vec4(.7,.78,.9,uOp*(1.-abs(c.y)*2.));\n#include <tonemapping_fragment>\n#include <encodings_fragment>\n}'});this.rain=new THREE.Points(g,m);this.rain.frustumCulled=false;this.rain.visible=false;scene.add(this.rain)},
 crater(x,z,r,depth){if(!this.terrain||!GFX.std)return;
  /* the ground only gives way where nothing stands on it: a crater stops short of wire, hedgehogs, wrecks, guns and buildings */
  if(window.NAV&&NAV.ready){const room=NAV.clear(x,z,true)-.4;if(room<r){if(room<1.2)return;depth*=room/r;r=room}}
  this.craters.push([x,z,r,depth]);this.dent(x,z,r,depth,1);
  if(this.craters.length>24){const o=this.craters.shift();this.dent(o[0],o[1],o[2],o[3],-1)}                         // the oldest one is filled in again
  const T=this.TU;if(T){const a=T.uCraters.value;for(let i=a.length-1;i>0;i--)a[i].copy(a[i-1]);a[0].set(x,z,r*1.35,1)}
  ARMY.settle(x,z,r+3)},                                                                                                   // whatever stands near it settles onto the new ground
 dent(x,z,r,depth,sg){const pos=this.tpos;let any=false;for(let i=0;i<pos.count;i++){const dx=pos.getX(i)-x,dz=pos.getZ(i)-z;if(Math.abs(dx)>r||Math.abs(dz)>r)continue;const d=Math.sqrt(dx*dx+dz*dz);if(d>r)continue;const f=1-d/r;pos.setY(i,pos.getY(i)+sg*(-depth*f*f+(f<.25?depth*.3*Math.sin(f*12.5):0)));any=true}
  if(any){pos.needsUpdate=true;this.terrain.geometry.computeVertexNormals()}if(this.env4)this.env4.crater(x,z,r)},
 /* the height of the ground as it is drawn (the terrain mesh's own triangles, craters and all): feet and tracks stand on what is seen */
 meshH(x,z){const g=this.terrain&&this.terrain.geometry,P=g&&g.parameters;if(!P)return this.hgt(x,z);const nx=P.widthSegments,nz=P.heightSegments,fx=(x+P.width/2)/(P.width/nx),fz=(z+18+P.height/2)/(P.height/nz);
  if(fx<0||fz<0||fx>=nx||fz>=nz)return this.hgt(x,z);const ix=Math.floor(fx),iz=Math.floor(fz),u=fx-ix,v=fz-iz,W1=nx+1,p=this.tpos,ha=p.getY(iz*W1+ix),hb=p.getY((iz+1)*W1+ix),hc=p.getY((iz+1)*W1+ix+1),hd=p.getY(iz*W1+ix+1);
  return u+v<=1?ha+(hd-ha)*u+(hb-ha)*v:hc+(hb-hc)*(1-u)+(hd-hc)*(1-v)},
 /* presets, weather, time */
 regimePreset(){if(S.nightUntil&&Date.now()<S.nightUntil)return PRESET.night;const r=S.regime||'';return r==='bull'?PRESET.dawn:r==='bear'?PRESET.dusk:r==='high_volatility'?PRESET.storm:PRESET.day},
 clockPreset(){const h=new Date().getHours()+new Date().getMinutes()/60;return h<5?PRESET.night:h<7?PRESET.dawn:h<17?PRESET.day:h<19.5?PRESET.dusk:PRESET.night},
 skyMode(){const p=PREF.sky==='auto'?this.regimePreset():PREF.sky==='clock'?this.clockPreset():PRESET[PREF.sky]||PRESET.day;this.tgt=p;this.tgtT=now();this.envDirty=true},
 blend(a,b,t){const o={};const CK=/^(top|hor|bot|sun|hsky|hgnd|fog|tint)$/;for(const k in b){if(CK.test(k)){const ca=new THREE.Color(a[k]),cb=new THREE.Color(b[k]);o[k]=ca.lerp(cb,t).getHex()}else o[k]=lerp(a[k],b[k],t)}return o},
 apply(p,force){const wx=this.wx,storm=clamp(wx-1,0,2)/2,L=h=>GFX.lin(h),S2=PRESET.storm;const u=this.sky.U;
  u.uZenith.value.copy(L(p.top)).lerp(L(S2.top),storm*.85);u.uHorizon.value.copy(L(p.hor)).lerp(L(S2.hor),storm*.85);u.uGround.value.copy(L(p.bot));u.uSunCol.value.copy(L(p.sun)).multiplyScalar(1-storm*.7);
  u.uStars.value=p.stars*(1-storm);u.uCloud.value=clamp(p.cloud+storm*.6+(wx===1?.12:0),0,1);u.uStorm.value=clamp(storm+Math.max(0,p.cloud-.9)*10,0,1)*.9;
  const el=p.el*Math.PI/180,az=p.az*Math.PI/180;this.sunDir.set(Math.cos(el)*Math.sin(az),Math.sin(el),Math.cos(el)*Math.cos(az)).normalize();u.uSun.value.copy(this.sunDir);if(this.env4)this.env4.mood(p,storm);if(this.env5)this.env5.mood(p,storm);
  this.sun.position.copy(this.sunDir).multiplyScalar(260);this.sun.color.copy(L(p.sun));this.sun.intensity=p.si*(1-storm*.6);
  this.hemi.color.copy(L(p.hsky)).lerp(L(S2.hsky),storm*.7);this.hemi.groundColor.copy(L(p.hgnd));this.hemi.intensity=p.hi*(GFX.std?1:1.6);
  const fog=L(p.fog).lerp(L(S2.fog),storm*.8);scene.fog.color.copy(fog);const fogK=this.discFog?.45:1;scene.fog.near=lerp(p.fn,55,storm*.9)*(wx===1?.85:1)*fogK;scene.fog.far=lerp(p.ff,230,storm*.9)*(wx===1?.85:1)*fogK;
  this.mtn.userData.U.uCol.value.copy(fog).lerp(L(p.hor),.25);this.mtn.userData.U.uTop.value.copy(L(p.hor)).lerp(L(p.top),.35);
  ren.toneMappingExposure=p.exp;this.fires.forEach(f=>f.userData.on=p.stars>.25);
  if(this.TU)this.TU.uWet.value=wx>=3?1:0;
  if(this.post){const g=this.post.grade.uniforms,tc=new THREE.Color(p.tint);g.uSat.value=p.sat*(1-storm*.18);g.uTint.value.set(tc.r,tc.g,tc.b);g.uCon.value=1.1+storm*.08;g.uVig.value=1.05+storm*.25}
  if(this.env&&(force||this.envDirty&&now()-this.envT>2500)){this.envT=now();this.envDirty=false;scene.environment=this.env.update(this.sky);if(!this.envK){this.envK=1;scene.traverse(o=>{const m=o.material;if(m&&m.isMeshStandardMaterial)m.envMapIntensity=m.userData.envK!=null?m.userData.envK:.5})}}},
 weather(){const s=S.sigma;let lv=this.wx;const up=[.05,.15,.4],dn=[.04,.12,.32];if(lv<3&&s>up[lv])lv++;else if(lv>0&&s<dn[lv-1])lv--;if(lv!==this.wx){this.wx=lv;this.rain.visible=lv>=3;this.rainU.uOp.value=lv>=3?.5:0;AUDIO.weather(lv);this.envDirty=true}
  this.wind=clamp((S.pressure-.5)*2,-1,1)},
 tick(dt,t){U.t=t;this.U.uTime.value=t;if(this.env4)this.env4.tick(dt,t);if(this.env5)this.env5.tick(dt,t);if(S.nightUntil&&Date.now()>S.nightUntil){S.nightUntil=0;this.skyMode()}this.U.uWind.value=this.wind;if(this.tgt&&this.cur){const k=PREF.sky==='auto'||PREF.sky==='clock'?Math.min(1,dt/90):Math.min(1,dt/2.5);this.cur=this.blend(this.cur,this.tgt,k);if(k<1&&Math.abs(this.cur.si-this.tgt.si)>.01)this.envDirty=true;this.apply(this.cur)}
  this.sky.U.uTime.value=t;if(U.flagT)U.flagT.value=t;const ch=VIEW.open?Math.abs(VIEW.price/VIEW.open-1)*100:0;[this.baseB,this.baseR].forEach(b=>{if(b.userData.amp)b.userData.amp.value=.25+clamp(ch*.15,0,.5)+this.wx*.1;if(b.userData.radar)b.userData.radar.rotation.y+=dt*.8});
  this.rainU.uTime.value=t;this.rainU.uWind.value=this.wind*.9;this.rainU.uPR.value=ren.getPixelRatio();
  if(this.TU)this.TU.uFront.value=this.front?this.front.position.x:0;
  if(this.wx>=2&&PREF.layers.fx&&S.quality!=='lite'&&Math.random()<.5)FX.dust(this.wind);
  if(this.wx>=3&&now()>this.lightT&&Math.random()<dt*.08){this.lightning(1)}
  if(this.flashT>0){this.flashT-=dt;const f=clamp(this.flashT*6,0,1);this.sky.U.uFlash.value=f*.55;this.flashL.intensity=f*5;$('#flash').style.opacity=f*.22;if(this.post)this.post.grade.uniforms.uFlash.value=f*.25;if(this.flashT<=0){this.sky.U.uFlash.value=0;this.flashL.intensity=0;$('#flash').style.opacity=0;if(this.post)this.post.grade.uniforms.uFlash.value=0}}
  this.fires.forEach(f=>{f.intensity=f.userData.on?2.4+Math.sin(t*9+f.position.z)*.7+Math.random()*.5:0});if(this.decals)this.decals.tick(dt);
  if(this.post)this.post.grade.uniforms.uTime.value=t;
  /* the shadow camera follows the action */
  const fx=this.front?this.front.position.x:0;this.sun.target.position.set(fx*.4,0,-6);this.sun.position.copy(this.sunDir).multiplyScalar(260).add(this.sun.target.position);this.sun.target.updateMatrixWorld()},
 /* software renderers: sharpen the picture while there is speed to spare, soften it when there is not */
 govern(fps){const pr=ren.getPixelRatio(),mx=Math.min(devicePixelRatio||1,1);let np=pr;if(fps<23)np=Math.max(.55,pr-.1);else if(fps>41&&pr<mx)np=Math.min(mx,pr+.07);if(Math.abs(np-pr)>.001){this.prSoft=np;ren.setPixelRatio(np);this.resize()}},
 lightning(str){if(REDUCED())str*=.4;this.flashT=.18*str;this.lightT=now()+4000;AUDIO.play('thunder',{vol:.7*str,delay:.5+Math.random()})},
 resize(){if(!ren)return;const b=$('#bf'),w=b.clientWidth,h=b.clientHeight;ren.setSize(w,h,false);cam.aspect=w/h;cam.updateProjectionMatrix();if(this.post)this.post.size(w,h);if(DIRECTOR.ortho){const a=w/h,s=70;DIRECTOR.ortho.left=-s*a;DIRECTOR.ortho.right=s*a;DIRECTOR.ortho.top=s;DIRECTOR.ortho.bottom=-s;DIRECTOR.ortho.updateProjectionMatrix()}},
 setQuality(q){q=QMAP[q]||'high';S.quality=q;const T=GFX.TIERS[q],lite=q==='lite';ren.shadowMap.enabled=!!T.shadow;this.sun.castShadow=!!T.shadow;if(T.shadow&&this.sun.shadow.mapSize.x!==T.shadow){this.sun.shadow.mapSize.set(T.shadow,T.shadow);if(this.sun.shadow.map){this.sun.shadow.map.dispose();this.sun.shadow.map=null}}
  ren.setPixelRatio(Math.min(devicePixelRatio||1,this.soft&&this.prSoft||T.pr));scene.traverse(o=>{if(o.material&&o.material.needsUpdate!==undefined)o.material.needsUpdate=true});
  this.postOn=!!(this.post&&T.post);if(this.post&&this.post.bloom)this.post.bloom.enabled=!!T.bloom;if(this.post&&this.post.fxaa)this.post.fxaa.enabled=!!T.fxaa;
  if(this.grass)this.grass.count=Math.min(this.grassN,T.grass);ARMY.CAP=Math.min(ARMY.MAX,T.cap);ARMY.setLite(lite);FX.K=lite?.45:q==='low'?.75:1;this.resize()}};
const G_n=(x,z)=>GFX.noise(x*.03,z*.03);

/* ======================= units 5.0: individually posed infantry (rifle, machine gun, anti-tank, leader), IFVs, MBTs, artillery, MLRS, trucks ======================= */
const ST={IDLE:0,RUN:1,FIRE:2,DIE:3,CHEER:4,REST:5,STAG:6,WALK:7};
const SC={sold:1.7,ifv:1.5,mbt:1.7,mega:2.0,gun:1.45};                    // world scale of each class
const UK={sold:6,ifv:8,mbt:20,mega:54,wall:18,convoy:7,fort:36,scn:30};     // how many units a bucket fields as infantry, what each vehicle stands for, and how many units make a wall / convoy / fort
const ROLE=[0,0,1,3,0,2];                                                   // by place in the fire team: rifle, rifle, machine gun, leader, rifle, anti-tank
const wrapA=a=>{while(a>Math.PI)a-=2*Math.PI;while(a<-Math.PI)a+=2*Math.PI;return a};
const XMAX=61.5,GATE=63,gateZ=x=>2*Math.sin(x*.035);                       // armies stand inside the round's range; each base's gate is on the road, just behind the round's edge
const ARMY={CAP:150,MAX:150,TCAP:16,VMAX:12,TARGET:200,convoyT:{},sides:{},rest:false,dummy:new THREE.Object3D(),tmpC:new THREE.Color(),m4:new THREE.Matrix4(),q4:new THREE.Quaternion(),v3a:new THREE.Vector3(),v3b:new THREE.Vector3(),lite:false,
 init(){const AU={uTime:(U.anim=U.anim||{value:0})};this.AU=AU;this.soft=!GFX.std;this.skin=GFX5.skinOK(ren);
  /* four role models (software renderers get the lighter cut), one bone texture for both armies */
  this.geos=[0,1,2,3].map(r=>GFX5.infantryGeo(r,this.soft?1:0));this.rows=this.MAX*2+(window.GFX6?GFX6.RB.rows:0);/* the machines' rows follow the two armies' */this.boneTex=GFX5.boneTexture(this.rows);this.Q=new Float32Array(20);
  this.tkGeo={lh:GFX.ifvHull(),lt:GFX.ifvTurret(),hh:GFX.mbtHull(),ht:GFX.mbtTurret()};
  if(this.soft)this.shadowBuild();
  this.sides.bull=this.mkSide('bull',-1);this.sides.bear=this.mkSide('bear',1);
  this.fortBuild();this.artillery()},
 mkSide(team,dir){const TM=GFX.TEAMS[team],std=GFX.std,cap=this.MAX;const sm=GFX5.infantryMaterial(TM,std,this.boneTex,this.rows,this.skin);
  const meshes=this.geos.map(g0=>{const g=g0.clone(),row=new THREE.InstancedBufferAttribute(new Float32Array(cap),1);row.setUsage(THREE.DynamicDrawUsage);g.setAttribute('aRow',row);const m=new THREE.InstancedMesh(g,sm.mat,cap);m.customDepthMaterial=sm.depth;m.castShadow=true;m.receiveShadow=std;m.frustumCulled=false;m.count=0;scene.add(m);return m});
  const vm=GFX.vehicleMaterial(TM,std,this.AU,{recoil:true});
  const mkT=(hg,tg)=>{const tgc=tg.clone();const fire=new THREE.InstancedBufferAttribute(new Float32Array(this.TCAP).fill(-10),1);fire.setUsage(THREE.DynamicDrawUsage);tgc.setAttribute('aFire',fire);const hgc=hg.clone();hgc.setAttribute('aFire',new THREE.InstancedBufferAttribute(new Float32Array(this.TCAP).fill(-10),1));
   const hull=new THREE.InstancedMesh(hgc,vm,this.TCAP),tur=new THREE.InstancedMesh(tgc,vm,this.TCAP);[hull,tur].forEach(m=>{m.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(this.TCAP*3).fill(1),3);m.instanceColor.setUsage(THREE.DynamicDrawUsage);m.count=0;m.castShadow=true;m.receiveShadow=std;m.frustumCulled=false;scene.add(m)});return {hull,tur,fire}};
  return {team,dir,meshes,smat:sm,row0:dir<0?0:this.MAX,sold:[],slots:new Map(),tk:[mkT(this.tkGeo.lh,this.tkGeo.lt),mkT(this.tkGeo.hh,this.tkGeo.ht)],veh:[],sh:this.soft?this.shadowMesh(cap):null,vsh:this.soft?this.shadowMesh(this.TCAP*2):null,pcol:new THREE.Color(TM.flag).convertSRGBToLinear(),spawnFrom:null,lastSurge:0,front:[],frontT:0}},
 /* software renderers draw no shadow map: a soft dark disc under every soldier and vehicle keeps them on the ground */
 shadowBuild(){const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d'),g=x.createRadialGradient(32,32,2,32,32,31);g.addColorStop(0,'rgba(0,0,0,.6)');g.addColorStop(.5,'rgba(0,0,0,.36)');g.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=g;x.fillRect(0,0,64,64);
  this.shMat=new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3});this.shGeo=new THREE.PlaneGeometry(1,1);this.shGeo.rotateX(-Math.PI/2)},
 shadowMesh(n){const m=new THREE.InstancedMesh(this.shGeo,this.shMat,n);m.count=0;m.frustumCulled=false;m.renderOrder=2;scene.add(m);return m},
 setLite(on){this.lite=on},
 clear(){for(const k in this.sides){const A=this.sides[k];A.sold=[];A.slots=new Map();A.veh=[];A.front=[];A.meshes.forEach(m=>m.count=0);A.tk.forEach(t=>{t.hull.count=t.tur.count=0});if(A.sh)A.sh.count=0;if(A.vsh)A.vsh.count=0}
  [this.hesco,this.empl,this.penn].forEach(m=>{if(m){m.count=0;m.instanceMatrix.needsUpdate=true}});this.bunkers.forEach(b=>b.visible=false);for(const tr of this.trucks||[]){tr.on=false;tr.g.visible=false}this.works=[];this.navDirty=true;if(window.GFX6)GFX6.clear()},
 /* a bucket fields up to six infantry (one fire team); the rest of its liquidity arrives as armour */
 alloc(u){const sold=Math.min(u,UK.sold);let r=u-sold;const mega=r>=UK.mega?1:0;r-=mega*UK.mega;const heavy=Math.min(2,Math.floor(r/UK.mbt));r-=heavy*UK.mbt;const light=Math.min(2,Math.floor(r/UK.ifv));return {mega,heavy,light,sold}},
 update(M){const t=vt();if(t-M.armT<220)return;M.armT=t;this.updSide(this.sides.bull,M,M.bk.b,'b');this.updSide(this.sides.bear,M,M.bk.a,'a');this.forts(M);HUD.unit(M)},
 /* a fire team stands in a shallow wedge behind its leader, somewhere along its price band */
 spot(A,sl,idx){const e=-A.dir,m=idx%6,row=Math.floor(idx/6);const fx=[0,-.95,-.95,-1.9,-1.9,-2.7][m]-row*2.7,fz=[0,-2,2,-4,4,0][m];
  const h=Math.sin(idx*12.9898+sl.zc*78.233)*43758.5453,j=h-Math.floor(h)-.5;return {x:sl.x+e*fx+j*.5,z:clamp(sl.zc+fz+j*.8,-37,37)}},
 kill(A,s,t){s.st=ST.DIE;s.t0=t;s.mv=0;s.key='';if(PREF.layers.fx&&S.quality!=='lite'&&Math.random()<.35)FX.blood(s.x,s.z)},
 retreat(A,s,t){s.st=ST.RUN;s.mv=2;s.key='';s.sp=10.5;s.held=false;const d=A.door||[A.dir*(GATE+6),gateZ(A.dir*GATE)];if(!this.navOn){this.route(A,s,d,t,null);return}s.t0=t;this.setPath(s,[[s.x,s.z],[s.x+.01,s.z]],t);s.dur=600;s.tx=d[0];s.tz=d[1];if(!s.rq){s.rq=1;(this.rq||(this.rq=[])).push([A,s])}},   /* routed in ARMY.tick, a few per frame */
 /* ---- ground movement on the navigation map (nav.js): soldiers, armour and lorries keep to clear ground, go round each other and never through anything solid ---- */
 VB:[[3.55,1.62],[4.3,2.28],[5.06,2.68],[3.45,1.6]],                       // half length, half width (m): IFV, MBT, heavy tank, lorry
 navOn:false,works:[],navDirty:true,navSig:'',navT:0,
 navInit(){for(const k in this.sides){const A=this.sides[k],d=(A.dir<0?WORLD.baseB:WORLD.baseR).userData.doorW;A.gate=[A.dir*GATE,gateZ(A.dir*GATE)];{const D=A.dir,gz=A.gate[1];A.walk=[4.3,-4.3].map(o=>NAV.free(D*(GATE+2.4),gz+o,.45,2.5)||[D*(GATE+2.4),gz+o]);A.door=A.walk[0];A.hqDoor=NAV.free(d[0],d[1],.6,6)||d}const sh=window.GFX5&&GFX5.shed?GFX5.shed(A.team):null;A.pool=sh?[sh.x,sh.z]:NAV.free(A.dir*70,-14,6.5,16)||[A.dir*70,-14];A.poolH=sh?-Math.PI/2:(A.dir<0?0:Math.PI);A.shed=sh?{x:sh.x,door:sh.door,hw:sh.hw,open:0,user:null}:null}this.navOn=true;this.navDirty=true},
 /* everything that drives: both armies' vehicles (burning ones too) and the lorries */
 movers(){const L=[];for(const k in this.sides)for(const v of this.sides[k].veh)if(!v.hold)L.push(v);for(const tr of this.trucks)if(tr.on&&!tr.hold)L.push(tr);return L},
 /* what a man or a machine on foot must not step into: a hull, or the whole circle of one turning on the spot */
 inWay(x,z,pad){const t=vt();for(const o of this.movers()){if(Math.abs(o.x-x)>16||Math.abs(o.z-z)>16)continue;const b=this.VB[o.tier],op=o.ops&&o.ops[o.oi];if(op&&op.k==='P'&&!o.dead){const r=this.hd2(o)+pad;if((o.x-x)*(o.x-x)+(o.z-z)*(o.z-z)<r*r)return o}else if(NAV.inBox(x,z,o.x,o.z,o.hd,b[0],b[1],pad))return o;
   if(op&&!o.dead&&o.la1&&o.la2&&t-(o.laT||-1e9)<300){const P1=o.la1,P2=o.la2;if(NAV.inBox(x,z,P1[0],P1[1],P1[2],b[0],b[1],pad)||NAV.inBox(x,z,P2[0],P2[1],P2[2],b[0],b[1],pad))return o}}return null},   // (and the ground it is about to cover)
 inMover(x,z,pad){for(const o of this.movers()){if(Math.abs(o.x-x)>8||Math.abs(o.z-z)>8)continue;const b=this.VB[o.tier];if(NAV.inBox(x,z,o.x,o.z,o.hd,b[0],b[1],pad))return o}return null},
 /* a standing place for a soldier: his place in the fire team, moved to the nearest clear ground nobody else has taken */
 standSpot(A,sl,idx,self){const o=this.spot(A,sl,idx);if(!this.navOn)return o;const p=NAV.free(o.x,o.z,.5,6,(x,z)=>Math.abs(z)<=37&&!this.taken(x,z,self))||NAV.free(o.x,o.z,.5,8)||[o.x,o.z];o.x=p[0];o.z=p[1];return o},
 taken(x,z,self){for(const k in this.sides){for(const s of this.sides[k].sold){if(s===self||s.st===ST.DIE||s.mv===2)continue;const px=s.mv?s.tx:s.x,pz=s.mv?s.tz:s.z;if((px-x)*(px-x)+(pz-z)*(pz-z)<.81)return true}
   for(const v of this.sides[k].veh){const B=this.VB[v.tier];if(NAV.inBox(x,z,v.x,v.z,v.hd,B[0],B[1],.7))return true;if(v.mv&&!v.home&&v.gx!=null&&NAV.inBox(x,z,v.gx,v.gz,v.ghd==null?v.hd:v.ghd,B[0],B[1],.7))return true}}return false},
 /* a run along a route: one ease in and out over the whole of it, turning at its corners */
 route(A,o,dest,t,flow){let F=flow&&NAV.flowPath(flow,o.x,o.z);if(F&&flow.ver!==NAV.ver)for(let i=1;F&&i<F.length;i++)if(!NAV.lineClear(F[i-1][0],F[i-1][1],F[i][0],F[i][1],.28))F=null;   /* a stale field's route is used only if it is still clear */
  let P=F||(this.navOn?NAV.path(o.x,o.z,dest[0],dest[1],.45):null);
  /* no way through: never walk straight through the wall; aim for the nearest reachable spot near the goal, or hold where he is */
  if(!P&&this.navOn){const q=NAV.free(dest[0],dest[1],.45,10);P=q?NAV.path(o.x,o.z,q[0],q[1],.45):null;if(P){o.tx=q[0];o.tz=q[1]}else P=[[o.x,o.z],[o.x+.01,o.z]]}
  if(!P)P=[[o.x,o.z],[dest[0],dest[1]]];this.setPath(o,P,t)},
 setPath(o,P,t){const L=[0];for(let i=1;i<P.length;i++)L.push(L[i-1]+Math.hypot(P[i][0]-P[i-1][0],P[i][1]-P[i-1][1]));const e=P[P.length-1];o.pl=P;o.plL=L;o.D=Math.max(L[L.length-1],.01);o.x0=o.x;o.z0=o.z;o.tx=e[0];o.tz=e[1];o.t0=Math.max(t,o.t0||0);o.dur=clamp(o.D/(o.sp||10),.25,16);
  o.cv=P.length===2&&o.D>=12&&(!this.navOn||NAV.lineClear(P[0][0],P[0][1],e[0],e[1],4.9))?rnd(4,-4):0;o.legs=null},
 along(o,e,out){const s=e*o.D,L=o.plL,P=o.pl;let i=1;while(i<L.length-1&&L[i]<s)i++;const a=P[i-1],b=P[i],l=L[i]-L[i-1]||1,f=clamp((s-L[i-1])/l,0,1);out[0]=a[0]+(b[0]-a[0])*f;out[1]=a[1]+(b[1]-a[1])*f;out[2]=Math.atan2(-(b[1]-a[1]),b[0]-a[0]);return out},
 leg(o,p,t){this.route(null,o,p,t)},
 /* a soldier steps out of the way of a vehicle coming at him */
 dodge(s,v,t){const B=this.VB[v.tier],c=Math.cos(v.hd),sn=Math.sin(v.hd),dx=s.x-v.x,dz=s.z-v.z,lx=dx*c-dz*sn,lz=dx*sn+dz*c,nz=(lz>=0?1:-1)*(B[1]+1.7),wx=v.x+lx*c+nz*sn,wz=v.z-lx*sn+nz*c;
  if(s.mv&&!s.after)s.after={tx:s.tx,tz:s.tz,mv:s.mv,st:s.st,sp:s.sp};const r=this.hd2(v)+.9,p=NAV.free(wx,wz,.5,6,(x,z)=>!NAV.inBox(x,z,v.x,v.z,v.hd,B[0]+4,B[1]+.9)&&(x-v.x)*(x-v.x)+(z-v.z)*(z-v.z)>r*r&&!this.taken(x,z,s))||NAV.free(wx,wz,.5,5,(x,z)=>!NAV.inBox(x,z,v.x,v.z,v.hd,B[0]+4,B[1]+.9)&&!this.taken(x,z,s))||[wx,wz];s.dodge=t+2600;s.mv=1;s.st=ST.WALK;s.sp=4.4;s.t0=t;this.route(null,s,p,t)},
 updSide(A,M,buckets,sk){const tn=Date.now(),t=vt(),UN=M.UN,seen=new Set(),cap=Math.min(this.CAP,this.MAX),want=[],need=[];
  for(const b of buckets){const x0=X(b.p);if(Math.abs(x0)>XMAX)continue;const key=sk+b.k;seen.add(key);let sl=A.slots.get(key);if(!sl){sl={alive:[],u:-1,zc:-31+62*(((b.k*.618034)%1+1)%1)};A.slots.set(key,sl)}
   let u=Math.round(b.usd/UN);if(sl.u>=3&&u>0&&Math.abs(u-sl.u)<=Math.max(1,sl.u*.12))u=sl.u;else sl.u=u;       // small ripples in a bucket do not reshuffle its units
   sl.x=x0;sl.p=b.p;sl.w=b.w*M.scale;sl.age=tn-(M.first.get(key)||tn);const al=this.alloc(u);
   if(al.mega)want.push({id:key+'m',key,sl,tier:2,i:0,usd:b.usd});for(let i=0;i<al.heavy;i++)want.push({id:key+'h'+i,key,sl,tier:1,i:i+1,usd:b.usd});for(let i=0;i<al.light;i++)want.push({id:key+'l'+i,key,sl,tier:0,i:i+3,usd:b.usd});
   need.push([sl,key,al.sold,b]);
   const rk=sl.age>120000?2:sl.age>30000?1:0;if(sl.rank!==rk){sl.rank=rk;for(const s of sl.alive)s.rank=rk}}
  /* men no longer needed where they stand are spare; men already walking home are spare too. Every gap in the line is filled from
     the spares nearest to it first, and only then does the base send out new men; only the spares left over walk home. So no army
     walks one squad home while sending an equal one out, and the base yard does not fill with men passing each other. */
  const spare=[];for(const s of A.sold)if(s.mv===2&&s.st!==ST.DIE)spare.push(s);
  for(const [key,sl] of A.slots){if(seen.has(key))continue;for(const s of sl.alive)if(s.st!==ST.DIE)spare.push(s);A.slots.delete(key)}
  for(const [sl,key,n,b] of need){if(sl.alive.length<=n)continue;const traded=M.trades.some(x=>tn-x.t<3000&&Math.abs(x.p-b.p)<=b.w*1.5);
   while(sl.alive.length>n){const s=sl.alive.pop();if(s.st===ST.DIE)continue;if(traded)this.kill(A,s,t);else spare.push(s)}}
  for(const [sl,key,n] of need){
   while(sl.alive.length<n&&spare.length){let bi=0,bd=1e9;for(let q=0;q<spare.length;q++){const d=Math.abs(spare[q].x-sl.x)+Math.abs(spare[q].z-sl.zc)*.3;if(d<bd){bd=d;bi=q}}
    const s=spare.splice(bi,1)[0],idx=sl.alive.length,o=this.standSpot(A,sl,idx);s.key=key;s.rank=sl.rank||0;s.after=null;s.held=false;s.mv=1;s.st=ST.RUN;s.sp=s.role===1?9:10.5;s.t0=t;this.setPath(s,[[s.x,s.z],[s.x+.01,s.z]],t);s.dur=600;s.tx=o.x;s.tz=o.z;if(!s.rq){s.rq=1;(this.rq||(this.rq=[])).push([A,s])}sl.alive.push(s)}
   const cur=sl.alive.length,al={sold:n};
   if(al.sold>cur){const n=Math.min(al.sold-cur,cap-A.sold.length);for(let i=0;i<n;i++){const idx=sl.alive.length,o=this.standSpot(A,sl,idx),from=A.spawnFrom&&A.spawnFrom.until>tn?A.spawnFrom:null,role=ROLE[idx%6],sd=Math.random();
     /* out of the command post's door one after another, or off the back of a lorry */
     const d0=from?[from.x,from.z]:(A.walk?A.walk[(A.sold.length+i)&1]:A.door||[A.dir*(GATE+5),gateZ(A.dir*GATE)]),p0=this.navOn?(NAV.free(d0[0]+rnd(.5,-.5),d0[1]+rnd(1,-1),.45,4)||d0):d0;
     const s={key,st:ST.RUN,t0:t+i*(from?150:230)+Math.random()*80,held:true,x:p0[0],z:p0[1],tx:o.x,tz:o.z,mv:1,sd,rank:sl.rank||0,role,stn:GFX5.stance(role,sd),yaw:rnd(.3,-.3),cv:0,i:A.sold.length,ry:A.dir<0?0:Math.PI,y:0,gyT:0,sp:role===1?9:10.5};
     this.setPath(s,[[s.x,s.z],[s.x+.01,s.z]],s.t0);s.dur=600;s.tx=o.x;s.tz=o.z;s.rq=1;(this.rq||(this.rq=[])).push([A,s]);sl.alive.push(s);A.sold.push(s)}}   /* the route is drawn a few men per frame (ARMY.tick): a big order no longer stalls the page */
  }
  for(const s of spare)if(s.mv!==2&&s.st!==ST.DIE)this.retreat(A,s,t);
  this.updVeh(A,M,want,t,tn)},
 /* armour: each vehicle is a lasting object that drives in, holds its lane, drives back when its orders are pulled and burns when they are traded through */
 vehZ(A,w){const c=[13,-13,25,-25,37,-37,49,-49];for(let k=0;k<c.length;k++){let z=w.sl.zc+c[(k+w.i)%c.length];if(z>33)z-=66;if(z<-33)z+=66;if(Math.abs(z-2)<4.5)z+=z<2?-5:5;if(!A.veh.some(v=>!v.dead&&Math.abs(v.gz-z)<6.5&&Math.abs(v.gx-w.sl.x)<10))return z}return clamp(w.sl.zc+rnd(28,-28),-33,33)},
 updVeh(A,M,want,t,tn){want.sort((a,b)=>b.tier-a.tier||b.usd-a.usd);if(want.length>this.VMAX)want.length=this.VMAX;const ids=new Map(want.map(w=>[w.id,w])),fwd=A.dir<0?0:Math.PI,go=[];
  for(const v of A.veh){if(v.dead||v.mv===2)continue;const w=ids.get(v.id);
   if(w){ids.delete(v.id);v.p=w.sl.p;const tx=w.sl.x+A.dir*.6;if(Math.abs(tx-v.wx)>.4){v.wx=tx;go.push(v)}}                                  // its order moved: so does the armour
   else{const traded=M.trades.some(x=>tn-x.t<3000&&Math.abs(x.p-v.p)<=M.step*.3);
    if(v.hold)v.gone=true;
    else if(traded&&PREF.layers.fx&&Math.abs(v.x)<GATE-14){v.dead=t;v.mv=0;v.ops=null;v.spd=0;FX.explode(v.x,v.z,v.tier?1.5:1.15,0xff9a3c);this.navDirty=true}
    else this.recall(A,v,go)}}                                                                                                          // pulled: back to the motor pool
  if(A.veh.some(v=>v.gone))A.veh=A.veh.filter(v=>!v.gone);
  for(const w of ids.values()){const cls=w.tier===0?0:1;if(A.veh.filter(v=>v.cls===cls).length>=this.TCAP)continue;
   const z=this.vehZ(A,w),tx=w.sl.x+A.dir*.6,p=A.pool||[A.dir*(GATE+6),gateZ(A.dir*GATE)];
   /* every vehicle rolls out of its army's motor pool inside the base, one at a time when the yard is clear */
   const v={id:w.id,key:w.key,team:A.team,p:w.sl.p,tier:w.tier,cls,x:p[0],z:p[1],hd:A.poolH!=null?A.poolH:fwd,mv:1,hold:true,pri:Math.random(),sc:w.tier===2?SC.mega:w.tier===1?SC.mbt:SC.ifv,jit:(((w.i*.37+z*.11)%1+1)%1-.5)*.16,aim:0,aimT:0,aimY:0,fire:-10,dead:0,y:0,gyT:0,wx:tx,wz:z,gx:tx,gz:z,spd:0,wait:0,pitch:0,roll:0};
   A.veh.push(v);go.push(v)}
  if(go.length){for(const v of go)if(!v.hold&&v.mv!==2)v.mv=1;this.navSync(true);for(const v of go)this.vehGo(A,v)}},
 vehGo(A,v){const fwd=A.dir<0?0:Math.PI;if(v.home){if(v.gt&&v.gt.G.users.get(v)===true)v.gt.G.users.delete(v);v.gx=A.pool[0];v.gz=A.pool[1];v.ghd=null}else{const g=this.parkSpot(v,v.wx,v.wz,fwd+v.jit);v.gx=g[0];v.gz=g[1];v.ghd=fwd+v.jit}if(!v.hold)this.planOr(v,true)},
 /* where a vehicle stops: as near its order's place as there is clear ground with room for the hull to turn on the spot, and far enough
    from every other hull (standing there, or bound for its own place) that each of them can turn where it stands too */
 parkSpot(v,x,z,hd){const B=this.VB[v.tier],r2=this.hd2(v)+this.MP+.1;x=clamp(x,-XMAX,XMAX);z=clamp(z,-34,34);if(!this.navOn)return [x,z];
  const gates=Object.values(this.sides).map(S=>S.gate).filter(Boolean),off=(px,pz)=>gates.every(g=>(px-g[0])*(px-g[0])+(pz-g[1])*(pz-g[1])>225),
   keep=(px,pz)=>Math.abs(px)<=XMAX&&Math.abs(pz)<=36&&Math.abs(pz-gateZ(px))>7&&off(px,pz),room=(px,pz)=>keep(px,pz)&&this.spread(v,px,pz);   // in the field, off the road, clear of both gates
  return NAV.free(x,z,r2,14,(px,pz)=>room(px,pz)&&!this.soldIn(px,pz,hd,B,.6))||NAV.free(x,z,r2,24,room)||
   NAV.free(x,z,B[1]+.5,24,(px,pz)=>keep(px,pz)&&NAV.hullClear(px,pz,B[0],B[1],hd,this.MP)&&!this.clash(v,px,pz,hd,.9))||[off(x,z)?x:clamp(x,16-GATE,GATE-16),z]},
 MP:.12,mp:.12,                                                                                    // what the planner keeps between a hull and anything solid (m)
 hd2(v){const B=this.VB[v.tier];return Math.hypot(B[0],B[1])},                               // half the diagonal: the circle a hull sweeps turning on the spot
 spread(v,x,z){const r=this.hd2(v),near=(o,px,pz)=>{const d=r+this.hd2(o)+.3;return (px-x)*(px-x)+(pz-z)*(pz-z)<d*d};             // held hulls are still in the shed: only where they are bound counts
  for(const k in this.sides)for(const o of this.sides[k].veh){if(o===v)continue;if(!o.hold&&near(o,o.x,o.z))return false;if(o.mv&&!o.home&&!o.dead&&o.gx!=null&&near(o,o.gx,o.gz))return false}
  for(const o of this.trucks){if(o===v||!o.on)continue;if(!o.hold&&near(o,o.x,o.z))return false;if(o.mv&&!o.home&&o.gx!=null&&near(o,o.gx,o.gz))return false}return true},
 clash(v,x,z,hd,pad){const B=this.VB[v.tier];for(const o of this.movers()){if(o===v)continue;const b=this.VB[o.tier];if(NAV.obb(x,z,hd,B[0],B[1],o.x,o.z,o.hd,b[0],b[1],pad))return true;if(o.mv&&!o.home&&o.gx!=null&&NAV.obb(x,z,hd,B[0],B[1],o.gx,o.gz,o.ghd==null?o.hd:o.ghd,b[0],b[1],pad))return true}return false},
 soldIn(x,z,hd,B,pad){for(const k in this.sides)for(const s of this.sides[k].sold){if(s.st===ST.DIE||s.mv===2||s.held)continue;const px=s.mv?s.tx:s.x,pz=s.mv?s.tz:s.z;if(NAV.inBox(px,pz,x,z,hd,B[0],B[1],pad))return true}
  if(window.GFX6&&GFX6.RB.ready)for(const k in GFX6.RB.sides){const S=GFX6.RB.sides[k];for(const o of S.bots.concat(S.dogs)){const px=o.mv?o.tx:o.x,pz=o.mv?o.tz:o.z;if(NAV.inBox(px,pz,x,z,hd,B[0],B[1],pad+.2))return true}}return false},
 sideOf(v){return v.A||this.sides[v.team]},
 /* the route: A* through ground with room for the hull's width, pulled straight, then driven as moves (straight 'L', arc 'A', turn on the
    spot 'P') and every pose of the whole hull along them checked against everything solid; a corner where the hull has no room to swing
    round is moved to where it has. With no way on from where it stands (stopped half-way through a turn in a narrow place) it backs up
    the way it came to the last place it had room to turn, and is routed on from there. Nothing changes on the vehicle unless a route is found. */
 /* route planning for a vehicle can take tens of ms on a slow machine: at most ~8 ms of it per frame (ARMY.tick resets the budget);
    a vehicle refused this frame simply retries on its next turn, as it does after any failed plan */
 vehPlan(v,extra){if((this._pu||0)>8)return false;const T0=performance.now();try{return this.vehPlan0(v,extra)}finally{this._pu=(this._pu||0)+performance.now()-T0}},
 vehPlan0(v,extra){const B=this.VB[v.tier];this.mp=!this.navOn||NAV.hullEdge(v.x,v.z,B[0],B[1],v.hd,this.MP)?this.MP:-.04;let R=this.vehFrom(v,{x:v.x,z:v.z,hd:v.hd},extra);
  if(!R&&this.navOn){const b=this.vehBack(v,extra);if(b){const R2=this.vehFrom(v,b,extra);if(R2){R=[b.o].concat(R2);v.trail.length=b.i+1}}}
  this.mp=this.MP;if(!R)return false;
  let s=0;for(const o of R){o.s0=s;s+=o.len}v.ops=R;v.oi=0;v.os=0;v.wait=0;v.blk=null;v.retry=0;v.solid=false;this.gateOf(v);return true},
 planOr(v,keep){if(this.vehPlan(v)){v.later=0;return}const t=vt();if(keep&&v.ops&&v.oi<v.ops.length&&!v.retry){v.later=t+1500;return}v.ops=[];v.oi=0;v.os=0;v.spd=0;v.later=0;v.retry=t+1500},
 vehFrom(v,st,extra){if(!this.navOn)return this.vehOps(v,st,[[st.x,st.z],[v.gx,v.gz]],null,false,true).ops;const B=this.VB[v.tier];
  for(const r of [B[1]+.45,B[1]+.3]){const W=this.vehWays(v,st.x,st.z,r,extra);if(!W)continue;const R=this.vehRoute(v,st,W,extra);if(R)return R}return null},
 /* waypoints from (x, z) to the goal: A* legs joined through the openings a route has to pass straight along their axis, the shed's
    doorway and the base's front gate. Their points carry .lock, the one line along which a repair may slide them. */
 vehWays(v,x,z,r,extra){const A=this.sideOf(v),S=A&&A.shed,B=this.VB[v.tier],turn=this.hd2(v)+this.MP+.1,D=A?A.dir:1,s0=[x,z],g=[v.gx,v.gz];
  const inBase=(px,pz)=>!!A&&D*px>GATE-.5&&Math.abs(pz)<30,inShed=(px,pz)=>!!S&&Math.abs(px-S.x)<S.hw+.5&&pz<S.door+.5&&pz>S.door-15;
  const gz=gateZ(D*GATE),I=[D*(GATE+B[0]+2.5),gz],O=[D*(GATE-B[0]-2.5),gz],E=S?[S.x,S.door+B[0]+1.5]:null;I.lock=O.lock=[1,0];if(E)E.lock=[0,1];
  const sB=inBase(x,z),gB=inBase(g[0],g[1]),sS=inShed(x,z),gS=inShed(g[0],g[1]),chain=[s0];
  if(sS&&!gS)chain.push(E);if(sB&&!gB)chain.push(I,O);else if(!sB&&gB)chain.push(O,I);if(gS&&!sS)chain.push(E);chain.push(g);
  const W=[s0];
  for(let k=1;k<chain.length;k++){const a=chain[k-1],b=chain[k];
   if(a===s0&&b===E||a===E&&b===g||a===I&&b===O||a===O&&b===I){W.push(b);continue}                               // straight through the opening
   const P=NAV.path(a[0],a[1],b[0],b[1],r,{extra,turn});if(!P)return null;for(let i=1;i<P.length-1;i++)W.push([P[i][0],P[i][1]]);W.push(b)}
  return W},
 vehBack(v,extra){const T=v.trail;if(!T||T.length<2)return null;const r2=this.hd2(v)+this.MP+.1;
  for(let i=T.length-2;i>=0;i--){const p=T[i];if(NAV.clear(p[0],p[1])<r2||extra&&extra.some(sh=>NAV.inShape(sh,p[0],p[1],r2)))continue;
   const pts=[[v.x,v.z,v.hd]];for(let j=T.length-1;j>=i;j--)pts.push(T[j]);const o={k:'T',pts,L:[0],len:0};
   for(let j=1;j<pts.length;j++){const a=pts[j-1],b=pts[j];o.len+=Math.hypot(b[0]-a[0],b[1]-a[1])+Math.abs(wrapA(b[2]-a[2]))*this.hd2(v);o.L.push(o.len)}
   if(o.len<.05||this.opRoom(v,o,Math.min(this.mp,this.MP-.08),extra)>=0)continue;return {o,x:p[0],z:p[1],hd:p[2],i}}
  return null},
 vehRoute(v,st,W,extra){const Q=[W[0]];for(let i=1;i<W.length;i++){const q=Q[Q.length-1];if(Math.hypot(W[i][0]-q[0],W[i][1]-q[1])>.2||W[i].lock)Q.push(W[i])}
  let rev=false;const tried=new Set();
  for(let it=0;it<24;it++){const r=this.vehOps(v,st,Q,extra,rev);if(r.ops)return r.ops;const f=this.vehFix(v,st,Q,r.bad,extra,tried);if(!f)return null;if(f.start)rev=f.rev}
  return null},
 /* the moves along waypoints Q, or {bad: the waypoint where the hull has no room}. rev: the first leg is driven backwards */
 vehOps(v,st,Q,extra,rev,loose){const R=[4.2,5.5,7,6][v.tier],m=this.mp,r2=this.hd2(v),ops=[],hdOf=(a,c)=>Math.atan2(-(c[1]-a[1]),c[0]-a[0]),
   room=o=>loose||this.opRoom(v,o,m,extra)<0,piv=(x,z,h0,h1)=>{const th=wrapA(h1-h0);return Math.abs(th)>.03?{k:'P',x,z,h0,th,len:Math.abs(th)*r2}:null};
  let cur=[Q[0][0],Q[0][1]],h=st.hd;
  for(let i=1;i<Q.length;i++){const p=Q[i],lin=Math.hypot(p[0]-cur[0],p[1]-cur[1]);if(lin<.05)continue;
   const hIn=hdOf(cur,p),back=rev&&i===1,hb=back?wrapA(hIn+Math.PI):hIn,t0=piv(cur[0],cur[1],h,hb);
   if(t0){if(!room(t0))return {bad:i-1};ops.push(t0)}h=hb;
   if(!back&&i<Q.length-1){const nx=Q[i+1],lo=Math.hypot(nx[0]-p[0],nx[1]-p[1]),hOut=hdOf(p,nx),th=wrapA(hOut-hIn),ath=Math.abs(th);
    if(ath>.03&&ath<2.2&&lo>.05){let r=R,tl=r*Math.tan(ath/2);const tm=Math.min(lin*.9,lo*.45);if(tl>tm){tl=tm;r=tl/Math.tan(ath/2)}
     if(r>=2.4){const a=this.arcOps(cur,p,hIn,th,r,tl);if((a.pre<.05||room(a.L))&&room(a.op)){if(a.pre>=.05)ops.push(a.L);ops.push(a.op);cur=a.end;h=hOut;continue}}}}
   const L={k:'L',ax:cur[0],az:cur[1],h:hIn,len:lin,rev:back},f=loose?-1:this.opRoom(v,L,m,extra);
   if(f>=0)return {bad:f<.5?i-1:i};
   ops.push(L);cur=[p[0],p[1]]}
  if(v.ghd!=null){const t1=piv(cur[0],cur[1],h,v.ghd);if(t1&&room(t1))ops.push(t1)}                               // no room to turn into its lane: it stays as it came in
  return {ops}},
 /* make room at waypoint i: the start (drive ahead or back along the hull first), the end (a stop nearby), or a corner (slid along either
    leg, or along its lock; then anywhere near): never twice to the same place */
 vehFix(v,st,Q,i,extra,tried){const B=this.VB[v.tier],r2=this.hd2(v)+this.MP+.1,rl=B[1]+.3,n=Q.length,
   ok=(x,z)=>NAV.clear(x,z)>=r2&&!(extra&&extra.some(sh=>NAV.inShape(sh,x,z,r2))),key=(x,z)=>i+':'+Math.round(x*2)+','+Math.round(z*2),fresh=(x,z)=>!tried.has(key(x,z));
  if(i<=0){if(tried.has('start'))return null;tried.add('start');const c=Math.cos(st.hd),s=-Math.sin(st.hd),g=Q[n-1];
   for(let d=1;d<=20;d+=.5)for(const sg of [1,-1]){const x=Q[0][0]+c*d*sg,z=Q[0][1]+s*d*sg;if(!ok(x,z))continue;
    if(this.opRoom(v,{k:'L',ax:Q[0][0],az:Q[0][1],h:sg>0?st.hd:wrapA(st.hd+Math.PI),len:d,rev:sg<0},this.mp,extra)>=0)continue;
    const W=this.vehWays(v,x,z,rl,extra);if(!W)continue;const s0=Q[0];Q.length=0;W[0].lock=[c,s];Q.push(s0);for(const w of W)Q.push(w);return {start:true,rev:sg<0}}   // the first corner stays on the hull's axis
   return null}
  if(i>=n-1){if(Q[n-1].lock||v.home)return null;const a=Q[n-2],q=NAV.free(Q[n-1][0],Q[n-1][1],r2,12,(x,z)=>fresh(x,z)&&NAV.lineClear(a[0],a[1],x,z,rl)&&this.spread(v,x,z));
   if(!q)return null;tried.add(key(q[0],q[1]));Q[n-1]=q;v.gx=q[0];v.gz=q[1];return {}}
  const a=Q[i-1],p=Q[i],b=Q[i+1],li=Math.hypot(p[0]-a[0],p[1]-a[1])||1,lo=Math.hypot(b[0]-p[0],b[1]-p[1])||1,ui=[(p[0]-a[0])/li,(p[1]-a[1])/li],uo=[(b[0]-p[0])/lo,(b[1]-p[1])/lo],
   D=p.lock?[[p.lock,99,-1],[p.lock,99,1]]:[[ui,li,-1],[uo,99,-1],[ui,99,1],[uo,lo,1]],put=(x,z)=>{const q=[x,z];if(p.lock)q.lock=p.lock;tried.add(key(x,z));Q[i]=q;return {}};
  for(let d=.5;d<=16;d+=.5)for(const [u,lim,sg] of D){if(d>lim-.3)continue;const x=p[0]+u[0]*d*sg,z=p[1]+u[1]*d*sg;if(!fresh(x,z)||!ok(x,z))continue;
   if(!NAV.lineClear(a[0],a[1],x,z,rl)||!NAV.lineClear(x,z,b[0],b[1],rl))continue;return put(x,z)}
  if(p.lock)return null;
  const q=NAV.free(p[0],p[1],r2,16,(x,z)=>fresh(x,z)&&NAV.lineClear(a[0],a[1],x,z,rl)&&NAV.lineClear(x,z,b[0],b[1],rl));if(q)return put(q[0],q[1]);
  return null},
 /* a turn of radius r round the corner at p: the straight up to it, the arc, and where the arc ends */
 arcOps(a,p,h,th,r,tl){const sg=Math.sign(th),c=Math.cos(h),s=-Math.sin(h),t1=[p[0]-c*tl,p[1]-s*tl],cx=t1[0]-sg*r*Math.sin(h),cz=t1[1]-sg*r*Math.cos(h),h1=h+th;
  return {pre:Math.hypot(t1[0]-a[0],t1[1]-a[1]),L:{k:'L',ax:a[0],az:a[1],h,len:Math.hypot(t1[0]-a[0],t1[1]-a[1])},op:{k:'A',cx,cz,r,sg,h0:h,th,len:r*Math.abs(th)},end:[cx+sg*r*Math.sin(h1),cz+sg*r*Math.cos(h1)]}},
 opPos(o,os,out){if(o.k==='T'){const L=o.L,s=clamp(os,0,o.len);let j=1;while(j<L.length-1&&L[j]<s)j++;const a=o.pts[j-1],b=o.pts[j],f=clamp((s-L[j-1])/((L[j]-L[j-1])||1),0,1);out[0]=a[0]+(b[0]-a[0])*f;out[1]=a[1]+(b[1]-a[1])*f;out[2]=a[2]+wrapA(b[2]-a[2])*f;return out}
  const f=o.len>0?clamp(os/o.len,0,1):1;
  if(o.k==='L'){const c=Math.cos(o.h),s=-Math.sin(o.h),d=f*o.len;out[0]=o.ax+c*d;out[1]=o.az+s*d;out[2]=o.rev?wrapA(o.h+Math.PI):o.h}
  else if(o.k==='A'){const e=o.h0+o.th*f;out[0]=o.cx+o.sg*o.r*Math.sin(e);out[1]=o.cz+o.sg*o.r*Math.cos(e);out[2]=e}
  else{out[0]=o.x;out[1]=o.z;out[2]=o.h0+o.th*f}return out},
 /* the whole hull has room (margin m) at every pose of a move, a quarter metre apart (for a turn on the spot: a quarter metre at its
    corners); -1, or how far along the first pose without room is */
 opRoom(v,o,m,extra,from){const B=this.VB[v.tier],q=this.P5||(this.P5=[0,0,0]),s0=from||0,n=Math.max(1,Math.ceil((o.len-s0)/.25));
  for(let i=0;i<=n;i++){const s=s0+(o.len-s0)*i/n;this.opPos(o,s,q);if(!NAV.hullEdge(q[0],q[1],B[0],B[1],q[2],m,extra))return o.len>0?s/o.len:0}return -1},
 ahead(v,ds,out){const ops=v.ops;let i=v.oi,s=v.os+ds;while(i<ops.length-1&&s>ops[i].len){s-=ops[i].len;i++}const o=ops[Math.min(i,ops.length-1)];return this.opPos(o,Math.min(s,o.len),out)},
 /* the gate in a base's wall takes one way of traffic at a time: hulls going out leave the motor pool only while nothing is coming in,
    and hulls coming home wait short of the base while anything is going out */
 gateQ(A){return A&&A.gate?(A.gq||(A.gq={x:A.gate[0],z:A.gate[1],users:new Map()})):null},
 gateCan(G,out){for(const o of G.users.values())if(o!==out)return false;return true},
 gateOf(v){const G=this.gateQ(this.sideOf(v));v.gt=null;if(!G)return;const r=7+this.VB[v.tier][0],q=this.P7||(this.P7=[0,0,0]);let s0=-1,s1=-1;
  let sides=0;for(const o of v.ops){const n=Math.max(1,Math.ceil(o.len/.5));for(let k=0;k<=n;k++){this.opPos(o,o.len*k/n,q);if((q[0]-G.x)*(q[0]-G.x)+(q[1]-G.z)*(q[1]-G.z)<r*r){const s=o.s0+o.len*k/n;if(s0<0)s0=s;s1=s;sides|=q[0]<G.x?1:2}}}
  if(sides!==3)s0=-1;                                                                                                   // only a route through the gate needs it
  const S=this.sideOf(v).shed;v.dk=null;if(S){const B=this.VB[v.tier];let a=-1,b=-1;for(const o of v.ops){const n=Math.max(1,Math.ceil(o.len/.4));for(let k=0;k<=n;k++){this.opPos(o,o.len*k/n,q);if(NAV.obb(q[0],q[1],q[2],B[0]+.6,B[1]+.6,S.x,S.door,0,S.hw,.3,0)){const s=o.s0+o.len*k/n;if(a<0)a=s;b=s}}}if(a>=0)v.dk=[a,b]}
  if(s0<0){if(G.users.get(v)===true)G.users.delete(v);return}v.gt={G,s0,s1}},
 gateFree(v){const G=this.gateQ(this.sideOf(v));if(G)G.users.delete(v)},
 gateTick(){for(const k in this.sides){const A=this.sides[k],G=A.gq,gone=u=>u.dead||u.done||(u.tier===3?!u.on:!A.veh.includes(u));if(G&&G.users.size)for(const u of [...G.users.keys()])if(u.hold||gone(u))G.users.delete(u);
   const S=A.shed;if(!S)continue;if(S.user&&(gone(S.user)||S.user.hold))S.user=null;const u=S.user;let want=false;
   if(u&&!u.inShed&&u.dk){const s=u.ops&&u.oi<u.ops.length?u.ops[u.oi].s0+u.os:-1;want=s>=u.dk[0]-16&&s<=u.dk[1]+.2}                   // the shed's door is up while its one hull is in the doorway or coming to it
   S.open=clamp(S.open+(want?1:-1)*(vt()-(S.t||vt()))/1300,0,1);S.t=vt();if(u&&u.inShed&&S.open<=0){u.done=true;S.user=null}}},
 /* out of the motor pool: when no hull is near enough to be in the way of its first turn, nothing is coming in through the gate, and it has a way */
 release(v,t){if(t<(v.relT||0))return false;v.relT=t+350;const A=this.sideOf(v),G=this.gateQ(A),S=A&&A.shed;if(S&&S.user&&S.user!==v||!this.spread(v,v.x,v.z)||G&&!this.gateCan(G,true))return false;
  if(S&&this.movers().some(o=>o!==v&&o.home&&!o.dead&&this.sideOf(o)===A&&(o.x-S.x)*(o.x-S.x)+(o.z-S.door)*(o.z-S.door)<1600))return false;
  if(!this.vehPlan(v)){v.relT=t+1500;return false}v.hold=false;v.inShed=false;if(G&&v.gt)G.users.set(v,true);if(S)S.user=v;return true},
 /* an order pulled: a hull still in the shed stays in it (the door comes down), one on its way out of the base drives on out of the gate
    first (nothing turns round inside the base), the rest drive home */
 recall(A,v,go){v.mv=2;v.home=true;const S=A.shed,s=v.ops&&v.oi<v.ops.length?v.ops[v.oi].s0+v.os:0;
  if(S&&S.user===v&&v.dk&&s<v.dk[0]){v.inShed=true;v.ops=null;v.spd=0;return}
  if(v.gt&&v.gt.G.users.get(v)===true){v.recall=true;return}
  go.push(v)},
 /* one step along the route: turn on the spot or drive (gathering speed, braking for the end and for a gate it has to wait at), never into
    another hull, a soldier, a machine or anything solid */
 vehFollow(v,dt,t){const ops=v.ops;
  if(v.stand){v.spd=0;const G=this.gateQ(this.sideOf(v));if(t>(v.bayT||0)&&(!G||this.gateCan(G,false))){v.bayT=t+1200;v.stand=false;this.navSync(true);v.bay=false;if(G)G.users.set(v,false);this.vehGo(this.sideOf(v),v);if(!v.ops||!v.ops.length){v.stand=true;v.bay=true;if(G)G.users.delete(v)}}return}
  if(!ops||v.oi>=ops.length){if(v.resumeT){v.spd=0;if(t<v.resumeT)return;v.resumeT=0;if(!this.vehPlan(v)){v.ops=[];v.retry=t+1500}return}
   if(v.retry){if(v.recall){v.recall=false;v.retry=0;this.vehGo(this.sideOf(v),v);return}if(t>=v.retry&&!this.vehPlan(v)){v.retry=t+1500;v.fails=(v.fails||0)+1;if(!v.home&&v.fails%2===0&&v.wx!=null){const g=this.parkSpot(v,v.wx,v.wz,v.ghd!=null?v.ghd:v.hd);v.gx=g[0];v.gz=g[1]}}v.spd=0;return}this.vehArrive(v);return}
  if(v.later&&t>=v.later){v.later=0;if(this.vehPlan(v))return;v.later=t+1500}
  const op=ops[v.oi],q=this.P4||(this.P4=[0,0,0]),gt=v.gt;
  if(op.k==='P'){
   if(this.vehBlocked(v,0,t)){v.spd=0;v.wait+=dt;if(v.wait>(v.solid?.8:2.6))this.vehReplan(v,t);return}
   v.wait=0;v.spd=0;v.os=Math.min(op.len,v.os+[1.15,.95,.75,1.0][v.tier]*this.hd2(v)*dt);this.opPos(op,v.os,q);v.x=q[0];v.z=q[1];v.hd=q[2];this.trailAdd(v);
   if(v.os>=op.len-1e-6){v.oi++;v.os=0;if(v.oi>=ops.length)this.vehArrive(v)}return}
  let lim=1e9;const s=op.s0+v.os;
  if(gt&&!gt.G.users.has(v)&&s<gt.s1){const out=!v.home,w=gt.s0-(out?1:14);if(this.gateCan(gt.G,out)){if(s>=w-8)gt.G.users.set(v,out)}
   else if(!out&&!v.bay&&s<gt.s0-1&&t>(v.bayT||0)&&this.toBay(v,t))return;else lim=w-s}
  const S=v.dk&&this.sideOf(v).shed;if(S&&s<v.dk[1]){if(S.user!==v){const w=v.dk[0]-18;if(!S.user&&s>=w-10)S.user=v;else if(S.user)lim=Math.min(lim,w-s)}if(S.user===v&&S.open<.98)lim=Math.min(lim,v.dk[0]-.3-s)}
  if(lim<=.05){v.spd=0;return}
  const back=o=>!!(o.rev||o.k==='T');let rest=op.len-v.os;for(let j=v.oi+1;j<ops.length&&ops[j].k!=='P'&&back(ops[j])===back(op);j++)rest+=ops[j].len;if(lim<rest)rest=lim;   // brakes for a turn on the spot, a change of direction and the end
  const vmax=op.rev||op.k==='T'?3:v.tier===3?(v.home?11:13):(v.mv===2?8.5:7),acc=v.tier===3?4.5:3.2,sp=Math.min(vmax,Math.sqrt(2*acc*Math.max(0,rest))+.4,v.spd+acc*dt);
  if(this.vehBlocked(v,sp,t)){v.spd=0;v.wait+=dt;if(v.wait>(v.solid?.8:2.6))this.vehReplan(v,t);return}
  v.wait=0;v.spd=sp;v.os+=Math.min(sp*dt,lim);
  while(v.oi<ops.length&&ops[v.oi].k!=='P'&&v.os>=ops[v.oi].len){v.os-=ops[v.oi].len;v.oi++}
  if(v.oi<ops.length&&ops[v.oi].k==='P')v.os=0;
  if(v.oi<ops.length)this.opPos(ops[v.oi],v.os,q);else this.opPos(ops[ops.length-1],ops[ops.length-1].len,q);v.x=q[0];v.z=q[1];v.hd=q[2];if(op.k!=='T')this.trailAdd(v);
  const s2=v.oi<ops.length?ops[v.oi].s0+v.os:1e9;
  if(S&&S.user===v&&!v.home&&s2>v.dk[1])S.user=null;                                                                   // out of the doorway: the next one may come
  if(gt&&gt.G.users.get(v)===true&&s2>gt.s1){gt.G.users.delete(v);if(v.recall){v.recall=false;this.vehGo(this.sideOf(v),v);return}}
  if(v.oi>=ops.length)this.vehArrive(v)},
 trailAdd(v){const T=v.trail||(v.trail=[]),l=T[T.length-1];if(!l||Math.abs(v.x-l[0])+Math.abs(v.z-l[1])>.5||Math.abs(wrapA(v.hd-l[2]))>.2){T.push([v.x,v.z,v.hd]);if(T.length>70)T.shift()}},
 /* the holding bay: a stop off the road some way in front of the base, where a hull coming home waits while the gate is busy */
 toBay(v,t){const A=this.sideOf(v),D=A.dir,x=D*(GATE-26);v.bayT=t+1500;
  for(const sg of v.z<gateZ(x)?[-1,1]:[1,-1]){const z=gateZ(x)+sg*14,p=this.parkSpot(v,x,z,v.hd);if(Math.abs(p[0]-x)>16||Math.abs(p[1]-gateZ(p[0]))<7)continue;
   v.bay=true;v.gx=p[0];v.gz=p[1];if(this.vehPlan(v))return true;v.bay=false;v.gx=A.pool[0];v.gz=A.pool[1]}return false},
 vehArrive(v){v.spd=0;v.ops=null;v.retry=0;v.la1=v.la2=null;if(v.bay){v.stand=true;v.ops=[];this.navDirty=true;return}{const A=this.sideOf(v);if(!v.home&&A&&A.dir*v.x>GATE-1&&Math.hypot(v.x-v.gx,v.z-v.gz)>3){v.ops=[];v.retry=vt()+600;return}}if(v.recall){v.recall=false;this.vehGo(this.sideOf(v),v);return}if(v.later){v.later=0;if(!this.vehPlan(v)){v.ops=[];v.retry=vt()+1500}return}if(v.home){const S=this.sideOf(v).shed;if(S&&S.user===v){v.inShed=true;return}v.done=true;this.gateFree(v);return}if(v.gt&&v.gt.G.users.get(v)===true)v.gt.G.users.delete(v);v.mv=0;v.gx=v.x;v.gz=v.z;this.navDirty=true},
 /* the ground the hull covers in the next moment (turning on the spot: the next few degrees of the turn): another hull there stops it
    (unless the two already touch and it is drawing off), a soldier or a machine there stops it and is asked to step aside, and so does
    anything solid built across the route since it was planned */
 vehBlocked(v,sp,t){const B=this.VB[v.tier],op=v.ops[v.oi],piv=op.k==='P',la=1.2+sp*.9,P1=this.ahead(v,piv?Math.min(.9,op.len-v.os):la*.5,this.Pa||(this.Pa=[0,0,0])),P2=piv?P1:this.ahead(v,la,this.Pb||(this.Pb=[0,0,0]));let hit=false;v.blk=null;v.solid=false;
  const L1=v.la1||(v.la1=[0,0,0]),L2=v.la2||(v.la2=[0,0,0]);L1[0]=P1[0];L1[1]=P1[1];L1[2]=P1[2];L2[0]=P2[0];L2[1]=P2[1];L2[2]=P2[2];v.laT=t;   // where it is about to be
  for(const o of this.movers()){if(o===v||Math.abs(o.x-v.x)>24||Math.abs(o.z-v.z)>24)continue;const b=this.VB[o.tier];
   if(!NAV.obb(P1[0],P1[1],P1[2],B[0],B[1],o.x,o.z,o.hd,b[0],b[1],.25)&&!NAV.obb(P2[0],P2[1],P2[2],B[0],B[1],o.x,o.z,o.hd,b[0],b[1],.25))continue;
   if(NAV.obb(v.x,v.z,v.hd,B[0],B[1],o.x,o.z,o.hd,b[0],b[1],.02)&&Math.hypot(P2[0]-o.x,P2[1]-o.z)>Math.hypot(v.x-o.x,v.z-o.z)+.01)continue;
   v.blk=o;return true}
  for(const k in this.sides)for(const so of this.sides[k].sold){if(so.st===ST.DIE||so.held||Math.abs(so.x-v.x)>16||Math.abs(so.z-v.z)>16)continue;
   if(NAV.inBox(so.x,so.z,P1[0],P1[1],P1[2],B[0],B[1],.45)||NAV.inBox(so.x,so.z,P2[0],P2[1],P2[2],B[0],B[1],.45)){hit=true;if(!(so.dodge>t)&&(!so.mv||v.wait>1.5||t-(so.frzT||-1e9)<400))this.dodge(so,v,t)}}
  if(window.GFX6&&GFX6.RB.ready)for(const k in GFX6.RB.sides){const S=GFX6.RB.sides[k];for(const o of S.bots.concat(S.dogs)){if(Math.abs(o.x-v.x)>16||Math.abs(o.z-v.z)>16)continue;
   if(NAV.inBox(o.x,o.z,P1[0],P1[1],P1[2],B[0],B[1],.6)||NAV.inBox(o.x,o.z,P2[0],P2[1],P2[2],B[0],B[1],.6)){hit=true;if(!(o.dodge>t)&&(!o.mv||v.wait>1.5||t-(o.frzT||-1e9)<400))GFX6.dodge(o,v,t)}}}
  if(!hit&&this.navOn&&!NAV.hullEdge(P1[0],P1[1],B[0],B[1],P1[2],-.05)&&NAV.hullEdge(v.x,v.z,B[0],B[1],v.hd,-.05)){v.solid=true;return true}
  return hit},
 /* stuck behind something for a while: a way round it (the one of two hulls nose to nose that gives way finds it), or wait on */
 vehReplan(v,t){const o=v.blk;v.wait=0;if(o&&o.mv&&o.blk===v&&o.pri>v.pri)return;const extra=[];if(o){const b=this.VB[o.tier];extra.push(NAV.box(o.x,o.z,b[0]+.4,b[1]+.4,o.hd,'veh'))}
  if(this.vehPlan(v,extra)||!o||!o.mv)return;const T=v.trail;if(!T||T.length<3)return;
  const pts=[[v.x,v.z,v.hd]];let d=0;for(let j=T.length-1;j>=0&&d<7;j--){const a=pts[pts.length-1],b=T[j];d+=Math.hypot(b[0]-a[0],b[1]-a[1]);pts.push(b)}
  const y={k:'T',pts,L:[0],len:0};for(let j=1;j<pts.length;j++){const a=pts[j-1],b=pts[j];y.len+=Math.hypot(b[0]-a[0],b[1]-a[1])+Math.abs(wrapA(b[2]-a[2]))*this.hd2(v);y.L.push(y.len)}
  if(y.len<1||this.opRoom(v,y,this.MP-.08)>=0)return;y.s0=0;v.ops=[y];v.oi=0;v.os=0;v.trail.length=Math.max(1,T.length-pts.length+1);v.resumeT=t+2400+Math.random()*1200},
 /* the rest of a route still has room for the hull, checked when the ground changed (only near what was added to it) */
 opsClear(v){const add=this.navAdd;if(!add||!add.length||!v.ops)return true;const r=this.hd2(v)+1,q=this.P7||(this.P7=[0,0,0]);let near=false;
  for(let i=v.oi;i<v.ops.length&&!near;i++){const o=v.ops[i],n=Math.max(1,Math.ceil(o.len/2));for(let k=0;k<=n&&!near;k++){this.opPos(o,o.len*k/n,q);for(const b of add)if(q[0]>b[0]-r&&q[0]<b[2]+r&&q[1]>b[1]-r&&q[1]<b[3]+r){near=true;break}}}
  if(!near)return true;for(let i=v.oi;i<v.ops.length;i++)if(this.opRoom(v,v.ops[i],this.MP-.06,null,i===v.oi?Math.min(v.os,v.ops[i].len):0)>=0)return false;return true},
 /* hulls ride the ground: pitch and roll from the terrain under their four ends */
 align(v){const B=this.VB[v.tier],c=Math.cos(v.hd),s=-Math.sin(v.hd),ex=B[0]*.8,ez=B[1]*.8;
  const hf=this.gy(v.x+c*ex,v.z+s*ex),hb=this.gy(v.x-c*ex,v.z-s*ex),hr=this.gy(v.x-s*ez,v.z+c*ez),hl=this.gy(v.x+s*ez,v.z-c*ez),h0=this.gy(v.x,v.z);
  v.y=Math.max((hf+hb+hr+hl)/4,h0-.05);v.pitch=Math.atan2(hf-hb,2*ex);v.roll=Math.atan2(hl-hr,2*ez)},
 vehTick(A,dt,t){const d=this.vd||(this.vd=new THREE.Object3D()),fx=VIEW.round?X(VIEW.price||VIEW.round.p0):0,fwd=A.dir<0?0:Math.PI,n=[0,0],q=this.vq||(this.vq=new THREE.Quaternion()),qa=this.vqa||(this.vqa=new THREE.Quaternion()),UP=this.vup||(this.vup=new THREE.Vector3(0,1,0));let ns=0;d.rotation.order='YZX';
  for(let i=A.veh.length-1;i>=0;i--){const v=A.veh[i];
   if(v.hold&&!this.release(v,t))continue;                                                  // still in the shed: waits for the yard to clear
   if(v.done){A.veh.splice(i,1);continue}
   if(v.mv&&!v.dead&&!v.inShed){this.vehFollow(v,dt,t);if(v.done){A.veh.splice(i,1);continue}if(v.spd>.6&&PREF.layers.fx&&Math.random()<.22*FX.K){const B=this.VB[v.tier];FX.dustPuff(v.x-Math.cos(v.hd)*B[0],v.z+Math.sin(v.hd)*B[0],1)}}
   if(v.dead){const el=t-v.dead;if(el>26000){A.veh.splice(i,1);this.navDirty=true;continue}if(PREF.layers.fx&&el<18000&&Math.random()<.09*FX.K)FX.smoke(v.x,v.y+1.7*v.sc,v.z,1,3.4)}
   if(v.mv||!(v.gyT>t)){this.align(v);v.gyT=t+2500}
   const k=n[v.cls]++,S2=A.tk[v.cls],sink=v.dead?Math.max(0,(t-v.dead-20000)/6000)*2.4*v.sc:0;
   d.position.set(v.x,v.y-sink,v.z);d.rotation.set(v.roll,v.hd,v.pitch+(v.dead?.07:0));d.scale.setScalar(v.sc);d.updateMatrix();S2.hull.setMatrixAt(k,d.matrix);
   if(!v.dead){const want=t<v.aimT?wrapA(v.aimY-v.hd):wrapA(fwd-v.hd)+clamp(Math.atan2(-(v.z*.08),Math.max(4,Math.abs(fx-v.x))),-.35,.35)*(A.dir<0?1:-1);v.aim+=wrapA(want-v.aim)*Math.min(1,dt*5)}
   q.setFromEuler(d.rotation);qa.setFromAxisAngle(UP,v.aim);q.multiply(qa);d.quaternion.copy(q);d.updateMatrix();S2.tur.setMatrixAt(k,d.matrix);
   const cc=v.dead?.13:v.tier===2?.62:1;this.tmpC.setRGB(cc,cc,cc);S2.hull.setColorAt(k,this.tmpC);S2.tur.setColorAt(k,this.tmpC);S2.fire.setX(k,v.fire);
   if(A.vsh&&!sink){d.position.set(v.x,v.y+.07,v.z);d.rotation.set(0,v.hd,0);d.scale.set(8.4*v.sc,1,5*v.sc);d.updateMatrix();A.vsh.setMatrixAt(ns++,d.matrix)}}
  A.tk.forEach((S2,c)=>{S2.hull.count=S2.tur.count=n[c];S2.hull.instanceMatrix.needsUpdate=S2.tur.instanceMatrix.needsUpdate=true;S2.hull.instanceColor.needsUpdate=S2.tur.instanceColor.needsUpdate=true;S2.fire.needsUpdate=true});
  if(A.vsh){A.vsh.count=ns;A.vsh.instanceMatrix.needsUpdate=true}},
 /* the dynamic part of the ground: field works, and every hull standing still (parked, unloading or burning) */
 navSync(force){if(!this.navOn)return;const t=vt(),L=this.works.slice();for(const o of this.movers())if(!o.mv||o.dead||o.stand){const b=this.VB[o.tier];L.push(NAV.box(o.x,o.z,b[0]+.1,b[1]+.1,o.hd,'veh'))}
  const keys=L.map(sh=>sh.t+Math.round((sh.x!=null?sh.x:sh.ax)*4)+','+Math.round((sh.z!=null?sh.z:sh.az)*4)+','+Math.round((sh.hx||sh.r||0)*4)+','+Math.round((sh.rot||0)*20)),sig=keys.join(';');
  if(sig===this.navSig){this.navDirty=false;return}if(!force&&t-this.navT<450)return;
  const was=this.navKeys||new Set();this.navAdd=[];keys.forEach((k,i)=>{if(!was.has(k))this.navAdd.push(NAV.bounds(L[i]))});this.navKeys=new Set(keys);
  this.navSig=sig;this.navDirty=false;this.navT=t;NAV.setDynamic(L);NAV.rebuild();this.navCheck(t)},
 /* after the ground changed: soldiers standing in something step out of it; anyone whose way ahead was built on finds another */
 navCheck(t){for(const k in this.sides){const A=this.sides[k];for(const s of A.sold){if(s.st===ST.DIE)continue;   /* men still waiting at the gate are re-checked too: their route was drawn before the wall went up */
    if(!s.mv&&!s.held){if(NAV.clear(s.x,s.z)<.3){const p=NAV.free(s.x,s.z,.5,6,(x,z)=>!this.taken(x,z,s));if(p){s.mv=1;s.st=ST.WALK;s.sp=4;s.t0=t;this.route(A,s,p,t)}}}
    else if(s.pl){const P=s.pl,w=.28+Math.abs(s.cv||0);let ok=true;for(let i=1;i<P.length&&ok;i++)ok=NAV.lineClear(P[i-1][0],P[i-1][1],P[i][0],P[i][1],w);if(!ok&&!s.rq){s.rq=1;(this.rq||(this.rq=[])).push([A,s])}}}   /* re-routed a few per frame (ARMY.tick), so a new wall never freezes the page */
   for(const v of A.veh)if(v.mv&&v.ops&&v.ops.length&&!v.hold&&!v.dead&&!this.opsClear(v))this.planOr(v)}
  for(const tr of this.trucks)if(tr.on&&tr.mv&&tr.ops&&tr.ops.length&&!tr.hold&&!this.opsClear(tr))this.planOr(tr);
  if(window.GFX6&&GFX6.navCheck)GFX6.navCheck(t)},
 gy(x,z){return WORLD.terrain?WORLD.meshH(x,z):WORLD.hgt?WORLD.hgt(x,z):0},
 settle(x,z,r){const near=o=>Math.abs(o.x-x)<r&&Math.abs(o.z-z)<r;for(const k in this.sides){const A=this.sides[k];for(const s of A.sold)if(near(s))s.gyT=0;for(const v of A.veh)if(near(v))v.gyT=0}for(const tr of this.trucks)if(tr.on&&near(tr))tr.gyT=0;
  if(window.GFX6&&GFX6.RB.sides)for(const k in GFX6.RB.sides){const S=GFX6.RB.sides[k];for(const o of S.bots.concat(S.dogs))if(near(o))o.gyT=0}},
 remove(A,s){const last=A.sold.pop();if(last!==s){A.sold[s.i]=last;last.i=s.i}},
 tick(dt){this._pu=0;this.gateTick();
  if(this.rq&&this.rq.length){const t0=vt();for(let n=0,b0=performance.now();this.rq.length&&(n<1||performance.now()-b0<4);n++){const [A,s]=this.rq.shift();s.rq=0;if(s.st===ST.DIE||(!s.mv&&Math.hypot(s.x-s.tx,s.z-s.tz)<.4))continue;if(!s.mv){s.mv=1;s.st=ST.RUN;s.sp=s.sp||10.5}this.route(A,s,[s.tx,s.tz],t0,null   /* each man's own short search, a few per frame, instead of one whole-map sweep that froze slow machines for up to 1/4 s */)}}
  const t=vt(),m4=this.m4,q4=this.q4,pos=this.v3a,scl=this.v3b,Q=this.Q,BT=this.boneTex.image.data;
  for(const k in this.sides){const A=this.sides[k],base=A.dir<0?0:Math.PI,cnt=[0,0,0,0];
   for(let i=A.sold.length-1;i>=0;i--){const s=A.sold[i];
    if(s.mv){if(t<s.t0)continue;if(s.held)s.held=false;const f=clamp((t-s.t0)/1000/s.dur,0,1),e=f<.5?2*f*f:1-Math.pow(-2*f+2,2)/2;
     if(s.pl){const P3=this.P3||(this.P3=[0,0,0]);this.along(s,e,P3);const nx=P3[0],nz=P3[1]+Math.sin(e*Math.PI)*(s.cv||0);
      /* never into a vehicle: if the next step would be inside one, wait for it to pass */
      const mo=this.navOn&&f<1?this.inWay(nx,nz,.35):null;if(mo&&!this.inWay(s.x,s.z,.35)){s.t0+=dt*1000;s.frz=(s.frz||0)+dt;s.frzT=t;if(s.frz>.9){s.frz=0;const b=this.VB[mo.tier],op=mo.ops&&mo.ops[mo.oi],ex=[op&&op.k==='P'?NAV.circle(mo.x,mo.z,this.hd2(mo)+.8,'veh'):NAV.box(mo.x,mo.z,b[0]+.8,b[1]+.8,mo.hd,'veh')];if(mo.la2&&t-(mo.laT||-1e9)<300)ex.push(NAV.capsule(mo.x,mo.z,mo.la2[0],mo.la2[1],b[1]+.8,'veh'));const P=NAV.path(s.x,s.z,s.tx,s.tz,.45,{extra:ex});if(P)this.setPath(s,P,t)}continue}s.frz=0;s.x=nx;s.z=nz;s.hdg=P3[2]}else{s.x=s.x0+(s.tx-s.x0)*e;s.z=s.z0+(s.tz-s.z0)*e}s.gyT=0;
     if(f>=1){if(s.mv===2){this.remove(A,s);continue}else{s.mv=0;s.pl=null;s.st=this.rest?ST.REST:ST.IDLE;s.t0=t}}}
    else if(s.after&&t>s.dodge&&s.st!==ST.DIE){const a=s.after;s.after=null;if(a.mv===2)this.retreat(A,s,t);else{s.mv=1;s.st=a.st;s.sp=a.sp;s.t0=t;this.route(A,s,[a.tx,a.tz],t)}}
    else if(s.st===ST.DIE){if(t-s.t0>7000){this.remove(A,s);continue}}
    else if(s.st===ST.FIRE){if(t-(s.shot||s.t0)>650){s.st=this.rest?ST.REST:ST.IDLE;s.t0=t}}
    else if(s.st===ST.STAG){if(t-s.t0>1700){s.st=this.rest?ST.REST:ST.IDLE;s.t0=t}}
    else if(s.st===ST.CHEER){if(t-s.t0>(s.cheer||4200)){s.st=this.rest?ST.REST:ST.IDLE;s.t0=t}}}
   const n=A.sold.length;
   for(let i=0;i<n;i++){const s=A.sold[i];
    if(s.held){if(A.sh){scl.set(0,0,0);pos.set(0,-50,0);q4.set(0,0,0,1);m4.compose(pos,q4,scl);m4.toArray(A.sh.instanceMatrix.array,i*16)}continue}   // still inside, waiting for his turn at the door
    if(!(s.gyT>t)){s.y=this.gy(s.x,s.z);s.gyT=t+1500+s.sd*1500}
    let ty=base+s.yaw;if(s.mv){if(s.cv&&s.pl){const f=clamp((t-s.t0)/1000/s.dur,0,1),e=f<.5?2*f*f:1-Math.pow(-2*f+2,2)/2,P=s.pl,dx=P[1][0]-P[0][0],dz=P[1][1]-P[0][1]+Math.PI*Math.cos(e*Math.PI)*s.cv;ty=Math.atan2(-dz,dx)}else if(s.hdg!=null)ty=s.hdg;else{const dx=s.tx-s.x0,dz=s.tz-s.z0;if(Math.abs(dx)+Math.abs(dz)>.05)ty=Math.atan2(-dz,dx)}}else if(t<s.aimT&&s.st!==ST.DIE)ty=s.aimY;
    if(s.st!==ST.DIE)s.ry+=wrapA(ty-s.ry)*Math.min(1,dt*(s.mv?9:12));
    const sc=SC.sold*(s.rank===2?1.04:1)*(.96+s.sd*.08);pos.set(s.x,s.y,s.z);q4.set(0,Math.sin(s.ry/2),0,Math.cos(s.ry/2));scl.set(sc,sc,sc);m4.compose(pos,q4,scl);const M=A.meshes[s.role],c=cnt[s.role]++;m4.toArray(M.instanceMatrix.array,c*16);M.geometry.attributes.aRow.array[c]=A.row0+i;
    GFX5.pose(s,t,dt,Q,0);GFX5.bones(Q,0,s.role,BT,A.row0+i);
    if(A.sh){const lie=s.stn===3&&!s.mv&&s.st!==ST.RUN?1:s.st===ST.DIE?clamp((t-s.t0)/900,0,1):0,fade=s.st===ST.DIE?clamp(1-(t-s.t0-3500)/2500,0,1):1;pos.y=s.y+.06;scl.set(sc*(1.25+lie*1.5)*fade,1,sc*1.25*fade);m4.compose(pos,q4,scl);m4.toArray(A.sh.instanceMatrix.array,i*16)}}
   A.meshes.forEach((M,r)=>{M.count=cnt[r];M.instanceMatrix.needsUpdate=true;M.geometry.attributes.aRow.needsUpdate=true});if(A.sh){A.sh.count=n;A.sh.instanceMatrix.needsUpdate=true}
   this.vehTick(A,dt,t)}
  this.boneTex.needsUpdate=true;this.trucksTick(dt)},
 near(A,x,z,r){const o=[];for(const s of A.sold){if(s.st===ST.DIE||s.mv)continue;const dx=s.x-x,dz=s.z-z;if(dx*dx+dz*dz<r*r)o.push(s)}return o},
 /* who can shoot: the soldiers nearest the front (refreshed a few times a second) */
 frontOf(A){const t=now();if(t-A.frontT>500){A.frontT=t;const fx=VIEW.round?X(VIEW.price||VIEW.round.p0):0;A.front=A.sold.filter(s=>s.st!==ST.DIE&&!s.mv).sort((a,b)=>Math.abs(a.x-fx)-Math.abs(b.x-fx)).slice(0,30)}return A.front},
 pick(side,role){const f=this.frontOf(this.sides[side]).filter(s=>s.st!==ST.DIE&&!s.mv&&(role==null||s.role===role));return f.length?f[Math.floor(Math.random()*Math.random()*f.length)]:null},
 pickVeh(side,heavy){const A=this.sides[side],fx=VIEW.round?X(VIEW.price||VIEW.round.p0):0,l=A.veh.filter(v=>!v.dead&&!v.hold&&v.mv!==2&&(heavy?v.tier>0:v.tier===0));if(!l.length)return null;l.sort((a,b)=>Math.abs(a.x-fx)-Math.abs(b.x-fx));return l[Math.floor(Math.random()*Math.min(3,l.length))]},
 /* one soldier fires at a point: he turns, shoulders the weapon, the muzzle flashes; returns the muzzle position */
 shoot(side,s,tx,tz){const A=this.sides[side],t=vt();if(s.st!==ST.FIRE){s.st=ST.FIRE;s.t0=t}s.shot=t;s.aimY=Math.atan2(-(tz-s.z),tx-s.x);s.aimT=t+1500;
  const m=GFX5.muzzle(s),sc=SC.sold*(.96+s.sd*.08),a=s.aimY,mx=s.x+Math.cos(a)*m[0]*sc,mz=s.z-Math.sin(a)*m[0]*sc,my=s.y+m[1]*sc;if(PREF.layers.fx)FX.muzzle(mx,my,mz,s.role===1?1.3:s.role===2?2.4:.85);void A;return [mx,my,mz]},
 vehShoot(side,v,tx,tz){const t=vt();v.fire=t/1000;v.aimY=Math.atan2(-(tz-v.z),tx-v.x);v.aimT=t+2600;v.aim+=wrapA(wrapA(v.aimY-(v.hd==null?(this.sides[side].dir<0?0:Math.PI):v.hd))-v.aim)*.75;
  const len=(v.tier===0?3.4:4.9)*v.sc,h=(v.tier===0?1.62:1.43)*v.sc,a=v.aimY,mx=v.x+Math.cos(a)*len,mz=v.z-Math.sin(a)*len,my=v.y+h;if(PREF.layers.fx){FX.muzzle(mx,my,mz,v.tier===0?1.6:3);if(v.tier>0)FX.smoke(mx,my,mz,3,2.6)}return [mx,my,mz]},
 stagger(x,z,r){const t=vt();for(const k in this.sides){const A=this.sides[k];for(const s of this.near(A,x,z,r)){s.st=ST.STAG;s.t0=t+Math.random()*120}}},
 cheer(side){const A=this.sides[side],t=vt();for(const s of A.sold){if(s.st===ST.DIE||s.mv)continue;s.st=ST.CHEER;s.t0=t+Math.random()*600;s.cheer=4200}},
 /* the price crossed a step: the squads of the side that gained it raise a fist */
 surge(side){const A=this.sides[side],t=vt();if(t-A.lastSurge<1500)return;A.lastSurge=t;for(const s of this.frontOf(A).slice(0,8)){if(s.st===ST.DIE||s.mv||s.st===ST.FIRE)continue;s.st=ST.CHEER;s.t0=t+Math.random()*250;s.cheer=900+Math.random()*300}},
 setRest(on){if(this.rest===on)return;this.rest=on;const t=vt();for(const k in this.sides){const A=this.sides[k];for(const s of A.sold){if(s.st===ST.IDLE||s.st===ST.REST){s.st=on?ST.REST:ST.IDLE;s.t0=t}}}},
 reform(){const t=vt();for(const k in this.sides){const A=this.sides[k];for(const [key,sl] of A.slots){const b=VIEW.bk[key[0]].find(x=>x.k===+key.slice(1));if(!b)continue;sl.x=X(b.p);sl.alive.forEach((s,idx)=>{if(s.mv===2||s.st===ST.DIE)return;const o=this.standSpot(A,sl,idx,s);if(s.mv){this.route(A,s,[o.x,o.z],Math.max(t,s.t0));return}const dd=Math.hypot(o.x-s.x,o.z-s.z);if(dd<.25)return;s.mv=1;s.st=dd<5?ST.WALK:ST.RUN;s.sp=s.st===ST.WALK?3.4:10.5;s.t0=t;this.route(A,s,[o.x,o.z],t);s.cv=0})}}},
 /* field works: a barrier line along every wall, sandbags in front of a squad that has held for 30 s, a pennant after two minutes, a bunker for a fort */
 fortBuild(){const std=GFX.std,M=()=>std?new THREE.MeshStandardMaterial({vertexColors:true,roughness:.95}):new THREE.MeshLambertMaterial({vertexColors:true});
  const hb=GFX.merge([GFX.solid(GFX.T(GFX.rbox(1.3,1.55,2.25,.12,1),0,.775,0),[.52,.49,.41]),GFX.solid(GFX.T(new THREE.BoxGeometry(1.08,.1,2.02),0,1.56,0),[.37,.31,.22])]);
  this.hesco=new THREE.InstancedMesh(hb,M(),200);
  const P=[];for(let r=0;r<2;r++){const n=r?6:7;for(let i=0;i<n;i++){const a=(i-(n-1)/2)*.3,g=GFX.T(GFX.rbox(1.15,.42,.62,.16,1),0,.21,0);g.rotateY(Math.PI/2-a);g.translate(Math.cos(a)*3.3-3.3,r*.4,Math.sin(a)*3.3);P.push(GFX.solid(g,r?[.5,.45,.34]:[.56,.5,.37]))}}
  this.empl=new THREE.InstancedMesh(GFX.merge(P),M(),70);
  const pole=new THREE.CylinderGeometry(.035,.045,3.2,5);pole.translate(0,1.6,0);const fl=new THREE.BufferGeometry();fl.setAttribute('position',new THREE.Float32BufferAttribute([0,3.15,0,0,2.45,0,-1.5,2.8,0],3));fl.setAttribute('normal',new THREE.Float32BufferAttribute([0,0,1,0,0,1,0,0,1],3));
  this.penn=new THREE.InstancedMesh(GFX.merge([GFX.solid(pole,[.75,.75,.75]),GFX.solid(fl,[1,1,1])]),new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide}),70);
  [this.hesco,this.empl,this.penn].forEach(m=>{m.count=0;m.castShadow=std;m.receiveShadow=std;m.frustumCulled=false;scene.add(m)});
  const pbG=GFX.merge([GFX.solid(GFX.T(GFX.rbox(3.4,1.6,6.6,.35,2),0,.8,0),[.52,.51,.48]),GFX.solid(GFX.T(GFX.rbox(.1,.28,4.6,.05,1),1.72,1.15,0),[.05,.05,.05]),GFX.solid(GFX.T(GFX.rbox(3.0,.18,6.2,.08,1),0,1.68,0),[.45,.44,.41])]);
  this.bunkers=[];for(let i=0;i<6;i++){const b=new THREE.Mesh(pbG,M());b.scale.setScalar(1.35);b.castShadow=b.receiveShadow=std;b.visible=false;scene.add(b);this.bunkers.push(b)}},
 forts(M){const d=this.dummy;let nh=0,ne=0,np=0,bi=0;const W=[],nav=this.navOn,mv=nav?this.movers():[];
  /* nothing is built on anything: not on wire, hedgehogs, wrecks or structures, not where a vehicle stands or is going, not on other works */
  const onHull=(x,z,hx,hz,rot)=>mv.some(o=>{const R=this.hd2(o)+.4;return NAV.obb(x,z,rot,hx,hz,o.x,o.z,0,R,R,0)||(o.mv&&!o.home&&o.gx!=null&&NAV.obb(x,z,rot,hx,hz,o.gx,o.gz,0,R,R,0))});   // (the square round the circle a hull turns in)
  const onWorks=(x,z,pad)=>W.some(sh=>NAV.inShape(sh,x,z,pad));
  const gates=Object.values(this.sides).map(A=>A.gate).filter(Boolean),atGate=(x,z)=>gates.some(g=>(x-g[0])*(x-g[0])+(z-g[1])*(z-g[1])<324);
  const onMen=(x,z,hx,hz,rot)=>{for(const k in this.sides)for(const s of this.sides[k].sold){if(s.st===ST.DIE)continue;if(NAV.inBox(s.x,s.z,x,z,rot,hx,hz,.7))return true}
   const R=window.GFX6&&GFX6.RB;if(R&&R.sides)for(const k in R.sides){const T=R.sides[k];for(const o of T.bots.concat(T.dogs))if(NAV.inBox(o.x,o.z,x,z,rot,hx,hz,.9))return true}return false};   /* a block is never set down on a man or a machine: where one stands, the line keeps an opening */
  const busy=(x,z,hx,hz,rot)=>nav&&(onMen(x,z,hx,hz,rot)||atGate(x,z)||Math.abs(z-gateZ(x))<Math.max(hx,hz)+4.2||!NAV.boxClear(x,z,hx,hz,rot,.08,null,true)||onHull(x,z,hx,hz,rot)||onWorks(x,z,Math.max(hx,hz)));
  for(const [key,w] of M.walls){const x=X(w.p);if(Math.abs(x)>XMAX)continue;const e=key[0]==='b'?1:-1,xx=x+e*1.55;
   for(let i=0;i<29&&nh<200;i++){const z=-33+i*2.36,r=((i*7)%5-2)*.025;if(i%7===6||Math.abs(z-2*Math.sin(xx*.035))<5.6)continue;/* the road stays open through the line: it is the vehicles' way */if(busy(xx,z,.66,1.12,r))continue;d.position.set(xx,this.gy(xx,z)-.06,z);d.rotation.set(0,r,0);d.scale.setScalar(1);d.updateMatrix();this.hesco.setMatrixAt(nh++,d.matrix);if(nav)W.push(NAV.box(xx,z,.66,1.12,r,'hesco'))}
   if(w.fort&&bi<this.bunkers.length){const rot=e>0?0:Math.PI;let bx=x-e*3,bz=-9;if(nav){const pt=NAV.free(bx,bz,2.4,14,(px,pz)=>!busy(px,pz,2.35,4.5,rot),true);if(!pt)continue;bx=pt[0];bz=pt[1]}const b=this.bunkers[bi++];b.visible=true;b.position.set(bx,this.gy(bx,bz),bz);b.rotation.y=rot;if(nav)W.push(NAV.box(bx,bz,2.35,4.5,rot,'bunker'))}}
  for(const k in this.sides){const A=this.sides[k],e=-A.dir;for(const sl of A.slots.values()){if(sl.alive.length<3||!(sl.rank>=1)||Math.abs(sl.x)>XMAX-3)continue;
    if(ne<70){const xx=sl.x+e*1.9,rot=e>0?0:Math.PI,pts=[-.9,-.45,0,.45,.9].map(a=>[xx+e*(Math.cos(a)*3.3-3.3)*1.25,sl.zc+e*Math.sin(a)*3.3*1.25]);
     if(!nav||pts.every(p=>NAV.clear(p[0],p[1],true)>=.7&&Math.abs(p[1]-gateZ(p[0]))>5&&!atGate(p[0],p[1])&&!onHull(p[0],p[1],.6,.6,0)&&!onWorks(p[0],p[1],.7)&&!onMen(p[0],p[1],.62,.62,0))){d.position.set(xx,this.gy(xx,sl.zc)-.05,sl.zc);d.rotation.set(0,rot,0);d.scale.setScalar(1.25);d.updateMatrix();this.empl.setMatrixAt(ne++,d.matrix);if(nav)for(const p of pts)W.push(NAV.circle(p[0],p[1],.62,'sandbag'))}}
    if(sl.rank>=2&&np<70){const xx=sl.x-e*3.6,zz=sl.zc-2.8;if(!nav||(NAV.clear(xx,zz,true)>=.3&&Math.abs(zz-gateZ(xx))>5&&!atGate(xx,zz)&&!onWorks(xx,zz,.3)&&!onHull(xx,zz,.2,.2,0))){d.position.set(xx,this.gy(xx,zz),zz);d.rotation.set(0,e>0?0:Math.PI,0);d.scale.setScalar(1.3);d.updateMatrix();this.penn.setMatrixAt(np,d.matrix);this.penn.setColorAt(np++,A.pcol);if(nav)W.push(NAV.circle(xx,zz,.16,'flag'))}}}}
  this.hesco.count=nh;this.empl.count=ne;this.penn.count=np;this.hesco.instanceMatrix.needsUpdate=this.empl.instanceMatrix.needsUpdate=this.penn.instanceMatrix.needsUpdate=true;if(this.penn.instanceColor)this.penn.instanceColor.needsUpdate=true;
  for(let i=bi;i<this.bunkers.length;i++)this.bunkers[i].visible=false;
  /* runs every 220 ms: rebuild the walking map at once only when a wall really went up or came down (rebuilding it on every pass made
     the whole page stutter, with the sound breaking up); otherwise the normal throttled refresh is enough */
  let sig='';for(const w of W)sig+=(w.x*4|0)+','+(w.z*4|0)+';';const ch=sig!==this.workSig;this.workSig=sig;
  this.works=W;if(nav)this.navSync(ch)},
 artillery(){const mat={bull:GFX.vehicleMaterial(GFX.TEAMS.bull,GFX.std,this.AU),bear:GFX.vehicleMaterial(GFX.TEAMS.bear,GFX.std,this.AU)};this.vmat=mat;
  const place=(g,x,z,dir,hx,hz)=>{g.scale.setScalar(SC.gun);g.position.set(x,this.gy(x,z),z);g.rotation.y=dir<0?0:Math.PI;g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=GFX.std}});scene.add(g);if(window.NAV)NAV.add(NAV.box(x,z,hx*SC.gun,hz*SC.gun,0,'gun'));return g};
  const G3=(m,x,z,d)=>place(GFX.spg(m),x,z,d,2.5,1.42),R3m=(m,x,z,d)=>place(GFX.mlrs(m),x,z,d,2.8,1.16);
  /* gun lines outside the base walls, each piece in its own earth revetment (gfx5 builds them on the same coordinates) */
  this.guns={bull:[G3(mat.bull,-62,-45,-1),G3(mat.bull,-63,45,-1),G3(mat.bull,-35,-44,-1)],bear:[G3(mat.bear,62,-45,1),G3(mat.bear,63,45,1),G3(mat.bear,35,-44,1)]};
  this.rkts={bull:[R3m(mat.bull,-79,38,-1),R3m(mat.bull,-95,38,-1)],bear:[R3m(mat.bear,79,38,1),R3m(mat.bear,95,38,1)]};
  this.trucks=[];for(let i=0;i<6;i++){const side=i<3?'bull':'bear';const g=GFX.truck(mat[side]);g.scale.setScalar(1.4);g.visible=false;g.traverse(o=>{if(o.isMesh)o.castShadow=true});scene.add(g);this.trucks.push({g,on:false,side,tier:3,x:0,z:0,hd:0,mv:0})}},
 /* a convoy: a lorry drives out of the motor pool to just behind the line, the squad jumps down off the back, the lorry drives home */
 convoy(side,x){const A=this.sides[side];const tr=this.trucks.find(t=>!t.on&&t.side===side);if(!tr)return;const t=vt(),p=A.pool||[A.dir*(GATE+6),gateZ(A.dir*GATE)],fwd=A.dir<0?0:Math.PI;
  Object.assign(tr,{on:true,hold:true,tier:3,x:p[0],z:p[1],hd:A.poolH!=null?A.poolH:fwd,mv:1,home:false,done:false,inShed:false,recall:false,later:0,retry:0,gt:null,dk:null,trail:[],ops:null,spd:0,wait:0,pri:Math.random(),pitch:0,roll:0,y:this.gy(p[0],p[1]),phase:'in',A,wx:clamp(x+A.dir*5,-XMAX+3,XMAX-3),wz:rnd(30,-30)});
  const hd=Math.atan2(-(tr.wz-p[1]),tr.wx-p[0]),g=this.parkSpot(tr,tr.wx,tr.wz,hd);tr.gx=g[0];tr.gz=g[1];tr.ghd=null;tr.g.visible=false},
 trucksTick(dt){const t=vt();for(const tr of this.trucks){if(!tr.on)continue;const A=tr.A;
   if(tr.hold){if(!this.release(tr,t))continue;tr.g.visible=true;AUDIO.play('engine',{x:tr.x,z:tr.z,vol:.5,dur:4})}
   if(tr.mv&&!tr.inShed){this.vehFollow(tr,dt,t);if(tr.spd>.6&&Math.random()<.35&&PREF.layers.fx)FX.dustPuff(tr.x-Math.cos(tr.hd)*3.4,tr.z+Math.sin(tr.hd)*3.4)}
   if(tr.done){tr.on=false;tr.g.visible=false;continue}                                                                                                  // back in the motor pool
   if(!tr.mv&&tr.phase==='in'){tr.phase='drop';tr.until=t+5200;this.navSync(true);const c=Math.cos(tr.hd),s=-Math.sin(tr.hd);A.spawnFrom={x:tr.x-c*3.9,z:tr.z-s*3.9,until:Date.now()+4500}}
   else if(tr.phase==='drop'&&t>tr.until){tr.phase='out';tr.mv=2;tr.home=true;tr.gx=A.pool[0];tr.gz=A.pool[1];tr.ghd=null;this.navSync(true);this.planOr(tr)}
   if(tr.mv||!(tr.gyT>t)){this.align(tr);tr.gyT=t+2500}
   tr.g.position.set(tr.x,tr.y,tr.z);tr.g.rotation.order='YZX';tr.g.rotation.set(tr.roll,tr.hd,tr.pitch)}},
 muzzleOf(g,len){g.updateMatrixWorld(true);const v=new THREE.Vector3(len,0,0);g.userData.piv.localToWorld(v);return v},
 gunFire(side,tx,tz,usd){const guns=this.guns[side];if(!guns)return;if(window.GFX4&&GFX4.air.ready&&GFX4.air.spot)GFX4.air.spot(side,tx,tz);const n=usd>=1e6?3:usd>=2.5e5?2:1;for(let i=0;i<n;i++){const g=guns[(this.gunIdx=(this.gunIdx||0)+1)%3];setTimeout(()=>{if(!R3)return;g.userData.bar.position.x=-.9;const mz=this.muzzleOf(g,4.9);FX.shell(mz.x,mz.y,mz.z,tx+rnd(6,-6),tz+rnd(6,-6),usd,side);FX.muzzle(mz.x,mz.y,mz.z,3.6);FX.smoke(mz.x,mz.y,mz.z,6,3.6);AUDIO.play('cannon',{x:g.position.x,z:g.position.z,vol:.9})},i*230)}},
 rocketFire(side,tx,tz,usd){const rk=this.rkts[side];if(!rk)return;const r=rk[(this.rkIdx=(this.rkIdx||0)+1)%2],n=usd>=6e5?12:usd>=4e5?9:6;const tip=new THREE.Vector3(2.2,.2,0);for(let i=0;i<n;i++)setTimeout(()=>{if(!R3)return;r.updateMatrixWorld(true);const p=tip.clone().set(2.0,-.3+(i%3)*.3,-.52+(i%4)*.35);r.userData.pod.localToWorld(p);FX.rocket(p.x,p.y,p.z,tx+rnd(8,-8),tz+rnd(8,-8),side);FX.smoke(p.x,p.y,p.z,3,2.4);AUDIO.play('rocket',{x:r.position.x,z:r.position.z,vol:.6})},i*140)},
 tickGuns(dt){for(const k in this.guns)this.guns[k].forEach(g=>{const b=g.userData.bar;if(b.position.x<0)b.position.x=Math.min(0,b.position.x+dt*1.6)})}};

/* ======================= effects 3.0: lit smoke, flipbook fire, sparks, debris, decals, tracers, aircraft ======================= */
const FX={K:1,PCAP:420,PJ:[],EX:[],MZ:[],air:[],lights:[],
 init(){const T=GFX.TIERS[WORLD.q0||'high'];this.PU={uTime:{value:0},uPR:{value:1},uWind:{value:0},uLight:{value:new THREE.Color(1,1,1)},uAmb:{value:new THREE.Color(.5,.5,.5)}};
  this.S=GFX.particleSystem(T.soft,false,this.PU);this.G=GFX.particleSystem(T.glow,true,this.PU);this.pts=new THREE.Group();this.pts.add(this.S.points);this.pts.add(this.G.points);scene.add(this.pts);
  /* tracers / shells / rockets: glowing elongated instances */
  const pg=new THREE.CylinderGeometry(.06,.06,1,6,1);pg.rotateX(Math.PI/2);this.proj=new THREE.InstancedMesh(pg,new THREE.MeshBasicMaterial({color:0xffffff,toneMapped:false}),this.PCAP);
  const d=new THREE.Object3D();d.scale.setScalar(0);d.updateMatrix();for(let i=0;i<this.PCAP;i++){this.proj.setMatrixAt(i,d.matrix);this.proj.setColorAt(i,new THREE.Color(1,1,1))}this.proj.count=this.PCAP;this.proj.frustumCulled=false;scene.add(this.proj);
  /* explosion pool: flash star + ground shockwave ring */
  const star=GFX.starTex(),ringT=GFX.ringTex();
  for(let i=0;i<36;i++){const fl=new THREE.Sprite(new THREE.SpriteMaterial({map:star,color:0xfff2c0,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}));fl.visible=false;scene.add(fl);
   const r=new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.MeshBasicMaterial({map:ringT,color:0xffe8c8,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending}));r.rotation.x=-Math.PI/2;r.visible=false;scene.add(r);this.EX.push({fl,r,on:false})}
  for(let i=0;i<(WORLD.soft?0:8);i++){const l=new THREE.PointLight(0xffa040,0,40,2);l.visible=false;scene.add(l);this.lights.push({l,t0:0,dur:0})}
  for(let i=0;i<48;i++){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:star,color:0xffe0a0,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}));s.visible=false;scene.add(s);this.MZ.push({s,t0:0,dur:90})}
  this.aircraft()},
 spawn(ty,x,y,z,vx,vy,vz,life,size){(ty===1||ty===6||ty===7?this.G:this.S).spawn(ty,x,y,z,vx,vy,vz,life,size)},
 clear(){this.PJ.length=0;if(window.GFX4&&GFX4.air.ready)GFX4.air.clear();if(window.GFX6)GFX6.clear();this.air.forEach(a=>{a.on=false;a.back=false;a.g.visible=false;if(a.pad){if(a.pad.static)a.pad.static.visible=true;a.pad.busy=0;a.pad=null}});if(window.GFX4&&GFX4.env)GFX4.env.burns=[];if(WORLD.decals)WORLD.decals.clear()},
 muzzle(x,y,z,sz){const m=this.MZ.find(m=>!m.s.visible);if(!m)return;m.s.visible=true;m.s.position.set(x,y,z);m.s.scale.setScalar((sz||1.2)*(.8+Math.random()*.4));m.s.material.rotation=Math.random()*6.28;m.s.material.opacity=1;m.t0=vt();m.dur=sz>2?120:80;
  if(sz>1.5){const li=this.lights.find(l=>!l.l.visible);if(li){li.l.visible=true;li.l.position.set(x,y+.5,z);li.l.color.setHex(0xffc070);li.l.intensity=3;li.l.distance=16;li.t0=vt();li.dur=120}}},
 dustPuff(x,z,n){const y=ARMY.gy(x,z);for(let i=0;i<(n||3);i++)this.spawn(2,x+rnd(1,-1),y+.4,z+rnd(1,-1),rnd(1,-1),rnd(1.2,.3),rnd(1,-1),1.6+Math.random(),2.4)},
 blood(x,z){this.dustPuff(x,z,2)},
 dust(wind){if(this.K<1&&Math.random()<.6)return;const x=wind>=0?rnd(-60,-150):rnd(150,60);this.spawn(2,x,rnd(6,.5),rnd(70,-70),wind*10+rnd(3,-3),rnd(.4,-.2),rnd(2,-2),5+Math.random()*4,8+Math.random()*9)},
 smoke(x,y,z,n,sz,ty){for(let i=0;i<n;i++)this.spawn(ty||0,x+rnd(.8,-.8),y+rnd(.5,0),z+rnd(.8,-.8),rnd(1.5,-1.5),rnd(2.5,1),rnd(1.5,-1.5),2.4+Math.random()*2.6,sz||3)},
 shoot(o){if(this.PJ.length>=this.PCAP)this.PJ.shift();o.t0=vt();this.PJ.push(o)},
 trade(side,usd,p){if(!VIEW.round||!PREF.layers.fx)return;const buy=side==='buy',sh=buy?'bull':'bear',df=buy?'bear':'bull',dir=buy?1:-1,tx=clamp(X(p),-74,74),col=buy?0x9cffbe:0xffa0a0;
  if(usd>=2.5e5){ARMY.gunFire(sh,tx+dir*1.5,rnd(34,-34),usd);if(usd>=5e5&&usd<1e6&&window.GFX5&&WORLD.env5)GFX5.naval.fire(sh,clamp(tx+dir*2,-72,72),rnd(28,-28),usd,2,'ff');return}
  /* aimed at an enemy near the front when there is one, otherwise at the trade's price on a random lane */
  const en=ARMY.pick(df),x1=en?en.x+rnd(.8,-.8):tx+dir*rnd(2,.5),z1=en?en.z+rnd(1.2,-1.2):rnd(34,-34),far=(x,z)=>Math.hypot(x1-x,z1-z);
  if(usd>=1e5){const v=ARMY.pickVeh(sh,true)||ARMY.pickVeh(sh,false);if(v){const m=ARMY.vehShoot(sh,v,x1,z1);this.shoot({x0:m[0],y0:m[1],z0:m[2],x1,z1,h:2.2,dur:260+far(m[0],m[2])*8,sz:1.7,col,kind:'salvo',usd,side:sh});AUDIO.play('tank',{x:v.x,z:v.z,vol:.6});return}}
  if(usd>=5e4){const s=ARMY.pick(sh,2);if(s){const m=ARMY.shoot(sh,s,x1,z1);this.shoot({x0:m[0],y0:m[1],z0:m[2],x1,z1,h:2.4,dur:480+far(m[0],m[2])*13,sz:1.25,col:0xffc890,kind:'atgm',usd,side:sh,trail:2});this.smoke(m[0]-Math.cos(s.aimY)*2.8,m[1],m[2]+Math.sin(s.aimY)*2.8,4,2.6);AUDIO.play('rocket',{x:s.x,z:s.z,vol:.5});return}
   const v=ARMY.pickVeh(sh,false);if(v){const m=ARMY.vehShoot(sh,v,x1,z1);this.shoot({x0:m[0],y0:m[1],z0:m[2],x1,z1,h:1.6,dur:220+far(m[0],m[2])*7,sz:1.25,col,kind:'tracer',usd,side:sh});AUDIO.play('tank',{x:v.x,z:v.z,vol:.45});return}}
  const s=(usd>=1e4&&Math.random()<.6?ARMY.pick(sh,1):null)||ARMY.pick(sh);if(!s)return;
  const m=ARMY.shoot(sh,s,x1,z1),sz=usd>=5e4?1.25:usd>=1e4?.85:.55;this.shoot({x0:m[0],y0:m[1],z0:m[2],x1,z1,h:.5+sz,dur:230+far(m[0],m[2])*7,sz,col,kind:'tracer',usd,side:sh});
  if(Math.random()<(usd>=1e4?.6:.3))AUDIO.play('gun',{x:s.x,z:s.z,vol:.35,burst:s.role===1?(usd>=1e4?5:3):1})},
 shell(x0,y0,z0,x1,z1,usd,side){this.shoot({x0,y0,z0,x1,z1,h:18+Math.random()*7,dur:1300+Math.random()*260,sz:1.5,col:0xffd27a,kind:'shell',usd,side,trail:1})},
 rocket(x0,y0,z0,x1,z1,side){this.shoot({x0,y0,z0,x1,z1,h:9+Math.random()*5,dur:900+Math.random()*300,sz:1.2,col:0xffb070,kind:'rocket',side,trail:2})},
 bomb(x0,y0,z0,x1,z1,kind,usd,side){this.shoot({x0,y0,z0,x1,z1,h:-y0*.5,dur:1150,sz:kind==='nuke'?3:2,col:0x3a3a3a,kind,usd,side,fall:true})},
 impact(p){if(p.kind==='tracer'){if(p.sz>=1.25)this.explode(p.x1,p.z1,p.sz*.45,0xffd080);else{const y=ARMY.gy(p.x1,p.z1);for(let i=0;i<3;i++)this.spawn(1,p.x1,y+.4,p.z1,rnd(2,-2),rnd(3,.8),rnd(2,-2),.35+Math.random()*.2,.9);this.spawn(2,p.x1,y+.3,p.z1,rnd(.6,-.6),rnd(.8,.2),rnd(.6,-.6),1.1,1.6)}}
  else if(p.kind==='salvo')this.explode(p.x1,p.z1,1.15,0xffc070);else if(p.kind==='atgm')this.explode(p.x1,p.z1,1.0,0xffb060);else if(p.kind==='shell')this.explode(p.x1,p.z1,1.55+(p.usd>=1e6?.6:0),0xff9a3c,true);else if(p.kind==='rocket')this.explode(p.x1,p.z1,1.3,0xffa050,true);
  else if(p.kind==='bomb')this.explode(p.x1,p.z1,3.3,0xff8a2a,true);else if(p.kind==='nuke')this.nuke(p.x1,p.z1)},
 hitArmy(x){return x<X(VIEW.price||VIEW.round.p0)?'bull':'bear'},
 /* layered explosion: flash → flipbook fireball → sparks/debris → sooty smoke column → dust ring → scorch + crater */
 explode(x,z,size,col,crater){const e=this.EX.find(e=>!e.on);const y=ARMY.gy(x,z),K=this.K;
  if(e){e.on=true;e.t0=vt();e.dur=520+size*240;e.size=size;e.fl.visible=e.r.visible=true;e.fl.material.color.set(col||0xfff0c0);e.fl.position.set(x,y+1+size*.8,z);e.fl.material.rotation=Math.random()*6.28;e.r.position.set(x,y+.25,z)}
  const nf=Math.max(3,Math.round((4+size*5)*K));for(let i=0;i<nf;i++){const a=Math.random()*6.283,r=Math.random()*size*.7;this.spawn(7,x+Math.cos(a)*r,y+.4+Math.random()*size*.7,z+Math.sin(a)*r,Math.cos(a)*size*1.6,rnd(4,1.5)*size*.6,Math.sin(a)*size*1.6,.75+Math.random()*.55+size*.08,3+size*2.6)}
  const ns=Math.round((10+size*16)*K);for(let i=0;i<ns;i++)this.spawn(1,x,y+.6,z,rnd(8,-8)*size,rnd(10,3)*size*.8,rnd(8,-8)*size,.45+Math.random()*.7,.8+size*.25);
  const sm=Math.round((6+size*10)*K);for(let i=0;i<sm;i++)this.spawn(0,x+rnd(1,-1)*size,y+.6+Math.random()*size*1.2,z+rnd(1,-1)*size,rnd(1.8,-1.8),rnd(3.2,1.2)+size*.6,rnd(1.8,-1.8),3+Math.random()*3+size,3.4+size*2.2);
  if(size>=1)for(let i=0;i<Math.round(size*9*K);i++)this.spawn(3,x,y+.5,z,rnd(9,-9)*size,rnd(12,4),rnd(9,-9)*size,1.2+Math.random(),.9+size*.45);
  if(size>=.9)for(let i=0;i<Math.round(14*K);i++){const a=i/14*6.283+Math.random()*.3;this.spawn(2,x+Math.cos(a)*size*.6,y+.3,z+Math.sin(a)*size*.6,Math.cos(a)*rnd(7,4)*size,rnd(.6,.1),Math.sin(a)*rnd(7,4)*size,1.4+Math.random(),3.5+size*2)}
  for(let i=0;i<Math.round(size*5*K);i++)this.spawn(6,x+rnd(1,-1),y+.6,z+rnd(1,-1),rnd(2,-2),rnd(4,1.5),rnd(2,-2),1.5+Math.random()*1.5,.6);
  const li=this.lights.find(l=>!l.l.visible);if(li){li.l.visible=true;li.l.position.set(x,y+2+size,z);li.l.color.set(col||0xffa040);li.l.intensity=5+size*5;li.l.distance=22+size*20;li.t0=vt();li.dur=380+size*170}
  if(size>=1.1&&WORLD.decals)WORLD.decals.add(x,z,1.6+size*1.6);
  ARMY.stagger(x,z,2+size*2.2);DIRECTOR.shake(size*.45);if(size>=2.5)DIRECTOR.punch(size*.6);if(crater&&S.quality!=='lite')WORLD.crater(x,z,2.6+size,.4+size*.3);AUDIO.play('explosion',{x,z,vol:Math.min(1,.4+size*.22),size})},
 /* aircraft: two helicopters, two jets and a bomber per army, in the army's colours */
 aircraft(){const mk=(side,k)=>{const m=ARMY.vmat[side];const g=k==='heli'?GFX.heli(m):GFX.jet(m,k==='bomber');g.visible=false;scene.add(g);return {k,side,g,on:false}};
  this.air=[];['bull','bear'].forEach(s=>{this.air.push(mk(s,'heli'),mk(s,'heli'),mk(s,'jet'),mk(s,'jet'),mk(s,'jet'),mk(s,'jet'),mk(s,'jet'),mk(s,'bomber'))})},
 pick(k,att){return this.air.find(a=>a.k===k&&a.side===att&&!a.on)},
 heli(att,tx,tz,usd){const a=this.pick('heli',att);if(!a){if(window.GFX6&&GFX6.sortie(att,tx,tz,1,usd))return;return this.jet(att,tx,tz,usd)}const dir=att==='bull'?-1:1;a.on=true;a.att=att;a.t0=vt();a.x0=dir*150;a.z0=tz+rnd(40,-40);a.y0=26;a.hop=0;a.in=2.6;a.hy=dir<0?0:Math.PI;
  const land=window.GFX4&&GFX4.helipad?GFX4.helipad(att,a):null,pad=land||(window.GFX6&&WORLD.env5?GFX6.heliPad(att,a):null);a.pad=land;a.g.scale.setScalar(land?1.25:1);if(pad){a.x0=pad.x;a.z0=pad.z;a.y0=pad.y;a.hy=pad.yaw;a.hop=land?11:15;a.in=land?6.2:5.6}/* it lifts from its spot on the carrier's quarter and comes in over the bay */
  a.tx=tx;a.tz=tz;a.ty=15;a.dir=dir;a.phase=0;a.usd=usd;a.shots=0;a.g.visible=true;a.g.position.set(a.x0,a.y0,a.z0);a.g.rotation.set(0,a.hy,0);AUDIO.play('heli',{x:a.x0,z:a.z0,vol:.9,dur:a.hop?a.in*2+3.4:9,follow:a})},
 jet(att,tx,tz,usd){const a=this.pick('jet',att);if(!a)return;const dir=att==='bull'?-1:1;a.on=true;a.att=att;a.t0=vt();a.dur=2.8;a.x0=dir*240;a.x1=-dir*240;a.z=tz+rnd(6,-6);a.y=27;a.tx=tx;a.tz=tz;a.dir=dir;a.dropped=false;a.usd=usd;a.g.visible=true;a.g.rotation.set(0,dir<0?0:Math.PI,0);AUDIO.play('jet',{x:a.x0,z:a.z,vol:1,dur:3.2,follow:a});evt(VIEW,{k:'bomb',usd,p:VIEW.price})},
 bomber(att,tx,tz,usd){const a=this.pick('bomber',att);if(!a)return this.jet(att,tx,tz,usd);const dir=att==='bull'?-1:1;a.on=true;a.att=att;a.t0=vt();a.dur=5.5;a.x0=dir*260;a.x1=-dir*260;a.z=tz;a.y=46;a.tx=tx;a.tz=tz;a.dir=dir;a.dropped=false;a.usd=usd;a.nuke=usd>=2.5e7;a.g.visible=true;a.g.rotation.set(0,dir<0?0:Math.PI,0);AUDIO.play('bomber',{x:a.x0,z:a.z,vol:1,dur:6,follow:a})},
 airTick(dt){const t=vt(),blink=Math.sin(U.t*9)>.55;for(const a of this.air){if(!a.on||a.so)continue;/* a.so: on a carrier sortie, flown by gfx6 */const el=(t-a.t0)/1000;a.wx=a.g.position.x;a.wz=a.g.position.z;const ud=a.g.userData;if(ud.nav)ud.nav.forEach((s,i)=>s.material.opacity=i===2?(blink?1:.1):.85);
   if(a.k==='heli'){ud.rotor.rotation.y+=dt*30;ud.tr.rotation.z+=dt*44;if(a.phase===0){const f=clamp(el/(a.in||2.6),0,1);if(a.hop){/* straight up off the deck, nose down to gather speed, a long hop over the bay, then flare and face the front */const lift=sm3(0,.16,f),e=sm3(.06,1,f),hx=a.tx+a.dir*14-a.x0,hz=a.tz-a.z0,h0=Math.atan2(-hz,hx);a.g.position.set(a.x0+hx*e,a.y0+4*lift+(a.ty-a.y0-4)*e+a.hop*Math.sin(Math.PI*e),a.z0+hz*e);a.g.rotation.y=angMix(angMix(a.hy,h0,sm3(.05,.22,f)),a.dir<0?0:Math.PI,sm3(.8,1,f));a.g.rotation.z=-.2*Math.sin(2*Math.PI*clamp((f-.08)/.92,0,1))}else{const e=1-Math.pow(1-f,3);a.g.position.set(a.x0+(a.tx+a.dir*14-a.x0)*e,a.y0+(a.ty-a.y0)*e,a.z0+(a.tz-a.z0)*e);a.g.rotation.z=a.dir*-.28*(1-f)*(a.dir<0?1:-1)}if(f>=1){a.phase=1;a.p1=t}}
    else if(a.phase===1){const e=(t-a.p1)/1000;a.g.position.y=a.ty+Math.sin(e*3)*.4;a.g.rotation.z=Math.sin(e*2)*.05;if(a.shots<4&&e>a.shots*.5+.2){a.shots++;const fw=a.dir<0?1:-1;this.rocket(a.g.position.x+fw*.6,a.g.position.y-.4,a.g.position.z+(a.shots%2?1.45:-1.45),a.tx+rnd(5,-5),a.tz+rnd(5,-5),a.att);AUDIO.play('rocket',{x:a.g.position.x,z:a.g.position.z,vol:.7});this.muzzle(a.g.position.x+fw*1.1,a.g.position.y-.35,a.g.position.z+(a.shots%2?1.45:-1.45),1.6);this.smoke(a.g.position.x,a.g.position.y-.4,a.g.position.z,2,1.6,4)}
     if(e>2.6){a.phase=2;a.p2=t;a.px=a.g.position.x;a.pz=a.g.position.z}}
    else if(a.hop){/* home to the carrier: turn out, hop back, settle on the spot */if(!a.back){a.back=true;const pd=a.pad||GFX6.heliPad(a.att,a);if(pd){a.x0=pd.x;a.y0=pd.y;a.z0=pd.z;a.hy=pd.yaw}a.py=a.g.position.y;a.ry0=a.g.rotation.y}
     const f=clamp((t-a.p2)/1000/(a.in+.8),0,1),e=sm3(0,.9,f),set=sm3(.86,1,f),hx=a.x0-a.px,hz=a.z0-a.pz,h0=Math.atan2(-hz,hx);a.g.position.set(a.px+hx*e,a.py+(a.y0+4-a.py)*e+a.hop*Math.sin(Math.PI*e)-4*set,a.pz+hz*e);a.g.rotation.y=angMix(angMix(a.ry0,h0,sm3(0,.2,f)),a.hy,sm3(.74,.92,f));a.g.rotation.z=-.2*Math.sin(2*Math.PI*clamp(f/.9,0,1));if(f>=1){a.on=false;a.back=false;a.g.visible=false;if(a.pad){if(a.pad.static)a.pad.static.visible=true;a.pad.busy=0;a.pad=null}}}
    else{const f=clamp((t-a.p2)/1000/3,0,1),e=f*f;a.g.position.set(a.px+(a.dir*-1*200-a.px)*e,a.ty+30*e,a.pz-60*e);a.g.rotation.z=.2*f;if(f>=1){a.on=false;a.g.visible=false}}
    if(Math.random()<.5)this.spawn(2,a.g.position.x,ARMY.gy(a.g.position.x,a.g.position.z)+.3,a.g.position.z,rnd(5,-5),.25,rnd(5,-5),1.3,6)}
   else{const f=clamp(el/a.dur,0,1);const x=a.x0+(a.x1-a.x0)*f;a.g.position.set(x,a.y+Math.sin(el*1.3)*.6,a.z);a.g.rotation.x=Math.sin(el*.9)*.1;if(ud.ab)ud.ab.material.opacity=.7+Math.random()*.3;
    if(!a.dropped&&(a.dir<0?x>=a.tx-a.y*.9:x<=a.tx+a.y*.9)){a.dropped=true;this.bomb(x,a.y-1,a.z,a.tx+rnd(3,-3),a.tz+rnd(3,-3),a.nuke?'nuke':'bomb',a.usd,a.att);AUDIO.play('whistle',{x:a.tx,z:a.tz,vol:.6})}
    const bk=a.dir<0?-1:1;if(a.k==='bomber'){if(Math.random()<.9)this.spawn(4,x+bk*2.2,a.y+.1,a.z+(Math.random()<.5?1.6:-1.6)*(Math.random()<.5?1:1.9),0,0,0,2.4,2.6)}else if(Math.random()<.7)this.spawn(4,x+bk*3.6,a.y,a.z,0,0,0,1.3,1.4);
    if(f>=1){a.on=false;a.g.visible=false}}}},
 nuke(x,z){const y=ARMY.gy(x,z);$('#flash').style.transition='opacity .05s';$('#flash').style.opacity=.95;setTimeout(()=>{$('#flash').style.transition='opacity 1.6s';$('#flash').style.opacity=0},80);
  const e=this.EX.find(e=>!e.on);if(e){e.on=true;e.t0=vt();e.dur=3200;e.size=7;e.fl.visible=e.r.visible=true;e.fl.material.color.set(0xffe2a0);e.fl.position.set(x,y+8,z);e.r.position.set(x,y+.3,z)}
  for(let i=0;i<40;i++)this.spawn(7,x+rnd(3,-3),y+2+Math.random()*6,z+rnd(3,-3),rnd(2,-2),rnd(9,4),rnd(2,-2),2.2+Math.random()*1.2,14+Math.random()*10);
  for(let i=0;i<220;i++)this.spawn(5,x+rnd(2,-2),y+1+Math.random()*4,z+rnd(2,-2),rnd(1.5,-1.5),rnd(9,4),rnd(1.5,-1.5),6+Math.random()*4,6+Math.random()*6);
  for(let i=0;i<260;i++){const a=Math.random()*6.283,r=Math.random()*9;this.spawn(5,x+Math.cos(a)*r,y+20+Math.random()*6,z+Math.sin(a)*r,Math.cos(a)*rnd(6,2),rnd(3,.5),Math.sin(a)*rnd(6,2),7+Math.random()*4,9+Math.random()*8)}
  for(let i=0;i<140;i++){const a=Math.random()*6.283;this.spawn(2,x,y+.3,z,Math.cos(a)*rnd(28,10),rnd(1,.2),Math.sin(a)*rnd(28,10),3+Math.random()*2,8+Math.random()*7)}
  for(let i=0;i<80;i++)this.spawn(3,x,y+1,z,rnd(20,-20),rnd(26,8),rnd(20,-20),2+Math.random()*2,2.4);for(let i=0;i<60;i++)this.spawn(6,x+rnd(8,-8),y+2,z+rnd(8,-8),rnd(3,-3),rnd(6,2),rnd(3,-3),3+Math.random()*3,.9);
  const li=this.lights.find(l=>!l.l.visible);if(li){li.l.visible=true;li.l.position.set(x,y+12,z);li.l.color.set(0xffe0a0);li.l.intensity=40;li.l.distance=180;li.t0=vt();li.dur=2400}
  if(WORLD.decals)WORLD.decals.add(x,z,16);ARMY.stagger(x,z,46);DIRECTOR.shake(3);DIRECTOR.punch(3);if(S.quality!=='lite')WORLD.crater(x,z,11,2.6);AUDIO.play('nuke',{x,z,vol:1});DIRECTOR.slowmo(.22,2.6)},
 flare(x,z){const e=this.MZ.find(m=>!m.s.visible);if(!e)return;e.s.visible=true;e.s.position.set(x,7,z);e.s.scale.setScalar(7);e.s.material.opacity=1;e.t0=vt();e.dur=2600;for(let i=0;i<40;i++)this.spawn(1,x,6,z,rnd(3,-3),rnd(9,3),rnd(3,-3),1.2+Math.random(),1.8)},
 tick(dt){if(window.GFX4&&GFX4.air.ready)GFX4.air.tick(dt);const t=vt(),d=this.dummy||(this.dummy=new THREE.Object3D()),c=this.tmpC||(this.tmpC=new THREE.Color());let k=0;const P=this.PU;P.uTime.value=U.t;P.uPR.value=ren.getPixelRatio();P.uWind.value=WORLD.wind;
  if(WORLD.sun){P.uLight.value.copy(WORLD.sun.color).multiplyScalar(Math.min(1.4,WORLD.sun.intensity*.32));P.uAmb.value.copy(WORLD.hemi.color).multiplyScalar(WORLD.hemi.intensity*.75)}
  for(let i=this.PJ.length-1;i>=0;i--){const p=this.PJ[i];const f=(t-p.t0)/p.dur;if(f>=1){this.PJ.splice(i,1);this.impact(p);continue}
   const pos=f2=>{const x=p.x0+(p.x1-p.x0)*f2,z=p.z0+(p.z1-p.z0)*f2;const y=p.fall?p.y0*(1-f2*f2)+.3:p.y0+(ARMY.gy(p.x1,p.z1)+.6-p.y0)*f2+p.h*4*f2*(1-f2);return [x,y,z]};
   const [x,y,z]=pos(f),[x2,y2,z2]=pos(Math.min(1,f+.02));d.position.set(x,y,z);d.lookAt(x2,y2,z2);const len=p.kind==='tracer'?1.1+p.sz*.8:p.kind==='shell'?1.4:p.kind==='rocket'||p.kind==='atgm'?1.6:1.2;d.scale.set(p.sz,p.sz,len*(p.fall?.6:1));d.updateMatrix();this.proj.setMatrixAt(k,d.matrix);
   c.set(p.col);if(!p.fall)c.multiplyScalar(p.kind==='tracer'?1.35:1.8);this.proj.setColorAt(k,c);k++;
   if(p.trail&&Math.random()<.9)this.spawn(p.trail===2?4:0,x,y,z,rnd(.5,-.5),rnd(.5,0),rnd(.5,-.5),p.trail===2?1:1.7,p.trail===2?1.7:2.2);if(p.trail===2&&Math.random()<.6)this.spawn(1,x,y,z,rnd(.6,-.6),rnd(.6,-.6),rnd(.6,-.6),.25,1.1)}
  d.scale.setScalar(0);d.updateMatrix();for(let i=k;i<this.PCAP;i++)this.proj.setMatrixAt(i,d.matrix);this.proj.instanceMatrix.needsUpdate=true;if(this.proj.instanceColor)this.proj.instanceColor.needsUpdate=true;
  this.EX.forEach(e=>{if(!e.on)return;const f=(t-e.t0)/e.dur;if(f>=1){e.on=false;e.fl.visible=e.r.visible=false;return}e.fl.scale.setScalar(e.size*(3.2+7*f));e.fl.material.opacity=Math.max(0,1-f*3.2);e.r.scale.setScalar(e.size*(1.2+11*f));e.r.material.opacity=(1-f)*.55});
  this.lights.forEach(li=>{if(!li.l.visible)return;const f=(t-li.t0)/li.dur;if(f>=1){li.l.visible=false;li.l.intensity=0;return}li.l.intensity*=1-Math.min(1,dt*4)});
  this.MZ.forEach(m=>{if(!m.s.visible)return;const f=(t-m.t0)/m.dur;if(f>=1){m.s.visible=false;return}if(f>=0)m.s.material.opacity=1-f});
  this.airTick(dt);this.S.flush();this.G.flush()}};

/* ======================= director: cameras, scenarios, slow motion, strikes ======================= */
/* ======================= the cinema camera ======================= */
/* Cut like a war film. While nothing big happens a reel runs through acts: the theatre from the air; the armies (a crane up from a
   squad, a dolly along the line, a push in on a tank); the yard and the road (a hull out of the motor pool and through the gate); the
   front up close (a long lens across no-man's land, over a soldier's shoulder); the sea (alongside a destroyer, over a carrier's deck);
   the sky (behind a recon drone, a satellite). Anything big cuts in at once with its own sequence: who fires, what flies, the hit in
   slow motion, what is left. Shots cut, they do not drift; each one moves, and every frame keeps the camera above the ground and the
   sea and out of buildings, trees, hulls and men. */
const CINE={q:[],shot:null,t0:0,act:0,lift:0,step:0,poleL:null,poleT:0,P:new THREE.Vector3(),T:new THREE.Vector3(),fov:46,pri:0,trees:null,
 V:(x,y,z)=>new THREE.Vector3(x,y,z),
 ease:u=>u*u*(3-2*u),
 side:()=>Math.random()<.5?'bull':'bear',
 dirOf:s=>s==='bull'?-1:1,                                                    // where an army's base is (x sign)
 fx(){return VIEW.round?X(VIEW.price||VIEW.round.p0):0},
 gy(x,z){return Math.max(WORLD.hgt(x,z),-1.15)},
 reset(){this.q.length=0;this.shot=null;this.pri=0;this.step=0},
 /* ---- shots: {dur s, fov, P(u,dt), T(u,dt)} with u going 0 → 1 through the shot ---- */
 fly(a,b,look,dur,fov){return {dur,fov:fov||48,P:u=>a.clone().lerp(b,this.ease(u)),T:typeof look==='function'?look:()=>look}},
 orbit(c,r,h,a0,da,dur,fov,ly){return {dur,fov:fov||46,P:u=>{const C=typeof c==='function'?c():c,a=a0+da*u;return this.V(C.x+Math.cos(a)*r,C.y+h,C.z-Math.sin(a)*r)},T:()=>{const C=typeof c==='function'?c():c;return this.V(C.x,C.y+(ly==null?1:ly),C.z)}}},
 crane(c,dx,dz,d0,d1,h0,h1,dur,fov){return {dur,fov:fov||44,P:u=>{const e=this.ease(u),d=d0+(d1-d0)*e;return this.V(c.x-dx*d,c.y+h0+(h1-h0)*e,c.z-dz*d)},T:u=>this.V(c.x+dx*5,c.y+1.3-this.ease(u)*.9,c.z+dz*5)}},
 /* behind (back), beside (side) and above (up) something that moves, looking ahead of it; o() gives {p, f:[x,z] forward} or null */
 track(o,back,side,up,ahead,dur,fov){let P=null,T=null;return {dur,fov:fov||50,P:(u,dt)=>{const q=o();if(q){const f=q.f,r=[-f[1],f[0]],w=this.V(q.p.x-f[0]*back+r[0]*side,q.p.y+up,q.p.z-f[1]*back+r[1]*side),l=this.V(q.p.x+f[0]*ahead,q.p.y+up*.35,q.p.z+f[1]*ahead);
   if(!P){P=w;T=l}else{const k=Math.min(1,dt*3);P.lerp(w,k);T.lerp(l,k)}}return P||this.P.clone()},T:()=>T||this.T.clone()}},
 still(p,t,dur,fov){return {dur,fov:fov||46,P:()=>p,T:typeof t==='function'?t:()=>t}},
 /* ---- what there is to film ---- */
 squad(side){const f=ARMY.frontOf(ARMY.sides[side]);return f.length?f[Math.floor(Math.random()*Math.min(8,f.length))]:null},
 hull(side,pred){const L=ARMY.sides[side].veh.filter(v=>!v.dead&&!v.hold&&!v.inShed&&(!pred||pred(v)));return L.length?L[Math.floor(Math.random()*L.length)]:null},
 mover(v){return ()=>v.dead||v.done||v.hold||(v.tier===3&&!v.on)?null:{p:this.V(v.x,ARMY.gy(v.x,v.z),v.z),f:[Math.cos(v.hd),-Math.sin(v.hd)]}},
 ship(side,kind){const E=WORLD.env5;return E?E.ships.find(s=>s.side===side&&s.kind===kind):null},
 shipOf(s){return ()=>({p:s.g.position,f:[Math.cos(s.hd||0),-Math.sin(s.hd||0)]})},
 /* ---- the reel ---- */
 reel(){const acts=['theatre','armies','yard','front','sea','sky'];for(let i=0;i<acts.length;i++){const a=this['act_'+acts[this.act++%acts.length]]();if(a&&a.length)return a}return this.act_theatre()},
 act_theatre(){const fx=this.fx(),s=Math.random()<.5?-1:1,out=[];
  if(Math.random()<.5)out.push(this.fly(this.V(fx+s*95,64,58),this.V(fx+s*30,40,44),this.V(fx,0,-4),10,50));
  else out.push(this.fly(this.V(s*40,20,-175),this.V(s*12,30,-112),this.V(fx*.4,0,-12),10,52));     // in from the sea over the fleets, the coast ahead
  out.push(this.fly(this.V(fx-s*20,26,-62),this.V(fx+s*24,30,-58),this.V(fx,1,0),8,46));             // along the rear, the whole front in frame
  return out},
 act_armies(){const out=[],k=this.side(),D=this.dirOf(k),s0=this.squad(k);
  if(s0)out.push(this.crane(this.V(s0.x,ARMY.gy(s0.x,s0.z),s0.z),-D,0,3.2,13,1.6,15,8,42));         // from just behind a squad, up and back over it
  const fx=this.fx(),lx=fx+D*9;out.push(this.fly(this.V(lx+D*7,3.2,-26),this.V(lx+D*7,3.2,24),()=>this.V(lx-D*8,1.6,this.P.z+8),9,48));   // a dolly down the line
  const v=this.hull(k,v=>!v.mv);if(v){const a=Math.atan2(-(0-v.z),(fx-v.x))+(Math.random()<.5?.7:-.7);out.push({dur:7,fov:38,P:u=>{const d=24-13*this.ease(u);return this.V(v.x+Math.cos(a)*d,ARMY.gy(v.x,v.z)+1.8,v.z-Math.sin(a)*d)},T:()=>this.V(v.x,ARMY.gy(v.x,v.z)+1.9,v.z)})}   // push in, low, on a tank
  return out},
 act_yard(){const out=[];for(const k of ['bull','bear']){const A=ARMY.sides[k],D=A.dir;
   const clear=v=>A.shed?Math.hypot(v.x-A.shed.x,v.z-A.shed.door)>16:true,v=A.veh.find(v=>!v.dead&&!v.hold&&!v.inShed&&v.mv&&D*v.x>40&&clear(v))||ARMY.trucks.find(t=>t.on&&!t.hold&&!t.inShed&&t.A===A&&t.mv&&D*t.x>40&&clear(t));
   if(v){out.push(this.track(this.mover(v),11,2.5,4.2,10,8,50));return out}}
  const k=this.side(),A=ARMY.sides[k],D=A.dir,g=A.gate;if(!g)return out;
  out.push(this.still(this.V(D*(GATE-15),4.6,g[1]+7),this.V(D*GATE,2.2,g[1]),6,40));               // at the gate as the men come out
  if(A.shed)out.push(this.still(this.V(A.shed.x-D*7,5.8,A.shed.door+11),this.V(A.shed.x,2.6,A.shed.door-2),5,44));   // the motor pool's door
  return out},
 act_front(){const fx=this.fx(),k=this.side(),D=this.dirOf(k),out=[],z=rnd(22,-22);
  out.push(this.fly(this.V(fx+D*34,1.6,z),this.V(fx+D*31,1.7,z+3),this.V(fx-D*12,1.5,z+5),6,26));   // a long lens across no-man's land
  const s0=this.squad(k);if(s0){const h=s0.x,zz=s0.z;out.push({dur:6,fov:40,P:u=>this.V(h+D*2.3,ARMY.gy(h,zz)+1.75,zz+.8+u*.4),T:()=>this.V(h-D*25,ARMY.gy(h,zz)+1.2,zz+2)})}   // over a soldier's shoulder
  return out},
 act_sea(){const out=[],k=this.side(),s=this.ship(k,Math.random()<.6?'dd':'ff');
  if(s)out.push(this.track(this.shipOf(s),-14,-48,7,6,8,46));                                         // alongside a warship, at her pace
  const c=window.GFX6&&GFX6.cv&&GFX6.cv[k];if(c)out.push(this.orbit(()=>c.g.position,92,30,rnd(6.28),.55,9,44,6));   // round a carrier
  return out},
 act_sky(){const out=[],A4=window.GFX4&&GFX4.air,k=this.side();
  const d=A4&&A4.ready&&A4.drones.find(d=>d.side===k);if(d)out.push(this.track(()=>({p:d.m.position,f:[Math.cos(d.m.rotation.y),-Math.sin(d.m.rotation.y)]}),9,0,2.5,-6,7,56));   // riding behind a recon drone
  if(WORLD.env5&&Math.random()<.6)out.push({sat:k,dur:9});
  return out},
 /* ---- big moments cut in ---- */
 event(kind,o){if(DIRECTOR.mode!=='cine'||!R3)return;const S=this.seq(kind,o||{});if(!S||!S.length)return;const pri=o&&o.pri||2;if(this.shot&&this.pri>pri&&now()-this.t0<this.shot.dur*1000)return;
  this.q=S;this.pri=pri;this.next()},
 seq(kind,o){const fx=this.fx(),out=[];
  if(kind==='guns'){const g=(ARMY.guns[o.att]||[])[0];if(g){const dx=o.tx-g.position.x,dz=o.tz-g.position.z,n=Math.hypot(dx,dz)||1;out.push(this.still(this.V(g.position.x-dx/n*10+dz/n*4,this.gy(g.position.x,g.position.z)+3.4,g.position.z-dz/n*10-dx/n*4),this.V(g.position.x+dx/n*30,9,g.position.z+dz/n*30),2.8,48))}
   out.push(this.still(this.V(o.tx+this.dirOf(o.att)*34,10,o.tz+24),this.V(o.tx,1,o.tz),4.5,42));return out}
  if(kind==='heli'){const a=FX.air.find(a=>a.k==='heli'&&a.on&&a.side===o.att);if(a)out.push(this.track(()=>a.on?{p:a.g.position,f:[Math.cos(a.g.rotation.y),-Math.sin(a.g.rotation.y)]}:null,15,4,4,24,7,52));
   out.push(this.orbit(this.V(o.tx,this.gy(o.tx,o.tz),o.tz),30,11,rnd(6.28),.5,5,44));return out}
  if(kind==='jets'){out.push(this.still(this.V(o.tx+rnd(10,-10),this.gy(o.tx,o.tz+20)+1.6,o.tz+20),this.V(o.tx,16,o.tz),3.6,62));   // on the ground looking up as they come over
   out.push(Object.assign(this.orbit(this.V(o.tx,this.gy(o.tx,o.tz),o.tz),34,13,rnd(6.28),.6,6,44),{slow:[.15,.35,1.4]}));return out}
  if(kind==='missile'){const tl=WORLD.env4&&WORLD.env4.tels[o.att]&&WORLD.env4.tels[o.att][0];
   if(tl){const p=tl.pivot,fx=Math.cos(tl.rot),fz=-Math.sin(tl.rot),mx=p.x+fx*4,mz=p.z+fz*4,cx=mx-fz*9,cz=mz+fx*9;out.push(this.still(this.V(cx,this.gy(cx,cz)+1.5,cz),this.V(mx,p.y+1.5,mz),3.2,56))}   // low beside the launcher as its rail comes up and it fires
   const A4=window.GFX4&&GFX4.air;if(A4&&A4.ready){let m=null;out.push(this.track(()=>{if(!m||!m.on)m=A4.M.find(q=>q.on&&q.kind==='B'&&q.side===o.att);if(!m)return null;const f=[m.p1.x-m.p0.x,m.p1.z-m.p0.z],n=Math.hypot(f[0],f[1])||1;return {p:m.pos,f:[f[0]/n,f[1]/n]}},26,8,7,30,3.8,56))}   // with the missile
   out.push(Object.assign(this.still(this.V(o.tx+this.dirOf(o.att)*40,15,o.tz+30),this.V(o.tx,0,o.tz),5,44),{slow:[.45,.3,1.6]}));   // where it comes down, in slow motion
   out.push(this.crane(this.V(o.tx,this.gy(o.tx,o.tz),o.tz),-this.dirOf(o.att),0,14,30,3,22,5,46));return out}           // what is left
  if(kind==='raid'){const c=window.GFX6&&GFX6.cv&&GFX6.cv[o.att];if(c)out.push(this.orbit(()=>c.g.position,70,16,rnd(6.28),.35,3.6,46,8));   // off the carrier's deck
   const t2=this.seq('missile',o);out.push(...t2.slice(0,1));out.push(this.fly(this.V(o.tx+this.dirOf(o.att)*70,48,o.tz+60),this.V(o.tx+this.dirOf(o.att)*30,32,o.tz+38),this.V(o.tx,0,o.tz),6,48));
   out.push(Object.assign(this.still(this.V(o.tx-this.dirOf(o.att)*36,12,o.tz-30),this.V(o.tx,0,o.tz),5,44),{slow:[.3,.3,1.8]}));return out}
  if(kind==='naval'){const s=this.ship(o.side,'dd');if(s)out.push(this.track(this.shipOf(s),6,-40,5,0,3.8,48));out.push(this.still(this.V(o.tx+this.dirOf(o.side)*30,9,o.tz+22),this.V(o.tx,1,o.tz),4.2,44));return out}
  if(kind==='sub'){const E=WORLD.env5,s=E&&E.subs[o.att];if(s){const p=s.g.position;out.push(this.still(this.V(p.x+28,2.4,p.z+30),this.V(p.x,1.2,p.z),5.5,44))}out.push(...this.seq('missile',o).slice(1,3));return out}
  if(kind==='wall'){const A=ARMY.sides[o.side],D=A.dir,ms=WORLD.env4&&WORLD.env4.masts&&WORLD.env4.masts.find(m=>m.side===o.side);
   if(ms)out.push(this.still(this.V(ms.p.x+D*16,this.gy(ms.p.x+D*16,ms.p.z+16)+8,ms.p.z+16),this.V(ms.p.x,ms.p.y-5,ms.p.z),3.2,48));   // the mast relays the order
   if(A.shed)out.push(this.still(this.V(A.shed.x-D*8,5.8,A.shed.door+12),this.V(A.shed.x,2.4,A.shed.door-2),5,44));           // the motor pool opens
   out.push(this.fly(this.V(o.x-D*18,7,-30),this.V(o.x-D*18,8,28),()=>this.V(o.x,1,this.P.z),7,46));return out}                 // the line they come to hold
  if(kind==='robots'){const S=window.GFX6&&GFX6.RB&&GFX6.RB.sides[o.side],b=S&&S.bots[0];if(b)out.push(this.track(()=>({p:this.V(b.x,ARMY.gy(b.x,b.z),b.z),f:[-this.dirOf(o.side),0]}),9,3,3.4,10,7,48));return out}
  if(kind==='sat'){out.push({sat:o.side,dur:8});return out}
  if(kind==='win'){const bx=o.bx,D=Math.sign(bx)||1;out.push(this.crane(this.V(bx,this.gy(bx,0),0),-D,0,22,46,4,26,7,46));return out}
  return out},
 next(){if(!this.q.length)this.q=this.reel();this.shot=this.q.shift()||null;this.t0=now();this.cut=true;if(this.shot&&this.shot.slow)this.slowT=this.shot.slow;if(!this.q.length)this.pri=0},
 /* ---- the camera never goes into the ground, the sea, a building, a tree, a hull or a man ---- */
 H:{hq:11,shed:6.8,fob:3.4,sam:5,tel:5,tower:10.5,barracks:6.5,hangar:9.5,comm:31,dump:4.5,dome:9.5,ruin:5,wreck:3.2,lamp:7.5,hedgehog:2.2,wire:1.6,revet:2.8,radar:6.5,gun:4.2,truck:4,rock:3.2,heli:4.5},
 /* thin uprights the lens must not stand right behind: street lamps, floodlights, flag poles, the lamps on the piers ([x, z, top]) */
 poles(){const t=now();if(this.poleL&&t-this.poleT<3000)return this.poleL;const L=[];
  if(window.NAV&&NAV.ready)for(const sh of NAV.statics)if(sh.t==='c'&&(sh.tag==='lamp'||sh.tag==='flag'||(sh.tag==='fob'&&sh.r<.3)))L.push([sh.x,sh.z,this.gy(sh.x,sh.z)+(sh.tag==='lamp'?6.6:sh.tag==='flag'?4.2:7.2)]);
  const E5=WORLD.env5;if(E5&&E5.port)for(const k in E5.port){const h=E5.port[k];if(h&&h.poles)for(const q of h.poles)L.push(q)}
  this.poleT=t;return this.poleL=L},
 treeIndex(){if(this.trees)return this.trees;const T=new Map(),L=WORLD.treeL||[];for(const t of L){const k=Math.floor(t.x/12)+','+Math.floor(t.z/12);if(!T.has(k))T.set(k,[]);T.get(k).push(t)}return this.trees=T},
 safe(P,T,dt,cut){
  /* a pole close to the lens never splits the picture down the middle: like a camera operator, the camera side-steps until the pole
     stands on a third of the frame (the closer the pole, the smaller the step), and eases back once it has passed */
  {const vx=T.x-P.x,vz=T.z-P.z,vl=Math.hypot(vx,vz);let want=0;if(vl>3){const ux=vx/vl,uz=vz/vl;
    for(const p of this.poles()){if(P.y>p[2]+2)continue;const rx=p[0]-P.x,rz=p[1]-P.z,a=rx*ux+rz*uz;if(a<.4||a>16||a>vl-1)continue;
     const d=rz*ux-rx*uz,g=(.26*a*Math.min(1,(16-a)/4)-Math.abs(d))/Math.max(.35,1-a/vl);if(g>Math.abs(want))want=d>0?-g:g}   // the step turns the view too: allow for it
    this.step=cut?want:this.step+(want-this.step)*Math.min(1,dt*2.5);P.x-=uz*this.step;P.z+=ux*this.step}else this.step=0}
  let need=this.gy(P.x,P.z)+1.1;
  if(window.NAV&&NAV.ready)for(const sh of NAV.statics){const h=this.H[sh.tag];if(!h||P.y>h+3)continue;const b=NAV.bounds(sh);if(P.x<b[0]-2||P.x>b[2]+2||P.z<b[1]-2||P.z>b[3]+2)continue;if(NAV.inShape(sh,P.x,P.z,sh.tag==='fob'&&sh.t==='b'&&sh.hx>1.3?1.2:.9)){const top=(sh.tag==='fob'&&sh.t==='b'&&sh.hx>1.3?9.5:h)+this.gy(P.x,P.z)+1.2;if(top>need)need=top}}
  const TI=this.treeIndex(),cx=Math.floor(P.x/12),cz=Math.floor(P.z/12);for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++){const c=TI.get((cx+i)+','+(cz+j));if(!c)continue;for(const t of c){const r=t.r+1;if((t.x-P.x)*(t.x-P.x)+(t.z-P.z)*(t.z-P.z)<r*r){const top=t.y+t.h+1.5;if(top>need&&P.y<top+2)need=top}}}
  for(const k in ARMY.sides){const S=ARMY.sides[k].shed;if(S&&Math.abs(P.x-S.x)<S.hw+1.4&&P.z<S.door+1.4&&P.z>S.door-16){const top=this.gy(S.x,S.door-7)+7.6;if(top>need)need=top}}   // the sheds, roof and all
  const E5=WORLD.env5;if(E5)for(const sp of E5.ships){const g=sp.g.position,L=(sp.g.userData.len||40)*(sp.g.scale.x||1)*.55+3;if(Math.abs(g.x-P.x)<L&&Math.abs(g.z-P.z)<L&&NAV.inBox(P.x,P.z,g.x,g.z,sp.hd||0,L,L*.2+3,0)){const top=-1.15+16*(sp.g.scale.x||1);if(top>need)need=top}}   // ships
  if(window.GFX6&&GFX6.cv)for(const k in GFX6.cv){const c=GFX6.cv[k];if(!c||!c.g)continue;const g=c.g.position;if(NAV.inBox(P.x,P.z,g.x,g.z,c.g.rotation.y,58,16,0)){const top=-1.15+30;if(top>need)need=top}}   // carriers
  for(const o of ARMY.movers()){const b=ARMY.VB[o.tier];if(NAV.inBox(P.x,P.z,o.x,o.z,o.hd,b[0],b[1],1.4)){const top=ARMY.gy(o.x,o.z)+(o.tier===2?6:4.6);if(top>need)need=top}}
  for(const k in ARMY.sides)for(const s of ARMY.sides[k].sold){if(Math.abs(s.x-P.x)<.9&&Math.abs(s.z-P.z)<.9&&s.st!==ST.DIE){const top=ARMY.gy(s.x,s.z)+2.6;if(top>need)need=top}}
  /* nothing of the ground between the camera and what it looks at */
  for(let i=1;i<6;i++){const f=i/6,x=P.x+(T.x-P.x)*f,z=P.z+(T.z-P.z)*f,y=P.y+(T.y-P.y)*f,g=this.gy(x,z)+.6;if(y<g){const lift=(g-y)/(1-f);if(P.y+lift>need)need=P.y+lift}}
  const want=Math.max(0,need-P.y);this.lift=cut?want:this.lift+(want-this.lift)*Math.min(1,dt*5);if(this.lift<want)this.lift=Math.max(this.lift,want-.25);P.y+=this.lift},
 /* ---- one frame ---- */
 frame(dtr){const t=now();if(this.hold==null&&(!this.shot||t-this.t0>this.shot.dur*1000))this.next();const s=this.shot;if(!s)return null;
  if(s.sat)return {sat:s.sat};
  const u=this.hold!=null?this.hold:Math.min(1,(t-this.t0)/(s.dur*1000)),P=s.P(u,dtr),T=s.T(u,dtr);if(!P||!T)return null;
  const cut=this.cut;this.cut=false;if(this.slowT&&u>=this.slowT[0]){DIRECTOR.slowmo(this.slowT[1],this.slowT[2]);this.slowT=null}
  this.P.copy(P);this.T.copy(T);this.safe(this.P,this.T,dtr,cut);this.fov=s.fov||46;
  if(this.P.y-this.gy(this.P.x,this.P.z)<7){const k=t/1000;this.T.x+=Math.sin(k*1.7)*.12;this.T.y+=Math.sin(k*2.3+1)*.08;this.T.z+=Math.sin(k*1.3+2)*.12}   // hand-held near the ground
  const lb=WORLD.frontLbl;if(lb)lb.material.opacity=clamp((lb.position.distanceTo(this.P)-18)/22,0,1);
  return {P:this.P,T:this.T,fov:this.fov,cut}}};
/* what an army's sensors see coming: the other side's aircraft and missiles in the air (radars, searchlights and the SAM site work from it) */
const THREATS={list(side){const out=[];for(const a of FX.air||[])if(a.on&&a.side!==side&&a.g&&a.g.visible&&a.g.position.y>4)out.push(a.g.position);const A4=window.GFX4&&GFX4.air;if(A4&&A4.ready)for(const m of A4.M)if(m.on&&m.side!==side&&m.kind!=='I')out.push(m.pos);return out},
 nearest(side,x,z,r){let b=null,bd=(r||400)*(r||400);for(const p of this.list(side)){const d=(p.x-x)*(p.x-x)+(p.z-z)*(p.z-z);if(d<bd){bd=d;b=p}}return b}};
const DIRECTOR={punchV:0,lbx:false,mode:PREF.cam||'orbit',yaw:0,pitch:.38,dist:74,T:new THREE.Vector3(0,0,-4),P:new THREE.Vector3(0,70,100),lookT:new THREE.Vector3(),shk:0,ortho:null,slow:null,focusO:null,cine:null,userT:0,drag:null,pinch:null,lastInteract:0,
 init(){const c=$('#gl');this.ortho=new THREE.OrthographicCamera(-100,100,60,-60,1,600);
  c.addEventListener('pointerdown',e=>{if(e.button!==0&&e.pointerType==='mouse')return;this.drag={x:e.clientX,y:e.clientY,yaw:this.yaw,pitch:this.pitch,id:e.pointerId};this.ptrs=this.ptrs||new Map();this.ptrs.set(e.pointerId,[e.clientX,e.clientY]);if(this.ptrs.size===2){const a=[...this.ptrs.values()];this.pinch={d:Math.hypot(a[0][0]-a[1][0],a[0][1]-a[1][1]),dist:this.dist};this.drag=null}this.lastInteract=now();try{c.setPointerCapture(e.pointerId)}catch(x){}});
  c.addEventListener('pointermove',e=>{if(this.ptrs&&this.ptrs.has(e.pointerId))this.ptrs.set(e.pointerId,[e.clientX,e.clientY]);if(this.pinch&&this.ptrs&&this.ptrs.size===2){const a=[...this.ptrs.values()];const d=Math.hypot(a[0][0]-a[1][0],a[0][1]-a[1][1]);this.dist=clamp(this.pinch.dist*this.pinch.d/Math.max(1,d),24,170);return}
   if(this.drag&&this.drag.id===e.pointerId){const dx=e.clientX-this.drag.x,dy=e.clientY-this.drag.y;if(Math.abs(dx)+Math.abs(dy)>3){this.yaw=clamp(this.drag.yaw+dx*.004,-1.1,1.1);this.pitch=clamp(this.drag.pitch-dy*.003,.22,1.25);this.lastInteract=now();if(this.mode==='cine')CINE.reset()}}
   else HUD.hover(e)});
  const up=e=>{if(this.ptrs)this.ptrs.delete(e.pointerId);if(this.ptrs&&this.ptrs.size<2)this.pinch=null;if(this.drag&&this.drag.id===e.pointerId){if(Math.abs(e.clientX-this.drag.x)+Math.abs(e.clientY-this.drag.y)<=3)HUD.click(e);this.drag=null}};c.addEventListener('pointerup',up);c.addEventListener('pointercancel',up);c.addEventListener('pointerleave',()=>HUD.hover(null));
  c.addEventListener('wheel',e=>{if(!(e.ctrlKey||e.metaKey))return;e.preventDefault();this.zoom(e.deltaY*.06)},{passive:false});this.setMode(this.mode,true)},
 setMode(m,quiet){this.mode=m;PREF.cam=m;savePref();CINE.reset();if(WORLD.frontLbl)WORLD.frontLbl.material.opacity=1;this.focusO=null;if(m!=='cine'&&cam.fov!==46){cam.fov=46;cam.updateProjectionMatrix()}if(m==='follow'){this.dist=Math.min(this.dist,64)}if(m==='tactical'){this.dist=clamp(this.dist,60,160)}if(m==='naval'||m==='space'){this.yaw=0;this.pitch=.38}HUD.cams();if(!quiet)AUDIO.play('ui',{vol:.3})},
 zoom(d){this.dist=clamp(this.dist+d,24,170);this.lastInteract=now()},
 shake(a){if(REDUCED())return;this.shk=Math.min(3.2,this.shk+a)},
 punch(a){if(REDUCED())return;this.punchV=Math.min(9,this.punchV+a*2.4)},
 slowmo(s,dur){if(REDUCED())return;this.slow={s,until:now()+dur*1000}},
 slowTick(dtr){if(this.slow){if(now()>this.slow.until){this.slow=null}else{S.timeScale+=(this.slow.s-S.timeScale)*Math.min(1,dtr*10);return}}S.timeScale+=(1-S.timeScale)*Math.min(1,dtr*3)},
 focus(x,z,dur,opt){if(this.mode==='tactical'||this.mode==='naval'||this.mode==='space'||this.mode==='cine')return;/* (the cinema cuts to big moments itself) */if(this.mode!=='cine'&&now()-this.lastInteract<20000&&!(opt&&opt.force))return;this.focusO={x,z,until:now()+dur*1000,dist:(opt&&opt.dist)||46,pitch:(opt&&opt.pitch)||.42,yaw:this.yaw+rnd(.5,-.5)}},
 /* the camera rides behind a satellite and looks down on the field */
 orbital(side,k,fx){const E5=WORLD.env5,sp=E5.sats[side].g.position,r=Math.hypot(sp.x,sp.z+30)||1,ox=sp.x/r,oz=(sp.z+30)/r;this.P.lerp(new THREE.Vector3(sp.x+ox*30-oz*(this.yaw*14+7),sp.y+9+this.pitch*10,sp.z+oz*30+ox*(this.yaw*14+7)),k);this.T.lerp(new THREE.Vector3(fx*.3,0,-8),k);cam.position.copy(this.P);cam.up.set(0,1,0);cam.lookAt(this.T.x,this.T.y,this.T.z);if(AUDIO.ctx)AUDIO.listener(cam);return cam},
 tick(dt,dtr){const t=now(),fx=VIEW.round?X(VIEW.price||VIEW.round.p0):0;let T,yaw=this.yaw,pitch=this.pitch,dist=this.dist,k=Math.min(1,dtr*2.2);
  if(this.focusO&&t<this.focusO.until){T=new THREE.Vector3(this.focusO.x,0,this.focusO.z);yaw=this.focusO.yaw;pitch=this.focusO.pitch;dist=this.focusO.dist;k=Math.min(1,dtr*3)}
  else{this.focusO=null;if(this.mode==='follow'){T=new THREE.Vector3(fx,0,0);dist=Math.min(dist,72)}
   else if(this.mode==='cine'){const r=CINE.frame(dtr);this.letter(true);if(r&&r.sat&&WORLD.env5)return this.orbital(r.sat,Math.min(1,dtr*1.4),fx);
    if(r&&r.P){if(r.cut){this.P.copy(r.P);this.T.copy(r.T)}else{this.P.lerp(r.P,Math.min(1,dtr*12));this.T.lerp(r.T,Math.min(1,dtr*12))}this.punchV*=Math.pow(.04,dtr);const fv=r.fov+this.punchV;if(Math.abs(cam.fov-fv)>.01){cam.fov=fv;cam.updateProjectionMatrix()}
     this.shk*=Math.pow(.02,dtr);const sh=this.shk*(Math.random()-.5);cam.position.set(this.P.x+sh,this.P.y+sh*.5,this.P.z+sh*.7);cam.up.set(0,1,0);cam.lookAt(this.T.x,this.T.y+sh*.3,this.T.z);if(AUDIO.ctx)AUDIO.listener(cam);return cam}
    T=new THREE.Vector3(fx,0,-4)}
   else if(this.mode==='naval'){T=new THREE.Vector3(0,3,-205);yaw=Math.PI+this.yaw;pitch=clamp(this.pitch-.18,.08,.9);dist=clamp(dist*3.6,150,380)}/* far enough out that both carriers, the destroyers and the frigates share the frame */
   else if(this.mode==='space'&&WORLD.env5){this.letter(false);return this.orbital(S.pressure>=.5?'bull':'bear',Math.min(1,dtr*2),fx)}
   else if(this.mode==='tactical'){T=new THREE.Vector3(fx*.5,0,0)}
   else{T=new THREE.Vector3(fx*.55,0,-4)}}
  this.T.lerp(T,k);
  if(this.mode==='tactical'&&!this.focusO){const o=this.ortho;const s=dist*.62,a=ren.domElement.clientWidth/Math.max(1,ren.domElement.clientHeight);o.left=-s*a;o.right=s*a;o.top=s;o.bottom=-s;o.updateProjectionMatrix();o.position.set(this.T.x,180,this.T.z+.001);o.up.set(0,0,-1);o.lookAt(this.T.x,0,this.T.z);return o}
  const want=new THREE.Vector3(this.T.x+Math.sin(yaw)*Math.cos(pitch)*dist,Math.sin(pitch)*dist+2,this.T.z+Math.cos(yaw)*Math.cos(pitch)*dist);this.P.lerp(want,k);
  this.letter(!!(this.focusO||this.mode==='cine'));
  if(this.punchV>.01||cam.fov!==46){this.punchV*=Math.pow(.04,dtr);cam.fov=46+this.punchV;cam.updateProjectionMatrix()}
  this.shk*=Math.pow(.02,dtr);const sh=this.shk*(Math.random()-.5);cam.position.set(this.P.x+sh,this.P.y+sh*.5,this.P.z+sh*.7);cam.up.set(0,1,0);cam.lookAt(this.T.x,1+sh*.3,this.T.z);
  if(AUDIO.ctx)AUDIO.listener(cam);return cam},
 letter(lb){if(lb!==this.lbx){this.lbx=lb;$('#bf').classList.toggle('lbx',lb);if(WORLD.post)WORLD.post.tilt(lb&&this.mode!=='cine'&&S.quality!=='low'&&S.quality!=='lite',2.4)}},
 /* ---- scenarios ---- */
 scenario(name,o){o=o||{};const r=VIEW.round,E5=window.GFX5&&WORLD.env5?GFX5:null;
  if(name==='win'){const side=o.side;HUD.banner(side==='bulls'?T('bullsWin'):T('bearsWin'),side==='bulls'?'bull':'bear',`${T('newRound')} ${fmtP(VIEW.price)}`);const bx=(side==='bulls'?WORLD.baseR:WORLD.baseB).position.x;for(let i=0;i<6;i++)setTimeout(()=>R3&&FX.explode(bx+rnd(6,-6),rnd(7,-7),2.2,side==='bulls'?0x9af5b0:0xffb0b0),i*170);
   ARMY.cheer(side==='bulls'?'bull':'bear');AUDIO.stinger(side==='bulls'?'major':'minor');HUD.radio('push');this.focus(bx,0,3.2,{dist:52,pitch:.4});CINE.event('win',{bx,pri:5});const loser=side==='bulls'?WORLD.baseR:WORLD.baseB;if(loser&&loser.userData.flag){loser.userData.flag.position.y=8.8;setTimeout(()=>loser.userData.flag.position.y=loser.userData.flagY,20000)}}
  else if(name==='cascade'){HUD.banner(T('cascadeB'),'warn');AUDIO.play('siren',{vol:.6});HUD.radio('cascade');WORLD.cascadeUntil=now()+60000;AUDIO.intensity(1);
   const att=o.side==='long'?'bear':'bull',stx=X(VIEW.price||VIEW.round.p0)+(att==='bull'?8:-8),stz=rnd(20,-20);if(E5&&VIEW.round&&PREF.layers.fx&&E5.naval.sub(att,stx,stz,2,o.usd)){evt(VIEW,{k:'subm',usd:o.usd,p:VIEW.price});AUDIO.play('sonar',{vol:.5});CINE.event('sub',{att,tx:stx,tz:stz,pri:4})}}
  else if(name==='extreme'){HUD.banner(T('extremeB'),'warn')}
  else if(name==='wall'){const x=X(o.p),side=o.side;if(window.GFX4&&GFX4.relay)GFX4.relay(side);ARMY.convoy(side,x);setTimeout(()=>ARMY.convoy(side,x),900);HUD.radio('hold');AUDIO.play('brass',{vol:.5});CINE.event('wall',{side,x,pri:2})}
  else if(name==='pulled'){AUDIO.play('retreat',{x:X(o.p),z:0,vol:.6})}
  else if(name==='convoy'){ARMY.convoy(o.side==='b'?'bull':'bear',X(o.p))}
  else if(name==='fort'){HUD.radio('wall');AUDIO.play('build',{x:X(o.p),z:0,vol:.6})}
  else if(name==='roundNum'){AUDIO.play('horn',{vol:.7});FX.flare(X(o.p),0);HUD.banner(fmtP(o.p),'warn',T('f').roundNum,2200)}
  else if(name==='bigOrder'){const sd=o.side==='buy'?'bull':'bear';if(window.GFX4&&GFX4.relay)GFX4.relay(sd);ARMY.surge(sd);this.focus(X(o.p),0,3,{dist:50,pitch:.4});AUDIO.play('cannon',{x:X(o.p),z:0,vol:.9});
   const ntx=clamp(X(o.p)+(sd==='bull'?3:-3),-72,72),ntz=rnd(28,-28);if(E5&&PREF.layers.fx&&E5.naval.fire(sd,ntx,ntz,o.usd,o.usd>=5e6?4:2)){evt(VIEW,{k:'naval',usd:o.usd,p:o.p});HUD.radio('naval');CINE.event('naval',{side:sd,tx:ntx,tz:ntz,pri:3})}}
  /* the machines answer a sweep of the book: out through the gate, a volley for every level taken */
  else if(name==='sweep'){const sd=o.side==='buy'?'bull':'bear';if(window.GFX6&&PREF.layers.fx&&PREF.layers.units&&GFX6.RB.sweep(sd,X(o.p),o.usd,o.n||4)){HUD.radio('robots');AUDIO.play('servo',{x:sd==='bull'?-62:62,z:0,vol:.5});CINE.event('robots',{side:sd,pri:2})}}
  else if(name==='regime'){WORLD.skyMode();AUDIO.key(o.reg)}
  else if(name==='disc'){HUD.banner(T('discB'),'warn',null,6000);HUD.radio('lost');WORLD.discFog=true;AUDIO.play('static',{vol:.4})}
  else if(name==='recon'){WORLD.discFog=false;AUDIO.play('ui',{vol:.4})}
  /* reconnaissance: one army's satellite sweeps the field and reports what the order book, the tape and the liquidation feeds say right now */
  else if(name==='intel'){const rep=intel(VIEW);if(!rep)return;const by=o.by||(S.intelBy=S.intelBy==='bull'?'bear':'bull'),tg=[];
   if(rep.bid)tg.push({x:X(rep.bid.p),z:0,col:0x4ade80,txt:fmtU(rep.bid.usd)});if(rep.ask)tg.push({x:X(rep.ask.p),z:0,col:0xf87171,txt:fmtU(rep.ask.usd)});
   if(E5&&PREF.layers.fx){E5.scan(by,tg);CINE.event('sat',{side:by,pri:2})}HUD.intel(rep,by);HUD.radio('sat');AUDIO.play('scan',{vol:.5});evt(VIEW,{k:'intel',by});S.intelT=Date.now()}
  void r},
 /* ---- liquidation strikes (4.0): strike value = max(single liquidation, 0.8 x same-side sum of the last 15 s); a cascade bumps one tier; a tier still cooling down falls back one step ---- */
 strike(side,usd,p,cas){if(!VIEW.round||!PREF.layers.fx)return;const att=side==='long'?'bear':'bull',tx=clamp(X(p),-70,70),tz=rnd(30,-30),t=Date.now();
  const sum15=VIEW.liqs.filter(x=>x.side===side&&t-x.t<15000).reduce((a,x)=>a+x.usd,0),v=Math.max(usd,.8*sum15);
  let tier=v<1e4?0:v<5e4?1:v<1.5e5?2:v<5e5?3:v<2e6?4:v<1e7?5:6;if(cas)tier=Math.min(6,tier+1);
  const CD=[0,0,3e3,8e3,15e3,3e4,9e4],last=this.tierT||(this.tierT=[0,0,0,0,0,0,0]);while(tier>1&&t-last[tier]<CD[tier])tier--;last[tier]=t;
  if(tier>=1)setTimeout(()=>CINE.event(['','guns','guns','heli','jets','missile','raid'][tier],{att,tx,tz,pri:tier}),80);
  if(VIEW===L&&PREF.sky==='auto'){const sum5=VIEW.liqs.filter(x=>t-x.t<3e5).reduce((a,x)=>a+x.usd,0);if(sum5>=1e7&&!(S.nightUntil>t)){S.nightUntil=t+18e4;WORLD.skyMode()}}
  const A4=window.GFX4&&GFX4.air.ready?GFX4.air:null;
  const E5=window.GFX5&&WORLD.env5?GFX5:null;
  if(tier===0){if(!(E5&&E5.fpv(att,tx,tz)))FX.explode(tx,tz,.7,0xffc070);return}if(tier===1){ARMY.gunFire(att,tx,tz,usd);return}if(tier===2){ARMY.gunFire(att,tx,tz,1e6);ARMY.rocketFire(att,tx,tz,usd);return}
  HUD.radio('incoming');if(window.GFX4)GFX4.say('air');
  if(tier===3){FX.heli(att,tx,tz,usd);setTimeout(()=>R3&&FX.heli(att,clamp(tx+rnd(8,-8),-70,70),clamp(tz+rnd(14,-14),-34,34),usd),700);ARMY.rocketFire(att,tx,tz,usd);this.focus(tx,tz,6,{dist:56,pitch:.38});evt(VIEW,{k:'heli',usd,p});return}
  const E6=window.GFX6&&E5&&GFX6.cv[att]?GFX6:null,fly=(n,ms)=>{if(E6&&E6.sortie(att,tx,tz,n,usd)){HUD.radio('sortie');return true}if(A4)A4.formation(att,tx,tz,n,usd,ms);return false};
  if(tier===4){if(A4){fly(2,0);if(E5)A4.after(1600,()=>{if(E5.naval.cruise(att,tx,tz,2)){HUD.radio('cruise');GFX4.say('cruise')}});else A4.cruise(att,tx,tz,2,1600)}else FX.jet(att,tx,tz,usd);this.focus(tx,tz,6,{dist:60,pitch:.3,force:true});evt(VIEW,{k:'bomb',usd,p});return}
  if(tier>=5&&A4&&A4.strike&&window.GFX4)A4.after(2600,()=>{const def=att==='bull'?'bear':'bull',T=GFX4.LAY.items.filter(i=>i.side===def&&['dump','yard','hangar','barracks','comm','dome','tel','sam'].includes(i.k));const it=T[Math.floor(Math.random()*T.length)];if(it){A4.strike(att,it.x,it.z,usd,it);HUD.radio('missile')}});
  if(tier===5){if(A4){A4.ballistic(att,tx,tz,E5?3:4,usd);fly(3,3200);if(E5&&E5.naval.sub(att,tx,tz,1,usd))evt(VIEW,{k:'subm',usd,p})}else FX.jet(att,tx,tz,usd);this.focus(tx,tz,8,{dist:74,pitch:.34,force:true});setTimeout(()=>this.slowmo(.3,1.6),6200);evt(VIEW,{k:'missile',usd,p});return}
  HUD.radio('raid');if(window.GFX4)GFX4.say('raid');AUDIO.play('siren',{vol:.7});
  if(A4){fly(5,1800);if(E5){A4.after(3400,()=>{E5.naval.cruise(att,tx,tz,6);HUD.radio('cruise')});E5.naval.fire(att,tx,tz,usd,4);if(E5.naval.sub(att,tx,tz,3,usd))evt(VIEW,{k:'subm',usd,p})}else A4.cruise(att,tx,tz,6,3400);A4.ballistic(att,tx,tz,2,usd,1000)}
  FX.bomber(att,tx,tz,usd);this.focus(tx,tz,12,{dist:92,pitch:.35,force:true});this.scenario('extreme');evt(VIEW,{k:'extreme',usd,p})}};
/* ======================= replay (last 15 minutes, in this browser) ======================= */
const REPLAY={on:false,cur:0,speed:1,playing:true,idx:0,span:null,
 enter(){const sp=REC.span();if(!sp||sp[1]-sp[0]<5000){HUD.toast(T('rpNone'));return}this.on=true;this.span=sp;RP=newModel();VIEW=RP;S.feedRP=[];this.speed=1;this.playing=true;this.seek(Math.max(sp[0],sp[1]-60000));HUD.replay(true);AUDIO.play('ui',{vol:.3})},
 exit(){if(!this.on)return;this.on=false;RP=null;VIEW=L;FX.clear();ARMY.clear();L.armT=0;if(L.round){WORLD.markers();computeBook(L);bookView(L);HUD.round();HUD.price(L)}HUD.feed();HUD.replay(false);S.timeScale=1},
 seek(t){const sp=REC.span();if(!sp)return;this.cur=clamp(t,sp[0],sp[1]);const snap=[...REC.snaps].reverse().find(s=>s.t<=this.cur)||REC.snaps[0];const M=RP;FX.clear();ARMY.clear();M.bids=new Map();M.asks=new Map();M.trades=[];M.liqs=[];M.walls=new Map();M.first=new Map();M.prev=new Map();
  if(snap){M.UN=snap.UN;M.step=snap.step;M.round={p0:snap.p0,low:snap.low,high:snap.high,R:snap.R,t:snap.t};M.scale=60/snap.R;M.price=snap.price;M.open=snap.open;const bw=snap.step/5;snap.b.forEach(([k,u])=>{const p=(k+.5)*bw;M.bids.set(p,u/p)});snap.a.forEach(([k,u])=>{const p=(k+.5)*bw;M.asks.set(p,u/p)});snap.walls.forEach(([k,t,usd,p,fort])=>M.walls.set(k,{t,usd,p,fort}))}
  this.idx=REC.ev.findIndex(e=>e.t>(snap?snap.t:0));if(this.idx<0)this.idx=REC.ev.length;
  /* fast-forward silently from the snapshot to the cursor (price + rounds only) */
  for(;this.idx<REC.ev.length&&REC.ev[this.idx].t<=this.cur;this.idx++){const e=REC.ev[this.idx];if(e.k==='px')M.price=e.p;else if(e.k==='round'){M.round={p0:e.p0,low:e.low,high:e.high,R:e.R,t:e.t};M.step=e.step;M.scale=60/e.R}}
  if(!M.round&&M.price)newRound(M,M.price);if(M.round){WORLD.markers();computeBook(M);bookView(M);HUD.round();HUD.price(M)}S.feedRP=REC.ev.filter(e=>e.t<=this.cur&&e.k!=='px'&&e.k!=='tr'&&e.k!=='round').slice(-40).reverse();HUD.feed()},
 tick(dtr){if(!this.on)return;HUD.replayPos();if(!this.playing)return;const prev=this.cur;this.cur+=dtr*1000*this.speed;const sp=REC.span();if(sp&&this.cur>=sp[1]){this.cur=sp[1];this.playing=false;HUD.replay(true)}
  const M=RP;for(;this.idx<REC.ev.length&&REC.ev[this.idx].t<=this.cur;this.idx++){const e=REC.ev[this.idx];
   if(e.k==='px')onPrice(M,e.p,e.t);else if(e.k==='tr'){M.trades.push({t:e.t,usd:e.usd,sell:!!e.s,p:e.p});if(M.trades.length>400)M.trades.shift();FX.trade(e.s?'sell':'buy',e.usd,e.p)}
   else if(e.k==='round'){M.round={p0:e.p0,low:e.low,high:e.high,R:e.R,t:e.t};M.step=e.step;M.scale=60/e.R;WORLD.markers();HUD.round();ARMY.reform()}
   else if(e.k==='liqL'||e.k==='liqS'){M.liqs.push({t:e.t,usd:e.usd,side:e.side});evt(M,Object.assign({},e));DIRECTOR.strike(e.side,e.usd,e.p,e.cas)}
   else if(e.k==='win'){evt(M,Object.assign({},e));DIRECTOR.scenario('win',{side:e.side})}
   else if(/^(big|huge)/.test(e.k)){M.trades.push({t:e.t,usd:e.usd,sell:e.side==='sell',p:e.p});FX.trade(e.side,e.usd,e.p);evt(M,Object.assign({},e))}
   else evt(M,Object.assign({},e))}
  /* book snapshots inside the window */
  const sn=REC.snaps.find(s=>s.t>prev&&s.t<=this.cur);if(sn){const bw=sn.step/5;M.bids=new Map();M.asks=new Map();sn.b.forEach(([k,u])=>{const p=(k+.5)*bw;M.bids.set(p,u/p)});sn.a.forEach(([k,u])=>{const p=(k+.5)*bw;M.asks.set(p,u/p)});computeBook(M);bookView(M)}}};
/* ======================= main loop ======================= */
let lastF=0,fpsN=0,fpsT=0,fpsDone=false,fpsLow=0;   /* fpsLow: slow 5-second windows in a row; one hitch alone never lowers a chosen quality */
function loop(ts){requestAnimationFrame(loop);if(!R3||document.hidden)return;const raw=Math.min(2,(ts-lastF)/1000||0),dtr=Math.min(.1,raw);lastF=ts;/* raw: real seconds, so frame-rate checks see a slide show as it is */DIRECTOR.slowTick(dtr);const dt=dtr*S.timeScale;U.t+=dt;if(U.anim)U.anim.value=U.t;
 if(L.sw&&Date.now()-L.sw.at>180)sweepEnd(L);REPLAY.tick(dtr);WORLD.tick(dt,U.t);if(VIEW.round&&PREF.layers.units&&VIEW.bk.b.length+VIEW.bk.a.length)ARMY.update(VIEW);ARMY.tick(dt);ARMY.tickGuns(dt);FX.tick(dt);if(window.GFX6)GFX6.tick(dt,U.t);
 const fx=VIEW.round?X(VIEW.price||VIEW.round.p0):0;WORLD.front.position.x+=(fx-WORLD.front.position.x)*Math.min(1,dt*6);WORLD.frontLbl.position.x=WORLD.front.position.x;
 const c=DIRECTOR.tick(dt,dtr);if(WORLD.postOn)WORLD.post.render(c,dtr);else ren.render(scene,c);
 if(raw>.5){fpsN=0;fpsT=0}else{fpsN++;fpsT+=raw}   /* a single long stall (the shaders being rebuilt after a quality change, a busy machine) is not a frame rate: it restarts the window instead of dragging the quality down step after step */
 if(fpsT>5){const fps=fpsN/fpsT;S.fps=fps;fpsN=0;fpsT=0;/* rescue: a picture slower than 12 frames a second is a slide show, whatever quality was chosen (an "ultra" saved on a machine without a
     graphics driver gave one frame a second): step down a tier and hand the choice back to auto */
   fpsLow=fps<12?fpsLow+1:0;if(fpsLow>=3&&PREF.quality!=='auto'&&S.quality!=='lite'){fpsLow=0;const dn={ultra:'high',high:'low',low:'lite'}[S.quality]||'lite';PREF.quality='auto';savePref();fpsDone=false;const qs=$('#qSel');if(qs)qs.value='auto';WORLD.setQuality(dn);HUD.toast('⚙ '+(T('qOpts')[dn]||dn))}
   else if(PREF.quality==='auto'&&!fpsDone){if(fps<12&&S.quality==='ultra'){WORLD.setQuality('high')}else if(fps<42&&S.quality==='high'){WORLD.setQuality('low');HUD.toast('⚙ '+T('qOpts').low)}else if(fps<26&&S.quality==='low'){WORLD.setQuality('lite');HUD.toast('⚙ '+T('qOpts').lite)}else if(!(fps<26&&S.quality==='high'))fpsDone=true}if(WORLD.soft&&PREF.quality==='auto')WORLD.govern(fps)}}
/* ======================= audio: synthesized, spatial, dynamic ======================= */
const mtof=m=>440*Math.pow(2,(m-69)/12);
const AUDIO={ctx:null,on:!!PREF.snd,bus:{},voices:0,I:0,follow:[],amb:null,music:{on:!!PREF.music,key:'major',bar:0,next:0,timer:null,nodes:[]},wx:0,
 init(){if(this.ctx)return;const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;const C=new AC();this.ctx=C;this.master=C.createGain();this.mf=C.createBiquadFilter();this.mf.type='lowpass';this.mf.frequency.value=20000;this.comp=C.createDynamicsCompressor();this.comp.threshold.value=-10;this.comp.ratio.value=4;this.comp.attack.value=.003;this.comp.release.value=.25;
  this.lim=C.createDynamicsCompressor();this.lim.threshold.value=-2;this.lim.knee.value=0;this.lim.ratio.value=20;this.lim.attack.value=.001;this.lim.release.value=.12;this.master.connect(this.mf).connect(this.comp).connect(this.lim).connect(C.destination);this.dk={};for(const b of ['music','sfx','amb','voice']){const g=C.createGain(),d=C.createGain();g.connect(d).connect(this.master);this.bus[b]=g;this.dk[b]=d}this.setVols();/* battlefield space: a generated 2.6 s stereo impulse response, fed from effects + ambience */try{const n=Math.floor(C.sampleRate*2.6),ir=C.createBuffer(2,n,C.sampleRate);for(let ch=0;ch<2;ch++){const d=ir.getChannelData(ch);let lp=0;for(let i=0;i<n;i++){const t=i/n;lp=lp*.6+(Math.random()*2-1)*.4;d[i]=i<C.sampleRate*.015?0:lp*Math.pow(1-t,3.4)*(1+.3*Math.sin(i*.0007*(ch+1)))}}this.rev=C.createConvolver();this.rev.buffer=ir;this.revG=C.createGain();this.revG.gain.value=.26;this.bus.sfx.connect(this.rev);const ag=C.createGain();ag.gain.value=.4;this.bus.amb.connect(ag).connect(this.rev);this.rev.connect(this.revG).connect(this.master)}catch(e){}
  this.nz={};this.ambience();if(this.music.on)this.startMusic()},
 /* a big blast pulls the music and the ambience down for a moment, the way a film mix makes room for it */
 duck(a,dur){if(!this.ctx||!this.dk)return;const t=this.ctx.currentTime;for(const b of ['music','amb']){const p=this.dk[b].gain;p.cancelScheduledValues(t);p.setValueAtTime(p.value,t);p.linearRampToValueAtTime(Math.max(.2,1-a),t+.03);p.setTargetAtTime(1,t+.1,dur)}},
 setVols(){if(!this.ctx)return;const v=PREF.vol;this.master.gain.value=v.master;this.bus.music.gain.value=v.music;this.bus.sfx.gain.value=v.sfx;this.bus.amb.gain.value=v.amb;this.bus.voice.gain.value=v.voice},
 enable(on){this.on=on;PREF.snd=on;ls.set('ek_bf_snd',on);savePref();if(on){this.init();if(this.ctx&&this.ctx.state==='suspended')this.ctx.resume();this.play('ui',{vol:.4})}else if(this.ctx){this.ctx.suspend()}},
 setMusic(on){this.music.on=on;PREF.music=on;savePref();if(!this.ctx)return;if(on)this.startMusic();else this.stopMusic()},
 noise(kind){if(this.nz[kind])return this.nz[kind];const C=this.ctx,n=C.sampleRate*2,b=C.createBuffer(1,n,C.sampleRate),d=b.getChannelData(0);let last=0;for(let i=0;i<n;i++){const w=Math.random()*2-1;if(kind==='brown'){last=(last+.02*w)/1.02;d[i]=last*3.5}else d[i]=w}this.nz[kind]=b;return b},
 src(kind,rate){const C=this.ctx,s=C.createBufferSource();s.buffer=this.noise(kind||'white');s.loop=true;if(rate)s.playbackRate.value=rate;return s},
 env(g,t0,a,peak,d,sus,r,end){const p=g.gain;p.cancelScheduledValues(t0);p.setValueAtTime(.0001,t0);p.linearRampToValueAtTime(peak,t0+a);if(sus!=null){p.exponentialRampToValueAtTime(Math.max(.0001,sus),t0+a+d);p.setValueAtTime(Math.max(.0001,sus),end-r)}p.exponentialRampToValueAtTime(.0001,end)},
 out(o,bus){const C=this.ctx;let n=C.createGain();n.gain.value=1;if(o&&o.x!==undefined){const p=C.createPanner();p.panningModel='HRTF';p.distanceModel='inverse';p.refDistance=22;p.maxDistance=400;p.rolloffFactor=1.1;p.positionX.value=o.x;p.positionY.value=o.y||2;p.positionZ.value=o.z||0;n.connect(p).connect(this.bus[bus||'sfx']);if(o.follow)this.follow.push({p,o:o.follow,until:C.currentTime+(o.dur||5)})}else n.connect(this.bus[bus||'sfx']);return n},
 listener(cam){const C=this.ctx,l=C.listener,f=new THREE.Vector3(0,0,-1).applyQuaternion(cam.quaternion),u=new THREE.Vector3(0,1,0).applyQuaternion(cam.quaternion);if(l.positionX){l.positionX.value=cam.position.x;l.positionY.value=cam.position.y;l.positionZ.value=cam.position.z;l.forwardX.value=f.x;l.forwardY.value=f.y;l.forwardZ.value=f.z;l.upX.value=u.x;l.upY.value=u.y;l.upZ.value=u.z}else{l.setPosition(cam.position.x,cam.position.y,cam.position.z);l.setOrientation(f.x,f.y,f.z,u.x,u.y,u.z)}
  this.lpos=cam.position;const t=C.currentTime,cp=cam.position,air=window.GFX4&&GFX4.airHz;this.follow=this.follow.filter(f=>{if(t>f.until)return false;const a=f.o;if(a.wx!==undefined){const y=a.g?a.g.position.y:4;f.p.positionX.value=a.wx;f.p.positionZ.value=a.wz;f.p.positionY.value=y;
   if(f.lp&&air){const dx=a.wx-cp.x,dy=y-cp.y,dz=a.wz-cp.z,d=Math.sqrt(dx*dx+dy*dy+dz*dz),dt=t-f.t;f.lp.frequency.setTargetAtTime(air(d),t,.08);
    if(f.dp.length&&dt>.004){const dd=d-f.d0;if(Math.abs(dd)<45){const c=clamp(1200*Math.log2(520/(520+clamp(dd/dt,-400,400))),-650,650);f.dc=f.dc==null?c:f.dc+(c-f.dc)*.3;for(const q of f.dp)q.setTargetAtTime(f.dc,t,.06)}}f.d0=d;f.t=t}}return true})},
 play(name,o){o=o||{};if(!this.on||!this.ctx)return;if(this.ctx.state==='suspended'){this.ctx.resume();return}const C=this.ctx,t0=C.currentTime+(o.delay||0),v=o.vol==null?.8:o.vol;if(this.voices>=24&&!/nuke|siren|stinger/.test(name))return;this.voices++;if(window.GFX4&&GFX4.SFX[name]){GFX4.SFX[name](this,o);return}
  const done=(n,end)=>{setTimeout(()=>this.voices=Math.max(0,this.voices-1),(end-C.currentTime)*1000+50)};
  const osc=(type,f,g,t1,t2)=>{const s=C.createOscillator();s.type=type;s.frequency.setValueAtTime(f,t1);s.connect(g);s.start(t1);s.stop(t2);return s};
  if(name==='gun'){const g=this.out(o),f=C.createBiquadFilter();f.type='bandpass';f.frequency.value=1600+Math.random()*800;f.Q.value=.7;const s=this.src('white');s.connect(f).connect(g);this.env(g,t0,.004,v*.9,.06,null,0,t0+.09);s.start(t0);s.stop(t0+.1);const k=C.createGain();k.connect(g);osc('square',2600,k,t0,t0+.012);this.env(k,t0,.001,v*.4,.01,null,0,t0+.012);done(0,t0+.1)}
  else if(name==='tank'||name==='cannon'){const big=name==='cannon',g=this.out(o),f=C.createBiquadFilter();f.type='lowpass';f.frequency.setValueAtTime(big?500:700,t0);f.frequency.exponentialRampToValueAtTime(80,t0+(big?.5:.3));const s=this.src('white');s.connect(f).connect(g);this.env(g,t0,.005,v,(big?.5:.3),null,0,t0+(big?.7:.4));s.start(t0);s.stop(t0+.8);
   const k=C.createGain();k.connect(g);const b=osc('sine',big?60:80,k,t0,t0+.7);b.frequency.exponentialRampToValueAtTime(28,t0+.6);this.env(k,t0,.004,v*1.1,.5,null,0,t0+.7);done(0,t0+.8)}
  else if(name==='explosion'||name==='nuke'){const nuke=name==='nuke',sz=nuke?7:(o.size||1),g=this.out(o),f=C.createBiquadFilter();f.type='lowpass';const d=nuke?3.5:.9+sz*.35;const ts=nuke?t0+.3:t0;f.frequency.setValueAtTime(nuke?900:1500,ts);f.frequency.exponentialRampToValueAtTime(nuke?25:55,ts+d);const s=this.src('white');s.connect(f).connect(g);this.env(g,ts,.006,Math.min(1.4,v*(nuke?1.4:.7+sz*.2)),d,null,0,ts+d+.2);s.start(ts);s.stop(ts+d+.3);
   const k=C.createGain();k.connect(g);const b=osc('sine',nuke?30:42,k,ts,ts+d);b.frequency.exponentialRampToValueAtTime(nuke?18:24,ts+d*.8);this.env(k,ts,.01,v*(nuke?1.3:.9),d*.7,null,0,ts+d);
   if(sz>=1.2)for(let i=0;i<3;i++){const c=C.createGain();c.connect(g);const cs=this.src('white');const cf=C.createBiquadFilter();cf.type='bandpass';cf.frequency.value=800+Math.random()*2000;cs.connect(cf).connect(c);const tc=ts+.15+Math.random()*d*.6;this.env(c,tc,.003,v*.3,.05,null,0,tc+.07);cs.start(tc);cs.stop(tc+.08)}
   if(nuke){this.mf.frequency.setValueAtTime(20000,t0);this.mf.frequency.setValueAtTime(380,ts);this.mf.frequency.exponentialRampToValueAtTime(20000,ts+2.6);const r=C.createGain();r.connect(this.bus.sfx);osc('sine',3200,r,ts,ts+2.6);this.env(r,ts,.02,v*.12,2,null,0,ts+2.6)}done(0,ts+d+.3)}
  else if(name==='rocket'){const g=this.out(o),f=C.createBiquadFilter();f.type='bandpass';f.Q.value=1.2;f.frequency.setValueAtTime(1400,t0);f.frequency.exponentialRampToValueAtTime(260,t0+1.1);const s=this.src('white',1.4);s.playbackRate.exponentialRampToValueAtTime(.55,t0+1.2);s.connect(f).connect(g);this.env(g,t0,.03,v*.6,1,null,0,t0+1.2);s.start(t0);s.stop(t0+1.25);done(0,t0+1.3)}
  else if(name==='heli'||name==='bomber'||name==='engine'){const dur=o.dur||6,g=this.out(o),f=C.createBiquadFilter();f.type='lowpass';f.frequency.value=name==='heli'?420:260;const s=this.src('brown');s.connect(f).connect(g);const m=C.createGain();m.gain.value=.5;const lfo=osc('sine',name==='heli'?11.5:name==='bomber'?5:9,m.gain,t0,t0+dur);void lfo;const am=C.createGain();am.gain.value=.5;f.connect(am);m.connect(am.gain);am.connect(g);
   this.env(g,t0,.6,v*.8,dur-1.2,v*.8,.8,t0+dur);s.start(t0);s.stop(t0+dur);const k=C.createGain();k.connect(g);osc(name==='engine'?'sawtooth':'sine',name==='heli'?34:name==='bomber'?52:44,k,t0,t0+dur);this.env(k,t0,.5,v*.5,dur-1,v*.5,.7,t0+dur);done(0,t0+dur)}
  else if(name==='jet'){const dur=o.dur||3.2,g=this.out(o),f=C.createBiquadFilter();f.type='lowpass';f.frequency.setValueAtTime(5000,t0);f.frequency.exponentialRampToValueAtTime(600,t0+dur);const h=C.createBiquadFilter();h.type='highpass';h.frequency.value=600;const s=this.src('white',1.5);s.playbackRate.exponentialRampToValueAtTime(.6,t0+dur);s.connect(h).connect(f).connect(g);this.env(g,t0,dur*.35,v,dur*.3,v*.5,dur*.3,t0+dur);s.start(t0);s.stop(t0+dur);done(0,t0+dur)}
  else if(name==='whistle'){const g=this.out(o);const s=osc('sine',1900,g,t0,t0+1.1);s.frequency.exponentialRampToValueAtTime(380,t0+1.05);this.env(g,t0,.05,v*.3,.9,null,0,t0+1.1);done(0,t0+1.1)}
  else if(name==='siren'){const g=this.out(o,'voice');const s=osc('triangle',600,g,t0,t0+3);for(let i=0;i<3;i++){s.frequency.linearRampToValueAtTime(1200,t0+i+.5);s.frequency.linearRampToValueAtTime(600,t0+i+1)}this.env(g,t0,.1,v*.35,2.6,v*.3,.3,t0+3);done(0,t0+3)}
  else if(name==='horn'||name==='brass'){const g=this.out(o),f=C.createBiquadFilter();f.type='lowpass';f.frequency.value=name==='horn'?1400:900;f.connect(g);const ns=name==='horn'?[55,62,67]:[43,50,55,62];ns.forEach(n=>{osc('sawtooth',mtof(n),f,t0,t0+(name==='horn'?1:1.6));osc('sawtooth',mtof(n)*1.004,f,t0,t0+(name==='horn'?1:1.6))});this.env(g,t0,name==='horn'?.05:.3,v*.22,.6,v*.15,.3,t0+(name==='horn'?1:1.6));done(0,t0+1.6)}
  else if(name==='retreat'){const g=this.out(o);[660,520,380].forEach((f,i)=>{osc('triangle',f,g,t0+i*.2,t0+i*.2+.18)});this.env(g,t0,.02,v*.3,.5,null,0,t0+.62);done(0,t0+.7)}
  else if(name==='build'){const g=this.out(o);for(let i=0;i<4;i++){const tt=t0+i*.17;const s=this.src('white'),f=C.createBiquadFilter();f.type='bandpass';f.frequency.value=3200;const k=C.createGain();s.connect(f).connect(k).connect(g);this.env(k,tt,.002,v*.5,.03,null,0,tt+.05);s.start(tt);s.stop(tt+.06)}done(0,t0+.8)}
  else if(name==='static'||name==='radio'){const g=this.out(o,'voice'),f=C.createBiquadFilter();f.type='bandpass';f.frequency.value=1500;f.Q.value=1.6;const s=this.src('white');s.connect(f).connect(g);this.env(g,t0,.01,v*.5,.1,null,0,t0+.16);s.start(t0);s.stop(t0+.17);const k=C.createGain();k.connect(this.bus.voice);osc('sine',1050,k,t0+.18,t0+.26);this.env(k,t0+.18,.005,v*.25,.05,null,0,t0+.26);
   if(name==='radio'){for(let i=0;i<5;i++){const tt=t0+.32+i*.14+Math.random()*.05;const b=C.createGain();b.connect(g);const bs=this.src('brown');const bf=C.createBiquadFilter();bf.type='bandpass';bf.frequency.value=500+Math.random()*900;bf.Q.value=3;bs.connect(bf).connect(b);this.env(b,tt,.01,v*.35,.06,null,0,tt+.1);bs.start(tt);bs.stop(tt+.11)}}done(0,t0+1.2)}
  else if(name==='thunder'){const g=this.out(o,'amb'),f=C.createBiquadFilter();f.type='lowpass';f.frequency.setValueAtTime(220,t0);f.frequency.exponentialRampToValueAtTime(60,t0+2.4);const s=this.src('brown');s.connect(f).connect(g);this.env(g,t0,.08,v*.9,2.2,null,0,t0+2.6);s.start(t0);s.stop(t0+2.7);done(0,t0+2.7)}
  else if(name==='ui'){const g=this.out(o);osc('sine',880,g,t0,t0+.05);this.env(g,t0,.004,v*.2,.04,null,0,t0+.05);done(0,t0+.06)}
  else if(name==='stinger'){this.voices--;return}
  else{this.voices--}},
 stinger(kind){if(!this.on||!this.ctx)return;const C=this.ctx,g=C.createGain();g.connect(this.bus.music);const f=C.createBiquadFilter();f.type='lowpass';f.frequency.value=2200;f.connect(g);const t0=C.currentTime+.05;const notes=kind==='major'?[60,64,67,72]:[60,63,67,72];
  notes.forEach((n,i)=>{const s=C.createOscillator();s.type='triangle';s.frequency.value=mtof(n);s.connect(f);s.start(t0+i*.12);s.stop(t0+2.2)});[48,55].forEach(n=>{const s=C.createOscillator();s.type='sawtooth';s.frequency.value=mtof(n);s.connect(f);s.start(t0+.4);s.stop(t0+2.2)});this.env(g,t0,.02,.35,1.2,.2,.5,t0+2.2)},
 /* ---- ambience layers: wind / rain / birds / distant fire / engines ---- */
 ambience(){const C=this.ctx,mk=(kind,ft,fq,q)=>{const s=this.src(kind),f=C.createBiquadFilter();f.type=ft;f.frequency.value=fq;if(q)f.Q.value=q;const g=C.createGain();g.gain.value=0;s.connect(f).connect(g).connect(this.bus.amb);s.start();return {s,f,g}};
  const wind=mk('brown','lowpass',380),rain=mk('white','bandpass',2400,.6),eng=mk('brown','lowpass',160);const lfo=C.createOscillator();lfo.type='sine';lfo.frequency.value=.11;const lg=C.createGain();lg.gain.value=.12;lfo.connect(lg).connect(wind.g.gain);lfo.start();
  const sw=C.createOscillator();sw.type='sawtooth';sw.frequency.value=44;const swf=C.createBiquadFilter();swf.type='lowpass';swf.frequency.value=200;sw.connect(swf).connect(eng.g);sw.start();this.amb={wind,rain,eng};
  if(window.GFX4&&GFX4.AMBX)try{GFX4.AMBX.init(this)}catch(e){console.error(e)}this.ambTimer=setInterval(()=>this.ambTick(),500)},
 ambTick(){if(!this.ctx||!this.on||this.ctx.state!=='running')return;const I=this.I,C=this.ctx,t=C.currentTime,day=WORLD.cur?WORLD.cur.stars<.5:true;if(window.GFX4&&GFX4.AMBX)try{GFX4.AMBX.tick(this)}catch(e){}
  this.amb.wind.g.gain.setTargetAtTime(.18+this.wx*.14+I*.08,t,.5);this.amb.rain.g.gain.setTargetAtTime(this.wx>=3?.22:0,t,1);this.amb.eng.g.gain.setTargetAtTime(Math.min(.22,I*.3),t,1);
  if(day&&I<.35&&Math.random()<.35&&this.wx<2){const g=this.out({x:rnd(120,-120),z:rnd(60,-60)},'amb');const f0=2500+Math.random()*1200;for(let i=0;i<3;i++){const s=C.createOscillator();s.type='sine';s.frequency.setValueAtTime(f0,t+i*.09);s.frequency.exponentialRampToValueAtTime(f0*1.25,t+i*.09+.06);s.connect(g);s.start(t+i*.09);s.stop(t+i*.09+.07)}this.env(g,t,.01,.12,.25,null,0,t+.3)}
  if(Math.random()<I*.9){const g=this.out({x:rnd(90,-90),z:rnd(120,-80)},'amb'),f=C.createBiquadFilter();f.type='lowpass';f.frequency.value=700;const s=this.src('white');s.connect(f).connect(g);this.env(g,t,.003,.12+I*.1,.05,null,0,t+.08);s.start(t);s.stop(t+.09)}
  if(Math.random()<I*I*.5){const g=this.out({x:rnd(150,-150),z:rnd(160,-120)},'amb'),f=C.createBiquadFilter();f.type='lowpass';f.frequency.setValueAtTime(260,t);f.frequency.exponentialRampToValueAtTime(50,t+1);const s=this.src('brown');s.connect(f).connect(g);this.env(g,t,.02,.3,.9,null,0,t+1.1);s.start(t);s.stop(t+1.2)}},
 intensity(I){this.I+=(I-this.I)*.3},weather(lv){this.wx=lv},
 /* ---- generative music: 120 BPM, four layers, key by regime ---- */
 PROG:{major:[[48,52,55,59],[43,47,50,55],[45,48,52,55],[41,45,48,52]],minor:[[48,51,55,58],[44,48,51,55],[51,55,58,62],[46,50,53,58]],dorian:[[50,53,57,60],[55,59,62,65],[50,53,57,60],[48,52,55,59]]},
 key(reg){this.music.key=reg==='bull'?'major':reg==='bear'||reg==='high_volatility'?'minor':'dorian'},
 startMusic(){if(!this.ctx||this.music.timer)return;const C=this.ctx;this.music.next=C.currentTime+.2;this.music.bar=0;this.music.timer=setInterval(()=>this.musicTick(),110)},
 stopMusic(){clearInterval(this.music.timer);this.music.timer=null},
 musicTick(){if(!this.on||!this.ctx||this.ctx.state!=='running')return;const C=this.ctx;while(this.music.next<C.currentTime+.35){this.bar(this.music.next);this.music.next+=2;this.music.bar++}},
 bar(t0){const C=this.ctx,I=this.I,prog=this.PROG[this.music.key]||this.PROG.major,ch=prog[this.music.bar%4],bus=this.bus.music;const sm=(a,b)=>clamp((I-a)/(b-a),0,1);
  const pad=C.createGain();pad.connect(bus);const pf=C.createBiquadFilter();pf.type='lowpass';pf.frequency.value=500+I*900;pf.connect(pad);ch.slice(0,3).forEach(n=>{[0,-.07,.09].forEach(d=>{const s=C.createOscillator();s.type='sawtooth';s.frequency.value=mtof(n+d);s.connect(pf);s.start(t0);s.stop(t0+2.05)})});this.env(pad,t0,.5,.08,1,.07,.4,t0+2.05);
  const pg=sm(.2,.5)*.14;if(pg>0){const pl=C.createGain();pl.connect(bus);pl.gain.value=pg;for(let i=0;i<8;i++){const n=ch[i%4]+(i>=4?12:0)+12;const s=C.createOscillator();s.type='triangle';s.frequency.value=mtof(n);const g=C.createGain();g.connect(pl);s.connect(g);const ts=t0+i*.25;this.env(g,ts,.01,1,.12,null,0,ts+.22);s.start(ts);s.stop(ts+.23)}}
  const dg=sm(.45,.7);if(dg>0){const dl=C.createGain();dl.connect(bus);dl.gain.value=dg*.5;for(let b=0;b<4;b++){const ts=t0+b*.5;if(b%2===0){const k=C.createGain();k.connect(dl);const o=C.createOscillator();o.type='sine';o.frequency.setValueAtTime(130,ts);o.frequency.exponentialRampToValueAtTime(42,ts+.18);o.connect(k);o.start(ts);o.stop(ts+.28);this.env(k,ts,.003,.9,.22,null,0,ts+.28)}
    else{const k=C.createGain();k.connect(dl);const s=this.src('white'),f=C.createBiquadFilter();f.type='bandpass';f.frequency.value=1800;s.connect(f).connect(k);s.start(ts);s.stop(ts+.16);this.env(k,ts,.002,.5,.12,null,0,ts+.16)}
    for(let h=0;h<2;h++){const th=ts+h*.25;const k=C.createGain();k.connect(dl);const s=this.src('white'),f=C.createBiquadFilter();f.type='highpass';f.frequency.value=7000;s.connect(f).connect(k);s.start(th);s.stop(th+.05);this.env(k,th,.001,.18,.04,null,0,th+.05)}}}
  const bg=sm(.7,.9);if(bg>0&&this.music.bar%2===0){const bl=C.createGain();bl.connect(bus);const bf=C.createBiquadFilter();bf.type='lowpass';bf.frequency.value=1100;bf.connect(bl);[ch[0]+12,ch[2]+12].forEach(n=>{[0,.05,-.05].forEach(d=>{const s=C.createOscillator();s.type='sawtooth';s.frequency.value=mtof(n+d);s.connect(bf);s.start(t0);s.stop(t0+1.9)})});this.env(bl,t0,.3,bg*.12,1,bg*.09,.4,t0+1.9)}}};
/* ======================= HUD ======================= */
const HUD={depthT:0,ray:new THREE.Raycaster(),plane:new THREE.Plane(new THREE.Vector3(0,1,0),0),quietT:0,
 price(M){const p=M.price;if(p==null)return;const e=$('#px');e.textContent=fmtP(p);if(M.lastP!=null&&M.lastP!==p){e.classList.remove('up','dn');void e.offsetWidth;e.classList.add(p>M.lastP?'up':'dn')}
  if(M.open){const c=(p/M.open-1)*100;const ch=$('#ch');ch.textContent=(c>=0?'+':'')+c.toFixed(2)+'% 24h';ch.className='ch '+(c>=0?'pos':'neg')}if(R3)relabel(WORLD.frontLbl,fmtP(p),'#ffd59a');this.round();
  if(R3&&M.round&&M.lastP!=null){const st=M.step;if(Math.floor(p/st)!==Math.floor(M.lastP/st))ARMY.surge(p>M.lastP?'bull':'bear')}},
 round(){const r=VIEW.round;if(!r)return;const p=VIEW.price||r.p0;$('#lowP').textContent=fmtP(r.low);$('#highP').textContent=fmtP(r.high);$('#rndI').style.left=(clamp((p-r.low)/(r.high-r.low),0,1)*100)+'%'},
 liquidity(M){$('#bidL').textContent=fmtU(M.bidL);$('#askL').textContent=fmtU(M.askL);$('#bidN').textContent=`${fmtU(M.bidN)} ${T('near')}`;$('#askN').textContent=`${fmtU(M.askN)} ${T('near')}`},
 unit(M){$('#unLbl').innerHTML=M.UN?mon(`${fmtU(M.UN)} · ${T('uIfv')} ${fmtU(M.UN*UK.ifv)} · ${T('uMbt')} ${fmtU(M.UN*UK.mbt)}`):'—'},
 stats(M){const b=M.trades.filter(x=>!x.sell).reduce((s,x)=>s+x.usd,0),s=M.trades.filter(x=>x.sell).reduce((a,x)=>a+x.usd,0),tot=b+s||1;$('#buyP').textContent=fmtU(b)+' · '+Math.round(b/tot*100)+'%';$('#sellP').textContent=Math.round(s/tot*100)+'% · '+fmtU(s);$('#pI').style.width=(b/tot*100)+'%';
  $('#intI').textContent=Math.round(S.I*100)+'%';$('#sig').textContent=S.sigma.toFixed(2)+'%';const ll=M.liqs.filter(x=>x.side==='long').reduce((a,x)=>a+x.usd,0),ls_=M.liqs.filter(x=>x.side==='short').reduce((a,x)=>a+x.usd,0);$('#lqS').textContent=fmtU(ls_);$('#lqL').textContent=fmtU(ll);
  const names=['Binance','OKX','Bybit'];$('#liqSrc').innerHTML=names.map(n=>`<span class="pill ${(S.src.liq.list||[]).includes(n)?'on':''}">${n}${S.src.liq.names[n]?' · '+S.src.liq.names[n]:''}</span>`).join('');$('#scB').textContent=S.score.bulls;$('#scR').textContent=S.score.bears;
  $('#mstats').innerHTML=mon(`<div class="row2"><span>${T('press')}</span><b>${ltr(Math.round(b/tot*100)+'% / '+Math.round(s/tot*100)+'%')}</b></div><div class="row2"><span>${T('intensity')}</span><b>${ltr(Math.round(S.I*100)+'% · σ '+S.sigma.toFixed(2)+'%')}</b></div><div class="row2"><span>${T('liq10')}</span><b style="color:#4ade80">${fmtU(ls_)}</b> <b style="color:#f87171">${fmtU(ll)}</b></div><div class="row2"><span>${T('score')}</span><b>🐂 ${S.score.bulls} · 🐻 ${S.score.bears}</b></div><div class="row2"><span>${T('unitT')}</span><b>${M.UN?fmtU(M.UN):'—'}</b></div><div class="row2"><span>${T('stLiq')}</span><b>${(S.src.liq.list||[]).join(' + ')||'…'}</b></div>`);
  const quiet=S.I<.15&&S.sigma<.05;if(quiet){if(!this.quietT)this.quietT=Date.now();if(Date.now()-this.quietT>60000)ARMY.setRest(true)}else{this.quietT=0;ARMY.setRest(false)}},
 depth(M){const t=now();if(t-this.depthT<250)return;this.depthT=t;const cv=$('#depth'),x=cv.getContext('2d'),W=cv.width,H=cv.height,r=M.round;if(!r)return;x.clearRect(0,0,W,H);const lo=r.low-r.R*.6,hi=r.high+r.R*.6,px=p=>(p-lo)/(hi-lo)*W;
  const cum=(m,asc)=>{const a=[...m.entries()].filter(([p])=>p>=lo&&p<=hi).sort((u,v)=>asc?u[0]-v[0]:v[0]-u[0]);let s=0;return a.map(([p,q])=>{s+=p*q;return [p,s]})};const B=cum(M.bids,false),A=cum(M.asks,true);const mx=Math.max(B.length?B[B.length-1][1]:0,A.length?A[A.length-1][1]:0,1);
  const area=(arr,col)=>{if(!arr.length)return;x.beginPath();x.moveTo(px(arr[0][0]),H);arr.forEach(([p,s])=>x.lineTo(px(p),H-s/mx*(H-14)));x.lineTo(px(arr[arr.length-1][0]),H);x.closePath();x.fillStyle=col;x.fill()};area(B,'rgba(34,197,94,.45)');area(A,'rgba(239,68,68,.45)');
  x.font='22px "Space Grotesk",monospace';x.textAlign='center';for(const [key,w] of M.walls){const X_=px(w.p);if(X_<0||X_>W)continue;x.fillStyle=key[0]==='b'?'#86efac':'#fca5a5';x.fillRect(X_-1,H*.35,2,H*.65);x.fillText(fmtU(w.usd),X_,H*.3)}
  x.strokeStyle='#f7931a';x.lineWidth=3;const fp=px(M.price||r.p0);x.beginPath();x.moveTo(fp,0);x.lineTo(fp,H);x.stroke();$('#axL').textContent=fmtP(lo);$('#axM').textContent=fmtP(M.price||r.p0);$('#axR').textContent=fmtP(hi)},
 feed(){const F=T('f'),R=T('radio'),arr=VIEW===L?S.feed:(S.feedRP||[]);const ch=S.chip;const ok=e=>ch==='all'||(ch==='buy'&&/Buy|liqS/.test(e.k))||(ch==='sell'&&/Sell|liqL/.test(e.k))||(ch==='wall'&&/wall|fort|convoy|naval/.test(e.k))||(ch==='liq'&&/liq|cascade|extreme|heli|bomb|missile|cruise|intercept|subm/.test(e.k))||(ch==='round'&&/win|roundNum|regime/.test(e.k));
  $('#feed').innerHTML=mon(arr.filter(ok).slice(0,36).map(e=>{const cls=/Buy|liqS|wallB/.test(e.k)?'buy':/Sell|liqL|wallA/.test(e.k)?'sell':/win|roundNum|extreme|cascade/.test(e.k)?'win':'info';const name=e.k==='win'?(e.side==='bulls'?F.bullsWin:F.bearsWin):e.k==='radio'?R[e.r]:e.k==='regime'?`${F.regime}: ${T('reg')[e.reg]||e.reg}`:F[e.k]||e.k;
   return `<div class="it ${cls}" data-t="${e.t}"><span class="t">${new Date(e.t).toLocaleTimeString('en-GB')}</span><span class="k">${name}${e.n?` <span class="x">${e.n} ${F.lv}</span>`:''}${e.p?` <span class="t">@ ${fmtP(e.p)}</span>`:''}${e.src?` <span class="x">${e.src}</span>`:''}</span><span class="u">${e.usd?fmtU(e.usd):''}</span></div>`}).join(''));
  $('#feedLive').textContent=VIEW===L?T('rpLive'):T('rpMode');$('#feedLive').className=VIEW===L?'':'rp'},
 chips(){const C=T('chips');$('#fchips').innerHTML=Object.keys(C).map(k=>`<button data-c="${k}" class="${S.chip===k?'on':''}">${C[k]}</button>`).join('')},
 radio(key){AUDIO.play('radio',{vol:.6});const arr=VIEW===L?S.feed:(S.feedRP||[]);arr.unshift({k:'radio',r:key,t:Date.now()});this.feed()},
 status(){const st=(id,s,lat)=>{const d=$(id);d.className=s==='ok'?'ok':s==='fb'?'fb':s==='bad'?'bad':'';return lat};$('#stPl').textContent=S.src.price.st==='ok'?(S.src.price.lat?S.src.price.lat+'ms':''):S.src.price.st==='bad'?'✕':'…';st('#stP',S.src.price.st);
  st('#stD',S.src.depth.st);$('#stDl').textContent=S.src.depth.st==='ok'?(S.src.depth.drift>.01?'Δ'+Math.round(S.src.depth.drift*100)+'%':'ok'):'…';st('#stL',S.src.liq.st);$('#stLl').textContent=(S.src.liq.list||[]).length?(S.src.liq.list.join('+')+(S.src.liq.lat?' '+Math.min(9999,Math.round(S.src.liq.lat))+'ms':'')):'…'},
 banner(txt,cls,sub,ms){const bn=$('#banner');bn.className='banner show '+(cls||'');bn.innerHTML=mon(esc(txt)+(sub?`<small>${esc(sub)}</small>`:''));clearTimeout(this.bnT);this.bnT=setTimeout(()=>bn.classList.remove('show'),ms||4200)},
 toast(txt){this.banner(txt,'warn',null,2600)},
 /* the reconnaissance card: only numbers read from the live model */
 intel(rep,by){const I=T('intel'),p=$('#intel'),age=ms=>ms>=6e4?Math.round(ms/6e4)+' '+I.min:Math.round(ms/1000)+' '+I.sec,dist=x=>{const v=((x/rep.p-1)*100).toFixed(2),z=+v===0;return ltr((z?'':+v>0?'+':'')+(z?'0.00':v)+'%')};
  const wall=(w,cls)=>w?`<b class="${cls}">${fmtU(w.usd)}</b> <i>@ ${fmtP(w.p)} · ${dist(w.p)} · ${age(w.age)}</i>`:'—',pc=(a,b)=>a+b?Math.round(a/(a+b)*100):50,bar=(a,b)=>`<div class="bal"><i style="width:${pc(a,b)}%"></i></div>`;
  $('#intelH').textContent=`🛰 ${by==='bull'?I.byBull:I.byBear} · ${new Date(rep.t).toLocaleTimeString('en-GB')}`;
  $('#intelB').innerHTML=mon(`<div class="r"><span>${I.ask}</span><span>${wall(rep.ask,'rd')}</span></div><div class="r"><span>${I.bid}</span><span>${wall(rep.bid,'g')}</span></div>
   <div class="r"><span>${I.near}</span><span><b class="g">${I.buy} ${fmtU(rep.bidN)}</b> <i>·</i> <b class="rd">${I.sell} ${fmtU(rep.askN)}</b></span></div>${bar(rep.bidN,rep.askN)}
   <div class="r"><span>${I.flow}</span><span><b class="g">${I.buy} ${fmtU(rep.buy)}</b> <i>·</i> <b class="rd">${I.sell} ${fmtU(rep.sell)}</b></span></div>${bar(rep.buy,rep.sell)}
   <div class="r"><span>${I.liq}</span><span><b class="rd">${I.long} ${fmtU(rep.liqL)}</b> <i>·</i> <b class="g">${I.short} ${fmtU(rep.liqS)}</b></span></div>
   <div class="r"><span>${I.big}</span><span>${rep.big?`<b class="${rep.big.sell?'rd':'g'}">${rep.big.sell?I.sell:I.buy} ${fmtU(rep.big.usd)}</b> <i>@ ${fmtP(rep.big.p)}</i>`:'—'}</span></div>
   <div class="r"><span>${I.vol}</span><span><b>${ltr('σ '+rep.sigma.toFixed(2)+'%')}</b> <i>· ${T('intensity')} ${ltr(Math.round(rep.I*100)+'%')}</i></span></div>`);
  p.hidden=false;p.classList.remove('scan');void p.offsetWidth;p.classList.add('scan');clearTimeout(this.intT);this.intT=setTimeout(()=>{if(!p.matches(':hover'))p.hidden=true},22000)},
 cams(){const C=T('cams');$('#cams').innerHTML=Object.keys(C).map((k,i)=>`<button data-cam="${k}" class="${DIRECTOR.mode===k?'on':''}" title="${i+1}">${C[k]}</button>`).join('')},
 settings(){const p=$('#settings'),V=T('vols'),SO=T('skyOpts'),QO=T('qOpts'),LY=T('layers');const sel=(id,opts,cur)=>`<select id="${id}">${Object.keys(opts).map(k=>`<option value="${k}"${cur===k?' selected':''}>${opts[k]}</option>`).join('')}</select>`;
  p.innerHTML=`<h5>${T('setT')}</h5><label><span>${T('sky')}</span>${sel('skySel',SO,PREF.sky)}</label><label><span>${T('quality')}</span>${sel('qSel',QO,PREF.quality)}</label><label><span>${T('motion')}</span><input type="checkbox" id="motC" ${PREF.motion==='reduced'?'checked':''}></label><label><span>${T('musicT')}</span><input type="checkbox" id="musC" ${PREF.music?'checked':''}></label>
   <h5>${T('snd')}</h5>${['master','music','sfx','amb','voice'].map(k=>`<label><span>${V[k]}</span><input type="range" min="0" max="1" step=".05" value="${PREF.vol[k]}" data-v="${k}"></label>`).join('')}
   <h5>${LY.units} / ${LY.fx}</h5>${['units','fx','depth','feed'].map(k=>`<label><span>${LY[k]}</span><input type="checkbox" data-l="${k}" ${PREF.layers[k]?'checked':''}></label>`).join('')}<p class="disc" style="margin:8px 0 0;font-size:.64rem">${T('shortcuts')}</p>`;
  $('#skySel').onchange=e=>{PREF.sky=e.target.value;savePref();WORLD.skyMode()};$('#qSel').onchange=e=>{PREF.quality=e.target.value;savePref();fpsDone=true;if(R3)WORLD.setQuality(PREF.quality==='auto'?'high':PREF.quality);if(PREF.quality==='auto'){fpsDone=false;fpsN=0;fpsT=0}};$('#motC').onchange=e=>{PREF.motion=e.target.checked?'reduced':'full';savePref()};$('#musC').onchange=e=>{AUDIO.setMusic(e.target.checked);if(e.target.checked&&!AUDIO.on){AUDIO.enable(true);this.snd()}};
  p.querySelectorAll('input[type=range]').forEach(r=>r.oninput=()=>{PREF.vol[r.dataset.v]=+r.value;savePref();AUDIO.setVols()});p.querySelectorAll('input[data-l]').forEach(c=>c.onchange=()=>{PREF.layers[c.dataset.l]=c.checked?1:0;savePref();this.layers()})},
 layers(){const b=$('#bf');b.dataset.lDepth=PREF.layers.depth;b.dataset.lFeed=PREF.layers.feed;if(R3){for(const k in ARMY.sides){const A=ARMY.sides[k];A.meshes.forEach(m=>m.visible=!!PREF.layers.units);A.tk.forEach(t=>t.hull.visible=t.tur.visible=!!PREF.layers.units)}[ARMY.hesco,ARMY.empl,ARMY.penn].forEach(m=>m.visible=!!PREF.layers.units);for(const k in ARMY.sides){const A=ARMY.sides[k];if(A.sh)A.sh.visible=A.vsh.visible=!!PREF.layers.units}if(window.GFX6)for(const k in GFX6.RB.sides){const R=GFX6.RB.sides[k];R.hm.visible=R.dm.visible=!!PREF.layers.units;if(R.sh)R.sh.visible=!!PREF.layers.units}FX.pts.visible=FX.proj.visible=!!PREF.layers.fx;if(!PREF.layers.units)ARMY.clear()}},
 snd(){const b=$('#sndB');b.textContent=(AUDIO.on?'🔊 ':'🔇 ')+T('snd');b.classList.toggle('on',AUDIO.on)},
 /* hover tooltip on a lane: price level, orders, soldiers, age */
 hover(e){const tip=$('#tip');if(!e||!R3||!VIEW.round||DIRECTOR.mode==='tactical'&&false){tip.hidden=true;return}const c=ren.domElement,rc=c.getBoundingClientRect();const nd=new THREE.Vector2(((e.clientX-rc.left)/rc.width)*2-1,-((e.clientY-rc.top)/rc.height)*2+1);const camera=DIRECTOR.mode==='tactical'?DIRECTOR.ortho:cam;this.ray.setFromCamera(nd,camera);const hit=new THREE.Vector3();if(!this.ray.ray.intersectPlane(this.plane,hit)||Math.abs(hit.z)>44||Math.abs(hit.x)>76){tip.hidden=true;return}
  const p=VIEW.round.p0+hit.x/VIEW.scale,fx=VIEW.price||VIEW.round.p0,side=p<fx?'b':'a',bw=VIEW.step/5,k=Math.floor(p/bw),b=VIEW.bk[side].find(x=>x.k===k);if(!b){tip.hidden=true;return}const key=side+k,age=Date.now()-(VIEW.first.get(key)||Date.now()),TP=T('tip');
  tip.hidden=false;tip.innerHTML=mon(`<b>${fmtP(b.p-bw/2)} – ${fmtP(b.p+bw/2)}</b> · ${side==='b'?TP.bid:TP.ask}<br>${TP.usd}: <b>${fmtU(b.usd)}</b> · ${Math.round(b.usd/VIEW.UN)} ${TP.n} · ${TP.age} ${ltr(age>60000?Math.round(age/60000)+'m':Math.round(age/1000)+'s')}`);tip.style.left=Math.min(rc.width-200,e.clientX-rc.left+14)+'px';tip.style.top=Math.max(10,e.clientY-rc.top-40)+'px'},
 click(e){if(!R3||!VIEW.round)return;const c=ren.domElement,rc=c.getBoundingClientRect();const nd=new THREE.Vector2(((e.clientX-rc.left)/rc.width)*2-1,-((e.clientY-rc.top)/rc.height)*2+1);this.ray.setFromCamera(nd,DIRECTOR.mode==='tactical'?DIRECTOR.ortho:cam);const hit=new THREE.Vector3();if(this.ray.ray.intersectPlane(this.plane,hit)&&Math.abs(hit.x)<80)DIRECTOR.focus(hit.x,hit.z,4,{dist:42,pitch:.4,force:true})},
 /* replay UI */
 replay(on){const bar=$('#replayBar');bar.hidden=!on;$('#rpB').classList.toggle('on',on);if(on){$('#rpPlay').textContent=REPLAY.playing?'⏸':'▶';$('#rpSpd').textContent=REPLAY.speed+'x';this.markers()}this.feed()},
 markers(){const sp=REC.span();if(!sp)return;const mk=$('#rpMk');mk.querySelectorAll('i').forEach(i=>i.remove());REC.ev.filter(e=>(e.usd>=1e6&&/liq|huge|cascade/.test(e.k))||e.k==='win').forEach(e=>{const i=document.createElement('i');i.style.left=((e.t-sp[0])/(sp[1]-sp[0])*100)+'%';mk.appendChild(i)})},
 replayPos(){const sp=REC.span();if(!sp)return;const f=(REPLAY.cur-sp[0])/Math.max(1,sp[1]-sp[0]);const r=$('#rpPos');if(!r.matches(':active'))r.value=Math.round(f*1000);const ago=Math.round((sp[1]-REPLAY.cur)/1000);$('#rpT').textContent='-'+String(Math.floor(ago/60)).padStart(2,'0')+':'+String(ago%60).padStart(2,'0')},
 live(){if(!L.price)return;const e=S.lastBig?(T('f')[S.lastBig.k]||S.lastBig.k)+' '+fmtU(S.lastBig.usd||0):T('none');$('#live').textContent=T('live').replace('{p}',fmtP(L.price)).replace('{b}',Math.round(S.pressure*100)).replace('{e}',e)},
 lang(){this.chips();this.cams();this.settings();this.snd();this.feed();$('#nogl').innerHTML=T('nogl');if(VIEW.round){this.round();this.liquidity(VIEW);this.unit(VIEW)}},
 bind(){$('#sym').innerHTML=SYMS.map(s=>`<option${s===SYM?' selected':''}>${s}</option>`).join('');$('#sym').onchange=()=>setSym($('#sym').value);
  $('#cams').onclick=e=>{const b=e.target.closest('button');if(b)DIRECTOR.setMode(b.dataset.cam)};$('#fchips').onclick=e=>{const b=e.target.closest('button');if(!b)return;S.chip=b.dataset.c;this.chips();this.feed()};
  $('#feed').onclick=e=>{const it=e.target.closest('.it');if(!it)return;const t=+it.dataset.t;if(!t)return;if(!REPLAY.on)REPLAY.enter();if(REPLAY.on){REPLAY.seek(t-3000);REPLAY.playing=true;this.replay(true)}};
  $('#sndB').onclick=()=>{AUDIO.enable(!AUDIO.on);this.snd()};$('#fsB').onclick=()=>{const b=$('#bf');if(document.fullscreenElement){document.exitFullscreen()}else if(b.requestFullscreen){b.requestFullscreen().catch(()=>b.classList.toggle('fs'))}else b.classList.toggle('fs');setTimeout(()=>WORLD.resize(),300)};
  $('#helpB').onclick=()=>{const i=$('#intro');i.hidden=!i.hidden};$('#intelX').onclick=()=>{$('#intel').hidden=true};$('#intB').onclick=()=>{if(!VIEW.round)return;if(Date.now()-(S.intelT||0)<12000){$('#intel').hidden=false;return}DIRECTOR.scenario('intel')};$('#setB').onclick=()=>{const s=$('#settings');s.hidden=!s.hidden;$('#setB').classList.toggle('on',!s.hidden)};$('#layB').onclick=()=>{$('#settings').hidden=false;$('#setB').classList.add('on');const h=[...$('#settings').querySelectorAll('h5')].pop();h&&h.scrollIntoView({block:'nearest'})};
  $('#rpB').onclick=()=>{if(REPLAY.on)REPLAY.exit();else REPLAY.enter()};$('#rpExit').onclick=()=>REPLAY.exit();$('#rpPlay').onclick=()=>{REPLAY.playing=!REPLAY.playing;this.replay(true)};$('#rpSpd').onclick=()=>{REPLAY.speed=REPLAY.speed>=8?1:REPLAY.speed*2;this.replay(true)};
  $('#rpPos').oninput=e=>{const sp=REC.span();if(!sp)return;REPLAY.seek(sp[0]+(sp[1]-sp[0])*(+e.target.value/1000))};
  $('#tabs2').onclick=e=>{const b=e.target.closest('button');if(!b)return;$('#bf').dataset.tab=b.dataset.tab;$('#tabs2').querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b))};
  document.addEventListener('fullscreenchange',()=>setTimeout(()=>WORLD.resize(),200));
  addEventListener('keydown',e=>{if(e.target.matches('input,select,textarea'))return;const k=e.key.toLowerCase();const cams=['orbit','follow','cine','tactical','naval','space'];if('123456'.includes(e.key)&&e.key)DIRECTOR.setMode(cams[+e.key-1]);else if(k==='i')$('#intB').click();else if(k==='m'){AUDIO.enable(!AUDIO.on);this.snd()}else if(k==='f')$('#fsB').click();else if(k==='r')$('#rpB').click();else if(k===' '&&REPLAY.on){e.preventDefault();$('#rpPlay').click()}else if(k==='escape'){$('#settings').hidden=true;$('#setB').classList.remove('on')}});
  this.layers()}};
/* ======================= boot ======================= */
S.pxHud=0;S.feedRP=[];
function boot4(){try{$('#bf').classList.toggle('soft',!!(S.gpu&&S.gpu.soft));const n=$('#gpuN');if(n&&S.gpu&&S.gpu.soft&&!ls.get('ek_bf_gpu',0)){n.hidden=false;$('#gpuX').onclick=()=>{n.hidden=true;ls.set('ek_bf_gpu',1)}}const mb=$('#mixB');if(mb)mb.onclick=()=>{const st=$('#settings');if(st.hidden)$('#setB').click();setTimeout(()=>{const r=st.querySelector('input[type=range]');if(r){r.scrollIntoView({block:'center'});r.focus()}},80)}}catch(e){console.error(e)}}
function boot(){const ld=(p,txt)=>{$('#ldP').textContent=p+'%';$('#ldB').style.width=p+'%';void txt};HUD.bind();
 if(hasGL()){try{ld(10);WORLD.init();ld(40);ARMY.init();ld(65);FX.init();if(window.GFX4)try{GFX4.boot()}catch(e){console.error(e)}if(window.GFX6)try{GFX6.boot()}catch(e){console.error(e)}if(window.NAV)try{NAV.bake();ARMY.navInit()}catch(e){console.error(e)}boot4();ld(85);DIRECTOR.init();WORLD.setQuality(PREF.quality==='auto'?WORLD.q0:PREF.quality);HUD.layers();requestAnimationFrame(loop);ld(100)}catch(e){console.error(e);R3=false;$('#nogl').hidden=false}}else $('#nogl').hidden=false;
 setTimeout(()=>{$('#loading').hidden=true},300);setTimeout(()=>{$('#intro').hidden=true},9000);
 uiLang(()=>HUD.lang());if(AUDIO.on)AUDIO.init();HUD.snd();
 connect();loadRegime();setInterval(loadRegime,300000);setInterval(metrics,1000);setInterval(()=>HUD.live(),30000)}
boot();
