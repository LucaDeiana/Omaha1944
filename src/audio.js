"use strict";
// ============================================================
//  Audio sintetizzato (WebAudio): armi, esplosioni, ambiente
// ============================================================
const AU = { ctx: null, voices: 0, battle: 1 };

function initAudio() {
  if (AU.ctx) { AU.ctx.resume(); return; }
  const c = AU.ctx = new (window.AudioContext || window.webkitAudioContext)();
  AU.out = c.createGain(); AU.out.gain.value = .85;
  AU.muffle = c.createBiquadFilter(); AU.muffle.type = 'lowpass'; AU.muffle.frequency.value = 18000;
  const comp = c.createDynamicsCompressor();
  comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 5; comp.attack.value = .003; comp.release.value = .25;
  AU.out.connect(AU.muffle); AU.muffle.connect(comp); comp.connect(c.destination);
  const sr = c.sampleRate;
  const mk = (sec, fn) => { const b = c.createBuffer(1, sr * sec, sr), d = b.getChannelData(0); fn(d); return b; };
  AU.white = mk(3, d => { for (let i = 0; i < d.length; i++) d[i] = R() * 2 - 1; });
  AU.brown = mk(5, d => { let l = 0; for (let i = 0; i < d.length; i++) { l = (l + .02 * (R() * 2 - 1)) / 1.02; d[i] = l * 3.5; } });
  const ir = c.createBuffer(2, sr * 2.4, sr);
  for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < d.length; i++) d[i] = (R() * 2 - 1) * Math.pow(1 - i / d.length, 3); }
  AU.rev = c.createConvolver(); AU.rev.buffer = ir;
  const rg = c.createGain(); rg.gain.value = .45; AU.rev.connect(rg); rg.connect(AU.out);
  startAmbience();
}

const _right = new V3(), _toSrc = new V3();
function spatial(pos, ref = 40) {
  if (!pos) return { vol: 1, pan: 0, lp: 20000, delay: 0, rev: .07, d: 0 };
  const d = pos.distanceTo(camera.position);
  _right.set(Math.cos(P.yaw), 0, -Math.sin(P.yaw));
  _toSrc.subVectors(pos, camera.position); _toSrc.y = 0;
  const l = _toSrc.length() || 1;
  return {
    vol: 1 / (1 + Math.pow(d / ref, 1.5)),
    pan: clamp(_toSrc.dot(_right) / l, -1, 1) * .8,
    lp: clamp(22000 / (1 + d / 45), 350, 20000),
    delay: d > 30 ? d / 343 : 0,
    rev: clamp(.06 + d / 350, .06, .75), d
  };
}
function bus(sp, vol) {
  const c = AU.ctx, g = c.createGain(); g.gain.value = vol * sp.vol;
  const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = sp.lp; g.connect(f);
  let last = f;
  if (c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = sp.pan; f.connect(p); last = p; }
  last.connect(AU.out);
  const s = c.createGain(); s.gain.value = sp.rev; last.connect(s); s.connect(AU.rev);
  return g;
}
function noiseHit(dest, t, dur, o) {
  const c = AU.ctx, s = c.createBufferSource();
  s.buffer = o.brown ? AU.brown : AU.white; s.playbackRate.value = o.rate || 1;
  const f = c.createBiquadFilter(); f.type = o.type || 'lowpass';
  f.frequency.setValueAtTime(o.f || 3000, t); if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t + dur); f.Q.value = o.q || .7;
  const g = c.createGain(); g.gain.setValueAtTime(.0001, t);
  g.gain.exponentialRampToValueAtTime(o.v || 1, t + (o.a || .003)); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(dest);
  s.start(t, R() * 1.5); s.stop(t + dur + .05);
  AU.voices++; s.onended = () => AU.voices--;
}
function toneHit(dest, t, dur, o) {
  const c = AU.ctx, s = c.createOscillator(); s.type = o.type || 'sine';
  s.frequency.setValueAtTime(o.f, t); if (o.f2) s.frequency.exponentialRampToValueAtTime(o.f2, t + dur);
  const g = c.createGain(); g.gain.setValueAtTime(.0001, t);
  g.gain.exponentialRampToValueAtTime(o.v || .5, t + (o.a || .004)); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  s.connect(g); g.connect(dest); s.start(t); s.stop(t + dur + .05);
  AU.voices++; s.onended = () => AU.voices--;
}
const ok = () => AU.ctx && AU.voices < 70;

