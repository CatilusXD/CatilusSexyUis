/* Higher-level composable widgets built on UI primitives. */
(function () {
  'use strict';
  const { $, h, esc } = UI;

  /** Settings row. control: {type, key|value, ...} */
  function row(cfg) {
    const el = h(`<div class="row${cfg.clickable ? ' clickable' : ''}">
      <div class="row-icon">${cfg.icon ? Icons.icon(cfg.icon) : ''}</div>
      <div class="row-body">
        <div class="row-title">${esc(cfg.title)}${cfg.badge ? `<span class="chip ${cfg.badgeKind || ''}">${esc(cfg.badge)}</span>` : ''}</div>
        ${cfg.desc ? `<div class="row-desc">${esc(cfg.desc)}</div>` : ''}
      </div>
      <div class="row-ctl"></div>
    </div>`);
    const ctl = $('.row-ctl', el);
    const c = cfg.control;
    if (c) {
      const key = c.key;
      const initial = c.value !== undefined ? c.value : (key ? Store.get(key) : undefined);
      const commit = (v) => { if (key) Store.set(key, v); c.onChange && c.onChange(v); };
      if (c.type === 'toggle') {
        const t = h('<button class="toggle" data-silent></button>');
        ctl.appendChild(t);
        const api = UI.bindToggle(t, { value: !!initial, onChange: commit });
        if (key) Store.on(key, (v) => api.set(v));
        if (c.disabled) t.disabled = true;
      } else if (c.type === 'select') {
        const s = h(`<button class="select${c.wide ? ' wide' : ''}"><span class="sel-label"></span>${Icons.icon('chevron-down')}</button>`);
        ctl.appendChild(s);
        UI.bindSelect(s, c.options, { value: initial, onChange: commit, align: 'right' });
      } else if (c.type === 'slider') {
        const s = h(`<div class="slider${c.small ? ' sm' : ''}"><div class="track"><div class="fill"></div><div class="thumb"></div></div><div class="value"></div></div>`);
        ctl.appendChild(s);
        const api = UI.bindSlider(s, { min: c.min, max: c.max, step: c.step, value: initial, format: c.format, onInput: (v) => { c.onInput && c.onInput(v); }, onChange: commit });
        if (key) Store.on(key, (v) => api.set(v));
      } else if (c.type === 'button') {
        const b = h(`<button class="btn ${c.kind || 'subtle'} ${c.size || 'sm'}">${c.icon ? Icons.icon(c.icon) : ''}<span>${esc(c.label)}</span></button>`);
        b.addEventListener('click', (e) => { e.stopPropagation(); c.onClick && c.onClick(b); });
        ctl.appendChild(b);
      } else if (c.type === 'chevron') {
        ctl.appendChild(h(`${Icons.icon('chevron-right', 'chev')}`));
      } else if (c.type === 'custom') {
        const node = c.render();
        if (node) ctl.appendChild(node);
      } else if (c.type === 'text') {
        ctl.appendChild(h(`<span class="dim" style="font-size:12px">${esc(c.text)}</span>`));
      }
    }
    if (cfg.clickable && cfg.onClick) el.addEventListener('click', () => cfg.onClick(el));
    return el;
  }

  function section(label, rows, opts = {}) {
    const el = h(`<div class="section">${label ? `<div class="section-label">${esc(label)}</div>` : ''}<div class="card rows"></div></div>`);
    const body = $('.rows', el);
    if (opts.header) body.before(opts.header);
    rows.forEach((r) => body.appendChild(r instanceof Node ? r : row(r)));
    return el;
  }

  function stat(cfg) {
    const el = h(`<div class="card stat${cfg.link ? ' link hoverable' : ''}${cfg.span ? ' span-2' : ''}">
      <div class="stat-col"><div class="k">${esc(cfg.k)}</div><div class="v${cfg.mono ? ' mono' : ''}"></div>${cfg.s ? `<div class="s">${esc(cfg.s)}</div>` : ''}</div>
      ${cfg.rk !== undefined ? `<div class="stat-col right"><div class="k">${esc(cfg.rk)}</div><div class="v${cfg.rmono ? ' mono' : ''}"></div>${cfg.rs ? `<div class="s">${esc(cfg.rs)}</div>` : ''}</div>` : ''}
      ${cfg.link ? Icons.icon('arrow-up-right', 'arrow sm') : ''}
    </div>`);
    const v = $('.stat-col .v', el);
    if (cfg.v instanceof Node) v.appendChild(cfg.v); else v.innerHTML = cfg.vHtml || esc(cfg.v ?? '');
    if (cfg.rk !== undefined) {
      const rv = $('.stat-col.right .v', el);
      if (cfg.rv instanceof Node) rv.appendChild(cfg.rv); else rv.innerHTML = cfg.rvHtml || esc(cfg.rv ?? '');
    }
    if (cfg.body) el.appendChild(cfg.body);
    if (cfg.onClick) el.addEventListener('click', cfg.onClick);
    return el;
  }

  function empty(cfg) {
    const el = h(`<div class="empty${cfg.compact ? ' compact' : ''}">
      <div class="empty-icon">${Icons.icon(cfg.icon || 'box')}</div>
      <div class="empty-title">${esc(cfg.title)}</div>
      ${cfg.desc ? `<div class="empty-desc">${esc(cfg.desc)}</div>` : ''}
      <div class="empty-actions"></div>
    </div>`);
    const acts = $('.empty-actions', el);
    (cfg.actions || []).forEach((a) => {
      const b = h(`<button class="btn ${a.kind || 'primary'} ${a.size || ''}">${a.icon ? Icons.icon(a.icon) : ''}<span>${esc(a.label)}</span></button>`);
      b.addEventListener('click', a.onClick);
      acts.appendChild(b);
    });
    if (cfg.link) {
      const l = h(`<button class="empty-link">${esc(cfg.link.label)}</button>`);
      l.addEventListener('click', cfg.link.onClick);
      acts.appendChild(l);
    }
    if (!cfg.actions && !cfg.link) acts.remove();
    return el;
  }

  function sideItem(cfg) {
    const el = h(`<button class="side-item${cfg.sub ? ' two-line' : ''}${cfg.active ? ' active' : ''}" data-id="${esc(cfg.id || '')}">
      ${Icons.icon(cfg.icon)}
      ${cfg.sub ? `<span class="sub"><span>${esc(cfg.label)}</span><span class="sub-text">${esc(cfg.sub)}</span></span>` : `<span>${esc(cfg.label)}</span>`}
      ${cfg.count !== undefined ? `<span class="count">${esc(cfg.count)}</span>` : ''}
    </button>`);
    if (cfg.onClick) el.addEventListener('click', () => cfg.onClick(el));
    return el;
  }

  function searchField(cfg = {}) {
    const el = h(`<div class="search${cfg.small ? ' sm' : ''}">${Icons.icon('search')}<input type="text" placeholder="${esc(cfg.placeholder || 'Search...')}" spellcheck="false" autocomplete="off">${cfg.kbd ? `<span class="kbd-hint"><kbd>${esc(cfg.kbd)}</kbd></span>` : ''}</div>`);
    UI.bindSearch(el, cfg);
    return el;
  }

  function button(cfg) {
    const el = h(`<button class="btn ${cfg.kind || 'subtle'} ${cfg.size || ''}${cfg.iconOnly ? ' icon-only' : ''}"${cfg.tip ? ` data-tip="${esc(cfg.tip)}"` : ''}>${cfg.icon ? Icons.icon(cfg.icon) : ''}${cfg.label ? `<span>${esc(cfg.label)}</span>` : ''}</button>`);
    if (cfg.iconOnly && cfg.tip) el.setAttribute('aria-label', cfg.tip);
    if (cfg.onClick) el.addEventListener('click', (e) => cfg.onClick(e, el));
    return el;
  }

  /** Hotkey recorder: click, then press a combination. Esc cancels; Backspace
      clears when cfg.clearable. cfg.owner(combo) returns the name of whatever
      already uses a combination, or null. */
  function keyRecorder(cfg) {
    let value = cfg.value || '';
    const el = h('<button class="kb" data-tip="Click, then press a key combination"></button>');
    const render = () => { el.innerHTML = value ? value.split('+').map((k) => `<kbd>${esc(k)}</kbd>`).join('<span class="dim">+</span>') : '<span class="dim">None</span>'; };
    render();
    el.addEventListener('click', (ev) => {
      ev.stopPropagation();
      if (el.classList.contains('recording')) return;
      el.classList.add('recording'); el.innerHTML = '<span>Press keys…</span>';
      Sound.play('open');
      const cleanup = () => { el.classList.remove('recording'); window.removeEventListener('keydown', onKey, true); document.removeEventListener('pointerdown', onOut, true); };
      const onOut = (e) => { if (!el.contains(e.target)) { cleanup(); render(); } };
      const onKey = (e) => {
        e.preventDefault(); e.stopPropagation();
        if (e.key === 'Escape') { cleanup(); render(); return; }
        if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;
        if (e.key === 'Backspace' && cfg.clearable) { value = ''; cfg.onChange(''); cleanup(); render(); return; }
        const combo = (e.ctrlKey ? 'Ctrl+' : '') + (e.shiftKey ? 'Shift+' : '') + (e.altKey ? 'Alt+' : '') + (e.key.length === 1 ? e.key.toUpperCase() : e.key);
        const taken = combo !== value && cfg.owner && cfg.owner(combo);
        if (taken) { UI.Toast.show({ type: 'warn', title: 'Already in use', msg: `${combo} is bound to ${taken}.` }); cleanup(); render(); return; }
        value = combo; cfg.onChange(combo);
        cleanup(); render(); Sound.play('success');
      };
      window.addEventListener('keydown', onKey, true);
      setTimeout(() => document.addEventListener('pointerdown', onOut, true), 0);
    });
    return el;
  }

  window.Widgets = { row, section, stat, empty, sideItem, searchField, button, keyRecorder };
})();
