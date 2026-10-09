/* Bridges Windows' System Media Transport Controls (what's playing in Spotify, browsers, VLC, ...)
 * to the main process through a small PowerShell helper that only runs while a music widget exists. */
const { spawn } = require('child_process');
const { EventEmitter } = require('events');
const fs = require('fs');
const os = require('os');
const path = require('path');

class Media extends EventEmitter {
  constructor() {
    super();
    this.proc = null;
    this.wanted = false;
    this.state = { active: false, supported: this.supported() };
    this.art = null; // { key, art }
    this.restartDelay = 1000;
    this.noArt = new Map();   // key -> consecutive updates without artwork
    this.lookedUp = new Set();
  }

  // WINGITS_MEDIA_HELPER lets tests substitute a fake helper script.
  supported() { return process.platform === 'win32' || !!process.env.WINGITS_MEDIA_HELPER; }

  start() {
    this.wanted = true;
    if (this.proc || !this.supported()) return;
    let child;
    if (process.env.WINGITS_MEDIA_HELPER) {
      child = spawn(process.env.WINGITS_MEDIA_HELPER_RUNNER || 'node', [process.env.WINGITS_MEDIA_HELPER]);
    } else {
      // Copy out of the asar archive so PowerShell can read it.
      const script = path.join(os.tmpdir(), 'wingits-media-helper.ps1');
      fs.writeFileSync(script, fs.readFileSync(path.join(__dirname, 'media-helper.ps1')));
      child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script], { windowsHide: true });
    }
    this.proc = child;

    let buf = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      buf += chunk;
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (line) this.handleLine(line);
      }
    });
    let stderr = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (d) => { stderr = (stderr + d).slice(-400); });
    child.on('error', (e) => { stderr = `Could not start the media helper: ${e.message}`; });
    child.on('exit', (code) => {
      this.proc = null;
      // Keep any error the helper itself reported; otherwise surface what it printed on stderr.
      const error = this.state.error || stderr.trim().split('\n')[0] || (code ? `Media helper exited (code ${code})` : '');
      this.state = { active: false, supported: true, error: error || undefined };
      this.emit('state', this.state);
      if (this.wanted) {
        setTimeout(() => this.wanted && this.start(), this.restartDelay);
        this.restartDelay = Math.min(this.restartDelay * 2, 15000);
      }
    });
  }

  handleLine(line) {
    let msg;
    try { msg = JSON.parse(line); } catch { return; }
    this.restartDelay = 1000;
    const { art, ...rest } = msg;
    if (art && msg.key) { this.art = { key: msg.key, art }; this.emit('art', this.art); }
    this.state = { ...rest, supported: true };
    this.emit('state', this.state);
    this.maybeLookupArt(msg);
  }

  /** Players sometimes expose no thumbnail; fall back to the iTunes Search artwork for artist + title. */
  maybeLookupArt(msg) {
    if (!msg.active || !msg.key || !msg.title || !msg.artist) return;
    if (this.art && this.art.key === msg.key) return;
    if (this.lookedUp.has(msg.key)) return;
    const n = (this.noArt.get(msg.key) || 0) + 1;
    this.noArt.set(msg.key, n);
    if (n < 4) return; // give the player ~4s to supply its own artwork first
    this.lookedUp.add(msg.key);
    if (this.lookedUp.size > 50) this.lookedUp.delete(this.lookedUp.values().next().value);
    this.lookupArt(msg).catch(() => {});
  }

  async lookupArt(msg) {
    const term = encodeURIComponent(`${msg.artist} ${msg.title}`);
    const r = await fetch(`https://itunes.apple.com/search?term=${term}&media=music&entity=song&limit=1`, { signal: AbortSignal.timeout(10000) });
    if (!r.ok) return;
    const url = ((await r.json()).results || [])[0]?.artworkUrl100;
    if (!url) return;
    const img = await fetch(url.replace(/\/\d+x\d+(bb)?\./, '/600x600bb.'), { signal: AbortSignal.timeout(10000) });
    if (!img.ok) return;
    const mime = img.headers.get('content-type') || 'image/jpeg';
    const art = `data:${mime};base64,${Buffer.from(await img.arrayBuffer()).toString('base64')}`;
    if (this.state.key === msg.key) { // still the same track
      this.art = { key: msg.key, art };
      this.emit('art', this.art);
    }
  }

  stop() {
    this.wanted = false;
    if (this.proc) { try { this.proc.stdin.end(); this.proc.kill(); } catch {} this.proc = null; }
    this.state = { active: false, supported: this.supported() };
  }
}

module.exports = { Media };
