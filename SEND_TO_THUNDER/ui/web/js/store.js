/* Tiny persisted settings store with change subscriptions. */
(function () {
  'use strict';

  const KEY = 'app.settings.v3';

  const defaults = {
    // sound
    soundEnabled: true,
    soundVolume: 60,
    soundHover: false,
    // appearance: theme
    theme: 'dark',
    customThemes: [],
    customColors: {},
    customLayout: {},
    customCss: '',
    appFont: 'segoe-var',
    syntaxTheme: 'synapse',
    customSyntax: {},
    interfaceGrid: false,
    colorfulIcons: false,
    macButtons: false,
    showVersion: false,
    showBrandText: true,
    solidWhenFocused: false,
    panelDepth: 100,
    // appearance: music
    musicSource: 'file',
    musicUrl: '',
    musicVolume: 50,
    musicOnlyFocused: false,
    musicVisualizer: true,
    // appearance: animation
    animations: true,
    animSpeed: 1,
    animStyle: 'smooth',
    buttonSound: 'click',
    // appearance: navigation / layout
    topBarStyle: 'icon',
    startupTab: 'last',
    navbarPosition: 'top',
    savedThemes: [],
    // appearance: window
    borderThickness: 1,
    borderColor: '',            // empty = theme accent
    rainbowBorder: false,
    background: 'none',         // none | real
    watermark: false,
    windowOpacity: 100,
    cornerRadius: 12,
    reduceMotion: false,
    sidebarCollapsed: false,
    // window
    alwaysOnTop: false,
    rememberPosition: true,
    minimizeToTray: false,
    launchMaximized: false,
    // game
    gamePath: '',
    autoDetect: true,
    autoStartModules: true,
    minimizeOnLaunch: false,
    overlaysEnabled: true,
    overlaysHideUnfocused: true,
    // behavior
    notifications: true,
    confirmClose: true,
    closeToTray: false,
    startWithWindows: false,
    autoUpdate: true,
    // modules: { [id]: { enabled, bind, settings } }, see js/modules.js
    modules: {},
    profiles: [],
    activeProfile: 'default',
    // misc
    lastPage: 'home',
    lastHomeSub: 'overview',
    lastModulesSub: 'all',
    lastProfilesSub: 'all',
    lastSettingsSub: 'game',
    keybinds: {
      launchGame: 'Ctrl+L',
      openModules: 'Ctrl+M',
      disableAll: 'Ctrl+Shift+D',
      toggleSidebar: 'Ctrl+B',
      search: 'Ctrl+K',
    },
  };

  let data = { ...defaults };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      data = { ...defaults, ...parsed, keybinds: { ...defaults.keybinds, ...(parsed.keybinds || {}) } };
    }
  } catch (e) { /* fresh defaults */ }

  const subs = new Map();
  let saveTimer = null;

  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* ignore */ }
    }, 120);
  }

  function get(k) { return data[k]; }
  function set(k, v) {
    if (data[k] === v) return;
    data[k] = v;
    save();
    (subs.get(k) || []).forEach((fn) => fn(v, k));
    (subs.get('*') || []).forEach((fn) => fn(v, k));
  }
  function on(k, fn) {
    if (!subs.has(k)) subs.set(k, []);
    subs.get(k).push(fn);
    return () => { const a = subs.get(k); const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); };
  }
  function reset() {
    data = { ...defaults };
    save();
    Object.keys(data).forEach((k) => (subs.get(k) || []).forEach((fn) => fn(data[k], k)));
  }
  function all() { return { ...data }; }

  window.Store = { get, set, on, reset, all, defaults };
})();
