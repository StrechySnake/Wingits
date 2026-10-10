/* Finds the desktop wallpaper so widgets can show a blurred copy of it behind their glass. */
const { nativeImage, screen } = require('electron');
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

const STYLES = { 0: 'center', 2: 'stretch', 6: 'fit', 10: 'fill', 22: 'span' };
let cache = { key: '', value: null, at: 0 };

function regQuery(name) {
  return new Promise((resolve) => {
    execFile('reg', ['query', 'HKCU\\Control Panel\\Desktop', '/v', name], { windowsHide: true, timeout: 4000 }, (err, out) => {
      const m = !err && new RegExp(name + '\\s+REG_\\w+\\s+(.*)', 'i').exec(String(out));
      resolve(m ? m[1].trim() : '');
    });
  });
}

async function locate() {
  if (process.env.WINGITS_WALLPAPER) return { file: process.env.WINGITS_WALLPAPER, style: process.env.WINGITS_WALLPAPER_STYLE || 'fill' };
  if (process.platform !== 'win32') return null;
  const [wall, style, tile] = await Promise.all([regQuery('WallPaper'), regQuery('WallpaperStyle'), regQuery('TileWallpaper')]);
  let file = wall && fs.existsSync(wall) ? wall : '';
  if (!file) {   // slideshows and some themes only keep the transcoded copy
    const t = path.join(process.env.APPDATA || '', 'Microsoft', 'Windows', 'Themes', 'TranscodedWallpaper');
    if (fs.existsSync(t)) file = t;
  }
  if (!file) return null;
  return { file, style: tile === '1' ? 'fill' : STYLES[parseInt(style, 10)] || 'fill' };
}

/** { url, w, h, style, displays } or null. The image is shrunk first: it only ever gets blurred. */
async function getWallpaper() {
  const found = await locate();
  if (!found) return null;
  let mtime = 0;
  try { mtime = fs.statSync(found.file).mtimeMs; } catch { return null; }
  const displays = screen.getAllDisplays().map((d) => ({ ...d.bounds, scaleFactor: d.scaleFactor }));
  const key = `${found.file}|${mtime}|${found.style}`;
  if (cache.key !== key) {
    const img = nativeImage.createFromPath(found.file);
    if (img.isEmpty()) return null;
    const { width, height } = img.getSize();
    const small = img.resize({ width: Math.min(960, width), quality: 'good' });
    cache = { key, value: { url: 'data:image/jpeg;base64,' + small.toJPEG(78).toString('base64'), w: width, h: height, style: found.style }, at: Date.now() };
  }
  return { ...cache.value, displays };
}

module.exports = { getWallpaper };
