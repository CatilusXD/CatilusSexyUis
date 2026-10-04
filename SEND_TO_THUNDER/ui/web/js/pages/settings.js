/* Settings: Game / Appearance / Window / Behavior / Keybinds / Connections */
(function () {
  'use strict';
  const { $, $$, h, esc } = UI;

  const SECTIONS = [
    { id: 'game', icon: 'gamepad', label: 'Game' },
    { id: 'appearance', icon: 'palette', label: 'Appearance' },
    { id: 'window', icon: 'window', label: 'Window' },
    { id: 'behavior', icon: 'sliders', label: 'Behavior' },
    { id: 'keybinds', icon: 'keyboard', label: 'Keybinds' },
    { id: 'connections', icon: 'share', label: 'Connections' },
  ];

  const title = (t) => h(`<div class="page-title-row"><h1 class="page-title">${esc(t)}</h1></div>`);

  /* ---------------- Game ---------------- */
  function game() {
    const G = Modules.GAME;
    const page = h('<div class="page"></div>');
    page.appendChild(title('Game'));
    const card = h(`<div class="section"><div class="section-label">Installation</div><div class="card dl-card">
      <div class="dl-icon game">${Icons.icon('gamepad', 'plain')}</div>
      <div class="dl-body"><div class="dl-name">${esc(G.name)}</div><div class="dl-sub mono">${esc(Store.get('gamePath') || G.path)}</div></div>
      <div class="dl-actions"></div></div></div>`);
    $('.dl-actions', card).append(
      Widgets.button({ label: 'Browse', icon: 'folder-open', kind: 'subtle', size: 'sm', onClick: async () => { const f = await App.pickFile('.exe'); if (f) { Store.set('gamePath', f.name); $('.dl-sub', card).textContent = f.name; UI.Toast.show({ type: 'ok', title: 'Game location updated', msg: f.name }); } } }),
      Widgets.button({ label: 'Launch', icon: 'play', kind: 'primary', size: 'sm', onClick: () => { Modules.Session.launch(); App.go('home', 'overview'); } }),
    );
    page.appendChild(card);
    page.appendChild(Widgets.section('Detection', [
      { icon: 'eye', title: 'Detect game automatically', desc: `Start modules when ${G.process} is running`, control: { type: 'toggle', key: 'autoDetect' } },
      { icon: 'play', title: 'Start modules with the game', desc: 'Enabled modules start as soon as the game is detected', control: { type: 'toggle', key: 'autoStartModules' } },
      { icon: 'minimize-2', title: 'Minimize on launch', desc: 'Hide this window while the game is running', control: { type: 'toggle', key: 'minimizeOnLaunch' } },
    ]));
    page.appendChild(Widgets.section('Overlays', [
      { icon: 'layers', title: 'Show overlays', desc: 'Master switch for every module that draws over the game', control: { type: 'toggle', key: 'overlaysEnabled' } },
      { icon: 'eye-off', title: 'Hide overlays when alt-tabbed', control: { type: 'toggle', key: 'overlaysHideUnfocused' } },
    ]));
    return page;
  }

  /* ---------------- Appearance ---------------- */
  function appearance() { return Pages.appearanceView(); }

  /* ---------------- Window ---------------- */
  function windowPage() {
    const page = h('<div class="page"></div>');
    page.appendChild(title('Window'));
    page.appendChild(Widgets.section('Behaviour', [
      { icon: 'pin', title: 'Always on Top', desc: 'Keep Synapse Reborn Apex above other windows', control: { type: 'toggle', key: 'alwaysOnTop' } },
      { icon: 'maximize-2', title: 'Launch Maximized', desc: 'Open the window maximized on start', control: { type: 'toggle', key: 'launchMaximized' } },
      { icon: 'window', title: 'Remember Position', desc: 'Restore the last window size and position', control: { type: 'toggle', key: 'rememberPosition' } },
      { icon: 'minimize-2', title: 'Minimize to Tray', desc: 'Hide to the system tray instead of the taskbar', control: { type: 'toggle', key: 'minimizeToTray' } },
    ]));
    page.appendChild(Widgets.section('Layout', [
      { icon: 'panel-left', title: 'Sidebar', desc: 'Show the side navigation panel', control: { type: 'toggle', value: !Store.get('sidebarCollapsed'), onChange: (on) => App.toggleSidebar(on) } },
      { icon: 'type', title: 'Interface Scale', desc: 'Scale the whole interface', control: { type: 'select', value: '100%', options: ['90%', '100%', '110%', '125%'], onChange: (v) => { document.documentElement.style.zoom = parseInt(v, 10) / 100; UI.Toast.show({ type: 'info', title: `Scale ${v}`, sound: false }); } } },
    ]));
    page.appendChild(Widgets.section('Reset', [
      { icon: 'rotate-ccw', title: 'Reset window layout', desc: 'Restore default size, position and panel sizes', control: { type: 'button', label: 'Reset', onClick: () => UI.Toast.show({ type: 'ok', title: 'Layout reset' }) } },
      { icon: 'trash', title: 'Reset all settings', desc: 'Restore every setting to its default value', control: { type: 'button', label: 'Reset all', kind: 'danger', onClick: async () => { if (await UI.Modal.confirm('Reset all settings?', 'Every preference goes back to its default. Modules and profiles are kept.', 'Reset', 'danger')) { Store.reset(); App.applyAppearance(); App.go('settings', 'window'); UI.Toast.show({ type: 'ok', title: 'Settings reset' }); } } } },
    ]));
    return page;
  }

  /* ---------------- Behavior ---------------- */
  function behavior() {
    const page = h('<div class="page"></div>');
    page.appendChild(title('Behavior'));
    page.appendChild(Widgets.section('Application', [
      { icon: 'bell', title: 'Notifications', desc: 'Show toast notifications when modules change', control: { type: 'toggle', key: 'notifications' } },
      { icon: 'x-circle', title: 'Confirm Before Closing', desc: 'Ask before closing while the game is running', control: { type: 'toggle', key: 'confirmClose' } },
      { icon: 'minimize-2', title: 'Close to Tray', desc: 'Keep running in the tray when the window is closed', control: { type: 'toggle', key: 'closeToTray' } },
      { icon: 'power', title: 'Start with Windows', desc: 'Open minimized when you sign in', control: { type: 'toggle', key: 'startWithWindows' } },
    ]));
    page.appendChild(Widgets.section('Updates', [
      { icon: 'download', title: 'Update automatically', desc: 'Download updates in the background and install them on restart', control: { type: 'toggle', key: 'autoUpdate' } },
      { icon: 'rotate-cw', title: 'Check for updates', desc: `You are on version ${App.VERSION}`, control: { type: 'button', label: 'Check now', onClick: (b) => { b.disabled = true; setTimeout(() => { b.disabled = false; UI.Toast.show({ type: 'ok', title: 'You are up to date', msg: `Version ${App.VERSION}` }); }, 800); } } },
    ]));
    return page;
  }

  /* ---------------- Keybinds ---------------- */
  function keybinds() {
    const page = h('<div class="page keybind-list"></div>');
    const tr = title('Keybinds');
    tr.appendChild(Widgets.button({ label: 'Reset defaults', icon: 'rotate-ccw', kind: 'ghost', size: 'sm', onClick: () => { Store.set('keybinds', { ...Store.defaults.keybinds }); App.go('settings', 'keybinds', true); UI.Toast.show({ type: 'ok', title: 'Keybinds reset' }); } }));
    page.appendChild(tr);
    const defs = [
      ['launchGame', 'play', 'Launch or stop the game'],
      ['openModules', 'puzzle', 'Jump to the Modules page'],
      ['disableAll', 'power', 'Turn every module off'],
      ['toggleSidebar', 'panel-left', 'Collapse or expand the side navigation'],
      ['search', 'search', 'Search pages, modules and actions'],
    ];
    page.appendChild(Widgets.section('Application', defs.map(([id, icon, desc]) => Widgets.row({
      icon, title: Modules.APP_BINDS[id], desc,
      control: { type: 'custom', render: () => Widgets.keyRecorder({ value: Store.get('keybinds')[id], owner: (c) => Modules.hotkeyOwner(c, id), onChange: (c) => Store.set('keybinds', { ...Store.get('keybinds'), [id]: c }) }) },
    }))));
    page.appendChild(Widgets.section('Module hotkeys', Modules.list().map((d) => {
      const cat = Modules.category(d.category);
      const r = Widgets.row({
        icon: d.icon, title: d.name, desc: `Toggle · ${cat.label}`,
        control: { type: 'custom', render: () => Widgets.keyRecorder({ value: Modules.bind(d.id), clearable: true, owner: (c) => Modules.hotkeyOwner(c, d.id), onChange: (c) => Modules.setBind(d.id, c) }) },
      });
      return r;
    })));
    return page;
  }

  /* ---------------- Connections ---------------- */
  function connections() {
    const page = h('<div class="page"></div>');
    page.appendChild(title('Connections'));
    const conn = (logo, cls, name, desc, connected) => {
      const r = Widgets.row({ title: name, desc, control: { type: 'button', label: connected ? 'Disconnect' : 'Connect', kind: connected ? 'ghost' : 'subtle', onClick: (b) => { const on = b.textContent.trim() === 'Connect'; b.querySelector('span').textContent = on ? 'Disconnect' : 'Connect'; b.classList.toggle('ghost', on); b.classList.toggle('subtle', !on); UI.Toast.show({ type: on ? 'ok' : 'info', title: on ? `${name} connected` : `${name} disconnected` }); } } });
      r.classList.add('conn-row');
      $('.row-icon', r).innerHTML = `<span class="conn-logo ${cls}">${Icons.icon(logo)}</span>`;
      return r;
    };
    page.appendChild(Widgets.section('Services', [
      conn('discord', 'discord', 'Discord', 'Rich presence and account linking', true),
      conn('cloud', 'cloud', 'Cloud Sync', 'Back up profiles and settings to your account', false),
    ]));
    page.appendChild(Widgets.section('Privacy', [
      { icon: 'activity', title: 'Rich Presence', desc: 'Show what you are doing in Synapse Reborn Apex on your Discord profile', control: { type: 'toggle', value: true } },
      { icon: 'bug', title: 'Crash Reports', desc: 'Send anonymous crash reports to help fix bugs', control: { type: 'toggle', value: true } },
    ]));
    return page;
  }

  /* ---------------- Sidebar ---------------- */
  function sidebar(sub) {
    const el = h(`<div class="sidebar-inner">
      <div class="sidebar-head"><h2>Settings</h2><div class="head-actions"></div></div>
      <div class="sidebar-search"></div>
      <div class="sidebar-nav"></div>
    </div>`);
    $('.head-actions', el).appendChild(App.collapseButton());
    const nav = $('.sidebar-nav', el);
    const render = (q) => {
      nav.innerHTML = '';
      const list = SECTIONS.filter((s) => !q || s.label.toLowerCase().includes(q.toLowerCase()));
      list.forEach((s) => nav.appendChild(Widgets.sideItem({ ...s, active: s.id === sub, onClick: () => App.go('settings', s.id) })));
      if (!list.length) nav.appendChild(h('<div class="tree-empty">No matching sections</div>'));
    };
    $('.sidebar-search', el).appendChild(Widgets.searchField({ placeholder: 'Search...', onInput: render }));
    render('');
    return el;
  }

  const views = { game, appearance, window: windowPage, behavior, keybinds, connections };
  window.Pages = window.Pages || {};
  Pages.settings = { id: 'settings', icon: 'settings', label: 'Settings', defaultSub: 'game', subKey: 'lastSettingsSub', sidebar, content: (sub) => (views[sub] || game)() };
})();
