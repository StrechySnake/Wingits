Wingits.register('pet', ({ root, api }) => {
  const { levelInfo } = WingitsProgress;
  const { esc } = Wingits;

  /* ---------- pixel art ---------- */
  const W = 34, H = 24, OY = 6, SCALE = 6; // 16x16 sprite on a 34x24 canvas (room for the cat's bed)
  const ORG = { x: 9 };                     // sprite origin; the cat moves it, other pets stay centred

  const CAT = [
    '................',
    '...oo......oo...',
    '..ofpo....opfo..',
    '..ofpfoooofpfo..',
    '..offffffffffo..',
    '.offffffffffffo.',
    '.ofeeffffffeefo.',
    '.offfffppfffffo.',
    '.offffffffffffo.',
    '..offffffffffo..',
    '...oooooooooo...',
    '..offfllllfffo..',
    '.offfllllllfffo.',
    '.offfllllllfffo.',
    '.ooffffllffffoo.',
    '..oooooooooooo..',
  ];
  const PAL = {
    cat:   { o: '#5b3a29', f: '#f4b26b', l: '#fde6c8', p: '#f08aa0', e: '#2b1d1a' },
    slime: { o: '#2f6f64', f: '#7ee0c3', l: '#c9f7ea', p: '#f08aa0', e: '#17332e' },
    plant: { pot: '#c9744b', potD: '#9c5233', soil: '#5a3b2b', stem: '#4fae5a', leaf: '#7ad37f', leafD: '#3d8f49', petal: '#ff9bd0', petal2: '#ffd36e', core: '#ffe27a' },
  };

  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  const px = (x, y, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x + ORG.x), Math.round(y + OY), 1, 1); };
  const rect = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x + ORG.x), Math.round(y + OY), w, h); };
  const fillEllipse = (cx, cy, rx, ry, c) => {
    ctx.fillStyle = c;
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) ctx.fillRect(Math.round(x + ORG.x), Math.round(y + OY), 1, 1);
    }
  };

  /* ---- cat ---- */
  const FUR = '#f4b26b', OUT = '#5b3a29';

  // A tail that sways left and right without ever repeating: several sine waves with
  // incommensurate speeds, plus a slowly drifting amplitude, bend the tail along its length.
  function drawTail(t, pal) {
    const amp = 0.62 + 0.3 * Math.sin(t * 0.31 + 1.1);
    const sway = amp * (0.55 * Math.sin(t * 1.37) + 0.3 * Math.sin(t * 2.31 + 1.7) + 0.2 * Math.sin(t * 0.83 + 4.2));
    const curl = 0.5 * Math.sin(t * 0.67 + 0.4) + 0.25 * Math.sin(t * 1.91 + 2.6);
    const N = 24, step = 0.46;
    let x = 14, y = 13.4;
    const pts = [];
    for (let i = 0; i < N; i++) {
      const f = i / (N - 1);
      const th = 0.6 + 1.3 * sway * (0.35 + 0.65 * f) + curl * f * f;   // angle from straight up
      x += Math.sin(th) * step; y -= Math.cos(th) * step;
      const rx = Math.round(x), ry = Math.round(y);
      if (!pts.length || pts[pts.length - 1][0] !== rx || pts[pts.length - 1][1] !== ry) pts.push([rx, ry, f, th]);
    }
    const set = new Map();
    for (const [rx, ry, f, th] of pts) {
      set.set(rx + ',' + ry, 1);
      if (f < 0.7) { // thicker towards the body
        if (Math.abs(Math.sin(th)) > Math.abs(Math.cos(th))) set.set(rx + ',' + (ry + 1), 1); else set.set((rx + 1) + ',' + ry, 1);
      }
    }
    const has = (x2, y2) => set.has(x2 + ',' + y2);
    for (const k of set.keys()) { // outline first, fur on top
      const [cx, cy] = k.split(',').map(Number);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!has(cx + dx, cy + dy)) px(cx + dx, cy + dy, pal.o);
    }
    for (const k of set.keys()) { const [cx, cy] = k.split(',').map(Number); px(cx, cy, pal.f); }
    const tip = pts[pts.length - 1];
    if (tip) px(tip[0], tip[1], pal.l);
  }

  function drawPaw(x, y, pal) {
    rect(x - 1, y - 1, 5, 4, pal.o);
    rect(x, y, 3, 3, pal.f);
    px(x + 1, y + 1, pal.p);
  }

  // opts: { t, blink, walk (0|1|undefined), groom: {paw:[x,y]|null, tongue, tilt}, }
  function drawCat(opts, pal) {
    const { t, blink, walk, groom } = opts;
    drawTail(t, pal);
    const bob = walk !== undefined ? (walk ? -1 : 0) : 0;
    const tilt = groom ? groom.tilt : 0;
    for (let y = 0; y < CAT.length; y++) for (let x = 0; x < 16; x++) {
      const ch = CAT[y][x];
      if (ch === '.') continue;
      const headRow = y >= 1 && y <= 9;
      px(x + (headRow ? tilt : 0), y + bob, pal[ch]);
    }
    if (blink || groom) for (const x of [3, 4, 11, 12]) px(x + tilt, 6 + bob, pal.o);
    if (walk !== undefined) { // stepping feet: open a gap under the body, alternating sides
      for (const x of (walk ? [8, 9] : [6, 7])) ctx.clearRect(Math.round(ORG.x + x), OY + 15 + bob, 1, 1);
    }
    if (groom) {
      if (groom.tongue) px(8 + tilt, 8 + bob, pal.p);
      if (groom.paw) drawPaw(groom.paw[0] + tilt, groom.paw[1] + bob, pal);
    }
    return { top: 1 + bob, mid: 11 + bob };
  }

  // The cat bed (always there) and the curled-up sleeping cat.
  function drawBed() {
    const save = ORG.x; ORG.x = 0;
    fillEllipse(25.5, 14.6, 8.6, 3.9, '#6b4552');
    fillEllipse(25.5, 14.2, 7.6, 3.3, '#d9809b');
    fillEllipse(25.5, 13.4, 5.8, 2.1, '#f7cdd9');
    ORG.x = save;
  }
  function drawBedFront() { // front rim, drawn over the sleeping cat so it nests inside
    const save = ORG.x; ORG.x = 0;
    ctx.fillStyle = '#d9809b';
    for (let x = 19; x <= 32; x++) {
      const dx = (x + 0.5 - 25.5) / 7.6;
      if (Math.abs(dx) <= 1) ctx.fillRect(x, OY + Math.round(14.2 + 3.3 * Math.sqrt(1 - dx * dx)) - 1, 1, 1);
    }
    ORG.x = save;
  }
  function drawSleepingCat(t, pal) {
    const save = ORG.x; ORG.x = 0;
    const breath = 0.25 * Math.sin(t * 1.6);
    fillEllipse(26, 11.4 - breath, 6.4, 3.4 + breath, pal.o);
    fillEllipse(26, 11.6 - breath, 5.6, 2.8 + breath, pal.f);
    fillEllipse(21.4, 11.8, 3.5, 3.0, pal.o);   // head resting on the paws
    fillEllipse(21.4, 11.9, 2.7, 2.3, pal.f);
    px(19, 8.6, pal.o); px(20, 9, pal.f); px(23, 8.6, pal.o); px(22, 9, pal.f); // ears
    px(20, 11.8, pal.o); px(21, 11.8, pal.o); px(23, 11.8, pal.o); px(22, 11.8, pal.o); // closed eyes
    px(22, 12.8, pal.p);
    for (const [x, y] of [[27, 9.2], [29, 10], [30, 11.4], [30, 13]]) px(x, y, pal.l); // back stripe
    // tail wrapped around the front
    for (const [x, y] of [[31, 13], [30, 14.2], [28, 14.8], [26, 14.9], [24, 14.7]]) { px(x, y + 1, pal.o); px(x, y, pal.f); }
    px(23, 14.5, pal.l);
    ORG.x = save;
  }

  function drawSlime(f, blink, pal) {
    const h = f ? 9 : 8, hw = f ? 6 : 6.6, base = 15;
    for (let i = 0; i < h; i++) {
      const y = base - i;
      const t = i / (h - 1);
      const half = Math.round(hw * Math.sqrt(Math.max(0, 1 - Math.pow(Math.max(0, t - 0.15) / 0.85, 2.2))));
      for (let x = -half; x <= half; x++) {
        const edge = Math.abs(x) === half || i === h - 1 || i === 0;
        px(8 + x - (x > 0 ? 0 : 0), y, edge ? pal.o : pal.f);
      }
    }
    // highlight
    px(4, base - h + 3, pal.l); px(5, base - h + 2, pal.l); px(4, base - h + 4, pal.l);
    const ey = base - 4;
    if (blink) { px(5, ey, pal.o); px(6, ey, pal.o); px(10, ey, pal.o); px(11, ey, pal.o); }
    else { rect(5, ey - 1, 2, 2, pal.e); rect(10, ey - 1, 2, 2, pal.e); }
    px(8, ey + 1, pal.o); px(7, ey + 1, pal.o);
    px(4, ey + 1, pal.p); px(12, ey + 1, pal.p);
    return { top: base - h + 1, mid: base - 3 };
  }

  function drawPlant(f, _b, pal, level, ticks) {
    // pot
    rect(4, 12, 8, 1, pal.potD); rect(3, 12, 10, 1, pal.pot); rect(3, 12, 10, 1, pal.pot);
    rect(4, 11, 8, 1, pal.soil);
    rect(4, 13, 8, 1, pal.pot); rect(5, 14, 6, 1, pal.pot); rect(5, 15, 6, 1, pal.potD);
    rect(3, 12, 1, 1, pal.potD); rect(12, 12, 1, 1, pal.potD);
    const stemH = Math.min(1 + level, 9);
    const sway = (y) => (f && y < 11 - stemH * 0.5 ? 1 : 0);
    let topY = 11;
    for (let i = 1; i <= stemH; i++) {
      const y = 11 - i; topY = y;
      px(8 + sway(y), y, pal.stem);
      if (i >= 2 && i % 2 === 0 && i < stemH) {
        const dir = (i / 2) % 2 ? -1 : 1, len = i > 5 ? 3 : 2;
        for (let k = 1; k <= len; k++) px(8 + dir * k + sway(y), y - (k > 1 ? 1 : 0), k === len ? pal.leafD : pal.leaf);
      }
    }
    const tx = 8 + sway(topY);
    if (level < 3) {
      px(tx - 1, topY, pal.leaf); px(tx + 1, topY, pal.leaf); px(tx - 2, topY - 1, pal.leafD); px(tx + 2, topY - 1, pal.leafD); px(tx, topY - 1, pal.leaf);
    } else if (level < 5) {
      rect(tx - 1, topY - 2, 3, 2, pal.petal2); px(tx, topY - 3, pal.petal2); px(tx, topY - 1, pal.core);
    } else {
      const big = level >= 8 ? 2 : 1;
      // petals
      for (const [dx, dy] of [[0, -2], [-2, 0], [2, 0], [0, 2], [-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        px(tx + dx * (big > 1 ? 1 : 1), topY + dy - 1, pal.petal);
      }
      if (big > 1) for (const [dx, dy] of [[-3, 0], [3, 0], [0, -3]]) px(tx + dx, topY + dy - 1, pal.petal);
      px(tx, topY - 1, pal.core);
    }
    return { top: topY - 3, mid: 9, noAcc: true };
  }

  function accessories(info, level, f, kind) {
    if (kind === 'plant') return;
    if (level >= 8) { // little wings
      const wy = info.mid - 1;
      const up = f ? -1 : 0;
      for (const [x, y] of [[-1, 0], [-2, -1 + up], [-3, -2 + up], [-2, 0], [-3, -1 + up]]) { px(x + 1, wy + y, '#ffffff'); }
      for (const [x, y] of [[1, 0], [2, -1 + up], [3, -2 + up], [2, 0], [3, -1 + up]]) { px(14 + x, wy + y, '#ffffff'); }
    }
    if (level >= 5) { // crown
      const ty = info.top - 1;
      rect(5, ty, 6, 1, '#ffd24d');
      px(5, ty - 1, '#ffd24d'); px(8, ty - 1, '#ffd24d'); px(10, ty - 1, '#ffd24d');
      px(8, ty, '#ff6f91');
    }
    if (level >= 3) { // bow tie
      const by = info.top + (kind === 'cat' ? 9 : 6);
      px(6, by, '#ff6f91'); px(7, by, '#ff6f91'); px(9, by, '#ff6f91'); px(10, by, '#ff6f91'); px(8, by, '#ffd1dc');
    }
  }

  /* ---------- particles (hearts / stars / sleepy z's) ---------- */
  const SPRITES = {
    heart: ['.x.x.', 'xxxxx', 'xxxxx', '.xxx.', '..x..'],
    star: ['..x..', '..x..', 'xxxxx', '..x..', '..x..'],
    z: ['xxx', '..x', '.x.', 'x..', 'xxx'],
  };
  const COLORS = { heart: '#ff6f91', star: '#ffd24d', z: '#cfe0ff' };
  let parts = [];
  function burst(kind, n, cx = 17) {
    for (let i = 0; i < n; i++) parts.push({ x: cx - 6 + Math.random() * 12, y: 10 + Math.random() * 6, vy: -(0.12 + Math.random() * 0.14), vx: (Math.random() - .5) * .12, life: 1, kind });
  }
  function drawParts() {
    for (const p of parts) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 1.4));
      ctx.fillStyle = COLORS[p.kind];
      SPRITES[p.kind].forEach((row, y) => [...row].forEach((c, x) => { if (c === 'x') ctx.fillRect(Math.round(p.x) + x, Math.round(p.y) + y, 1, 1); }));
      ctx.globalAlpha = 1;
    }
  }

  /* ---------- widget DOM ---------- */
  root.innerHTML = `
    <div class="pet">
      <div class="pet-banner">Level up!</div>
      <div class="pet-stage"></div>
      <div class="pet-pill">
        <div class="pet-line"><b class="pet-name"></b><span class="pet-lv"></span></div>
        <div class="bar"><i></i></div>
      </div>
    </div>`;
  const stage = root.querySelector('.pet-stage');
  cv.className = 'pet-canvas';
  cv.style.width = W * SCALE + 'px'; cv.style.height = H * SCALE + 'px';
  stage.appendChild(cv);
  const $ = (s) => root.querySelector(s);

  let st = null, tick = 0, blinkUntil = 0, nextBlinkAt = 0, lastXp = null, lastLevel = null;

  /* ---------- the cat's day: sit, groom every 30-90s, sleep in its bed from 22:00 to 07:00 ---------- */
  const DAY_X = 3, BED_X = 18, WALK = 0.3, GROOM_MS = 5200;
  const rand = (a, b) => a + Math.random() * (b - a);
  const hourNow = () => (typeof window.__wingitsHour === 'number' ? window.__wingitsHour : new Date().getHours()); // override is for testing
  const isNight = () => { const h = hourNow(); return h >= 22 || h < 7; };
  let mode = 'sit', catX = DAY_X, groomStart = 0, started = false, nextZAt = 0;
  let nextGroomAt = performance.now() + rand(30000, 90000);

  function catStep(now) {
    const night = isNight();
    if (!started) { started = true; if (night) { mode = 'sleep'; catX = BED_X; } }
    if (night && (mode === 'sit' || mode === 'groom' || mode === 'walkFromBed')) mode = 'walkToBed';
    if (!night && (mode === 'sleep' || mode === 'walkToBed')) mode = 'walkFromBed';
    if (mode === 'walkToBed') { catX = Math.min(BED_X, catX + WALK); if (catX >= BED_X) mode = 'sleep'; }
    else if (mode === 'walkFromBed') { catX = Math.max(DAY_X, catX - WALK); if (catX <= DAY_X) { mode = 'sit'; nextGroomAt = now + rand(30000, 90000); } }
    else if (mode === 'sit' && now >= nextGroomAt) { mode = 'groom'; groomStart = now; }
    else if (mode === 'groom' && now - groomStart > GROOM_MS) { mode = 'sit'; nextGroomAt = now + rand(30000, 90000); }
  }

  function groomPose(now) {
    const g = now - groomStart;
    if (g > GROOM_MS - 450) return { paw: null, tongue: false, tilt: 0 };          // paw back down
    if (g < 2400) {                                                                // licking the paw
      const k = Math.floor(g / 220) % 2;
      return { paw: [10, 8 - k], tongue: k === 0, tilt: 0 };
    }
    const i = Math.floor((g - 2400) / 260) % 4;                                    // wiping over the ear and face
    return { paw: [[11, 8], [12, 6], [12, 4], [11, 6]][i], tongue: false, tilt: i % 2 };
  }

  function frame() {
    tick++;
    if (!st) return;
    const now = performance.now(), t = now / 1000;
    const kind = st.pet.kind;
    const level = levelInfo(st.pet.xp).level;
    const f = Math.floor(tick / 7) % 2;
    if (now >= nextBlinkAt) { blinkUntil = now + 150; nextBlinkAt = now + rand(2500, 6000); }
    const blink = now < blinkUntil;
    ctx.clearRect(0, 0, W, H);
    const pal = PAL[kind];

    if (kind === 'cat') {
      catStep(now);
      drawBed();
      if (mode === 'sleep') {
        drawSleepingCat(t, pal);
        drawBedFront();
        if (now >= nextZAt) { nextZAt = now + rand(1500, 2400); parts.push({ x: 18 + Math.random() * 2, y: 4, vx: 0.03, vy: -0.012, life: 1, kind: 'z' }); }
      } else {
        ORG.x = catX;
        const walking = mode === 'walkToBed' || mode === 'walkFromBed';
        const info = drawCat({ t, blink, walk: walking ? Math.floor(now / 170) % 2 : undefined, groom: mode === 'groom' ? groomPose(now) : null }, pal);
        accessories(info, level, f, kind);
        if (level >= 3 && Math.floor(tick / 5) % 4 === 0) px(14, info.top, '#fff6b0');
      }
      ORG.x = 9;
    } else {
      ORG.x = 9;
      const info = kind === 'slime' ? drawSlime(f, blink, pal) : drawPlant(f, blink, pal, level, tick);
      accessories(info, level, f, kind);
      if (level >= 3 && kind !== 'plant' && Math.floor(tick / 5) % 4 === 0) px(14, info.top, '#fff6b0');
    }
    parts.forEach((p) => { p.y += p.vy * 3; p.x += p.vx; p.life -= p.kind === 'z' ? 0.008 : 0.02; });
    parts = parts.filter((p) => p.life > 0);
    drawParts();
  }

  const petCx = () => (st && st.pet.kind === 'cat' ? (mode === 'sleep' ? 26 : catX + 8) : 17);
  cv.addEventListener('click', () => burst('heart', 4, petCx()));

  function update(s) {
    st = s;
    const info = levelInfo(s.pet.xp);
    $('.pet-name').textContent = s.pet.name;
    $('.pet-lv').textContent = ` Lv ${info.level}`;
    $('.bar i').style.width = Math.round(info.pct * 100) + '%';
    $('.pet-pill').title = `${info.into} / ${info.need} XP to next level`;
    if (lastXp !== null && s.pet.xp > lastXp) {
      burst('heart', 6, petCx());
      stage.classList.remove('hop'); void stage.offsetWidth; stage.classList.add('hop');
      if (info.level > lastLevel) {
        burst('star', 10, petCx());
        const b = $('.pet-banner');
        b.textContent = s.pet.kind === 'plant' ? 'Grew taller!' : `Level ${info.level}!`;
        b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
      }
    }
    lastXp = s.pet.xp; lastLevel = info.level;
  }

  setInterval(frame, 70);
  return { update };
});
