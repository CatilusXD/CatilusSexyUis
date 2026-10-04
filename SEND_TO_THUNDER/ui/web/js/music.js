/* Background music: a local file or URL through an <audio> element, with an
   analyser feeding the title-bar visualizer. */
(function () {
  'use strict';

  const audio = new Audio();
  audio.preload = 'auto';
  audio.loop = true;
  audio.crossOrigin = 'anonymous';

  let ctx = null, analyser = null, source = null, data = null;
  let canvas = null, raf = 0;
  let track = null;          // { name, kind: 'file'|'url', src }
  let pausedByBlur = false;
  const listeners = new Set();
  const emit = () => listeners.forEach((fn) => { try { fn(state()); } catch (e) { /* ignore */ } });

  function ensureGraph() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      ctx = new AC();
      source = ctx.createMediaElementSource(audio);
      analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.82;
      source.connect(analyser).connect(ctx.destination);
      data = new Uint8Array(analyser.frequencyBinCount);
    } catch (e) { ctx = null; }
  }

  function state() {
    return { track, playing: !audio.paused && !audio.ended && !!track, time: audio.currentTime || 0, duration: isFinite(audio.duration) ? audio.duration : 0, volume: audio.volume };
  }

  function setFile(file) {
    if (track && track.kind === 'file' && track.src) URL.revokeObjectURL(track.src);
    track = { name: file.name.replace(/\.[^.]+$/, ''), kind: 'file', src: URL.createObjectURL(file) };
    audio.src = track.src;
    Store.set('musicTrackName', track.name);
    play();
  }
  function setUrl(url) {
    if (!/^https?:\/\//i.test(url)) throw new Error('Enter a full http(s) URL');
    track = { name: url.split('/').pop() || url, kind: 'url', src: url };
    audio.src = url;
    Store.set('musicUrl', url);
    Store.set('musicTrackName', track.name);
    play();
  }
  function clear() {
    audio.pause();
    if (track && track.kind === 'file' && track.src) URL.revokeObjectURL(track.src);
    track = null; audio.removeAttribute('src'); audio.load();
    Store.set('musicTrackName', '');
    stopViz(); emit();
  }
  async function play() {
    if (!track) return;
    ensureGraph();
    if (ctx && ctx.state === 'suspended') ctx.resume();
    try { await audio.play(); } catch (e) { UI.Toast.show({ type: 'warn', title: 'Playback blocked', msg: 'Click anywhere, then press play.' }); }
    startViz(); emit();
  }
  function pause() { audio.pause(); stopViz(); emit(); }
  function toggle() { if (audio.paused) play(); else pause(); }
  function setVolume(pct) { audio.volume = Math.max(0, Math.min(1, pct / 100)); }

  /* ---------------- Visualizer ---------------- */
  function attachCanvas(c) { canvas = c; if (!audio.paused) startViz(); }
  function startViz() {
    stopViz();
    if (!canvas || !Store.get('musicVisualizer')) { if (canvas) canvas.classList.remove('on'); return; }
    canvas.classList.add('on');
    const g = canvas.getContext('2d');
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const w = canvas.width, h = canvas.height;
      g.clearRect(0, 0, w, h);
      const bars = 16, gap = 2, bw = (w - gap * (bars - 1)) / bars;
      const color = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#8b5cf6';
      g.fillStyle = color;
      for (let i = 0; i < bars; i++) {
        let v = 0.15;
        if (analyser && data) { if (i === 0) analyser.getByteFrequencyData(data); const idx = Math.min(data.length - 1, Math.floor(Math.pow(i / bars, 1.6) * data.length * 0.75) + i); v = Math.max(0.1, data[idx] / 255); }
        else v = 0.2 + 0.5 * Math.abs(Math.sin(Date.now() / 300 + i));
        const bh = Math.max(2, v * h);
        const x = i * (bw + gap), y = (h - bh) / 2;
        g.globalAlpha = 0.45 + v * 0.55;
        g.beginPath(); g.roundRect(x, y, bw, bh, 1.5); g.fill();
      }
      g.globalAlpha = 1;
    };
    draw();
  }
  function stopViz() { cancelAnimationFrame(raf); raf = 0; if (canvas) { canvas.classList.remove('on'); const g = canvas.getContext('2d'); g.clearRect(0, 0, canvas.width, canvas.height); } }

  /* ---------------- Focus behaviour ---------------- */
  function onFocusChange(focused) {
    if (!Store.get('musicOnlyFocused') || !track) return;
    if (!focused && !audio.paused) { audio.pause(); pausedByBlur = true; stopViz(); emit(); }
    else if (focused && pausedByBlur) { pausedByBlur = false; play(); }
  }

  audio.addEventListener('timeupdate', emit);
  audio.addEventListener('play', emit);
  audio.addEventListener('pause', emit);
  audio.addEventListener('error', () => { UI.Toast.show({ type: 'danger', title: 'Could not play track', msg: track ? track.name : '' }); track = null; stopViz(); emit(); });

  // Restore a URL track (files cannot persist across launches).
  function init() {
    setVolume(Store.get('musicVolume') ?? 50);
    const url = Store.get('musicUrl');
    if (Store.get('musicSource') === 'url' && url) { track = { name: url.split('/').pop() || url, kind: 'url', src: url }; audio.src = url; emit(); }
    Store.on('musicVolume', (v) => setVolume(v));
    Store.on('musicVisualizer', () => { if (!audio.paused) startViz(); else stopViz(); });
  }

  window.Music = { init, setFile, setUrl, clear, play, pause, toggle, setVolume, state, attachCanvas, onFocusChange, on: (fn) => { listeners.add(fn); return () => listeners.delete(fn); } };
})();
