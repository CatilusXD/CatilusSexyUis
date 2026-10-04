/* App shell: title bar, navigation, routing, window state, appearance. */
(function () {
  'use strict';
  const { $, $$, h, esc } = UI;

  const NAV = ['home', 'modules', 'profiles', 'settings'];
  const VERSION = '1.0.0';
  let page = null, sub = null;
  let sidebarEl, contentEl, navEl, indicator, appEl;
  let switching = false;
  let focused = true;

  const LOGOS = {
    synapse: Brand.svg({ variant: 'full' }),
    mark: Brand.svg({ variant: 'mark' }),
    mono: Brand.svg({ variant: 'mono' }),
  };
  const LOGO = LOGOS.synapse;

  function logoSvg(variant) { return `<span class="icon plain brand-icon" style="width:24px;height:28px">${variant ? LOGOS[variant] || LOGO : LOGO}</span>`; }

  // Discord avatar images fall back to initials when the CDN is unreachable.
  document.addEventListener('error', (e) => { const img = e.target; if (!img || img.tagName !== 'IMG') return; const av = img.closest('.avatar.img'); if (!av) return; av.classList.remove('img'); av.classList.add('initials'); av.textContent = av.dataset.initial || '?'; }, true);

  /* ---------------- Boot ---------------- */
  function boot() {
    appEl = $('#app');
    document.body.classList.add(window.synapse ? 'electron-mode' : 'browser-mode');
    Theme.apply();

    appEl.innerHTML = `
      <div class="watermark"></div><div class="bg-image"></div><div class="grid-overlay"></div>
      <div class="titlebar">
        <div class="brand"><img class="brand-logo" src="assets/logo.png" alt="" draggable="false"><span class="name">Synapse Reborn Apex</span><span class="ver">v${VERSION}</span></div>
        <div class="nav-slot"><nav class="topnav"></nav></div>
        <div class="win-controls">
          <button class="wc" data-act="minimize" data-tip="Minimize">${Icons.icon('win-min', 'plain')}</button>
          <button class="wc" data-act="maximize" data-tip="Maximize">${Icons.icon('win-max', 'plain')}</button>
          <button class="wc close" data-act="close" data-tip="Close">${Icons.icon('win-close', 'plain')}</button>
        </div>
        <canvas class="viz" width="64" height="18"></canvas>
      </div>
      <div class="shell"><aside class="sidebar"></aside><button class="sidebar-expand" data-tip="Show sidebar" data-tip-pos="right">${Icons.icon('panel-left')}</button><main class="content"></main></div>
      <div class="bottombar"></div>`;

    sidebarEl = $('.sidebar', appEl); contentEl = $('.content', appEl); navEl = $('.topnav', appEl);
    $('.sidebar-expand', appEl).addEventListener('click', () => toggleSidebar(true));
    NAV.forEach((id) => {
      const p = Pages[id];
      const b = h(`<button class="nav-btn" data-page="${id}" data-tip="${esc(p.label)}">${Icons.icon(p.icon)}<span class="nav-label">${esc(p.label)}</span></button>`);
      b.addEventListener('click', () => go(id));
      navEl.appendChild(b);
    });
    indicator = h('<span class="nav-indicator"></span>');
    navEl.appendChild(indicator);

    // Window controls
    $$('.wc', appEl).forEach((b) => b.addEventListener('click', () => {
      const a = b.dataset.act;
      if (window.synapse) {
        if (a === 'minimize') synapse.minimize();
        if (a === 'maximize') synapse.toggleMaximize();
        if (a === 'close') confirmClose();
      } else {
        if (a === 'maximize') { appEl.classList.toggle('maximized'); document.body.classList.toggle('maximized', appEl.classList.contains('maximized')); updateMaxIcon(appEl.classList.contains('maximized')); }
        else UI.Toast.show({ type: 'info', title: a === 'close' ? 'Close' : 'Minimize', msg: 'Window controls work in the packaged .exe.', sound: false });
      }
    }));
    if (window.synapse) {
      const setMax = (m) => { appEl.classList.toggle('maximized', m); document.body.classList.toggle('maximized', m); updateMaxIcon(m); };
      synapse.onWindowState((s) => { setMax(s.maximized); setFocused(s.focused); });
      synapse.isMaximized().then(setMax);
    } else {
      window.addEventListener('focus', () => setFocused(true));
      window.addEventListener('blur', () => setFocused(false));
    }
    $('.titlebar', appEl).addEventListener('dblclick', (e) => { if (e.target.closest('button')) return; if (window.synapse) synapse.toggleMaximize(); });

    // Sidebar state
    if (Store.get('sidebarCollapsed')) sidebarEl.classList.add('collapsed');

    Music.init();
    Music.attachCanvas($('.viz', appEl));
    applyAppearance();
    applyChrome();
    Store.on('*', (v, k) => {
      if (['borderThickness', 'borderColor', 'rainbowBorder', 'background', 'watermark', 'windowOpacity', 'cornerRadius', 'reduceMotion', 'terminalFontSize', 'solidWhenFocused', 'interfaceGrid', 'colorfulIcons'].includes(k)) applyAppearance();
      if (['theme', 'customThemes', 'customColors', 'customLayout', 'customCss', 'appFont', 'syntaxTheme', 'customSyntax', 'animations', 'animSpeed', 'animStyle', 'panelDepth'].includes(k)) { Theme.apply(); applyAppearance(); }
      if (['macButtons', 'showVersion', 'showBrandText', 'topBarStyle', 'navbarPosition'].includes(k)) applyChrome();
      if (k === 'soundEnabled') Sound.setEnabled(v);
      if (k === 'alwaysOnTop' && window.synapse) synapse.setAlwaysOnTop(!!v);
      if (k === 'soundVolume') Sound.setVolume(v / 100);
      if (k === 'soundHover') Sound.setHover(v);
    });
    if (window.synapse && Store.get('alwaysOnTop')) synapse.setAlwaysOnTop(true);
    Sound.setEnabled(Store.get('soundEnabled'));
    Sound.setVolume(Store.get('soundVolume') / 100);
    Sound.setHover(Store.get('soundHover'));

    window.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', () => positionIndicator(false));
    document.addEventListener('contextmenu', (e) => { if (!e.target.closest('input, textarea, .term')) e.preventDefault(); });

    const startup = Store.get('startupTab') || 'last';
    const start = startup === 'last' ? Store.get('lastPage') : startup;
    // A #page/sub hash (e.g. #modules/combat) opens that page directly.
    const [hashPage, hashSub] = location.hash.slice(1).split('/');
    if (NAV.includes(hashPage)) go(hashPage, hashSub || null, true);
    else go(NAV.includes(start) ? start : 'home', null, true);
    setTimeout(() => positionIndicator(false), 50);
  }

  function setFocused(f) {
    focused = !!f;
    appEl.classList.toggle('unfocused', !focused);
    applyOpacity();
    Music.onFocusChange(focused);
  }

  function updateMaxIcon(max) {
    const b = $('.wc[data-act="maximize"]');
    if (!b) return;
    b.innerHTML = Icons.icon(max ? 'win-restore' : 'win-max', 'plain');
    b.setAttribute('data-tip', max ? 'Restore' : 'Maximize');
  }

  async function confirmClose() {
    if (Store.get('confirmClose') && Modules.Session.running()) {
      const ok = await UI.Modal.confirm('Close Synapse Reborn Apex?', 'The game is still running. Modules stop when this window closes.', 'Close', 'danger');
      if (!ok) return;
    }
    synapse.close();
  }

  /* ---------------- Routing ---------------- */
  function go(id, s, instant) {
    const p = Pages[id];
    if (!p) return;
    const nextSub = s || (p.subKey ? Store.get(p.subKey) : null) || p.defaultSub || null;
    const samePage = page === id;
    if (samePage && sub === nextSub && !instant) { return; }
    if (switching) return;

    Store.set('lastPage', id);
    if (p.subKey && nextSub) Store.set(p.subKey, nextSub);
    const prevPage = page;
    page = id; sub = nextSub;

    $$('.nav-btn', navEl).forEach((b) => {
      const on = b.dataset.page === id;
      b.classList.toggle('active', on);
      // The active item shows its label, so a tooltip would just repeat it.
      if (on || navEl.classList.contains('labels')) b.removeAttribute('data-tip'); else b.setAttribute('data-tip', Pages[b.dataset.page].label);
    });
    NAV.forEach((n) => appEl.classList.toggle('page-' + n, n === id));
    positionIndicator(!instant);
    // Re-sync once the label finished expanding/collapsing.
    clearTimeout(go._t); go._t = setTimeout(() => positionIndicator(true), 300);

    const render = () => {
      UI.Tooltip.hide(); UI.Menu.close();
      if (prevPage && Pages[prevPage].unmount && prevPage !== id) Pages[prevPage].unmount();
      // sidebar
      if (!samePage || !$('.sidebar-inner', sidebarEl)) {
        sidebarEl.innerHTML = '';
        sidebarEl.appendChild(p.sidebar(sub));
      } else {
        // just update the active item
        $$('.side-item[data-id]', sidebarEl).forEach((b) => b.classList.toggle('active', b.dataset.id === sub));
        if (!$('.side-item[data-id].active', sidebarEl)) { sidebarEl.innerHTML = ''; sidebarEl.appendChild(p.sidebar(sub)); }
      }
      // content
      contentEl.innerHTML = '';
      const scroll = h(`<div class="page-scroll${p.tight ? ' tight' : ''}"></div>`);
      scroll.appendChild(p.content(sub));
      contentEl.appendChild(scroll);
      Icons.hydrate(contentEl);
      UI.autobind(document.body);
      if (p.mounted) p.mounted();
      switching = false;
    };

    if (instant || !contentEl.firstChild) { render(); return; }
    switching = true;
    const old = $('.page', contentEl) || contentEl.firstChild;
    if (old && old.classList) old.classList.add('leaving');
    setTimeout(render, samePage ? 90 : 140);
  }

  function positionIndicator(animate) {
    const act = $('.nav-btn.active', navEl);
    if (!act || !indicator) return;
    const nr = navEl.getBoundingClientRect(), ar = act.getBoundingClientRect();
    if (!animate) indicator.style.transition = 'none';
    indicator.style.width = Math.max(18, ar.width - 14) + 'px';
    indicator.style.transform = `translateX(${ar.left - nr.left + 7}px)`;
    if (!animate) { void indicator.offsetWidth; indicator.style.transition = ''; }
  }

  function collapseButton() {
    return Widgets.button({ icon: 'chevron-left', iconOnly: true, kind: 'ghost', size: 'sm', tip: 'Collapse sidebar', onClick: () => toggleSidebar(false) });
  }

  function toggleSidebar(show) {
    const collapsed = show === undefined ? !sidebarEl.classList.contains('collapsed') : !show;
    sidebarEl.classList.toggle('collapsed', collapsed);
    Store.set('sidebarCollapsed', collapsed);
    const tc = $('.tab-collapse'); if (tc) tc.classList.toggle('rot', collapsed);
    Sound.play(collapsed ? 'close' : 'open');
  }

  /* ---------------- Appearance ---------------- */
  function applyOpacity(override) {
    const base = (override !== undefined ? override : Store.get('windowOpacity')) / 100;
    const op = (Store.get('solidWhenFocused') && focused) ? 1 : base;
    document.documentElement.style.setProperty('--window-opacity', window.synapse ? 1 : op);
    if (window.synapse) synapse.setOpacity(op);
  }

  function applyAppearance(overrides = {}) {
    const g = (k) => (overrides[k] !== undefined ? overrides[k] : Store.get(k));
    const r = document.documentElement.style;
    r.setProperty('--window-border-w', g('borderThickness') + 'px');
    r.setProperty('--window-border', g('borderColor') || 'var(--accent-line)');
    r.setProperty('--radius-win', g('cornerRadius') + 'px');
    applyOpacity(overrides.windowOpacity);
    appEl.classList.toggle('rainbow', !!g('rainbowBorder'));
    appEl.classList.toggle('watermark-on', !!g('watermark'));
    const bg = g('background');
    appEl.classList.toggle('bg-brand', bg === 'brand' || bg === 'custom');
    appEl.classList.toggle('grid-on', !!g('interfaceGrid'));
    document.body.classList.toggle('colorful-icons', !!g('colorfulIcons'));
    const bgEl = $('.bg-image', appEl);
    if (bg === 'custom') {
      const img = Store.get('backgroundImage');
      if (img && bgEl.dataset.kind !== 'custom') { bgEl.style.backgroundImage = `url("${img}")`; bgEl.dataset.kind = 'custom'; }
    } else if (bg === 'brand' && bgEl.dataset.kind !== 'brand') {
      bgEl.dataset.kind = 'brand';
      const mark = Brand.inner({ variant: 'full', ink: '#ffffff', innerColor: '#0d0d0d' }).replace(/"/g, "'");
      bgEl.style.backgroundImage = `url("data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 700'><defs><radialGradient id='a' cx='.2' cy='.1' r='.9'><stop offset='0' stop-color='#3a2a6a'/><stop offset='1' stop-color='#000' stop-opacity='0'/></radialGradient><radialGradient id='b' cx='.9' cy='.9' r='.8'><stop offset='0' stop-color='#1e2a4a'/><stop offset='1' stop-color='#000' stop-opacity='0'/></radialGradient></defs><rect width='1200' height='700' fill='url(#a)'/><rect width='1200' height='700' fill='url(#b)'/><g opacity='.85' transform='translate(700 130) scale(3.4)'>${mark}</g></svg>`)}")`;
    }
    r.setProperty('--term-fs', (Store.get('terminalFontSize') || 11.5) + 'px');
  }

  /* Title bar / navigation chrome that depends on settings. */
  function applyChrome() {
    const tb = $('.titlebar', appEl);
    const brand = $('.brand', appEl);
    tb.classList.toggle('mac', !!Store.get('macButtons'));
    brand.classList.toggle('no-text', !Store.get('showBrandText'));
    $('.ver', brand).style.display = Store.get('showVersion') ? '' : 'none';
    // Nav labels
    navEl.classList.toggle('labels', Store.get('topBarStyle') === 'label');
    $$('.nav-btn', navEl).forEach((b) => { if (navEl.classList.contains('labels') || b.classList.contains('active')) b.removeAttribute('data-tip'); else b.setAttribute('data-tip', Pages[b.dataset.page].label); });
    // Nav position
    const bottom = Store.get('navbarPosition') === 'bottom';
    appEl.classList.toggle('nav-bottom', bottom);
    const slot = bottom ? $('.bottombar', appEl) : $('.nav-slot', appEl);
    if (navEl.parentElement !== slot) slot.appendChild(navEl);
    requestAnimationFrame(() => positionIndicator(false));
    setTimeout(() => positionIndicator(false), 320);
  }

  /* ---------------- Keys / palette ---------------- */
  function onKey(e) {
    if (e.target && e.target.closest && e.target.closest('.kb.recording')) return;
    const kb = Store.get('keybinds');
    const combo = (e.ctrlKey ? 'Ctrl+' : '') + (e.shiftKey ? 'Shift+' : '') + (e.altKey ? 'Alt+' : '') + (e.key.length === 1 ? e.key.toUpperCase() : e.key);
    if (combo === kb.search) { e.preventDefault(); palette(); return; }
    if (combo === kb.toggleSidebar) { e.preventDefault(); toggleSidebar(); return; }
    if (e.ctrlKey && /^[1-9]$/.test(e.key) && NAV[Number(e.key) - 1]) { e.preventDefault(); go(NAV[Number(e.key) - 1]); return; }
    if (combo === kb.openModules) { e.preventDefault(); go('modules'); return; }
    if (combo === kb.launchGame) { e.preventDefault(); toggleGame(); return; }
    if (combo === kb.disableAll) { e.preventDefault(); disableAll(); return; }
    // Module hotkeys work anywhere in the window except while typing.
    if (e.target && e.target.closest && e.target.closest('input, textarea')) return;
    const m = Modules.list().find((d) => Modules.bind(d.id) === combo);
    if (m) { e.preventDefault(); Modules.toggle(m.id); }
  }

  function toggleGame() { const S = Modules.Session; if (S.status() === 'stopped') S.launch(); else S.stop(); }
  function disableAll() {
    const ids = Modules.enabledIds();
    ids.forEach((id) => Modules.setEnabled(id, false, { silent: true }));
    UI.Toast.show({ type: 'info', title: ids.length ? `${ids.length} modules disabled` : 'No modules were on', sound: false });
  }

  function palette() {
    const items = [];
    NAV.forEach((id) => items.push({ label: `Go to ${Pages[id].label}`, icon: Pages[id].icon, run: () => go(id), kbd: `Ctrl+${NAV.indexOf(id) + 1}` }));
    [['game', 'Game'], ['appearance', 'Appearance'], ['window', 'Window'], ['behavior', 'Behavior'], ['keybinds', 'Keybinds'], ['connections', 'Connections']].forEach(([id, l]) => items.push({ label: `Settings › ${l}`, icon: 'settings', run: () => go('settings', id) }));
    Theme.list().forEach((t) => items.push({ label: `Theme: ${t.label}`, icon: 'palette', run: () => Store.set('theme', t.id) }));
    items.push({ label: Modules.Session.status() === 'stopped' ? `Launch ${Modules.GAME.name}` : `Stop ${Modules.GAME.name}`, icon: 'play', run: toggleGame, kbd: Store.get('keybinds').launchGame });
    items.push({ label: 'Disable all modules', icon: 'power', run: disableAll, kbd: Store.get('keybinds').disableAll });
    Modules.list().forEach((d) => {
      items.push({ label: `${Modules.isEnabled(d.id) ? 'Disable' : 'Enable'} ${d.name}`, icon: d.icon, run: () => Modules.toggle(d.id), kbd: Modules.bind(d.id) || undefined });
      items.push({ label: `${d.name} settings`, icon: 'settings', run: () => { go('modules', d.category); setTimeout(() => Pages.modules.openConfig(d.id), 200); } });
    });
    Modules.profiles().forEach((p) => items.push({ label: `Apply profile: ${p.name}`, icon: 'bookmark', run: () => Modules.applyProfile(p.id) }));
    items.push({ label: 'Toggle sidebar', icon: 'panel-left', run: () => toggleSidebar(), kbd: Store.get('keybinds').toggleSidebar });
    items.push({ label: Store.get('rainbowBorder') ? 'Disable rainbow border' : 'Enable rainbow border', icon: 'rainbow', run: () => Store.set('rainbowBorder', !Store.get('rainbowBorder')) });
    items.push({ label: Store.get('soundEnabled') ? 'Mute UI sounds' : 'Unmute UI sounds', icon: Store.get('soundEnabled') ? 'volume-x' : 'volume', run: () => Store.set('soundEnabled', !Store.get('soundEnabled')) });

    const body = h(`<div style="display:flex;flex-direction:column;gap:8px;margin:-4px 0 0"><div class="search" style="height:36px"></div><div class="pal-list" style="display:flex;flex-direction:column;gap:1px;max-height:300px;overflow:auto;margin:0 -8px;padding:0 4px"></div></div>`);
    const search = $('.search', body); search.innerHTML = `${Icons.icon('search')}<input type="text" placeholder="Search pages, themes and actions…" spellcheck="false">`;
    const list = $('.pal-list', body);
    let sel = 0, filtered = items;
    const render = () => {
      list.innerHTML = '';
      filtered.forEach((it, i) => {
        const b = h(`<button class="menu-item${i === sel ? ' hl' : ''}" style="height:32px">${Icons.icon(it.icon)}<span>${esc(it.label)}</span>${it.kbd ? `<kbd>${esc(it.kbd)}</kbd>` : ''}</button>`);
        b.addEventListener('click', () => { UI.Modal.close(); it.run(); });
        b.addEventListener('mousemove', () => { if (sel !== i) { sel = i; render(); } });
        list.appendChild(b);
      });
      if (!filtered.length) list.appendChild(h('<div class="tree-empty">No results</div>'));
    };
    UI.Modal.open({ title: 'Command palette', body, actions: [], onOpen: (el) => {
      const inp = $('input', search);
      inp.addEventListener('input', () => { const q = inp.value.toLowerCase(); filtered = items.filter((it) => it.label.toLowerCase().includes(q)); sel = 0; render(); });
      inp.addEventListener('keydown', (ev) => {
        if (ev.key === 'ArrowDown') { ev.preventDefault(); sel = Math.min(filtered.length - 1, sel + 1); render(); list.children[sel] && list.children[sel].scrollIntoView({ block: 'nearest' }); }
        if (ev.key === 'ArrowUp') { ev.preventDefault(); sel = Math.max(0, sel - 1); render(); list.children[sel] && list.children[sel].scrollIntoView({ block: 'nearest' }); }
        if (ev.key === 'Enter') { ev.preventDefault(); const it = filtered[sel]; if (it) { UI.Modal.close(); it.run(); } }
      });
      setTimeout(() => inp.focus(), 60);
    } });
    render();
  }

  /* ---------------- Helpers ---------------- */
  function copy(text, title) {
    const done = () => UI.Toast.show({ type: 'ok', title: title || 'Copied to clipboard', sound: false }) || Sound.play('tick');
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, () => fallback());
    else fallback();
    function fallback() {
      const ta = h('<textarea style="position:fixed;opacity:0"></textarea>'); ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { UI.Toast.show({ type: 'danger', title: 'Copy failed' }); }
      ta.remove();
    }
  }

  function openExternal(url) {
    if (window.synapse) synapse.openExternal(url); else window.open(url, '_blank', 'noopener');
    UI.Toast.show({ type: 'info', title: 'Opening in browser', msg: url.replace(/^https?:\/\//, ''), sound: false });
    Sound.play('tick');
  }

  // Download a text file (Electron shows a Save dialog; browsers download directly).
  function download(name, text, type = 'application/json') {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const a = h(`<a download="${esc(name)}" style="display:none"></a>`); a.href = url;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 2000);
  }

  // Ask for a local file and resolve with its text.
  function pickFile(accept) {
    return new Promise((resolve) => {
      const inp = h(`<input type="file" accept="${esc(accept || '*/*')}" style="display:none">`);
      document.body.appendChild(inp);
      inp.addEventListener('change', () => { const f = inp.files[0]; inp.remove(); resolve(f || null); });
      inp.click();
      setTimeout(() => { if (document.contains(inp)) inp.remove(); }, 120e3);
    });
  }

  window.App = { go, toggleSidebar, collapseButton, applyAppearance, applyChrome, copy, openExternal, download, pickFile, logoSvg, palette, VERSION, LOGOS, current: () => ({ page, sub }), isFocused: () => focused };
  document.addEventListener('DOMContentLoaded', boot);
})();
