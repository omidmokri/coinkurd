/* entekhab.net · real space engine (the homepage's Earth, /station/).
   One renderer draws the real night sky (15,500 catalogued stars at their true positions and colours, and the Milky Way
   from a galactic-coordinate model) and a photographic Earth: NASA Blue Marble by day, Black Marble city lights by night,
   moving clouds with their shadows, ocean glint, relief, and a thin blue atmosphere that turns warm at the terminator.
   ES5 + the site's own three.js r128 (global THREE). No network beyond this folder. */
(function (W) {
  'use strict';
  var T = W.THREE;
  var REDUCED = W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var SMALL = Math.min(screen.width, screen.height) < 820;
  var BASE = (document.currentScript && document.currentScript.src || '').replace(/[^\/]*$/, '');

  function tex(loader, url, cb) {
    var t = loader.load(BASE + url, cb);
    t.anisotropy = 4;
    return t;
  }

  /* ---------------- the sky ---------------- */
  function bvToRGB(bv) {           // B-V colour index -> linear-ish RGB (Ballesteros temperature, blackbody fit)
    bv = Math.max(-0.4, Math.min(2.0, bv));
    var t = 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62)) / 100, r, g, b;
    r = t <= 66 ? 255 : 329.7 * Math.pow(t - 60, -0.1332);
    g = t <= 66 ? 99.47 * Math.log(t) - 161.12 : 288.12 * Math.pow(t - 60, -0.0755);
    b = t >= 66 ? 255 : (t <= 19 ? 0 : 138.52 * Math.log(t - 10) - 305.04);
    function c(x) { return Math.max(0, Math.min(255, x)) / 255; }
    // keep stars mostly white to the eye, as they are: mix 55% toward white
    return [0.45 * c(r) + 0.55, 0.45 * c(g) + 0.55, 0.45 * c(b) + 0.55];
  }

  function radec(ra, dec, R) {     // equatorial -> scene (y = celestial north)
    var a = ra * Math.PI / 180, d = dec * Math.PI / 180;
    return [R * Math.cos(d) * Math.cos(a), R * Math.sin(d), -R * Math.cos(d) * Math.sin(a)];
  }

  function Sky(scene, loader, opt) {
    var group = new T.Group();
    scene.add(group);
    this.group = group;
    var R = 900;
    // Milky Way shell
    var mw = tex(loader, 'milkyway.webp');
    var mwMat = new T.ShaderMaterial({
      uniforms: { map: { value: mw }, gain: { value: opt.milky || 0.55 } },
      vertexShader: 'varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: 'uniform sampler2D map;uniform float gain;varying vec3 vP;' +
        'void main(){vec3 d=normalize(vP);float ra=atan(-d.z,d.x);float dec=asin(clamp(d.y,-1.,1.));' +
        'vec2 uv=vec2(fract(ra/6.2831853+1.),.5+dec/3.1415927);vec3 c=texture2D(map,uv).rgb;c=pow(c,vec3(2.2))*gain;' +
        'gl_FragColor=vec4(c,1.);}',
      side: T.BackSide, depthWrite: false, blending: T.AdditiveBlending, transparent: true
    });
    group.add(new T.Mesh(new T.SphereGeometry(R * 1.05, 48, 24), mwMat));

    var self = this;
    fetch(BASE + 'stars.b64.txt').then(function (r) { return r.text(); }).then(function (b) { b = atob(b.trim()); var u = new Uint8Array(b.length); for (var k = 0; k < b.length; k++) u[k] = b.charCodeAt(k); return u.buffer; }).then(function (buf) {
      var dv = new DataView(buf), n = Math.floor(buf.byteLength / 6), limit = opt.maxMag || (SMALL ? 6.3 : 7.0);
      var pos = [], col = [], size = [], seed = [];
      for (var i = 0; i < n; i++) {
        var o = i * 6, ra = dv.getUint16(o, true) / 180, dec = dv.getInt16(o + 2, true) / 360,
          mag = dv.getUint8(o + 4) / 28 - 1.5, bv = (dv.getUint8(o + 5) - 40) / 80;
        if (mag > limit) continue;
        var p = radec(ra, dec, R); pos.push(p[0], p[1], p[2]);
        var c = bvToRGB(bv); col.push(c[0], c[1], c[2]);
        // apparent brightness: flux ~ 10^(-0.4 m); size and alpha both follow it, gently
        var f = Math.pow(10, -0.4 * (mag - 1.0));
        size.push(Math.max(1.0, Math.min(7.5, 1.1 + 2.6 * Math.pow(f, 0.33))));
        seed.push(Math.random() * 6.283);
      }
      var g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
      g.setAttribute('color', new T.Float32BufferAttribute(col, 3));
      g.setAttribute('size', new T.Float32BufferAttribute(size, 1));
      g.setAttribute('seed', new T.Float32BufferAttribute(seed, 1));
      self.starMat = new T.ShaderMaterial({
        uniforms: { dpr: { value: Math.min(W.devicePixelRatio || 1, 2) }, time: { value: 0 }, gain: { value: opt.starGain || 1 } },
        vertexShader: 'attribute float size;attribute float seed;attribute vec3 color;uniform float dpr;uniform float time;' +
          'varying vec3 vC;varying float vA;void main(){vC=color;float tw=.86+.14*sin(time*1.7+seed*7.)*sin(time*.63+seed*3.);' +
          'vA=clamp(size/3.2,.18,1.)*tw;vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;gl_PointSize=size*dpr;}',
        fragmentShader: 'uniform float gain;varying vec3 vC;varying float vA;void main(){vec2 q=gl_PointCoord-.5;float r=length(q)*2.;' +
          'float core=smoothstep(1.,.0,r);core=core*core;float a=core*vA*gain;if(a<.004)discard;gl_FragColor=vec4(vC*a,a);}',
        transparent: true, depthWrite: false, blending: T.AdditiveBlending
      });
      group.add(new T.Points(g, self.starMat));
    }).catch(function () {});
  }
  Sky.prototype.tick = function (t) { if (this.starMat) this.starMat.uniforms.time.value = REDUCED ? 0 : t; };

  /* ---------------- the Earth ---------------- */
  var EARTH_VS = 'varying vec3 vN;varying vec3 vP;varying vec2 vUv;void main(){vUv=uv;vN=normal;vP=position;' +
    'gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}';
  var EARTH_FS = [
    'uniform sampler2D dayT,nightT,cloudT,maskT;uniform vec3 sunO,camO;uniform float cloudShift,lights,exposure;',
    'varying vec3 vN;varying vec3 vP;varying vec2 vUv;',
    'vec3 lin(vec3 c){return pow(c,vec3(2.2));}',
    'void main(){',
    ' vec3 n=normalize(vN);vec3 L=normalize(sunO);vec3 V=normalize(camO-vP);',
    // relief from the height map
    ' vec3 east=normalize(cross(vec3(0.,1.,0.),n)+1e-5);vec3 north=cross(n,east);',
    ' float h0=texture2D(maskT,vUv).g;float hx=texture2D(maskT,vUv+vec2(1./2048.,0.)).g;float hy=texture2D(maskT,vUv+vec2(0.,1./1024.)).g;',
    ' vec3 nb=normalize(n-(east*(hx-h0)+north*(hy-h0))*2.2);',
    ' float ocean=texture2D(maskT,vUv).r;',
    ' vec2 cuv=vec2(fract(vUv.x+cloudShift),vUv.y);float cl=texture2D(cloudT,cuv).r;',
    ' vec2 suv=cuv+vec2(-L.x,L.y)*.0016;float sh=texture2D(cloudT,suv).r;',
    ' float ndl=dot(nb,L);float nl=dot(n,L);',
    ' float dayK=smoothstep(-.10,.28,nl);',
    ' vec3 day=lin(texture2D(dayT,vUv).rgb)*1.18;',
    ' day*=1.-.42*sh*dayK;',
    ' vec3 lit=day*(max(ndl,0.)*.95*smoothstep(-.04,.16,nl)+.006*dayK);',
    // ocean glint
    ' vec3 H=normalize(L+V);float spec=(pow(max(dot(n,H),0.),90.)*.55+pow(max(dot(n,H),0.),18.)*.10)*ocean*(1.-cl);',
    ' lit+=vec3(1.,.93,.82)*spec*dayK+vec3(.20,.32,.55)*ocean*pow(1.-max(dot(n,V),0.),3.)*.18*dayK;',
    // clouds over everything, lit by the sun, faintly blue-grey in shadow
    ' float cdiff=max(nl*.9+.1,0.);',
    ' lit=mix(lit,vec3(1.)*cdiff*1.02,cl*.92*dayK);',
    // city lights where the sun has set
    ' vec3 ns=texture2D(nightT,vUv).rgb;float nightK=1.-smoothstep(-.16,.06,nl);',
    ' float Lc=clamp((ns.r-ns.b*.45-.01)*5.,0.,1.);',
    ' vec3 city=(vec3(1.,.70,.38)*pow(Lc,1.3)*1.5*lights*(1.-cl*.8)+lin(ns)*.07)*nightK;',
    // a warm band along the terminator
    ' float term=exp(-pow(nl/.11,2.))*.55;lit+=vec3(1.,.40,.12)*term*.010*(1.-ocean*.4);',
    ' vec3 c=lit+city;',
    // atmosphere seen through, toward the limb
    ' float fr=pow(1.-max(dot(n,V),0.),2.4);float al=smoothstep(-.15,.4,nl);vec3 atm=mix(vec3(.9,.45,.2),vec3(.30,.56,1.),smoothstep(.0,.3,nl));',
    ' c=mix(c,atm*al*1.05,fr*.7*al)+vec3(.02,.05,.12)*fr*al;',
    ' c*=exposure;c=c/(1.+c*.12);',
    ' gl_FragColor=vec4(pow(c,vec3(1./2.2)),1.);}'
  ].join('\n');

  var ATM_VS = 'varying vec3 vN;varying vec3 vP;void main(){vN=normal;vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}';
  var ATM_FS = 'uniform vec3 sunO,camO;uniform float strength,edge;varying vec3 vN;varying vec3 vP;void main(){' +
    'vec3 n=normalize(vN);vec3 V=normalize(camO-vP);float nl=dot(n,normalize(sunO));' +
    'float x=clamp(-dot(n,V)/edge,0.,1.);float rim=pow(x,3.2);' +
    'float lit=smoothstep(-.30,.45,nl);vec3 col=mix(vec3(1.,.50,.22),vec3(.32,.60,1.),smoothstep(-.02,.45,nl));' +
    'float a=rim*lit*strength;gl_FragColor=vec4(col*a,a);}';

  function Earth(scene, loader, opt) {
    var hi = !SMALL && (W.devicePixelRatio || 1) >= 1 && opt.hi !== false;
    var g = new T.Group();
    scene.add(g);
    this.group = g;
    this.radius = opt.radius || 1;
    var seg = SMALL ? 96 : 160;
    this.uni = {
      dayT: { value: tex(loader, hi ? 'earth-day-4k.webp' : 'earth-day-2k.webp', opt.onload) },
      nightT: { value: tex(loader, hi ? 'earth-night-4k.webp' : 'earth-night-2k.webp') },
      cloudT: { value: tex(loader, 'earth-clouds.webp') },
      maskT: { value: tex(loader, 'earth-mask.webp') },
      sunO: { value: new T.Vector3(1, 0, 0) }, camO: { value: new T.Vector3(0, 0, 5) },
      cloudShift: { value: 0 }, lights: { value: opt.lights == null ? 1 : opt.lights }, exposure: { value: opt.exposure || 1 }
    };
    this.uni.cloudT.value.wrapS = T.RepeatWrapping;
    var mat = new T.ShaderMaterial({ uniforms: this.uni, vertexShader: EARTH_VS, fragmentShader: EARTH_FS });
    this.mesh = new T.Mesh(new T.SphereGeometry(this.radius, seg, seg / 2), mat);
    g.add(this.mesh);
    this.atmU = { sunO: this.uni.sunO, camO: this.uni.camO, strength: { value: opt.atmo || 0.9 }, edge: { value: 0.33 } };
    var atm = new T.Mesh(new T.SphereGeometry(this.radius * 1.06, 96, 48), new T.ShaderMaterial({
      uniforms: this.atmU, vertexShader: ATM_VS, fragmentShader: ATM_FS,
      side: T.BackSide, transparent: true, depthWrite: false, blending: T.AdditiveBlending
    }));
    this.atm = atm;
    g.add(atm);
    this.spin = opt.spin == null ? 0.018 : opt.spin;       // radians a second
    this.sunW = (opt.sun || new T.Vector3(-0.95, 0.22, 0.42)).clone().normalize();
    // start with the given longitude facing the camera (lon 0 is +X in three's sphere; lon -90 is +Z)
    this.mesh.rotation.y = -((opt.faceLon == null ? 44 : opt.faceLon) + 90) * Math.PI / 180;
    this.mesh.rotation.x = (opt.tilt == null ? 0.32 : opt.tilt);
    this._inv = new T.Matrix4();
    this._v = new T.Vector3();
  }
  Earth.prototype.tick = function (dt, t, camera) {
    if (!REDUCED) this.mesh.rotation.y += this.spin * dt;
    this.uni.cloudShift.value = REDUCED ? 0 : t * 0.0009;
    this.mesh.updateMatrixWorld();
    this._inv.copy(this.mesh.matrixWorld).invert();
    // sun and camera into the planet's own frame
    this.uni.sunO.value.copy(this.sunW).transformDirection(this._inv);
    this.uni.camO.value.copy(camera.position).applyMatrix4(this._inv);
    this.atm.rotation.copy(this.mesh.rotation);
  };

  /* ---------------- a ready-made stage ---------------- */
  function Stage(canvas, opt) {
    opt = opt || {};
    var r = new T.WebGLRenderer({ canvas: canvas, antialias: true, alpha: !!opt.alpha, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(W.devicePixelRatio || 1, SMALL ? 1.6 : 2));
    r.setClearColor(0x000000, opt.alpha ? 0 : 1);
    this.renderer = r;
    this.scene = new T.Scene();
    this.camera = new T.PerspectiveCamera(opt.fov || 32, 1, 0.05, 3000);
    this.camera.position.set(0, 0, opt.distance || 4.2);
    this.loader = new T.TextureLoader();
    this.sky = opt.noSky ? { tick: function () { } } : new Sky(this.scene, this.loader, opt);
    this.earth = opt.noEarth ? null : new Earth(this.scene, this.loader, opt);
    this.canvas = canvas;
    this.onTick = null;
    this.visible = true;
    var self = this;
    this.resize = function () {
      var w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      r.setSize(w, h, false);
      self.camera.aspect = w / h;
      if (opt.frame) opt.frame(self.camera, w, h);
      self.camera.updateProjectionMatrix();
    };
    W.addEventListener('resize', this.resize);
    this.resize();
    if ('IntersectionObserver' in W) {
      new IntersectionObserver(function (e) { self.visible = e[0].isIntersecting; }).observe(canvas);
    }
    document.addEventListener('visibilitychange', function () { self.paused = document.hidden; });
    // drag to turn the planet (with a little inertia), on mouse and touch
    if (this.earth && opt.drag !== false) {
      var down = false, lx = 0, vel = 0, e = this.earth;
      canvas.addEventListener('pointerdown', function (ev) { down = true; lx = ev.clientX; vel = 0; canvas.style.cursor = 'grabbing'; });
      W.addEventListener('pointerup', function () { down = false; canvas.style.cursor = ''; });
      W.addEventListener('pointermove', function (ev) {
        if (!down) return; var dx = ev.clientX - lx; lx = ev.clientX; vel = dx * 0.005; e.mesh.rotation.y += vel;
      });
      this._inertia = function () { if (!down && Math.abs(vel) > 1e-4) { e.mesh.rotation.y += vel; vel *= 0.94; } };
    }
    var last = performance.now(), t0 = last;
    function loop(now) {
      requestAnimationFrame(loop);
      if (!self.visible || self.paused || self.hold) { last = now; return; }
      var dt = Math.min(0.05, (now - last) / 1000), t = (now - t0) / 1000; last = now;
      if (self._inertia) self._inertia();
      if (self.earth) self.earth.tick(dt, t, self.camera);
      self.sky.tick(t);
      if (self.onTick) self.onTick(dt, t);
      r.render(self.scene, self.camera);
    }
    requestAnimationFrame(loop);
  }

  function webgl() {
    try { var c = document.createElement('canvas'); return !!(W.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); }
    catch (e) { return false; }
  }

  W.EKSpace = { Stage: Stage, Earth: Earth, Sky: Sky, webgl: webgl, reduced: REDUCED, small: SMALL, radec: radec };
})(window);
