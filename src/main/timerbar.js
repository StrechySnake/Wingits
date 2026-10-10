/* A tiny always-on-top pill at the bottom of the screen that mirrors a running Pomodoro timer.
 * It reads the Pomodoro widget's saved data, so it needs no state of its own beyond "dismissed". */
const { BrowserWindow, screen } = require('electron');
const path = require('path');

const MODE_MIN = { focus: 25, short: 5, long: 15 };
const WIN_W = 300, WIN_H = 64, MARGIN = 8;

class TimerBar {
  /** @param h { preload, page, getState, getDev, setInst, enabled } */
  constructor(h) {
    this.h = h;
    this.win = null;
    this.dismissed = false;
    this.lastEndsAt = 0;
    this.lastKey = '';
  }

  total(mode) { return (this.h.getDev().fastTimers ? 10 : MODE_MIN[mode] || 25) * (this.h.getDev().fastTimers ? 1000 : 60000); }

  /** The Pomodoro instance to show, or null when nothing is in progress. */
  current() {
    const s = this.h.getState();
    const w = s.widgets.find((q) => q.type === 'pomodoro');
    if (!w) return null;
    const d = s.inst[w.id] || {};
    const mode = MODE_MIN[d.mode] ? d.mode : 'focus';
    const total = this.total(mode);
    const running = !!d.running;
    const remaining = d.remaining ?? total;
    if (!running && !(remaining < total)) return null;     // idle at full length = no timer set
    return { id: w.id, mode, running, endsAt: d.endsAt || 0, remaining, total };
  }

  /** Call whenever widget data or settings change. */
  sync() {
    const cur = this.h.enabled() ? this.current() : null;
    if (cur && cur.running && cur.endsAt !== this.lastEndsAt) { this.dismissed = false; this.lastEndsAt = cur.endsAt; }   // a fresh start brings the bar back
    if (!cur) { this.dismissed = false; this.lastEndsAt = 0; }
    if (!cur || this.dismissed) return this.hide();
    this.show();
    const key = JSON.stringify(cur);
    if (key !== this.lastKey) { this.lastKey = key; this.send(cur); }
  }

  send(cur) {
    if (this.win && !this.win.isDestroyed()) this.win.webContents.send('timerbar', cur);
  }

  ensure() {
    if (this.win && !this.win.isDestroyed()) return;
    const win = new BrowserWindow({
      width: WIN_W, height: WIN_H, frame: false, transparent: true, backgroundColor: '#00000000',
      resizable: false, maximizable: false, minimizable: false, fullscreenable: false, focusable: false,
      hasShadow: false, skipTaskbar: true, show: false, alwaysOnTop: true,
      webPreferences: { preload: this.h.preload, sandbox: true, contextIsolation: true, nodeIntegration: false },
    });
    win.setMenu(null);
    win.setAlwaysOnTop(true, 'screen-saver');
    win.setIgnoreMouseEvents(true, { forward: true });      // clicks pass through everywhere except the pill itself
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.webContents.on('will-navigate', (e) => e.preventDefault());
    win.loadFile(this.h.page);
    win.webContents.once('did-finish-load', () => { this.ready = true; this.lastKey = ''; this.sync(); });
    win.on('closed', () => { this.win = null; this.ready = false; });
    this.win = win;
    this.ready = false;
  }

  place() {
    if (!this.win || this.win.isDestroyed()) return;
    const d = screen.getPrimaryDisplay().workArea;
    this.win.setBounds({ x: Math.round(d.x + (d.width - WIN_W) / 2), y: Math.round(d.y + d.height - WIN_H - MARGIN), width: WIN_W, height: WIN_H });
  }

  show() {
    this.ensure();
    this.place();
    if (this.ready && !this.win.isVisible()) this.win.showInactive();
  }

  hide() {
    this.lastKey = '';
    if (this.win && !this.win.isDestroyed() && this.win.isVisible()) this.win.hide();
  }

  /** Commands coming from the pill. */
  command(cmd) {
    const cur = this.current();
    if (cmd === 'close') { this.dismissed = true; return this.sync(); }
    if (cmd === 'mouse-in' || cmd === 'mouse-out') { this.win?.setIgnoreMouseEvents(cmd === 'mouse-out', { forward: true }); return; }
    if (!cur) return;
    if (cmd === 'toggle') {
      if (cur.running) this.h.setInst(cur.id, { running: false, endsAt: 0, remaining: Math.max(0, cur.endsAt - Date.now()) });
      else this.h.setInst(cur.id, { running: true, endsAt: Date.now() + cur.remaining });
    } else if (cmd === 'stop') {
      this.h.setInst(cur.id, { running: false, endsAt: 0, remaining: cur.total });
    }
  }

  destroy() { if (this.win && !this.win.isDestroyed()) this.win.destroy(); }
}

module.exports = { TimerBar };
