const { app, BrowserWindow, Tray, Menu, ipcMain, screen, nativeImage, shell, session, desktopCapturer } = require('electron');
const path = require('path');
const { Store } = require('./store');
const { Media } = require('./media');
const { createStats } = require('./sysstats');
const REG = require('../shared/registry');
const { XP_PER_TASK } = require('../shared/progress');

const PRELOAD = path.join(__dirname, '..', 'preload.js');
const RENDERER = path.join(__dirname, '..', 'renderer');
const ICON = path.join(__dirname, '..', '..', 'build', 'icon.png');
const DASH_W = 1072, DASH_H = 700; // includes the transparent shadow margin

if (!app.requestSingleInstanceLock()) { app.quit(); process.exit(0); }

let store, stats, tray, dashboard, media;
let quitting = false;
const widgetWins = new Map(); // id -> BrowserWindow

const uid = () => Math.random().toString(36).slice(2, 10);
const S = () => store.state;

/* ---------- broadcasting ---------- */

function sendTo(win, channel, payload) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}
/** 'data' changes go to every window; 'layout' changes only matter to the dashboard. */
function emit(kind = 'data') {
  store.save();
  if (kind === 'data') {
    for (const w of widgetWins.values()) sendTo(w, 'state', S());
  }
  sendTo(dashboard, 'state', S());
}

/* ---------- windows ---------- */

function secureWebContents(win) {
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e) => e.preventDefault());
}

function clampToDisplays(x, y, w, h) {
  const d = screen.getDisplayMatching({ x, y, width: w, height: h }).workArea;
  return {
    x: Math.round(Math.min(Math.max(x, d.x - w + 60), d.x + d.width - 60)),
    y: Math.round(Math.min(Math.max(y, d.y), d.y + d.height - 60)),
  };
}

function createWidgetWindow(w) {
  const def = REG.widgets[w.type];
  if (!def || widgetWins.has(w.id)) return;
  const scale = REG.clampScale(w.type, w.scale || 1);
  const { width, height } = REG.windowSize(w.type, scale);
  const pos = clampToDisplays(w.x, w.y, width, height);
  const win = new BrowserWindow({
    ...pos, width, height,
    frame: false, transparent: true, backgroundColor: '#00000000',
    resizable: false, maximizable: false, minimizable: false, fullscreenable: false,
    hasShadow: false, skipTaskbar: true, show: false,
    alwaysOnTop: S().settings.alwaysOnTop,
    webPreferences: { preload: PRELOAD, sandbox: true, contextIsolation: true, nodeIntegration: false },
  });
  win.setMenu(null);
  win._wtype = w.type;
  secureWebContents(win);
  win.loadFile(path.join(RENDERER, 'widgets', 'widget.html'), { query: { id: w.id, type: w.type } });
  if (w.type === 'music') {
    // getDisplayMedia (system-audio loopback for the visualizer) needs a user gesture; grant one.
    win.webContents.once('did-finish-load', () =>
      win.webContents.executeJavaScript('window.__startCapture && window.__startCapture()', true).catch(() => {}));
  }
  win.once('ready-to-show', () => { if (S().settings.widgetsVisible) win.showInactive(); });

  let t;
  win.on('move', () => {
    clearTimeout(t);
    t = setTimeout(() => {
      if (win.isDestroyed()) return;
      const [x, y] = win.getPosition();
      const rec = S().widgets.find((q) => q.id === w.id);
      if (rec && (rec.x !== x || rec.y !== y)) { rec.x = x; rec.y = y; emit('layout'); }
    }, 160);
  });
  win.on('closed', () => widgetWins.delete(w.id));
  widgetWins.set(w.id, win);
  syncMedia();
}

function addWidget(type, x, y) {
  const def = REG.widgets[type];
  if (!def) return null;
  if (def.single && S().widgets.some((q) => q.type === type)) return null;
  const rec = { id: uid(), type, x: Math.round(x), y: Math.round(y) };
  S().widgets.push(rec);
  createWidgetWindow(rec);
  emit('layout');
  return rec.id;
}

function removeWidget(id) {
  const i = S().widgets.findIndex((q) => q.id === id);
  if (i < 0) return;
  S().widgets.splice(i, 1);
  delete S().inst[id];
  const win = widgetWins.get(id);
  widgetWins.delete(id);
  if (win && !win.isDestroyed()) win.destroy();
  syncMedia();
  emit('layout');
}

function musicWindows() {
  return [...widgetWins.values()].filter((w) => w._wtype === 'music' && !w.isDestroyed());
}
/** Run the media helper only while a Now Playing widget exists. */
function syncMedia() {
  if (!media) return;
  if (musicWindows().length) media.start(); else media.stop();
}

