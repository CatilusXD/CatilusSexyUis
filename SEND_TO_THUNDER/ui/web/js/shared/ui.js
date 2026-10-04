/* UI primitives: tooltips, menus, selects, toggles, sliders, modals, toasts,
   search fields and global click feedback. Everything is delegated so
   dynamically rendered pages get behaviour for free. */
(function () {
  'use strict';

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  // Two frames lets a freshly inserted element commit its initial style before a
  // transition starts; the timeout keeps things moving when frames are throttled.
  const raf = (fn) => { let done = false; const run = () => { if (!done) { done = true; fn(); } }; requestAnimationFrame(() => requestAnimationFrame(run)); setTimeout(run, 60); };
  // Visible window rectangle (excludes the transparent shadow margin in the packaged app).
  const frame = () => { const a = document.getElementById('app'); return a ? a.getBoundingClientRect() : { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight }; };

  /* ---------------- Tooltips ---------------- */
  const Tooltip = (() => {
    let el = null, timer = null, current = null, watch = null;
    function ensure() {
      if (!el) { el = h('<div class="tooltip" role="tooltip"></div>'); document.body.appendChild(el); }
      return el;
    }
    function show(target) {
      const text = target.getAttribute('data-tip');
      if (!text) return;
      const kbd = target.getAttribute('data-tip-kbd');
      const t = ensure();
      t.innerHTML = esc(text) + (kbd ? `<kbd>${esc(kbd)}</kbd>` : '');
      t.classList.remove('show');
      t.style.left = '0px'; t.style.top = '0px';
      const r = target.getBoundingClientRect();
      const pos = target.getAttribute('data-tip-pos') || 'bottom';
      const tr = t.getBoundingClientRect();
      let x = r.left + r.width / 2 - tr.width / 2;
      let y = pos === 'top' ? r.top - tr.height - 7 : r.bottom + 7;
      if (pos === 'right') { x = r.right + 8; y = r.top + r.height / 2 - tr.height / 2; }
      if (pos === 'left') { x = r.left - tr.width - 8; y = r.top + r.height / 2 - tr.height / 2; }
      const f = frame();
      x = clamp(x, f.left + 8, f.right - tr.width - 8);
      y = clamp(y, f.top + 8, f.bottom - tr.height - 8);
      t.style.left = x + 'px'; t.style.top = y + 'px';
      raf(() => t.classList.add('show'));
      current = target;
      // If the target disappears (page switch, re-render) the tooltip must go too.
      clearInterval(watch);
      watch = setInterval(() => { if (!current || !document.contains(current)) hide(); }, 300);
    }
    function hide() {
      clearTimeout(timer); timer = null; clearInterval(watch); watch = null;
      if (el) el.classList.remove('show');
      current = null;
    }
    document.addEventListener('pointerover', (e) => {
      const t = e.target.closest('[data-tip]');
      if (!t || t === current) return;
      clearTimeout(timer);
      const delay = current ? 60 : 520; // quick when hopping between siblings
      timer = setTimeout(() => show(t), delay);
    });
    document.addEventListener('pointerout', (e) => {
      const t = e.target.closest('[data-tip]');
      if (!t) return;
      const to = e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('[data-tip]');
      if (to === t) return;
      hide();
    });
    document.addEventListener('pointerdown', hide, true);
    window.addEventListener('blur', hide);
    window.addEventListener('scroll', hide, true);
    return { hide };
  })();

  /* ---------------- Menus (dropdowns / context) ---------------- */
  const Menu = (() => {
    let open = null;
    function close() {
      if (!open) return;
      const { el, anchor, onClose } = open;
      el.classList.remove('open');
      anchor && anchor.classList && anchor.classList.remove('open');
      anchor && anchor.setAttribute && anchor.setAttribute('aria-expanded', 'false');
      const ref = el;
      setTimeout(() => ref.remove(), 220);
      open = null;
      onClose && onClose();
      window.Sound && Sound.play('close');
    }
    /**
     * items: [{label, icon, value, selected, danger, kbd, onSelect}] | 'sep' | {label, header:true}
     */
    function show(anchor, items, opts = {}) {
      if (open && open.anchor === anchor) { close(); return null; }
      close();
      const el = h('<div class="menu" role="menu"></div>');
      if (opts.className) el.classList.add(opts.className);
      if (opts.width) el.style.minWidth = opts.width + 'px';
      if (opts.content) {
        el.appendChild(opts.content);
      } else {
        items.forEach((it) => {
          if (it === 'sep') { el.appendChild(h('<div class="menu-sep"></div>')); return; }
          if (it.header) { el.appendChild(h(`<div class="menu-label">${esc(it.label)}</div>`)); return; }
          const b = h(`<button class="menu-item${it.selected ? ' selected' : ''}${it.danger ? ' danger' : ''}" role="menuitem">
            ${it.icon ? Icons.icon(it.icon) : ''}<span class="mi-label">${esc(it.label)}</span>
            ${it.kbd ? `<kbd>${esc(it.kbd)}</kbd>` : ''}
            ${opts.checks !== false && !it.kbd ? Icons.icon('check', 'check') : ''}
          </button>`);
          b.addEventListener('click', (e) => {
            e.stopPropagation();
            close();
            it.onSelect && it.onSelect(it.value !== undefined ? it.value : it.label, it);
            opts.onSelect && opts.onSelect(it.value !== undefined ? it.value : it.label, it);
          });
          el.appendChild(b);
        });
      }
      document.body.appendChild(el);
      // Position
      const r = anchor.getBoundingClientRect();
      const mr = el.getBoundingClientRect();
      const align = opts.align || 'left';
      let x = align === 'right' ? r.right - mr.width : r.left;
      let y = r.bottom + 6;
      let up = false;
      const f = frame();
      if (y + mr.height > f.bottom - 10) { y = r.top - mr.height - 6; up = true; }
      if (opts.matchWidth) el.style.minWidth = Math.max(r.width, 150) + 'px';
      x = clamp(x, f.left + 8, f.right - mr.width - 8);
      y = clamp(y, f.top + 8, f.bottom - mr.height - 8);
      el.style.left = x + 'px'; el.style.top = y + 'px';
      if (up) el.classList.add('up');
      raf(() => el.classList.add('open'));
      anchor.classList && anchor.classList.add('open');
      anchor.setAttribute && anchor.setAttribute('aria-expanded', 'true');
      open = { el, anchor, onClose: opts.onClose };
      window.Sound && Sound.play('open');
      return el;
    }
    document.addEventListener('pointerdown', (e) => {
      if (!open) return;
      if (open.el.contains(e.target) || open.anchor.contains(e.target)) return;
      close();
    }, true);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) close(); });
    window.addEventListener('resize', close);
    return { show, close, isOpen: () => !!open };
  })();

  /* ---------------- Select pill ---------------- */
  function bindSelect(el, options, opts = {}) {
    const label = $('.sel-label', el);
    let value = opts.value !== undefined ? opts.value : (options[0] && (options[0].value !== undefined ? options[0].value : options[0]));
    function render() {
      const o = options.find((x) => (x.value !== undefined ? x.value : x) === value);
      label.textContent = o ? (o.label || o) : value;
    }
    el.addEventListener('click', () => {
      Menu.show(el, options.map((o) => {
        const v = o.value !== undefined ? o.value : o;
        return { label: o.label || o, value: v, icon: o.icon, selected: v === value, onSelect: (nv) => { if (nv === value) return; value = nv; render(); Sound.play('tick'); opts.onChange && opts.onChange(nv); } };
      }), { matchWidth: true, align: opts.align || 'left' });
    });
    render();
    return { get: () => value, set: (v) => { value = v; render(); } };
  }

  /* ---------------- Toggle ---------------- */
  function bindToggle(el, opts = {}) {
    let on = !!opts.value;
    el.classList.toggle('on', on);
    el.setAttribute('role', 'switch');
    el.setAttribute('aria-checked', String(on));
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      on = !on;
      el.classList.toggle('on', on);
      el.setAttribute('aria-checked', String(on));
      Sound.play(on ? 'toggleOn' : 'toggleOff');
      opts.onChange && opts.onChange(on);
    });
    el.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); el.click(); } });
    return { get: () => on, set: (v) => { on = !!v; el.classList.toggle('on', on); el.setAttribute('aria-checked', String(on)); } };
  }

  /* ---------------- Slider ---------------- */
  function bindSlider(el, opts = {}) {
    const min = opts.min ?? 0, max = opts.max ?? 100, step = opts.step ?? 1;
    let value = clamp(opts.value ?? min, min, max);
    const track = $('.track', el), valEl = $('.value', el);
    const fmt = opts.format || ((v) => String(v));
    function render() {
      const pct = ((value - min) / (max - min)) * 100;
      el.style.setProperty('--pct', pct + '%');
      if (valEl) valEl.textContent = fmt(value);
    }
    function setFromX(x) {
      const r = track.getBoundingClientRect();
      const p = clamp((x - r.left) / r.width, 0, 1);
      let v = min + p * (max - min);
      v = Math.round(v / step) * step;
      v = clamp(Number(v.toFixed(4)), min, max);
      if (v !== value) {
        value = v; render();
        opts.onInput && opts.onInput(value);
      }
    }
    let dragging = false;
    track.addEventListener('pointerdown', (e) => {
      dragging = true; el.classList.add('dragging');
      track.setPointerCapture(e.pointerId);
      setFromX(e.clientX);
      Sound.play('tick');
    });
    track.addEventListener('pointermove', (e) => { if (dragging) setFromX(e.clientX); });
    const end = () => {
      if (!dragging) return;
      dragging = false; el.classList.remove('dragging');
      opts.onChange && opts.onChange(value);
    };
    track.addEventListener('pointerup', end);
    track.addEventListener('pointercancel', end);
    track.addEventListener('wheel', (e) => {
      e.preventDefault();
      const dir = e.deltaY < 0 ? 1 : -1;
      value = clamp(Number((value + dir * step).toFixed(4)), min, max); render();
      opts.onInput && opts.onInput(value); opts.onChange && opts.onChange(value);
    }, { passive: false });
    track.tabIndex = 0;
    track.addEventListener('keydown', (e) => {
      let d = 0;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') d = -step;
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') d = step;
      if (!d) return;
      e.preventDefault();
      value = clamp(Number((value + d).toFixed(4)), min, max); render();
      opts.onInput && opts.onInput(value); opts.onChange && opts.onChange(value);
    });
    render();
    return { get: () => value, set: (v) => { value = clamp(v, min, max); render(); } };
  }

  /* ---------------- Modal ---------------- */
  const Modal = (() => {
    let root = null, active = null;
    function ensure() {
      if (root) return root;
      root = h('<div class="modal-root"><div class="modal-backdrop"></div></div>');
      document.body.appendChild(root);
      $('.modal-backdrop', root).addEventListener('click', () => active && active.dismissable !== false && close(null));
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && active && active.dismissable !== false) close(null); });
      return root;
    }
    function close(result) {
      if (!active) return;
      const { el, resolve } = active;
      root.classList.remove('show');
      root.classList.add('closing'); // let clicks through while the scrim fades
      Sound.play('close');
      setTimeout(() => { el.remove(); root.classList.remove('open', 'closing'); }, 260);
      active = null;
      resolve(result);
    }
    /**
     * open({ title, sub, body (html|node), actions: [{label, kind, value, primary}], width, dismissable })
     */
    function open(cfg) {
      ensure();
      if (active) close(null);
      return new Promise((resolve) => {
        const el = h(`<div class="modal${cfg.width === 'wide' ? ' wide' : ''}" role="dialog" aria-modal="true">
          <div class="modal-head"><div><h3>${esc(cfg.title || '')}</h3>${cfg.sub ? `<div class="sub">${esc(cfg.sub)}</div>` : ''}</div>
            <button class="btn icon-only sm ghost m-close" data-tip="Close">${Icons.icon('x')}</button></div>
          <div class="modal-body"></div>
          <div class="modal-foot"></div>
        </div>`);
        const body = $('.modal-body', el);
        if (typeof cfg.body === 'string') body.innerHTML = cfg.body; else if (cfg.body) body.appendChild(cfg.body);
        const foot = $('.modal-foot', el);
        (cfg.actions || [{ label: 'OK', kind: 'primary', value: true }]).forEach((a) => {
          const b = h(`<button class="btn ${a.kind || 'subtle'}">${a.icon ? Icons.icon(a.icon) : ''}<span>${esc(a.label)}</span></button>`);
          b.addEventListener('click', () => { if (a.onClick) { const r = a.onClick(el); if (r === false) return; } close(a.value !== undefined ? a.value : a.label); });
          foot.appendChild(b);
        });
        if (!cfg.actions || cfg.actions.length === 0) foot.remove();
        $('.m-close', el).addEventListener('click', () => close(null));
        root.appendChild(el);
        root.classList.remove('closing');
        root.classList.add('open');
        raf(() => root.classList.add('show'));
        Icons.hydrate(el);
        active = { el, resolve, dismissable: cfg.dismissable };
        Sound.play('open');
        cfg.onOpen && cfg.onOpen(el);
        const focusEl = $('input, textarea, .btn.primary', el);
        if (focusEl) setTimeout(() => focusEl.focus(), 200);
      });
    }
    return { open, close, confirm: (title, sub, okLabel = 'Confirm', kind = 'primary') => open({ title, sub, actions: [{ label: 'Cancel', kind: 'ghost', value: false }, { label: okLabel, kind, value: true }] }) };
  })();

  /* ---------------- Toasts ---------------- */
  const Toast = (() => {
    let root = null;
    const icons = { ok: 'check-circle', danger: 'x-circle', warn: 'alert-triangle', info: 'info', default: 'bell' };
    function ensure() { if (!root) { root = h('<div class="toast-root"></div>'); document.body.appendChild(root); } return root; }
    function show({ type = 'default', title, msg, duration = 3600, sound = true }) {
      if (Store.get('notifications') === false && type !== 'danger') return null;
      ensure();
      // Keep the stack short: retire the oldest when more than four are showing.
      const live = $$('.toast:not(.hide)', root);
      if (live.length >= 4 && live[0]._dismiss) live[0]._dismiss();
      const el = h(`<div class="toast ${type}">
        <div class="t-icon">${Icons.icon(icons[type] || icons.default)}</div>
        <div class="t-body"><div class="t-title">${esc(title || '')}</div>${msg ? `<div class="t-msg">${esc(msg)}</div>` : ''}</div>
        <button class="t-close">${Icons.icon('x')}</button>
        <div class="t-bar"></div>
      </div>`);
      root.appendChild(el);
      raf(() => el.classList.add('show'));
      const bar = $('.t-bar', el);
      bar.animate([{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }], { duration, easing: 'linear', fill: 'forwards' });
      let t = setTimeout(dismiss, duration);
      function dismiss() {
        clearTimeout(t);
        el.classList.add('hide'); el.classList.remove('show');
        el.style.maxHeight = el.offsetHeight + 'px';
        raf(() => { el.style.maxHeight = '0px'; el.style.marginTop = '-8px'; el.style.paddingTop = '0'; el.style.paddingBottom = '0'; });
        setTimeout(() => el.remove(), 320);
      }
      el._dismiss = dismiss;
      $('.t-close', el).addEventListener('click', dismiss);
      el.addEventListener('mouseenter', () => clearTimeout(t));
      el.addEventListener('mouseleave', () => { t = setTimeout(dismiss, 1400); });
      if (sound) Sound.play(type === 'ok' ? 'success' : type === 'danger' ? 'error' : 'notify');
      return { dismiss };
    }
    return { show };
  })();

  /* ---------------- Search field ---------------- */
  function bindSearch(el, opts = {}) {
    const input = $('input', el);
    let clear = $('.clear-btn', el);
    if (!clear) { clear = h(`<button class="clear-btn" tabindex="-1">${Icons.icon('x')}</button>`); el.appendChild(clear); }
    const sync = () => el.classList.toggle('has-value', input.value.length > 0);
    input.addEventListener('input', () => { sync(); opts.onInput && opts.onInput(input.value); });
    input.addEventListener('keydown', (e) => { if (e.key === 'Escape') { input.value = ''; sync(); opts.onInput && opts.onInput(''); input.blur(); } if (e.key === 'Enter') opts.onEnter && opts.onEnter(input.value); });
    clear.addEventListener('click', () => { input.value = ''; sync(); opts.onInput && opts.onInput(''); input.focus(); Sound.play('tick'); });
    sync();
    return { input, clear: () => { input.value = ''; sync(); } };
  }

  /* ---------------- Global click feedback ---------------- */
  document.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const t = e.target.closest('button, .side-item, .tab, .tree-row, .tree-leaf, .stat.link, .chip.interactive, .bg-opt, .wcard, .wlink, .row.clickable, [data-click-sound]');
    if (!t || t.hasAttribute('data-silent') || t.classList.contains('toggle') || t.classList.contains('select')) return;
    if (t.closest('.menu') || t.closest('.toast')) { Sound.play('tick'); return; }
    if (t.classList.contains('tab') || t.classList.contains('ptab') || t.classList.contains('nav-btn') || t.classList.contains('seg')) { Sound.play('tick'); return; }
    const bs = Store.get('buttonSound') || 'click';
    if (bs !== 'off') Sound.play(bs);
  }, true);

  document.addEventListener('pointerenter', (e) => {
    const t = e.target && e.target.closest && e.target.closest('button, .side-item, .tab, .tree-row');
    if (t) Sound.play('hover');
  }, true);

  // Give icon-only buttons an accessible name from their tooltip.
  function autobind(root) {
    $$('button[data-tip]', root).forEach((b) => { if (!b.hasAttribute('aria-label') && !b.textContent.trim()) b.setAttribute('aria-label', b.getAttribute('data-tip')); });
  }

  window.UI = { $, $$, h, esc, clamp, raf, frame, Tooltip, Menu, Modal, Toast, bindSelect, bindToggle, bindSlider, bindSearch, autobind };
})();
