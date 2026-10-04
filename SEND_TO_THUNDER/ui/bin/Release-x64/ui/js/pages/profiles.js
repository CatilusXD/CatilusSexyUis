/* Profiles: saved sets of enabled modules that can be applied in one click. */
(function () {
  'use strict';
  const { $, h, esc } = UI;

  let unsub = null;

  function breakdown(p) {
    return Modules.CATEGORIES.map((c) => {
      const n = p.modules.filter((id) => (Modules.get(id) || {}).category === c.id).length;
      return `<span class="pf-cat${n ? '' : ' none'}" data-tip="${esc(c.label)}: ${n} on">${Icons.icon(c.icon, 'plain')}<b>${n}</b></span>`;
    }).join('');
  }

  function card(p) {
    const active = Store.get('activeProfile') === p.id;
    const edited = active && !Modules.profileMatches(p);
    const el = h(`<div class="card profile-card${active ? ' active' : ''}">
      <div class="pf-top">
        <div class="pf-icon">${Icons.icon(p.icon || 'bookmark', 'plain')}</div>
        <div class="mc-title">
          <div class="pf-name">${esc(p.name)}</div>
          <div class="mc-desc">${p.builtIn ? 'Built-in' : 'Custom'} · ${p.modules.length} module${p.modules.length === 1 ? '' : 's'}</div>
        </div>
        <span class="pf-menu"></span>
      </div>
      <div class="pf-about">${esc(p.desc || '')}</div>
      <div class="pf-breakdown">${breakdown(p)}</div>
      <div class="pf-foot">${active ? `<span class="pf-state ${edited ? 'edited' : ''}">${Icons.icon(edited ? 'alert-circle' : 'check-circle', 'plain')}${edited ? 'Active, edited' : 'Active'}</span>` : ''}</div>
    </div>`);
    if (!active || edited) $('.pf-foot', el).appendChild(Widgets.button({
      label: active ? 'Re-apply' : 'Apply', kind: 'primary', size: 'sm',
      onClick: () => { Modules.applyProfile(p.id); UI.Toast.show({ type: 'ok', title: `Profile "${p.name}" applied`, msg: `${p.modules.length} modules enabled`, sound: false }); Sound.play('success'); },
    }));
    $('.pf-menu', el).appendChild(Widgets.button({ icon: 'more-horizontal', iconOnly: true, kind: 'ghost', size: 'sm', tip: 'More', onClick: (e, b) => menu(b, p) }));
    return el;
  }

  function menu(anchor, p) {
    const items = [
      { label: 'Update from current modules', icon: 'refresh-cw', disabled: p.builtIn, onSelect: () => { Modules.updateProfile(p.id, { modules: Modules.enabledIds() }); UI.Toast.show({ type: 'ok', title: `"${p.name}" updated` }); } },
      { label: 'Rename', icon: 'pencil', disabled: p.builtIn, onSelect: () => nameDialog('Rename profile', p.name).then((n) => n && Modules.updateProfile(p.id, { name: n })) },
      { label: 'Duplicate', icon: 'copy', onSelect: () => { Store.set('profiles', [...(Store.get('profiles') || []), { ...p, id: 'p' + Date.now().toString(36), name: p.name + ' copy', builtIn: false, desc: 'Custom profile' }]); App.go('profiles', null, true); } },
      { label: 'Export', icon: 'download', onSelect: () => App.download(`${p.name.replace(/\s+/g, '-').toLowerCase()}.profile.json`, JSON.stringify({ name: p.name, icon: p.icon, modules: p.modules }, null, 2)) },
      'sep',
      { label: 'Delete', icon: 'trash', danger: true, disabled: p.builtIn, onSelect: async () => { if (await UI.Modal.confirm(`Delete "${p.name}"?`, 'Your modules stay as they are; only the profile is removed.', 'Delete', 'danger')) Modules.deleteProfile(p.id); } },
    ].filter((it) => it === 'sep' || !it.disabled);
    UI.Menu.show(anchor, items, { checks: false });
  }

  function nameDialog(title, value) {
    let name = '';
    const read = (el) => { name = $('input', el).value.trim(); if (!name) { UI.Toast.show({ type: 'warn', title: 'Enter a name' }); return false; } return true; };
    return UI.Modal.open({
      title, body: `<div class="field"><label>Name</label><div class="input"><input type="text" maxlength="40" value="${esc(value || '')}" spellcheck="false" autocomplete="off"></div></div>`,
      actions: [{ label: 'Cancel', kind: 'ghost', value: false }, { label: 'Save', kind: 'primary', value: true, onClick: read }],
      onOpen: (el) => $('input', el).addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('.btn.primary', el).click(); } }),
    }).then((ok) => (ok ? name : null));
  }

  async function importProfile() {
    const f = await App.pickFile('.json,application/json');
    if (!f) return;
    try {
      const j = JSON.parse(await f.text());
      const modules = (Array.isArray(j.modules) ? j.modules : []).filter((id) => Modules.get(id));
      if (!j.name || typeof j.name !== 'string') throw new Error('Missing name');
      Store.set('profiles', [...(Store.get('profiles') || []), { id: 'p' + Date.now().toString(36), name: j.name.slice(0, 40), icon: Icons.has(j.icon) ? j.icon : 'bookmark', desc: 'Imported profile', modules }]);
      UI.Toast.show({ type: 'ok', title: 'Profile imported', msg: `${j.name} · ${modules.length} modules` });
      App.go('profiles', null, true);
    } catch (e) {
      UI.Toast.show({ type: 'danger', title: 'Could not import', msg: 'The file is not a profile export.' });
    }
  }

  function content(sub) {
    const page = h(`<div class="page">
      <div class="page-title-row"><div><h1 class="page-title">Profiles</h1><div class="page-subtitle">Save the modules you have on and switch between setups in one click.</div></div><div class="mod-head-actions"></div></div>
      <div class="profile-grid"></div>
    </div>`);
    $('.mod-head-actions', page).append(
      Widgets.button({ label: 'Import', icon: 'upload', kind: 'ghost', size: 'sm', onClick: importProfile }),
      Widgets.button({ label: 'Save current', icon: 'plus', kind: 'primary', size: 'sm', onClick: () => nameDialog('Save current modules as a profile', '').then((n) => { if (n) { Modules.saveProfile(n); UI.Toast.show({ type: 'ok', title: `Profile "${n}" saved` }); } }) }),
    );
    const grid = $('.profile-grid', page);
    const render = () => {
      grid.innerHTML = '';
      const list = Modules.profiles().filter((p) => sub === 'custom' ? !p.builtIn : sub === 'builtin' ? p.builtIn : true);
      if (!list.length) grid.appendChild(h('<div class="card span-all"></div>')).appendChild(Widgets.empty({ icon: 'bookmark', compact: true, title: 'No custom profiles yet', desc: 'Set up your modules, then press "Save current".' }));
      list.forEach((p) => grid.appendChild(card(p)));
      Icons.hydrate(grid);
    };
    render();
    if (unsub) unsub();
    unsub = Modules.on((e) => { if (e.type === 'profile' || e.type === 'toggle') { render(); refreshCounts(); } });
    return page;
  }

  let sideEl = null;
  function refreshCounts() {
    if (!sideEl) return;
    const all = Modules.profiles();
    const set = (id, v) => { const c = $(`.side-item[data-id="${id}"] .count`, sideEl); if (c) c.textContent = v; };
    set('all', all.length); set('builtin', all.filter((p) => p.builtIn).length); set('custom', all.filter((p) => !p.builtIn).length);
  }

  function sidebar(sub) {
    const el = h(`<div class="sidebar-inner">
      <div class="sidebar-head"><h2>Profiles</h2><div class="head-actions"></div></div>
      <div class="sidebar-nav"></div>
    </div>`);
    $('.head-actions', el).appendChild(App.collapseButton());
    const nav = $('.sidebar-nav', el);
    const all = Modules.profiles();
    [
      { id: 'all', icon: 'layers', label: 'All profiles', count: all.length },
      { id: 'builtin', icon: 'star', label: 'Built-in', count: all.filter((p) => p.builtIn).length },
      { id: 'custom', icon: 'bookmark', label: 'Custom', count: all.filter((p) => !p.builtIn).length },
    ].forEach((it) => nav.appendChild(Widgets.sideItem({ ...it, active: it.id === sub, onClick: () => App.go('profiles', it.id) })));
    sideEl = el;
    return el;
  }

  function unmount() { if (unsub) { unsub(); unsub = null; } }

  window.Pages = window.Pages || {};
  Pages.profiles = { id: 'profiles', icon: 'bookmark', label: 'Profiles', defaultSub: 'all', subKey: 'lastProfilesSub', sidebar, content, unmount };
})();
