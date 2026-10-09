Wingits.register('countdown', ({ root, inst, setInst }) => {
  const { esc } = Wingits;
  root.innerHTML = `<div class="cd"></div>`;
  const box = root.firstElementChild;
  let editing = false;

  const toLocal = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };

  function render() {
    const { title = '', date = '' } = inst();
    if (editing || !date) {
      editing = true;
      box.innerHTML = `
        <form class="cd-form">
          <div class="label">New event</div>
          <input class="pill-input" name="t" maxlength="40" placeholder="What are you counting to?" value="${esc(title)}">
          <input class="pill-input" name="d" type="date" value="${esc(date)}" required>
          <button class="chip-btn solid" type="submit">Save</button>
        </form>`;
      return;
    }
    const target = toLocal(date);
    const ms = target - new Date();
    const days = Math.ceil(ms / 86400000);
    const big = ms <= 0 && days === 0 ? '🎉' : Math.abs(days);
    const unit = ms <= 0 && days === 0 ? 'Today!' : (Math.abs(days) === 1 ? 'day' : 'days') + (days < 0 ? ' ago' : ' to go');
    const hm = ms > 0 ? `${Math.floor(ms / 3600000) % 24}h ${Math.floor(ms / 60000) % 60}m` : '';
    box.innerHTML = `
      <div class="cd-view" title="Click to edit">
        <div class="label">${esc(title || 'Event')}</div>
        <div class="cd-num">${big}</div>
        <div class="cd-unit">${unit}</div>
        <div class="cd-hm muted">${hm}&nbsp;</div>
      </div>`;
  }

  box.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target;
    editing = false;
    setInst({ title: f.t.value.trim(), date: f.d.value });
  });
  box.addEventListener('click', (e) => { if (e.target.closest('.cd-view')) { editing = true; render(); } });

  render();
  setInterval(() => { if (!editing) render(); }, 30000);
  return { update: () => { if (!editing) render(); } };
});
