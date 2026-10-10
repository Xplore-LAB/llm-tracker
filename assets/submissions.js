/* Progressive enhancement: the generated HTML remains readable without JS. */
(() => {
  const cards = [...document.querySelectorAll('.venue')];
  const controls = ['venue-search', 'venue-kind', 'venue-grade', 'venue-state'].map(id => document.getElementById(id));
  function deadline(row) {
    // End of day AoE (UTC-12) is noon UTC the following day.
    // For unspecified source time zones avoid hour-level claims.
    const midnight = Date.parse(row.dataset.date + 'T00:00:00Z');
    return midnight + (row.dataset.zone === 'aoe' ? 36 : 24) * 3600000 - 1;
  }
  function updateStatuses() {
    const now = Date.now();
    for (const card of cards) {
      let state, label;
      if (card.dataset.kind === 'journal') {
        state = 'upcoming'; label = card.dataset.mode === 'monthly' ? '月度投稿' : '滚动投稿';
        if (card.dataset.mode === 'monthly') {
          // TACL: next calendar-month 1st at 23:59 Honolulu (UTC-10).
          const local = new Date(now - 10 * 3600000);
          let target = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 2, 9, 59, 59);
          if (target < now) target = Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + 1, 2, 9, 59, 59);
          card.querySelector('.monthly-next').textContent = '下一截止（北京时间）：' + new Intl.DateTimeFormat('zh-CN', {timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(target));
        }
      } else {
        const rows = [...card.querySelectorAll('[data-type="sub"], [data-type="abs"]')];
        const future = rows.filter(row => deadline(row) >= now).sort((a,b) => deadline(a) - deadline(b));
        if (future.length) {
          state = 'upcoming';
          label = '下一截止 ' + future[0].dataset.date;
          if (future[0].dataset.zone === 'aoe') label += ' AoE';
        } else if (card.querySelector('.pending')) { state = 'pending'; label = '待公布 / 待核实'; }
        else if (rows.length) { state = 'closed'; label = '本轮投稿已截止'; }
        else { state = 'pending'; label = '投稿日期待核实'; }
      }
      card.dataset.state = state;
      const badge = card.querySelector('.status'); badge.textContent = label; badge.dataset.state = state;
    }
  }
  function filter() {
    const [search, kind, grade, state] = controls.map(el => el.value.trim().toLowerCase());
    let count = 0;
    for (const card of cards) {
      const matches = (!search || card.textContent.toLowerCase().includes(search)) &&
        (!kind || card.dataset.kind === kind) &&
        (!grade || (grade === 'other' ? !card.dataset.grade : card.dataset.grade.toLowerCase() === grade)) &&
        (!state || card.dataset.state === state);
      card.hidden = !matches;
      if (matches) count++;
    }
    document.getElementById('result-count').textContent = `显示 ${count} / ${cards.length} 个投稿去处`;
    document.getElementById('venue-empty').hidden = count > 0;
  }
  controls.forEach(el => el.addEventListener(el.tagName === 'INPUT' ? 'input' : 'change', filter));
  const params = new URLSearchParams(location.search);
  controls.forEach(el => { if (params.has(el.id)) el.value = params.get(el.id); });
  updateStatuses(); filter();
  setInterval(() => { updateStatuses(); filter(); }, 60000);
})();
