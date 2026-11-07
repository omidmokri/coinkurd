/* The academy's sound: every note here is synthesised by the browser.
   No audio file is shipped and no recording is borrowed, so the music is the
   academy's own and carries no licence. Songs and themes arrive as data from
   the page; this file only plays them. */
(function () {
  "use strict";
  var AC = null, master = null, musicGain = null, sfxGain = null, playing = null, timer = 0;

  function ctx() {
    if (!AC && (window.AudioContext || window.webkitAudioContext))
      AC = new (window.AudioContext || window.webkitAudioContext)();
    if (!AC) return null;
    if (AC.state === "suspended") AC.resume();
    if (!master) {
      master = AC.createGain(); master.gain.value = 0.9; master.connect(AC.destination);
      musicGain = AC.createGain(); musicGain.gain.value = 0.34; musicGain.connect(master);
      sfxGain = AC.createGain(); sfxGain.gain.value = 0.8; sfxGain.connect(master);
    }
    return AC;
  }
  function hz(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  /* ---- voices -------------------------------------------------------- */
  function voice(kind, note, at, dur, vel, out) {
    var c = AC, g = c.createGain(), o, o2, f;
    vel = vel == null ? 1 : vel;
    if (kind === "kick") {
      o = c.createOscillator(); o.type = "sine";
      o.frequency.setValueAtTime(150, at); o.frequency.exponentialRampToValueAtTime(42, at + .11);
      g.gain.setValueAtTime(.9 * vel, at); g.gain.exponentialRampToValueAtTime(.001, at + .18);
      o.connect(g); g.connect(out); o.start(at); o.stop(at + .2); return;
    }
    if (kind === "hat" || kind === "snare") {
      var n = c.createBufferSource(), len = Math.floor(c.sampleRate * .2);
      var buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      n.buffer = buf;
      f = c.createBiquadFilter(); f.type = kind === "hat" ? "highpass" : "bandpass";
      f.frequency.value = kind === "hat" ? 7000 : 1800; f.Q.value = kind === "hat" ? 1 : .8;
      g.gain.setValueAtTime((kind === "hat" ? .22 : .42) * vel, at);
      g.gain.exponentialRampToValueAtTime(.001, at + (kind === "hat" ? .05 : .14));
      n.connect(f); f.connect(g); g.connect(out); n.start(at); n.stop(at + .22); return;
    }
    var t = {lead: "triangle", pluck: "square", bass: "sine", pad: "sawtooth", bell: "sine"}[kind] || "triangle";
    o = c.createOscillator(); o.type = t; o.frequency.value = hz(note);
    var nodes = [o];
    if (kind === "pad" || kind === "lead") {
      o2 = c.createOscillator(); o2.type = t; o2.frequency.value = hz(note) * 1.005; nodes.push(o2);
    }
    f = c.createBiquadFilter(); f.type = "lowpass";
    f.frequency.value = kind === "bass" ? 700 : kind === "pad" ? 1600 : 4200; f.Q.value = .6;
    var peak = (kind === "bass" ? .5 : kind === "pad" ? .2 : kind === "pluck" ? .34 : .4) * vel;
    var atk = kind === "pad" ? .14 : .012, rel = kind === "pluck" ? .14 : kind === "pad" ? .5 : .22;
    g.gain.setValueAtTime(.0001, at);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, .002), at + atk);
    g.gain.setValueAtTime(Math.max(peak, .002), at + Math.max(dur - rel, atk + .01));
    g.gain.exponentialRampToValueAtTime(.0001, at + dur + .02);
    nodes.forEach(function (x) { x.connect(f); });
    f.connect(g); g.connect(out);
    nodes.forEach(function (x) { x.start(at); x.stop(at + dur + .06); });
  }

  /* ---- the little scheduler ------------------------------------------ */
  /* a song is {bpm, bars, loop, tracks:[{v:"lead", n:[[step, midi, len, vel], ...]}]}
     steps are sixteenths; a step of 16 is one bar */
  function stop() {
    if (timer) { clearInterval(timer); timer = 0; }
    playing = null;
  }
  function play(song, onStep) {
    var c = ctx(); if (!c || !song) return;
    stop();
    var spb = 60 / (song.bpm || 100) / 4;          /* seconds per sixteenth */
    var total = (song.bars || 8) * 16;
    var start = c.currentTime + .08, next = 0;
    playing = song;
    function tick() {
      if (playing !== song) return;
      while (start + next * spb < c.currentTime + .25) {
        var step = next % total, at = start + next * spb;
        song.tracks.forEach(function (tr) {
          for (var i = 0; i < tr.n.length; i++) {
            var e = tr.n[i];
            if (e[0] !== step) continue;
            voice(tr.v, e[1], at, (e[2] || 2) * spb, (e[3] == null ? 1 : e[3]) * (tr.g || 1), musicGain);
          }
        });
        if (onStep) onStep(step, Math.floor(next / total), at - c.currentTime);
        next++;
        if (!song.loop && next >= total) { stop(); return; }
      }
      timer = timer;
    }
    tick();
    timer = setInterval(tick, 25);
  }

  /* ---- one-shot effects ---------------------------------------------- */
  var SFX = {
    tap:   [["pluck", 76, 0, .08, .5]],
    pop:   [["pluck", 84, 0, .07, .45]],
    good:  [["bell", 79, 0, .2, .7], ["bell", 84, .08, .26, .6]],
    bad:   [["pad", 47, 0, .22, .5], ["pad", 46, .07, .26, .4]],
    win:   [["bell", 72, 0, .22, .7], ["bell", 76, .1, .22, .7], ["bell", 79, .2, .22, .7], ["bell", 84, .3, .5, .8]],
    whoosh:[["pad", 60, 0, .3, .25]],
    step:  [["pluck", 64, 0, .06, .3]],
    alarm: [["lead", 70, 0, .14, .6], ["lead", 65, .15, .2, .6]],
    magic: [["bell", 88, 0, .14, .5], ["bell", 92, .06, .14, .45], ["bell", 96, .12, .3, .4]]
  };
  function sfx(name) {
    var c = ctx(); if (!c) return;
    (SFX[name] || []).forEach(function (e) {
      voice(e[0], e[1], c.currentTime + e[2], e[3], e[4], sfxGain);
    });
  }

  function mute(on) {
    ctx();
    if (master) master.gain.value = on ? 0 : .9;
  }
  function musicVol(v) { ctx(); if (musicGain) musicGain.gain.value = v; }

  window.KSND = {play: play, stop: stop, sfx: sfx, mute: mute, musicVol: musicVol,
                 ready: function () { return !!ctx(); }};
})();
