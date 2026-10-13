"use strict";
// ============================================================
//  Audio: banchi di campioni sintetizzati offline, spazializzazione,
//  eco della scogliera, ambiente, motori, voci (inglese / tedesco)
// ============================================================
const AU = { ctx: null, ready: false, buf: {}, voices: 0, battle: 1, loops: [], active: [], last: {} };
const MAX_VOICES = 64;
const fin = v => Number.isFinite(v);

function initAudio() {
  if (AU.ctx) { AU.ctx.resume(); return Promise.resolve(); }
  const c = AU.ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
  AU.master = c.createGain(); AU.master.gain.value = SETTINGS.volume;
  AU.out = c.createGain(); AU.out.gain.value = .8;
  AU.muffle = c.createBiquadFilter(); AU.muffle.type = 'lowpass'; AU.muffle.frequency.value = 19000;
  // compressore morbido + limitatore finale: niente distorsione né "buchi" quando i suoni si accavallano
  const comp = c.createDynamicsCompressor();
  comp.threshold.value = -20; comp.knee.value = 18; comp.ratio.value = 3.5; comp.attack.value = .006; comp.release.value = .18;
  const lim = c.createDynamicsCompressor();
  lim.threshold.value = -2; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = .001; lim.release.value = .06;
  AU.out.connect(AU.muffle); AU.muffle.connect(comp); comp.connect(AU.master); AU.master.connect(lim); lim.connect(c.destination);
  const sr = c.sampleRate;
  const ir = c.createBuffer(2, sr * 3, sr);
  for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < d.length; i++) { const t = i / sr; d[i] = (R() * 2 - 1) * Math.pow(1 - i / d.length, 2.6) * (t < .02 ? t / .02 : 1); } }
  AU.rev = c.createConvolver(); AU.rev.buffer = ir;
  const rg = c.createGain(); rg.gain.value = .55; AU.rev.connect(rg); rg.connect(AU.out);
  initSpeech();
  return buildBank();
}

// ---------- sintesi offline ----------
function envP(p, t, dur, v, a, lin) { p.setValueAtTime(.0001, t); p.exponentialRampToValueAtTime(Math.max(v, .0002), t + a); if (lin) p.linearRampToValueAtTime(.0001, t + dur); else p.exponentialRampToValueAtTime(.0001, t + dur); }
function oN(oc, dst, t, dur, o) {
  const s = oc.createBufferSource(); s.buffer = o.brown ? AU.brownB : AU.whiteB; s.loop = true; s.playbackRate.value = o.rate || 1;
  const f = oc.createBiquadFilter(); f.type = o.type || 'lowpass'; f.frequency.setValueAtTime(o.f || 3000, t);
  if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t + dur); f.Q.value = o.q || .7;
  const g = oc.createGain(); envP(g.gain, t, dur, o.v || 1, o.a || .002, o.lin);
  s.connect(f); f.connect(g); g.connect(dst); s.start(t, o.off ?? R() * 1.5); s.stop(t + dur + .05);
}
function oT(oc, dst, t, dur, o) {
  const s = oc.createOscillator(); s.type = o.type || 'sine'; s.frequency.setValueAtTime(o.f, t);
  if (o.f2) s.frequency.exponentialRampToValueAtTime(o.f2, t + dur);
  const g = oc.createGain(); envP(g.gain, t, dur, o.v || .5, o.a || .003, o.lin);
  s.connect(g); g.connect(dst); s.start(t); s.stop(t + dur + .05);
}
function shaperN(oc, k) { const ws = oc.createWaveShaper(), n = 2048, c = new Float32Array(n); for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; c[i] = Math.tanh(x * k) / Math.tanh(k); } ws.curve = c; return ws; }
function renderOff(sec, fn, i) { const oc = new OfflineAudioContext(1, Math.ceil(AU.ctx.sampleRate * sec), AU.ctx.sampleRate); fn(oc, oc.destination, i); return oc.startRendering(); }

const SHOTP = {
  garand: { bf: 1700, bd: .07, lf: 4600, tf: 95, td: .16, tail: .7, sat: 2.4 },
  kar98: { bf: 1950, bd: .075, lf: 5200, tf: 90, td: .17, tail: .75, sat: 2.4 },
  springfield: { bf: 1800, bd: .08, lf: 5300, tf: 85, td: .18, tail: .85, sat: 2.5 },
  thompson: { bf: 1050, bd: .055, lf: 2800, tf: 118, td: .09, tail: .45, sat: 2.2 },
  mp40: { bf: 1300, bd: .045, lf: 3300, tf: 135, td: .07, tail: .4, sat: 2.2 },
  bar: { bf: 1500, bd: .065, lf: 4100, tf: 90, td: .13, tail: .6, sat: 2.5 },
  colt: { bf: 1150, bd: .05, lf: 3000, tf: 125, td: .08, tail: .4, sat: 2.2 },
  mg42: { bf: 1650, bd: .04, lf: 3900, tf: 105, td: .06, tail: .35, sat: 3 },
  m2: { bf: 900, bd: .06, lf: 2600, tf: 70, td: .1, tail: .5, sat: 3 },
  flak: { bf: 700, bd: .08, lf: 1800, tf: 60, td: .18, tail: .9, sat: 3 },
};
const FORM = { a: [[800, 9, 1], [1150, 11, .5], [2900, 14, .25]], o: [[500, 9, 1], [850, 11, .45], [2800, 14, .2]], e: [[450, 9, 1], [1900, 12, .4], [2600, 14, .25]], u: [[350, 9, 1], [700, 11, .35], [2400, 14, .15]] };

