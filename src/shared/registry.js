/* Widget catalogue shared by the main process, dashboard and widgets. */
(function (root) {
  // Transparent margin around every widget card (room for the soft shadow).
  const PAD = 14;

  const widgets = {
    clock:     { label: 'Date & Time', icon: '🕰️', hue: 265, w: 280, h: 150, desc: 'Clean, calm typography' },
    weather:   { label: 'Weather',     icon: '🌤️', hue: 205, w: 260, h: 190, desc: 'Animated skies, live data' },
    tasks:     { label: 'To-Do',       icon: '✅', hue: 150, w: 290, h: 360, desc: 'Check things off, feed your pet', single: true },
    pet:       { label: 'Companion',   icon: '🐾', hue: 25,  w: 190, h: 215, desc: 'Grows as you finish tasks', single: true, bare: true },
    pomodoro:  { label: 'Pomodoro',    icon: '🍅', hue: 8,   w: 250, h: 285, desc: 'Focus and break timer' },
    countdown: { label: 'Countdown',   icon: '⏳', hue: 320, w: 250, h: 170, desc: 'Days until your next event' },
    notes:     { label: 'Sticky Note', icon: '📝', hue: 50,  w: 240, h: 240, desc: 'Jot something down' },
    music:     { label: 'Music',       icon: '🎵', hue: 285, w: 330, h: 150, desc: 'Mini player with album art' },
    system:    { label: 'System',      icon: '📈', hue: 175, w: 270, h: 150, desc: 'CPU and RAM dials' },
  };

  const api = { PAD, widgets };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.WingitsRegistry = api;
})(typeof window !== 'undefined' ? window : globalThis);
