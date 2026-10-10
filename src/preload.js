const { contextBridge, ipcRenderer } = require('electron');

const invoke = (ch, ...a) => ipcRenderer.invoke(ch, ...a);

contextBridge.exposeInMainWorld('wingits', {
  getState: () => invoke('state:get'),
  onState: (cb) => {
    const h = (_e, s) => cb(s);
    ipcRenderer.on('state', h);
    return () => ipcRenderer.removeListener('state', h);
  },

  setSettings: (p) => invoke('settings:set', p),
  setWidgetsVisible: (v) => invoke('widgets:setVisible', v),

  addWidget: (type, x, y) => invoke('widget:add', type, x, y),
  removeWidget: (id) => invoke('widget:remove', id),
  moveWidget: (id, x, y) => ipcRenderer.send('widget:moveTo', id, x, y),
  setInst: (id, patch) => invoke('inst:set', id, patch),

  addTask: (t) => invoke('tasks:add', t),
  toggleTask: (id) => invoke('tasks:toggle', id),
  removeTask: (id) => invoke('tasks:remove', id),
  clearDone: () => invoke('tasks:clearDone'),
  setPet: (p) => invoke('pet:set', p),

  getWeather: () => invoke('weather:get'),
  getStats: () => invoke('sys:stats'),
  getScreen: () => invoke('screen:info'),

  getMedia: () => invoke('media:get'),
  onMedia: (cb) => {
    const h = (_e, s) => cb(s);
    ipcRenderer.on('media', h);
    return () => ipcRenderer.removeListener('media', h);
  },
  onMediaArt: (cb) => {
    const h = (_e, a) => cb(a);
    ipcRenderer.on('media-art', h);
    return () => ipcRenderer.removeListener('media-art', h);
  },
  resizeWidget: (id, scale) => invoke('widget:resize', id, scale),

  devEnable: (on) => invoke('dev:enable', on),
  devSet: (patch) => invoke('dev:set', patch),
  devPulse: (name) => invoke('dev:pulse', name),
  devSetLevel: (l) => invoke('dev:setLevel', l),
  devTasks: (a) => invoke('dev:tasks', a),

  onTimerBar: (cb) => { ipcRenderer.on('timerbar', (_e, s) => cb(s)); },
  timerBarCmd: (c) => ipcRenderer.send('timerbar:cmd', c),
  getWallpaper: () => invoke('wallpaper:get'),
  getUpdate: () => invoke('update:get'),
  checkUpdate: () => invoke('update:check'),
  installUpdate: () => invoke('update:install'),
  setUpdateToken: (t) => invoke('update:setToken', t),
  openUpdate: () => invoke('update:open'),
  onUpdate: (cb) => {
    const h = (_e, i) => cb(i);
    ipcRenderer.on('update', h);
    return () => ipcRenderer.removeListener('update', h);
  },

  minimize: () => invoke('dash:minimize'),
  quit: () => invoke('app:quit'),
});