async function buildBank() {
  const c = AU.ctx, sr = c.sampleRate;
  const mk = (sec, fn) => { const b = c.createBuffer(1, sr * sec, sr), d = b.getChannelData(0); fn(d); return b; };
  AU.whiteB = mk(3, d => { for (let i = 0; i < d.length; i++) d[i] = R() * 2 - 1; });
  AU.brownB = mk(6, d => { let l = 0; for (let i = 0; i < d.length; i++) { l = (l + .02 * (R() * 2 - 1)) / 1.02; d[i] = l * 3.5; } });
  const jobs = [];
  const add = (name, sec, fn, n = 3) => { for (let i = 0; i < n; i++) jobs.push(renderOff(sec, fn, i).then(b => (AU.buf[name] || (AU.buf[name] = [])).push(b))); };

  for (const k in SHOTP) {
    const p = SHOTP[k];
    add(k, 1.2, (oc, dst, i) => {
      const j = 1 + (i - 1) * .045, sh = shaperN(oc, p.sat), g = oc.createGain(); g.gain.value = .7; sh.connect(g); g.connect(dst);
      oN(oc, sh, 0, .005, { type: 'highpass', f: 1800, v: 1.8, a: .0002 });
      oN(oc, sh, 0, p.bd, { type: 'bandpass', f: p.bf * j, q: .9, v: 2.4, a: .0004 });
      oN(oc, sh, 0, p.bd * 1.8, { type: 'lowpass', f: p.lf * j, f2: 250, v: 1.3, a: .0006 });
      oT(oc, sh, 0, p.td, { f: p.tf * 2 * j, f2: p.tf * .45, v: 1.6, a: .0008 });
      oN(oc, dst, .004, p.tail, { type: 'lowpass', f: 1500, f2: 140, v: .32, a: .012, brown: true });
      oN(oc, dst, .06 + R() * .05, p.tail * .8, { type: 'bandpass', f: 600, f2: 200, q: .5, v: .08, a: .05 });
    });
  }
  const far = (f, d) => (oc, dst, i) => {
    oN(oc, dst, 0, .05, { type: 'bandpass', f: f * (1 + i * .06), q: 1, v: .9, a: .002 });
    oN(oc, dst, 0, d, { type: 'lowpass', f: 520, f2: 90, v: 1.3, a: .004, brown: true });
    oT(oc, dst, 0, .26, { f: 95, f2: 38, v: .8, a: .003 });
    oN(oc, dst, .12, d * 2.2, { type: 'lowpass', f: 320, f2: 70, v: .28, a: .1, brown: true });
  };
  add('rifle_far', 1.8, far(900, .5)); add('mg_far', 1.2, far(1100, .3)); add('smg_far', 1.2, far(800, .3)); add('flak_far', 2.5, far(500, .9));
  add('crack', .1, (oc, dst, i) => { oN(oc, dst, 0, .003, { type: 'highpass', f: 2500 + i * 400, v: 2.4, a: .0002 }); oN(oc, dst, 0, .014, { type: 'bandpass', f: 4500, q: 1.4, v: .9, a: .0003 }); oT(oc, dst, 0, .012, { f: 2600, v: .3 }); }, 4);
  add('whiz', .5, (oc, dst, i) => { oN(oc, dst, 0, .34, { type: 'bandpass', f: 3400 - i * 300, f2: 550, q: 4, v: 1.2, a: .03 }); oT(oc, dst, 0, .3, { f: 1600 + i * 200, f2: 300, v: .07, a: .03 }); }, 4);
  add('ricochet', .8, (oc, dst, i) => { oT(oc, dst, 0, .6, { f: 3800 + i * 500, f2: 1200, v: .35, a: .004 }); oN(oc, dst, 0, .05, { type: 'highpass', f: 3000, v: .8 }); oN(oc, dst, 0, .5, { type: 'bandpass', f: 3000, f2: 1300, q: 6, v: .25, a: .01 }); }, 4);
  add('imp_sand', .3, (oc, dst) => { oN(oc, dst, 0, .1, { f: 900, v: 1 }); oN(oc, dst, 0, .05, { type: 'bandpass', f: 2600, v: .4 }); for (let k = 0; k < 8; k++) oN(oc, dst, .02 + R() * .2, .012, { type: 'bandpass', f: 2000 + R() * 3000, q: 2, v: .12 }); });
  add('imp_water', .5, (oc, dst) => { oN(oc, dst, 0, .03, { type: 'highpass', f: 1500, v: .9 }); oN(oc, dst, 0, .35, { f: 2500, f2: 600, v: .8, a: .004 }); oN(oc, dst, .02, .3, { type: 'bandpass', f: 900, q: .5, v: .5, a: .01 }); for (let k = 0; k < 10; k++) oN(oc, dst, .08 + R() * .3, .02, { type: 'highpass', f: 3000, v: .1 }); }, 3);
  add('imp_metal', .6, (oc, dst, i) => { const j = 1 + i * .09, sh = shaperN(oc, 2.5); sh.connect(dst); oN(oc, sh, 0, .015, { type: 'highpass', f: 1200, v: 1.6 }); oN(oc, sh, 0, .18, { type: 'bandpass', f: 1100 * j, q: 3, v: .9 }); oT(oc, sh, 0, .12, { f: 320 * j, f2: 180, v: .7 }); oN(oc, dst, 0, .35, { type: 'bandpass', f: 2600 * j, q: 6, v: .25 }); });
  add('imp_flesh', .3, (oc, dst) => { oN(oc, dst, 0, .07, { f: 450, v: 1.3 }); oT(oc, dst, 0, .1, { f: 110, f2: 55, v: .9 }); oN(oc, dst, .005, .06, { type: 'bandpass', f: 900, q: 2, v: .4 }); });
  add('imp_wood', .2, (oc, dst) => { oN(oc, dst, 0, .07, { type: 'bandpass', f: 900, q: 2.5, v: 1.1 }); oN(oc, dst, 0, .03, { type: 'highpass', f: 2000, v: .4 }); });
  add('imp_stone', .3, (oc, dst) => { oN(oc, dst, 0, .05, { type: 'bandpass', f: 2400, v: 1 }); oN(oc, dst, 0, .14, { f: 600, v: .4 }); });
  const boom = (water) => (oc, dst, i) => {
    const sh = shaperN(oc, 3); sh.connect(dst);
    oN(oc, sh, 0, .03, { type: 'highpass', f: 600, v: 2.4, a: .0003 });
    oN(oc, sh, 0, 3, { type: 'lowpass', f: 1200, f2: 55, v: 2.6, a: .001, brown: true, rate: .8 });
    oT(oc, sh, 0, 1.4, { f: 62 - i * 5, f2: 22, v: 2, a: .002 });
    oN(oc, dst, .02, .7, { type: 'bandpass', f: 700, f2: 180, q: .6, v: .8, a: .005 });
    if (water) { oN(oc, dst, .1, 1.8, { type: 'bandpass', f: 1300, f2: 400, q: .7, v: .9, a: .05 }); for (let k = 0; k < 90; k++) { const t = .4 + Math.pow(R(), 1.4) * 2.6; oN(oc, dst, t, .015 + R() * .03, { type: 'bandpass', f: 900 + R() * 2200, q: 2, v: .18 * (1 - (t - .4) / 2.8) + .02 }); } }
    else for (let k = 0; k < 80; k++) { const t = .22 + Math.pow(R(), 1.6) * 2.7; oN(oc, dst, t, .015 + R() * .04, { type: 'bandpass', f: 1400 + R() * 3600, q: 1.5, v: .26 * (1 - (t - .22) / 2.9) + .02, a: .001 }); }
  };
  add('boom', 3.4, boom(false), 3); add('boom_water', 3.4, boom(true), 2);
  add('boom_far', 4.5, (oc, dst, i) => { oN(oc, dst, 0, 3.6, { type: 'lowpass', f: 380, f2: 40, v: 1.7, a: .04, brown: true }); oT(oc, dst, 0, 1.8, { f: 44 - i * 3, f2: 18, v: 1.2, a: .03 }); oN(oc, dst, 0, .15, { type: 'bandpass', f: 500, v: .3, a: .01 }); });
  add('ship_far', 5.5, (oc, dst, i) => { oN(oc, dst, 0, 4.6, { type: 'lowpass', f: 230, f2: 32, v: 1.6, a: .06, brown: true }); oT(oc, dst, 0, 2.4, { f: 34, f2: 16, v: 1.1, a: .05 }); oN(oc, dst, .45, 3.5, { type: 'lowpass', f: 160, f2: 30, v: .7, a: .3, brown: true }); }, 2);
  add('ship_near', 5, (oc, dst) => { const sh = shaperN(oc, 4); sh.connect(dst); oN(oc, sh, 0, .05, { type: 'highpass', f: 500, v: 2.5 }); oN(oc, sh, 0, 4.5, { type: 'lowpass', f: 1500, f2: 38, v: 3, a: .001, brown: true }); oT(oc, sh, 0, 2.6, { f: 38, f2: 14, v: 2.6, a: .002 }); }, 2);
  add('mortar', .7, (oc, dst) => { oT(oc, dst, 0, .18, { f: 240, f2: 80, v: 1.4 }); oN(oc, dst, 0, .12, { type: 'bandpass', f: 500, v: .8 }); oN(oc, dst, .02, .45, { f: 300, f2: 80, v: .35, brown: true }); }, 2);
  const whistle = (len, f1, f2) => (oc, dst, i) => {
    const o = oc.createOscillator(), g = oc.createGain(); o.frequency.setValueAtTime(f1 * (1 + i * .05), 0); o.frequency.exponentialRampToValueAtTime(f2, len);
    g.gain.setValueAtTime(.0001, 0); g.gain.linearRampToValueAtTime(.5, len * .9); g.gain.exponentialRampToValueAtTime(.0001, len); o.connect(g); g.connect(dst); o.start(0); o.stop(len);
    oN(oc, dst, 0, len, { type: 'bandpass', f: f1, f2: f2, q: 5, v: .15, a: len * .8, lin: true });
  };
  add('whistle', 1.4, whistle(1.3, 1700, 650), 2); add('bomb', 3.2, whistle(3.1, 1300, 420), 2);
  add('ping', .9, (oc, dst) => { oT(oc, dst, 0, .7, { f: 2650, v: .35 }); oT(oc, dst, 0, .5, { f: 3950, v: .2 }); oT(oc, dst, 0, .3, { f: 5400, v: .1 }); oT(oc, dst, 0, .2, { f: 7100, v: .06 }); oN(oc, dst, 0, .01, { type: 'highpass', f: 3000, v: .5 }); }, 1);
  const click = (f, q, d, v) => (oc, dst, i) => { oN(oc, dst, 0, d, { type: 'bandpass', f: f * (1 + i * .05), q, v }); oT(oc, dst, 0, d * 1.5, { f: f * .8, v: v * .1 }); };
  add('mag_out', .2, (oc, dst, i) => { click(2400, 2, .04, .7)(oc, dst, i); oN(oc, dst, .05, .06, { type: 'bandpass', f: 1500, q: 1.5, v: .4 }); }, 2);
  add('mag_in', .25, (oc, dst, i) => { oN(oc, dst, 0, .05, { type: 'bandpass', f: 1800, q: 2, v: .6 }); click(3000, 3, .03, .8)(oc, dst, i); oN(oc, dst, .06, .04, { f: 500, v: .5 }); }, 2);
  add('bolt_open', .2, (oc, dst, i) => { click(1500, 4, .05, .7)(oc, dst, i); oN(oc, dst, .03, .08, { type: 'bandpass', f: 2600, f2: 1800, q: 3, v: .4 }); }, 2);
  add('bolt_close', .2, (oc, dst, i) => { oN(oc, dst, 0, .07, { type: 'bandpass', f: 1900, f2: 2700, q: 3, v: .4 }); click(1300, 3, .04, .9)(oc, dst, i); }, 2);
  add('clip_in', .4, (oc, dst) => { oN(oc, dst, 0, .15, { type: 'bandpass', f: 3200, f2: 2000, q: 3, v: .5 }); oN(oc, dst, .16, .05, { type: 'bandpass', f: 1500, q: 2, v: .9 }); oT(oc, dst, .16, .1, { f: 2200, v: .1 }); }, 1);
  add('dry', .1, click(4000, 1.5, .025, .6), 2);
  add('pin', .3, (oc, dst) => { oT(oc, dst, 0, .15, { f: 3200, v: .15 }); oN(oc, dst, 0, .05, { type: 'highpass', f: 3000, v: .4 }); oN(oc, dst, .12, .05, { type: 'bandpass', f: 1800, v: .3 }); }, 1);
  add('tink', .3, (oc, dst, i) => { const j = 1 + R() * .3; oT(oc, dst, 0, .16, { f: 4200 * j, v: .18 }); oT(oc, dst, 0, .12, { f: 6300 * j, v: .1 }); oN(oc, dst, 0, .008, { type: 'highpass', f: 4000, v: .3 }); }, 4);
  add('nade_bounce', .2, (oc, dst) => { oN(oc, dst, 0, .06, { f: 700, v: .8 }); oT(oc, dst, 0, .05, { f: 900, v: .15 }); }, 2);
  add('step_sand', .2, (oc, dst) => { for (let k = 0; k < 12; k++) oN(oc, dst, R() * .1, .02 + R() * .03, { type: k % 2 ? 'lowpass' : 'bandpass', f: 600 + R() * 2400, q: 1, v: .25 + R() * .25 }); }, 4);
  add('step_water', .45, (oc, dst) => { oN(oc, dst, 0, .3, { type: 'bandpass', f: 700, f2: 1600, q: .8, v: .9, a: .02 }); for (let k = 0; k < 4; k++) oT(oc, dst, .05 + R() * .2, .05, { f: 500 + R() * 900, f2: 900 + R() * 900, v: .08 }); }, 3);
  add('step_peb', .25, (oc, dst) => { for (let k = 0; k < 14; k++) oN(oc, dst, R() * .14, .01 + R() * .015, { type: 'bandpass', f: 2000 + R() * 3500, q: 2, v: .25 + R() * .3 }); oN(oc, dst, 0, .06, { f: 500, v: .4 }); }, 3);
  add('bodyfall', .5, (oc, dst) => { oN(oc, dst, 0, .25, { f: 300, v: 1.1 }); oT(oc, dst, 0, .15, { f: 90, f2: 45, v: .6 }); for (let k = 0; k < 6; k++) oN(oc, dst, .05 + R() * .2, .02, { type: 'bandpass', f: 1500 + R() * 2000, v: .1 }); }, 2);
  add('breath', 1.1, (oc, dst, i) => { oN(oc, dst, 0, .45, { type: 'bandpass', f: 1100, q: .6, v: .3, a: .2, lin: true }); oN(oc, dst, .55, .5, { type: 'bandpass', f: 800, q: .6, v: .35, a: .12, lin: true }); }, 2);
  add('heart', .6, (oc, dst) => { oT(oc, dst, 0, .15, { f: 58, f2: 40, v: .9 }); oT(oc, dst, .22, .15, { f: 52, f2: 38, v: .7 }); }, 1);
  add('thud', .4, (oc, dst) => { oT(oc, dst, 0, .25, { f: 90, f2: 40, v: .9 }); oN(oc, dst, 0, .08, { f: 400, v: .6 }); }, 2);
  add('rocket', 1.2, (oc, dst) => { oN(oc, dst, 0, 1, { type: 'bandpass', f: 500, f2: 3000, q: .8, v: 1, a: .01 }); oT(oc, dst, 0, .3, { f: 140, f2: 50, v: .9 }); oN(oc, dst, 0, .05, { type: 'highpass', f: 1500, v: 1.2 }); }, 1);
  add('flesh_squelch', .4, (oc, dst) => { oN(oc, dst, 0, .2, { type: 'bandpass', f: 700, f2: 300, q: 1.5, v: 1 }); oT(oc, dst, 0, .15, { f: 160, f2: 60, v: .5 }); }, 2);
  // voci non verbali (urla, gemiti) con sintesi a formanti
  const voice = (vw, f0, glide, dur, br) => (oc, dst, i) => {
    const F0 = f0 * (1 + (i - 1) * .09), s = oc.createOscillator(); s.type = 'sawtooth';
    s.frequency.setValueAtTime(F0, 0); s.frequency.linearRampToValueAtTime(F0 * glide, dur);
    const vib = oc.createOscillator(), vg = oc.createGain(); vib.frequency.value = 5 + R() * 2; vg.gain.value = F0 * .04; vib.connect(vg); vg.connect(s.frequency);
    const pre = oc.createGain(); s.connect(pre);
    const nz = oc.createBufferSource(); nz.buffer = AU.whiteB; const ng = oc.createGain(); ng.gain.value = br; nz.connect(ng); ng.connect(pre);
    const out = oc.createGain(); out.gain.setValueAtTime(0, 0); out.gain.linearRampToValueAtTime(1, .06); out.gain.setValueAtTime(1, dur * .7); out.gain.linearRampToValueAtTime(0, dur);
    for (const [f, q, gn] of FORM[vw]) { const bp = oc.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f * (1 + (i - 1) * .04); bp.Q.value = q; const gg = oc.createGain(); gg.gain.value = gn * 2; pre.connect(bp); bp.connect(gg); gg.connect(out); }
    const sh = shaperN(oc, 1.8); out.connect(sh); sh.connect(dst);
    s.start(0); vib.start(0); nz.start(0); s.stop(dur); vib.stop(dur); nz.stop(dur);
  };
  add('scream', 1.6, voice('a', 290, .72, 1.3, .2), 3); add('groan', 1.2, voice('o', 135, .8, 1, .45), 3);
  add('yell', .8, voice('e', 230, .9, .6, .25), 3); add('wail', 2, voice('u', 330, .7, 1.8, .2), 2);
  // anelli continui (motori, mare, vento, battaglia lontana)
  const engine = (b, cyl) => (oc, dst) => {
    const sh = shaperN(oc, 2), lp = oc.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1500; lp.connect(sh); sh.connect(dst);
    const vca = oc.createGain(); vca.gain.value = .5; vca.connect(lp);
    for (const [f, ty, v] of [[b, 'sawtooth', .5], [b / 2, 'square', .35], [b * 2, 'sawtooth', .15]]) { const o = oc.createOscillator(); o.type = ty; o.frequency.value = f; const g = oc.createGain(); g.gain.value = v; o.connect(g); g.connect(vca); o.start(0); }
    const am = oc.createOscillator(); am.frequency.value = cyl; const amg = oc.createGain(); amg.gain.value = .45; am.connect(amg); amg.connect(vca.gain); am.start(0);
  };
  add('eng_p47', 1, engine(72, 18), 1); add('eng_fw', 1, engine(66, 22), 1); add('eng_boat', 1, engine(40, 10), 1); add('eng_bomber', 1, engine(56, 14), 1);
  add('surf', 12, (oc, dst) => {
    oN(oc, dst, 0, 12, { type: 'lowpass', f: 420, v: .5, a: .5, brown: true, lin: true, off: 0 });
    for (const t0 of [.6, 4.6, 8.4]) { oN(oc, dst, t0, 3.4, { type: 'bandpass', f: 1500, f2: 700, q: .5, v: .9, a: .9 }); oN(oc, dst, t0 + .9, 2.5, { type: 'highpass', f: 3500, v: .25, a: .3 }); }
  }, 1);
  add('wind', 8, (oc, dst) => { oN(oc, dst, 0, 8, { type: 'bandpass', f: 420, q: .5, v: .8, a: 2, lin: true }); oN(oc, dst, 2, 5.5, { type: 'bandpass', f: 900, q: 2, v: .25, a: 2, lin: true }); }, 1);
  add('battle', 10, (oc, dst) => {
    oN(oc, dst, 0, 10, { type: 'lowpass', f: 160, v: .6, a: .5, brown: true, lin: true, off: 0 });
    for (let k = 0; k < 14; k++) { const t = R() * 9; oN(oc, dst, t, 1.5, { type: 'lowpass', f: 250, f2: 50, v: .5 + R() * .4, a: .03, brown: true }); }
    for (let k = 0; k < 140; k++) { const t = R() * 9.8; oN(oc, dst, t, .04, { type: 'bandpass', f: 700 + R() * 700, q: 1, v: .05 + R() * .08 }); }
  }, 1);
  await Promise.all(jobs);
  // anelli senza scatti: dissolvenza incrociata tra la fine e l'inizio
  for (const n of ['eng_p47', 'eng_fw', 'eng_boat', 'eng_bomber', 'surf', 'wind', 'battle']) {
    const b = AU.buf[n] && AU.buf[n][0]; if (!b) continue;
    const L = b.length, F = Math.floor(Math.min(L * .3, sr * (L > sr * 2 ? 1.5 : .25))), src = b.getChannelData(0);
    const nb = c.createBuffer(1, L - F, sr), out = nb.getChannelData(0);
    for (let i = 0; i < L - F; i++) out[i] = i < F ? src[i] * (i / F) + src[L - F + i] * (1 - i / F) : src[i];
    AU.buf[n] = [nb];
  }
  // normalizzazione dei campioni (nessun campione oltre 0 dB)
  for (const n in AU.buf) for (const b of AU.buf[n]) { const d = b.getChannelData(0); let mx = 0; for (let i = 0; i < d.length; i += 4) mx = Math.max(mx, Math.abs(d[i])); if (mx > .98) { const k = .98 / mx; for (let i = 0; i < d.length; i++) d[i] *= k; } }
  if (window.SFX_DATA) for (const k in SFX_DATA) { const arr = []; for (const b64 of SFX_DATA[k]) { try { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); arr.push(await c.decodeAudioData(u.buffer)); } catch (e) { } } if (arr.length) AU.buf[k] = arr; }
  AU.ready = true;
  startAmbience();
}

