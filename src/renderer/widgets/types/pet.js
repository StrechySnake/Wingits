Wingits.register('pet', ({ root, api }) => {
  const { levelInfo } = WingitsProgress;

  /* ---------- canvas: 102x72 logical pixels, each drawn 2 CSS px wide (3x the old pet resolution) ---------- */
  const SCALE = 2, W = 102, H = 72, OY = 18;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  const O = { x: 0, y: 0 };                       // drawing origin (sprite space -> canvas)
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /* ----- pixel primitives (no anti-aliasing, so everything stays crisp pixel art) ----- */
  const rect = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(O.x + x), Math.round(O.y + y), w, h); };
  const dot = (x, y, c) => rect(x, y, 1, 1, c);

  function ellipse(cx, cy, rx, ry, c, rot = 0) {
    ctx.fillStyle = c;
    const ax = O.x + cx, ay = O.y + cy, ext = Math.max(rx, ry) + 1;
    const cs = Math.cos(rot), sn = Math.sin(rot);
    const x0 = Math.max(0, Math.floor(ax - ext)), x1 = Math.min(W - 1, Math.ceil(ax + ext));
    const y0 = Math.max(0, Math.floor(ay - ext)), y1 = Math.min(H - 1, Math.ceil(ay + ext));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - ax, dy = y + 0.5 - ay;
      const u = dx * cs + dy * sn, v = -dx * sn + dy * cs;
      if ((u * u) / (rx * rx) + (v * v) / (ry * ry) <= 1) ctx.fillRect(x, y, 1, 1);
    }
  }
  const disc = (cx, cy, r, c) => ellipse(cx, cy, r, r, c);

  function poly(pts, c) {
    ctx.fillStyle = c;
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const [x, y] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    x0 = Math.max(0, Math.floor(O.x + x0)); x1 = Math.min(W - 1, Math.ceil(O.x + x1));
    y0 = Math.max(0, Math.floor(O.y + y0)); y1 = Math.min(H - 1, Math.ceil(O.y + y1));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const px = x + 0.5 - O.x, py = y + 0.5 - O.y;
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
      }
      if (inside) ctx.fillRect(x, y, 1, 1);
    }
  }

  function leaf(x, y, len, wid, ang, c) {
    ellipse(x + Math.cos(ang) * len / 2, y + Math.sin(ang) * len / 2, len / 2, wid / 2, c, ang);
  }

  /** Dark border around everything drawn so far (silhouette outline, like classic pixel art). */
  function outline(hex) {
    const img = ctx.getImageData(0, 0, W, H), d = new Uint32Array(img.data.buffer);
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    const col = ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
    const solid = (i) => (d[i] >>> 24) > 20;
    const add = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (solid(i)) continue;
      if ((x > 0 && solid(i - 1)) || (x < W - 1 && solid(i + 1)) || (y > 0 && solid(i - W)) || (y < H - 1 && solid(i + W))) add.push(i);
    }
    for (const i of add) d[i] = col;
    ctx.putImageData(img, 0, 0);
  }

  /* ---------- palettes ---------- */
  const C = {
    cat: { fur: '#f4b26b', stripe: '#dd8d45', light: '#fde6c8', pink: '#f08aa0', eye: '#2b1d1a', blush: '#f6a99f', out: '#5b3a29' },
    slime: { fur: '#7ee0c3', dark: '#5cc4a8', light: '#c9f7ea', pink: '#f6a0b4', eye: '#17332e', out: '#2f6f64' },
    plant: { pot: '#c9744b', potD: '#a45a37', soil: '#5a3b2b', stem: '#4fae5a', leaf: '#7ad37f', leafD: '#3d8f49', petal: '#ff9bd0', petal2: '#ffd36e', core: '#ffe27a', out: '#2f4a34' },
  };

  /* ================================================================== CAT ================================================================== */
  const flicks = [];
  let nextFlickAt = 0;

  // A thin tail that never repeats: lean + sway + a wave that travels down its length + random flicks.
  function drawTail(t, now, p, by) {
    if (now >= nextFlickAt) { flicks.push({ t0: t, amp: rnd(0.6, 1.2) * (Math.random() < 0.5 ? -1 : 1) }); nextFlickAt = now + rnd(2200, 6500); }
    while (flicks.length && t - flicks[0].t0 > 4) flicks.shift();
    const A = 0.75 + 0.35 * Math.sin(t * 0.37);
    const base = 0.75 + 0.4 * Math.sin(t * 0.9 + 0.5);
    const sway = A * 0.85 * (0.6 * Math.sin(t * 1.9) + 0.4 * Math.sin(t * 3.1 + 1));
    const N = 22, step = 0.85;      // half the old length
    let x = 36, y = 42 + by;
    for (let i = 0; i < N; i++) {
      const f = i / (N - 1);
      let th = base + sway * (0.3 + 0.7 * f) + f * (0.55 * Math.sin(t * 4.1 - f * 6) + 0.28 * Math.sin(t * 6.7 - f * 9 + 2));
      for (const fl of flicks) { const age = t - fl.t0; th += fl.amp * Math.exp(-age * 1.5) * Math.sin(age * 10 - f * 6) * (0.25 + f); }
      x += Math.sin(th) * step; y -= Math.cos(th) * step;
      const r = 1.25 - 0.4 * f;           // and about half the old thickness
      disc(x, y, r, f > 0.9 ? p.light : (Math.floor(f * 7) % 2 ? p.stripe : p.fur));
    }
  }

  // o: { t, now, blink, bob, walk (0|1|undefined), groom: {paw,tongue,tilt}|null }
  function drawCat(o, p, level) {
    const { t, now, blink, groom } = o;
    const by = o.bob || 0, hx = groom ? groom.tilt : 0;
    O.y = OY;

    if (level >= 8) { // little wings, flapping gently
      const flap = Math.sin(t * 6) * 0.25;
      for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
        const bx = s < 0 ? 8 : 40, ang = (s < 0 ? Math.PI + 0.5 : -0.5) - s * (k * 0.35 + flap) * -1;
        leaf(bx, 34 + by - k * 0.5, 14 - k * 2, 5, ang, '#ffffff');
      }
    }
    drawTail(t, now, p, by);

    // body, belly, front paws
    ellipse(24, 38 + by, 13, 10, p.fur);
    ellipse(24, 41 + by, 8, 7, p.light);
    for (const dy of [32, 36, 40]) { rect(12, dy + by, 3, 1, p.stripe); rect(33, dy + by, 3, 1, p.stripe); }
    const lift = o.walk === undefined ? 0 : (o.walk ? 3 : 0);
    ellipse(17, 46 + by - lift, 5, 3, p.fur); ellipse(31, 46 + by - (o.walk ? 0 : (o.walk === undefined ? 0 : 3)), 5, 3, p.fur);
    for (const [px, py] of [[17, 46], [31, 46]]) { dot(px - 1, py + by + 1, p.stripe); dot(px + 1, py + by + 1, p.stripe); }

    // ears + head
    for (const s of [-1, 1]) {
      const m = (x) => 24 + s * (x - 24) + hx;
      poly([[m(7), 14 + by], [m(9), 0 + by], [m(22), 6 + by]], p.fur);
      poly([[m(11), 11 + by], [m(12), 4 + by], [m(18), 7 + by]], p.pink);
    }
    ellipse(24 + hx, 18 + by, 18, 13, p.fur);
    for (const dx of [-4, 0, 4]) rect(24 + dx + hx, 6 + by, 1, 4 - (dx ? 1 : 0), p.stripe);
    ellipse(11 + hx, 24 + by, 4, 2.4, p.blush); ellipse(37 + hx, 24 + by, 4, 2.4, p.blush);
    ellipse(24 + hx, 25 + by, 7, 5, p.light);
    if (blink || groom) { rect(13 + hx, 20 + by, 6, 1, p.out); rect(29 + hx, 20 + by, 6, 1, p.out); }
    else {
      ellipse(16 + hx, 19 + by, 2.4, 3.3, p.eye); ellipse(32 + hx, 19 + by, 2.4, 3.3, p.eye);
      rect(15 + hx, 17 + by, 2, 1, '#fff'); rect(31 + hx, 17 + by, 2, 1, '#fff');
    }
    ellipse(24 + hx, 22.5 + by, 2.4, 1.6, p.pink);
    for (const [x, y] of [[21, 26], [22, 27], [23, 27], [24, 26], [25, 27], [26, 27], [27, 26]]) dot(x + hx, y + by, p.out);
    if (groom) {
      if (groom.tongue) ellipse(24 + hx, 29 + by, 1.8, 2, p.pink);
      if (groom.paw) {
        const [gx, gy] = groom.paw;
        ellipse(gx + hx, gy + by, 4.4, 6, p.out); ellipse(gx + hx, gy + by, 3.4, 5, p.fur); ellipse(gx + hx, gy + by + 2, 1.8, 1.8, p.pink);
      }
    }
    if (level >= 5) { // crown
      const cy = 1 + by;
      poly([[15 + hx, cy + 3], [15 + hx, cy - 5], [20 + hx, cy - 1], [24 + hx, cy - 7], [28 + hx, cy - 1], [33 + hx, cy - 5], [33 + hx, cy + 3]], '#ffd24d');
      rect(15 + hx, cy + 1, 18, 2, '#e8aa22'); dot(24 + hx, cy - 2, '#ff6f91');
    }
    if (level >= 3) { // bow tie
      const ty = 32 + by;
      poly([[24, ty], [15, ty - 5], [15, ty + 5]], '#ff6f91'); poly([[24, ty], [33, ty - 5], [33, ty + 5]], '#ff6f91');
      disc(24, ty, 2.4, '#ffd1dc');
    }
    return { top: 0 + by, mid: 38 + by };
  }

  /* ---- bed + sleeping cat (absolute canvas coordinates, bx = bed centre) ---- */
  function drawBed(bx) {
    O.x = 0; O.y = 0;
    ellipse(bx, 58, 25, 11, '#d9809b');
    ellipse(bx, 56.5, 21, 8, '#f7cdd9');
  }
  function drawBedFront(bx) {
    O.x = 0; O.y = 0;
    ctx.fillStyle = '#d9809b';
    for (let y = 56; y < H; y++) for (let x = Math.floor(bx - 26); x <= Math.ceil(bx + 26); x++) {
      if (x < 0 || x >= W) continue;
      const dx = x + 0.5 - bx;
      const inRim = (dx * dx) / (25 * 25) + ((y + 0.5 - 58) * (y + 0.5 - 58)) / (11 * 11) <= 1;
      const inInner = (dx * dx) / (21 * 21) + ((y + 0.5 - 54) * (y + 0.5 - 54)) / (7.5 * 7.5) <= 1;
      if (inRim && !inInner) ctx.fillRect(x, y, 1, 1);
    }
  }
  function drawSleepingCat(bx, t, p) {
    O.x = 0; O.y = 0;
    const br = 0.7 * Math.sin(t * 1.6);
    ellipse(bx + 3, 51.5 - br, 18, 9.5 + br, p.fur);
    ellipse(bx + 5, 55, 11, 4, p.light);
    for (const dx of [-2, 4, 10]) rect(bx + dx, 43 - br, 1, 4, p.stripe);
    ellipse(bx - 13, 52.5, 10, 8.8, p.fur);
    poly([[bx - 21, 47], [bx - 20, 38], [bx - 13, 44]], p.fur); poly([[bx - 6, 47], [bx - 6, 38], [bx - 13, 44]], p.fur);
    poly([[bx - 19, 45], [bx - 19, 41], [bx - 15, 44]], p.pink); poly([[bx - 8, 45], [bx - 8, 41], [bx - 11, 44]], p.pink);
    rect(bx - 19, 52, 5, 1, p.out); rect(bx - 11, 52, 5, 1, p.out);         // closed eyes
    ellipse(bx - 13, 55.5, 2.2, 1.5, p.pink);
    ellipse(bx - 20, 56.5, 3, 2, p.blush); ellipse(bx - 6, 56.5, 3, 2, p.blush);
    ellipse(bx - 18, 59, 5, 2.6, p.fur); ellipse(bx - 8, 59, 5, 2.6, p.fur);  // paws under the chin
    drawBedFront(bx);
    // tail draped over the front rim
    const tail = [[bx + 20, 55], [bx + 19, 59], [bx + 14, 62], [bx + 6, 63], [bx - 2, 62.5], [bx - 8, 62]];
    for (let i = 0; i < tail.length - 1; i++) {
      const [x0, y0] = tail[i], [x1, y1] = tail[i + 1];
      for (let k = 0; k <= 6; k++) disc(x0 + ((x1 - x0) * k) / 6, y0 + ((y1 - y0) * k) / 6, 2, i === tail.length - 2 ? p.light : p.fur);
    }
  }

  /* ================================================================== SLIME ================================================================== */
  function drawSlime(t, blink, p, level) {
    O.x = 27; O.y = OY;
    const sq = Math.sin(t * 3.2) * 1.4;
    const rx = 20 + sq, rt = 16 - sq, rb = 8, cy = 38;
    ctx.fillStyle = p.fur;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const dx = (x + 0.5 - (O.x + 24)) / rx, dy = (y + 0.5 - (O.y + cy));
      const q = dy < 0 ? dy / rt : dy / rb;
      if (Math.pow(Math.abs(dx), 2.3) + q * q <= 1 && y < O.y + 46) ctx.fillRect(x, y, 1, 1);
    }
    rect(24 - rx + 2, 43, rx * 2 - 4, 3, p.dark);
    ellipse(15, 28 - sq * 0.5, 4, 2.4, p.light, -0.6); dot(10, 32, p.light);
    if (blink) { rect(13, 36, 6, 1, p.out); rect(29, 36, 6, 1, p.out); }
    else { ellipse(16, 36, 2.6, 3.4, p.eye); ellipse(32, 36, 2.6, 3.4, p.eye); rect(15, 34, 2, 1, '#fff'); rect(31, 34, 2, 1, '#fff'); }
    for (const [x, y] of [[21, 41], [22, 42], [23, 42], [24, 41], [25, 42], [26, 42], [27, 41]]) dot(x, y, p.out);
    ellipse(9, 41, 3.4, 2, p.pink); ellipse(39, 41, 3.4, 2, p.pink);
    const top = cy - rt;
    if (level >= 5) {
      const cyy = top - 2;
      poly([[15, cyy + 3], [15, cyy - 5], [20, cyy - 1], [24, cyy - 7], [28, cyy - 1], [33, cyy - 5], [33, cyy + 3]], '#ffd24d');
      rect(15, cyy + 1, 18, 2, '#e8aa22'); dot(24, cyy - 2, '#ff6f91');
    }
    if (level >= 3) { poly([[24, 45], [16, 40], [16, 50]], '#ff6f91'); poly([[24, 45], [32, 40], [32, 50]], '#ff6f91'); disc(24, 45, 2.2, '#ffd1dc'); }
  }

  /* ================================================================== PLANT / TREE ================================================================== */
  const stageOf = (level) => (level >= 50 ? 5 : level >= 25 ? 4 : level >= 10 ? 3 : level >= 5 ? 2 : level >= 2 ? 1 : 0);

  function flower(x, y, r, p, t) {
    const n = r > 5 ? 8 : 6;
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + t * 0.2; ellipse(x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62, r * 0.5, r * 0.34, p.petal, a); }
    disc(x, y, r * 0.38, p.core);
  }

  function drawPlant(t, stage, p) {
    O.x = 27; O.y = OY;
    poly([[9, 36], [39, 36], [36, 48], [12, 48]], p.pot);
    poly([[7, 31], [41, 31], [41, 36], [7, 36]], p.potD); rect(9, 33, 30, 1, p.pot);
    ellipse(24, 31.5, 16, 2.4, p.soil);
    const Hh = [11, 19, 27, 34, 38][stage], sc = 0.8 + stage * 0.45;
    const sx = (f) => 24 + Math.sin(t * 1.2 + f * 1.4) * sc * f * f * 2.2;
    const sy = (f) => 31 - f * Hh;
    // stem
    const steps = Math.ceil(Hh * 1.5);
    for (let i = 0; i <= steps; i++) { const f = i / steps; disc(sx(f), sy(f), stage < 2 ? 1.5 : 2.1 - f * 0.4, p.stem); }
    // leaves
    const pairs = [1, 2, 3, 4, 5][stage], len = 7 + stage * 2.6, wid = 3.6 + stage * 0.9;
    for (let k = 0; k < pairs; k++) {
      const f = 0.22 + (0.62 * (k + 0.5)) / pairs;
      for (const s of [-1, 1]) {
        const a = s < 0 ? Math.PI + 0.55 - Math.sin(t * 1.4 + k) * 0.12 : -0.55 + Math.sin(t * 1.4 + k + 1) * 0.12;
        leaf(sx(f), sy(f), len, wid, a, k % 2 ? p.leaf : p.leafD);
        leaf(sx(f), sy(f), len * 0.7, wid * 0.55, a, p.leaf);
      }
    }
    const tx = sx(1), ty = sy(1);
    if (stage === 0) { leaf(tx, ty, 6, 3, -2.2, p.leaf); leaf(tx, ty, 6, 3, -0.9, p.leaf); }
    else if (stage === 1) { ellipse(tx, ty - 3, 3.2, 4, p.petal2); disc(tx, ty - 3, 1.3, p.core); }
    else {
      const fr = [0, 0, 4.2, 6.2, 8][stage];
      flower(tx, ty - fr * 0.6, fr, p, t);
      if (stage >= 4) { // side branch with a second bloom
        const bxx = sx(0.5), byy = sy(0.5);
        for (let k = 0; k <= 10; k++) disc(bxx + k * 1.3, byy - k * 0.8 - Math.sin(t * 1.3) * k * 0.08, 1.4, p.stem);
        flower(bxx + 14, byy - 9, 4.6, { ...p, petal: p.petal2 }, t + 1);
      }
    }
  }

  /* ----- the apple tree (level 50+): apples ripen, fall, and a wood bin slides over to catch them ----- */
  const GROUND = 66, BIN_TOP = 52, BIN_HALF = 10;
  const tree = {
    slots: [[24, 30], [34, 36], [47, 35], [56, 29], [29, 17], [44, 12], [53, 21]].map(([x, y]) => ({ x, y, state: 'hang', grow: 1, at: 0 })),
    falling: null, binX: 70, binV: 0, bounce: 0, pile: 0, emptyAt: 0, nextDropAt: 0, last: 0, puff: [],
  };

  function updateTree(now, t) {
    const dt = clamp((now - (tree.last || now)) / 1000, 0, 0.1); tree.last = now;
    if (!tree.nextDropAt) tree.nextDropAt = now + 1800;
    for (const s of tree.slots) {
      if (s.state === 'gone' && now >= s.at) { s.state = 'hang'; s.grow = 0; }
      if (s.state === 'hang' && s.grow < 1) s.grow = Math.min(1, s.grow + dt / 2.5);
    }
    if (!tree.falling && now >= tree.nextDropAt) {
      const ripe = tree.slots.filter((s) => s.state === 'hang' && s.grow >= 1);
      if (ripe.length) {
        const s = ripe[Math.floor(Math.random() * ripe.length)];
        s.state = 'gone'; s.at = now + rnd(4000, 8000);
        tree.falling = { x: s.x, y: s.y, vy: 0 };
      }
      tree.nextDropAt = now + rnd(2200, 4600);
    }
    // the bin chases the falling apple (critically damped spring), otherwise it idles side to side
    const target = tree.falling ? tree.falling.x : 62 + 26 * Math.sin(t * 0.45);
    const k = tree.falling ? 160 : 12, c = 2 * Math.sqrt(k);
    tree.binV += ((target - tree.binX) * k - tree.binV * c) * dt;
    tree.binV = clamp(tree.binV, -110, 110);
    tree.binX = clamp(tree.binX + tree.binV * dt, BIN_HALF + 1, W - BIN_HALF - 1);
    tree.bounce = Math.max(0, tree.bounce - dt * 4);
    const a = tree.falling;
    if (a) {
      a.vy += 75 * dt; a.y += a.vy * dt;
      if (a.y >= BIN_TOP - 2 && Math.abs(a.x - tree.binX) <= BIN_HALF) {   // caught!
        tree.falling = null; tree.pile++; tree.bounce = 1;
        if (tree.pile >= 5) tree.emptyAt = now + 1800;
      } else if (a.y >= GROUND - 2) { tree.puff.push({ x: a.x, y: GROUND - 3, life: 1 }); tree.falling = null; }
    }
    if (tree.pile >= 5 && now >= tree.emptyAt) tree.pile = 0;
    tree.puff.forEach((p) => { p.life -= dt * 2; });
    tree.puff = tree.puff.filter((p) => p.life > 0);
  }

  function apple(x, y, r) {
    disc(x, y, r, '#e5383b'); disc(x + r * 0.25, y + r * 0.2, r * 0.7, '#cf2b30');
    if (r > 2) { dot(Math.round(x - r * 0.4), Math.round(y - r * 0.4), '#ff9a9a'); dot(Math.round(x), Math.round(y - r - 0.5), '#5a3b1f'); dot(Math.round(x + 1), Math.round(y - r - 0.5), '#4fae5a'); }
  }

  function drawTree(t, p) {
    O.x = 0; O.y = 0;
    ellipse(51, 68, 50, 5, '#6bbf59'); ellipse(51, 69, 46, 3, '#58a64a');
    // trunk and branches
    poly([[35, 68], [45, 68], [43, 36], [37, 36]], '#8a5a2c'); rect(38, 40, 1, 24, '#6f4720');
    for (const [x0, y0, x1, y1] of [[40, 40, 28, 28], [40, 38, 54, 26], [40, 34, 44, 16]]) for (let k = 0; k <= 12; k++) disc(x0 + ((x1 - x0) * k) / 12, y0 + ((y1 - y0) * k) / 12, 2.4 - k * 0.1, '#8a5a2c');
    // canopy
    const sw = Math.sin(t * 1.1) * 0.8;
    for (const [x, y, r, c] of [[40, 28, 15, '#3d8f49'], [27, 33, 11, '#3d8f49'], [54, 32, 11, '#3d8f49'], [30, 19, 11, '#4fae5a'], [51, 20, 11, '#4fae5a'], [41, 13, 10, '#5cc069'], [40, 24, 12, '#4fae5a']]) disc(x + sw * (1 - y / 40), y, r, c);
    for (const [x, y, r] of [[34, 14, 4], [46, 10, 3.4], [26, 25, 3.4], [50, 24, 3.4], [41, 21, 4]]) disc(x + sw * 0.5, y, r, '#7ad37f');
    for (const s of tree.slots) if (s.state === 'hang') apple(s.x + sw * (1 - s.y / 40), s.y, 3.4 * s.grow);
    if (tree.falling) apple(tree.falling.x, tree.falling.y, 3.4);
    // wood bin
    const bx = tree.binX, by = BIN_TOP + Math.sin(tree.bounce * Math.PI) * 1.6 * tree.bounce;
    poly([[bx - 10, by], [bx + 10, by], [bx + 8, 66], [bx - 8, 66]], '#b9824b');
    for (let i = 0; i < Math.min(tree.pile, 5); i++) apple(bx - 7 + i * 3.6, by - 1.5 - (i % 2) * 2.2, 3.2);
    poly([[bx - 10, by + 1], [bx + 10, by + 1], [bx + 8, 66], [bx - 8, 66]], '#b9824b');
    rect(Math.round(bx - 3), by + 2, 1, 64 - by, '#8a5a2c'); rect(Math.round(bx + 3), by + 2, 1, 64 - by, '#8a5a2c');
    rect(bx - 10, by + 5, 20, 2, '#8a5a2c'); rect(bx - 9, 61, 18, 2, '#8a5a2c');
    rect(bx - 11, by - 1, 22, 3, '#9a6a38');
    for (const q of tree.puff) disc(q.x, q.y, 2 + (1 - q.life) * 3, '#e7f7d8');
  }

  /* ================================================================== particles ================================================================== */
  const maskCache = {};
  function makeMask(kind) {
    if (maskCache[kind]) return maskCache[kind];
    const pts = [];
    if (kind === 'heart') {
      for (let j = 0; j < 12; j++) for (let i = 0; i < 13; i++) {
        const x = ((i - 6) / 6) * 1.2, y = -((j - 5.2) / 5.4) * 1.15 + 0.1;
        if (Math.pow(x * x + y * y - 1, 3) - x * x * y * y * y <= 0) pts.push([i, j]);
      }
    } else if (kind === 'star') {
      const poly8 = [[0, -7], [1.8, -1.8], [7, 0], [1.8, 1.8], [0, 7], [-1.8, 1.8], [-7, 0], [-1.8, -1.8]];
      for (let j = -7; j <= 7; j++) for (let i = -7; i <= 7; i++) {
        let inside = false;
        for (let a = 0, b = poly8.length - 1; a < poly8.length; b = a++) {
          const [xi, yi] = poly8[a], [xj, yj] = poly8[b];
          if ((yi > j) !== (yj > j) && i < ((xj - xi) * (j - yi)) / (yj - yi) + xi) inside = !inside;
        }
        if (inside) pts.push([i + 7, j + 7]);
      }
    } else { // z
      for (let i = 0; i < 9; i++) { pts.push([i, 0], [i, 1], [i, 10], [i, 11]); }
      for (let k = 0; k < 10; k++) pts.push([8 - Math.round(k * 0.8), 1 + k], [7 - Math.round(k * 0.8), 1 + k]);
    }
    return (maskCache[kind] = pts);
  }
  const COLORS = { heart: ['#ff5a7e', '#8e1b3d', '#ffd1dc'], star: ['#ffd24d', '#b8760a', '#fff6c8'], z: ['#dbe8ff', '#4b5f9c', '#ffffff'] };
  let parts = [];
  function burst(kind, n, cx) {
    for (let i = 0; i < n; i++) parts.push({ kind, x: cx - 7 + rnd(-14, 14), y: rnd(20, 32), vx: rnd(-5, 5), vy: -rnd(13, 24), life: 1 });
  }
  function drawParts(dt) {
    for (const p of parts) {
      p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt * (p.kind === 'z' ? 0.22 : 0.62);
      const pts = makeMask(p.kind), [fill, border, shine] = COLORS[p.kind];
      ctx.globalAlpha = clamp(p.life * 1.6, 0, 1);
      const ox = Math.round(p.x), oy = Math.round(p.y);
      ctx.fillStyle = border;                                  // 1px border around the glyph
      for (const [x, y] of pts) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) ctx.fillRect(ox + x + dx, oy + y + dy, 1, 1);
      ctx.fillStyle = fill;
      for (const [x, y] of pts) ctx.fillRect(ox + x, oy + y, 1, 1);
      if (p.kind === 'heart') { ctx.fillStyle = shine; ctx.fillRect(ox + 2, oy + 2, 2, 1); ctx.fillRect(ox + 2, oy + 3, 1, 1); }
      ctx.globalAlpha = 1;
    }
    parts = parts.filter((p) => p.life > 0);
  }

  /* ================================================================== widget DOM ================================================================== */
  root.innerHTML = `
    <div class="pet">
      <div class="pet-banner">Level up!</div>
      <div class="pet-stage"><div class="pet-bubble" hidden></div></div>
      <div class="pet-pill">
        <div class="pet-line"><b class="pet-name"></b><span class="pet-lv"></span></div>
        <div class="bar"><i></i></div>
      </div>
    </div>`;
  const stage = root.querySelector('.pet-stage'), bubble = root.querySelector('.pet-bubble');
  cv.className = 'pet-canvas';
  cv.style.width = W * SCALE + 'px'; cv.style.height = H * SCALE + 'px';
  stage.insertBefore(cv, bubble);
  const $ = (s) => root.querySelector(s);

  /* ---------- the cat's day: sit, groom every 30-90 s, sleep in its bed from 22:00 to 07:00 ---------- */
  const DAY_X = 9, BED_REST = 76, BED_MID = 52, WALK = 16, GROOM_MS = 5200;
  const hourNow = () => (st && st.dev && st.dev.hour !== null && st.dev.hour !== undefined ? st.dev.hour : new Date().getHours()); // dev mode can fake the hour
  const isNight = () => { const h = hourNow(); return h >= 22 || h < 7; };
  let mode = 'sit', catX = DAY_X, bedX = BED_REST, groomStart = 0, started = false, nextZAt = 0;
  let nextGroomAt = performance.now() + rnd(30000, 90000);

  function catStep(now, dt) {
    const night = isNight();
    if (!started) { started = true; if (night) { mode = 'sleep'; bedX = BED_MID; } }
    if (night && (mode === 'sit' || mode === 'groom' || mode === 'walkFromBed')) mode = 'walkToBed';
    if (!night && (mode === 'walkToBed')) mode = 'walkFromBed';
    if (!night && mode === 'sleep') mode = 'rise';
    if (mode === 'walkToBed') { catX = Math.min(BED_REST - 24, catX + WALK * dt); if (catX >= BED_REST - 24) mode = 'sleep'; }
    else if (mode === 'sleep') bedX += (BED_MID - bedX) * (1 - Math.exp(-dt * 2.5));          // bed and cat slide to the middle
    else if (mode === 'rise') {
      bedX += (BED_REST - bedX) * (1 - Math.exp(-dt * 2.5));                                  // ...and back to normal on waking
      if (Math.abs(bedX - BED_REST) < 0.6) { bedX = BED_REST; catX = BED_REST - 24; mode = 'walkFromBed'; }
    } else if (mode === 'walkFromBed') { catX = Math.max(DAY_X, catX - WALK * dt); if (catX <= DAY_X) { mode = 'sit'; nextGroomAt = now + rnd(30000, 90000); } }
    else if (mode === 'sit' && now >= nextGroomAt) { mode = 'groom'; groomStart = now; }
    else if (mode === 'groom' && now - groomStart > GROOM_MS) { mode = 'sit'; nextGroomAt = now + rnd(30000, 90000); }
  }
  function groomPose(now) {
    const g = now - groomStart;
    if (g > GROOM_MS - 450) return { paw: null, tongue: false, tilt: 0 };
    if (g < 2400) { const k = Math.floor(g / 220) % 2; return { paw: [31, 27 - k * 3], tongue: k === 0, tilt: 0 }; }
    const i = Math.floor((g - 2400) / 260) % 4;
    return { paw: [[34, 24], [37, 18], [37, 12], [34, 18]][i], tongue: false, tilt: i % 2 ? 2 : 0 };
  }

  /* ---------- pet state ---------- */
  let st = null, last = performance.now(), nextBlinkAt = 0, blinkUntil = 0, lastXp = null, lastLevel = null, lastStage = null;

  function frame() {
    if (!st) return;
    const still = !!(st.dev && st.dev.noAnim);              // dev mode: animations off -> a single still pose
    const now = performance.now(), t = still ? 1 : now / 1000, dt = still ? 0 : clamp((now - last) / 1000, 0.001, 0.12);
    last = now;
    const kind = st.pet.kind, level = levelInfo(st.pet.xp).level;
    if (!still && now >= nextBlinkAt) { blinkUntil = now + 150; nextBlinkAt = now + rnd(2500, 6000); }
    const blink = !still && now < blinkUntil;
    ctx.clearRect(0, 0, W, H);
    let outlineCol = C[kind].out;

    if (kind === 'cat') {
      const p = C.cat;
      if (!still) catStep(now, dt); else if (!started) catStep(now, 0);
      if (mode === 'sleep' || mode === 'rise') {
        drawBed(bedX);
        drawSleepingCat(bedX, t, p);
        if (mode === 'sleep' && now >= nextZAt) { nextZAt = now + rnd(1500, 2400); parts.push({ kind: 'z', x: bedX - 18, y: 38, vx: 3, vy: -5, life: 1 }); }
      } else {
        drawBed(BED_REST);
        O.x = catX;
        const walking = mode === 'walkToBed' || mode === 'walkFromBed';
        const wph = Math.floor(now / 170) % 2;
        drawCat({ t, now, blink, bob: walking ? (wph ? -2 : 0) : 0, walk: walking ? wph : undefined, groom: mode === 'groom' ? groomPose(now) : null }, p, level);
      }
    } else if (kind === 'slime') {
      drawSlime(t, blink, C.slime, level);
    } else {
      const stg = stageOf(level);
      if (stg >= 5) { if (!still) updateTree(now, t); drawTree(t, C.plant); outlineCol = '#35502f'; }
      else drawPlant(t, stg, C.plant);
    }
    outline(outlineCol);
    drawParts(dt);
    placeBubble();
  }

  /* ---------- clicking: hearts (3s cooldown) and the cat's speech bubble (no cooldown) ---------- */
  const catCx = () => (st && st.pet.kind === 'cat' ? (mode === 'sleep' || mode === 'rise' ? bedX - 8 : catX + 24) : 51);
  const PHRASES = ['Meow', '-no thoughts-'];
  let heartReadyAt = 0, bubbleOn = false, bubbleHideAt = 0, phrase = -1;

  function showBubble(shuffle) {
    phrase = shuffle ? (phrase + 1) % PHRASES.length : Math.floor(Math.random() * PHRASES.length);
    bubble.textContent = PHRASES[phrase];
    bubble.hidden = false;
    bubble.classList.remove('shuffle'); void bubble.offsetWidth; bubble.classList.add('shuffle');
    bubbleOn = true; bubbleHideAt = performance.now() + 5000;
  }
  function placeBubble() {
    if (bubbleOn && performance.now() > bubbleHideAt) { bubbleOn = false; bubble.hidden = true; }
    if (bubbleOn) bubble.style.left = clamp(catCx() * SCALE, 52, W * SCALE - 52) + 'px';
  }
  function poke() {
    const now = performance.now();
    if (now >= heartReadyAt) { burst('heart', 5, catCx()); heartReadyAt = now + 3000; }
    if (st && st.pet.kind === 'cat' && mode !== 'sleep' && mode !== 'rise') {
      if (bubbleOn) showBubble(true);                       // pressing a visible bubble shuffles it
      else if (Math.random() < 0.6) showBubble(false);      // otherwise it only sometimes speaks
    }
  }
  cv.addEventListener('click', poke);
  bubble.addEventListener('click', (e) => { e.stopPropagation(); showBubble(true); });

  let lastPulse = null;
  function devPulse(name) {
    const now = performance.now();
    if (name === 'hearts') burst('heart', 6, catCx());
    else if (name === 'stars') burst('star', 10, catCx());
    else if (name === 'bubble' && st.pet.kind === 'cat') showBubble(false);
    else if (name === 'groom' && st.pet.kind === 'cat' && mode === 'sit') { mode = 'groom'; groomStart = now; }
    else if (name === 'apple') tree.nextDropAt = now;
  }

  function update(s) {
    st = s;
    if (s.dev) {
      if (lastPulse !== null && s.dev.pulse.n !== lastPulse) devPulse(s.dev.pulse.name);
      lastPulse = s.dev.pulse.n;
    }
    const info = levelInfo(s.pet.xp), stg = stageOf(info.level);
    $('.pet-name').textContent = s.pet.name;
    $('.pet-lv').textContent = ` Lv ${info.level}`;
    $('.bar i').style.width = Math.round(info.pct * 100) + '%';
    $('.pet-pill').title = `${info.into} / ${info.need} XP to next level`;
    if (lastXp !== null && s.pet.xp > lastXp) {
      burst('heart', 6, catCx());
      stage.classList.remove('hop'); void stage.offsetWidth; stage.classList.add('hop');
      const grew = s.pet.kind === 'plant' && stg > lastStage;
      if (info.level > lastLevel || grew) {
        burst('star', 10, catCx());
        const b = $('.pet-banner');
        b.textContent = grew ? (stg >= 5 ? 'It’s a tree!' : 'Grew bigger!') : `Level ${info.level}!`;
        b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
      }
    }
    lastXp = s.pet.xp; lastLevel = info.level; lastStage = stg;
  }

  setInterval(frame, 66);
  return { update };
});
