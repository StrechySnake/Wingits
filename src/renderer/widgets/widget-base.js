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
      <div class="body" style="height:100%"></div></div>`;
    const card = shell.firstElementChild;
    const root = card.querySelector('.body');
    card.querySelector('.close').addEventListener('click', () => api.removeWidget(id));

    // Drag the whole card; interactive controls opt out.
    const interactive = 'button, input, textarea, select, a, [data-nodrag]';
    card.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.target.closest(interactive)) return;
      const start = { sx: e.screenX, sy: e.screenY, x: window.screenX, y: window.screenY };
      card.setPointerCapture(e.pointerId);
      const move = (ev) => api.moveWidget(id, start.x + ev.screenX - start.sx, start.y + ev.screenY - start.sy);
      const up = () => { card.removeEventListener('pointermove', move); card.removeEventListener('pointerup', up); card.removeEventListener('pointercancel', up); };
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