function setWidgetsVisible(visible) {
  S().settings.widgetsVisible = visible;
  for (const w of widgetWins.values()) visible ? w.showInactive() : w.hide();
  refreshTray();
  emit('data');
}

function createDashboard() {
  dashboard = new BrowserWindow({
    width: DASH_W, height: DASH_H,
    frame: false, transparent: true, backgroundColor: '#00000000',
    resizable: false, maximizable: false, hasShadow: false, show: false,
    title: 'Wingits', icon: ICON,
    webPreferences: { preload: PRELOAD, sandbox: true, contextIsolation: true, nodeIntegration: false },
  });
  dashboard.setMenu(null);
  secureWebContents(dashboard);
  dashboard.loadFile(path.join(RENDERER, 'dashboard', 'index.html'));
  dashboard.once('ready-to-show', () => dashboard.show());
  dashboard.on('close', (e) => { if (!quitting) { e.preventDefault(); dashboard.hide(); } });
}

function showDashboard() {
  if (!dashboard || dashboard.isDestroyed()) createDashboard();
  else { dashboard.show(); dashboard.focus(); }
}

/* ---------- tray ---------- */

function refreshTray() {
  if (!tray) return;
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open Wingits', click: showDashboard },
    { label: S().settings.widgetsVisible ? 'Hide widgets' : 'Show widgets', click: () => setWidgetsVisible(!S().settings.widgetsVisible) },
    { type: 'separator' },
    { label: 'Quit', click: () => { quitting = true; app.quit(); } },
  ]));
}

function createTray() {
  const img = nativeImage.createFromPath(ICON);
  tray = new Tray(img.isEmpty() ? nativeImage.createEmpty() : img.resize({ width: 16, height: 16 }));
  tray.setToolTip('Wingits');
  tray.on('click', showDashboard);
  refreshTray();
}

/* ---------- weather ---------- */

const weatherCache = { key: '', at: 0, data: null };

