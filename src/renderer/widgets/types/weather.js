Wingits.register('weather', ({ root, api }) => {
  root.innerHTML = `
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
  const cloud = (top, scale, dur, delay, dark) =>
    `<i class="cloud ${dark ? 'dark' : ''}" style="top:${top}px;--s:${scale};animation-duration:${dur}s;animation-delay:${delay}s"></i>`;

  function drops(n, cls) {
    let h = '';
    for (let i = 0; i < n; i++) {
      h += `<i class="${cls}" style="left:${rnd(0, 100)}%;animation-duration:${cls === 'snow' ? rnd(4, 7) : rnd(.7, 1.2)}s;animation-delay:${-rnd(0, 6)}s;--d:${rnd(-14, 14)}px"></i>`;
    }
    return h;
  }

  function buildSky(kind, isDay) {
    const key = kind + (isDay ? 'd' : 'n');
    if (key === currentSky) return;
    currentSky = key;
    let h = '';
    const celestial = isDay ? '<i class="sun"></i>' : '<i class="moon"></i><i class="star s1"></i><i class="star s2"></i><i class="star s3"></i>';
    if (kind === 'clear') h = celestial;
    else if (kind === 'partly') h = celestial + cloud(70, 1, 22, -8) + cloud(120, .7, 30, -20);
    else if (kind === 'cloudy') h = cloud(60, 1.1, 26, -6) + cloud(100, .8, 34, -18) + cloud(140, 1, 30, -2);
    else if (kind === 'rain') h = cloud(46, 1.2, 28, -4, true) + cloud(86, .9, 36, -16, true) + drops(22, 'drop');
    else if (kind === 'storm') h = cloud(46, 1.3, 30, -4, true) + cloud(84, 1, 38, -14, true) + drops(26, 'drop') + '<i class="flash"></i>';
    else if (kind === 'snow') h = cloud(46, 1.2, 30, -4) + drops(20, 'snow');
    else if (kind === 'fog') h = '<i class="fogband" style="top:30px"></i><i class="fogband b" style="top:80px"></i><i class="fogband" style="top:130px;animation-delay:-9s"></i>';
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