// ---------- riproduzione spaziale ----------
const _right = new V3(), _fwd = new V3(), _toSrc = new V3();
function spatial(pos, ref = 30) {
  if (!pos) return { vol: 1, pan: 0, lp: 20000, delay: 0, rev: .06, d: 0 };
  const d = pos.distanceTo(camera.position);
  _right.set(Math.cos(P.yaw), 0, -Math.sin(P.yaw)); _fwd.set(-Math.sin(P.yaw), 0, -Math.cos(P.yaw));
  _toSrc.subVectors(pos, camera.position); _toSrc.y = 0;
  const l = _toSrc.length() || 1, behind = _toSrc.dot(_fwd) / l < -.3;
  return {
    vol: 1 / (1 + Math.pow(d / ref, 1.5)),
    pan: clamp(_toSrc.dot(_right) / l, -1, 1) * .85,
    lp: clamp(22000 / (1 + d / 40), 300, 20000) * (behind ? .55 : 1),
    delay: d > 25 ? d / 343 : 0,
    rev: clamp(.05 + d / 320, .05, .8), d
  };
}
// gestione delle voci: elenco dei suoni attivi con istante di fine; se il limite è
// raggiunto si interrompe il suono più debole/vecchio invece di scartare quelli nuovi
function voiceSlot(vol) {
  const now = AU.ctx.currentTime, a = AU.active;
  for (let i = a.length - 1; i >= 0; i--) if (a[i].end <= now) a.splice(i, 1);
  AU.voices = a.length;
  if (a.length < MAX_VOICES) return true;
  let wi = -1, wv = vol;
  for (let i = 0; i < a.length; i++) { const v = a[i].vol * (1 - (now - a[i].start) / Math.max(.05, a[i].end - a[i].start)); if (v < wv) { wv = v; wi = i; } }
  if (wi < 0) return false;
  const w = a[wi]; a.splice(wi, 1);
  try { w.g.gain.setTargetAtTime(0, now, .01); w.src.stop(now + .05); } catch (e) { }
  return true;
}
function play(name, pos, o = {}) {
  if (!AU.ready || AU.ctx.state !== 'running') return null;
  const list = AU.buf[name]; if (!list) return null;
  if (pos && !(fin(pos.x) && fin(pos.y) && fin(pos.z))) return null;
  const sp = o.sp || spatial(pos, o.ref || 30), vol = (o.vol ?? 1) * sp.vol;
  if (!fin(vol) || !fin(sp.pan) || !fin(sp.lp) || !fin(sp.delay) || vol < .004) return null;
  // stesso suono lontano ripetuto nello stesso istante: si accorpa
  const c = AU.ctx, now = c.currentTime;
  if (vol < .3) { const lt = AU.last[name] || 0; if (now - lt < .025) return null; AU.last[name] = now; }
  if (!voiceSlot(vol)) return null;
  const t = now + Math.min(4, (o.delay || 0) + (o.noDelay ? 0 : sp.delay));
  const src = c.createBufferSource(); src.buffer = pick(list); src.playbackRate.value = clamp((o.rate || 1) * (1 + (R() - .5) * (o.var ?? .08)), .25, 4);
  const g = c.createGain(); g.gain.value = Math.min(vol, 2); src.connect(g);
  let last = g;
  if (sp.lp < 19000) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = clamp(sp.lp, 80, 20000); last.connect(f); last = f; }
  if (c.createStereoPanner && sp.pan) { const p = c.createStereoPanner(); p.pan.value = clamp(sp.pan, -1, 1); last.connect(p); last = p; }
  last.connect(AU.out);
  const rv = clamp(sp.rev * (o.revMul ?? 1), 0, 1);
  if (rv > .02) { const s = c.createGain(); s.gain.value = rv; last.connect(s); s.connect(AU.rev); }
  src.start(t);
  const dur = src.buffer.duration / src.playbackRate.value;
  AU.active.push({ src, g, vol, start: t, end: t + dur });
  // eco sulla scogliera (spiaggia aperta), solo per i suoni abbastanza forti
  if (o.echo && pos && sp.d > 15 && camera.position.z > -110 && vol > .05 && AU.active.length < MAX_VOICES - 8) {
    const e = c.createBufferSource(); e.buffer = src.buffer; e.playbackRate.value = src.playbackRate.value;
    const eg = c.createGain(); eg.gain.value = Math.min(vol * .28, 1); const ef = c.createBiquadFilter(); ef.type = 'lowpass'; ef.frequency.value = 900;
    e.connect(ef); ef.connect(eg); eg.connect(AU.out);
    const ed = Math.min(3, (Math.abs(camera.position.z + 85) + Math.abs(pos.z + 85)) / 343 + .05);
    e.start(t + ed); AU.active.push({ src: e, g: eg, vol: vol * .28, start: t + ed, end: t + ed + dur });
  }
  return src;
}
function loopSound(name, vol = 0) {
  if (!AU.ready || !AU.buf[name]) return null;
  const c = AU.ctx, src = c.createBufferSource(); src.buffer = AU.buf[name][0]; src.loop = true;
  const g = c.createGain(); g.gain.value = vol; const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 20000;
  let last = f; src.connect(g); g.connect(f);
  let pan = null; if (c.createStereoPanner) { pan = c.createStereoPanner(); f.connect(pan); last = pan; }
  last.connect(AU.out); src.start();
  const h = {
    src, g, f, pan,
    set(v, p = 0, rate = 1, lp = 20000) {
      if (!fin(v) || !fin(p) || !fin(rate) || !fin(lp)) return;
      const t = c.currentTime; g.gain.setTargetAtTime(clamp(v, 0, 2), t, .08); if (pan) pan.pan.setTargetAtTime(clamp(p, -1, 1), t, .08);
      src.playbackRate.setTargetAtTime(clamp(rate, .3, 3), t, .1); f.frequency.setTargetAtTime(clamp(lp, 80, 20000), t, .1);
    },
    at(pos, v, rate = 1, ref = 120) { const sp = spatial(pos, ref); this.set(v * sp.vol, sp.pan, rate, sp.lp); },
    stop() { try { src.stop(); } catch (e) { } }
  };
  return h;
}

