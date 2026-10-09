Wingits.register('notes', ({ root, card, inst, setInst }) => {
  const COLORS = ['#fff3a8', '#ffd1dc', '#c8f0d8', '#cfe4ff', '#e5d4ff'];
  root.innerHTML = `
    <div class="note">
      <textarea spellcheck="false" placeholder="Write something…" maxlength="2000"></textarea>
      <div class="note-dots">${COLORS.map((c, i) => `<button data-i="${i}" style="background:${c}" aria-label="Colour ${i + 1}"></button>`).join('')}</div>
    </div>`;
  const ta = root.querySelector('textarea');
  let t;

  function paint() {
    const d = inst();
    card.style.setProperty('--note', COLORS[d.color ?? 0]);
    if (document.activeElement !== ta && ta.value !== (d.text || '')) ta.value = d.text || '';
    root.querySelectorAll('.note-dots button').forEach((b) => b.classList.toggle('on', +b.dataset.i === (d.color ?? 0)));
  }
  ta.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => setInst({ text: ta.value }), 350); });
  ta.addEventListener('blur', () => { clearTimeout(t); setInst({ text: ta.value }); });
  root.querySelector('.note-dots').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) setInst({ color: +b.dataset.i });
  });
  card.classList.add('sticky');
  paint();
  return { update: paint };
});
