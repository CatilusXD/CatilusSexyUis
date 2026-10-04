/* Home: Overview / Activity / Update Log */
(function () {
  'use strict';
  const { $, $$, h, esc } = UI;

  // Placeholder profile shown in the UI; replace with your own data source.
  const USER = { name: 'User', plan: 'Free' };
  const avatarHtml = (size) => `<span class="avatar initials" style="width:${size}px;height:${size}px;font-size:${Math.round(size * .4)}px">${esc(USER.name.slice(0, 1).toUpperCase())}</span>`;

  // Placeholder changelog.
  const RELEASES = [
    { v: '1.0.0', date: 'Oct 3', latest: true, items: [
      'First release of the new interface',
      { group: 'Modules:' },
      'Modules grouped into categories, each with its own settings and hotkey',
      'Search and filter modules, enable or disable a whole category at once',
      'Profiles: save the modules you use and switch setups in one click',
      { group: 'Appearance:' },
      'Colour themes, custom accents, window outline, opacity and backgrounds',
      'Command palette (Ctrl+K) for pages, modules and themes',
    ] },
    { v: '0.9.0', date: 'Sep 20', items: [
      'Beta release',
      { group: 'Modules:' },
      'Profile import and export',
      'Activity log on the Home page',
    ] },
  ];

  let unsub = null;

  const fmtDuration = (ms) => {
    const s = Math.floor(ms / 1000), hh = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60), ss = s % 60;
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  };
  const fmtTime = (t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  /* Sparkline in the accent colour. */
  function drawSpark(canvas, data, max) {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth, hh = canvas.clientHeight;
    if (!w || !hh) return;
    canvas.width = w * dpr; canvas.height = hh * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, hh);
    if (data.length < 2) return;
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#8b7cf6';
    const top = max || Math.max(...data) * 1.15;
    const x = (i) => (i / (data.length - 1)) * w;
    const y = (v) => hh - 2 - (Math.min(v, top) / top) * (hh - 4);
    ctx.beginPath();
    data.forEach((v, i) => (i ? ctx.lineTo(x(i), y(v)) : ctx.moveTo(x(i), y(v))));
    ctx.strokeStyle = accent; ctx.lineWidth = 1.5; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.lineTo(w, hh); ctx.lineTo(0, hh); ctx.closePath();
    const g = ctx.createLinearGradient(0, 0, 0, hh);
    g.addColorStop(0, accent + '40'); g.addColorStop(1, accent + '00');
    ctx.fillStyle = g; ctx.fill();
  }

  /* ---------------- Overview ---------------- */
  const sectionHead = (title, link) => {
    const el = h(`<div class="home-head"><div class="t">${esc(title)}</div>${link ? `<button class="link-btn">${esc(link.label)} ${Icons.icon('chevron-right')}</button>` : ''}</div>`);
    if (link) $('.link-btn', el).addEventListener('click', link.onClick);
    return el;
  };

  function overview() {
    const S = Modules.Session;
    const G = Modules.GAME;
    const page = h('<div class="page home"><div class="page-title-row"><h1 class="page-title">Overview</h1></div></div>');

    // Game: status and the one primary action on the page.
    const game = h(`<div class="card game-card-hero">
      <div class="gh-icon">${Icons.icon('gamepad', 'plain')}</div>
      <div class="gh-body"><div class="gh-name">${esc(G.name)}</div><div class="gh-sub"><span class="status-dot"></span><span class="gh-status"></span></div></div>
      <div class="gh-actions"></div>
    </div>`);
    const profileBtn = h(`<button class="gh-profile" data-tip="Change profile">${Icons.icon('bookmark', 'plain')}<span class="gp-v"></span></button>`);
    profileBtn.addEventListener('click', () => App.go('profiles'));
    const btn = Widgets.button({ label: 'Launch', icon: 'play', kind: 'primary', onClick: () => (S.status() === 'stopped' ? S.launch() : S.stop()) });
    const killBtn = Widgets.button({ label: 'Kill', icon: 'square', kind: 'danger', tip: 'Force-close Apex Legends', onClick: () => {
      if (window.synapse && window.synapse.send) window.synapse.send('kill-game');
      else UI.Toast.show({ type: 'info', title: 'Kill only works in the .exe', sound: false });
    }});
    $('.gh-actions', game).append(profileBtn, btn, killBtn);
    page.appendChild(game);

    // Modules by category — only shown when Apex is running.
    const modsHead = sectionHead('Modules', { label: 'All modules', onClick: () => App.go('modules', 'all') });
    const cats = h('<div class="cat-grid"></div>');
    const catEls = Modules.CATEGORIES.map((c) => {
      const el = h(`<button class="card cat-card">
        <span class="cat-tile">${Icons.icon(c.icon, 'plain')}</span>
        <span class="cc-body"><span class="cc-name">${esc(c.label)}</span><span class="cc-count"></span></span>
        <span class="cc-bar"><i></i></span>
      </button>`);
      el.addEventListener('click', () => App.go('modules', c.id));
      cats.appendChild(el);
      return { c, el };
    });
    const gameOnlySection = h('<div class="game-only-section"></div>');
    gameOnlySection.appendChild(modsHead);
    gameOnlySection.appendChild(cats);
    page.appendChild(gameOnlySection);

    // Live performance — only shown when Apex is running.
    const perfHead = sectionHead('Performance');
    const perf = h('<div class="perf-grid"></div>');
    const live = [
      { key: 'fps', k: 'FPS', unit: '', max: 240 },
      { key: 'ping', k: 'Ping', unit: ' ms', max: 120 },
      { key: 'cpu', k: 'CPU', unit: '%', max: 100 },
      { key: 'gpu', k: 'GPU', unit: '°C', max: 100 },
    ].map((m) => {
      const el = h(`<div class="card perf-card"><div class="pk">${esc(m.k)}</div><div class="pv">—</div><canvas class="spark"></canvas></div>`);
      perf.appendChild(el);
      return { ...m, el };
    });
    const perfSection = h('<div class="game-only-section"></div>');
    perfSection.appendChild(perfHead);
    perfSection.appendChild(perf);
    page.appendChild(perfSection);

    const updateStatic = () => {
      const st = S.status();
      const running = st === 'running';
      $('.status-dot', game).className = 'status-dot ' + (running ? 'ok' : st === 'launching' ? 'busy' : '');
      $('.gh-status', game).textContent = running ? `Running · ${fmtDuration(Date.now() - S.startedAt())}` : st === 'launching' ? 'Launching…' : 'Not running';
      btn.innerHTML = Icons.icon(st === 'stopped' ? 'play' : 'square') + `<span>${st === 'stopped' ? 'Launch' : 'Stop'}</span>`;
      btn.className = 'btn ' + (st === 'stopped' ? 'primary' : 'subtle');
      btn.disabled = st === 'launching';
      const p = Modules.activeProfile();
      $('.gp-v', profileBtn).textContent = p ? (Modules.profileMatches(p) ? p.name : `${p.name} (edited)`) : 'Custom';
      catEls.forEach(({ c, el }) => {
        const items = Modules.list(c.id), on = items.filter((d) => Modules.isEnabled(d.id)).length;
        $('.cc-count', el).textContent = `${on} of ${items.length} on`;
        $('.cc-bar i', el).style.width = `${(on / items.length) * 100}%`;
      });
      // Show modules and performance only while Apex is running
      gameOnlySection.style.display = running ? '' : 'none';
      perfSection.style.display = running ? '' : 'none';
      perf.classList.toggle('idle', !running);
      $('.t', perfHead).innerHTML = running ? 'Performance <span class="live-badge">Live</span>' : 'Performance';
    };
    const updateLive = () => {
      const running = S.running();
      live.forEach((m) => {
        $('.pv', m.el).textContent = running ? `${S.last(m.key)}${m.unit}` : '—';
        drawSpark($('.spark', m.el), running ? S.series[m.key] : [], m.max);
      });
      if (running) $('.gh-status', game).textContent = `Running · ${fmtDuration(Date.now() - S.startedAt())}`;
    };
    updateStatic();
    requestAnimationFrame(updateLive);

    if (unsub) unsub();
    unsub = Modules.on((e) => {
      if (!document.contains(page)) return;
      if (e.type === 'tick') updateLive();
      else if (e.type === 'session') { updateStatic(); updateLive(); }
      else if (e.type === 'toggle' || e.type === 'profile') updateStatic();
    });

    page.appendChild(sectionHead("What's new", { label: 'Update log', onClick: () => App.go('home', 'updates') }));
    page.appendChild(releaseCard(RELEASES[0], true));
    return page;
  }

  /* ---------------- Activity ---------------- */
  function activity() {
    const page = h('<div class="page"><div class="page-title-row"><h1 class="page-title">Activity</h1><div class="mod-head-actions"></div></div><div class="card activity-list"></div></div>');
    const list = $('.activity-list', page);
    $('.mod-head-actions', page).appendChild(Widgets.button({ label: 'Clear', icon: 'eraser', kind: 'ghost', size: 'sm', onClick: () => { Modules.logs().splice(0); render(); } }));
    function render() {
      list.innerHTML = '';
      const items = Modules.logs();
      if (!items.length) { list.appendChild(Widgets.empty({ icon: 'history', compact: true, title: 'Nothing yet', desc: 'Module changes, profiles and game sessions show up here.' })); return; }
      items.forEach((l) => list.appendChild(h(`<div class="activity-row ${esc(l.kind)}">${Icons.icon(l.icon)}<span class="a-msg">${esc(l.msg)}</span><span class="a-time">${esc(fmtTime(l.at))}</span></div>`)));
    }
    render();
    if (unsub) unsub();
    unsub = Modules.on((e) => { if (e.type === 'log' && document.contains(page)) render(); });
    return page;
  }

  function releaseCard(r, collapsed) {
    const el = h(`<div class="card release${collapsed ? ' collapsed' : ''}">
      <div class="rel-head"><span class="rel-ver">v${esc(r.v)}</span>${r.latest ? '<span class="tag-latest">LATEST</span>' : ''}<span class="rel-date">${esc(r.date)}</span></div>
      <ul></ul>
    </div>`);
    const ul = $('ul', el);
    r.items.forEach((it) => {
      if (typeof it === 'string') ul.appendChild(h(`<li>${esc(it)}</li>`));
      else ul.appendChild(h(`<li class="group">${esc(it.group)}</li>`));
    });
    if (collapsed) {
      const more = h(`<button class="link-btn rel-more">Show all changes ${Icons.icon('chevron-down')}</button>`);
      more.addEventListener('click', () => { el.classList.remove('collapsed'); more.remove(); Sound.play('open'); });
      el.appendChild(more);
    }
    return el;
  }

  /* ---------------- Update Log ---------------- */
  function updates() {
    const page = h('<div class="page"><div class="page-title-row"><h1 class="page-title">Update Log</h1></div></div>');
    RELEASES.forEach((r) => page.appendChild(releaseCard(r, false)));
    return page;
  }

  /* ---------------- Sidebar ---------------- */
  function sidebar(sub) {
    const el = h(`<div class="sidebar-inner">
      <div class="sidebar-head"><h2>Home</h2><div class="head-actions"></div></div>
      <div class="sidebar-nav"></div>
      <div class="sidebar-spacer"></div>
      <div class="sidebar-foot"></div>
    </div>`);
    $('.head-actions', el).appendChild(App.collapseButton());
    const nav = $('.sidebar-nav', el);
    [
      { id: 'overview', icon: 'layers', label: 'Overview' },
      { id: 'activity', icon: 'history', label: 'Activity' },
      { id: 'updates', icon: 'scroll-text', label: 'Update Log' },
    ].forEach((it) => nav.appendChild(Widgets.sideItem({ ...it, active: it.id === sub, onClick: () => App.go('home', it.id) })));

    const card = h(`<div class="user-card">${avatarHtml(30)}<span style="min-width:0"><div class="u-name">${esc(USER.name)}</div><div class="u-sub">${esc(USER.plan)}</div></span></div>`);
    $('.sidebar-foot', el).appendChild(card);
    return el;
  }

  function unmount() { if (unsub) { unsub(); unsub = null; } }

  const views = { overview, activity, updates };
  window.Pages = window.Pages || {};
  Pages.home = {
    id: 'home', icon: 'home', label: 'Home', defaultSub: 'overview', subKey: 'lastHomeSub',
    sidebar,
    content: (sub) => (views[sub] || overview)(),
    unmount,
    user: USER,
  };
})();