// ---------- API usate dal gioco ----------
const FARMAP = { garand: 'rifle_far', kar98: 'rifle_far', springfield: 'rifle_far', bar: 'rifle_far', thompson: 'smg_far', mp40: 'smg_far', colt: 'smg_far', mg42: 'mg_far', m2: 'mg_far', flak: 'flak_far' };
function sfxShot(kind, pos, isPlayer, extraDelay = 0) {
  if (isPlayer) { play(kind, null, { vol: 1, delay: extraDelay, revMul: 1.5, rate: kind === 'mp40' ? 1.12 : 1 }); return; }
  const d = pos.distanceTo(camera.position);
  if (d < 220) play(kind, pos, { ref: 25, delay: extraDelay, echo: true, rate: kind === 'mp40' ? 1.12 : 1 });
  else play(FARMAP[kind] || 'rifle_far', pos, { ref: 70, delay: extraDelay, echo: true, vol: 1.2 });
}
function sfxBoom(pos, size = 1, water = false) {
  const d = pos.distanceTo(camera.position);
  if (d < 220) play(water ? 'boom_water' : 'boom', pos, { ref: 55 * size, vol: Math.min(1.6, .6 + size * .4), echo: true });
  else play('boom_far', pos, { ref: 160 * size, vol: 1.3, echo: true });
}
function sfxShip(pos) { const sp = spatial(pos, 600); sp.vol = Math.max(sp.vol, .3); sp.delay = Math.min(sp.delay, 3); play('ship_far', pos, { sp, vol: 1.1 }); }
function sfxShipNear() { play('ship_near', null, { vol: 1.3, revMul: 2 }); }
function sfxPing() { play('ping', null, { vol: .45, delay: .03 }); }
const MECH = { out: 'mag_out', in: 'mag_in', bolt: 'bolt_open', boltc: 'bolt_close', dry: 'dry', pick: 'mag_in', pin: 'pin', clip: 'clip_in' };
function sfxMech(kind, delay = 0) { play(MECH[kind] || kind, null, { vol: .55, delay }); }
function sfxWhiz(from) { const sp = spatial(from, 1e9); sp.vol = 1; sp.delay = 0; sp.rev = .04; sp.lp = 20000; play('whiz', null, { sp, vol: .55 }); if (R() < .7) play('crack', null, { sp, vol: .9 }); }
function sfxCrack() { play('crack', null, { vol: .8 }); }
function sfxRicochet(pos) { play('ricochet', pos, { ref: 15, vol: .7 }); }
function sfxImpact(pos, kind) { const n = 'imp_' + kind; if (AU.buf[n]) play(n, pos, { ref: 7, vol: .8 }); }
function sfxStep(kind, run) { play('step_' + kind, null, { vol: run ? .5 : .32 }); }
function sfxRocket(pos) { play('rocket', pos, { ref: 25 }); }
function sfxThud() { play('thud', null, { vol: .8 }); }
function sfxTick() { play('dry', null, { vol: .25, rate: 1.5 }); }
function sfxHeart() { play('heart', null, { vol: .8 }); }
function sfxBreath() { play('breath', null, { vol: .5 }); }
function sfxWhistle(pos, long) { play(long ? 'bomb' : 'whistle', pos, { ref: 70, vol: .9, noDelay: true }); }
function sfxMortar(pos) { play('mortar', pos, { ref: 40 }); }
function sfxPlane(pos) { }
function sfxVoice(pos, kind) { play(kind, pos, { ref: 18, vol: .55, revMul: 1.4 }); }
function sfxTink(pos) { play('tink', pos, { ref: 4, vol: .5 }); }
function muffle(sec) {
  if (!AU.ctx) return;
  const f = AU.muffle.frequency, t = AU.ctx.currentTime;
  f.cancelScheduledValues(t); f.setValueAtTime(240, t); f.exponentialRampToValueAtTime(19000, t + sec);
  for (const [fr, v] of [[3700, .05], [5200, .02]]) {
    const o = AU.ctx.createOscillator(), g = AU.ctx.createGain(); o.frequency.value = fr;
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + sec * .95);
    o.connect(g); g.connect(AU.master); o.start(t); o.stop(t + sec);
  }
}

