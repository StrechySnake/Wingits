Wingits.register('weather', ({ root, api }) => {
  root.innerHTML = `
    <svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
      <filter id="goo" x="-20%" y="-30%" width="140%" height="160%" color-interpolation-filters="sRGB">
        <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="b"/>
        <feColorMatrix in="b" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -9" result="g"/>
        <feGaussianBlur in="g" stdDeviation=".6"/>
      </filter></defs></svg>
    <div class="sky"></div>
    <div class="wx">
      <div class="wx-top"><span class="label wx-city">Locating…</span></div>
      <div class="wx-main"><span class="wx-temp">--°</span></div>
      <div class="wx-cond">&nbsp;</div>
      <div class="wx-meta muted"></div>
    </div>`;
  const $ = (s) => root.querySelector(s);
  const sky = $('.sky');
  let currentSky = '';

  // WMO weather code -> label + scene
  function describe(code) {
    if (code === 0) return ['Clear', 'clear'];
    if (code <= 2) return ['Partly cloudy', 'partly'];
    if (code === 3) return ['Overcast', 'cloudy'];
    if (code === 45 || code === 48) return ['Foggy', 'fog'];
    if (code >= 51 && code <= 57) return ['Drizzle', 'rain'];
    if (code >= 61 && code <= 67) return ['Rain', 'rain'];
    if (code >= 71 && code <= 77) return ['Snow', 'snow'];
    if (code >= 80 && code <= 82) return ['Showers', 'rain'];
    if (code === 85 || code === 86) return ['Snow showers', 'snow'];
    if (code >= 95) return ['Thunderstorm', 'storm'];
    return ['Clear', 'clear'];
  }

  const rnd = (a, b) => a + Math.random() * (b - a);

  // A cloud is a bank of overlapping circles; the SVG "goo" filter fuses them into one soft,
  // connected silhouette (no visible circles or rectangles). The outer element drifts.
  function cloud({ right, top, w = 150, scale = 1, dur = 24, delay = 0, tone = '' }) {
    const h = 56, base = 20, n = Math.max(4, Math.round(w / 28));
    let blobs = `<i style="left:${base / 2}px;bottom:0;width:${w - base}px;height:${base}px;border-radius:99px"></i>`;
    for (let i = 0; i < n; i++) {
      const f = n === 1 ? .5 : i / (n - 1);
      const r = (10 + 17 * Math.pow(Math.sin(Math.PI * (0.12 + 0.76 * f)), 1.4)) * rnd(.82, 1.12);
      const x = f * (w - 2 * r) + (i % 2 ? 0 : 2);
      blobs += `<i style="left:${x.toFixed(1)}px;bottom:${rnd(4, 12).toFixed(1)}px;width:${(2 * r).toFixed(1)}px;height:${(2 * r).toFixed(1)}px;border-radius:50%;animation-delay:${-rnd(0, 6).toFixed(1)}s"></i>`;
    }
    return `<div class="cloud ${tone}" style="right:${right}px;top:${top}px;transform:scale(${scale});--dur:${dur}s;--delay:${delay}s">
      <div class="cloud-drift"><div class="cloud-body" style="width:${w}px;height:${h}px">${blobs}</div></div></div>`;
  }

  function streaks(n, cls) {
    let h = '';
    for (let i = 0; i < n; i++) {
      const big = cls === 'rdrop' ? rnd(.6, 1.1) : rnd(.5, 1.3);
      h += `<i class="${cls}" style="left:${rnd(-5, 105)}%;--len:${(cls === 'rdrop' ? 12 * big : 5 * big).toFixed(1)}px;--o:${rnd(.35, .85).toFixed(2)};animation-duration:${cls === 'rdrop' ? rnd(.65, 1.05).toFixed(2) : rnd(5, 9).toFixed(1)}s;animation-delay:${-rnd(0, 8).toFixed(2)}s"></i>`;
    }
    return h;
  }

  function buildSky(kind, isDay) {
    const key = kind + (isDay ? 'd' : 'n');
    if (key === currentSky) return;
    currentSky = key;
    const rays = Array.from({ length: 12 }, (_, i) => `<b style="transform:rotate(${i * 30}deg) translateY(-40px)"></b>`).join('');
    const celestial = isDay
      ? `<div class="sun"><div class="sun-rays">${rays}</div><div class="sun-core"></div></div>`
      : '<div class="moon"></div><i class="star s1"></i><i class="star s2"></i><i class="star s3"></i><i class="star s4"></i>';
    let h = '';
    if (kind === 'clear') h = celestial;
    else if (kind === 'partly') h = celestial + cloud({ right: -8 - 30, top: 70, w: 130, dur: 26 }) + cloud({ right: 52 - 30, top: 104, w: 90, scale: .9, dur: 34, delay: -12, tone: 'soft' });
    else if (kind === 'cloudy') h = cloud({ right: -10 - 30, top: 16, w: 160, dur: 30 }) + cloud({ right: 34 - 30, top: 58, w: 130, dur: 38, delay: -14, tone: 'soft' }) + cloud({ right: -8 - 30, top: 98, w: 105, dur: 33, delay: -6 });
    else if (kind === 'rain') h = streaks(26, 'rdrop') + cloud({ right: -10 - 30, top: 12, w: 160, dur: 32, tone: 'dark' }) + cloud({ right: 40 - 30, top: 48, w: 120, dur: 40, delay: -15, tone: 'dark soft' });
    else if (kind === 'storm') h = streaks(30, 'rdrop') + cloud({ right: -10 - 30, top: 10, w: 165, dur: 34, tone: 'dark' }) + cloud({ right: 46 - 30, top: 46, w: 120, dur: 42, delay: -16, tone: 'dark soft' })
      + '<svg class="bolt" viewBox="0 0 24 40"><path d="M14 0 3 22h7l-3 18L21 15h-8z"/></svg><i class="flash"></i>';
    else if (kind === 'snow') h = streaks(24, 'sflake') + cloud({ right: -10 - 30, top: 12, w: 160, dur: 36, tone: 'soft' }) + cloud({ right: 42 - 30, top: 50, w: 115, dur: 44, delay: -18, tone: 'soft' });
    else if (kind === 'fog') h = '<i class="fogband" style="top:34px"></i><i class="fogband b" style="top:84px"></i><i class="fogband" style="top:134px;animation-delay:-9s"></i>';
    sky.className = `sky ${kind} ${isDay ? 'day' : 'night'}`;
    sky.innerHTML = h;
  }

  let lastKey = '', timer;
  async function refresh() {
    const w = await api.getWeather();
    if (w.error) {
      $('.wx-city').textContent = 'Weather';
      $('.wx-cond').textContent = w.error;
      return;
    }
    const [label, kind] = describe(w.code);
    const unit = lastUnits === 'f' ? '°F' : '°C';
    $('.wx-city').textContent = w.city || 'Weather';
    $('.wx-temp').textContent = Math.round(w.temp) + '°';
    $('.wx-cond').textContent = label;
    $('.wx-meta').innerHTML =
      `H ${Math.round(w.hi)}° · L ${Math.round(w.lo)}°<br>Feels ${Math.round(w.feels)}${unit} · ${Math.round(w.humidity)}% humidity`;
    buildSky(kind, w.isDay);
  }

  let lastUnits = 'c';
  function update(s) {
    lastUnits = s.settings.units;
    const key = s.settings.units + '|' + s.settings.city;
    if (key !== lastKey) { lastKey = key; refresh(); }
  }
  timer = setInterval(refresh, 15 * 60 * 1000);
  // retry soon if we started offline
  setInterval(() => { if ($('.wx-temp').textContent === '--°') refresh(); }, 30000);
  return { update };
});
