/* Modules: browse modules by category, toggle them and edit their settings. */
(function () {
  'use strict';
  const { $, $$, h, esc } = UI;

  let query = '';
  let filter = 'all';          // all | on | off
  let cards = new Map();       // id -> { el, toggle }
  let unsub = null;

  const catOf = (id) => Modules.CATEGORIES.find((c) => c.id === id);
  const countOn = (list) => list.filter((d) => Modules.isEnabled(d.id)).length;

  function viewList(sub) {
    if (sub === 'enabled') return Modules.list().filter((d) => Modules.isEnabled(d.id));
    return Modules.list(catOf(sub) ? sub : null);
  }

  function matches(d) {
    const on = Modules.isEnabled(d.id);
    if (filter === 'on' && !on) return false;
    if (filter === 'off' && on) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return d.name.toLowerCase().includes(q) || d.desc.toLowerCase().includes(q) || catOf(d.category).label.toLowerCase().includes(q);
  }

  /* ---------------- Card ---------------- */
  function bindHtml(id) {
    const b = Modules.bind(id);
    return b ? b.split('+').map((k) => `<kbd>${esc(k)}</kbd>`).join('') : '<span class="mc-nobind">No hotkey</span>';
  }

  function card(d) {
    const el = h(`<div class="card module-card" data-id="${esc(d.id)}" tabindex="0">
      <div class="mc-top">
        <div class="mc-icon">${Icons.icon(d.icon, 'plain')}</div>
        <div class="mc-title">
          <div class="mc-name"><span class="mc-label">${esc(d.name)}</span>${(d.tags || []).map((t) => `<span class="mc-tag ${t === 'Beta' ? 'beta' : ''}">${esc(t)}</span>`).join('')}<span class="mc-live" data-tip="Running"></span></div>
          <div class="mc-desc">${esc(d.desc)}</div>
        </div>
        <button class="toggle" data-silent aria-label="Enable ${esc(d.name)}"></button>
      </div>
      <div class="mc-foot">
        <span class="mc-bind"></span>
        <span class="mc-actions"></span>
      </div>
    </div>`);
    const toggle = UI.bindToggle($('.toggle', el), { value: Modules.isEnabled(d.id), onChange: (on) => Modules.setEnabled(d.id, on) });
    $('.mc-actions', el).appendChild(Widgets.button({ icon: 'settings', label: 'Settings', kind: 'ghost', size: 'sm', onClick: (e) => { e.stopPropagation(); openConfig(d.id); } }));
    el.addEventListener('click', (e) => { if (!e.target.closest('button')) openConfig(d.id); });
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target === el) openConfig(d.id); });
    cards.set(d.id, { el, toggle });
    refreshCard(d.id);
    return el;
  }

  function refreshCard(id) {
    const c = cards.get(id);
    if (!c) return;
    const on = Modules.isEnabled(id);
    c.toggle.set(on);
    c.el.classList.toggle('on', on);
    c.el.classList.toggle('live', on && Modules.Session.running());
    $('.mc-bind', c.el).innerHTML = bindHtml(id);
  }

  /* ---------------- Settings dialog ---------------- */
  function hotkeyRow(id) {
    return Widgets.row({
      icon: 'keyboard', title: 'Hotkey', desc: 'Toggles the module. Backspace clears it.',
      control: { type: 'custom', render: () => Widgets.keyRecorder({ value: Modules.bind(id), clearable: true, owner: (combo) => Modules.hotkeyOwner(combo, id), onChange: (combo) => Modules.setBind(id, combo) }) },
    });
  }

  function settingRow(id, s) {
    const value = Modules.settings(id)[s.key];
    const onChange = (v) => Modules.setSetting(id, s.key, v);
    let control;
    if (s.type === 'toggle') control = { type: 'toggle', value, onChange };
    else if (s.type === 'select') control = { type: 'select', value, options: s.options, onChange };
    else control = { type: 'slider', value, min: s.min, max: s.max, step: s.step, small: true, format: (v) => v + (s.unit || ''), onChange };
    const icon = s.icon || { toggle: 'check-circle', select: 'list', slider: 'sliders-h' }[s.type];
    return Widgets.row({ icon, title: s.title, desc: s.desc, control });
  }

  function openConfig(id) {
    const d = Modules.get(id);
    const body = h('<div class="mod-config"></div>');
    body.appendChild(Widgets.section('', [
      Widgets.row({ icon: 'power', title: 'Enabled', desc: Modules.Session.running() ? 'Takes effect immediately' : 'Starts with the game', control: { type: 'toggle', value: Modules.isEnabled(id), onChange: (on) => Modules.setEnabled(id, on) } }),
      hotkeyRow(id),
    ]));
    body.appendChild(Widgets.section('Settings', d.settings.map((s) => settingRow(id, s))));
    UI.Modal.open({
      title: d.name, sub: `${catOf(d.category).label} · ${d.desc}`, body,
      actions: [
        { label: 'Reset settings', kind: 'ghost', icon: 'rotate-ccw', value: 'reset' },
        { label: 'Done', kind: 'primary', value: true },
      ],
    }).then((r) => {
      if (r !== 'reset') return;
      Modules.resetSettings(id);
      UI.Toast.show({ type: 'ok', title: `${d.name} settings reset`, sound: false });
      setTimeout(() => openConfig(id), 280);
    });
  }

  /* ---------------- Page ---------------- */
  function content(sub) {
    cards = new Map();
    const cat = catOf(sub);
    const title = cat ? cat.label : sub === 'enabled' ? 'Enabled' : 'All modules';
    const page = h(`<div class="page modules-page">
      <div class="page-title-row">${cat ? `<span class="cat-tile lg">${Icons.icon(cat.icon, 'plain')}</span>` : ''}<div><h1 class="page-title">${esc(title)}</h1><div class="page-subtitle"></div></div><div class="mod-head-actions"></div></div>
      <div class="mod-toolbar"><div class="mt-search"></div><div class="segmented"><button class="seg" data-f="all">All</button><button class="seg" data-f="on">On</button><button class="seg" data-f="off">Off</button></div></div>
      <div class="mod-body"></div>
    </div>`);
    const list = viewList(sub);

    $('.mt-search', page).appendChild(Widgets.searchField({ placeholder: 'Search modules…', small: true, onInput: (v) => { query = v; renderBody(); } }));
    const input = $('.mt-search input', page); input.value = query;
    $$('.seg', page).forEach((b) => {
      b.classList.toggle('active', b.dataset.f === filter);
      b.addEventListener('click', () => { filter = b.dataset.f; $$('.seg', page).forEach((x) => x.classList.toggle('active', x === b)); renderBody(); });
    });
    $('.mod-head-actions', page).append(
      Widgets.button({ label: 'Enable all', icon: 'check', kind: 'ghost', size: 'sm', onClick: () => bulk(list, true) }),
      Widgets.button({ label: 'Disable all', icon: 'power', kind: 'ghost', size: 'sm', onClick: () => bulk(list, false) }),
    );

    const subtitle = () => { $('.page-subtitle', page).textContent = `${countOn(list)} of ${list.length} enabled`; };

    function renderBody() {
      const bodyEl = $('.mod-body', page);
      bodyEl.innerHTML = '';
      cards = new Map();
      const shown = list.filter(matches);
      if (!shown.length) {
        bodyEl.appendChild(h('<div class="card"></div>')).appendChild(Widgets.empty({
          icon: 'puzzle', compact: true,
          title: list.length ? 'No matching modules' : 'No modules enabled',
          desc: list.length ? 'Try another search or filter.' : 'Turn modules on from a category, or apply a profile.',
          actions: list.length ? [] : [{ label: 'Browse modules', icon: 'puzzle', onClick: () => App.go('modules', 'all') }],
        }));
        return;
      }
      // Group by category on the All / Enabled views.
      const groups = cat ? [{ c: cat, items: shown }] : Modules.CATEGORIES.map((c) => ({ c, items: shown.filter((d) => d.category === c.id) })).filter((g) => g.items.length);
      groups.forEach((g) => {
        if (!cat) bodyEl.appendChild(h(`<div class="mod-group"><span class="cat-tile sm">${Icons.icon(g.c.icon, 'plain')}</span><span class="mg-name">${esc(g.c.label)}</span><span class="mg-count">${countOn(g.items)} of ${g.items.length} on</span></div>`));
        const grid = h('<div class="module-grid"></div>');
        g.items.forEach((d) => grid.appendChild(card(d)));
        bodyEl.appendChild(grid);
      });
      Icons.hydrate(bodyEl);
    }

    renderBody();
    subtitle();

    if (unsub) unsub();
    unsub = Modules.on((evt) => {
      if (evt.type === 'toggle' || evt.type === 'bind') { refreshCard(evt.id); subtitle(); refreshSidebar(); if (sub === 'enabled' || filter !== 'all') renderBody(); }
      else if (evt.type === 'profile') { renderBody(); subtitle(); refreshSidebar(); }
      else if (evt.type === 'session') cards.forEach((_, id) => refreshCard(id));
    });
    return page;
  }

  function bulk(list, on) {
    list.forEach((d) => Modules.setEnabled(d.id, on, { silent: true }));
    UI.Toast.show({ type: on ? 'ok' : 'info', title: on ? `${list.length} modules enabled` : `${list.length} modules disabled`, sound: false });
  }

  /* ---------------- Sidebar ---------------- */
  let sideEl = null;
  function sidebar(sub) {
    const el = h(`<div class="sidebar-inner">
      <div class="sidebar-head"><h2>Modules</h2><div class="head-actions"></div></div>
      <div class="sidebar-nav"></div>
      <div class="sidebar-spacer"></div>
      <div class="sidebar-foot"></div>
    </div>`);
    $('.head-actions', el).appendChild(App.collapseButton());
    const nav = $('.sidebar-nav', el);
    const all = Modules.list();
    nav.appendChild(Widgets.sideItem({ id: 'all', icon: 'puzzle', label: 'All modules', count: all.length, active: sub === 'all', onClick: () => App.go('modules', 'all') }));
    nav.appendChild(Widgets.sideItem({ id: 'enabled', icon: 'check-circle', label: 'Enabled', count: countOn(all), active: sub === 'enabled', onClick: () => App.go('modules', 'enabled') }));
    nav.appendChild(h('<div class="side-label">Categories</div>'));
    Modules.CATEGORIES.forEach((c) => {
      const items = Modules.list(c.id);
      const item = Widgets.sideItem({ id: c.id, icon: c.icon, label: c.label, count: `${countOn(items)}/${items.length}`, active: sub === c.id, onClick: () => App.go('modules', c.id) });
      nav.appendChild(item);
    });
    const prof = h(`<button class="profile-chip">${Icons.icon('bookmark')}<span class="pc-body"><span class="pc-k">Profile</span><span class="pc-v"></span></span>${Icons.icon('chevron-right', 'chev')}</button>`);
    prof.addEventListener('click', () => App.go('profiles'));
    $('.sidebar-foot', el).appendChild(prof);
    sideEl = el;
    refreshSidebar();
    return el;
  }

  function refreshSidebar() {
    if (!sideEl) return;
    const all = Modules.list();
    const set = (id, v) => { const c = $(`.side-item[data-id="${id}"] .count`, sideEl); if (c) c.textContent = v; };
    set('enabled', countOn(all));
    Modules.CATEGORIES.forEach((c) => { const items = Modules.list(c.id); set(c.id, `${countOn(items)}/${items.length}`); });
    const p = Modules.activeProfile();
    $('.pc-v', sideEl).textContent = p ? (Modules.profileMatches(p) ? p.name : `${p.name} (edited)`) : 'Custom';
  }

  function unmount() { if (unsub) { unsub(); unsub = null; } }

  window.Pages = window.Pages || {};
  Pages.modules = { id: 'modules', icon: 'puzzle', label: 'Modules', defaultSub: 'all', subKey: 'lastModulesSub', sidebar, content, unmount, openConfig };
})();
