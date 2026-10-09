/* Generates build/icon.png (512x512) with no dependencies: a soft gradient squircle with a pair of wings. */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const N = 512, SS = 3;

function sdRoundRect(x, y, cx, cy, hw, hh, r) {
  const qx = Math.abs(x - cx) - hw + r, qy = Math.abs(y - cy) - hh + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}
// rotated ellipse test -> returns <1 inside
function ell(x, y, cx, cy, a, b, ang) {
  const c = Math.cos(ang), s = Math.sin(ang);
  const dx = x - cx, dy = y - cy;
  const u = dx * c + dy * s, v = -dx * s + dy * c;
  return (u * u) / (a * a) + (v * v) / (b * b);
}

function shade(x, y) {
  // returns [r,g,b,a] in 0..1
  const d = sdRoundRect(x, y, N / 2, N / 2, N / 2 - 8, N / 2 - 8, 120);
  if (d > 0) return [0, 0, 0, 0];
  const t = (x + y) / (2 * N);
  let col = [0.44 + 0.56 * t, 0.36 - 0.0 * t + 0.15 * t, 1 - 0.38 * t]; // indigo -> pink
  let a = 1;
  // wings: three feathers per side, mirrored
  const mx = x > N / 2 ? N - x : x;
  // three fanned feathers from a shared anchor, plus a rounded covert on top
  let w = 0;
  const ax = N / 2 - 26, ay = 300;
  for (const [deg, L, B] of [[-42, 200, 27], [-16, 215, 29], [10, 190, 27], [34, 150, 24]]) {
    const th = (deg * Math.PI) / 180;
    const cx = ax - Math.cos(th) * (L / 2), cy = ay + Math.sin(th) * (L / 2);
    // ellipse axis along direction (-cos, sin) => rotation angle = -th mirrored
    if (ell(mx, y, cx, cy, L / 2, B, Math.PI - th) < 1) w = 1;
  }
  if (ell(mx, y, ax - 30, ay - 8, 60, 38, -0.5) < 1) w = 1;
  if (w) col = [1, 1, 1];
  return [...col, a];
}

const raw = Buffer.alloc(N * (N * 4 + 1));
for (let y = 0; y < N; y++) {
  raw[y * (N * 4 + 1)] = 0;
  for (let x = 0; x < N; x++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
      const [pr, pg, pb, pa] = shade(x + (sx + .5) / SS, y + (sy + .5) / SS);
      r += pr * pa; g += pg * pa; b += pb * pa; a += pa;
    }
    const o = y * (N * 4 + 1) + 1 + x * 4;
    const k = SS * SS;
    raw[o] = a ? Math.round((r / a) * 255) : 0;
    raw[o + 1] = a ? Math.round((g / a) * 255) : 0;
    raw[o + 2] = a ? Math.round((b / a) * 255) : 0;
    raw[o + 3] = Math.round((a / k) * 255);
  }
}

const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(N, 0); ihdr.writeUInt32BE(N, 4); ihdr[8] = 8; ihdr[9] = 6;
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
]);
const out = path.join(__dirname, '..', 'build', 'icon.png');
fs.writeFileSync(out, png);
console.log('wrote', out, png.length, 'bytes');
