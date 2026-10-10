// Journals share the research page's view navigation with the conference timeline.
(() => {
  const section = document.getElementById('conference-journals');
  if (!section) return;

  TYPES.commit = ['承诺到会议', '#6b5b95'];
  VIEWS.push(['journal', '📖 期刊投稿']);
  const originalRender = render;
  const originalToolbar = renderToolbar;
  const originalCaveat = renderCaveat;
  const originalSetView = setView;

  renderToolbar = function () {
    if (VIEW !== 'journal') originalToolbar();
  };
  renderCaveat = function () {
    if (VIEW !== 'journal') originalCaveat();
  };
  render = function () {
    const journal = VIEW === 'journal';
    section.hidden = !journal;
    for (const id of ['toolbar', 'stats', 'caveat']) {
      document.getElementById(id).style.display = journal ? 'none' : '';
    }
    if (journal) {
      for (const id of ['board', 'countdown', 'tlwrap', 'watchwrap']) {
        document.getElementById(id).style.display = 'none';
      }
    } else {
      originalRender();
    }
  };
  setView = function (view) {
    originalSetView(view);
    const url = new URL(location.href);
    url.searchParams.set('view', view);
    history.replaceState(null, '', url);
  };

  if (new URLSearchParams(location.search).get('view') === 'journal') {
    VIEW = 'journal';
  }
  renderViews();
  if (VIEW === 'journal') render();
})();

// Both layouts use the same filtered and sorted collection.
(() => {
  const section = document.getElementById('conference-journals');
  const grid = section?.querySelector('.journal-grid');
  if (!grid) return;
  const cards = Array.from(grid.children);
  const controls = document.createElement('div');
  controls.className = 'journal-controls';
  controls.innerHTML = `
    <div class="journal-layout" role="group" aria-label="展示形式">
      <button type="button" data-layout="cards" aria-pressed="true">卡片</button>
      <button type="button" data-layout="list" aria-pressed="false">列表</button>
    </div>
    <label>关键词<input id="journal-query" type="search" placeholder="名称、领域或研究方向"></label>
    <label>领域<select id="journal-field"><option value="">全部领域</option></select></label>
    <label>研究方向<select id="journal-topic"><option value="">全部方向</option><option value="agent">Agent</option><option value="llm">LLM</option><option value="industrial">工业控制</option></select></label>
    <label>CCF 等级<select id="journal-ccf"><option value="">全部等级</option><option>A</option><option>B</option><option value="unknown">未核定</option></select></label>
    <label>IF 年份<select id="journal-year"><option value="">全部年份</option></select></label>
    <label>最低 IF<input id="journal-min" type="number" min="0" step="0.1" placeholder="不限"></label>
    <label>最高 IF<input id="journal-max" type="number" min="0" step="0.1" placeholder="不限"></label>
    <label>指标状态<select id="journal-metric"><option value="">全部</option><option value="known">已核验</option><option value="unknown">待核验</option></select></label>
    <label>排序<select id="journal-sort"><option value="default">默认顺序</option><option value="if-desc">IF 从高到低</option><option value="if-asc">IF 从低到高</option><option value="ccf">CCF 等级</option><option value="name">名称 A–Z</option></select></label>
    <button type="button" id="journal-reset">重置筛选</button>`;
  grid.before(controls);
  const status = document.createElement('p');
  status.className = 'journal-results'; status.setAttribute('role', 'status');
  grid.before(status);
  const note = document.createElement('p');
  note.className = 'journal-intro';
  note.textContent = 'IF 为两年 Journal Impact Factor，年份为指标统计年。不同年份分开展示，可用年份筛选统一比较；待核验不代表没有 IF，设置数值区间时仅显示已核验条目。';
  controls.before(note);
  const wrapper = document.createElement('div');
  wrapper.className = 'journal-table-wrap'; wrapper.hidden = true;
  wrapper.innerHTML = '<table class="journal-table"><caption>期刊投稿列表</caption><thead><tr><th scope="col">期刊</th><th scope="col">领域</th><th scope="col">CCF</th><th scope="col">影响因子 / 年份</th><th scope="col">投稿方式</th><th scope="col">投稿指南</th></tr></thead><tbody></tbody></table>';
  grid.after(wrapper);
  const body = wrapper.querySelector('tbody');
  const fields = controls.querySelector('#journal-field');
  for (const field of new Set(cards.map(card => card.dataset.field))) fields.add(new Option(field, field));
  const years = controls.querySelector('#journal-year');
  for (const year of [...new Set(cards.map(card => card.dataset.year).filter(Boolean))].sort().reverse()) years.add(new Option(year, year));
  const rows = new Map(cards.map(card => {
    const row = document.createElement('tr');
    const cells = [card.querySelector('h3'), card.dataset.field, card.dataset.ccf === 'unknown' ? '未核定' : 'CCF-' + card.dataset.ccf, card.querySelector('.journal-impact'), card.querySelector('.journal-mode'), card.querySelector('a[href]')];
    // Use the official submission link, independently of the metric source link.
    cells[5] = Array.from(card.querySelectorAll('a')).find(a => a.textContent.includes('官方投稿'));
    for (const content of cells) {
      const cell = document.createElement('td');
      if (typeof content === 'string') cell.textContent = content;
      else if (content) cell.append(content.cloneNode(true));
      row.append(cell);
    }
    return [card, row];
  }));
  let layout = 'cards';
  const val = id => controls.querySelector('#journal-' + id).value;
  function update() {
    const query = val('query').trim().toLocaleLowerCase();
    const min = val('min'), max = val('max');
    const invalid = min !== '' && max !== '' && Number(min) > Number(max);
    const filtered = cards.filter(card => {
      const d = card.dataset, known = d.if !== '';
      return !invalid && (!query || card.textContent.toLocaleLowerCase().includes(query)) &&
        (!val('topic') || d.topics.split(' ').includes(val('topic'))) && (!val('field') || d.field === val('field')) && (!val('ccf') || d.ccf === val('ccf')) &&
        (!val('year') || d.year === val('year')) &&
        (!val('metric') || known === (val('metric') === 'known')) &&
        (min === '' || (known && Number(d.if) >= Number(min))) &&
        (max === '' || (known && Number(d.if) <= Number(max)));
    });
    const sort = val('sort');
    filtered.sort((a, b) => {
      if (sort.startsWith('if-')) {
        if (a.dataset.if === '') return b.dataset.if === '' ? 0 : 1;
        if (b.dataset.if === '') return -1;
        return (Number(a.dataset.if) - Number(b.dataset.if)) * (sort === 'if-desc' ? -1 : 1);
      }
      if (sort === 'ccf') return a.dataset.ccf.localeCompare(b.dataset.ccf);
      if (sort === 'name') return a.dataset.name.localeCompare(b.dataset.name, 'en');
      return cards.indexOf(a) - cards.indexOf(b);
    });
    grid.replaceChildren(...filtered);
    body.replaceChildren(...filtered.map(card => rows.get(card)));
    grid.hidden = layout !== 'cards'; wrapper.hidden = layout !== 'list' || !filtered.length;
    status.textContent = invalid ? '最低 IF 不能高于最高 IF，请调整区间。' : `显示 ${filtered.length} / ${cards.length} 本期刊` + (filtered.length ? '' : ' · 暂无匹配结果，请调整或重置筛选');
    for (const button of controls.querySelectorAll('[data-layout]')) button.setAttribute('aria-pressed', String(button.dataset.layout === layout));
  }
  controls.addEventListener('input', update);
  controls.addEventListener('change', update);
  controls.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (button?.dataset.layout) { layout = button.dataset.layout; update(); }
    if (button?.id === 'journal-reset') {
      for (const input of controls.querySelectorAll('input,select')) input.value = input.id === 'journal-sort' ? 'default' : '';
      update();
    }
  });
  update();
})();

