Wingits.register('pet', ({ root, api }) => {
  const { levelInfo } = WingitsProgress;
  const { esc } = Wingits;

  /* ---------- pixel art ---------- */
  const W = 24, H = 24, OX = 4, OY = 6, SCALE = 6; // 16x16 sprite placed inside a 24x24 canvas

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
  const px = (x, y, c) => { ctx.fillStyle = c; ctx.fillRect(x + OX, y + OY, 1, 1); };
  const rect = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x + OX, y + OY, w, h); };

  // Each drawer returns the y of the top of the creature (for hats) and neck metrics for wings.
  function drawCat(f, blink, pal) {
    for (let y = 0; y < CAT.length; y++) for (let x = 0; x < 16; x++) {
      const ch = CAT[y][x];
      if (ch !== '.') px(x, y, pal[ch]);
    }
    if (blink) for (const x of [3, 4, 11, 12]) px(x, 6, pal.o);
    // tail: two frames
    const tail = f ? [[15, 9], [15, 10], [15, 11], [14, 12]] : [[15, 11], [15, 12], [15, 13], [14, 14]];
    tail.forEach(([x, y]) => px(x, y, pal.f));
    return { top: 1, mid: 11 };
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

  /* ---------- particles (hearts / stars) ---------- */
  const HEART = ['.x.x.', 'xxxxx', 'xxxxx', '.xxx.', '..x..'];
  const STAR = ['..x..', '..x..', 'xxxxx', '..x..', '..x..'];
  let parts = [];
  function burst(kind, n) {
    for (let i = 0; i < n; i++) parts.push({ x: 4 + Math.random() * 14, y: 10 + Math.random() * 6, vy: -(0.12 + Math.random() * 0.14), vx: (Math.random() - .5) * .12, life: 1, kind, c: kind === 'heart' ? '#ff6f91' : '#ffd24d' });
  }
  function drawParts() {
    for (const p of parts) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 1.4));
      ctx.fillStyle = p.c;
      const sp = p.kind === 'heart' ? HEART : STAR;
      sp.forEach((row, y) => [...row].forEach((c, x) => { if (c === 'x') ctx.fillRect(Math.round(p.x) + x, Math.round(p.y) + y, 1, 1); }));
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

  let st = null, tick = 0, blinkUntil = 0, lastXp = null, lastLevel = null;

  function frame() {
    tick++;
    if (!st) return;
    const kind = st.pet.kind;
    const level = levelInfo(st.pet.xp).level;
    const f = Math.floor(tick / 6) % 2;
    if (tick % 38 === 0) blinkUntil = tick + 2;
    ctx.clearRect(0, 0, W, H);
    const pal = PAL[kind];
    const blink = tick < blinkUntil;
    const info = kind === 'cat' ? drawCat(f, blink, pal) : kind === 'slime' ? drawSlime(f, blink, pal) : drawPlant(f, blink, pal, level, tick);
    accessories(info, level, f, kind);
    if (level >= 3 && kind !== 'plant' && Math.floor(tick / 5) % 4 === 0) { px(14, info.top, '#fff6b0'); }
    parts.forEach((p) => { p.y += p.vy * 3; p.x += p.vx; p.life -= 0.02; });
    parts = parts.filter((p) => p.life > 0);
    drawParts();
  }

  cv.addEventListener('click', () => burst('heart', 4));

  function update(s) {
    st = s;
    const info = levelInfo(s.pet.xp);
    $('.pet-name').textContent = s.pet.name;
    $('.pet-lv').textContent = ` Lv ${info.level}`;
    $('.bar i').style.width = Math.round(info.pct * 100) + '%';
    $('.pet-pill').title = `${info.into} / ${info.need} XP to next level`;
    if (lastXp !== null && s.pet.xp > lastXp) {
      burst('heart', 6);
      stage.classList.remove('hop'); void stage.offsetWidth; stage.classList.add('hop');
      if (info.level > lastLevel) {
        burst('star', 10);
        const b = $('.pet-banner');
        b.textContent = s.pet.kind === 'plant' ? 'Grew taller!' : `Level ${info.level}!`;
        b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
      }
    }
    lastXp = s.pet.xp; lastLevel = info.level;
  }

  setInterval(frame, 90);
  return { update };
});
