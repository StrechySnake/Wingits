/* Checks GitHub for a newer release of Wingits and can download + run its installer. */
const { EventEmitter } = require('events');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

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
  /**
   * @param currentVersion  version of the running app
   * @param opts.canInstall whether this build can replace itself (installed Windows build, not portable)
   */
  constructor(currentVersion, opts = {}) {
    super();
    this.current = currentVersion;
    this.canInstall = !!opts.canInstall;
    this.timer = null;
    this.asset = null;
    // status: idle | checking | up-to-date | available | downloading | installing | error
    // reason (when status is error): private | rate | network | download
    this.info = { status: 'idle', current: currentVersion, latest: null, url: null, checkedAt: 0, reason: null, progress: 0, canInstall: this.canInstall };
  }

  set(patch) {
    this.info = { ...this.info, ...patch };
    this.emit('change', this.info);
  }

  headers(extra = {}) {
    return { Accept: 'application/vnd.github+json', 'User-Agent': 'Wingits-updater', ...extra };
  }

  async check() {
    if (['checking', 'downloading', 'installing'].includes(this.info.status)) return this.info;
    this.set({ status: 'checking', reason: null });
    try {
      const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: this.headers(), signal: AbortSignal.timeout(15000) });
      if (res.status === 403 && res.headers.get('x-ratelimit-remaining') === '0') {
        this.set({ status: 'error', reason: 'rate', checkedAt: Date.now() });
      } else if (res.status === 404 || res.status === 401 || res.status === 403) {
        // GitHub answers 404 for a *private* repository to anonymous requests.
        // This used to be mistaken for "no releases yet", which silently disabled updates.
        this.set({ status: 'error', reason: 'private', checkedAt: Date.now() });
      } else if (!res.ok) {
        throw new Error('HTTP ' + res.status);
      } else {
        const rel = await res.json();
        const latest = String(rel.tag_name || '').replace(/^v/i, '');
        const newer = !!latest && compareVersions(latest, this.current) > 0;
        const a = (rel.assets || []).find((x) => /^Wingits-Setup-.*\.exe$/i.test(x.name));
        this.asset = a ? { name: a.name, url: a.url, size: a.size, digest: a.digest || '' } : null;
        this.set({
          status: newer ? 'available' : 'up-to-date',
          latest: latest || null,
          url: rel.html_url || `https://github.com/${REPO}/releases/latest`,
          checkedAt: Date.now(), reason: null,
        });
      }
    } catch {
      this.set({ status: 'error', reason: 'network', checkedAt: Date.now() });
    }
    return this.info;
  }

  /** Download the installer, verify it, then emit 'ready' with its path. */
  async install() {
    if (this.info.status !== 'available' || !this.asset) return;
    const asset = this.asset;
    this.set({ status: 'downloading', progress: 0, reason: null });
    try {
      const dir = path.join(os.tmpdir(), 'wingits-update');
      fs.mkdirSync(dir, { recursive: true });
      const file = path.join(dir, asset.name);
      const res = await fetch(asset.url, { headers: this.headers({ Accept: 'application/octet-stream' }), signal: AbortSignal.timeout(10 * 60 * 1000) });
      if (!res.ok || !res.body) throw new Error('HTTP ' + res.status);
      const total = Number(res.headers.get('content-length')) || asset.size || 0;
      const hash = crypto.createHash('sha256');
      const out = fs.createWriteStream(file);
      let got = 0, lastEmit = 0;
      for await (const chunk of res.body) {
        hash.update(chunk);
        if (!out.write(chunk)) await new Promise((r) => out.once('drain', r));
        got += chunk.length;
        const now = Date.now();
        if (total && now - lastEmit > 150) { lastEmit = now; this.set({ progress: Math.min(1, got / total) }); }
      }
      await new Promise((resolve, reject) => { out.end(resolve); out.on('error', reject); });
      const want = asset.digest.startsWith('sha256:') ? asset.digest.slice(7) : '';
      if (want && hash.digest('hex') !== want) throw new Error('checksum mismatch');
      if (asset.size && got !== asset.size) throw new Error('size mismatch');
      this.set({ status: 'installing', progress: 1 });
      this.emit('ready', file);
    } catch {
      this.set({ status: 'error', reason: 'download', progress: 0 });
    }
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
