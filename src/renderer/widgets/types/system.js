Wingits.register('system', ({ root, api }) => {
  const R = 34, C = 2 * Math.PI * R;
  const dial = (name) => `
    <div class="dial" data-k="${name}">
      <svg viewBox="0 0 84 84">
        <circle class="track" cx="42" cy="42" r="${R}"/>
        <circle class="val" cx="42" cy="42" r="${R}" stroke-dasharray="${C}" stroke-dashoffset="${C}"/>
      </svg>
      <div class="dial-text"><b>0</b><small>%</small></div>
      <div class="dial-label label">${name}</div>
      <div class="dial-sub muted">&nbsp;</div>
    </div>`;
  root.innerHTML = `<div class="sys">${dial('CPU')}${dial('RAM')}</div>`;

  function paint(k, pct, sub) {
    const d = root.querySelector(`[data-k="${k}"]`);
    const hue = 160 - Math.min(pct, 100) * 1.3; // green -> amber -> rose
    const v = d.querySelector('.val');
    v.style.strokeDashoffset = C * (1 - pct / 100);
    v.style.stroke = `hsl(${hue} 80% 68%)`;
    d.querySelector('b').textContent = pct;
    d.querySelector('.dial-sub').textContent = sub || ' ';
  }

  async function poll() {
    try {
      const s = await api.getStats();
      paint('CPU', s.cpu, '');
      paint('RAM', s.ram, `${s.usedGB.toFixed(1)} / ${s.totalGB.toFixed(0)} GB`);
    } catch {}
  }
  poll();
  setInterval(poll, 1500);
  return {};
});