async function getJSON(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

async function fetchWeather() {
  const { city, units } = S().settings;
  const key = `${city}|${units}`;
  if (weatherCache.key === key && Date.now() - weatherCache.at < 10 * 60 * 1000) return weatherCache.data;
  try {
    let lat, lon, name;
    if (city.trim()) {
      const g = await getJSON(`https://geocoding-api.open-meteo.com/v1/search?count=1&name=${encodeURIComponent(city.trim())}`);
      const r = g.results && g.results[0];
      if (!r) return { error: `Couldn't find “${city.trim()}”` };
      ({ latitude: lat, longitude: lon, name } = r);
    } else {
      const ip = await getJSON('https://ipwho.is/');
      if (!ip.success) throw new Error('ip lookup failed');
      ({ latitude: lat, longitude: lon, city: name } = ip);
    }
    const f = units === 'f' ? '&temperature_unit=fahrenheit&wind_speed_unit=mph' : '';
    const w = await getJSON(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&timezone=auto${f}` +
      '&current=temperature_2m,apparent_temperature,weather_code,is_day,wind_speed_10m,relative_humidity_2m' +
      '&daily=temperature_2m_max,temperature_2m_min&forecast_days=1');
    const data = {
      city: name,
      temp: w.current.temperature_2m,
      feels: w.current.apparent_temperature,
      code: w.current.weather_code,
      isDay: !!w.current.is_day,
      wind: w.current.wind_speed_10m,
      humidity: w.current.relative_humidity_2m,
      hi: w.daily.temperature_2m_max[0],
      lo: w.daily.temperature_2m_min[0],
    };
    Object.assign(weatherCache, { key, at: Date.now(), data });
    return data;
  } catch (e) {
    return weatherCache.data && weatherCache.key === key ? weatherCache.data : { error: 'Offline — retrying soon' };
  }
}

/* ---------- IPC ---------- */

function applySettings(patch) {
  const s = S().settings;
  Object.assign(s, patch);
  if ('alwaysOnTop' in patch) for (const w of widgetWins.values()) w.setAlwaysOnTop(!!s.alwaysOnTop, 'floating');
  if ('launchAtLogin' in patch && app.isPackaged) app.setLoginItemSettings({ openAtLogin: !!s.launchAtLogin });
  if ('city' in patch || 'units' in patch) weatherCache.at = 0;
  emit('data');
}

function registerIpc() {
  ipcMain.handle('state:get', () => S());

  ipcMain.handle('settings:set', (_e, patch) => applySettings(patch || {}));
  ipcMain.handle('widgets:setVisible', (_e, v) => setWidgetsVisible(!!v));

  ipcMain.handle('widget:add', (_e, type, x, y) => addWidget(type, x, y));
  ipcMain.handle('widget:remove', (_e, id) => removeWidget(id));
  ipcMain.on('widget:moveTo', (_e, id, x, y) => {
    const win = widgetWins.get(id);
    const rec = S().widgets.find((q) => q.id === id);
    if (!win || !rec) return;
    const b = win.getBounds();
    win.setBounds({ x: Math.round(x), y: Math.round(y), width: b.width, height: b.height });
  });

  ipcMain.handle('inst:set', (_e, id, patch) => {
    if (!S().widgets.some((q) => q.id === id)) return;
    S().inst[id] = { ...(S().inst[id] || {}), ...patch };
    emit('data');
  });

  ipcMain.handle('tasks:add', (_e, text) => {
    text = String(text || '').trim().slice(0, 140);
    if (!text) return;
    S().tasks.push({ id: uid(), text, done: false, rewarded: false });
    emit('data');
  });
  ipcMain.handle('tasks:toggle', (_e, id) => {
    const t = S().tasks.find((q) => q.id === id);
    if (!t) return { gained: 0 };
    t.done = !t.done;
    let gained = 0;
    if (t.done && !t.rewarded) { // each task pays out XP once, so un-checking can't be farmed
      t.rewarded = true;
      gained = XP_PER_TASK;
      S().pet.xp += gained;
      S().pet.lastGain = Date.now();
    }
    emit('data');
    return { gained };
  });
  ipcMain.handle('tasks:remove', (_e, id) => {
    S().tasks = S().tasks.filter((q) => q.id !== id);
    emit('data');
  });
  ipcMain.handle('tasks:clearDone', () => {
    S().tasks = S().tasks.filter((q) => !q.done);
    emit('data');
  });

  ipcMain.handle('pet:set', (_e, patch) => {
    const p = S().pet;
    if (patch.kind && ['cat', 'slime', 'plant'].includes(patch.kind)) p.kind = patch.kind;
    if (typeof patch.name === 'string') p.name = patch.name.trim().slice(0, 16) || p.name;
    emit('data');
  });

  ipcMain.handle('weather:get', () => fetchWeather());
  ipcMain.handle('sys:stats', () => stats.get());
  ipcMain.handle('screen:info', () => {
    const d = screen.getPrimaryDisplay();
    return { bounds: d.workArea, full: d.bounds };
  });

  ipcMain.handle('media:get', () => ({ state: media.state, art: media.art }));
  ipcMain.handle('media:cmd', (_e, cmd, arg) => media.send(cmd, arg));

  ipcMain.handle('widget:resize', (_e, id, scale) => {
    const rec = S().widgets.find((q) => q.id === id);
    const win = widgetWins.get(id);
    if (!rec || !win) return;
    rec.scale = REG.clampScale(rec.type, scale);
    const b = win.getBounds();
    const { width, height } = REG.windowSize(rec.type, rec.scale);
    win.setBounds({ x: b.x, y: b.y, width, height });
    emit('layout');
  });

  ipcMain.handle('dash:minimize', () => dashboard?.hide());
  ipcMain.handle('dash:open', () => showDashboard());
  ipcMain.handle('app:quit', () => { quitting = true; app.quit(); });
}

/* ---------- boot ---------- */

function seedFirstRun() {
  if (S().seeded) return;
  const d = screen.getPrimaryDisplay().workArea;
  const right = d.x + d.width;
  const mk = (type, x, y) => S().widgets.push({ id: uid(), type, x: Math.round(x), y: Math.round(y) });
  const w = (t) => REG.widgets[t].w + REG.PAD * 2;
  mk('clock', right - w('clock') - 24, d.y + 20);
  mk('tasks', right - w('tasks') - 24, d.y + 190);
  mk('pet', right - w('tasks') - 24 - w('pet') - 8, d.y + 330);
  S().seeded = true;
  store.save();
}

app.whenReady().then(() => {
  app.setAppUserModelId('com.wingits.app');
  store = new Store(app.getPath('userData'));
  stats = createStats();
  media = new Media();
  media.on('state', (st) => musicWindows().forEach((w) => sendTo(w, 'media', st)));
  media.on('art', (a) => musicWindows().forEach((w) => sendTo(w, 'media-art', a)));
  // System-audio loopback powers the visualizer in the Now Playing widget.
  session.defaultSession.setDisplayMediaRequestHandler((_req, cb) => {
    desktopCapturer.getSources({ types: ['screen'] })
      .then((sources) => cb({ video: sources[0], audio: 'loopback' }))
      .catch(() => cb({}));
  });
  registerIpc();
  seedFirstRun();
  for (const w of S().widgets) createWidgetWindow(w);
  createTray();
  createDashboard();
});

app.on('second-instance', showDashboard);
app.on('before-quit', () => { quitting = true; media?.stop(); store?.flush(); });
app.on('window-all-closed', (e) => { if (!quitting) e.preventDefault(); });
