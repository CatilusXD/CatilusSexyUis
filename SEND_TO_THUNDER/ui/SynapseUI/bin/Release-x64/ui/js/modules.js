/* Module registry for vesper / Apex Legends.
   Module definitions mirror app.cpp exactly so the UI reflects real feature state.
   To wire live enable/disable into the C++ host, call window.synapse.send() with
   the module id and new state after each toggle. */
(function () {
  'use strict';

  const GAME = { name: 'Apex Legends', process: 'r5apex.exe', path: 'C:\\Program Files (x86)\\EA Games\\Apex Legends\\r5apex.exe' };

  const CATEGORIES = [
    { id: 'combat',   label: 'Combat',   icon: 'swords' },
    { id: 'visuals',  label: 'Visuals',  icon: 'eye'    },
    { id: 'movement', label: 'Movement', icon: 'wind'   },
    { id: 'player',   label: 'Player',   icon: 'user'   },
    { id: 'utility',  label: 'Utility',  icon: 'wrench' },
  ];

  const DEFS = [
    // ── Combat ────────────────────────────────────────────────────────────────
    {
      id: 'aimbot', name: 'Aimbot', category: 'combat', icon: 'target', enabled: false,
      desc: 'Locks onto the nearest enemy within your FOV.',
      tags: [],
      settings: [
        { key: 'activation', title: 'Activation', type: 'select', default: 'Hold LMB', options: ['Hold LMB', 'Hold RMB', 'Always'] },
        { key: 'fov',        title: 'FOV',        type: 'slider', default: 10,  min: 1,   max: 45,  step: 0.5, unit: '°' },
        { key: 'smooth',     title: 'Smooth',     type: 'slider', default: 6,   min: 1,   max: 20,  step: 0.5 },
        { key: 'bone',       title: 'Bone',       type: 'select', default: 'Head', options: ['Head', 'Neck', 'Chest', 'Stomach'] },
        { key: 'visCheck',   title: 'Visibility check', desc: 'Only aim at visible enemies', type: 'toggle', default: true  },
        { key: 'teamCheck',  title: 'Team check',       desc: 'Skip teammates',              type: 'toggle', default: true  },
      ],
    },
    {
      id: 'triggerbot', name: 'Triggerbot', category: 'combat', icon: 'zap', enabled: false,
      desc: 'Fires automatically when an enemy is under your crosshair.',
      tags: [],
      settings: [
        { key: 'delayMin',  title: 'Delay min', type: 'slider', default: 30, min: 5,   max: 300, step: 5, unit: ' ms' },
        { key: 'delayMax',  title: 'Delay max', type: 'slider', default: 80, min: 5,   max: 300, step: 5, unit: ' ms' },
        { key: 'fov',       title: 'FOV',       type: 'slider', default: 3,  min: 0.5, max: 15,  step: 0.25, unit: '°' },
        { key: 'visCheck',  title: 'Visibility check', desc: 'Only fire at visible enemies', type: 'toggle', default: true },
        { key: 'teamCheck', title: 'Team check',       desc: 'Skip teammates',               type: 'toggle', default: true },
      ],
    },
    {
      id: 'recoil-control', name: 'Recoil Control', category: 'combat', icon: 'shield', enabled: false,
      desc: 'Counters weapon recoil by nudging view angles.',
      tags: [],
      settings: [
        { key: 'vertical',   title: 'Vertical',   type: 'slider', default: 60, min: 0, max: 100, step: 1, unit: '%' },
        { key: 'horizontal', title: 'Horizontal', type: 'slider', default: 60, min: 0, max: 100, step: 1, unit: '%' },
        { key: 'mode',       title: 'Mode',       type: 'select', default: 'Compensate', options: ['Compensate', 'Smooth'] },
      ],
    },

    // ── Visuals ───────────────────────────────────────────────────────────────
    {
      id: 'player-esp', name: 'Player ESP', category: 'visuals', icon: 'eye', enabled: true,
      desc: 'Draws boxes, health bars and info on all enemies.',
      tags: [],
      settings: [
        { key: 'boxStyle',   title: 'Box style',    type: 'select', default: 'Corner',  options: ['Box', 'Corner', 'Outline'] },
        { key: 'healthBar',  title: 'Health bar',   type: 'toggle', default: true  },
        { key: 'shieldBar',  title: 'Shield bar',   type: 'toggle', default: true  },
        { key: 'skeleton',   title: 'Skeleton',     desc: 'Draw bone structure', type: 'toggle', default: false },
        { key: 'name',       title: 'Name',         type: 'toggle', default: true  },
        { key: 'distance',   title: 'Distance',     type: 'toggle', default: true  },
        { key: 'maxDist',    title: 'Max distance', type: 'slider', default: 300, min: 50, max: 600, step: 10, unit: ' m' },
        { key: 'snapLines',  title: 'Snap lines',   desc: 'Line from screen edge to enemy', type: 'toggle', default: false },
        { key: 'visCheck',   title: 'Vis. check',   desc: 'Dim enemies behind walls',       type: 'toggle', default: false },
        { key: 'hideTeam',   title: 'Hide team',    desc: "Don't draw teammates",           type: 'toggle', default: true  },
        { key: 'ammo',       title: 'Ammo',         desc: 'Show clip / stockpile',          type: 'toggle', default: false },
      ],
    },
    {
      id: 'item-esp', name: 'Item ESP', category: 'visuals', icon: 'layers', enabled: false,
      desc: 'Shows loot on the ground by type and tier.',
      tags: [],
      settings: [
        { key: 'weapons',  title: 'Weapons', type: 'toggle', default: true  },
        { key: 'armor',    title: 'Armor',   type: 'toggle', default: true  },
        { key: 'healing',  title: 'Healing', type: 'toggle', default: true  },
        { key: 'ammo',     title: 'Ammo',    type: 'toggle', default: false },
        { key: 'goldOnly', title: 'Gold only', desc: 'Only show gold-tier items', type: 'toggle', default: true },
        { key: 'maxDist',  title: 'Max distance', type: 'slider', default: 150, min: 20, max: 400, step: 10, unit: ' m' },
      ],
    },
    {
      id: 'deathbox-esp', name: 'Death Box ESP', category: 'visuals', icon: 'box', enabled: false,
      desc: 'Highlights death crates left by eliminated players.',
      tags: [],
      settings: [
        { key: 'killerName', title: 'Show killer name', type: 'toggle', default: true },
      ],
    },
    {
      id: 'glow', name: 'Glow', category: 'visuals', icon: 'sparkles', enabled: false,
      desc: "Uses Apex's built-in highlight system to outline enemies.",
      tags: [],
      settings: [
        { key: 'includeTeam', title: 'Include team', desc: 'Also highlight teammates', type: 'toggle', default: false },
        { key: 'intensity',   title: 'Intensity',    type: 'slider', default: 1.0, min: 0.1, max: 3.0, step: 0.1 },
        { key: 'mode',        title: 'Mode',         type: 'select', default: 'Static', options: ['Static', 'Team color', 'Visible pulse'] },
      ],
    },
    {
      id: 'radar', name: 'Radar', category: 'visuals', icon: 'sun', enabled: false,
      desc: 'Mini-map showing enemy positions relative to you.',
      tags: [],
      settings: [
        { key: 'size',    title: 'Size',    type: 'slider', default: 200, min: 100, max: 400, step: 10, unit: ' px' },
        { key: 'zoom',    title: 'Zoom',    type: 'slider', default: 1.5, min: 0.5, max: 4.0, step: 0.1, unit: '×' },
        { key: 'corner',  title: 'Corner',  type: 'select', default: 'Top-right', options: ['Top-left', 'Top-right', 'Bot-left', 'Bot-right'] },
        { key: 'enemies', title: 'Enemies', type: 'toggle', default: true  },
        { key: 'team',    title: 'Team',    type: 'toggle', default: false },
        { key: 'opacity', title: 'Opacity', type: 'slider', default: 85, min: 10, max: 100, step: 5, unit: '%' },
      ],
    },
    {
      id: 'crosshair', name: 'Crosshair', category: 'visuals', icon: 'target', enabled: false,
      desc: "Custom crosshair drawn over the game's own.",
      tags: [],
      settings: [
        { key: 'style',     title: 'Style',     type: 'select', default: 'Dot', options: ['Dot', 'Cross', 'Circle', 'Static'] },
        { key: 'size',      title: 'Size',      type: 'slider', default: 4.0, min: 2,   max: 16,  step: 0.5, unit: ' px' },
        { key: 'gap',       title: 'Gap',       type: 'slider', default: 3.0, min: 0,   max: 20,  step: 0.5, unit: ' px' },
        { key: 'thickness', title: 'Thickness', type: 'slider', default: 1.5, min: 0.5, max: 4.0, step: 0.5, unit: ' px' },
      ],
    },

    // ── Movement ──────────────────────────────────────────────────────────────
    {
      id: 'bunny-hop', name: 'Bunny Hop', category: 'movement', icon: 'wind', enabled: false,
      desc: 'Auto-jumps to maintain speed while airborne.',
      tags: [],
      settings: [
        { key: 'mode',       title: 'Mode',        type: 'select', default: 'Always', options: ['Always', 'On key'] },
        { key: 'jumpChance', title: 'Jump chance', type: 'slider', default: 90, min: 50, max: 100, step: 1, unit: '%' },
      ],
    },
    {
      id: 'auto-sprint', name: 'Auto Sprint', category: 'movement', icon: 'gauge', enabled: false,
      desc: 'Always sprint without holding the sprint key.',
      tags: [],
      settings: [
        { key: 'omni', title: 'Omnidirectional', desc: 'Sprint in all directions', type: 'toggle', default: false },
      ],
    },
    {
      id: 'super-glide', name: 'Super Glide', category: 'movement', icon: 'rocket', enabled: false,
      desc: 'Times the jump + crouch input to execute a super glide.',
      tags: ['Beta'],
      settings: [
        { key: 'window', title: 'Window', type: 'slider', default: 60,  min: 30,  max: 150, step: 5,  unit: ' ms' },
        { key: 'chance', title: 'Chance', type: 'slider', default: 100, min: 50,  max: 100, step: 1,  unit: '%'  },
      ],
    },

    // ── Player ────────────────────────────────────────────────────────────────
    {
      id: 'no-recoil', name: 'No Recoil', category: 'player', icon: 'swords', enabled: false,
      desc: 'Zeros out the punch angle each frame (raw method).',
      tags: [],
      settings: [
        { key: 'vertical',   title: 'Vertical',   type: 'slider', default: 100, min: 0, max: 100, step: 5, unit: '%' },
        { key: 'horizontal', title: 'Horizontal', type: 'slider', default: 100, min: 0, max: 100, step: 5, unit: '%' },
      ],
    },
    {
      id: 'no-sway', name: 'No Sway', category: 'player', icon: 'shield', enabled: false,
      desc: 'Reduces weapon sway from movement and ADS.',
      tags: [],
      settings: [
        { key: 'scale', title: 'Scale', type: 'slider', default: 100, min: 0, max: 100, step: 5, unit: '%' },
      ],
    },
    {
      id: 'spectator-list', name: 'Spectator List', category: 'player', icon: 'eye', enabled: false,
      desc: 'Shows who is spectating you in a corner overlay.',
      tags: [],
      settings: [
        { key: 'corner',   title: 'Corner',     type: 'select', default: 'Top-right', options: ['Top-left', 'Top-right'] },
        { key: 'maxShown', title: 'Max shown',  type: 'slider', default: 8,  min: 1,  max: 16,  step: 1  },
        { key: 'opacity',  title: 'Opacity',    type: 'slider', default: 85, min: 10, max: 100, step: 5, unit: '%' },
      ],
    },

    // ── Utility ───────────────────────────────────────────────────────────────
    {
      id: 'stream-proof', name: 'Stream Proof', category: 'utility', icon: 'eye', enabled: false,
      desc: 'Hides menu and/or overlay from OBS / capture.',
      tags: [],
      settings: [
        { key: 'hideMenu',    title: 'Hide menu',    desc: 'Menu invisible to screen capture',    type: 'toggle', default: true  },
        { key: 'hideOverlay', title: 'Hide overlay', desc: 'Overlay invisible to screen capture', type: 'toggle', default: false },
      ],
    },
    {
      id: 'fps-cap', name: 'FPS Cap', category: 'utility', icon: 'gauge', enabled: false,
      desc: 'Limits the overlay render loop to save CPU.',
      tags: [],
      settings: [
        { key: 'cap', title: 'Cap', type: 'slider', default: 240, min: 30, max: 360, step: 10, unit: ' fps' },
      ],
    },
    {
      id: 'panic-key', name: 'Panic Key', category: 'utility', icon: 'zap', enabled: false,
      desc: 'Instantly disables all features when held.',
      tags: [],
      settings: [],
    },
  ];

  const BUILT_IN_PROFILES = [
    { id: 'default',      name: 'Default',      icon: 'star',   builtIn: true, desc: 'Only Player ESP on — safe first run.',        modules: ['player-esp'] },
    { id: 'visuals-only', name: 'Visuals only', icon: 'eye',    builtIn: true, desc: 'All visual modules, nothing that inputs.',   modules: ['player-esp', 'item-esp', 'deathbox-esp', 'glow', 'radar', 'crosshair'] },
    { id: 'full',         name: 'Full',          icon: 'layers', builtIn: true, desc: 'Every module on.',                           modules: DEFS.map((d) => d.id) },
    { id: 'none',         name: 'Nothing',       icon: 'circle', builtIn: true, desc: 'Every module off.',                          modules: [] },
  ];

  const byId = Object.fromEntries(DEFS.map((d) => [d.id, d]));
  const listeners = new Set();
  const emit = (evt) => listeners.forEach((fn) => { try { fn(evt); } catch (e) { console.error(e); } });

  function state() {
    const saved = Store.get('modules') || {};
    const out = {};
    DEFS.forEach((d) => {
      const s = saved[d.id] || {};
      out[d.id] = {
        enabled: s.enabled !== undefined ? !!s.enabled : !!d.enabled,
        bind: s.bind !== undefined ? s.bind : (d.bind || ''),
        settings: { ...Object.fromEntries(d.settings.map((x) => [x.key, x.default])), ...(s.settings || {}) },
      };
    });
    return out;
  }
  function write(id, patch) {
    const all = state();
    all[id] = { ...all[id], ...patch };
    Store.set('modules', all);
  }

  const category  = (id) => CATEGORIES.find((c) => c.id === id);
  const list      = (cat) => DEFS.filter((d) => !cat || d.category === cat);
  const get       = (id) => byId[id];
  const isEnabled = (id) => state()[id].enabled;
  const enabledIds = () => DEFS.filter((d) => isEnabled(d.id)).map((d) => d.id);
  const settings  = (id) => state()[id].settings;
  const bind      = (id) => state()[id].bind;

  function setEnabled(id, on, opts = {}) {
    const d = byId[id];
    if (!d || isEnabled(id) === !!on) return;
    write(id, { enabled: !!on });
    log(on ? 'ok' : 'dim', `${d.name} ${on ? 'enabled' : 'disabled'}`, d.icon);
    if (!opts.silent && Store.get('notifications'))
      UI.Toast.show({ type: on ? 'ok' : 'info', title: `${d.name} ${on ? 'enabled' : 'disabled'}`, sound: false });
    // Bridge to C++ host when running inside the exe.
    if (window.synapse && window.synapse.send)
      window.synapse.send(`module:${id}:${on ? '1' : '0'}`);
    emit({ type: 'toggle', id, on: !!on });
  }
  const toggle = (id) => setEnabled(id, !isEnabled(id));

  function setSetting(id, key, value) {
    write(id, { settings: { ...settings(id), [key]: value } });
    if (window.synapse && window.synapse.send)
      window.synapse.send(`setting:${id}:${key}:${value}`);
    emit({ type: 'setting', id, key, value });
  }
  function resetSettings(id) {
    write(id, { settings: Object.fromEntries(byId[id].settings.map((x) => [x.key, x.default])) });
    emit({ type: 'setting', id });
  }
  function setBind(id, combo) {
    write(id, { bind: combo || '' });
    emit({ type: 'bind', id });
  }

  const APP_BINDS = { search: 'Command palette', toggleSidebar: 'Toggle sidebar', openModules: 'Open modules', disableAll: 'Disable all modules', launchGame: 'Launch / stop game' };
  function hotkeyOwner(combo, exceptId) {
    if (!combo) return null;
    const m = DEFS.find((d) => d.id !== exceptId && bind(d.id) === combo);
    if (m) return m.name;
    const app = Object.entries(Store.get('keybinds') || {}).find(([k, v]) => v === combo && k !== exceptId);
    return app ? APP_BINDS[app[0]] || app[0] : null;
  }

  /* ---------------- Profiles ---------------- */
  const profiles      = () => [...BUILT_IN_PROFILES, ...(Store.get('profiles') || [])];
  const activeProfile = () => profiles().find((p) => p.id === Store.get('activeProfile')) || null;

  function applyProfile(id) {
    const p = profiles().find((x) => x.id === id);
    if (!p) return;
    const all = state();
    DEFS.forEach((d) => { all[d.id].enabled = p.modules.includes(d.id); });
    Store.set('modules', all);
    Store.set('activeProfile', p.id);
    log('info', `Profile "${p.name}" applied (${p.modules.length} modules)`, 'bookmark');
    emit({ type: 'profile', id });
  }
  function saveProfile(name, icon) {
    const p = { id: 'p' + Date.now().toString(36), name, icon: icon || 'bookmark', desc: 'Custom profile', modules: enabledIds() };
    Store.set('profiles', [...(Store.get('profiles') || []), p]);
    Store.set('activeProfile', p.id);
    log('info', `Profile "${name}" saved`, 'bookmark');
    emit({ type: 'profile', id: p.id });
    return p;
  }
  function updateProfile(id, patch) {
    Store.set('profiles', (Store.get('profiles') || []).map((p) => (p.id === id ? { ...p, ...patch } : p)));
    emit({ type: 'profile', id });
  }
  function deleteProfile(id) {
    Store.set('profiles', (Store.get('profiles') || []).filter((p) => p.id !== id));
    if (Store.get('activeProfile') === id) Store.set('activeProfile', '');
    emit({ type: 'profile', id });
  }
  const profileMatches = (p) => p && p.modules.length === enabledIds().length && p.modules.every((id) => isEnabled(id));

  /* ---------------- Activity log ---------------- */
  const LOG_MAX = 200;
  const logs = [];
  function log(kind, msg, icon) {
    logs.unshift({ kind, msg, icon: icon || 'info', at: Date.now() });
    if (logs.length > LOG_MAX) logs.pop();
    emit({ type: 'log' });
  }

  /* ---------------- Game session (polled from host bridge) ---------------- */
  const Session = (() => {
    let status = 'stopped';
    let startedAt = 0, timer = null;
    const HISTORY = 60;
    const series = { fps: [], ping: [], cpu: [], gpu: [] };

    function sample() {
      const push = (k, v) => { series[k].push(v); if (series[k].length > HISTORY) series[k].shift(); };
      // In the real exe these values come from the host bridge via postMessage.
      const wobble = (base, spread) => Math.round(base + (Math.random() - 0.5) * spread);
      push('fps',  Math.max(30,  wobble(165, 20)));
      push('ping', Math.max(8,   wobble(32,  8) + (Math.random() < 0.05 ? 40 : 0)));
      push('cpu',  Math.min(100, Math.max(5,  wobble(44, 12))));
      push('gpu',  Math.min(95,  Math.max(40, wobble(70, 4))));
      emit({ type: 'tick' });
    }
    function launch() {
      if (status !== 'stopped') return;
      status = 'launching';
      log('info', `Launching ${GAME.name}…`, 'play');
      if (window.synapse && window.synapse.send) window.synapse.send('launch-game');
      emit({ type: 'session' });
      setTimeout(() => {
        if (status !== 'launching') return;
        status = 'running'; startedAt = Date.now();
        Object.values(series).forEach((a) => a.splice(0));
        sample(); timer = setInterval(sample, 1000);
        log('ok', `${GAME.name} found · ${enabledIds().length} modules active`, 'gamepad');
        Sound.play('success');
        emit({ type: 'session' });
      }, 1200);
    }
    function stop() {
      if (status === 'stopped') return;
      clearInterval(timer); timer = null;
      status = 'stopped';
      log('dim', `${GAME.name} detached · modules stopped`, 'square');
      emit({ type: 'session' });
    }
    const last = (k) => series[k][series[k].length - 1];
    return { launch, stop, status: () => status, running: () => status === 'running', startedAt: () => startedAt, series, last };
  })();

  // Listen for host → page messages (game detected, stats ticks, etc.)
  if (window.chrome && window.chrome.webview) {
    window.chrome.webview.addEventListener('message', (e) => {
      const m = e.data || {};
      if (m.type === 'game') {
        if (m.running && Session.status() === 'stopped') Session.launch();
        else if (!m.running && Session.status() !== 'stopped') Session.stop();
      }
    });
  }

  window.Modules = {
    GAME, CATEGORIES, category, list, get, isEnabled, enabledIds, setEnabled, toggle,
    settings, setSetting, resetSettings, bind, setBind, hotkeyOwner, APP_BINDS,
    profiles, activeProfile, applyProfile, saveProfile, updateProfile, deleteProfile, profileMatches,
    logs: () => logs, log, Session,
    on: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
  };
})();
