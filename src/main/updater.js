/* Checks GitHub for a newer release of Wingits. */
const { EventEmitter } = require('events');

const REPO = 'StrechySnake/Wingits';
const CHECK_EVERY_MS = 5 * 60 * 60 * 1000; // 5 hours

/** Compare dotted versions ("v1.2.3" or "1.2.3"): >0 if a is newer than b. */
function compareVersions(a, b) {
  const pa = String(a).replace(/^v/i, '').split('-')[0].split('.').map((n) => parseInt(n, 10) || 0);
  const pb = String(b).replace(/^v/i, '').split('-')[0].split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length, 3); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
}

class Updater extends EventEmitter {
  constructor(currentVersion) {
    super();
    this.current = currentVersion;
    this.timer = null;
    // status: 'idle' | 'checking' | 'up-to-date' | 'available' | 'error'
    this.info = { status: 'idle', current: currentVersion, latest: null, url: null, checkedAt: 0 };
  }

  set(patch) {
    this.info = { ...this.info, ...patch };
    this.emit('change', this.info);
  }

  async check() {
    if (this.info.status === 'checking') return this.info;
    this.set({ status: 'checking' });
    try {
      const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
        headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Wingits-updater' },
        signal: AbortSignal.timeout(15000),
      });
      if (res.status === 404) { // no published release yet
        this.set({ status: 'up-to-date', checkedAt: Date.now() });
      } else if (!res.ok) {
        throw new Error('HTTP ' + res.status);
      } else {
        const rel = await res.json();
        const latest = String(rel.tag_name || '').replace(/^v/i, '');
        const newer = latest && compareVersions(latest, this.current) > 0;
        this.set({
          status: newer ? 'available' : 'up-to-date',
          latest: latest || null,
          url: rel.html_url || `https://github.com/${REPO}/releases/latest`,
          checkedAt: Date.now(),
        });
      }
    } catch {
      this.set({ status: 'error', checkedAt: Date.now() });
    }
    return this.info;
  }

  /** Check now, then every 5 hours while `enabled()` is true. */
  startSchedule(enabled) {
    clearInterval(this.timer);
    const run = () => { if (enabled()) this.check(); };
    setTimeout(run, 4000); // shortly after launch
    this.timer = setInterval(run, CHECK_EVERY_MS);
    this.timer.unref?.();
  }
}

module.exports = { Updater, compareVersions, REPO };