const SHOT = {
  garand: { c: 3400, cd: .2, cv: 1, t: 95, td: .22, tv: .9 },
  kar98: { c: 3700, cd: .2, cv: 1, t: 90, td: .24, tv: .9 },
  springfield: { c: 3900, cd: .25, cv: 1.1, t: 85, td: .26, tv: 1 },
  thompson: { c: 2000, cd: .11, cv: .75, t: 120, td: .12, tv: .8 },
  mp40: { c: 2500, cd: .085, cv: .62, t: 140, td: .09, tv: .6 },
  bar: { c: 2800, cd: .15, cv: .95, t: 88, td: .16, tv: .9 },
  colt: { c: 2200, cd: .1, cv: .7, t: 130, td: .1, tv: .7 },
  mg42: { c: 3000, cd: .065, cv: .8, t: 110, td: .065, tv: .7 },
};
function sfxShot(kind, pos, isPlayer, extraDelay = 0) {
  if (!ok()) return;
  const s = SHOT[kind] || SHOT.garand, sp = spatial(isPlayer ? null : pos, 32);
  if (sp.vol < .006) return;
  const t = AU.ctx.currentTime + sp.delay + extraDelay, b = bus(sp, isPlayer ? 1 : .95);
  noiseHit(b, t, s.cd * (1 + sp.d / 250), { f: s.c, f2: s.c * .25, v: s.cv });
  toneHit(b, t, s.td, { f: s.t * 2, f2: s.t * .45, v: s.tv });
  if (isPlayer) { noiseHit(b, t + .012, .55, { f: 900, f2: 160, v: .2 }); noiseHit(b, t, .03, { type: 'highpass', f: 5000, v: .5 }); }
}
function sfxBoom(pos, size = 1) {
  if (!ok()) return;
  const sp = spatial(pos, 70 * size); if (sp.vol < .004) return;
  const t = AU.ctx.currentTime + sp.delay, b = bus(sp, 1.3 * Math.min(1.6, size));
  noiseHit(b, t, 2.2 * Math.min(size, 1.8), { brown: true, f: 700, f2: 50, v: 1.4, rate: .7 });
  noiseHit(b, t, .4, { f: Math.min(3500, sp.lp), f2: 250, v: .9 });
  toneHit(b, t, .9, { f: 75, f2: 26, v: 1.1 });
}
function sfxShip(pos) {
  if (!ok()) return;
  const sp = spatial(pos, 500); sp.vol = Math.max(sp.vol, .25);
  const t = AU.ctx.currentTime + Math.min(sp.delay, 2.5), b = bus(sp, 1.1);
  noiseHit(b, t, 3.5, { brown: true, f: 260, f2: 35, v: 1.2, rate: .5, a: .02 });
  toneHit(b, t, 1.6, { f: 48, f2: 22, v: .9, a: .01 });
}
function sfxPing() {
  if (!ok()) return; const t = AU.ctx.currentTime + .03, b = bus(spatial(null), .3);
  toneHit(b, t, .55, { f: 2650, v: .35 }); toneHit(b, t, .4, { f: 3950, v: .2 }); toneHit(b, t, .25, { f: 5400, v: .1 });
}
function sfxMech(kind, delay = 0) {
  if (!ok()) return; const t = AU.ctx.currentTime + delay, b = bus(spatial(null), .5);
  if (kind === 'out') noiseHit(b, t, .06, { type: 'highpass', f: 2500, v: .5 });
  else if (kind === 'in') { noiseHit(b, t, .05, { type: 'bandpass', f: 1800, q: 2, v: .8 }); noiseHit(b, t + .05, .04, { type: 'highpass', f: 3000, v: .5 }); }
  else if (kind === 'bolt') { noiseHit(b, t, .05, { type: 'bandpass', f: 2200, q: 3, v: .6 }); noiseHit(b, t + .12, .05, { type: 'bandpass', f: 1500, q: 3, v: .7 }); }
  else if (kind === 'dry') noiseHit(b, t, .03, { type: 'highpass', f: 4000, v: .4 });
  else if (kind === 'pick') { noiseHit(b, t, .08, { type: 'bandpass', f: 1200, q: 1, v: .4 }); noiseHit(b, t + .1, .06, { type: 'bandpass', f: 2200, q: 2, v: .4 }); }
  else if (kind === 'pin') { toneHit(b, t, .12, { f: 3200, v: .15 }); noiseHit(b, t, .05, { type: 'highpass', f: 3000, v: .3 }); }
}
function sfxWhiz(from) {
  if (!ok()) return;
  const sp = spatial(from, 1e9); sp.vol = 1; sp.delay = 0; sp.rev = .05; sp.lp = 20000;
  const t = AU.ctx.currentTime, b = bus(sp, .55);
  noiseHit(b, t, .22, { type: 'bandpass', f: 3500, f2: 700, q: 3, v: .8 });
  if (R() < .6) noiseHit(b, t, .025, { type: 'highpass', f: 4000, v: 1 });
}
function sfxImpact(pos, kind) {
  if (!ok()) return; const sp = spatial(pos, 8); if (sp.vol < .05) return;
  const t = AU.ctx.currentTime, b = bus(sp, .6);
  if (kind === 'metal') { toneHit(b, t, .25, { f: 1800 + R() * 600, v: .4 }); toneHit(b, t, .2, { f: 2900, v: .2 }); }
  else if (kind === 'water') noiseHit(b, t, .15, { type: 'bandpass', f: 1400, q: 1, v: .5 });
  else noiseHit(b, t, .08, { f: 900, v: .6 });
}
function sfxStep(water, run) {
  if (!ok()) return; const t = AU.ctx.currentTime, b = bus(spatial(null), water ? .3 : .16);
  if (water) noiseHit(b, t, .22, { type: 'bandpass', f: 900 + R() * 400, q: .8, v: .9 });
  else noiseHit(b, t, .09, { f: 500 + R() * 300, v: run ? 1 : .7 });
}
function sfxRocket(pos) {
  if (!ok()) return; const sp = spatial(pos, 30), t = AU.ctx.currentTime, b = bus(sp, 1);
  noiseHit(b, t, .8, { type: 'bandpass', f: 600, f2: 3000, q: .8, v: 1 }); toneHit(b, t, .3, { f: 140, f2: 50, v: .8 });
}
function sfxWhistle(pos) {
  if (!ok()) return; const sp = spatial(pos, 60); if (sp.vol < .02) return;
  const b = bus(sp, .5), t = AU.ctx.currentTime; sp.delay = 0;
  toneHit(b, t, .95, { f: 1500, f2: 650, v: .22, a: .25 });
}
function sfxThud() { if (!ok()) return; const b = bus(spatial(null), .7); toneHit(b, AU.ctx.currentTime, .25, { f: 90, f2: 40, v: .8 }); }
function sfxTick() { if (!ok()) return; const b = bus(spatial(null), .25); noiseHit(b, AU.ctx.currentTime, .03, { type: 'highpass', f: 3000, v: .6 }); }
function sfxHeart() { if (!ok()) return; const b = bus(spatial(null), .7), t = AU.ctx.currentTime; toneHit(b, t, .15, { f: 58, f2: 40, v: .9 }); toneHit(b, t + .22, .15, { f: 52, f2: 38, v: .7 }); }
function sfxPlane(pos) {
  if (!ok()) return; const sp = spatial(pos, 200), t = AU.ctx.currentTime, b = bus(sp, .9);
  toneHit(b, t, 4, { type: 'sawtooth', f: 120, f2: 70, v: .25, a: 1.5 }); noiseHit(b, t, 4, { brown: true, f: 900, f2: 300, v: .6, a: 1.5 });
}
function muffle(sec) {
  if (!AU.ctx) return;
  const f = AU.muffle.frequency, t = AU.ctx.currentTime;
  f.cancelScheduledValues(t); f.setValueAtTime(280, t); f.exponentialRampToValueAtTime(18000, t + sec);
  const o = AU.ctx.createOscillator(), g = AU.ctx.createGain(); o.frequency.value = 3700;
  g.gain.setValueAtTime(.05, t); g.gain.exponentialRampToValueAtTime(.0001, t + sec * .9);
  o.connect(g); g.connect(AU.ctx.destination); o.start(t); o.stop(t + sec);
}

