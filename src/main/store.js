const fs = require('fs');
const path = require('path');

const DEFAULTS = () => ({
  settings: {
    theme: 'dark',        // 'dark' | 'light'
    opacity: 0.5,         // glass opacity of widget cards
    alwaysOnTop: false,
    launchAtLogin: false,
    units: 'c',           // 'c' | 'f'
    city: '',             // empty = locate by IP
    widgetsVisible: true,
  },
  widgets: [],            // { id, type, x, y }
  tasks: [],              // { id, text, done, rewarded }
  pet: { kind: 'cat', name: 'Mochi', xp: 0, lastGain: 0 },
  inst: {},               // per-widget-instance data, keyed by widget id
  seeded: false,
});

class Store {
  constructor(dir) {
    this.file = path.join(dir, 'wingits-state.json');
    this.state = DEFAULTS();
    this._timer = null;
    this.load();
  }

  load() {
    try {
      const raw = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      const d = DEFAULTS();
      this.state = {
        ...d, ...raw,
        settings: { ...d.settings, ...(raw.settings || {}) },
        pet: { ...d.pet, ...(raw.pet || {}) },
      };
    } catch { /* first run or corrupt file: keep defaults */ }
  }

  save() {
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this.flush(), 250);
  }

  flush() {
    clearTimeout(this._timer);
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      const tmp = this.file + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(this.state, null, 2));
      fs.renameSync(tmp, this.file);
    } catch (e) { console.error('Could not save state', e); }
  }
}

module.exports = { Store };
