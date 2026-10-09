Wingits.register('music', ({ root, api }) => {
  const BARS = 30;

  root.innerHTML = `
    <div class="mp">
      <div class="mp-artwrap">
        <img class="mp-glow" alt="">
        <div class="mp-art"><span class="mp-note">♪</span><img class="mp-img" alt=""></div>
      </div>
      <div class="mp-body">
        <div class="mp-meta">
          <div class="mp-title">Nothing playing</div>
          <div class="mp-artist">Play something in Spotify, your browser, VLC…</div>
        </div>
        <canvas class="mp-viz" title="Click to re-link system audio"></canvas>
        <div class="mp-progress"><span class="t-cur">0:00</span><div class="mp-bar"><i></i></div><span class="t-len">0:00</span></div>
      </div>
    </div>`;
  const $ = (s) => root.querySelector(s);
  const art = $('.mp-art'), img = $('.mp-img'), glow = $('.mp-glow'), cv = $('.mp-viz');
  const fmt = (t) => (isFinite(t) && t > 0 ? `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}` : '0:00');

  let m = { active: false };
  let sampledAt = performance.now();
  const arts = new Map(); // key -> data URL

  function prettyApp(id = '') {
    const n = id.includes('!') ? id.split('!').pop() : id.replace(/\.exe$/i, '').split('_')[0];
    return n.replace(/^.*\./, '').replace(/([a-z])([A-Z])/g, '$1 $2') || '';
  }
  function gradientFor(text) {
    let h = 0; for (const c of text) h = (h * 31 + c.charCodeAt(0)) % 360;
    return `linear-gradient(135deg, hsl(${h} 70% 66%), hsl(${(h + 60) % 360} 70% 58%))`;
  }

  function paintArt() {
    const url = m.active ? arts.get(m.key) : null;
    if (url) {
      if (img.getAttribute('src') !== url) { img.src = url; glow.src = url; }
      art.classList.add('has-img'); glow.classList.add('on'); art.style.background = '';
    } else {
      img.removeAttribute('src'); glow.removeAttribute('src');
      art.classList.remove('has-img'); glow.classList.remove('on');
      art.style.background = m.active ? gradientFor(m.title || '') : '';
    }
  }

  function setMedia(next) {
    const trackChanged = next.key !== m.key;
    m = next;
    sampledAt = performance.now();
    if (!m.supported) {
      $('.mp-title').textContent = 'Windows only';
      $('.mp-artist').textContent = 'Media detection needs Windows 10 or newer.';
    } else if (m.active) {
      $('.mp-title').textContent = m.title || 'Unknown title';
      $('.mp-artist').textContent = [m.artist || prettyApp(m.app), m.artist && prettyApp(m.app)].filter(Boolean).join(' · ');
      if (m.artist === '' && m.album) $('.mp-artist').textContent = m.album;
    } else {
      $('.mp-title').textContent = 'Nothing playing';
      $('.mp-artist').textContent = 'Play something in Spotify, your browser, VLC…';
    }
    root.classList.toggle('idle', !m.active);
    if (trackChanged) paintArt();
    if (m.playing) startCapture(); else scheduleStop();
  }

  api.onMedia(setMedia);
  api.onMediaArt(({ key, art: a }) => { arts.set(key, a); if (arts.size > 6) arts.delete(arts.keys().next().value); if (key === m.key) paintArt(); });
  api.getMedia().then(({ state, art: a }) => { if (a) arts.set(a.key, a.art); setMedia(state); });

  /* progress (interpolated between helper updates) */
  setInterval(() => {
    if (!m.active) { $('.mp-bar i').style.width = '0%'; $('.t-cur').textContent = '0:00'; $('.t-len').textContent = '0:00'; return; }
    let pos = m.position || 0;
    if (m.playing) pos += (performance.now() - sampledAt) / 1000;
    if (m.duration) pos = Math.min(pos, m.duration);
    $('.mp-bar i').style.width = (m.duration ? (pos / m.duration) * 100 : 0) + '%';
    $('.t-cur').textContent = fmt(pos);
    $('.t-len').textContent = fmt(m.duration);
  }, 250);

  /* ---------- system-audio visualizer ---------- */
  let ac = null, analyser = null, stream = null, freq = null, stopTimer = 0, capturing = false;

  async function startCapture() {
    clearTimeout(stopTimer);
    if (stream || capturing) return;
    capturing = true;
    try {
      const s = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      s.getVideoTracks().forEach((t) => t.stop());
      if (!s.getAudioTracks().length) throw new Error('no loopback audio');
      ac = new AudioContext();
      const src = ac.createMediaStreamSource(s);
      analyser = ac.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.78;
      src.connect(analyser); // analysis only: never routed to the speakers
      freq = new Uint8Array(analyser.frequencyBinCount);
      stream = s;
    } catch { stream = null; }
    capturing = false;
  }
  function stopCapture() {
    if (stream) stream.getTracks().forEach((t) => t.stop());
    stream = null; analyser = null;
    if (ac) ac.close().catch(() => {});
    ac = null;
  }
  function scheduleStop() { clearTimeout(stopTimer); stopTimer = setTimeout(stopCapture, 8000); }
  window.__startCapture = startCapture;
  cv.addEventListener('click', () => { stopCapture(); startCapture(); });

  const levels = new Float32Array(BARS);
  let bass = 0, t0 = performance.now();
  function frame() {
    const dpr = 2;
    const w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== w * dpr) { cv.width = w * dpr; cv.height = h * dpr; }
    const c = cv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, w, h);
    const t = (performance.now() - t0) / 1000;
    const live = analyser && m.playing;
    if (live) analyser.getByteFrequencyData(freq);
    let b = 0;
    for (let i = 0; i < BARS; i++) {
      let v;
      if (live) {
        // log-ish spacing over the lower ~10kHz of the spectrum
        const lo = Math.floor(Math.pow(i / BARS, 1.7) * 90) + 1, hi = Math.max(lo + 1, Math.floor(Math.pow((i + 1) / BARS, 1.7) * 90) + 2);
        let sum = 0; for (let k = lo; k < hi; k++) sum += freq[k];
        v = Math.min(1, (sum / (hi - lo) / 255) * 1.25);
      } else if (m.playing) { // no loopback available: gentle synthetic motion
        v = 0.25 + 0.2 * Math.sin(t * 3 + i * 0.7) * Math.sin(t * 1.3 + i * 0.25) + 0.15 * Math.sin(t * 5.1 + i);
      } else v = 0.04;
      levels[i] += (v - levels[i]) * (v > levels[i] ? 0.5 : 0.16);
      if (i < 4) b += levels[i] / 4;
    }
    bass += (b - bass) * 0.3;

    const gap = 3, bw = (w - gap * (BARS - 1)) / BARS;
    const g = c.createLinearGradient(0, h, 0, 0);
    g.addColorStop(0, 'rgba(155,140,255,.95)'); g.addColorStop(1, 'rgba(255,155,208,.95)');
    c.fillStyle = g;
    for (let i = 0; i < BARS; i++) {
      const bh = Math.max(bw, levels[i] * h);
      c.beginPath();
      c.roundRect(i * (bw + gap), (h - bh) / 2, bw, bh, bw / 2); // mirrored around the centre line
      c.fill();
    }
    art.style.transform = `scale(${1 + bass * 0.06})`;
    glow.style.opacity = m.playing ? 0.35 + bass * 0.65 : 0.3;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return {};
});
