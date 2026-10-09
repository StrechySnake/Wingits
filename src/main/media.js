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
    child.stderr.on('data', () => {});
    child.on('error', () => {});
    child.on('exit', () => {
      this.proc = null;
      this.state = { active: false, supported: true };
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
  }

  send(cmd, arg) {
    if (!this.proc || !this.proc.stdin.writable) return;
    if (!['toggle', 'next', 'prev', 'seek'].includes(cmd)) return;
    this.proc.stdin.write(cmd + (cmd === 'seek' ? ' ' + Number(arg || 0) : '') + '\n');
  }

  stop() {
    this.wanted = false;
    if (this.proc) { try { this.proc.stdin.end(); this.proc.kill(); } catch {} this.proc = null; }
    this.state = { active: false, supported: this.supported() };
  }
}

module.exports = { Media };
