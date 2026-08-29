/* ============================================================
   全站关键词搜索 v1.0（大模型情报局）
   · 左下角玻璃搜索按钮 + Ctrl/Cmd+K 唤起，Esc 关闭
   · 跨内容层检索：术语馆 / 技术档案 / 编年史 / Agent 前线 / 硬件志 / 部署实战
   · 索引为仓库根 site-index.json（XOR+base64，与其他原创数据同编码）
   · 结果分组展示，点击跳转到对应页面（带锚点 / 参数定位）
   用法：页面 </body> 前按页面深度引入（相对路径，勿写绝对路径）
     根页面:   <script src="assets/site-search.js"></script>
     一级子页: <script src="../assets/site-search.js"></script>
     二级子页: <script src="../../assets/site-search.js"></script>
   ============================================================ */
(function () {
  'use strict';

  /* ---------- 站点相对前缀推导：由本脚本的相对 src 决定 ---------- */
  var PREFIX = '';
  try {
    var src = (document.currentScript && document.currentScript.src) || '';
    var m = src.match(/^(.*\/)assets\/site-search\.js/);
    PREFIX = m ? m[1] : '';
  } catch (e) { PREFIX = ''; }

  var KEY = 'XploreLAB#2026$Chronicle';
  function dec(s) {
    var b = atob(s), a = new Uint8Array(b.length);
    for (var i = 0; i < b.length; i++) a[i] = b.charCodeAt(i) ^ KEY.charCodeAt(i % KEY.length);
    return new TextDecoder().decode(a);
  }

  /* ---------- 状态 ---------- */
  var IDX = null;            // 索引条目数组
  var IDX_ERR = false;       // 加载失败标记
  var SEL = -1;              // 键盘选中项
  var FLAT = [];             // 当前渲染的扁平结果（供键盘导航）

  var GROUPS = [
    ['term',  '📖 术语馆'],
    ['tech',  '🧬 技术档案'],
    ['rank',  '🏆 排行榜'],
    ['event', '📜 编年史'],
    ['agent', '📡 Agent 前线'],
    ['hard',  '🧮 硬件志'],
    ['deploy', '🚀 部署实战'],
    ['doc',   '🚀 部署实战'],
  ];
  var TYPE_LABEL = {};
  GROUPS.forEach(function (g) { TYPE_LABEL[g[0]] = g[1]; });

  /* ---------- 样式 ---------- */
  var css = document.createElement('style');
  css.textContent = [
    /* 搜索按钮（左下角，避开右下角 AI 悬浮球） */
    '#ss-dock{position:fixed;left:26px;bottom:32px;z-index:2147482990;display:flex;flex-direction:column;gap:10px;}',
    '#ss-btn{width:46px;height:46px;border-radius:50%;border:1px solid rgba(255,255,255,.18);cursor:pointer;',
    'background:radial-gradient(120% 120% at 30% 25%,#2b2f3f 0%,#16181f 55%,#101218 100%);',
    'box-shadow:0 8px 22px rgba(8,10,18,.38),inset 0 1px 0 rgba(255,255,255,.14);',
    'display:flex;align-items:center;justify-content:center;transition:transform .18s cubic-bezier(.34,1.56,.64,1),box-shadow .2s;}',
    '#ss-btn:hover{transform:translateY(-2px) scale(1.05);box-shadow:0 12px 26px rgba(99,102,241,.35),inset 0 1px 0 rgba(255,255,255,.18);}',
    '#ss-btn svg{pointer-events:none;}',
    '#ss-tip{font-size:10px;color:#fff;background:rgba(22,24,31,.85);border-radius:8px;padding:2px 7px;text-align:center;white-space:nowrap;opacity:.8;}',
    /* 遮罩 + 面板 */
    '#ss-mask{position:fixed;inset:0;background:rgba(8,10,18,.55);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);',
    'z-index:2147482991;display:none;align-items:flex-start;justify-content:center;padding:10vh 1rem 1rem;}',
    '#ss-mask.open{display:flex;}',
    '#ss-panel{width:100%;max-width:660px;max-height:76vh;display:flex;flex-direction:column;border-radius:16px;overflow:hidden;',
    'background:rgba(22,24,31,.92);border:1px solid rgba(255,255,255,.14);box-shadow:0 24px 64px rgba(0,0,0,.5);}',
    '#ss-head{display:flex;align-items:center;gap:.6rem;padding:.85rem 1rem;border-bottom:1px solid rgba(255,255,255,.09);}',
    '#ss-input{flex:1;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.14);border-radius:10px;color:#e7eaf2;',
    'font-size:.95rem;padding:.55rem .85rem;outline:none;font-family:inherit;}',
    '#ss-input:focus{border-color:rgba(139,92,246,.65);box-shadow:0 0 0 3px rgba(139,92,246,.18);}',
    '#ss-input::placeholder{color:#6b7280;}',
    '#ss-count{font-size:.7rem;color:#8b93a7;white-space:nowrap;}',
    '#ss-body{overflow-y:auto;padding:.4rem 0 .8rem;flex:1;}',
    '#ss-body::-webkit-scrollbar{width:8px;}',
    '#ss-body::-webkit-scrollbar-thumb{background:rgba(255,255,255,.14);border-radius:4px;}',
    '.ss-grp{font-size:.68rem;font-weight:700;color:#8b93a7;letter-spacing:.08em;padding:.65rem 1rem .3rem;}',
    '.ss-item{display:block;padding:.5rem 1rem;cursor:pointer;border-left:2px solid transparent;}',
    '.ss-item:hover,.ss-item.sel{background:rgba(255,255,255,.06);border-left-color:#8b5cf6;}',
    '.ss-item .h{font-size:.85rem;color:#e7eaf2;font-weight:600;}',
    '.ss-item .h mark{background:rgba(139,92,246,.35);color:#c4b5fd;border-radius:2px;padding:0 1px;}',
    '.ss-item .s{font-size:.68rem;color:#8b93a7;margin-top:.1rem;}',
    '.ss-item .x{font-size:.72rem;color:#a7aec0;margin-top:.15rem;line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}',
    '.ss-empty{padding:2.2rem 1rem;text-align:center;color:#8b93a7;font-size:.82rem;}',
    '.ss-chips{display:flex;flex-wrap:wrap;gap:.4rem;padding:.4rem 1rem .2rem;}',
    '.ss-chip{font-size:.7rem;color:#c4b5fd;background:rgba(139,92,246,.14);border:1px solid rgba(139,92,246,.3);',
    'border-radius:1rem;padding:.16rem .6rem;cursor:pointer;}',
    '.ss-chip:hover{background:rgba(139,92,246,.3);}',
    '#ss-foot{display:flex;gap:1rem;padding:.55rem 1rem;border-top:1px solid rgba(255,255,255,.09);',
    'font-size:.66rem;color:#6b7280;flex-wrap:wrap;}',
    '#ss-foot b{color:#8b93a7;font-weight:600;}',
    '@media(max-width:640px){',
    '  #ss-dock{left:16px;bottom:20px;}',
    '  #ss-tip{display:none;}',
    '  #ss-mask{padding-top:6vh;}',
    '  #ss-panel{max-height:82vh;border-radius:14px;}',
    '}',
  ].join('\n');
  document.head.appendChild(css);

  /* ---------- DOM ---------- */
  var dock = document.createElement('div');
  dock.id = 'ss-dock';
  dock.innerHTML =
    '<button id="ss-btn" title="全站搜索（Ctrl+K）" aria-label="打开全站搜索">' +
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#c4b5fd" stroke-width="2.2" stroke-linecap="round">' +
    '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.8-3.8"/></svg></button>' +
    '<span id="ss-tip">Ctrl K</span>';
  document.body.appendChild(dock);

  var mask = document.createElement('div');
  mask.id = 'ss-mask';
  mask.innerHTML =
    '<div id="ss-panel" role="dialog" aria-label="全站搜索">' +
    '<div id="ss-head"><input id="ss-input" type="text" placeholder="搜全站：OPD、MLA、GRPO、vLLM、GLM-5.2…" autocomplete="off">' +
    '<span id="ss-count"></span></div>' +
    '<div id="ss-body"></div>' +
    '<div id="ss-foot"><span><b>↑↓</b> 选择</span><span><b>↵</b> 跳转</span><span><b>esc</b> 关闭</span>' +
    '<span id="ss-meta" style="margin-left:auto"></span></div></div>';
  document.body.appendChild(mask);

  var btn = document.getElementById('ss-btn');
  var input = document.getElementById('ss-input');
  var body = document.getElementById('ss-body');
  var countEl = document.getElementById('ss-count');
  var metaEl = document.getElementById('ss-meta');

  /* ---------- 索引加载（懒加载：首次打开才 fetch） ---------- */
  function loadIdx(cb) {
    if (IDX || IDX_ERR) { cb(); return; }
    fetch(PREFIX + 'site-index.json?t=' + Date.now())
      .then(function (r) { if (!r.ok) throw 0; return r.text(); })
      .then(function (t) {
        var d = JSON.parse(dec(t));
        IDX = (d && d.items) || [];
        metaEl.textContent = '索引 ' + IDX.length + ' 条 · ' + (d.meta && d.meta.updated || '');
        cb();
      })
      .catch(function () { IDX_ERR = true; cb(); });
  }

  /* ---------- 搜索 ---------- */
  function esc(s) {
    return String(s || '').replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function hl(s, q) {
    var e = esc(s), eq = esc(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return e.replace(new RegExp('(' + eq + ')', 'gi'), '<mark>$1</mark>');
  }
  function score(it, q) {
    var h = (it.h + ' ' + (it.e || '')).toLowerCase();
    var s = 0;
    if (it.h.toLowerCase().indexOf(q) === 0) s += 6;
    else if (h.indexOf(q) >= 0) s += 4;
    if ((it.e || '').toLowerCase().indexOf(q) >= 0) s += 3;
    if ((it.s || '').toLowerCase().indexOf(q) >= 0) s += 1;
    if ((it.x || '').toLowerCase().indexOf(q) >= 0) s += 1;
    return s;
  }
  function search(q) {
    q = q.trim().toLowerCase();
    if (!q) return [];
    var scored = [];
    for (var i = 0; i < IDX.length; i++) {
      var it = IDX[i];
      var sc = score(it, q);
      if (sc > 0) scored.push([sc, it]);
    }
    scored.sort(function (a, b) { return b[0] - a[0]; });
    return scored.slice(0, 60).map(function (p) { return p[1]; });
  }

  /* ---------- 渲染 ---------- */
  var HOT = ['OPD', 'MoE', 'GRPO', 'MLA', 'KV cache', 'vLLM', 'GLM-5.2', 'DeepSeek-V4'];
  function renderHome() {
    var stats = {};
    IDX.forEach(function (it) { stats[it.t] = (stats[it.t] || 0) + 1; });
    var chips = HOT.map(function (w) {
      return '<span class="ss-chip" data-q="' + esc(w) + '">' + esc(w) + '</span>';
    }).join('');
    var rows = GROUPS.filter(function (g) { return stats[g[0]]; }).map(function (g) {
      return '<div class="ss-grp">' + g[1] + ' · ' + stats[g[0]] + ' 条</div>';
    }).join('');
    body.innerHTML = '<div class="ss-grp">试试</div><div class="ss-chips">' + chips +
      '</div>' + rows + '<div class="ss-empty">输入关键词，跨术语 / 技术档案 / 编年史 / Agent 前线 / 硬件 / 部署检索</div>';
    countEl.textContent = '';
    FLAT = [];
    bindChips();
  }
  function renderResults(q) {
    var res = search(q);
    if (!res.length) {
      body.innerHTML = '<div class="ss-empty">没有命中「' + esc(q) + '」 Try English keywords like MLA / MoE / vLLM</div>';
      countEl.textContent = '0 结果';
      FLAT = [];
      return;
    }
    var html = '';
    FLAT = [];
    var lastType = null;
    res.forEach(function (it) {
      if (it.t !== lastType) {
        html += '<div class="ss-grp">' + (TYPE_LABEL[it.t] || it.t) + '</div>';
        lastType = it.t;
      }
      html += '<a class="ss-item" href="' + PREFIX + it.u + '">' +
        '<div class="h">' + hl(it.h, q) + (it.e ? ' <span style="font-weight:400;font-size:.7rem;color:#8b93a7">' + hl(it.e, q) + '</span>' : '') + '</div>' +
        '<div class="s">' + esc(it.s || '') + '</div>' +
        '<div class="x">' + hl(it.x || '', q) + '</div></a>';
      FLAT.push(PREFIX + it.u);
    });
    body.innerHTML = html;
    countEl.textContent = res.length + ' 结果';
  }
  function bindChips() {
    var chips = body.querySelectorAll('.ss-chip');
    for (var i = 0; i < chips.length; i++) {
      chips[i].addEventListener('click', function () {
        input.value = this.getAttribute('data-q');
        input.focus();
        renderResults(input.value);
      });
    }
  }

  /* ---------- 交互 ---------- */
  var timer = null;
  input.addEventListener('input', function () {
    clearTimeout(timer);
    var v = input.value;
    timer = setTimeout(function () {
      if (!IDX) return;
      v ? renderResults(v) : renderHome();
    }, 120);
  });
  function move(d) {
    var items = body.querySelectorAll('.ss-item');
    if (!items.length) return;
    if (d === 1 && SEL >= items.length - 1) return;
    if (d === -1 && SEL <= 0 && SEL !== -1) return;
    SEL = SEL < 0 ? 0 : SEL + d;
    if (SEL < 0) SEL = 0;
    for (var i = 0; i < items.length; i++) items[i].classList.toggle('sel', i === SEL);
    if (items[SEL]) items[SEL].scrollIntoView({ block: 'nearest' });
  }
  input.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
    else if (e.key === 'Enter') {
      var items = body.querySelectorAll('.ss-item');
      if (SEL >= 0 && items[SEL]) { location.href = FLAT[SEL]; }
      else if (items.length === 1) { location.href = FLAT[0]; }
    }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') close();
    if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      open();
    }
  });
  mask.addEventListener('click', function (e) { if (e.target === mask) close(); });
  btn.addEventListener('click', open);

  function open() {
    mask.classList.add('open');
    input.focus();
    input.select();
    SEL = -1;
    loadIdx(function () {
      if (IDX_ERR) {
        body.innerHTML = '<div class="ss-empty">索引加载失败（site-index.json 不可达），请刷新重试</div>';
        return;
      }
      input.value ? renderResults(input.value) : renderHome();
    });
  }
  function close() {
    mask.classList.remove('open');
    SEL = -1;
  }
})();
