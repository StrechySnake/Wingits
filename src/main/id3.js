/* Tiny ID3v2 reader (title / artist / album / cover art) for the music widget. */
const fs = require('fs');
const path = require('path');

const MAX_TAG = 20 * 1024 * 1024;

function syncsafe(b, o) { return (b[o] << 21) | (b[o + 1] << 14) | (b[o + 2] << 7) | b[o + 3]; }

function decode(buf, enc) {
  if (!buf.length) return '';
  let s;
  if (enc === 1 || enc === 2) {
    let b = buf, be = enc === 2;
    if (b[0] === 0xff && b[1] === 0xfe) { b = b.subarray(2); be = false; }
    else if (b[0] === 0xfe && b[1] === 0xff) { b = b.subarray(2); be = true; }
    if (be) { b = Buffer.from(b); b.swap16(); }
    s = b.toString('utf16le');
  } else s = buf.toString(enc === 3 ? 'utf8' : 'latin1');
  return s.replace(/\0+$/g, '').replace(/\0/g, ' / ').trim();
}

function nullIndex(buf, from, wide) {
  for (let i = from; i < buf.length - (wide ? 1 : 0); i += wide ? 2 : 1) {
    if (buf[i] === 0 && (!wide || buf[i + 1] === 0)) return i;
  }
  return -1;
}

function parseApic(data) {
  const enc = data[0];
  const mimeEnd = nullIndex(data, 1, false);
  if (mimeEnd < 0) return null;
  let mime = data.subarray(1, mimeEnd).toString('latin1') || 'image/jpeg';
  if (!mime.includes('/')) mime = 'image/' + mime.toLowerCase();
  const wide = enc === 1 || enc === 2;
  const descEnd = nullIndex(data, mimeEnd + 2, wide);
  if (descEnd < 0) return null;
  const img = data.subarray(descEnd + (wide ? 2 : 1));
  if (!img.length) return null;
  return `data:${mime};base64,${img.toString('base64')}`;
}

function readTags(file) {
  const meta = { path: file, title: path.parse(file).name, artist: '', album: '', art: null };
  let fd;
  try {
    fd = fs.openSync(file, 'r');
    const head = Buffer.alloc(10);
    fs.readSync(fd, head, 0, 10, 0);
    if (head.toString('latin1', 0, 3) !== 'ID3') return meta;
    const ver = head[3];
    if (ver !== 3 && ver !== 4) return meta;
    const size = Math.min(syncsafe(head, 6), MAX_TAG);
    const buf = Buffer.alloc(size);
    fs.readSync(fd, buf, 0, size, 10);

    let o = 0;
    // skip extended header if present
    if (head[5] & 0x40) o += ver === 4 ? syncsafe(buf, 0) : buf.readUInt32BE(0) + 4;

    while (o + 10 <= buf.length) {
      const id = buf.toString('latin1', o, o + 4);
      if (!/^[A-Z0-9]{4}$/.test(id)) break;
      const len = ver === 4 ? syncsafe(buf, o + 4) : buf.readUInt32BE(o + 4);
      const body = buf.subarray(o + 10, o + 10 + len);
      o += 10 + len;
      if (!body.length) continue;
      if (id === 'TIT2') meta.title = decode(body.subarray(1), body[0]) || meta.title;
      else if (id === 'TPE1') meta.artist = decode(body.subarray(1), body[0]);
      else if (id === 'TALB') meta.album = decode(body.subarray(1), body[0]);
      else if (id === 'APIC' && !meta.art) meta.art = parseApic(body);
    }
  } catch { /* unreadable tags: fall back to filename */ }
  finally { if (fd !== undefined) try { fs.closeSync(fd); } catch {} }
  return meta;
}

module.exports = { readTags };
