/* XP / level maths shared by main process and renderers. */
(function (root) {
  const XP_PER_TASK = 10;
  const need = (level) => 20 + level * 10; // level 1 -> 2 needs 30 XP

  function levelInfo(xp) {
    let level = 1;
    let rem = Math.max(0, xp | 0);
    while (rem >= need(level)) { rem -= need(level); level++; }
    return { level, into: rem, need: need(level), pct: rem / need(level) };
  }

  /** Total XP needed to be exactly at the start of `level`. */
  const xpForLevel = (level) => Math.max(0, (Math.floor(level) - 1) * (20 + 5 * Math.floor(level)));

  const api = { XP_PER_TASK, need, levelInfo, xpForLevel };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.WingitsProgress = api;
})(typeof window !== 'undefined' ? window : globalThis);
