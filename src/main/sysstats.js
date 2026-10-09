const os = require('os');

function cpuTimes() {
  let idle = 0, total = 0;
  for (const c of os.cpus()) {
    for (const k in c.times) total += c.times[k];
    idle += c.times.idle;
  }
  return { idle, total };
}

/** Samples CPU / RAM every 1.5s; getters return the latest cached sample. */
function createStats() {
  let prev = cpuTimes();
  let last = { cpu: 0, ram: 0, usedGB: 0, totalGB: os.totalmem() / 2 ** 30 };

  const sample = () => {
    const cur = cpuTimes();
    const dTotal = cur.total - prev.total;
    const dIdle = cur.idle - prev.idle;
    prev = cur;
    const cpu = dTotal > 0 ? Math.round((1 - dIdle / dTotal) * 100) : last.cpu;
    const total = os.totalmem();
    const used = total - os.freemem();
    last = { cpu, ram: Math.round((used / total) * 100), usedGB: used / 2 ** 30, totalGB: total / 2 ** 30 };
  };

  sample();
  const timer = setInterval(sample, 1500);
  timer.unref?.();
  return { get: () => last, stop: () => clearInterval(timer) };
}

module.exports = { createStats };