let ambT = 0, heartT = 0, breathT = 0;
function startAmbience() {
  AU.surf = loopSound('surf', 0); AU.wind = loopSound('wind', .05); AU.bed = loopSound('battle', .2); AU.boatEng = loopSound('eng_boat', 0);
}
function updateAudio(dt) {
  if (!AU.ready) return;
  AU.master.gain.value = SETTINGS.volume;
  const shore = Math.abs(camera.position.z + 6);
  AU.surf.set(.15 + .85 / (1 + shore / 18), 0, 1, P.mode === 'plane' ? 600 : 20000);
  AU.wind.set(P.mode === 'plane' ? .35 : .07, 0, P.mode === 'plane' ? 1.4 : 1);
  AU.bed.set(.22 * AU.battle);
  AU.boatEng.set(P.inBoat ? .35 : 0);
  ambT -= dt;
  if (ambT <= 0) {
    ambT = rnd(.08, .8) / AU.battle;
    const p = new V3(camera.position.x + (R() < .5 ? -1 : 1) * rnd(100, 450), 6, camera.position.z + rnd(-250, 150));
    const r = R();
    if (r < .4) sfxShot(pick(['garand', 'kar98', 'kar98', 'garand', 'bar', 'thompson']), p);
    else if (r < .72) { const n = (rnd(8, 25)) | 0; for (let i = 0; i < n; i++) sfxShot('mg42', p, false, i * .05); }
    else if (r < .93) sfxBoom(p, rnd(.6, 1.6));
    else sfxVoice(p.clone().multiplyScalar(.3).add(camera.position.clone().multiplyScalar(.7)), pick(['scream', 'yell', 'wail']));
  }
  if (P.hp < 35 && !P.dead && P.mode === 'foot') { heartT -= dt; if (heartT <= 0) { heartT = .85; sfxHeart(); } }
  if (P.mode === 'foot' && (P.stamina < .35 || P.hp < 40) && !P.dead) { breathT -= dt; if (breathT <= 0) { breathT = 1.3; sfxBreath(); } }
}

