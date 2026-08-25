/* ============================================================
   可拖拽 AI 助手（大模型情报局）
   · 悬浮球可拖到页面任意位置，点击展开对话面板
   · 接入自己的 LLM API：修改下方 AI_CONFIG（OpenAI 兼容格式）
   用法：页面 </body> 前引入
   <script src="/llm-tracker/assets/ai-assistant.js"></script>
   ============================================================ */
(function () {
  'use strict';

  /* ========== 在这里接入你的 LLM API（OpenAI 兼容格式） ========== */
  var AI_CONFIG = {
    endpoint: '',       // 例：https://your-proxy.com/v1/chat/completions
    apiKey: '',         // 浏览器直连会暴露 key，建议走自建中转/网关
    model: '',          // 例：deepseek-chat / gpt-4o-mini / qwen-plus
    systemPrompt: '你是「大模型情报局」网站的 AI 助手，用简洁的中文回答用户关于大模型、AI 求职与面试的问题。',
    welcome: '你好呀 👋 我是站内 AI 助手，可以把我拖到任何角落～\n目前还没有接入大模型 API：把配置填到 assets/ai-assistant.js 顶部的 AI_CONFIG（OpenAI 兼容格式），我就能真正回答问题了。'
  };
  /* ============================================================= */

  /* ---------- 样式 ---------- */
  var css = document.createElement('style');
  css.textContent = [
    '#ai-orb{position:fixed;right:26px;bottom:32px;z-index:2147483000;width:54px;height:54px;border-radius:50%;',
    'background:linear-gradient(135deg,#4f6ef7,#8b5cf6);display:flex;align-items:center;justify-content:center;',
    'box-shadow:0 6px 20px rgba(79,110,247,.45);cursor:grab;user-select:none;-webkit-user-select:none;touch-action:none;',
    'transition:transform .18s ease,box-shadow .18s ease,background .18s ease;}',
    '#ai-orb:hover{transform:scale(1.08);box-shadow:0 8px 26px rgba(79,110,247,.55);}',
    '#ai-orb.on{transform:scale(.92);background:linear-gradient(135deg,#334155,#475569);}',
    '#ai-orb.ai-dragging{cursor:grabbing;transform:scale(1.12);}',
    '#ai-orb .ai-orb-ico{font-size:24px;line-height:1;pointer-events:none;filter:drop-shadow(0 1px 2px rgba(0,0,0,.2));}',
    '',
    '#ai-panel{position:fixed;right:26px;bottom:96px;z-index:2147483000;',
    'width:min(340px,calc(100vw - 20px));height:min(480px,72vh);display:none;flex-direction:column;',
    'border-radius:16px;overflow:hidden;background:#fff;border:1px solid rgba(0,0,0,.08);',
    'box-shadow:0 12px 40px rgba(15,23,42,.18);',
    'font:13px/1.6 -apple-system,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;color:#26303d;}',
    '#ai-panel.show{display:flex;}',
    '.ai-head{display:flex;align-items:center;gap:8px;padding:10px 12px;flex:none;',
    'background:linear-gradient(135deg,#4f6ef7,#8b5cf6);color:#fff;cursor:grab;touch-action:none;',
    'user-select:none;-webkit-user-select:none;}',
    '.ai-head.ai-dragging{cursor:grabbing;}',
    '.ai-head-ico{font-size:16px;}',
    '.ai-head-title{font-weight:600;font-size:14px;}',
    '.ai-head-hint{font-size:10px;opacity:.75;margin-left:auto;}',
    '.ai-close{border:0;background:rgba(255,255,255,.18);color:#fff;width:22px;height:22px;border-radius:6px;',
    'font-size:14px;line-height:1;cursor:pointer;padding:0;flex:none;}',
    '.ai-close:hover{background:rgba(255,255,255,.32);}',
    '.ai-msgs{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;background:#fafbfd;}',
    '.ai-m{max-width:84%;padding:8px 12px;border-radius:12px;white-space:pre-wrap;word-break:break-word;font-size:13px;}',
    '.ai-m.u{align-self:flex-end;background:#4f6ef7;color:#fff;border-bottom-right-radius:4px;}',
    '.ai-m.b{align-self:flex-start;background:#eef1f7;color:#26303d;border-bottom-left-radius:4px;}',
    '.ai-typing{display:flex;gap:4px;align-items:center;padding:12px;}',
    '.ai-typing span{width:6px;height:6px;border-radius:50%;background:#9aa6bd;animation:aiBlink 1.2s infinite;}',
    '.ai-typing span:nth-child(2){animation-delay:.2s;}',
    '.ai-typing span:nth-child(3){animation-delay:.4s;}',
    '@keyframes aiBlink{0%,80%,100%{opacity:.25;transform:translateY(0);}40%{opacity:1;transform:translateY(-3px);}}',
    '.ai-input{display:flex;gap:8px;padding:10px;border-top:1px solid #edf0f5;background:#fff;flex:none;}',
    '.ai-input textarea{flex:1;resize:none;border:1px solid #dde3ec;border-radius:10px;padding:9px 12px;',
    'font-family:inherit;font-size:13px;line-height:1.5;outline:none;max-height:96px;color:#26303d;background:#fff;}',
    '.ai-input textarea:focus{border-color:#4f6ef7;}',
    '.ai-send{border:0;width:40px;height:40px;flex:none;border-radius:10px;cursor:pointer;',
    'background:linear-gradient(135deg,#4f6ef7,#8b5cf6);color:#fff;font-size:15px;line-height:1;}',
    '.ai-send:hover{filter:brightness(1.08);}',
    '.ai-send:disabled{opacity:.5;cursor:default;}'
  ].join('\n');
  (document.head || document.documentElement).appendChild(css);

  /* ---------- 悬浮球 ---------- */
  var orb = document.createElement('div');
  orb.id = 'ai-orb';
  orb.title = 'AI 助手（按住可拖拽）';
  orb.innerHTML = '<span class="ai-orb-ico">🤖</span>';
  document.body.appendChild(orb);

  /* ---------- 对话面板 ---------- */
  var panel = document.createElement('div');
  panel.id = 'ai-panel';
  panel.innerHTML =
    '<div class="ai-head">' +
    '<span class="ai-head-ico">🤖</span>' +
    '<span class="ai-head-title">AI 助手</span>' +
    '<span class="ai-head-hint">按住可拖拽</span>' +
    '<button class="ai-close" title="收起">×</button>' +
    '</div>' +
    '<div class="ai-msgs"></div>' +
    '<div class="ai-input">' +
    '<textarea rows="1" placeholder="有问题尽管问…（Enter 发送）"></textarea>' +
    '<button class="ai-send" title="发送">➤</button>' +
    '</div>';
  document.body.appendChild(panel);

  var msgs = panel.querySelector('.ai-msgs');
  var ta = panel.querySelector('textarea');
  var sendBtn = panel.querySelector('.ai-send');
  var closeBtn = panel.querySelector('.ai-close');
  var head = panel.querySelector('.ai-head');

  var POS_KEY = 'ai_orb_pos';
  var history = [];
  var busy = false;

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  /* 恢复上次拖放的位置 */
  try {
    var p = JSON.parse(localStorage.getItem(POS_KEY) || 'null');
    if (p && typeof p.x === 'number') {
      orb.style.right = 'auto'; orb.style.bottom = 'auto';
      orb.style.left = clamp(p.x, 0, window.innerWidth - 60) + 'px';
      orb.style.top = clamp(p.y, 0, window.innerHeight - 60) + 'px';
    }
  } catch (e) {}

  /* ---------- 拖拽 + 点击（位移超过 6px 视为拖拽，否则视为点击） ---------- */
  function draggable(el, handle, onClick) {
    handle.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      var r = el.getBoundingClientRect();
      var sx = e.clientX, sy = e.clientY, ox = r.left, oy = r.top, moved = false;
      el.style.right = 'auto'; el.style.bottom = 'auto';
      el.style.left = ox + 'px'; el.style.top = oy + 'px';
      try { handle.setPointerCapture(e.pointerId); } catch (err) {}
      handle.classList.add('ai-dragging');

      function mv(ev) {
        var dx = ev.clientX - sx, dy = ev.clientY - sy;
        if (!moved && Math.abs(dx) + Math.abs(dy) > 6) moved = true;
        if (moved) {
          el.style.left = clamp(ox + dx, 0, window.innerWidth - r.width) + 'px';
          el.style.top = clamp(oy + dy, 0, window.innerHeight - r.height) + 'px';
        }
      }
      function up(ev) {
        try { handle.releasePointerCapture(ev.pointerId); } catch (err) {}
        handle.removeEventListener('pointermove', mv);
        handle.removeEventListener('pointerup', up);
        handle.classList.remove('ai-dragging');
        if (!moved && onClick) onClick();
        if (moved && el === orb) {
          try {
            localStorage.setItem(POS_KEY,
              JSON.stringify({ x: parseInt(el.style.left, 10), y: parseInt(el.style.top, 10) }));
          } catch (err) {}
        }
      }
      handle.addEventListener('pointermove', mv);
      handle.addEventListener('pointerup', up);
      e.preventDefault();
    });
  }

  /* ---------- 面板开合 ---------- */
  function openPanel() {
    panel.classList.add('show');
    orb.classList.add('on');
    if (!msgs.childElementCount) addMsg('b', AI_CONFIG.welcome);
    if (!panel.style.left) {
      /* 首次打开：面板出现在悬浮球附近（小屏居中） */
      var r = orb.getBoundingClientRect();
      var w = panel.offsetWidth || 340, h = panel.offsetHeight || 460;
      var x, y;
      if (window.innerWidth < 480) { x = (window.innerWidth - w) / 2; y = 60; }
      else { x = clamp(r.left - w + 54, 8, window.innerWidth - w - 8); y = clamp(r.top - h, 8, window.innerHeight - h - 8); }
      panel.style.left = x + 'px'; panel.style.top = y + 'px';
    }
    try { ta.focus(); } catch (e) {}
  }
  function closePanel() { panel.classList.remove('show'); orb.classList.remove('on'); }

  draggable(orb, orb, openPanel);   // 球：点击开面板
  draggable(panel, head, null);     // 面板：拖标题栏移动
  closeBtn.addEventListener('click', closePanel);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closePanel(); });
  window.addEventListener('resize', function () {
    var r = orb.getBoundingClientRect();
    orb.style.left = clamp(r.left, 0, Math.max(0, window.innerWidth - r.width)) + 'px';
    orb.style.top = clamp(r.top, 0, Math.max(0, window.innerHeight - r.height)) + 'px';
  });

  /* ---------- 消息 ---------- */
  function addMsg(role, text) {
    var d = document.createElement('div');
    d.className = 'ai-m ' + (role === 'u' ? 'u' : 'b');
    d.textContent = text;
    msgs.appendChild(d);
    msgs.scrollTop = msgs.scrollHeight;
    return d;
  }
  function addTyping() {
    var d = document.createElement('div');
    d.className = 'ai-m b ai-typing';
    d.innerHTML = '<span></span><span></span><span></span>';
    msgs.appendChild(d);
    msgs.scrollTop = msgs.scrollHeight;
    return d;
  }

  /* ---------- 发送 ---------- */
  function send() {
    var text = ta.value.trim();
    if (!text || busy) return;
    addMsg('u', text);
    ta.value = '';
    history.push({ role: 'user', content: text });
    busy = true; sendBtn.disabled = true;
    var tip = addTyping();

    function done(reply) {
      tip.remove();
      addMsg('b', reply);
      history.push({ role: 'assistant', content: reply });
      busy = false; sendBtn.disabled = false;
    }

    /* 未配置 API：给出友好提示 */
    if (!AI_CONFIG.endpoint || !AI_CONFIG.model) {
      setTimeout(function () {
        done('收到：「' + (text.length > 40 ? text.slice(0, 40) + '…' : text) + '」\n\n' +
          '我还没接入 LLM API 😅\n打开 assets/ai-assistant.js，填好顶部 AI_CONFIG 的 endpoint / apiKey / model（OpenAI 兼容格式），我就能认真回答了。');
      }, 600);
      return;
    }

    /* 已配置：调用 OpenAI 兼容接口 */
    var payloadMsgs = [{ role: 'system', content: AI_CONFIG.systemPrompt }].concat(history.slice(-20));
    var headers = { 'Content-Type': 'application/json' };
    if (AI_CONFIG.apiKey) headers['Authorization'] = 'Bearer ' + AI_CONFIG.apiKey;

    fetch(AI_CONFIG.endpoint, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ model: AI_CONFIG.model, messages: payloadMsgs })
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (d) {
      var m = d && d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content;
      done(m || '（接口返回了无法识别的格式）');
    }).catch(function (err) {
      done('⚠️ 请求失败：' + err.message);
    });
  }

  sendBtn.addEventListener('click', send);
  ta.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  });
})();
