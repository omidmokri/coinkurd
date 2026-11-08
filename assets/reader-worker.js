/* entekhab.net read-aloud — voice worker (module worker, no third-party hosts).
   Runs the neural voices off the main thread so the page never freezes while a sentence renders:
     fa  : Piper fa_IR "amir" (VITS) — espeak-ng phonemes from piper_phonemize (WASM)
     ckb : Vekol-TTS Sorani edge (VITS) — character input, no phonemizer
   Everything is served by entekhab.net under /tts/ (see scripts/fetch_tts.py; both voices are int8,
   ~18-20 MB to download) and kept in the Cache Storage bucket "ek-tts-v1", so a voice downloads once
   and then works offline.
   Text never leaves the device.

   Messages in : {id, op:'load', lang} | {id, op:'synth', lang, text, rate}
   Messages out: {id, ok:true, pcm?, sr?} | {id, ok:false, err} | {op:'progress', lang, loaded, total} */

const CACHE = 'ek-tts-v1';
let M = null, ort = null, ortBin = null;
const S = {};                 // lang -> {session, cfg}
let phon = null, phonOut = null;

async function manifest() {
  if (!M) { M = await (await fetch('/tts/manifest.json', { cache: 'no-cache' })).json(); sweep(); }
  return M;
}
/* cache keys carry the file's exact byte size (manifest.sizes), so a replaced voice is fetched again;
   anything in the bucket that no longer matches a served file is deleted (frees the old ~75 MB
   full-size voices on devices that downloaded them before the int8 switch) */
async function sweep() {
  try {
    const c = await caches.open(CACHE);
    for (const req of await c.keys()) {
      const u = new URL(req.url), sz = M.sizes && M.sizes[u.pathname];
      if (sz === undefined || u.search !== '?s=' + sz) await c.delete(req);
    }
  } catch (e) { }
}
const keyOf = url => url + '?s=' + ((M && M.sizes && M.sizes[url]) || 0);

/* fetch through our own cache, reporting progress; `tag` groups several files under one bar */
async function grab(url, tag, acc) {
  const key = keyOf(url), size = (M.sizes && M.sizes[url]) || 0;
  let c = null;
  try { c = await caches.open(CACHE); const hit = await c.match(key); if (hit) { const b = await hit.arrayBuffer(); acc.loaded += b.byteLength; post(tag, acc); return b; } } catch (e) { c = null; }
  const res = await fetch(url);
  if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + url);
  const total = +res.headers.get('content-length') || size || 0;
  const rd = res.body.getReader(), parts = []; let n = 0;
  for (;;) {
    const { done, value } = await rd.read(); if (done) break;
    parts.push(value); n += value.byteLength; acc.loaded += value.byteLength; post(tag, acc);
  }
  const buf = new Uint8Array(n); let o = 0; for (const p of parts) { buf.set(p, o); o += p.byteLength; }
  /* content-length is the compressed size when Pages gzips (it does for .wasm): only a
     shortfall on an uncompressed response means a cut-off download */
  if (total && n < total && !res.headers.get('content-encoding')) throw new Error('short download ' + url);
  try { if (c) await c.put(key, new Response(buf.slice().buffer)); } catch (e) { /* quota: still works this session */ }
  return buf.buffer;
}
let lastPost = 0;
function post(lang, acc) { const t = Date.now(); if (t - lastPost < 120 && acc.loaded < acc.total) return; lastPost = t; self.postMessage({ op: 'progress', lang, loaded: acc.loaded, total: acc.total }); }

async function getOrt(acc, lang) {
  if (ort) return ort;
  const m = await manifest();
  if (!ortBin) ortBin = await grab(m.ort.wasm, lang, acc);
  ort = await import(m.ort.base + 'ort.wasm.min.mjs');
  ort.env.wasm.wasmPaths = m.ort.base;
  ort.env.wasm.wasmBinary = ortBin;
  ort.env.wasm.numThreads = 1;          // GitHub Pages cannot send COOP/COEP, so no SharedArrayBuffer
  return ort;
}

async function getPhon(acc) {
  if (phon) return phon;
  const m = await manifest();
  const wasm = await grab(m.piper.wasm, 'fa', acc), data = await grab(m.piper.data, 'fa', acc);
  const create = (await import(m.piper.js)).default;
  phon = await create({
    noInitialRun: true, wasmBinary: wasm,
    getPreloadedPackage: () => data,
    locateFile: u => m.piper.js.replace(/[^/]+$/, '') + u,
    print: t => { phonOut = t; }, printErr: () => { }
  });
  return phon;
}

