(() => {
  const $ = (id) => document.getElementById(id);
  const pill = $('pill');
  const FOCUS = '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="6"/><circle cx="8" cy="8" r="2.4"/></svg>';        // focus timer: a target
  const NORMAL = '<svg viewBox="0 0 16 16"><circle cx="8" cy="9" r="5.5"/><path d="M8 9V6M6 1.8h4"/></svg>';          // normal timer: a stopwatch
  const PLAY = '<svg viewBox="0 0 12 12"><path d="M3 1.5v9l7.5-4.5z"/></svg>';
  const PAUSE_SVG = '<svg viewBox="0 0 12 12"><rect x="2" y="1.5" width="2.8" height="9" rx="1"/><rect x="7.2" y="1.5" width="2.8" height="9" rx="1"/></svg>';
  let cur = null;

  function render() {
    if (!cur) return;
    const left = cur.running ? Math.max(0, cur.endsAt - Date.now()) : cur.remaining;
    const s = Math.ceil(left / 1000);
    $('time').textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }
  window.wingits.onTimerBar((s) => {
    const first = !cur;
    cur = s;
    $('ico').innerHTML = s.mode === 'focus' ? FOCUS : NORMAL;
    pill.classList.toggle('normal', s.mode !== 'focus');
    pill.classList.toggle('paused', !s.running);
    $('b-toggle').innerHTML = s.running ? PAUSE_SVG : PLAY;
    $('b-toggle').title = s.running ? 'Pause' : 'Resume';
    render();
    if (first) requestAnimationFrame(() => pill.classList.add('in'));
  });
  setInterval(render, 250);

  // The window ignores the mouse except over the pill, so it never blocks what's underneath.
  let inside = false, closeT = 0;
  const setInside = (v) => { if (v !== inside) { inside = v; window.wingits.timerBarCmd(v ? 'mouse-in' : 'mouse-out'); } };
  document.addEventListener('mousemove', (e) => {
    const over = !!e.target.closest('.pill');
    clearTimeout(closeT);
    if (over) { setInside(true); pill.classList.add('open'); }
    else { closeT = setTimeout(() => { pill.classList.remove('open'); setInside(false); }, 160); }
  });
  document.addEventListener('mouseleave', () => { pill.classList.remove('open'); setInside(false); });
  $('b-toggle').addEventListener('click', () => window.wingits.timerBarCmd('toggle'));
  $('b-stop').addEventListener('click', () => window.wingits.timerBarCmd('stop'));
  $('b-close').addEventListener('click', () => window.wingits.timerBarCmd('close'));
})();