// Conference layouts share the original field, preparation-stage and search filters.
(() => {
  const timeline = document.getElementById('tlwrap');
  if (!timeline) return;
  const controls = document.createElement('div');
  controls.id = 'conference-controls';
  controls.className = 'journal-controls conference-controls';
  controls.hidden = true;
  controls.innerHTML = `
    <div class="journal-layout" role="group" aria-label="会议展示形式">
      <button type="button" data-conf-layout="timeline" aria-pressed="true">时间轴</button>
      <button type="button" data-conf-layout="list" aria-pressed="false">列表</button>
    </div>
    <label>研究方向<select id="conference-topic"><option value="">全部方向</option><option value="agent">Agent</option><option value="llm">LLM</option><option value="industrial">工业控制</option></select></label>
    <label>会议等级<select id="conference-tier"><option value="">全部等级</option></select></label>
    <label>节点类型<select id="conference-type"><option value="">全部节点</option></select></label>
    <label>日期起<input id="conference-start" type="date"></label>
    <label>日期止<input id="conference-end" type="date"></label>
    <label>时间状态<select id="conference-status"><option value="upcoming">当前及未来</option><option value="all">全部（含历史）</option><option value="past">已结束</option></select></label>
    <label>列表排序<select id="conference-sort"><option value="date-asc">日期从近到远</option><option value="date-desc">日期从远到近</option><option value="priority">研究方向优先</option><option value="tier">会议等级</option><option value="name">会议名称 A–Z</option></select></label>
    <button type="button" id="conference-reset">重置筛选</button>`;
  const priorities = document.createElement('p');
  priorities.id = 'conference-priorities'; priorities.className = 'journal-intro'; priorities.hidden = true;
  priorities.textContent = '投稿关注：Agent → LLM → 工业控制。方向标签和匹配建议为站内编辑判断，等级与截止日期以官方来源为准；提案、承诺和正式论文投稿分别标注。';
  timeline.before(priorities, controls);
  const status = document.createElement('p');
  status.id = 'conference-results'; status.className = 'journal-results';
  status.setAttribute('role', 'status'); status.hidden = true;
  timeline.before(status);
  const wrapper = document.createElement('div');
  wrapper.id = 'conference-list'; wrapper.className = 'journal-table-wrap'; wrapper.hidden = true;
  wrapper.innerHTML = '<table class="journal-table"><caption>会议节点列表 · 日期及截止时区以官方说明为准</caption><thead><tr><th scope="col">会议</th><th scope="col">领域 / 等级</th><th scope="col">投稿匹配建议</th><th scope="col">节点</th><th scope="col">日期</th><th scope="col">时区 / 说明</th><th scope="col">来源 / 核验</th></tr></thead><tbody></tbody></table>';
  timeline.after(wrapper);
  const body = wrapper.querySelector('tbody');
  const originalVisible = confVisible;
  const originalRender = render;
  const val = id => controls.querySelector('#conference-' + id).value;
  const invalidDates = () => val('start') && val('end') && val('start') > val('end');
  let layout = 'timeline', initialized = false;
  confVisible = function () {
    return originalVisible().filter(event => {
      const series = C.series[event.s];
      const past = dleft(event.e || event.d) < 0;
      return !invalidDates() && (!val('topic') || series.priorityTopics?.includes(val('topic'))) && (!val('tier') || series.tag?.tier === val('tier')) &&
        (!val('type') || event.t === val('type')) &&
        (!val('start') || (event.e || event.d) >= val('start')) &&
        (!val('end') || event.d <= val('end')) &&
        (val('status') === 'all' || (val('status') === 'past' ? past : !past));
    });
  };
  function cell(row, value) {
    const td = document.createElement('td');
    if (value instanceof Node) td.append(value); else td.textContent = value || '—';
    row.append(td); return td;
  }
  render = function () {
    if (VIEW === 'conf') SHOWPAST = val('status') !== 'upcoming';
    originalRender();
    const conference = VIEW === 'conf';
    priorities.hidden = !conference;
    controls.hidden = !conference; status.hidden = !conference;
    wrapper.hidden = !conference || layout !== 'list';
    if (!conference) return;
    if (!initialized) {
      for (const tier of [...new Set(Object.values(C.series).map(s => s.tag?.tier).filter(Boolean))].sort()) {
        controls.querySelector('#conference-tier').add(new Option(tier, tier));
      }
      for (const [key, [name]] of Object.entries(TYPES)) controls.querySelector('#conference-type').add(new Option(name, key));
      initialized = true;
    }
    const events = confVisible();
    const fieldNames = Object.fromEntries(FIELDS);
    const sort = val('sort');
    events.sort((a, b) => {
      if (sort === 'priority') {
        const score = s => (s.priorityTopics || []).reduce((sum, topic) => sum + ({agent:4,llm:2,industrial:1}[topic] || 0), 0);
        return score(C.series[b.s]) - score(C.series[a.s]) || a.d.localeCompare(b.d);
      }
      if (sort === 'date-desc') return b.d.localeCompare(a.d);
      if (sort === 'name') return C.series[a.s].name.localeCompare(C.series[b.s].name, 'en') || a.d.localeCompare(b.d);
      if (sort === 'tier') return (C.series[a.s].tag?.tier || '未核定').localeCompare(C.series[b.s].tag?.tier || '未核定') || a.d.localeCompare(b.d);
      return a.d.localeCompare(b.d);
    });
    body.replaceChildren(...events.map(event => {
      const series = C.series[event.s], row = document.createElement('tr');
      cell(row, series.name);
      cell(row, (series.tag?.focus || fieldNames[series.field] || series.field) + ' / ' + (series.tag?.tier || '未核定'));
      cell(row, series.submissionFit);
      cell(row, event.label || TYPES[event.t]?.[0]);
      cell(row, event.d + (event.e ? ' 至 ' + event.e : ''));
      cell(row, event.note);
      const source = document.createElement('div');
      if (event.url) {
        const link = document.createElement('a'); link.href = event.url;
        link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = '官方来源 ↗'; source.append(link);
      }
      const checked = document.createElement('div'); checked.textContent = event.checkedAt ? '核验 ' + event.checkedAt : '待核验'; source.append(checked);
      cell(row, source); return row;
    }));
    timeline.style.display = layout === 'list' ? 'none' : '';
    status.textContent = invalidDates() ? '起始日期不能晚于结束日期，请调整区间。' :
      `显示 ${events.length} / ${C.events.length} 个已公布日期节点` + (events.length ? ' · 日期待公布条目见下方观望区' : ' · 暂无匹配结果，请调整或重置筛选');
    for (const button of controls.querySelectorAll('[data-conf-layout]')) button.setAttribute('aria-pressed', String(button.dataset.confLayout === layout));
  };
  controls.addEventListener('input', () => { if (VIEW === 'conf') render(); });
  controls.addEventListener('change', () => { if (VIEW === 'conf') render(); });
  controls.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (button?.dataset.confLayout) { layout = button.dataset.confLayout; render(); }
    if (button?.id === 'conference-reset') {
      for (const input of controls.querySelectorAll('input,select')) {
        input.value = input.id === 'conference-sort' ? 'date-asc' : input.id === 'conference-status' ? 'upcoming' : '';
      }
      F = 'all'; STAGE = 'all'; Q = '';
      renderToolbar(); render();
    }
  });
})();
