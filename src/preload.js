const { contextBridge, ipcRenderer, webUtils } = require('electron');

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

  pickMusic: () => invoke('media:pick'),
  mediaMeta: (f) => invoke('media:meta', f),
  pathForFile: (f) => webUtils.getPathForFile(f),

  minimize: () => invoke('dash:minimize'),
  quit: () => invoke('app:quit'),
});
