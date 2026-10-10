Wingits.register('tasks', ({ root, api }) => {
  const { esc } = Wingits;
  const { levelInfo, XP_PER_TASK } = WingitsProgress;
  const PET_ICON = { cat: '🐱', slime: '🫧', plant: '🌱' };

  root.innerHTML = `
    <div class="tasks">
      <div class="tasks-head">
        <div><div class="label">Today</div><div class="tasks-count">0 of 0 done</div></div>
        <button class="chip-btn clear-done" title="Remove finished tasks">Clear done</button>
      </div>
      <form class="tasks-form"><input class="pill-input" maxlength="140" placeholder="Add a task…" autocomplete="off"></form>
      <ul class="tasks-list"></ul>
      <div class="tasks-pet" title="Finish tasks to grow your companion">
        <span class="tp-icon">🐱</span>
        <div class="tp-body"><div class="tp-line"><b class="tp-name"></b><span class="tp-lv muted"></span></div><div class="bar"><i></i></div></div>
        <span class="xp-toast">+${XP_PER_TASK} XP</span>
      </div>
    </div>`;
  const $ = (s) => root.querySelector(s);
  const list = $('.tasks-list'), input = $('.pill-input');
  let sig = '';

  $('.tasks-form').addEventListener('submit', (e) => {
    e.preventDefault();
    if (input.value.trim()) { api.addTask(input.value); input.value = ''; }
  });
  $('.clear-done').addEventListener('click', () => api.clearDone());

  list.addEventListener('click', async (e) => {
    const li = e.target.closest('li');
    if (!li) return;
    if (e.target.closest('.del')) return api.removeTask(li.dataset.id);
    if (e.target.closest('.check, .t-text')) {
      const r = await api.toggleTask(li.dataset.id);
      if (r && r.gained) {
        const t = $('.xp-toast');
        t.classList.remove('show'); void t.offsetWidth; t.classList.add('show');
      }
    }
  });

  function update(s) {
    // unfinished tasks first (in the order added), finished ones sink to the very bottom
    const tasks = [...s.tasks.filter((t) => !t.done), ...s.tasks.filter((t) => t.done)];
    const done = tasks.length - s.tasks.filter((t) => !t.done).length;
    $('.tasks-count').textContent = tasks.length ? `${done} of ${tasks.length} done` : 'Nothing yet';
    $('.clear-done').style.visibility = done ? 'visible' : 'hidden';

    const nextSig = JSON.stringify(tasks.map((t) => [t.id, t.text, t.done]));
    if (nextSig !== sig) {
      sig = nextSig;
      list.innerHTML = tasks.length
        ? tasks.map((t) => `
          <li data-id="${t.id}" class="${t.done ? 'done' : ''}">
            <span class="check"><svg viewBox="0 0 24 24"><path d="M5.5 12.5l4.2 4.2 8.8-9.4"/></svg></span>
            <span class="t-text">${esc(t.text)}</span>
            <button class="del" title="Delete" aria-label="Delete task">×</button>
          </li>`).join('')
        : '<li class="empty">Add your first task and watch your companion grow ✨</li>';
    }
    const info = levelInfo(s.pet.xp);
    $('.tp-icon').textContent = PET_ICON[s.pet.kind] || '🐾';
    $('.tp-name').textContent = s.pet.name;
    $('.tp-lv').textContent = ` · Lv ${info.level}`;
    $('.bar i').style.width = Math.round(info.pct * 100) + '%';
  }
  return { update };
});
