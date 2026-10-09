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

    // Cards have a fixed design size; resizing scales them with CSS zoom (clamped per widget type).
    const [minS, maxS] = WingitsRegistry.scaleRange(type);
    let scale = WingitsRegistry.clampScale(type, (state.widgets.find((w) => w.id === id) || {}).scale || 1);
    const applyScale = (s) => { scale = s; card.style.zoom = s; };
    card.style.width = def.w + 'px';
    card.style.height = def.h + 'px';
    applyScale(scale);

    const grip = card.querySelector('.grip');
    grip.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      grip.setPointerCapture(e.pointerId);
      const s0 = scale, sx = e.screenX, sy = e.screenY;
      let raf = 0, next = s0;
      const move = (ev) => {
        const dx = ev.screenX - sx, dy = ev.screenY - sy;
        next = WingitsRegistry.clampScale(type, s0 + (dx * def.w + dy * def.h) / (def.w * def.w + def.h * def.h));
        if (!raf) raf = requestAnimationFrame(() => { raf = 0; applyScale(next); api.resizeWidget(id, next); });
      };
      const up = () => {
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
