/* Theme engine: colour themes (dark tints + light), syntax themes, fonts,
   customization overrides, motion settings and appearance snapshots.
   Everything resolves to CSS custom properties on <html>, so a change is
   visible everywhere instantly. */
(function () {
  'use strict';

  /* ---------------- Colour helpers ---------------- */
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function hexToRgb(hex) {
    const m = String(hex || '').replace('#', '').trim();
    const f = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
    const n = parseInt(f.slice(0, 6), 16);
    if (Number.isNaN(n)) return { r: 139, g: 92, b: 246 };
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  const rgba = (hex, a) => { const { r, g, b } = hexToRgb(hex); return `rgba(${r}, ${g}, ${b}, ${a})`; };
  function mix(hex, withHex, t) {
    const a = hexToRgb(hex), b = hexToRgb(withHex);
    const c = ['r', 'g', 'b'].map((k) => Math.round(a[k] + (b[k] - a[k]) * t));
    return '#' + c.map((x) => x.toString(16).padStart(2, '0')).join('');
  }
  function hslToHex(h, s, l) {
    s /= 100; l /= 100;
    const k = (n) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return '#' + [f(0), f(8), f(4)].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
  }
  function hexToHsl(hex) {
    let { r, g, b } = hexToRgb(hex); r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0; const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
    }
    return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
  }
  const isHex = (v) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(v || ''));

  /* ---------------- Built-in colour themes ---------------- */
  const BUILTIN = [
    { id: 'dark', label: 'Dark', mode: 'dark', hue: 0, sat: 0, accent: '#8b5cf6' },
    { id: 'blue', label: 'Blue', mode: 'dark', hue: 212, sat: 42, accent: '#7cc0ff' },
    { id: 'purple', label: 'Purple', mode: 'dark', hue: 262, sat: 30, accent: '#b39dff' },
    { id: 'red', label: 'Red', mode: 'dark', hue: 355, sat: 30, accent: '#ff8585' },
    { id: 'orange', label: 'Orange', mode: 'dark', hue: 28, sat: 32, accent: '#e8b088' },
    { id: 'pink', label: 'Pink', mode: 'dark', hue: 330, sat: 26, accent: '#e6a3c9' },
    { id: 'green', label: 'Green', mode: 'dark', hue: 150, sat: 26, accent: '#7ddba0' },
    { id: 'teal', label: 'Teal', mode: 'dark', hue: 175, sat: 32, accent: '#6fd6c8' },
    { id: 'cyan', label: 'Cyan', mode: 'dark', hue: 192, sat: 36, accent: '#6fdcf0' },
    { id: 'yellow', label: 'Yellow', mode: 'dark', hue: 45, sat: 30, accent: '#f0d070' },
    { id: 'indigo', label: 'Indigo', mode: 'dark', hue: 236, sat: 30, accent: '#9aa4ff' },
    { id: 'light', label: 'Light', mode: 'light', hue: 0, sat: 0, accent: '#7c3aed' },
  ];

  /* ---------------- Syntax themes ---------------- */
  const SYNTAX = {
    synapse: { label: 'Synapse', kw: '#c792ea', str: '#c3e88d', num: '#f78c6c', cm: '#5b6470', fn: '#82aaff', gl: '#ffcb6b', op: '#89ddff', bool: '#ff5370', prop: '#d5d8de' },
    dracula: { label: 'Dracula', kw: '#ff79c6', str: '#f1fa8c', num: '#bd93f9', cm: '#6272a4', fn: '#50fa7b', gl: '#8be9fd', op: '#ff79c6', bool: '#bd93f9', prop: '#f8f8f2' },
    onedark: { label: 'One Dark', kw: '#c678dd', str: '#98c379', num: '#d19a66', cm: '#5c6370', fn: '#61afef', gl: '#e5c07b', op: '#56b6c2', bool: '#d19a66', prop: '#abb2bf' },
    nord: { label: 'Nord', kw: '#81a1c1', str: '#a3be8c', num: '#b48ead', cm: '#616e88', fn: '#88c0d0', gl: '#ebcb8b', op: '#81a1c1', bool: '#b48ead', prop: '#d8dee9' },
    monokai: { label: 'Monokai', kw: '#f92672', str: '#e6db74', num: '#ae81ff', cm: '#75715e', fn: '#a6e22e', gl: '#66d9ef', op: '#f92672', bool: '#ae81ff', prop: '#f8f8f2' },
    paper: { label: 'Paper', kw: '#7c3aed', str: '#15803d', num: '#c2410c', cm: '#9ca3af', fn: '#2563eb', gl: '#b45309', op: '#0e7490', bool: '#dc2626', prop: '#374151' },
  };
  const TOKENS = ['kw', 'str', 'num', 'cm', 'fn', 'gl', 'op', 'bool', 'prop'];
  const TOKEN_LABELS = { kw: 'Keywords', str: 'Strings', num: 'Numbers', cm: 'Comments', fn: 'Functions', gl: 'Globals', op: 'Operators', bool: 'Booleans / nil', prop: 'Properties' };

  /* ---------------- Fonts ---------------- */
  const FONTS = [
    { id: 'segoe-var', label: 'Segoe UI Variable', stack: '"Segoe UI Variable Text", "Segoe UI Variable", "Segoe UI", system-ui, sans-serif' },
    { id: 'segoe', label: 'Segoe UI', stack: '"Segoe UI", system-ui, sans-serif' },
    { id: 'inter', label: 'Inter', stack: 'Inter, "Segoe UI", system-ui, sans-serif' },
    { id: 'bahnschrift', label: 'Bahnschrift', stack: 'Bahnschrift, "Segoe UI", sans-serif' },
    { id: 'calibri', label: 'Calibri', stack: 'Calibri, "Segoe UI", sans-serif' },
    { id: 'trebuchet', label: 'Trebuchet MS', stack: '"Trebuchet MS", "Segoe UI", sans-serif' },
    { id: 'verdana', label: 'Verdana', stack: 'Verdana, Geneva, sans-serif' },
    { id: 'georgia', label: 'Georgia', stack: 'Georgia, "Times New Roman", serif' },
    { id: 'cascadia', label: 'Cascadia Code', stack: '"Cascadia Code", Consolas, monospace' },
  ];

  /* ---------------- Palette ---------------- */
  function palette(t, colors = {}) {
    const light = t.mode === 'light';
    let hue = t.hue, sat = t.sat;
    if (isHex(colors.tint)) { const h = hexToHsl(colors.tint); hue = h.h; sat = clamp(h.s, 0, 60); }
    const hsl = (l, s) => `hsl(${hue} ${s === undefined ? sat : s}% ${l}%)`;
    const v = {};
    const lineA = isHex(colors.line) ? colors.line : null;
    if (!light) {
      const lift = sat > 0 ? 4 : 0;
      [4, 6, 8.5, 11.5, 14.5, 18.5, 23].forEach((l, i) => { v[`--bg-${i}`] = hsl(l + lift); });
      v['--text-1'] = hsl(96, Math.min(sat, 20));
      v['--text-2'] = hsl(70, Math.min(sat, 15));
      v['--text-3'] = hsl(47, Math.min(sat, 12));
      v['--text-4'] = hsl(32, Math.min(sat, 10));
      const w = lineA ? (a) => rgba(lineA, a * 3) : (a) => `rgba(255, 255, 255, ${a})`;
      v['--line-0'] = w(0.045); v['--line-1'] = w(0.07); v['--line-2'] = w(0.11); v['--line-3'] = w(0.18);
      v['--pop-bg'] = `hsl(${hue} ${sat}% ${15.5 + lift}% / 0.95)`;
      v['--scrim'] = 'rgba(0, 0, 0, 0.62)';
      v['--btn-primary-bg'] = '#ececec'; v['--btn-primary-fg'] = '#0d0d0d'; v['--btn-primary-hover'] = '#ffffff';
      v['--thumb'] = '#f5f5f5'; v['--thumb-on'] = '#0b0f0c';
      v['--slider-fill'] = '#cfcfcf'; v['--slider-fill-active'] = '#ffffff';
      v['--scroll'] = 'rgba(255,255,255,0.08)'; v['--scroll-hover'] = 'rgba(255,255,255,0.16)';
      v['--hl-line'] = 'rgba(255,255,255,0.028)';
      v['--shadow-rgb'] = '0, 0, 0';
      v['--invert'] = '0';
      v['--kbd-bg'] = v['--bg-5'];
    } else {
      [96, 94.5, 100, 93, 89.5, 86, 82].forEach((l, i) => { v[`--bg-${i}`] = hsl(l, Math.min(sat, 30)); });
      v['--text-1'] = hsl(8, Math.min(sat, 30));
      v['--text-2'] = hsl(34, Math.min(sat, 20));
      v['--text-3'] = hsl(52, Math.min(sat, 15));
      v['--text-4'] = hsl(68, Math.min(sat, 12));
      const w = lineA ? (a) => rgba(lineA, a * 2.2) : (a) => `rgba(0, 0, 0, ${a})`;
      v['--line-0'] = w(0.06); v['--line-1'] = w(0.09); v['--line-2'] = w(0.14); v['--line-3'] = w(0.22);
      v['--pop-bg'] = `hsl(${hue} ${Math.min(sat, 30)}% 100% / 0.97)`;
      v['--scrim'] = 'rgba(20, 20, 24, 0.38)';
      v['--btn-primary-bg'] = '#161616'; v['--btn-primary-fg'] = '#ffffff'; v['--btn-primary-hover'] = '#000000';
      v['--thumb'] = '#ffffff'; v['--thumb-on'] = '#ffffff';
      v['--slider-fill'] = '#b4b4b8'; v['--slider-fill-active'] = '#7a7a80';
      v['--scroll'] = 'rgba(0,0,0,0.14)'; v['--scroll-hover'] = 'rgba(0,0,0,0.26)';
      v['--hl-line'] = 'rgba(0,0,0,0.035)';
      v['--shadow-rgb'] = '20, 20, 30';
      v['--invert'] = '1';
      v['--kbd-bg'] = '#ffffff';
    }
    const accent = isHex(colors.accent) ? colors.accent : t.accent;
    v['--accent'] = accent;
    v['--accent-soft'] = rgba(accent, light ? 0.12 : 0.14);
    v['--accent-line'] = rgba(accent, light ? 0.7 : 0.55);
    v['--accent-text'] = light ? mix(accent, '#000000', 0.25) : mix(accent, '#ffffff', 0.25);
    v['--sel-bg'] = rgba(accent, light ? 0.22 : 0.3);
    const sem = { ok: '#3ddc84', warn: '#e8b84a', danger: '#ef5a5a', info: '#6aa8ff' };
    if (light) Object.assign(sem, { ok: '#16a34a', warn: '#b7791f', danger: '#dc2626', info: '#2563eb' });
    Object.keys(sem).forEach((k) => {
      const c = isHex(colors[k]) ? colors[k] : sem[k];
      v[`--${k}`] = c; v[`--${k}-soft`] = rgba(c, 0.12);
    });
    if (isHex(colors.text1)) v['--text-1'] = colors.text1;
    if (isHex(colors.text2)) v['--text-2'] = colors.text2;
    // Toggle "on" colour follows the success colour so it reads in every theme.
    v['--toggle-on'] = v['--ok'];
    return v;
  }

  /* ---------------- State ---------------- */
  const custom = () => Store.get('customThemes') || [];
  function list() { return [...BUILTIN, ...custom()]; }
  function byId(id) { return list().find((t) => t.id === id) || BUILTIN[0]; }
  function current() { return byId(Store.get('theme')); }
  function swatches(t) {
    if (t.mode === 'light') return ['#f2f2f2', '#ffffff', '#e8e8e8', '#111111'];
    const p = palette(t);
    return [p['--bg-0'], p['--bg-4'], t.accent, mix(t.accent, '#ffffff', 0.55)];
  }

  let styleEl = null;
  function ensureStyle() {
    if (!styleEl) { styleEl = document.createElement('style'); styleEl.id = 'custom-css'; document.head.appendChild(styleEl); }
    return styleEl;
  }

  /* ---------------- Apply ---------------- */
  function apply() {
    const t = current();
    const root = document.documentElement;
    const r = root.style;
    const colors = Store.get('customColors') || {};
    const v = palette(t, colors);
    Object.keys(v).forEach((k) => r.setProperty(k, v[k]));
    root.classList.toggle('light', t.mode === 'light');
    root.classList.toggle('tinted', t.sat > 0);
    r.setProperty('--tint-hue', String(t.hue));
    document.body && document.body.classList.toggle('light', t.mode === 'light');

    // Syntax
    let sid = Store.get('syntaxTheme') || 'synapse';
    let syn = SYNTAX[sid] || (Store.get('customSyntax') || {})[sid] || SYNTAX.synapse;
    if (t.mode === 'light' && sid === 'synapse') syn = SYNTAX.paper;
    TOKENS.forEach((k) => r.setProperty(`--tok-${k}`, syn[k]));

    // Font
    const fid = Store.get('appFont') || 'segoe-var';
    const f = FONTS.find((x) => x.id === fid);
    const stack = f ? f.stack : `"${String(fid).replace(/"/g, '')}", "Segoe UI", system-ui, sans-serif`;
    r.setProperty('--font-ui', stack);
    r.setProperty('--font-display', stack);

    // Layout customization
    const lay = Store.get('customLayout') || {};
    r.setProperty('--radius-lg', (lay.cardRadius ?? 10) + 'px');
    r.setProperty('--radius-xl', ((lay.cardRadius ?? 10) + 2) + 'px');
    r.setProperty('--ctl', { compact: 0.9, default: 1, comfortable: 1.12 }[lay.controlSize || 'default']);
    r.setProperty('--card-bw', (lay.borderWidth ?? 1) + 'px');
    r.setProperty('--sidebar-w', (lay.sidebarWidth ?? 204) + 'px');
    r.setProperty('--density', { compact: 0.82, default: 1, relaxed: 1.18 }[lay.density || 'default']);

    // Motion
    const anim = Store.get('animations') !== false;
    const speed = clamp(Number(Store.get('animSpeed')) || 1, 0.25, 3);
    const style = Store.get('animStyle') || 'smooth';
    root.classList.toggle('reduce-motion', !anim || !!Store.get('reduceMotion'));
    root.classList.remove('anim-smooth', 'anim-snappy', 'anim-minimal');
    root.classList.add('anim-' + style);
    r.setProperty('--anim-speed', String(speed * (style === 'snappy' ? 1.35 : 1)));

    // Depth
    r.setProperty('--depth', String(clamp(Number(Store.get('panelDepth') ?? 100), 0, 200) / 100));

    // Advanced CSS
    ensureStyle().textContent = Store.get('customCss') || '';
  }

  /* ---------------- Custom themes ---------------- */
  function addCustom(t) {
    const id = t.id || ('custom-' + Date.now().toString(36));
    const next = custom().filter((x) => x.id !== id);
    next.push({ ...t, id, custom: true });
    Store.set('customThemes', next);
    return id;
  }
  function removeCustom(id) {
    Store.set('customThemes', custom().filter((x) => x.id !== id));
    if (Store.get('theme') === id) Store.set('theme', 'dark');
  }

  /* ---------------- Snapshots (save / import / export) ---------------- */
  const APPEARANCE_KEYS = [
    'theme', 'customThemes', 'customColors', 'customLayout', 'customCss', 'appFont', 'syntaxTheme', 'customSyntax',
    'borderThickness', 'borderColor', 'rainbowBorder', 'cornerRadius', 'background', 'watermark', 'windowOpacity',
    'solidWhenFocused', 'panelDepth', 'interfaceGrid', 'colorfulIcons', 'macButtons', 'showVersion', 'showBrandText',
    'animations', 'animSpeed', 'animStyle', 'buttonSound', 'topBarStyle', 'startupTab', 'toolbarPosition', 'navbarPosition', 'explorerSide',
    'soundEnabled', 'soundVolume', 'soundHover', 'reduceMotion',
  ];
  function snapshot() { const o = {}; APPEARANCE_KEYS.forEach((k) => { o[k] = Store.get(k); }); return { app: 'Synapse Reborn Apex', kind: 'appearance', version: 1, savedAt: new Date().toISOString(), settings: o }; }
  function restore(snap) {
    const s = snap && snap.settings ? snap.settings : snap;
    if (!s || typeof s !== 'object') throw new Error('Not an appearance file');
    APPEARANCE_KEYS.forEach((k) => { if (s[k] !== undefined) Store.set(k, s[k]); });
    apply();
  }
  // Reset returns every appearance setting to defaults but keeps things the
  // user authored (custom themes, custom syntax themes); export/import carry those.
  const KEEP_ON_RESET = new Set(['customThemes', 'customSyntax']);
  function resetAppearance() {
    APPEARANCE_KEYS.forEach((k) => { if (!KEEP_ON_RESET.has(k)) Store.set(k, Store.defaults[k]); });
    apply();
  }

  window.Theme = { BUILTIN, SYNTAX, TOKENS, TOKEN_LABELS, FONTS, palette, list, byId, current, swatches, apply, addCustom, removeCustom, snapshot, restore, resetAppearance, APPEARANCE_KEYS, util: { hexToRgb, rgba, mix, hslToHex, hexToHsl, isHex } };
})();