function startAmbience() {
  const c = AU.ctx;
  const s = c.createBufferSource(); s.buffer = AU.brown; s.loop = true;
  const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 650;
  AU.surfG = c.createGain(); AU.surfG.gain.value = .3;
  const lfo = c.createOscillator(); lfo.frequency.value = .11;
  AU.surfLfo = c.createGain(); AU.surfLfo.gain.value = .2;
  lfo.connect(AU.surfLfo); AU.surfLfo.connect(AU.surfG.gain);
  s.connect(f); f.connect(AU.surfG); AU.surfG.connect(AU.out); s.start(); lfo.start();
  const w = c.createBufferSource(); w.buffer = AU.white; w.loop = true;
  const wf = c.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 380; wf.Q.value = .6;
  const wg = c.createGain(); wg.gain.value = .04; w.connect(wf); wf.connect(wg); wg.connect(AU.out); w.start();
  const e = c.createOscillator(); e.type = 'sawtooth'; e.frequency.value = 41;
  const e2 = c.createOscillator(); e2.type = 'square'; e2.frequency.value = 20.7;
  const ef = c.createBiquadFilter(); ef.type = 'lowpass'; ef.frequency.value = 220;
  AU.engG = c.createGain(); AU.engG.gain.value = 0;
  e.connect(ef); e2.connect(ef); ef.connect(AU.engG); AU.engG.connect(AU.out); e.start(); e2.start();
}

let ambT = 0, heartT = 0;
function updateAudio(dt) {
  if (!AU.ctx) return;
  const t = AU.ctx.currentTime;
  const shore = Math.abs(camera.position.z + 6);
  AU.surfG.gain.setTargetAtTime(.12 + .7 / (1 + shore / 20), t, .5);
  AU.engG.gain.setTargetAtTime(P.inBoat ? .22 : 0, t, .4);
  ambT -= dt;
  if (ambT <= 0) {
    ambT = rnd(.12, 1.1) / AU.battle;
    const p = new V3(camera.position.x + (R() < .5 ? -1 : 1) * rnd(120, 420), 6, camera.position.z + rnd(-250, 120));
    const r = R();
    if (r < .45) sfxShot(pick(['garand', 'kar98', 'kar98', 'garand', 'bar', 'thompson']), p);
    else if (r < .75) { const n = (rnd(6, 16)) | 0; for (let i = 0; i < n; i++) sfxShot('mg42', p, false, i * .055); }
    else sfxBoom(p, rnd(.6, 1.5));
  }
  if (P.hp < 35 && !P.dead) { heartT -= dt; if (heartT <= 0) { heartT = .85; sfxHeart(); } }
}
