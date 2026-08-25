/* GitHub Star floating badge — shared across llm-tracker pages
 * Usage: <script src="/llm-tracker/assets/github-star.js"></script> before </body>
 * - Uses ghbtns.com official-style button (one-click star when logged into GitHub)
 * - Auto offsets below sticky/fixed headers; falls back to a plain link pill
 *   if the badge service is unreachable (e.g. network blocked)
 */
(function () {
  if (document.getElementById('gh-star-btn')) return;
  var USER = 'Xplore-LAB', REPO = 'llm-tracker';

  var wrap = document.createElement('div');
  wrap.id = 'gh-star-btn';
  var s = wrap.style;
  s.position = 'fixed';
  s.right = '16px';
  s.top = '16px';
  s.zIndex = '90'; /* above sticky headers (z~20), below modals (z~100) */
  s.background = '#fff';
  s.border = '1px solid rgba(27,31,36,.15)';
  s.borderRadius = '22px';
  s.boxShadow = '0 2px 10px rgba(0,0,0,.18)';
  s.padding = '3px';
  s.lineHeight = '0';
  s.transition = 'top .2s ease';
  wrap.title = '在 GitHub 上 Star 这个项目';

  var loaded = false;
  var ifr = document.createElement('iframe');
  ifr.setAttribute('allowtransparency', 'true');
  ifr.setAttribute('scrolling', '0');
  ifr.frameBorder = '0';
  ifr.width = '170';
  ifr.height = '30';
  ifr.title = 'Star ' + USER + '/' + REPO + ' on GitHub';
  ifr.src = 'https://ghbtns.com/github-btn.html?user=' + USER + '&repo=' + REPO + '&type=star&count=true&size=large';
  ifr.style.border = '0';
  ifr.style.borderRadius = '20px';
  ifr.style.display = 'block';
  ifr.addEventListener('load', function () { loaded = true; });
  wrap.appendChild(ifr);

  /* Fallback: if badge service unreachable, swap in a plain link pill */
  setTimeout(function () {
    if (loaded || !wrap.parentNode) return;
    var a = document.createElement('a');
    a.href = 'https://github.com/' + USER + '/' + REPO;
    a.target = '_blank';
    a.rel = 'noopener';
    a.title = 'Star on GitHub';
    a.textContent = '\u2B50 Star';
    a.style.cssText = 'display:inline-flex;align-items:center;height:30px;padding:0 14px;border-radius:20px;background:#24292f;color:#fff;font:600 13px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif;text-decoration:none;';
    wrap.innerHTML = '';
    wrap.appendChild(a);
  }, 6000);

  /* Sit below sticky/fixed top bars if present, else 16px from top */
  function adjust() {
    var top = 16;
    var els = document.querySelectorAll('header, nav');
    for (var i = 0; i < els.length; i++) {
      var e = els[i];
      var cs = getComputedStyle(e);
      if (cs.position === 'sticky' || cs.position === 'fixed') {
        var r = e.getBoundingClientRect();
        if (r.top < 40 && r.height >= 30 && r.height <= 120) {
          top = Math.round(r.bottom) + 8;
          break;
        }
      }
    }
    wrap.style.top = top + 'px';
  }

  function mount() {
    document.body.appendChild(wrap);
    adjust();
    window.addEventListener('resize', adjust);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
