/* ============================================================
   GitHub Star 浮动按钮 · 空心五角星版
   用法：页面 </body> 前引入
   <script src="/llm-tracker/assets/github-star.js"></script>
   ============================================================ */
(function () {
  'use strict';
  var REPO = 'Xplore-LAB/llm-tracker';
  var CACHE_KEY = 'ghs_count_cache_v2';

  var css = document.createElement('style');
  css.textContent = [
    '#gh-star-btn{position:fixed;top:14px;right:16px;z-index:2147483001;display:inline-flex;align-items:center;gap:6px;',
    'padding:6px 12px;border-radius:999px;background:rgba(255,255,255,.92);border:1px solid rgba(0,0,0,.10);',
    'box-shadow:0 2px 10px rgba(0,0,0,.10);color:#24292f;',
    'font:600 12px/1 -apple-system,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;',
    'text-decoration:none;cursor:pointer;backdrop-filter:blur(6px);',
    'transition:transform .15s ease,box-shadow .15s ease;}',
    '#gh-star-btn:hover{transform:translateY(-1px);box-shadow:0 4px 14px rgba(0,0,0,.16);color:#24292f;}',
    '#gh-star-btn svg{display:block;color:#8a94a6;transition:color .18s ease,transform .25s ease;}',
    '#gh-star-btn:hover svg{color:#e3b341;transform:scale(1.18) rotate(72deg);}',
    '#gh-star-btn .ghs-count{min-width:14px;text-align:center;}'
  ].join('');
  (document.head || document.documentElement).appendChild(css);

  /* 空心五角星（描边，不填充） */
  var btn = document.createElement('a');
  btn.id = 'gh-star-btn';
  btn.href = 'https://github.com/' + REPO;
  btn.target = '_blank';
  btn.rel = 'noopener';
  btn.title = '在 GitHub 上 Star 这个项目';
  btn.innerHTML =
    '<svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true">' +
    '<polygon points="12,2.5 14.86,8.32 21.3,9.26 16.65,13.78 17.75,20.2 12,17.16 6.25,20.2 7.35,13.78 2.7,9.26 9.14,8.32"' +
    ' fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>' +
    '</svg><span class="ghs-count">Star</span>';
  document.body.appendChild(btn);

  /* 实时星数（本地缓存 1 小时） */
  var countEl = btn.querySelector('.ghs-count');
  function setCount(n) { countEl.textContent = n; }
  try {
    var c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (c && Date.now() - c.t < 3600000 && typeof c.n === 'number') setCount(c.n);
  } catch (e) {}
  fetch('https://api.github.com/repos/' + REPO, { headers: { Accept: 'application/vnd.github+json' } })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      if (d && typeof d.stargazers_count === 'number') {
        setCount(d.stargazers_count);
        try { localStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), n: d.stargazers_count })); } catch (e) {}
      }
    })
    .catch(function () {});

  /* 避让吸顶导航栏 */
  function avoidHeader() {
    try {
      var offset = 14;
      var nodes = document.querySelectorAll('header,nav,.topbar,.navbar');
      for (var i = 0; i < nodes.length; i++) {
        var rect = nodes[i].getBoundingClientRect();
        var s = getComputedStyle(nodes[i]);
        if ((s.position === 'fixed' || s.position === 'sticky') && rect.top < 40 && rect.bottom > offset) {
          offset = Math.max(offset, rect.bottom + 8);
        }
      }
      btn.style.top = offset + 'px';
    } catch (e) {}
  }
  window.addEventListener('load', avoidHeader);
  setTimeout(avoidHeader, 800);
})();
