/* Settings › Appearance. Every control is bound to the store; Theme/App react
   to store changes, so nothing here is decorative. */
(function () {
  'use strict';
  const { $, $$, h, esc } = UI;
  const U = () => Theme.util;

  const PRESETS = ['#8b5cf6', '#7c3aed', '#6aa8ff', '#2563eb', '#3ddc84', '#16a34a', '#e8b84a', '#f97316', '#ef5a5a', '#f43f5e', '#ff7ab6', '#00e5ff', '#14b8a6', '#a3a3a3', '#ffffff', '#111111'];

  /* ---------------- Colour control: swatch + hex ---------------- */
  function colorControl({ value, onChange, allowEmpty, emptyLabel }) {
    const wrap = h(`<div class="hexrow"><button class="swatch" data-tip="Pick a colour"><i></i></button><div class="input"><input type="text" spellcheck="false" placeholder="${allowEmpty ? 'default' : '#000000'}"></div></div>`);
    const sw = $('.swatch', wrap), inp = $('input', wrap);
    let cur = value || '';
    const paint = () => { sw.style.setProperty('--sw', cur || 'transparent'); inp.value = cur; };
    const commit = (v) => { if (v && !U().isHex(v)) { inp.classList.add('bad'); return; } cur = v; paint(); onChange(cur); };
    sw.addEventListener('click', () => {
      const grid = h('<div style="padding:6px;width:236px;display:flex;flex-direction:column;gap:8px"><div class="color-grid"></div><div class="hexrow"><div class="input" style="flex:1"><input type="text" spellcheck="false" placeholder="#hex"></div></div></div>');
      const g = $('.color-grid', grid);
      (allowEmpty ? [''] : []).concat(PRESETS).forEach((c) => {
        const b = h(`<button class="c${cur === c ? ' selected' : ''}" style="background:${c || 'linear-gradient(135deg,#8b5cf6,#2e2e2e)'}" data-tip="${c || (emptyLabel || 'Theme default')}"></button>`);
        b.addEventListener('click', () => { commit(c); UI.Menu.close(); Sound.play('tick'); });
        g.appendChild(b);
      });
      const hx = $('input', grid); hx.value = cur;
      hx.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const v = hx.value.trim(); if (!v && allowEmpty) { commit(''); UI.Menu.close(); } else if (U().isHex(v)) { commit(v); UI.Menu.close(); } else UI.Toast.show({ type: 'warn', title: 'Invalid colour', msg: 'Use a hex value like #8b5cf6.' }); } });
      UI.Menu.show(sw, [], { content: grid, align: 'right' });
      setTimeout(() => hx.focus(), 80);
    });
    inp.addEventListener('change', () => { const v = inp.value.trim(); if (!v && allowEmpty) commit(''); else if (U().isHex(v)) commit(v); else { UI.Toast.show({ type: 'warn', title: 'Invalid colour', msg: 'Use a hex value like #8b5cf6.' }); paint(); } });
    paint();
    return wrap;
  }

  /* ---------------- Theme tiles ---------------- */
  function themeTile(t, selectedId) {
    const sw = Theme.swatches(t);
    const el = h(`<button class="theme-tile${t.id === selectedId ? ' selected' : ''}" data-id="${esc(t.id)}">
      <span class="sw">${sw.map((c) => `<i style="background:${c}"></i>`).join('')}</span>
      <span class="tt"><span>${esc(t.label)}</span>${Icons.icon('check', 'plain')}</span>
    </button>`);
    if (t.custom) {
      const del = Widgets.button({ icon: 'x', iconOnly: true, kind: 'ghost', size: 'xs', tip: 'Delete theme', onClick: async (e) => { e.stopPropagation(); if (await UI.Modal.confirm(`Delete “${t.label}”?`, 'This custom theme will be removed.', 'Delete', 'danger')) { Theme.removeCustom(t.id); UI.Toast.show({ type: 'info', title: 'Theme deleted', msg: t.label }); } } });
      del.classList.add('del'); el.appendChild(del);
    }
    el.addEventListener('click', () => { if (Store.get('theme') !== t.id) { Store.set('theme', t.id); Sound.play('success'); } });
    return el;
  }

  function themeSection() {
    const sec = h(`<div class="section"><div class="section-label">Theme</div><div class="card">
      <div class="theme-head"><div class="row-icon">${Icons.icon('palette')}</div><div class="th-body"><div class="th-title">Theme</div><div class="th-desc">Overall colour scheme applied to the entire application</div></div><div class="th-right"></div></div>
      <div class="theme-grid"></div>
    </div></div>`);
    let filter = 'builtin';
    const sel = h(`<button class="select"><span class="sel-label"></span>${Icons.icon('chevron-down')}</button>`);
    const selApi = UI.bindSelect(sel, [{ label: 'Color Themes', value: 'builtin' }, { label: 'Custom Themes', value: 'custom' }, { label: 'All Themes', value: 'all' }], { value: filter, onChange: (v) => { filter = v; render(); }, align: 'right' });
    if (Theme.current().custom) { filter = 'all'; selApi.set('all'); }
    $('.th-right', sec).appendChild(sel);
    const grid = $('.theme-grid', sec);
    function render() {
      grid.innerHTML = '';
      const add = h(`<button class="theme-tile add"><span class="sw">${Icons.icon('plus', 'plain')}</span><span class="tt"><span>Add Custom Theme</span></span></button>`);
      add.addEventListener('click', () => customThemeDialog());
      grid.appendChild(add);
      const cur = Store.get('theme');
      Theme.list().filter((t) => filter === 'all' || (filter === 'custom' ? t.custom : !t.custom)).forEach((t) => grid.appendChild(themeTile(t, cur)));
      if (filter === 'custom' && !Theme.list().some((t) => t.custom)) grid.appendChild(h('<div class="tree-empty" style="grid-column:span 2;align-self:center">No custom themes yet — build one with the tile on the left.</div>'));
    }
    render();
    const off1 = Store.on('theme', () => { $$('.theme-tile[data-id]', grid).forEach((b) => b.classList.toggle('selected', b.dataset.id === Store.get('theme'))); });
    const off2 = Store.on('customThemes', () => { if (filter === 'builtin') { filter = 'all'; selApi.set('all'); } render(); });
    sec._cleanup = () => { off1(); off2(); };
    return sec;
  }

  function customThemeDialog(existing) {
    const base = existing || { label: 'My Theme', mode: 'dark', hue: 265, sat: 30, accent: '#a78bfa' };
    const draft = { ...base };
    const body = h(`<div style="display:flex;flex-direction:column;gap:14px">
      <div class="field"><label>Name</label><div class="input"><input type="text" value="${esc(draft.label)}" spellcheck="false" maxlength="24"></div></div>
      <div class="field"><label>Mode</label><div class="segmented mode-seg"><button class="seg${draft.mode === 'dark' ? ' active' : ''}" data-m="dark">${Icons.icon('moon')}Dark</button><button class="seg${draft.mode === 'light' ? ' active' : ''}" data-m="light">${Icons.icon('sun')}Light</button></div></div>
      <div class="field"><label>Tint hue</label><div class="slider hue-slider"><div class="track"><div class="fill"></div><div class="thumb"></div></div><div class="value"></div></div></div>
      <div class="field"><label>Tint strength</label><div class="slider"><div class="track"><div class="fill"></div><div class="thumb"></div></div><div class="value"></div></div></div>
      <div class="field"><label>Accent</label><div class="accent-ctl"></div></div>
      <div class="field"><label>Preview</label><div class="preview-tile"><div class="pt-bar"></div><div class="pt-row"><i></i><i></i><i></i></div><div class="pt-text" style="font-size:12px;font-weight:600">Synapse Reborn Apex · sample text</div></div></div>
    </div>`);
    const prev = $('.preview-tile', body);
    const preview = () => {
      const p = Theme.palette(draft);
      prev.style.background = p['--bg-0']; prev.style.borderColor = p['--line-2'];
      $('.pt-bar', prev).style.background = p['--bg-4'];
      const rows = $$('.pt-row i', prev); rows[0].style.background = p['--bg-2']; rows[1].style.background = p['--bg-5']; rows[2].style.background = draft.accent;
      $('.pt-text', prev).style.color = p['--text-1'];
    };
    $$('.mode-seg .seg', body).forEach((b) => b.addEventListener('click', () => { $$('.mode-seg .seg', body).forEach((x) => x.classList.toggle('active', x === b)); draft.mode = b.dataset.m; preview(); }));
    UI.bindSlider($('.hue-slider', body), { min: 0, max: 360, step: 1, value: draft.hue, format: (v) => v + '°', onInput: (v) => { draft.hue = v; preview(); } });
    UI.bindSlider($$('.slider', body)[1], { min: 0, max: 60, step: 1, value: draft.sat, format: (v) => v + '%', onInput: (v) => { draft.sat = v; preview(); } });
    $('.accent-ctl', body).appendChild(colorControl({ value: draft.accent, onChange: (v) => { draft.accent = v || '#8b5cf6'; preview(); } }));
    $('input', body).addEventListener('input', (e) => { draft.label = e.target.value; });
    preview();
    UI.Modal.open({ title: existing ? 'Edit theme' : 'Add custom theme', sub: 'Pick a tint, strength and accent. The preview updates live.', body, actions: [
      { label: 'Cancel', kind: 'ghost', value: false },
      { label: existing ? 'Save' : 'Create theme', kind: 'primary', icon: 'check', value: true, onClick: () => { if (!draft.label.trim()) { UI.Toast.show({ type: 'warn', title: 'Give the theme a name' }); return false; } } },
    ] }).then((ok) => {
      if (!ok) return;
      const id = Theme.addCustom({ ...draft, label: draft.label.trim() });
      Store.set('theme', id);
      UI.Toast.show({ type: 'ok', title: 'Theme created', msg: draft.label.trim() });
    });
  }

  /* ---------------- Fonts ---------------- */
  function fontRow() {
    const row = h('<div class="font-row"></div>');
    const render = () => {
      row.innerHTML = '';
      const cur = Store.get('appFont');
      const add = h(`<button class="font-tile add" data-tip="Use an installed font by name">${Icons.icon('plus', 'plain')}</button>`);
      add.addEventListener('click', () => {
        UI.Modal.open({ title: 'Custom font', sub: 'Type the family name of a font installed on this PC.', body: '<div class="field"><label>Font family</label><div class="input"><input type="text" placeholder="e.g. JetBrains Mono" spellcheck="false"></div></div>', actions: [{ label: 'Cancel', kind: 'ghost', value: false }, { label: 'Use font', kind: 'primary', value: true, onClick: (el) => { const v = $('input', el).value.trim(); if (!v) return false; el._font = v; } }] })
          .then((ok) => { if (!ok) return; const v = $('.modal') && $('.modal')._font; if (v) { Store.set('appFont', v); UI.Toast.show({ type: 'ok', title: 'Font applied', msg: v }); } });
      });
      row.appendChild(add);
      const fonts = [...Theme.FONTS];
      if (cur && !fonts.some((f) => f.id === cur)) fonts.push({ id: cur, label: cur, stack: `"${cur}", "Segoe UI", sans-serif`, custom: true });
      fonts.forEach((f) => {
        const t = h(`<button class="font-tile${f.id === cur ? ' selected' : ''}" style="font-family:${esc(f.stack)}" data-tip="${esc(f.label)}"><span class="fcheck">${Icons.icon('check', 'plain')}</span>Aa</button>`);
        t.addEventListener('click', () => { Store.set('appFont', f.id); $$('.font-tile', row).forEach((x) => x.classList.toggle('selected', x === t)); });
        row.appendChild(t);
      });
    };
    render();
    Store.on('appFont', render);
    return row;
  }

  /* ---------------- Music ---------------- */
  function musicSection() {
    const sec = h(`<div class="section"><div class="section-label">Music</div><div class="card">
      <div class="music-box"><div class="music-top"></div><div class="music-body"></div></div>
      <div class="rows"></div>
    </div></div>`);
    const top = $('.music-top', sec), bodyEl = $('.music-body', sec);
    const srcSel = h(`<button class="select" style="min-width:96px"><span class="sel-label"></span>${Icons.icon('chevron-down')}</button>`);
    UI.bindSelect(srcSel, [{ label: 'File', value: 'file' }, { label: 'URL', value: 'url' }], { value: Store.get('musicSource'), onChange: (v) => { Store.set('musicSource', v); renderBody(); } });
    top.appendChild(srcSel);
    const choose = Widgets.button({ label: 'Choose file', icon: 'plus', kind: 'subtle', onClick: async () => { const f = await App.pickFile('audio/*'); if (f) Music.setFile(f); } });
    top.appendChild(choose);
    function renderBody() {
      const st = Music.state();
      bodyEl.innerHTML = '';
      choose.style.display = Store.get('musicSource') === 'url' ? 'none' : '';
      if (Store.get('musicSource') === 'url') {
        const ur = h(`<div class="url-row"><div class="input"><input type="text" placeholder="https://example.com/track.mp3" spellcheck="false" value="${esc(Store.get('musicUrl') || '')}"></div></div>`);
        ur.appendChild(Widgets.button({ label: 'Load', icon: 'play', kind: 'subtle', onClick: () => { try { Music.setUrl($('input', ur).value.trim()); } catch (e) { UI.Toast.show({ type: 'warn', title: 'Invalid URL', msg: e.message }); } } }));
        $('input', ur).addEventListener('keydown', (e) => { if (e.key === 'Enter') $('.btn', ur).click(); });
        bodyEl.appendChild(ur);
      }
      if (!st.track) { bodyEl.appendChild(h(`<div class="music-empty">${Store.get('musicTrackName') ? `“${esc(Store.get('musicTrackName'))}” was playing last time — choose the file again to resume.` : 'No music added yet.'}</div>`)); return; }
      const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
      const tr = h(`<div class="track music-track"><span class="avatar" style="border-radius:8px">${Icons.icon('music')}</span><div class="t-meta"><div class="t-name">${esc(st.track.name)}</div><div class="t-bar"><i></i></div></div><span class="t-time"></span></div>`);
      const play = Widgets.button({ icon: st.playing ? 'square' : 'play', iconOnly: true, kind: 'subtle', size: 'sm', tip: st.playing ? 'Pause' : 'Play', onClick: () => Music.toggle() });
      const rm = Widgets.button({ icon: 'x', iconOnly: true, kind: 'ghost', size: 'sm', tip: 'Remove', onClick: () => Music.clear() });
      tr.append(play, rm);
      bodyEl.appendChild(tr);
      const tick = (s) => { $('.t-time', tr).textContent = `${fmt(s.time)} / ${s.duration ? fmt(s.duration) : '--:--'}`; $('.t-bar i', tr).style.width = (s.duration ? (s.time / s.duration) * 100 : 0) + '%'; play.innerHTML = Icons.icon(s.playing ? 'square' : 'play'); play.setAttribute('data-tip', s.playing ? 'Pause' : 'Play'); };
      tick(st);
      tr._tick = tick;
    }
    renderBody();
    const off = Music.on((s) => { const tr = $('.track', bodyEl); if (tr && s.track && tr._tick) tr._tick(s); else renderBody(); });
    sec._cleanup = off;
    const rows = $('.rows', sec);
    rows.append(
      Widgets.row({ icon: 'volume', title: 'Volume', desc: 'Adjust the music volume', control: { type: 'slider', key: 'musicVolume', min: 0, max: 100, step: 1, format: (v) => v + '%', onInput: (v) => Music.setVolume(v) } }),
      Widgets.row({ icon: 'music', title: 'Only When Focused', desc: 'Pause the music when the window loses focus', control: { type: 'toggle', key: 'musicOnlyFocused' } }),
      Widgets.row({ icon: 'activity', title: 'Titlebar Visualizer', desc: 'Show bars for the playing track in the title bar', control: { type: 'toggle', key: 'musicVisualizer' } }),
    );
    return sec;
  }

  /* ---------------- Customization groups ---------------- */
  function customizationSection() {
    const sec = h(`<div class="section"><div class="section-label">Customization</div><div class="card"><div class="custom-groups"></div><div class="cgroup-foot"></div></div></div>`);
    const groups = $('.custom-groups', sec);
    const colors = () => Store.get('customColors') || {};
    const setColor = (k, v) => { const c = { ...colors() }; if (v) c[k] = v; else delete c[k]; Store.set('customColors', c); };
    const layout = () => Store.get('customLayout') || {};
    const setLayout = (k, v) => Store.set('customLayout', { ...layout(), [k]: v });

    const group = (title, desc, count, buildRows) => {
      const g = h(`<div class="cgroup"><button class="cgroup-head"><span class="caret">${Icons.icon('chevron-right', 'plain')}</span><span class="cg-title">${esc(title)}</span><span class="cg-desc">${esc(desc)}</span><span class="count">${count}</span></button><div class="cgroup-body"><div></div></div></div>`);
      const body = $('.cgroup-body > div', g);
      $('.cgroup-head', g).addEventListener('click', () => { const open = !g.classList.contains('open'); g.classList.toggle('open', open); if (open && !body.children.length) buildRows(body); Sound.play(open ? 'open' : 'close'); });
      return g;
    };
    const colorRow = (label, key, desc) => Widgets.row({ title: label, desc, control: { type: 'custom', render: () => colorControl({ value: colors()[key] || '', allowEmpty: true, onChange: (v) => setColor(key, v) }) } });
    groups.appendChild(group('Colors', 'Palette and semantic hues', 9, (b) => {
      b.append(
        colorRow('Accent', 'accent', 'Outline, focus rings and highlights'),
        colorRow('Surface tint', 'tint', 'Tints every surface with this hue'),
        colorRow('Primary text', 'text1', 'Headings and primary labels'),
        colorRow('Secondary text', 'text2', 'Body copy and descriptions'),
        colorRow('Borders', 'line', 'Dividers and card outlines'),
        colorRow('Success', 'ok', 'Toggles, confirmations, running state'),
        colorRow('Warning', 'warn', 'Warnings and key-system badges'),
        colorRow('Danger', 'danger', 'Errors and destructive actions'),
        colorRow('Info', 'info', 'Informational toasts and badges'),
      );
    }));
    groups.appendChild(group('Typography', 'Font family', 1, (b) => {
      b.appendChild(Widgets.row({ title: 'Font family', desc: 'The same choice as App Font above', control: { type: 'select', key: 'appFont', options: Theme.FONTS.map((f) => ({ label: f.label, value: f.id })) } }));
    }));
    groups.appendChild(group('Layout', 'Radii, borders, control sizing', 5, (b) => {
      b.append(
        Widgets.row({ title: 'Card radius', desc: 'Corner roundness of cards and panels', control: { type: 'slider', value: layout().cardRadius ?? 10, min: 0, max: 20, step: 1, small: true, format: (v) => v + 'px', onInput: (v) => document.documentElement.style.setProperty('--radius-lg', v + 'px'), onChange: (v) => setLayout('cardRadius', v) } }),
        Widgets.row({ title: 'Control size', desc: 'Height of buttons, inputs and pills', control: { type: 'select', value: layout().controlSize || 'default', options: [{ label: 'Compact', value: 'compact' }, { label: 'Default', value: 'default' }, { label: 'Comfortable', value: 'comfortable' }], onChange: (v) => setLayout('controlSize', v) } }),
        Widgets.row({ title: 'Border width', desc: 'Thickness of card outlines', control: { type: 'slider', value: layout().borderWidth ?? 1, min: 0, max: 2, step: 1, small: true, format: (v) => v + 'px', onChange: (v) => setLayout('borderWidth', v) } }),
        Widgets.row({ title: 'Sidebar width', desc: 'Width of the side navigation', control: { type: 'slider', value: layout().sidebarWidth ?? 204, min: 170, max: 280, step: 2, small: true, format: (v) => v + 'px', onInput: (v) => document.documentElement.style.setProperty('--sidebar-w', v + 'px'), onChange: (v) => setLayout('sidebarWidth', v) } }),
        Widgets.row({ title: 'Density', desc: 'Spacing between rows and content', control: { type: 'select', value: layout().density || 'default', options: [{ label: 'Compact', value: 'compact' }, { label: 'Default', value: 'default' }, { label: 'Relaxed', value: 'relaxed' }], onChange: (v) => setLayout('density', v) } }),
      );
    }));
    const foot = $('.cgroup-foot', sec);
    foot.append(
      Widgets.button({ label: 'Advanced', icon: 'braces', kind: 'ghost', size: 'sm', onClick: advancedCss }),
      Widgets.button({ label: 'Reset all', icon: 'rotate-ccw', kind: 'ghost', size: 'sm', onClick: async () => { if (await UI.Modal.confirm('Reset customization?', 'Colours, typography, layout and custom CSS go back to the theme defaults.', 'Reset')) { Store.set('customColors', {}); Store.set('customLayout', {}); Store.set('customCss', ''); Store.set('appFont', 'segoe-var'); App.go('settings', 'appearance', true); UI.Toast.show({ type: 'ok', title: 'Customization reset' }); } } }),
    );
    return sec;
  }

  function advancedCss() {
    const body = h(`<div class="field"><label>Custom CSS</label><textarea class="textfield mono" style="min-height:180px;font-family:var(--font-mono);font-size:12px" spellcheck="false" placeholder=":root { --accent: #ff7ab6; }&#10;.card { border-radius: 4px; }"></textarea><div class="hint">Applied live. Anything you can express as CSS overrides the theme.</div></div>`);
    const ta = $('textarea', body); ta.value = Store.get('customCss') || '';
    let timer;
    ta.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => { const el = document.getElementById('custom-css'); if (el) el.textContent = ta.value; }, 150); });
    UI.Modal.open({ title: 'Advanced', sub: 'Raw CSS overrides, applied on top of every theme.', body, width: 'wide', actions: [
      { label: 'Discard', kind: 'ghost', value: false },
      { label: 'Apply', kind: 'primary', icon: 'check', value: true },
    ] }).then((ok) => { if (ok) { Store.set('customCss', ta.value); UI.Toast.show({ type: 'ok', title: 'Custom CSS applied', sound: false }); } else Theme.apply(); });
  }

  /* ---------------- Option cards (nav style) ---------------- */
  function optCards(key, options) {
    const wrap = h('<div class="opt-cards"></div>');
    options.forEach((o) => {
      const c = h(`<button class="opt-card${Store.get(key) === o.value ? ' selected' : ''}" data-v="${esc(o.value)}"><div class="oc-prev ${o.prevClass || ''}">${o.preview}</div><div class="oc-label">${esc(o.label)}</div></button>`);
      c.addEventListener('click', () => { Store.set(key, o.value); $$('.opt-card', wrap).forEach((x) => x.classList.toggle('selected', x === c)); });
      wrap.appendChild(c);
    });
    return wrap;
  }

  /* ---------------- Saved themes ---------------- */
  function savedSection() {
    const sec = h(`<div class="section"><div class="section-label">Saved</div><div class="card">
      <div class="theme-head"><div class="row-icon">${Icons.icon('save')}</div><div class="th-body"><div class="th-title">Manage</div><div class="th-desc">Save, import, export or reset your appearance</div></div><div class="th-right"></div></div>
      <div class="manage-grid"></div><div class="saved-list"></div><div class="rows"></div>
    </div></div>`);
    $('.th-right', sec).appendChild(Widgets.button({ label: 'Open folder', icon: 'folder-open', kind: 'ghost', size: 'sm', onClick: () => UI.Toast.show({ type: 'info', title: 'Themes folder', msg: 'Saved themes live in this app\'s local storage in the UI build.' }) }));
    const grid = $('.manage-grid', sec), list = $('.saved-list', sec);
    const mk = (label, icon, fn) => { const b = h(`<button class="manage-btn">${Icons.icon(icon)}<span>${esc(label)}</span></button>`); b.addEventListener('click', fn); return b; };
    grid.append(
      mk('Save', 'save', () => UI.Modal.open({ title: 'Save appearance', sub: 'Everything on this page is captured into one named preset.', body: '<div class="field"><label>Name</label><div class="input"><input type="text" placeholder="e.g. Night purple" spellcheck="false" maxlength="32"></div></div>', actions: [{ label: 'Cancel', kind: 'ghost', value: false }, { label: 'Save', kind: 'primary', icon: 'save', value: true, onClick: (el) => { const v = $('input', el).value.trim(); if (!v) return false; el._name = v; } }], onOpen: (el) => $('input', el).addEventListener('keydown', (e) => { if (e.key === 'Enter') $('.btn.primary', el).click(); }) })
        .then((ok) => { if (!ok) return; const name = $('.modal') && $('.modal')._name; if (!name) return; const snap = Theme.snapshot(); Store.set('savedThemes', [...(Store.get('savedThemes') || []), { id: 'saved-' + Date.now().toString(36), name, at: Date.now(), snap }]); renderList(); UI.Toast.show({ type: 'ok', title: 'Appearance saved', msg: name }); })),
      mk('Import', 'download', async () => { const f = await App.pickFile('.json,application/json'); if (!f) return; try { Theme.restore(JSON.parse(await f.text())); App.applyAppearance(); App.applyChrome(); App.go('settings', 'appearance', true); UI.Toast.show({ type: 'ok', title: 'Appearance imported', msg: f.name }); } catch (e) { UI.Toast.show({ type: 'danger', title: 'Import failed', msg: e.message }); } }),
      mk('Export', 'upload', () => { App.download(`appearance-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(Theme.snapshot(), null, 2)); UI.Toast.show({ type: 'ok', title: 'Appearance exported', msg: 'appearance.json', sound: false }); }),
      mk('Reset', 'rotate-ccw', async () => { if (await UI.Modal.confirm('Reset appearance?', 'Theme, fonts, layout, music and animation settings return to defaults. Saved presets are kept.', 'Reset', 'danger')) { Theme.resetAppearance(); App.applyAppearance(); App.applyChrome(); App.go('settings', 'appearance', true); UI.Toast.show({ type: 'ok', title: 'Appearance reset' }); } }),
    );
    function renderList() {
      list.innerHTML = '';
      (Store.get('savedThemes') || []).forEach((s) => {
        const t = Theme.byId(s.snap.settings.theme);
        const sw = Theme.swatches(t);
        const it = h(`<div class="saved-item"><span class="sw">${sw.map((c) => `<i style="background:${c}"></i>`).join('')}</span><span class="sn">${esc(s.name)}</span><span class="sd">${new Date(s.at).toLocaleDateString()}</span></div>`);
        it.append(
          Widgets.button({ label: 'Apply', kind: 'subtle', size: 'sm', onClick: () => { Theme.restore(s.snap); App.applyAppearance(); App.applyChrome(); App.go('settings', 'appearance', true); UI.Toast.show({ type: 'ok', title: 'Applied', msg: s.name }); } }),
          Widgets.button({ icon: 'trash', iconOnly: true, kind: 'ghost', size: 'sm', tip: 'Delete', onClick: () => { Store.set('savedThemes', (Store.get('savedThemes') || []).filter((x) => x.id !== s.id)); renderList(); } }),
        );
        list.appendChild(it);
      });
    }
    renderList();
    return sec;
  }

  /* ---------------- Page ---------------- */
  function render() {
    const page = h('<div class="page appearance-page"><div class="page-title-row"><h1 class="page-title">Appearance</h1></div></div>');
    page.appendChild(themeSection());

    const iface = Widgets.section('Interface', [
      { icon: 'type', title: 'App Font', desc: 'Font used throughout the entire application' },
    ]);
    $('.rows', iface).appendChild(fontRow());
    $('.rows', iface).append(
      Widgets.row({ icon: 'layers', title: 'Panel Depth', desc: 'Strength of panel shadows and elevation', control: { type: 'slider', key: 'panelDepth', min: 0, max: 200, step: 5, small: true, format: (v) => v + '%', onInput: (v) => document.documentElement.style.setProperty('--depth', String(v / 100)) } }),
      Widgets.row({ icon: 'grid', title: 'Interface Grid', desc: 'Show a subtle grid overlay across the entire app', control: { type: 'toggle', key: 'interfaceGrid' } }),
      Widgets.row({ icon: 'wand', title: 'Colorful Icons', desc: 'Tint navigation and settings icons', control: { type: 'toggle', key: 'colorfulIcons' } }),
    );
    page.appendChild(iface);

    page.appendChild(Widgets.section('Title bar', [
      { icon: 'type', title: 'Show App Name', desc: 'Show the app name next to the logo', control: { type: 'toggle', key: 'showBrandText' } },
      { icon: 'hash', title: 'Show Version', desc: 'Show the version number next to the app name', control: { type: 'toggle', key: 'showVersion' } },
      { icon: 'window', title: 'macOS Button Layout', desc: 'Use macOS-style window controls on the left', control: { type: 'toggle', key: 'macButtons' } },
    ]));

    page.appendChild(Widgets.section('Window', [
      { icon: 'square-round', title: 'Corner Radius', desc: 'Roundness of the window corners', control: { type: 'slider', key: 'cornerRadius', min: 0, max: 20, step: 1, small: true, format: (v) => v + 'px', onInput: (v) => App.applyAppearance({ cornerRadius: v }) } },
      { icon: 'minus', title: 'Outline Thickness', desc: 'Thickness of the window outline', control: { type: 'slider', key: 'borderThickness', min: 0, max: 4, step: 1, small: true, format: (v) => v + 'px', onInput: (v) => App.applyAppearance({ borderThickness: v }) } },
      { icon: 'palette', title: 'Outline Color', desc: 'Leave empty to use the theme accent', control: { type: 'custom', render: () => colorControl({ value: Store.get('borderColor'), allowEmpty: true, emptyLabel: 'Theme accent', onChange: (v) => Store.set('borderColor', v) }) } },
      { icon: 'rainbow', title: 'Rainbow Outline', desc: 'Animate the outline through the colour spectrum', control: { type: 'toggle', key: 'rainbowBorder' } },
      { icon: 'circle-half', title: 'Opacity', desc: 'Make the whole window transparent', control: { type: 'slider', key: 'windowOpacity', min: 30, max: 100, step: 1, small: true, format: (v) => v + '%', onInput: (v) => App.applyAppearance({ windowOpacity: v }) } },
      { icon: 'eye', title: 'Solid When Focused', desc: 'Only go transparent when the window is in the background', control: { type: 'toggle', key: 'solidWhenFocused' } },
    ]));

    const bg = h(`<div class="section"><div class="section-label">Background</div><div class="card"><div class="rows bg-head"></div><div class="bg-picker"></div><div class="rows"></div></div></div>`);
    $('.bg-head', bg).appendChild(Widgets.row({ icon: 'layers', title: 'Background Image', desc: 'Shown faintly behind the whole app' }));
    const picker = $('.bg-picker', bg);
    [{ id: 'none', label: 'None', icon: 'x' }, { id: 'brand', label: 'Logo', logo: true }, { id: 'add', label: 'Custom', icon: 'plus', add: true }].forEach((o) => {
      const el = h(`<button class="bg-opt${Store.get('background') === o.id || (o.add && Store.get('background') === 'custom') ? ' selected' : ''}" data-id="${o.id}"><span class="bg-tile${o.logo ? ' brand' : ''}${o.add ? ' add' : ''}"><span class="bg-check">${Icons.icon('check', 'plain')}</span>${o.logo ? App.logoSvg() : Icons.icon(o.icon)}</span><span>${o.label}</span></button>`);
      el.addEventListener('click', async () => {
        if (o.add) {
          const f = await App.pickFile('image/*'); if (!f) return;
          const dataUrl = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
          const persistent = dataUrl.length < 2.5e6;
          try { Store.set('backgroundImage', persistent ? dataUrl : ''); } catch (e) { /* quota */ }
          const bgEl = $('#app .bg-image'); bgEl.style.backgroundImage = `url("${dataUrl}")`; bgEl.dataset.kind = 'custom';
          Store.set('background', 'custom');
          $$('.bg-opt', picker).forEach((x) => x.classList.toggle('selected', x.dataset.id === 'add'));
          UI.Toast.show({ type: 'ok', title: 'Background set', msg: persistent ? f.name : `${f.name} (too large to remember after restart)` });
          return;
        }
        Store.set('background', o.id);
        $$('.bg-opt', picker).forEach((x) => x.classList.toggle('selected', x.dataset.id === o.id));
      });
      picker.appendChild(el);
    });
    $('.rows:not(.bg-head)', bg).append(
      Widgets.row({ icon: 'stamp', title: 'Logo Watermark', desc: 'A faint tiled logo behind the app', control: { type: 'toggle', key: 'watermark' } }),
    );
    page.appendChild(bg);

    page.appendChild(musicSection());

    const anim = Widgets.section('Animations', [
      { icon: 'sparkles', title: 'Enable Animations', desc: 'Turn UI motion on or off across the app', control: { type: 'toggle', key: 'animations' } },
      { icon: 'gauge', title: 'Animation Speed', desc: 'How fast UI animations play', control: { type: 'slider', key: 'animSpeed', min: 0.5, max: 2, step: 0.25, small: true, format: (v) => v + '×' } },
      { icon: 'wand', title: 'Animation Style', desc: 'The feel of transitions', control: { type: 'custom', render: () => { const seg = h(`<div class="segmented style-seg">${['smooth', 'snappy', 'minimal'].map((s) => `<button class="seg${(Store.get('animStyle') || 'smooth') === s ? ' active' : ''}" data-s="${s}">${s[0].toUpperCase() + s.slice(1)}</button>`).join('')}</div>`); $$('.seg', seg).forEach((b) => b.addEventListener('click', () => { Store.set('animStyle', b.dataset.s); $$('.seg', seg).forEach((x) => x.classList.toggle('active', x === b)); })); return seg; } } },
    ]);
    page.appendChild(anim);

    const sound = Widgets.section('Sound', [
      { icon: 'volume', title: 'UI Sounds', desc: 'Subtle clicks, ticks and confirmations for interactions', control: { type: 'toggle', key: 'soundEnabled' } },
      { icon: 'volume-1', title: 'Sound Volume', desc: 'Master volume for all interface sounds', control: { type: 'slider', key: 'soundVolume', min: 0, max: 100, step: 1, small: true, format: (v) => v + '%', onInput: (v) => Sound.setVolume(v / 100) } },
      { icon: 'mouse-pointer', title: 'Hover Sounds', desc: 'Play an extremely faint tick when hovering buttons', control: { type: 'toggle', key: 'soundHover' } },
      { icon: 'volume', title: 'Button Sound', desc: 'Play a short sound when you press a button', control: { type: 'select', key: 'buttonSound', options: [{ label: 'Off', value: 'off' }, { label: 'Click', value: 'click' }, { label: 'Tick', value: 'tick' }, { label: 'Soft', value: 'soft' }, { label: 'Pop', value: 'pop' }] } },
      { icon: 'play', title: 'Preview', desc: 'Click a sound to hear it' },
    ]);
    const test = h('<div class="sound-test"></div>');
    [['click', 'Click'], ['tick', 'Tick'], ['soft', 'Soft'], ['pop', 'Pop'], ['toggleOn', 'Toggle'], ['open', 'Open'], ['notify', 'Notify'], ['success', 'Success'], ['error', 'Error'], ['inject', 'Activate']].forEach(([n, l]) => { const b = Widgets.button({ label: l, kind: 'subtle', size: 'sm', onClick: () => Sound.play(n) }); b.setAttribute('data-silent', ''); test.appendChild(b); });
    $('.card', sound).appendChild(test);
    page.appendChild(sound);

    page.appendChild(customizationSection());

    const navSec = Widgets.section('Navigation', [
      { icon: 'layers', title: 'Top Bar Style', desc: 'Choose how tabs are displayed in the navigation bar' },
    ]);
    $('.rows', navSec).appendChild(optCards('topBarStyle', [
      { value: 'icon', label: 'Icon only', preview: '<span class="pill"></span><span class="dot"></span><span class="dot"></span>' },
      { value: 'label', label: 'Icon + Label', preview: '<span class="pill"></span><span class="pill dim"></span><span class="pill dim"></span>' },
    ]));
    $('.rows', navSec).append(
      Widgets.row({ icon: 'play', title: 'Startup Tab', desc: 'Choose which tab opens when Synapse Reborn Apex starts', control: { type: 'select', key: 'startupTab', options: [{ label: 'Last used', value: 'last' }, { label: 'Home', value: 'home' }, { label: 'Modules', value: 'modules' }, { label: 'Profiles', value: 'profiles' }, { label: 'Settings', value: 'settings' }] } }),
      Widgets.row({ icon: 'panel-bottom', title: 'Navbar Position', desc: 'Where the main navigation tabs (Home, Modules, Profiles, Settings) sit', control: { type: 'select', key: 'navbarPosition', options: [{ label: 'Top', value: 'top' }, { label: 'Bottom', value: 'bottom' }] } }),
    );
    page.appendChild(navSec);

    page.appendChild(savedSection());

    const bar = h('<div class="jump-bar"></div>');
    const chips = new Map();
    $$('.section', page).forEach((sec) => {
      const label = $('.section-label', sec);
      if (!label) return;
      const chip = h(`<button class="jump" data-silent>${esc(label.textContent.trim())}</button>`);
      chip.addEventListener('click', () => sec.scrollIntoView({ behavior: 'smooth', block: 'start' }));
      if (!chips.size) chip.classList.add('active');
      chips.set(sec, chip);
      bar.appendChild(chip);
    });
    $('.page-title-row', page).after(bar);
    const seen = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) chips.forEach((c, sec) => c.classList.toggle('active', sec === e.target)); });
    }, { rootMargin: '-90px 0px -65% 0px' });
    chips.forEach((_, sec) => seen.observe(sec));
    return page;
  }

  window.Pages = window.Pages || {};
  Pages.appearanceView = render;
})();
