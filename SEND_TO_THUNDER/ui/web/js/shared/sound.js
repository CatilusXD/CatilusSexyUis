/* Subtle UI sound design, synthesized with Web Audio.
   Everything is short, quiet and weighted by importance:
     tick < click < toggle < open/close < notify < success < error          */
(function () {
  'use strict';

  const WEIGHT = {
    tick: 0.30,
    click: 0.42,
    hover: 0.10,
    toggleOn: 0.5,
    toggleOff: 0.45,
    open: 0.4,
    close: 0.35,
    notify: 0.7,
    success: 0.85,
    error: 1.0,
    inject: 0.9,
    soft: 0.4,
    pop: 0.45,
  };

  let ctx = null;
  let master = null;
  let comp = null;
  let noiseBuf = null;
  let lastAt = {};

  const state = {
    enabled: true,
    volume: 0.6,      // 0..1 master
    hover: false,     // hover sounds are off by default (they get tiring)
  };

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC({ latencyHint: 'interactive' });
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 12;
    comp.ratio.value = 6;
    comp.attack.value = 0.002;
    comp.release.value = 0.08;
    master = ctx.createGain();
    master.gain.value = state.volume;
    master.connect(comp).connect(ctx.destination);

    // 1s of white noise reused for clicks/whooshes.
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return ctx;
  }

  function resume() {
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  function env(g, t, a, peak, d, sustain) {
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, sustain || 0.0001), t + a + d);
  }

  function tone(type, f0, f1, dur, peak, t, detune) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    if (detune) o.detune.value = detune;
    env(g, t, 0.004, peak, dur);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  function noise(dur, peak, t, filterType, freq, q, sweepTo) {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = filterType || 'bandpass';
    f.frequency.setValueAtTime(freq || 2500, t);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    f.Q.value = q || 1.2;
    const g = ctx.createGain();
    env(g, t, 0.002, peak, dur);
    s.connect(f).connect(g).connect(master);
    s.start(t);
    s.stop(t + dur + 0.05);
  }

  const recipes = {
    click(t, v) {
      noise(0.022, v * 0.9, t, 'bandpass', 3200, 1.4, 1600);
      tone('sine', 1500, 900, 0.03, v * 0.35, t);
    },
    tick(t, v) {
      noise(0.012, v * 0.7, t, 'highpass', 4000, 0.8);
      tone('sine', 2200, 1800, 0.018, v * 0.3, t);
    },
    hover(t, v) {
      noise(0.008, v, t, 'highpass', 5000, 0.7);
    },
    toggleOn(t, v) {
      tone('sine', 820, 1240, 0.06, v * 0.6, t);
      noise(0.015, v * 0.5, t, 'bandpass', 3000, 1.2);
    },
    toggleOff(t, v) {
      tone('sine', 1100, 700, 0.06, v * 0.55, t);
      noise(0.015, v * 0.45, t, 'bandpass', 2400, 1.2);
    },
    open(t, v) {
      noise(0.07, v * 0.6, t, 'bandpass', 900, 0.9, 3200);
      tone('sine', 600, 900, 0.07, v * 0.25, t);
    },
    close(t, v) {
      noise(0.06, v * 0.55, t, 'bandpass', 2800, 0.9, 700);
      tone('sine', 900, 560, 0.06, v * 0.22, t);
    },
    notify(t, v) {
      tone('sine', 1046, 1046, 0.14, v * 0.5, t);
      tone('sine', 1046 * 2, 1046 * 2, 0.10, v * 0.12, t + 0.01);
    },
    success(t, v) {
      tone('triangle', 880, 880, 0.10, v * 0.45, t);
      tone('triangle', 1318, 1318, 0.16, v * 0.42, t + 0.085);
      tone('sine', 2636, 2636, 0.12, v * 0.08, t + 0.085);
    },
    error(t, v) {
      tone('triangle', 220, 196, 0.18, v * 0.55, t);
      tone('sine', 110, 98, 0.2, v * 0.35, t, 6);
      noise(0.05, v * 0.25, t, 'lowpass', 900, 0.8);
    },
    soft(t, v) {
      tone('sine', 700, 520, 0.05, v * 0.5, t);
      noise(0.02, v * 0.25, t, 'lowpass', 1400, 0.8);
    },
    pop(t, v) {
      noise(0.03, v * 0.8, t, 'bandpass', 1100, 1.6, 320);
      tone('sine', 420, 220, 0.045, v * 0.4, t);
    },
    inject(t, v) {
      tone('sine', 520, 1040, 0.16, v * 0.35, t);
      tone('triangle', 1040, 1560, 0.14, v * 0.32, t + 0.12);
      noise(0.12, v * 0.3, t, 'bandpass', 1200, 0.8, 5000);
    },
  };

  function play(name, opts) {
    if (!state.enabled) return;
    if (name === 'hover' && !state.hover) return;
    const r = recipes[name];
    if (!r) return;
    if (!ensure()) return;
    resume();
    const now = performance.now();
    const minGap = name === 'hover' ? 40 : 25;
    if (lastAt[name] && now - lastAt[name] < minGap) return;
    lastAt[name] = now;
    const t = ctx.currentTime + 0.001;
    const v = (WEIGHT[name] || 0.5) * 0.28 * ((opts && opts.gain) || 1);
    try { r(t, v); } catch (e) { /* ignore audio errors */ }
  }

  function setVolume(v) {
    state.volume = Math.max(0, Math.min(1, v));
    if (master) master.gain.setTargetAtTime(state.volume, ctx.currentTime, 0.02);
  }
  function setEnabled(b) { state.enabled = !!b; }
  function setHover(b) { state.hover = !!b; }

  // Unlock the audio context on first interaction (autoplay policy).
  const unlock = () => { ensure(); resume(); };
  window.addEventListener('pointerdown', unlock, { once: true, capture: true });
  window.addEventListener('keydown', unlock, { once: true, capture: true });

  window.Sound = { play, setVolume, setEnabled, setHover, state, names: Object.keys(recipes) };
})();
