Wingits.register('pomodoro', ({ root, inst, setInst }) => {
  const { icons } = Wingits;
  const MODES = { focus: { label: 'Focus', min: 25 }, short: { label: 'Short', min: 5 }, long: { label: 'Long', min: 15 } };
  const R = 62, C = 2 * Math.PI * R;

  root.innerHTML = `
    <div class="pomo">
      <div class="seg pomo-modes">${Object.entries(MODES).map(([k, m]) => `<button data-mode="${k}">${m.label}</button>`).join('')}</div>
      <div class="ring">
        <svg viewBox="0 0 140 140"><circle class="track" cx="70" cy="70" r="${R}"/><circle class="val" cx="70" cy="70" r="${R}" stroke-dasharray="${C}" stroke-dashoffset="0"/></svg>
        <div class="ring-text"><div class="pomo-time">25:00</div><div class="pomo-sub muted">Session 1</div></div>
      </div>
      <div class="pomo-ctl">
        <button class="round-btn" data-act="reset" title="Reset">${icons.reset}</button>
        <button class="round-btn primary" data-act="toggle" title="Start / pause">${icons.play}</button>
        <button class="round-btn" data-act="skip" title="Skip">${icons.next}</button>
      </div>
    </div>`;
  const $ = (s) => root.querySelector(s);
  let fired = false;

  // Persisted: { mode, running, endsAt, remaining (ms, when paused), sessions }
  const get = () => {
    const d = inst();
    return { mode: d.mode || 'focus', running: !!d.running, endsAt: d.endsAt || 0, remaining: d.remaining ?? MODES[d.mode || 'focus'].min * 60000, sessions: d.sessions || 0 };
  };
  const total = (mode) => MODES[mode].min * 60000;

  function chime() {
    try {
      const ac = new AudioContext();
      [660, 880, 1100].forEach((f, i) => {
        const o = ac.createOscillator(), g = ac.createGain();
        o.type = 'sine'; o.frequency.value = f;
        const t = ac.currentTime + i * 0.22;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.18, t + 0.04);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
        o.connect(g).connect(ac.destination);
        o.start(t); o.stop(t + 1);
      });
    } catch {}
  }

  function setMode(mode, keepSessions = true) {
    setInst({ mode, running: false, endsAt: 0, remaining: total(mode), sessions: keepSessions ? get().sessions : 0 });
  }

  function complete() {
    const s = get();
    chime();
    try { new Notification('Wingits', { body: s.mode === 'focus' ? 'Focus session complete — take a break 🌿' : 'Break over — ready to focus?' }); } catch {}
    if (s.mode === 'focus') {
      const sessions = s.sessions + 1;
      setInst({ mode: sessions % 4 === 0 ? 'long' : 'short', running: false, endsAt: 0, remaining: total(sessions % 4 === 0 ? 'long' : 'short'), sessions });
    } else setMode('focus');
  }

  root.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const s = get();
    if (b.dataset.mode) return setMode(b.dataset.mode);
    if (b.dataset.act === 'toggle') {
      if (s.running) setInst({ running: false, endsAt: 0, remaining: Math.max(0, s.endsAt - Date.now()) });
      else setInst({ running: true, endsAt: Date.now() + s.remaining });
    } else if (b.dataset.act === 'reset') setMode(s.mode);
    else if (b.dataset.act === 'skip') {
      if (s.mode === 'focus') setMode('short'); else setMode('focus');
    }
  });

  function render() {
    const s = get();
    const left = s.running ? Math.max(0, s.endsAt - Date.now()) : s.remaining;
    const secs = Math.ceil(left / 1000);
    $('.pomo-time').textContent = `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
    $('.pomo-sub').textContent = s.mode === 'focus' ? `Session ${s.sessions + 1}` : 'Break time';
    $('.val').style.strokeDashoffset = C * (1 - left / total(s.mode));
    $('.val').classList.toggle('break', s.mode !== 'focus');
    $('[data-act=toggle]').innerHTML = s.running ? icons.pause : icons.play;
    root.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('on', b.dataset.mode === s.mode));
    if (!s.running) fired = false;
    else if (left <= 0 && !fired) { fired = true; complete(); }
  }

  setInterval(render, 250);
  return { update: render };
});
