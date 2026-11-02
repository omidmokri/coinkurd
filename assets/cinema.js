/* entekhab.net — cinematic hero: "Bitcoin: The Digital Universe" + Black Hole
 * Timeline (seconds):
 *   0    gold particles appear in the dark
 *   2.5  particles converge into the real 3D coin (sampled from the coin texture)
 *   6    the camera dives into the ₿
 *   8    tunnel of the LATEST REAL Bitcoin blocks (mempool.space): lit boxes = tx count, labels = height/tx/pool
 *   12   digital globe drawn by REAL reachable Bitcoin nodes (bitnodes.io via data/chain.json) + flow rings
 *   15.5 black hole with accretion disk; disk particles stream back into the coin
 *   21   ENTEKHAB title, live data chips (Binance price, block, hashrate, fee, nodes)
 * Every number on screen is real; nothing is simulated. Returning visitors get the short version (from 15.5).
 */
(() => {
  'use strict';
  const hero = document.querySelector('.hero'), cv = document.getElementById('coin3d');
  const fail = () => { if (hero) hero.classList.remove('cine', 'cine-intro'); if (window.__cineFail) window.__cineFail(); };
  if (!hero || !cv || !window.THREE) return fail();

  const mobile = innerWidth < 768 || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  const low = mobile || (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: !low, alpha: false, powerPreference: 'high-performance' }); }
  catch (e) { return fail(); }
  if (!renderer.getContext()) return fail();
  const PR = Math.min(devicePixelRatio || 1, low ? 1 : 1.5);
  renderer.setPixelRatio(PR);
  renderer.setClearColor(0x000000, 1);
  cv.setAttribute('aria-hidden', 'true');
  hero.classList.add('cine');

  const q = s => hero.querySelector(s);
  const fx = q('#cineFx'), cap = q('#cineCap'), chips = q('#cineData'), btn = q('#cineBtn');
  const lang = () => { let l = ''; try { l = localStorage.getItem('ck_lang') || ''; } catch (e) { } return l || document.documentElement.lang || 'fa'; };
  const TX = {
    fa: { blocks: 'تونلی از ۱۵ بلاک آخر شبکهٔ بیت‌کوین — زنده از mempool.space', nodes: (n, c) => c ? `${n} نود فعال بیت‌کوین در ${c} کشور — bitnodes.io` : `${n} نود فعال شبکهٔ بیت‌کوین در سراسر جهان — bitnodes.io`, skip: 'رد کردن ⏭', replay: '↻ پخش دوباره', nodeW: 'نود' },
    ckb: { blocks: 'تونێلێک لە ١٥ بلۆکی کۆتایی تۆڕی بیتکۆین — ڕاستەوخۆ لە mempool.space', nodes: (n, c) => c ? `${n} نۆدی چالاکی بیتکۆین لە ${c} وڵات — bitnodes.io` : `${n} نۆدی چالاکی تۆڕی بیتکۆین لە سەرانسەری جیهان — bitnodes.io`, skip: 'تێپەڕاندن ⏭', replay: '↻ دووبارە', nodeW: 'نۆد' },
    en: { blocks: 'A tunnel of the latest 15 Bitcoin blocks — live from mempool.space', nodes: (n, c) => c ? `${n} reachable Bitcoin nodes in ${c} countries — bitnodes.io` : `${n} reachable Bitcoin nodes worldwide — bitnodes.io`, skip: 'Skip ⏭', replay: '↻ Replay', nodeW: 'nodes' }
  };
  const tx = k => (TX[lang()] || TX.en)[k];
  const fmtN = n => Number(n).toLocaleString('en-US');

  /* ---------------- scene ---------------- */
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x000000, 0.00001);   // always on (no shader recompiles), density animated
  const cam = new THREE.PerspectiveCamera(40, 1, 0.1, 1500);
  cam.position.set(0, 0, 18);
  const look = new THREE.Vector3();

  scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  const key = new THREE.DirectionalLight(0xffdcae, 1.5); key.position.set(4, 5, 7); scene.add(key);
  const rim = new THREE.PointLight(0xf7931a, 2.4, 40); rim.position.set(-5, -3, 4); scene.add(rim);
  const topL = new THREE.PointLight(0xffffff, 1.1, 40); topL.position.set(0, 6, 8); scene.add(topL);
  const backL = new THREE.PointLight(0xff8a1e, 0, 30); backL.position.set(0, 0.5, -3.2); scene.add(backL);

  /* shared GLSL */
  const NOISE = `float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),u.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),u.x),u.y);}`;
  const PT_FS = `varying vec3 vC;varying float vA;
void main(){vec2 d=gl_PointCoord-.5;float r=length(d);if(r>.5)discard;float a=smoothstep(.5,0.,r);gl_FragColor=vec4(vC*1.3,a*vA);}`;

  /* ---------------- starfield ---------------- */
  const stars = (() => {
    const n = low ? 1500 : 3500, g = new THREE.BufferGeometry(), p = new Float32Array(n * 3), c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const r = 300 + Math.random() * 400, u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u);
      p[i * 3] = r * s * Math.cos(a); p[i * 3 + 1] = r * u; p[i * 3 + 2] = r * s * Math.sin(a);
      const w = 0.55 + Math.random() * 0.45, gold = Math.random() < 0.18;
      c[i * 3] = w; c[i * 3 + 1] = gold ? w * 0.75 : w; c[i * 3 + 2] = gold ? w * 0.4 : w;
    }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    const m = new THREE.Points(g, new THREE.PointsMaterial({ size: 1.5, sizeAttenuation: true, vertexColors: true, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    scene.add(m); return m;
  })();

  /* ---------------- coin (real textures) ---------------- */
  const coin = new THREE.Group(); scene.add(coin);
  const ld = new THREE.TextureLoader(); let texReady = 0;
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const T = f => { const t = ld.load('assets/' + f, () => { texReady++; }); t.anisotropy = aniso; return t; };
  const mF = new THREE.MeshStandardMaterial({ map: T('coin-front.png'), bumpMap: T('coin-front-bump.png'), bumpScale: 0.025, metalness: 0.85, roughness: 0.32, transparent: true, opacity: 0 });
  const mB = new THREE.MeshStandardMaterial({ map: T('coin-back.png'), bumpMap: T('coin-back-bump.png'), bumpScale: 0.025, metalness: 0.85, roughness: 0.32, transparent: true, opacity: 0 });
  const ec = document.createElement('canvas'); ec.width = 1024; ec.height = 64; const eg = ec.getContext('2d');
  for (let i = 0; i < 1024; i += 8) { eg.fillStyle = i % 16 ? '#b8781c' : '#f0b24a'; eg.fillRect(i, 0, 8, 64); }
  const et = new THREE.CanvasTexture(ec); et.wrapS = THREE.RepeatWrapping; et.repeat.x = 6;
  const mS = new THREE.MeshStandardMaterial({ map: et, color: 0xf2b24c, metalness: 0.9, roughness: 0.3, transparent: true, opacity: 0 });
  const CR = 2.1, CH = 0.3;
  const side = new THREE.Mesh(new THREE.CylinderGeometry(CR, CR, CH, 128, 1, true), mS); side.rotation.x = Math.PI / 2;
  const f1 = new THREE.Mesh(new THREE.CircleGeometry(CR, 128), mF); f1.position.z = CH / 2;
  const f2 = new THREE.Mesh(new THREE.CircleGeometry(CR, 128), mB); f2.position.z = -CH / 2; f2.rotation.y = Math.PI;
  const coinMesh = new THREE.Group(); coinMesh.add(side, f1, f2); coin.add(coinMesh);
  const gcv = document.createElement('canvas'); gcv.width = gcv.height = 256; const gg = gcv.getContext('2d');
  const grd = gg.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, 'rgba(255,190,90,.55)'); grd.addColorStop(0.35, 'rgba(247,147,26,.22)'); grd.addColorStop(1, 'rgba(247,147,26,0)');
  gg.fillStyle = grd; gg.fillRect(0, 0, 256, 256);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(gcv), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  glow.scale.set(11, 11, 1); glow.position.z = -0.8; coin.add(glow);
  const setCoinOp = o => {
    mF.opacity = mB.opacity = mS.opacity = o; coinMesh.visible = o > 0.003;
    mF.depthWrite = mB.depthWrite = mS.depthWrite = o > 0.95;
  };

  /* ---------------- dust: particles that form the coin ---------------- */
  const N = low ? 4200 : 13000;
  const BH_POS = new THREE.Vector3(0, 0, -10), TILT = 0.16;
  const dustU = { uTime: { value: 0 }, uMix: { value: 0 }, uMix2: { value: 0 }, uPhase: { value: 0 }, uSize: { value: low ? 0.3 : 0.2 }, uPR: { value: PR }, uOp: { value: 0 }, uBH: { value: BH_POS.clone() }, uTilt: { value: TILT }, uCoinM: { value: new THREE.Matrix4() } };
  const DUST_VS = `uniform float uTime,uMix,uMix2,uPhase,uSize,uPR,uOp,uTilt;uniform vec3 uBH;uniform mat4 uCoinM;
attribute vec3 aStart,aColor;attribute float aRand,aDR,aDA;varying vec3 vC;varying float vA;
float eio(float x){return x<.5?4.*x*x*x:1.-pow(-2.*x+2.,3.)/2.;}
void main(){
  float an=aDA+uTime*(2.4/pow(aDR,1.1));
  vec3 dp=vec3(cos(an)*aDR,0.,sin(an)*aDR);float c=cos(uTilt),s=sin(uTilt);
  dp=uBH+vec3(dp.x,dp.y*c-dp.z*s,dp.y*s+dp.z*c);
  vec3 from=mix((uCoinM*vec4(aStart,1.)).xyz,dp,uPhase);
  vec3 to=(uCoinM*vec4(position,1.)).xyz;
  float m=mix(uMix,uMix2,uPhase);
  float p=eio(clamp(m*1.45-aRand*.45,0.,1.));
  vec3 pos=mix(from,to,p);
  float sw=sin(p*3.14159);
  pos+=vec3(sin(uTime*1.7+aRand*50.),cos(uTime*1.3+aRand*37.),sin(uTime*.9+aRand*21.))*(sw*.6+(1.-p)*(1.-uPhase)*.35);
  vec4 mv=modelViewMatrix*vec4(pos,1.);
  gl_PointSize=min(26.*uPR,uSize*uPR*(.55+aRand*.9)*(260./max(.5,-mv.z)));
  gl_Position=projectionMatrix*mv;
  vC=aColor;vA=uOp*smoothstep(.8,5.,-mv.z)*(p>.98?.85+.15*sin(uTime*4.+aRand*90.):.6+.4*sin(uTime*3.+aRand*80.));
}`;
  let dust = null;
  function buildDust(img) {
    const S = 180, c = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0, S, S);
    const d = g.getImageData(0, 0, S, S).data, cand = [], w = []; let sum = 0;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4; if (d[i + 3] < 140) continue;
      const l = (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11) / 255; sum += 0.15 + l * l * 1.6; cand.push(i); w.push(sum);
    }
    if (!cand.length) return;
    const pick = () => { const v = Math.random() * sum; let lo = 0, hi = w.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (w[m] < v) lo = m + 1; else hi = m; } return cand[lo]; };
    const A = new Float32Array(N * 3), B = new Float32Array(N * 3), C = new Float32Array(N * 3), Rn = new Float32Array(N), DR = new Float32Array(N), DA = new Float32Array(N);
    for (let k = 0; k < N; k++) {
      const r = 5 + Math.cbrt(Math.random()) * 12, u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u);
      A[k * 3] = r * s * Math.cos(a); A[k * 3 + 1] = r * u * 0.62; A[k * 3 + 2] = r * s * Math.sin(a);
      let tx_, ty, tz, cr, cg, cb;
      if (Math.random() < 0.12) {
        const an = Math.random() * Math.PI * 2; tx_ = Math.cos(an) * CR; ty = Math.sin(an) * CR; tz = (Math.random() - 0.5) * CH; cr = 1; cg = 0.72; cb = 0.3;
      } else {
        const i = pick(), px = (i / 4) % S, py = Math.floor(i / 4 / S);
        tx_ = (px / S - 0.5) * 2 * CR; ty = (0.5 - py / S) * 2 * CR; tz = CH / 2 + 0.02 + Math.random() * 0.02;
        cr = d[i] / 255; cg = d[i + 1] / 255; cb = d[i + 2] / 255; const L = Math.max(cr, cg, cb) || 1, bo = 1.15 / L;
        cr = Math.min(1, cr * bo); cg = Math.min(1, cg * bo); cb = Math.min(1, cb * bo);
      }
      B[k * 3] = tx_; B[k * 3 + 1] = ty; B[k * 3 + 2] = tz; C[k * 3] = cr; C[k * 3 + 1] = cg; C[k * 3 + 2] = cb;
      Rn[k] = Math.random(); DR[k] = 5.6 + Math.pow(Math.random(), 0.8) * 13; DA[k] = Math.random() * Math.PI * 2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(B, 3)); geo.setAttribute('aStart', new THREE.BufferAttribute(A, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(C, 3)); geo.setAttribute('aRand', new THREE.BufferAttribute(Rn, 1));
    geo.setAttribute('aDR', new THREE.BufferAttribute(DR, 1)); geo.setAttribute('aDA', new THREE.BufferAttribute(DA, 1));
    dust = new THREE.Points(geo, new THREE.ShaderMaterial({ uniforms: dustU, vertexShader: DUST_VS, fragmentShader: PT_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    dust.frustumCulled = false; scene.add(dust);   // world space: targets follow the coin via uCoinM
  }
  const coinImg = new Image();
  coinImg.onload = () => buildDust(coinImg);
  coinImg.src = 'assets/coin-front.png';

  /* ---------------- tunnel of real blocks ---------------- */
  const tunnel = new THREE.Group(); tunnel.visible = false; scene.add(tunnel);
  const NB = 15, RZ = 7, BOX = low ? 22 : 30, TR = 3.4;
  const boxGeo = new THREE.BoxGeometry(0.34, 0.34, 1.7), boxMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const rings = [], dimC = new THREE.Color(0x2a1c0a), litA = new THREE.Color(0xffb347), litB = new THREE.Color(0xfff1c9);
  {
    const m = new THREE.Matrix4(), qq = new THREE.Quaternion(), pp = new THREE.Vector3(), sc = new THREE.Vector3(1, 1, 1), ax = new THREE.Vector3(0, 0, 1);
    for (let i = 0; i < NB; i++) {
      const im = new THREE.InstancedMesh(boxGeo, boxMat, BOX);
      for (let k = 0; k < BOX; k++) {
        const a = k / BOX * Math.PI * 2 + i * 0.21; pp.set(Math.cos(a) * TR, Math.sin(a) * TR, 0); qq.setFromAxisAngle(ax, a);
        m.compose(pp, qq, sc); im.setMatrixAt(k, m); im.setColorAt(k, k % 4 ? dimC : litA);
      }
      im.position.z = -i * RZ; tunnel.add(im); rings.push({ im, label: null });
    }
    // chain rails
    const rp = [];
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; const x = Math.cos(a) * TR * 1.12, y = Math.sin(a) * TR * 1.12; rp.push(x, y, 2, x, y, -(NB - 1) * RZ - 2); }
    const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(rp, 3));
    tunnel.add(new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0x6b4a14, transparent: true, opacity: 0.55 })));
    // light streaks
    const n = low ? 260 : 700, p = new Float32Array(n * 6), c = new Float32Array(n * 6);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, r = 1.2 + Math.random() * 6.5, z = 8 - Math.random() * 118, l = 1.5 + Math.random() * 5;
      const x = Math.cos(a) * r, y = Math.sin(a) * r; p.set([x, y, z, x, y, z - l], i * 6);
      const col = Math.random() < 0.3 ? [1, 0.95, 0.85] : [1, 0.6, 0.15], k = 0.25 + Math.random() * 0.5;
      c.set([col[0] * k, col[1] * k, col[2] * k, 0, 0, 0], i * 6);
    }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(p, 3)); sg.setAttribute('color', new THREE.BufferAttribute(c, 3));
    tunnel.add(new THREE.LineSegments(sg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })));
  }
  function labelSprite(b) {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 200; const g = c.getContext('2d');
    g.textAlign = 'center'; g.fillStyle = 'rgba(247,147,26,.95)'; g.font = '700 70px "Space Grotesk",monospace';
    g.fillText('BLOCK #' + fmtN(b.height), 512, 80);
    const ago = Math.max(0, Math.round(Date.now() / 1000 - b.timestamp)), pool = (b.extras && b.extras.pool && b.extras.pool.name) || '';
    g.fillStyle = 'rgba(255,255,255,.86)'; g.font = '500 44px "Space Grotesk",monospace';
    g.fillText(`${fmtN(b.tx_count || 0)} tx · ${((b.size || 0) / 1e6).toFixed(2)} MB${pool ? ' · ' + pool : ''} · ${ago < 3600 ? Math.round(ago / 60) + 'm' : Math.round(ago / 3600) + 'h'} ago`, 512, 160);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
    s.scale.set(5.6, 1.1, 1); return s;
  }
  let blocksKey = '';
  function applyBlocks(bl) {
    if (!bl || !bl.length) return;
    const k = bl.map(b => b.height).join(','); if (k === blocksKey) return; blocksKey = k;
    const mx = Math.max(...bl.map(b => b.tx_count || 0)) || 1;
    rings.forEach((r, i) => {
      const b = bl[i]; if (!b) return;
      const lit = Math.max(2, Math.round(BOX * (b.tx_count || 0) / mx));
      for (let j = 0; j < BOX; j++) r.im.setColorAt(j, j < lit ? (j % 3 ? litA : litB) : dimC);
      r.im.instanceColor.needsUpdate = true;
      if (r.label) { tunnel.remove(r.label); r.label.material.map.dispose(); r.label.material.dispose(); }
      r.label = labelSprite(b); r.label.position.set(0, TR + 1.25, -i * RZ); tunnel.add(r.label);
    });
  }

  /* ---------------- globe drawn by real Bitcoin nodes ---------------- */
  const GC = new THREE.Vector3(0, 0, -128), GR = 5;
  const globe = new THREE.Group(); globe.position.copy(GC); globe.visible = false; scene.add(globe);
  const ll = (la, lo, r) => { const ph = (90 - la) * Math.PI / 180, th = (lo + 180) * Math.PI / 180; return new THREE.Vector3(-r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph), r * Math.sin(ph) * Math.sin(th)); };
  globe.add(new THREE.Mesh(new THREE.SphereGeometry(GR * 0.99, 64, 48), new THREE.MeshBasicMaterial({ color: 0x05070b })));
  const atmU = { c: { value: new THREE.Color(0xf7931a) }, uOp: { value: 0 } };
  globe.add(new THREE.Mesh(new THREE.SphereGeometry(GR * 1.13, 64, 48), new THREE.ShaderMaterial({
    uniforms: atmU, side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
    vertexShader: 'varying vec3 vN;varying vec3 vV;void main(){vN=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.);vV=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}',
    fragmentShader: 'uniform vec3 c;uniform float uOp;varying vec3 vN;varying vec3 vV;void main(){float f=pow(1.-abs(dot(vN,vV)),3.4);gl_FragColor=vec4(c*f*.85*uOp,1.);}'
  })));
  const gridMat = new THREE.PointsMaterial({ color: 0x3b4656, size: 0.05, sizeAttenuation: true, transparent: true, opacity: 0, depthWrite: false });
  {
    const pts = [];
    for (let la = -84; la <= 84; la += 3) { const st = 3 / Math.max(0.15, Math.cos(la * Math.PI / 180)); for (let lo = -180; lo < 180; lo += st) { const v = ll(la, lo, GR * 1.002); pts.push(v.x, v.y, v.z); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); globe.add(new THREE.Points(g, gridMat));
  }
  const nodeU = { uTime: { value: 0 }, uPR: { value: PR }, uOp: { value: 0 } };
  const NODE_VS = `attribute float aS;uniform float uTime,uPR,uOp;varying vec3 vC;varying float vA;
void main(){vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=aS*uPR*(34./max(.5,-mv.z));gl_Position=projectionMatrix*mv;
vC=mix(vec3(1.,.55,.1),vec3(1.,.93,.75),clamp((aS-1.)/4.,0.,1.));vA=uOp*(.75+.25*sin(uTime*2.+position.x*7.+position.y*3.));}`;
  const arcs = [], pulses = { pts: null, list: [] }, arcMat = new THREE.LineBasicMaterial({ color: 0xffa43a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  let nodesInfo = null;
  function applyNodes(nd) {
    if (!nd || !nd.cells || !nd.cells.length || nodesInfo) return;
    nodesInfo = nd;
    const P = [], Sz = [];
    nd.cells.forEach(([la, lo, n]) => { const v = ll(la, lo, GR * 1.008); P.push(v.x, v.y, v.z); Sz.push(1 + Math.log2(1 + n) * 0.9); });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('aS', new THREE.Float32BufferAttribute(Sz, 1));
    const pts = new THREE.Points(g, new THREE.ShaderMaterial({ uniforms: nodeU, vertexShader: NODE_VS, fragmentShader: PT_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    globe.add(pts);
    // hubs = densest cells at least 14° apart; arcs between hubs (illustrative links between real node clusters)
    const hubs = [];
    for (const [la, lo] of nd.cells) {
      if (hubs.every(h => Math.hypot(h[0] - la, ((h[1] - lo + 540) % 360) - 180) > 14)) hubs.push([la, lo]);
      if (hubs.length >= 14) break;
    }
    const pp = [];
    hubs.forEach((h, i) => [1, 3].forEach(j => {
      const o = hubs[(i + j) % hubs.length]; if (!o || o === h) return;
      const a = ll(h[0], h[1], GR * 1.01), b = ll(o[0], o[1], GR * 1.01), d = a.distanceTo(b);
      const mid = a.clone().add(b).normalize().multiplyScalar(GR * (1.04 + d * 0.11));
      const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
      globe.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(48)), arcMat));
      arcs.push(curve); pulses.list.push({ c: curve, o: Math.random(), s: 0.18 + Math.random() * 0.22 }); pp.push(0, 0, 0);
    }));
    if (pp.length) {
      const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.Float32BufferAttribute(pp, 3));
      pulses.pts = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0xfff1c9, size: 0.22, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
      globe.add(pulses.pts);
    }
  }
  // capital-flow rings around the globe
  const flowRings = [];
  [[7.2, 0.35, 0.22, 0xf7931a], [8.4, -0.55, -0.15, 0xffd27a], [9.6, 1.05, 0.1, 0x38bdf8]].forEach(([R, tilt, sp, col]) => {
    const n = low ? 500 : 1400, p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, r = R + (Math.random() - 0.5) * 0.5; p[i * 3] = Math.cos(a) * r; p[i * 3 + 1] = (Math.random() - 0.5) * 0.18; p[i * 3 + 2] = Math.sin(a) * r; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: col, size: 0.07, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    const holder = new THREE.Group(); holder.rotation.x = tilt; holder.add(pts); globe.add(holder); flowRings.push({ pts, sp });
  });

  /* ---------------- black hole ---------------- */
  const bh = new THREE.Group(); bh.position.copy(BH_POS); bh.visible = false; scene.add(bh);
  const HR = 4.2;
  const RING_C = new THREE.Vector3(0, 0, BH_POS.z - 0.5), RING_FIT = HR * 1.02;   // coin fills the white photon ring
  bh.add(new THREE.Mesh(new THREE.SphereGeometry(HR, 64, 48), new THREE.MeshBasicMaterial({ color: 0x000000 })));
  const DISK_VS = 'varying vec2 vP;void main(){vP=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}';
  const DISK_FS = `uniform float uTime,uIn,uOut,uOp;varying vec2 vP;${NOISE}
void main(){float r=length(vP),a=atan(vP.y,vP.x),x=(r-uIn)/(uOut-uIn);if(x<0.||x>1.)discard;
float sw=a+uTime*.35+3.2/(r*.32);
float n=noise(vec2(sw*3.,r*1.6-uTime*.4))*.6+noise(vec2(sw*9.,r*4.))*.4;
float bands=.55+.45*sin(r*5.5-uTime*1.2+n*4.);
float fall=pow(1.-x,1.7)*smoothstep(0.,.05,x);
float dop=1.+.55*cos(a-.6);
vec3 col=mix(vec3(1.,.93,.78),vec3(1.,.58,.12),smoothstep(0.,.32,x));col=mix(col,vec3(.55,.12,.02),smoothstep(.32,1.,x));
float I=fall*(.45+.75*n)*bands*dop;gl_FragColor=vec4(col*I*1.8*uOp,1.);}`;
  const HALO_FS = `uniform float uTime,uIn,uOut,uOp;varying vec2 vP;${NOISE}
void main(){float r=length(vP),a=atan(vP.y,vP.x),x=(r-uIn)/(uOut-uIn);if(x<0.||x>1.)discard;
float ring=exp(-pow((r-uIn*1.035)/(.05*uIn),2.))*2.4;
float n=noise(vec2(a*6.+uTime*.6,r*2.-uTime*.3));
float lens=pow(1.-x,2.4)*(.35+.65*n)*(.45+.55*abs(sin(a)));
vec3 col=mix(vec3(1.,.9,.72),vec3(1.,.5,.1),clamp(x*1.6,0.,1.));
gl_FragColor=vec4(col*(ring+lens*1.2)*uOp,1.);}`;
  const diskU = { uTime: { value: 0 }, uIn: { value: HR * 1.3 }, uOut: { value: 20 }, uOp: { value: 0 } };
  const disk = new THREE.Mesh(new THREE.RingGeometry(HR * 1.3, 20, 256, 6), new THREE.ShaderMaterial({ uniforms: diskU, vertexShader: DISK_VS, fragmentShader: DISK_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  disk.rotation.x = -Math.PI / 2 + TILT; bh.add(disk);
  const haloU = { uTime: diskU.uTime, uIn: { value: HR * 1.0 }, uOut: { value: HR * 2.4 }, uOp: { value: 0 } };
  const halo = new THREE.Mesh(new THREE.RingGeometry(HR, HR * 2.4, 256, 4), new THREE.ShaderMaterial({ uniforms: haloU, vertexShader: DISK_VS, fragmentShader: HALO_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.position.z = -0.5; bh.add(halo);
  const infU = { uTime: diskU.uTime, uIn: { value: HR * 1.3 }, uOut: { value: 20 }, uPR: { value: PR }, uSize: { value: low ? 0.28 : 0.2 }, uOp: { value: 0 }, uTilt: { value: TILT } };
  {
    const n = low ? 1500 : 5000, g = new THREE.BufferGeometry(), a1 = new Float32Array(n), a2 = new Float32Array(n), a3 = new Float32Array(n), a4 = new Float32Array(n);
    for (let i = 0; i < n; i++) { a1[i] = Math.random() * (20 - HR * 1.3); a2[i] = Math.random() * Math.PI * 2; a3[i] = 0.5 + Math.random() * 1.5; a4[i] = Math.random() - 0.5; }
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('aR0', new THREE.BufferAttribute(a1, 1)); g.setAttribute('aA0', new THREE.BufferAttribute(a2, 1));
    g.setAttribute('aSp', new THREE.BufferAttribute(a3, 1)); g.setAttribute('aY', new THREE.BufferAttribute(a4, 1));
    const inf = new THREE.Points(g, new THREE.ShaderMaterial({
      uniforms: infU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fragmentShader: PT_FS,
      vertexShader: `attribute float aR0,aA0,aSp,aY;uniform float uTime,uIn,uOut,uPR,uSize,uOp,uTilt;varying vec3 vC;varying float vA;
void main(){float span=uOut-uIn;float r=uIn+mod(aR0-uTime*aSp,span);float a=aA0+uTime*(3.2/pow(r,1.15));
vec3 p=vec3(cos(a)*r,aY*(.15+r*.05),sin(a)*r);float c=cos(uTilt),s=sin(uTilt);p=vec3(p.x,p.y*c-p.z*s,p.y*s+p.z*c);
vec4 mv=modelViewMatrix*vec4(p,1.);gl_PointSize=uSize*uPR*(260./max(.5,-mv.z));gl_Position=projectionMatrix*mv;
float x=(r-uIn)/span;vA=uOp*(1.-x)*smoothstep(0.,.08,x)*smoothstep(1.,.85,x);vC=mix(vec3(1.,.92,.75),vec3(1.,.45,.08),x);}`
    }));
    inf.frustumCulled = false; bh.add(inf);
  }

  /* ---------------- bloom (desktop) ---------------- */
  let composer = null, bloom = null;
  const loadScript = u => new Promise((res, rej) => { const s = document.createElement('script'); s.src = u; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  async function initBloom() {
    if (low) return;
    const base = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/';
    try {
      for (const f of ['shaders/CopyShader.js', 'shaders/LuminosityHighPassShader.js', 'postprocessing/EffectComposer.js', 'postprocessing/RenderPass.js', 'postprocessing/ShaderPass.js', 'postprocessing/UnrealBloomPass.js']) await loadScript(base + f);
      const c = new THREE.EffectComposer(renderer); c.setPixelRatio(PR);
      c.addPass(new THREE.RenderPass(scene, cam));
      bloom = new THREE.UnrealBloomPass(new THREE.Vector2(hero.clientWidth, hero.clientHeight), 0.9, 0.5, 0.58);
      c.addPass(bloom); composer = c; size();
    } catch (e) { composer = null; bloom = null; }
  }

  /* ---------------- live REAL data ---------------- */
  const D = {};
  const fmtH = h => h >= 1e21 ? (h / 1e21).toFixed(2) + ' ZH/s' : (h / 1e18).toFixed(0) + ' EH/s';
  async function live() {
    const j = async u => { try { const r = await fetch(u, { cache: 'no-store' }); return r.ok ? await r.json() : null; } catch (e) { return null; } };
    const [ch, bl, fe, hr, tk] = await Promise.all([
      j('data/chain.json?v=' + Math.floor(Date.now() / 6e5)),
      j('https://mempool.space/api/v1/blocks'),
      j('https://mempool.space/api/v1/fees/recommended'),
      j('https://mempool.space/api/v1/mining/hashrate/3d'),
      j('https://data-api.binance.vision/api/v3/ticker/24hr?symbol=BTCUSDT')]);
    D.blocks = bl && bl.length ? bl : (ch && ch.blocks) || D.blocks || null;
    D.fee = fe ? fe.halfHourFee : (ch && ch.fees ? ch.fees.halfHourFee : D.fee);
    D.hash = hr && hr.currentHashrate ? hr.currentHashrate : (ch && ch.hashrate) || D.hash;
    if (tk && tk.lastPrice) { D.price = +tk.lastPrice; D.chg = +tk.priceChangePercent; }
    if (ch && ch.nodes) D.nodes = ch.nodes;
    if (D.blocks) applyBlocks(D.blocks);
    if (D.nodes) applyNodes(D.nodes);
    renderChips();
  }
  function renderChips() {
    if (!chips || (!titled && !reduce)) return;
    const c = [];
    if (D.price) c.push(`<span title="Binance · BTC/USDT">₿ <b>$${D.price.toLocaleString('en-US', { maximumFractionDigits: 0 })}</b> <i class="${D.chg >= 0 ? 'up' : 'dn'}">${D.chg >= 0 ? '+' : ''}${D.chg.toFixed(2)}%</i></span>`);
    const b = D.blocks && D.blocks[0];
    if (b) c.push(`<span title="mempool.space · latest block">⛏ <b>#${fmtN(b.height)}</b> · ${fmtN(b.tx_count)} tx</span>`);
    if (D.hash) c.push(`<span title="mempool.space · network hashrate">⚡ <b>${fmtH(D.hash)}</b></span>`);
    if (D.fee != null) c.push(`<span title="mempool.space · ~30 min fee">⛽ <b>${D.fee}</b> sat/vB</span>`);
    if (D.nodes && D.nodes.total) c.push(`<span title="bitnodes.io · reachable nodes">🌍 <b>${fmtN(D.nodes.total)}</b> ${tx('nodeW')}</span>`);
    chips.innerHTML = c.join(''); chips.classList.toggle('on', c.length > 0);
  }

  /* ---------------- timeline ---------------- */
  const S = (t, a, b) => t <= a ? 0 : t >= b ? 1 : (t - a) / (b - a);
  const EIO = x => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2, EI = x => x * x * x, EO = x => 1 - Math.pow(1 - x, 3), SN = x => -(Math.cos(Math.PI * x) - 1) / 2;
  const lerp = (a, b, x) => a + (b - a) * x;
  const GOLD = 'radial-gradient(circle at 50% 50%,#fff6e0 0%,#ffb347 40%,#f7931a 75%,#7a3a00 100%)';
  let t = 0, uT = 0, titled = false, ready = false, paused = false, capNow = '', mx = 0, my = 0, smx = 0, smy = 0, viewK = -1, lastFov = 0;
  const seen = (() => { try { return sessionStorage.getItem('ek_cine') === '1'; } catch (e) { return false; } })();
  if (reduce) t = 23; else if (seen) t = 15.5;
  if (t < 21) hero.classList.add('cine-intro');
  const vEnd = new THREE.Vector3();

  function reveal() {
    titled = true; hero.classList.remove('cine-intro'); hero.classList.add('cine-titled');
    try { sessionStorage.setItem('ek_cine', '1'); } catch (e) { }
    if (btn) { btn.textContent = tx('replay'); btn.dataset.m = 'replay'; }
    renderChips();
  }
  if (btn) {
    btn.textContent = t < 21 ? tx('skip') : tx('replay'); btn.dataset.m = t < 21 ? 'skip' : 'replay';
    btn.addEventListener('click', () => {
      if (btn.dataset.m === 'skip') { t = Math.max(t, 20.6); }
      else { t = 0; titled = false; hero.classList.add('cine-intro'); hero.classList.remove('cine-titled'); if (chips) chips.classList.remove('on'); btn.textContent = tx('skip'); btn.dataset.m = 'skip'; }
      kick();
    });
  }
  hero.addEventListener('pointermove', e => { const r = hero.getBoundingClientRect(); mx = (e.clientX - r.left) / r.width - 0.5; my = (e.clientY - r.top) / r.height - 0.5; });

  function update(dt) {
    uT += dt;
    dustU.uTime.value = diskU.uTime.value = nodeU.uTime.value = uT;
    smx += (mx - smx) * 0.05; smy += (my - smy) * 0.05;
    const A = t < 8, B = t >= 8 && t < 15.5, C = t >= 15.5;
    coin.visible = A || C; tunnel.visible = B && t < 12.8; globe.visible = B && t > 9; bh.visible = C;
    if (dust) dust.visible = coin.visible;
    stars.material.opacity = A ? 0.9 * S(t, 0, 2) : B ? 0.55 : 0.85;
    scene.fog.density = B && t < 12 ? 0.028 * (1 - S(t, 11, 12)) : 0.00001;
    let fov = 40, flash = 0, flashBg = '#000', bloomS = 1.0, k = 0;
    if (A) {
      dustU.uPhase.value = 0; dustU.uOp.value = S(t, 0.2, 2) * (1 - 0.72 * S(t, 5.2, 6.4)); dustU.uMix.value = EIO(S(t, 2.5, 5.8));
      setCoinOp(S(t, 5, 6.2)); glow.material.opacity = 0.9 * S(t, 4.6, 6.2);
      coin.position.set(0, 0, 0); coin.scale.setScalar(1);
      coin.rotation.set(Math.sin(uT * 0.7) * 0.08 * (1 - S(t, 6, 6.6)), (1 - EIO(S(t, 2.2, 6.4))) * Math.PI * 1.5, 0);
      const z = t < 6 ? lerp(18, 13.5, SN(S(t, 0, 6))) : lerp(13.5, 1.15, EI(S(t, 6, 8)));
      cam.position.set(0, 0, z); look.set(0, 0, 0);
      fov = lerp(40, 78, EI(S(t, 6.2, 8)));
      flash = EI(S(t, 7.35, 8)); flashBg = GOLD; backL.intensity = 0; bloomS = lerp(0.85, 1.2, S(t, 5.5, 8));
    } else if (B) {
      if (t < 12) {
        const z = lerp(6, -104, EO(S(t, 8, 12)));
        cam.position.set(Math.sin(uT * 0.7) * 0.25, Math.cos(uT * 0.5) * 0.2, z);
        look.set(0, 0, lerp(z - 10, GC.z, EIO(S(t, 10.8, 12))));
        fov = lerp(78, 55, S(t, 8, 12));
      } else {
        const kk = EIO(S(t, 12, 15.5)), a = kk * 1.15, R = lerp(24, 17.5, kk);
        cam.position.set(Math.sin(a) * R, lerp(0, 2, kk), GC.z + Math.cos(a) * R); look.copy(GC);
        fov = lerp(55, 42, S(t, 12, 15.5));
      }
      flash = t < 8.6 ? 1 - S(t, 8, 8.6) : S(t, 15.0, 15.5); flashBg = t < 8.6 ? GOLD : '#000';
      globe.rotation.set(0.42, uT * 0.12 - 1.2, 0);
      const gOp = S(t, 11.2, 12.6);
      nodeU.uOp.value = gOp; gridMat.opacity = 0.9 * gOp; atmU.uOp.value = gOp;
      arcMat.opacity = 0.55 * S(t, 12.6, 13.6);
      flowRings.forEach(f => { f.pts.material.opacity = 0.75 * S(t, 12.8, 13.8); f.pts.parent.rotation.y = uT * f.sp; });
      if (pulses.pts) {
        pulses.pts.material.opacity = S(t, 12.8, 13.6);
        const pa = pulses.pts.geometry.attributes.position;
        pulses.list.forEach((p, i) => { p.c.getPoint((uT * p.s + p.o) % 1, vEnd); pa.setXYZ(i, vEnd.x, vEnd.y, vEnd.z); });
        pa.needsUpdate = true;
      }
      bloomS = t < 12 ? 1.15 : 0.8;
    } else {
      const kk = EO(S(t, 15.5, 20.5)), idle = S(t, 20.5, 23);
      const aspect = cam.aspect || 1.6, zF = Math.max(17, 7.6 / (0.384 * aspect) - 10);
      cam.position.set(Math.sin(uT * 0.13) * 1.4 * idle + smx * 2.2 * idle, lerp(5.5, 1.0, kk) - smy * 1.2 * idle, lerp(46, zF, kk));
      look.set(0, lerp(-1, -0.2, kk), -3);
      fov = 42;
      diskU.uOp.value = haloU.uOp.value = S(t, 15.5, 16.6); infU.uOp.value = S(t, 15.8, 17);
      halo.quaternion.copy(cam.quaternion);
      dustU.uPhase.value = 1; dustU.uMix2.value = EIO(S(t, 17.2, 20.4)); dustU.uOp.value = S(t, 15.6, 16.6) * (1 - 0.78 * S(t, 20, 21.5));
      setCoinOp(S(t, 19.6, 21)); glow.material.opacity = 0.7 * S(t, 19.6, 21);
      { // keep the coin concentric with the white ring and exactly its size, whatever the camera does
        const f = cam.position.z / (cam.position.z - RING_C.z);
        coin.position.copy(cam.position).lerp(RING_C, f); coin.scale.setScalar(RING_FIT * f / CR);
      }
      coin.rotation.set(Math.sin(uT * 0.6) * 0.06 * idle, t < 21 ? 0 : Math.sin((t - 21) * 0.32) * 0.3 + smx * 0.35, 0);
      backL.intensity = 2.6 * S(t, 19, 21);
      flash = 1 - S(t, 15.5, 16.3); flashBg = '#000'; bloomS = lerp(0.9, 0.55, S(t, 18, 21));
      k = (aspect > 1 ? 0.045 : 0.12) * EIO(S(t, 19, 22.5));
    }
    coin.updateMatrixWorld(); dustU.uCoinM.value.copy(coin.matrixWorld);
    if (Math.abs(fov - lastFov) > 0.01 || Math.abs(k - viewK) > 0.0005) {
      cam.fov = fov; lastFov = fov; viewK = k;
      const w = hero.clientWidth, h = hero.clientHeight;
      if (k > 0.0005) cam.setViewOffset(w, h, 0, h * k, w, h); else cam.clearViewOffset();
      cam.updateProjectionMatrix();
    }
    cam.lookAt(look);
    if (B && t < 12) cam.rotateZ(Math.sin(uT * 0.4) * 0.08);
    if (fx) { fx.style.opacity = flash.toFixed(3); if (fx.dataset.bg !== flashBg) { fx.style.background = flashBg; fx.dataset.bg = flashBg; } }
    if (bloom) bloom.strength = bloomS;
    let c = '';
    if (B && t >= 8.4 && t < 11.8 && D.blocks) c = tx('blocks');
    else if (B && t >= 12.4 && t < 15.2 && nodesInfo) c = tx('nodes')(fmtN(nodesInfo.total), nodesInfo.countries || 0);
    if (cap && c !== capNow) { capNow = c; cap.textContent = c; cap.classList.toggle('on', !!c); }
    if (!titled && t >= 21) reveal();
  }

  /* ---------------- loop ---------------- */
  function size() {
    const w = hero.clientWidth, h = hero.clientHeight;
    renderer.setSize(w, h, false); cam.aspect = w / h; viewK = -1; lastFov = 0;
    if (composer) composer.setSize(w, h);
  }
  size(); addEventListener('resize', size);
  let visible = true, raf = 0, last = performance.now(), still = 0;
  function frame(now) {
    raf = 0;
    if (!visible || document.hidden) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (ready && !paused) t += dt;
    update(paused ? 0 : dt);
    if (composer) composer.render(); else renderer.render(scene, cam);
    if (reduce && titled && texReady >= 4) { if (++still > 3) return; }   // reduced motion: settle on a static frame
    raf = requestAnimationFrame(frame);
  }
  function kick() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } }
  new IntersectionObserver(e => { visible = e[0].isIntersecting; if (visible) kick(); }, { threshold: 0.01 }).observe(hero);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });

  const start = performance.now();
  (function waitReady() { if ((texReady >= 4 && dust) || performance.now() - start > 3500) { ready = true; return; } setTimeout(waitReady, 100); })();
  initBloom(); live(); setInterval(() => { if (!document.hidden && visible) live(); }, 90000);
  kick();
  window.__cine = { seek: x => { t = x; ready = true; kick(); }, pause: v => { paused = v !== false; }, time: () => t, data: D, render: () => { update(0); if (composer) composer.render(); else renderer.render(scene, cam); } };
})();
