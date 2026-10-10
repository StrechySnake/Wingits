/* Boots a widget window: theme, shell, drag handling, per-type module loading. */
(function () {
  const q = new URLSearchParams(location.search);
  const id = q.get('id');
  const type = q.get('type');
  const def = WingitsRegistry.widgets[type];
  const api = window.wingits;

  const factories = {};
  window.Wingits = {
    register(t, factory) { factories[t] = factory; },
    api,
    $: (sel, root = document) => root.querySelector(sel),
    esc: (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
    icons: {
      play: '<svg viewBox="0 0 24 24"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>',
      pause: '<svg viewBox="0 0 24 24"><rect x="6" y="5" width="4.2" height="14" rx="2"/><rect x="13.8" y="5" width="4.2" height="14" rx="2"/></svg>',
      next: '<svg viewBox="0 0 24 24"><path d="M5 6.5v11a1 1 0 0 0 1.5.86l8-5.5a1 1 0 0 0 0-1.72l-8-5.5A1 1 0 0 0 5 6.5z"/><rect x="16" y="5" width="3.4" height="14" rx="1.7"/></svg>',
      prev: '<svg viewBox="0 0 24 24"><path d="M19 6.5v11a1 1 0 0 1-1.5.86l-8-5.5a1 1 0 0 1 0-1.72l8-5.5A1 1 0 0 1 19 6.5z"/><rect x="4.6" y="5" width="3.4" height="14" rx="1.7"/></svg>',
      reset: '<svg viewBox="0 0 24 24"><path d="M12 5a7 7 0 1 1-6.6 4.7.9.9 0 0 1 1.7.6A5.2 5.2 0 1 0 12 6.8V9a.6.6 0 0 1-1 .4L7.6 6.6a.6.6 0 0 1 0-.9L11 2.8a.6.6 0 0 1 1 .5V5z"/></svg>',
      plus: '<svg viewBox="0 0 24 24"><rect x="11" y="5" width="2" height="14" rx="1"/><rect x="5" y="11" width="14" height="2" rx="1"/></svg>',
    },
  };

  function applyTheme(s) {
    document.documentElement.dataset.theme = s.settings.theme;
    document.documentElement.style.setProperty('--alpha', s.settings.opacity);
    document.documentElement.classList.toggle('no-anim', !!(s.dev && s.dev.noAnim));
  }

  async function boot() {
    if (!def) return;
    document.title = def.label;
    let state = await api.getState();
    applyTheme(state);

    const shell = document.getElementById('shell');
    shell.innerHTML = `<div class="card ${def.bare ? 'bare' : ''}" data-type="${type}">
      <button class="close" title="Remove widget" aria-label="Remove widget">×</button>
      <div class="body" style="height:100%"></div>
      <div class="grip" title="Drag to resize · double-click to reset" data-nodrag></div></div>`;
    const card = shell.firstElementChild;
    const root = card.querySelector('.body');
    card.querySelector('.close').addEventListener('click', () => api.removeWidget(id));

    // Real backdrop blur: a transparent window can't see the desktop, so we paint a blurred copy of the
    // wallpaper behind the glass, lined up with where the card is on screen (and re-aligned when it moves).
    if (!def.bare) {
      const wp = document.createElement('div');
      wp.className = 'wp';
      card.prepend(wp);
      let img = null, lastKey = '';
      const rectFor = (d, W) => {
        const iw = W.w, ih = W.h;
        let region = d;
        if (W.style === 'span') {
          const x0 = Math.min(...W.displays.map((q) => q.x)), y0 = Math.min(...W.displays.map((q) => q.y));
          region = { x: x0, y: y0, width: Math.max(...W.displays.map((q) => q.x + q.width)) - x0, height: Math.max(...W.displays.map((q) => q.y + q.height)) - y0 };
        }
        let w, h;
        if (W.style === 'stretch') { w = region.width; h = region.height; }
        else if (W.style === 'center') { w = iw / (d.scaleFactor || 1); h = ih / (d.scaleFactor || 1); }
        else { const k = (W.style === 'fit' ? Math.min : Math.max)(region.width / iw, region.height / ih); w = iw * k; h = ih * k; }
        return { x: region.x + (region.width - w) / 2, y: region.y + (region.height - h) / 2, w, h };
      };
      const place = () => {
        if (!img) return;
        const sc = scale || 1, cw = def.w * sc, ch = def.h * sc;
        const cx = window.screenX + 14, cy = window.screenY + 14;           // the shell is inset 14px in the window
        const mx = cx + cw / 2, my = cy + ch / 2;
        const d = img.displays.find((q) => mx >= q.x && mx < q.x + q.width && my >= q.y && my < q.y + q.height) || img.displays[0];
        const r = rectFor(d, img);
        const key = [cx, cy, sc, r.x, r.y, r.w, r.h].join();
        if (key === lastKey) return;
        lastKey = key;
        wp.style.left = ((r.x - cx) / sc - 1) + 'px';
        wp.style.top = ((r.y - cy) / sc - 1) + 'px';
        wp.style.width = r.w / sc + 'px';
        wp.style.height = r.h / sc + 'px';
      };
      const load = async () => {
        const w = await api.getWallpaper().catch(() => null);
        if (!w) return;
        if (!img || img.url !== w.url) wp.style.backgroundImage = `url("${w.url}")`;
        img = w; lastKey = '';
        card.classList.add('has-wp');
        place();
      };
      load();
      setInterval(load, 60000);          // picks up wallpaper changes / slideshows
      setInterval(place, 150);
    }

    // Cards have a fixed design size; resizing scales them with CSS zoom (clamped per widget type).
    const unlimited = () => !!(state.dev && state.dev.unlimited);
    let scale = WingitsRegistry.clampScale(type, (state.widgets.find((w) => w.id === id) || {}).scale || 1, unlimited());
    let resizing = false;
    const applyScale = (s) => { scale = s; card.style.zoom = s; };
    card.style.width = def.w + 'px';
    card.style.height = def.h + 'px';
    applyScale(scale);

    const grip = card.querySelector('.grip');
    grip.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      grip.setPointerCapture(e.pointerId);
      resizing = true;
      const s0 = scale, sx = e.screenX, sy = e.screenY;
      let raf = 0, next = s0;
      const move = (ev) => {
        const dx = ev.screenX - sx, dy = ev.screenY - sy;
        next = WingitsRegistry.clampScale(type, s0 + (dx * def.w + dy * def.h) / (def.w * def.w + def.h * def.h), unlimited());
        if (!raf) raf = requestAnimationFrame(() => { raf = 0; applyScale(next); api.resizeWidget(id, next); });
      };
      const up = () => {
        resizing = false;
        grip.removeEventListener('pointermove', move);
        grip.removeEventListener('pointerup', up);
        grip.removeEventListener('pointercancel', up);
      };
      grip.addEventListener('pointermove', move);
      grip.addEventListener('pointerup', up);
      grip.addEventListener('pointercancel', up);
    });
    grip.addEventListener('dblclick', () => { applyScale(1); api.resizeWidget(id, 1); });

    // Drag the whole card; interactive controls opt out. Pointer capture only starts once the
    // pointer actually moves, so plain clicks still reach the element that was pressed.
    const interactive = 'button, input, textarea, select, a, [data-nodrag]';
    card.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.target.closest(interactive)) return;
      const start = { sx: e.screenX, sy: e.screenY, x: window.screenX, y: window.screenY };
      let dragging = false;
      const move = (ev) => {
        const dx = ev.screenX - start.sx, dy = ev.screenY - start.sy;
        if (!dragging) {
          if (Math.hypot(dx, dy) < 4) return;
          dragging = true;
          card.setPointerCapture(ev.pointerId);
        }
        api.moveWidget(id, start.x + dx, start.y + dy);
      };
      const up = () => {
        card.removeEventListener('pointermove', move);
        card.removeEventListener('pointerup', up);
        card.removeEventListener('pointercancel', up);
      };
      card.addEventListener('pointermove', move);
      card.addEventListener('pointerup', up);
      card.addEventListener('pointercancel', up);
    });

    await loadScript(`types/${type}.js`);
    const factory = factories[type];
    if (!factory) return;

    const ctx = {
      id, type, root, card, api,
      get state() { return state; },
      inst: () => state.inst[id] || {},
      setInst: (patch) => api.setInst(id, patch),
    };
    const widget = (await factory(ctx)) || {};

    api.onState((s) => {
      const prev = state;
      state = s;
      applyTheme(s);
      // keep the zoom in step with the stored scale (it changes when dev mode is switched off)
      const rec = s.widgets.find((w) => w.id === id);
      if (rec && !resizing && Math.abs(WingitsRegistry.clampScale(type, rec.scale || 1, true) - scale) > 0.001) applyScale(WingitsRegistry.clampScale(type, rec.scale || 1, true));
      widget.update?.(s, prev);
    });
    widget.update?.(state, state);
  }

  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = rej;
      document.body.appendChild(s);
    });
  }

  boot();
})();
