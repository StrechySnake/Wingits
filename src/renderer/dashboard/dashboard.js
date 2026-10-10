(async function () {
  const api = window.wingits;
  const { PAD, widgets: DEFS } = WingitsRegistry;
  const { levelInfo } = WingitsProgress;
  const $ = (s) => document.querySelector(s);
  const screenEl = $('#screen');

  let state = await api.getState();
  const scr = await api.getScreen();
  const B = scr.bounds;                       // primary work area (DIPs)
  screenEl.style.aspectRatio = `${scr.full.width} / ${scr.full.height}`;
  let dragging = false;

  /* ---------- library ---------- */
  const lib = $('#library');
  lib.innerHTML = Object.entries(DEFS).map(([type, d]) => `
    <div class="lib-item" draggable="true" data-type="${type}" style="--h:${d.hue}">
      <div class="lib-icon">${d.icon}</div>
      <div class="lib-text"><b>${d.label}</b><span>${d.desc}</span></div>
      <button class="lib-add" title="Add to desktop" aria-label="Add ${d.label}">+</button>
    </div>`).join('');

  const scale = () => screenEl.clientWidth / B.width;
  const clamp = (v, a, b) => Math.min(Math.max(v, a), Math.max(a, b));

  function nextSpot(type) {
    const d = DEFS[type];
    const n = state.widgets.length;
    return {
      x: B.x + B.width - d.w - PAD * 2 - 40 - (n % 5) * 34,
      y: B.y + 40 + (n % 6) * 40,
    };
  }
  async function add(type, x, y) {
    const d = DEFS[type];
    if (d.single && state.widgets.some((w) => w.type === type)) return;
    const p = x === undefined ? nextSpot(type) : { x, y };
    await api.addWidget(type, p.x, p.y);
  }

  lib.addEventListener('click', (e) => { const b = e.target.closest('.lib-add'); if (b) add(b.closest('.lib-item').dataset.type); });
  lib.addEventListener('dragstart', (e) => {
    const item = e.target.closest('.lib-item');
    if (!item || item.classList.contains('disabled')) return e.preventDefault();
    e.dataTransfer.setData('text/wingits', item.dataset.type);
    e.dataTransfer.effectAllowed = 'copy';
  });

  screenEl.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; screenEl.classList.add('over'); });
  screenEl.addEventListener('dragleave', (e) => { if (e.target === screenEl) screenEl.classList.remove('over'); });
  screenEl.addEventListener('drop', (e) => {
    e.preventDefault();
    screenEl.classList.remove('over');
    const type = e.dataTransfer.getData('text/wingits');
    if (!DEFS[type]) return;
    const r = screenEl.getBoundingClientRect(), s = scale(), d = DEFS[type];
    const w = d.w + PAD * 2, h = d.h + PAD * 2;
    add(type, B.x + clamp((e.clientX - r.left) / s - w / 2, 0, B.width - w), B.y + clamp((e.clientY - r.top) / s - h / 2, 0, B.height - h));
  });

  /* ---------- desktop preview tiles ---------- */
  function placeTile(tile, w) {
    const s = scale(), size = WingitsRegistry.windowSize(w.type, w.scale || 1);
    tile.style.left = (w.x - B.x) * s + 'px';
    tile.style.top = (w.y - B.y) * s + 'px';
    tile.style.width = size.width * s + 'px';
    tile.style.height = size.height * s + 'px';
  }

  function renderTiles() {
    const have = new Map([...screenEl.querySelectorAll('.tile')].map((t) => [t.dataset.id, t]));
    for (const w of state.widgets) {
      let tile = have.get(w.id);
      if (!tile) {
        const d = DEFS[w.type];
        tile = document.createElement('div');
        tile.className = 'tile';
        tile.dataset.id = w.id;
        tile.style.setProperty('--h', d.hue);
        tile.innerHTML = `<span class="t-ico">${d.icon}</span><span class="t-name">${d.label}</span><button class="t-x" aria-label="Remove">×</button>`;
        screenEl.appendChild(tile);
      }
      have.delete(w.id);
      if (!dragging) placeTile(tile, w);
    }
    have.forEach((t) => t.remove());
    screenEl.classList.toggle('has-widgets', state.widgets.length > 0);
    document.querySelectorAll('.lib-item').forEach((el) => {
      const d = DEFS[el.dataset.type];
      el.classList.toggle('disabled', !!d.single && state.widgets.some((w) => w.type === el.dataset.type));
    });
  }

  screenEl.addEventListener('pointerdown', (e) => {
    const tile = e.target.closest('.tile');
    if (!tile || e.button !== 0) return;
    if (e.target.closest('.t-x')) { api.removeWidget(tile.dataset.id); return; }
    const w = state.widgets.find((q) => q.id === tile.dataset.id);
    if (!w) return;
    const s = scale();
    const { width: ww, height: hh } = WingitsRegistry.windowSize(w.type, w.scale || 1);
    const ox = e.clientX, oy = e.clientY, sx = w.x, sy = w.y;
    dragging = true;
    tile.classList.add('dragging');
    tile.setPointerCapture(e.pointerId);
    const move = (ev) => {
      w.x = Math.round(clamp(sx + (ev.clientX - ox) / s, B.x - ww + 60, B.x + B.width - 60));
      w.y = Math.round(clamp(sy + (ev.clientY - oy) / s, B.y, B.y + B.height - 60));
      placeTile(tile, w);
      api.moveWidget(w.id, w.x, w.y);
    };
    const up = () => {
      tile.classList.remove('dragging');
      tile.removeEventListener('pointermove', move);
      tile.removeEventListener('pointerup', up);
      tile.removeEventListener('pointercancel', up);
      setTimeout(() => { dragging = false; renderTiles(); }, 250);
    };
    tile.addEventListener('pointermove', move);
    tile.addEventListener('pointerup', up);
    tile.addEventListener('pointercancel', up);
  });
  window.addEventListener('resize', renderTiles);

  /* ---------- settings ---------- */
  const seg = (sel, onPick) => $(sel).addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) onPick(b.dataset.v); });
  const setSegOn = (sel, v) => document.querySelectorAll(`${sel} button`).forEach((b) => b.classList.toggle('on', b.dataset.v === v));

  seg('#seg-theme', (v) => api.setSettings({ theme: v }));
  seg('#seg-clock', (v) => api.setSettings({ clock24: v === '24' }));
  seg('#seg-units', (v) => api.setSettings({ units: v }));
  seg('#seg-pet', (v) => api.setPet({ kind: v }));
  $('#rng-opacity').addEventListener('input', (e) => api.setSettings({ opacity: +e.target.value }));
  $('#chk-top').addEventListener('change', (e) => api.setSettings({ alwaysOnTop: e.target.checked }));
  $('#chk-update').addEventListener('change', (e) => { api.setSettings({ autoUpdateCheck: e.target.checked }); if (e.target.checked) api.checkUpdate(); });
  $('#chk-login').addEventListener('change', (e) => api.setSettings({ launchAtLogin: e.target.checked }));
  const commit = (sel, fn) => { const el = $(sel); el.addEventListener('change', () => fn(el.value)); el.addEventListener('keydown', (e) => { if (e.key === 'Enter') el.blur(); }); };
  commit('#inp-city', (v) => api.setSettings({ city: v.trim() }));
  commit('#inp-pet', (v) => api.setPet({ name: v }));
  $('#btn-visible').addEventListener('click', () => api.setWidgetsVisible(!state.settings.widgetsVisible));
  $('#btn-min').addEventListener('click', () => api.minimize());
  $('#btn-quit').addEventListener('click', () => api.quit());

  function renderSettings() {
    const s = state.settings;
    document.documentElement.dataset.theme = s.theme;
    setSegOn('#seg-theme', s.theme);
    setSegOn('#seg-clock', s.clock24 === false ? '12' : '24');
    setSegOn('#seg-units', s.units);
    setSegOn('#seg-pet', state.pet.kind);
    $('#rng-opacity').value = s.opacity;
    $('#out-opacity').textContent = Math.round(s.opacity * 100) + '%';
    $('#chk-top').checked = s.alwaysOnTop;
    $('#chk-login').checked = s.launchAtLogin;
    $('#chk-update').checked = s.autoUpdateCheck !== false;
    $('#btn-visible').textContent = s.widgetsVisible ? 'Hide widgets' : 'Show widgets';
    if (document.activeElement !== $('#inp-city')) $('#inp-city').value = s.city;
    if (document.activeElement !== $('#inp-pet')) $('#inp-pet').value = state.pet.name;
    const info = levelInfo(state.pet.xp);
    $('#pet-lv').textContent = `Level ${info.level}`;
    $('#pet-xp').textContent = `${info.into} / ${info.need} XP`;
    $('#pet-bar').style.width = Math.round(info.pct * 100) + '%';
  }

  /* ---------- updates ---------- */
  let upd = await api.getUpdate();
  let dismissed = '';
  function renderUpdate() {
    const banner = $('#update-banner');
    banner.hidden = !(upd.status === 'available' && upd.latest !== dismissed);
    $('#upd-ver').textContent = upd.latest ? 'v' + upd.latest : '';
    $('#upd-status').textContent = {
      idle: `v${upd.current}`,
      checking: 'Checking…',
      'up-to-date': `v${upd.current} · up to date`,
      available: `v${upd.latest} available`,
      error: `v${upd.current} · couldn't check`,
    }[upd.status];
    $('#upd-check').disabled = upd.status === 'checking';
  }
  $('#upd-get').addEventListener('click', () => api.openUpdate());
  $('#upd-x').addEventListener('click', () => { dismissed = upd.latest; renderUpdate(); });
  $('#upd-check').addEventListener('click', () => api.checkUpdate());
  api.onUpdate((i) => { upd = i; renderUpdate(); });

  /* ---------- developer mode (changes are never saved; turning it off restores everything) ---------- */
  $('#dev-hour').innerHTML += Array.from({ length: 24 }, (_, h) => `<option value="${h}">${String(h).padStart(2, '0')}:00</option>`).join('');
  $('#chk-dev').addEventListener('change', (e) => api.devEnable(e.target.checked));
  $('#dev-off').addEventListener('click', () => api.devEnable(false));
  $('#dev-level-set').addEventListener('click', () => api.devSetLevel($('#dev-level').value));
  $('#dev-level').addEventListener('keydown', (e) => { if (e.key === 'Enter') api.devSetLevel(e.target.value); });
  $('#dev-level-chips').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) api.devSetLevel(b.dataset.l); });
  $('#dev-hour').addEventListener('change', (e) => api.devSet({ hour: e.target.value }));
  $('#dev-weather').addEventListener('change', (e) => api.devSet({ weather: e.target.value }));
  $('#dev-night').addEventListener('change', (e) => api.devSet({ night: e.target.checked }));
  $('#dev-noanim').addEventListener('change', (e) => api.devSet({ noAnim: e.target.checked }));
  $('#dev-unlimited').addEventListener('change', (e) => api.devSet({ unlimited: e.target.checked }));
  $('#dev-fast').addEventListener('change', (e) => api.devSet({ fastTimers: e.target.checked }));
  $('#dev-pulses').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) api.devPulse(b.dataset.p); });
  $('#dev-tasks').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) api.devTasks(b.dataset.t); });

  function renderDev() {
    const d = state.dev || { enabled: false };
    $('#chk-dev').checked = d.enabled;
    $('#dev-panel').hidden = !d.enabled;
    $('#dev-banner').hidden = !d.enabled;
    document.documentElement.classList.toggle('no-anim', !!d.noAnim);
    if (!d.enabled) return;
    $('#dev-hour').value = d.hour === null ? '' : String(d.hour);
    $('#dev-weather').value = d.weather === null ? '' : String(d.weather);
    $('#dev-night').checked = d.night; $('#dev-noanim').checked = d.noAnim;
    $('#dev-unlimited').checked = d.unlimited; $('#dev-fast').checked = d.fastTimers;
    if (document.activeElement !== $('#dev-level')) $('#dev-level').value = levelInfo(state.pet.xp).level;
  }

  function render() { renderDev(); renderSettings(); renderTiles(); renderUpdate(); }
  api.onState((s) => { state = s; render(); });
  render();
})();