// ============================================================
//  Parlato: voci di sintesi del browser in inglese e tedesco
// ============================================================
const SPEECH = { en: [], de: [], good: { en: false, de: false }, pending: 0, last: 0 };
// usa solo voci neurali/naturali (Edge: "Online (Natural)", Chrome: "Google"); le voci di sistema
// robotiche vengono escluse e sostituite da grida sintetizzate
function initSpeech() {
  if (!window.speechSynthesis) return;
  const choose = () => {
    const vs = speechSynthesis.getVoices();
    for (const lang of ['en', 'de']) {
      const all = vs.filter(v => v.lang && v.lang.toLowerCase().startsWith(lang === 'en' ? 'en-' : 'de'));
      const nat = all.filter(v => /natural|online|neural/i.test(v.name));
      const male = nat.filter(v => /guy|christopher|eric|roger|steffan|davis|tony|andrew|brian|conrad|killian|florian|ralf|ryan|thomas|william|liam/i.test(v.name));
      const goo = all.filter(v => /google/i.test(v.name));
      SPEECH[lang] = male.length ? male : nat.length ? nat : goo;
      SPEECH.good[lang] = SPEECH[lang].length > 0;
    }
  };
  choose(); speechSynthesis.onvoiceschanged = choose;
}
const LINES = {
  en: {
    move: ['Move! Move!', 'Go, go, go!', 'Get off the beach!', 'Keep moving!', 'Get to the seawall!', 'Don\'t stop! Keep going!'],
    medic: ['Medic!', 'Medic! I need a medic!', 'I\'m hit! I\'m hit!', 'Oh God... help me!', 'Somebody help me!', 'Mama...'],
    cover: ['Take cover!', 'Get down!', 'Machine gun!', 'MG on the bluff!', 'Covering fire!', 'Keep your heads down!'],
    grenade: ['Grenade!', 'Grenade! Get down!'], reload: ['Reloading!', 'Cover me, reloading!'], kill: ['Got him!', 'Kraut down!', 'He\'s down!'],
    fire: ['Fire in the hole!'], mortar: ['Incoming!', 'Mortars! Incoming!'], plane: ['Aircraft!', 'Here come the Jerries!', 'Those are ours! Thunderbolts!'],
  },
  de: {
    fire: ['Feuer!', 'Feuer frei!', 'Schießt doch!', 'Maschinengewehr, Feuer!'], spot: ['Da drüben! Amerikaner!', 'Achtung! Landungsboote!', 'Sie kommen!', 'Links! Links!'],
    grenade: ['Granate!', 'Handgranate!'], reload: ['Nachladen!', 'Munition!'], medic: ['Sanitäter!', 'Ich bin getroffen!', 'Mein Gott!', 'Hilfe!'],
    retreat: ['Zurück! Zurück!', 'Rückzug!'], hold: ['Haltet die Stellung!', 'Keiner geht zurück!'], plane: ['Jabos! Jabos!', 'Flieger!'],
  }
};
const IT = {
  'Move! Move!': 'Muovetevi!', 'Go, go, go!': 'Avanti, avanti!', 'Get off the beach!': 'Via dalla spiaggia!', 'Keep moving!': 'Continuate a muovervi!', 'Get to the seawall!': 'Al terrapieno!',
  'Medic!': 'Medico!', 'Medic! I need a medic!': 'Medico! Mi serve un medico!', 'I\'m hit! I\'m hit!': 'Sono colpito!', 'Take cover!': 'Al riparo!', 'Get down!': 'Giù!', 'Machine gun!': 'Mitragliatrice!',
  'MG on the bluff!': 'MG sulla scogliera!', 'Grenade!': 'Granata!', 'Grenade! Get down!': 'Granata! Giù!', 'Fire in the hole!': 'Fuoco nel buco!', 'Incoming!': 'In arrivo!', 'Mortars! Incoming!': 'Mortai! In arrivo!',
  'Feuer!': 'Fuoco!', 'Feuer frei!': 'Fuoco a volontà!', 'Da drüben! Amerikaner!': 'Laggiù! Americani!', 'Achtung! Landungsboote!': 'Attenzione! Mezzi da sbarco!', 'Sie kommen!': 'Arrivano!',
  'Granate!': 'Granata!', 'Handgranate!': 'Granata a mano!', 'Nachladen!': 'Ricarico!', 'Sanitäter!': 'Infermiere!', 'Ich bin getroffen!': 'Sono colpito!', 'Zurück! Zurück!': 'Indietro! Indietro!',
  'Haltet die Stellung!': 'Tenete la posizione!', 'Jabos! Jabos!': 'Cacciabombardieri!', 'Rückzug!': 'Ritirata!', 'Schießt doch!': 'Sparate!', 'Maschinengewehr, Feuer!': 'Mitragliatrice, fuoco!',
};
function shout(lang, cat, pos, o = {}) {
  const text = o.text || pick(LINES[lang][cat] || ['...']);
  const d = pos ? pos.distanceTo(camera.position) : 0;
  const vol = clamp(1 - d / (o.range || 70), 0, 1) * (o.vol ?? 1);
  if (vol < .06) return;
  if (o.sub && d < 40) subLine(lang === 'en' ? 'Soldato USA' : 'Soldato tedesco', text, IT[text]);
  if (!SETTINGS.voices || !window.speechSynthesis) return;
  if (!SPEECH.good[lang]) { if (pos && !o.priority) sfxVoice(pos, lang === 'en' ? 'yell' : 'yell'); return; }
  const now = performance.now();
  if (!o.priority && (SPEECH.pending > 1 || now - SPEECH.last < 700)) return;
  if (o.priority && SPEECH.pending > 1) speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang === 'en' ? 'en-US' : 'de-DE'; u.voice = pick(SPEECH[lang]);
  u.rate = o.rate || rnd(1.08, 1.22); u.pitch = o.pitch || rnd(.92, 1.04); u.volume = Math.min(1, vol * SETTINGS.volume * 1.1);
  SPEECH.pending++; SPEECH.last = now;
  u.onend = u.onerror = () => { SPEECH.pending = Math.max(0, SPEECH.pending - 1); };
  speechSynthesis.speak(u);
}