async function load(lang) {
  if (S[lang]) return S[lang];
  const m = await manifest(), v = m[lang];
  if (!v) throw new Error('no voice ' + lang);
  const S_ = m.sizes, acc = { loaded: 0, total: S_[v.model] + (ort ? 0 : S_[m.ort.wasm]) + (lang === 'fa' && !phon ? S_[m.piper.wasm] + S_[m.piper.data] : 0) };
  const o = await getOrt(acc, lang);
  if (lang === 'fa') await getPhon(acc);
  const cfg = await (await fetch(v.config)).json();
  const model = await grab(v.model, lang, acc);
  /* one neural voice in memory at a time: two VITS graphs can exhaust a phone's tab memory */
  for (const k of Object.keys(S)) { try { await S[k].session.release(); } catch (e) { } delete S[k]; }
  const session = await o.InferenceSession.create(model, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
  acc.loaded = acc.total; lastPost = 0; post(lang, acc);
  return (S[lang] = { session, cfg });
}

/* ---------- text -> ids ---------- */
function idsFa(text) {
  phonOut = null;
  phon.callMain(['-l', S.fa.cfg.espeak.voice, '--input', JSON.stringify([{ text }]), '--espeak_data', '/espeak-ng-data']);
  if (!phonOut) return [];
  try { return JSON.parse(phonOut).phoneme_ids || []; } catch (e) { return []; }
}
function idsCkb(text) {
  const pm = S.ckb.cfg.phoneme_id_map, PAD = pm._[0];
  const seq = [pm['^'][0], PAD];
  for (const ch of text.normalize('NFD')) {
    if (pm[ch]) seq.push(pm[ch][0], PAD);
  }
  seq.push(pm.$[0]);
  return seq;
}

/* Vekol: drop a hallucinated tail after a long silence and the model's own edge silence
   (port of _trim in vekol_tts.py), so stitched sentences don't lag or babble */
function trimTail(a, sr) {
  const w = Math.max(1, Math.round(0.02 * sr)), env = new Float32Array(a.length);
  let s = 0; for (let i = 0; i < a.length; i++) { s += Math.abs(a[i]); if (i >= w) s -= Math.abs(a[i - w]); env[i] = s / w; }
  let mx = 0; for (const x of env) if (x > mx) mx = x;
  if (!mx) return a;
  const th = 0.02 * mx, loud = i => env[i] > th;
  let first = 0; while (first < a.length && !loud(first)) first++;
  let last = a.length - 1; while (last > first && !loud(last)) last--;
  if (first >= last) return a;
  const gap = 0.35 * sr;
  for (let i = last; i > first;) {
    if (!loud(i)) { let j = i; while (j > first && !loud(j)) j--; if (i - j > gap) last = j; i = j; } else i--;
  }
  const edge = Math.round(0.06 * sr);
  return a.slice(Math.max(0, first - edge), Math.min(a.length, last + edge));
}

async function synth(lang, text, rate) {
  const v = await load(lang), cfg = v.cfg, inf = cfg.inference || {};
  const sr = cfg.audio.sample_rate;
  const ids = lang === 'fa' ? idsFa(text) : idsCkb(text);
  if (ids.length < 3) return { pcm: new Float32Array(0), sr };
  const run = async () => {
    const feeds = {
      input: new ort.Tensor('int64', BigInt64Array.from(ids, BigInt), [1, ids.length]),
      input_lengths: new ort.Tensor('int64', BigInt64Array.from([ids.length], BigInt), [1]),
      scales: new ort.Tensor('float32', Float32Array.from([inf.noise_scale ?? 0.667, (inf.length_scale ?? 1) / (rate || 1), inf.noise_w ?? 0.8]), [3])
    };
    if ((cfg.num_speakers || 1) > 1) feeds.sid = new ort.Tensor('int64', BigInt64Array.from([0n]), [1]);
    const out = await v.session.run(feeds);
    return (out.output || out[Object.keys(out)[0]]).data;
  };
  let pcm = await run();
  if (lang === 'ckb') {
    /* VITS duration is stochastic and Vekol can tack on a babble tail: re-roll once if the
       render is longer than its character count predicts, keep the shorter (vekol_tts.py) */
    pcm = trimTail(pcm, sr);
    const cap = (text.length * 0.075 / (rate || 1) + 1.2) * sr;
    if (pcm.length > cap) { const b = trimTail(await run(), sr); if (b.length < pcm.length) pcm = b; }
  }
  return { pcm: pcm instanceof Float32Array ? pcm : Float32Array.from(pcm), sr };
}

/* one request at a time: a VITS session must not run twice at once, and switching voices
   releases the other one — so requests are chained in arrival order */
let queue = Promise.resolve();
self.onmessage = e => { queue = queue.then(() => handle(e.data || {})); };
async function handle({ id, op, lang, text, rate }) {
  try {
    if (op === 'load') { await load(lang); self.postMessage({ id, ok: true }); return; }
    if (op === 'synth') {
      const { pcm, sr } = await synth(lang, text, rate);
      self.postMessage({ id, ok: true, pcm, sr }, [pcm.buffer]);
      return;
    }
    if (op === 'cached') {
      /* has this voice been downloaded before? (decides whether to ask before downloading) */
      const m = await manifest(), c = await caches.open(CACHE);
      const hit = !!(await c.match(keyOf(m[lang].model)));
      const ortHit = !!(await c.match(keyOf(m.ort.wasm)));
      /* what the visitor will actually download: gzip size as Pages sends it */
      self.postMessage({ id, ok: true, cached: hit, bytes: (hit ? 0 : m.wire[lang]) + (ortHit ? 0 : m.wire.ort) });
      return;
    }
    throw new Error('unknown op ' + op);
  } catch (err) {
    self.postMessage({ id, ok: false, err: String(err && err.message || err) });
  }
}
