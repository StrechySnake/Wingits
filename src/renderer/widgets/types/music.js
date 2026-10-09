Wingits.register('music', ({ root, card, api, inst, setInst }) => {
  const { icons, esc } = Wingits;
  root.innerHTML = `
    <div class="mp">
      <div class="mp-art"><span class="mp-note">♪</span><img alt=""></div>
      <div class="mp-body">
        <div class="mp-meta">
          <div class="mp-title">Drop music here</div>
          <div class="mp-artist muted">or press +</div>
        </div>
        <div class="mp-bar" data-nodrag><i></i></div>
        <div class="mp-times muted"><span class="t-cur">0:00</span><span class="t-len">0:00</span></div>
        <div class="mp-ctl">
          <button class="round-btn sm" data-act="add" title="Add songs">${icons.plus}</button>
          <button class="round-btn" data-act="prev" title="Previous">${icons.prev}</button>
          <button class="round-btn primary" data-act="play" title="Play / pause">${icons.play}</button>
          <button class="round-btn" data-act="next" title="Next">${icons.next}</button>
        </div>
      </div>
    </div>
    <audio preload="metadata"></audio>`;
  const $ = (s) => root.querySelector(s);
  const audio = $('audio'), img = $('.mp-art img'), art = $('.mp-art');
  const metaCache = new Map();
  let tracks = [];       // file paths
  let index = 0;
  let loaded = -1;

  const fmt = (t) => (isFinite(t) ? `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}` : '0:00');
  const fileUrl = (p) => encodeURI('file:///' + p.replace(/\\/g, '/').replace(/^\/+/, '')).replace(/#/g, '%23').replace(/\?/g, '%3F');

  function gradientFor(text) {
    let h = 0; for (const c of text) h = (h * 31 + c.charCodeAt(0)) % 360;
    return `linear-gradient(135deg, hsl(${h} 70% 68%), hsl(${(h + 60) % 360} 70% 62%))`;
  }

  async function loadTrack(i, autoplay) {
    if (!tracks.length) return;
    index = (i + tracks.length) % tracks.length;
    const path = tracks[index];
    loaded = index;
    audio.src = fileUrl(path);
    setInst({ index });
    let m = metaCache.get(path);
    if (!m) { m = await api.mediaMeta(path); metaCache.set(path, m); }
    if (tracks[index] !== path) return;
    $('.mp-title').textContent = m.title;
    $('.mp-artist').textContent = m.artist || m.album || 'Unknown artist';
    if (m.art) { img.src = m.art; art.classList.add('has-img'); art.style.background = ''; }
    else { img.removeAttribute('src'); art.classList.remove('has-img'); art.style.background = gradientFor(m.title); }
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({ title: m.title, artist: m.artist, album: m.album, artwork: m.art ? [{ src: m.art }] : [] });
    }
    if (autoplay) audio.play().catch(() => {});
  }

  async function addFiles(paths) {
    paths = paths.filter((p) => /\.(mp3|m4a|aac|wav|flac|ogg|opus)$/i.test(p) && !tracks.includes(p));
    if (!paths.length) return;
    const wasEmpty = !tracks.length;
    tracks = tracks.concat(paths);
    setInst({ tracks });
    if (wasEmpty) loadTrack(0, true);
  }

  root.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    if (act === 'add') addFiles(await api.pickMusic());
    else if (act === 'play') { if (!tracks.length) return addFiles(await api.pickMusic()); audio.paused ? audio.play() : audio.pause(); }
    else if (act === 'next') loadTrack(index + 1, true);
    else if (act === 'prev') { if (audio.currentTime > 4) audio.currentTime = 0; else loadTrack(index - 1, true); }
  });
  $('.mp-bar').addEventListener('click', (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    if (audio.duration) audio.currentTime = ((e.clientX - r.left) / r.width) * audio.duration;
  });

  audio.addEventListener('play', () => { $('[data-act=play]').innerHTML = icons.pause; art.classList.add('spin'); });
  audio.addEventListener('pause', () => { $('[data-act=play]').innerHTML = icons.play; art.classList.remove('spin'); });
  audio.addEventListener('ended', () => loadTrack(index + 1, true));
  audio.addEventListener('error', () => { if (tracks.length > 1) loadTrack(index + 1, true); });
  audio.addEventListener('timeupdate', () => {
    $('.mp-bar i').style.width = (audio.duration ? (audio.currentTime / audio.duration) * 100 : 0) + '%';
    $('.t-cur').textContent = fmt(audio.currentTime);
    $('.t-len').textContent = fmt(audio.duration);
  });

  if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('play', () => audio.play());
    navigator.mediaSession.setActionHandler('pause', () => audio.pause());
    navigator.mediaSession.setActionHandler('nexttrack', () => loadTrack(index + 1, true));
    navigator.mediaSession.setActionHandler('previoustrack', () => loadTrack(index - 1, true));
  }

  // Drag songs from Explorer straight onto the widget.
  card.addEventListener('dragover', (e) => { e.preventDefault(); card.classList.add('drag-over'); });
  card.addEventListener('dragleave', () => card.classList.remove('drag-over'));
  card.addEventListener('drop', (e) => {
    e.preventDefault(); card.classList.remove('drag-over');
    addFiles([...e.dataTransfer.files].map((f) => api.pathForFile(f)).filter(Boolean));
  });

  const saved = inst();
  if (saved.tracks && saved.tracks.length) { tracks = saved.tracks; loadTrack(saved.index || 0, false); }
  return {};
});
