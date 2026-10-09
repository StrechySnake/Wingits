Wingits.register('clock', (ctx) => {
  const { root, api } = ctx;
  // 24-hour ("military") vs 12-hour is a global setting, changed in the main window or by double-click.
  const is24 = () => ctx.state.settings.clock24 !== false;
  root.innerHTML = `
    <div class="clock">
      <div class="greet label"></div>
      <div class="time"><span class="hm"></span><span class="sec"></span><span class="ampm"></span></div>
      <div class="date"></div>
    </div>`;
  const $ = (s) => root.querySelector(s);
  const el = { greet: $('.greet'), hm: $('.hm'), sec: $('.sec'), ampm: $('.ampm'), date: $('.date') };
  const pad = (n) => String(n).padStart(2, '0');
  let lastDate = '';

  function tick() {
    const d = new Date();
    const h24 = is24();
    const h = h24 ? d.getHours() : (d.getHours() % 12 || 12);
    el.hm.textContent = `${h24 ? pad(h) : h}:${pad(d.getMinutes())}`;
    el.sec.textContent = pad(d.getSeconds());
    el.ampm.textContent = h24 ? '' : (d.getHours() < 12 ? 'AM' : 'PM');
    const hr = d.getHours();
    el.greet.textContent = hr < 5 ? 'Late night' : hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
    const date = d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
    if (date !== lastDate) { el.date.textContent = date; lastDate = date; }
  }

  root.addEventListener('dblclick', () => api.setSettings({ clock24: !is24() }));
  root.title = 'Double-click to switch 12/24-hour';
  tick();
  setInterval(tick, 500);
  return { update: tick };
});
