/* ============================================================
   AI 助手 v2.1（大模型情报局）
   · 深色玻璃悬浮球（右下角，可拖拽），点击展开毛玻璃对话面板
   · 流式输出 + Markdown 渲染 + 快捷提问 + 页面上下文感知
   · 悬浮球旁带「?」帮助按钮，弹出使用指南
   · 自动适配深色 / 浅色页面
   接入 LLM API：修改下方 AI_CONFIG（OpenAI 兼容格式）
   用法：页面 </body> 前引入
   <script src="/llm-tracker/assets/ai-assistant.js"></script>
   ============================================================ */
(function () {
  'use strict';

  /* ========== LLM 调用配置（OpenAI 兼容格式） ========== */
  var AI_CONFIG = {
    endpoint: 'https://llmapi.vip.cpolar.cn/v1/chat/completions',  // cpolar VIP 固定子域 → 本地 8787 端口 llm-proxy-server.js（节点：/home/lab434/.config/llm-proxy/env）
    apiKey: 'd117f48efcdcc0fada68718007e444cac633541ef17537c61392dc76f3d33673',  // PROXY_KEY（自编口令，可公开）；真实 MiniMax key 仅存服务器 env
    model: 'MiniMax-M2.5',  // 性价比款；可换 MiniMax-M2.7（更强）/ MiniMax-M2.5-highspeed（更快）/ MiniMax-M3（旗舰 1M 上下文）
    systemPrompt: '你是「大模型情报局」（llm-tracker.github.io / xplore-lab.github.io/llm-tracker）的 AI 助手，专长于大语言模型（LLM）与 AI 求职面试方向。\n\n【身份与领域】\n- 服务对象：浏览本站的用户，主要关心 LLM 基础知识、前沿研究、主流模型、训练/微调/推理技术、AI 行业动态、秋招/校招面试题与职业路径。\n- 站点内容覆盖：模型卡片（GPT/Claude/Gemini/DeepSeek/Qwen/GLM/Mistral/Llama 等）、技术专题（Transformer / MoE / RLHF / 推理时计算 / 长上下文 / RAG / Agent）、求职资料（秋招时间线、面经、笔试题、岗位选择）。\n\n【回答风格】\n- 默认中文，简明、结构化（要点 + 必要时小标题 + 必要时表格/列表）。\n- 涉及代码只给关键片段，不要大段堆砌；注释行用中文。\n- 涉及论文 / 模型 / 数据集，给出来源（作者+年份+arXiv/DOI），不确定就明说「未核实」。\n- 涉及时间敏感信息（榜单、API 价格、模型版本），提醒「请以官网最新为准」。\n\n【页面上下文】\n- 用户当前所在页面会追加在 system 消息末尾，请结合该页面内容优先回答；如果用户的问题与页面无关，正常回答即可。\n\n【边界】\n- 拒绝涉政、涉黄、暴力违法内容。\n- 不冒充真实人物、不提供医疗/法律/金融的最终结论（给方向不给结论）。\n- 涉及 MiniMax / Anthropic / OpenAI / Google 等厂商内部信息，明确「未公开 / 未核实」。',
    welcome: '你好，我是情报局 AI 助手 ✦\n可以问我大模型、秋招面试相关的问题。**按住我可以拖到任何角落**，面板标题栏也能拖动。',
    chips: [
      { label: '🧠 Pre-Norm vs Post-Norm', text: '讲讲 Pre-Norm 和 Post-Norm 的区别，各自优缺点？' },
      { label: '🎯 字节校招考什么', text: '字节 2027 校招大模型算法岗重点考察什么？' },
      { label: '📚 RAG 原理', text: '用通俗的语言讲讲 RAG 的原理和典型流程？' }
    ]
  };
  /* ============================================================= */

  var CONFIGURED = !!(AI_CONFIG.endpoint && AI_CONFIG.model);
  var ACCENT = 'linear-gradient(135deg,#6366f1,#8b5cf6)';

  /* ---------- 样式 ---------- */
  var css = document.createElement('style');
  css.textContent = [
    /* ----- 停靠区：悬浮球 + 帮助按钮 ----- */
    '#ai-dock{position:fixed;right:26px;bottom:32px;z-index:2147483000;}',

    /* ----- 悬浮球：深色玻璃 + 自绘星形图标 ----- */
    '#ai-orb{position:relative;width:56px;height:56px;border-radius:50%;',
    'background:radial-gradient(120% 120% at 30% 25%,#2b2f3f 0%,#16181f 55%,#101218 100%);',
    'border:1px solid rgba(255,255,255,.16);display:flex;align-items:center;justify-content:center;',
    'box-shadow:0 10px 28px rgba(8,10,18,.4),0 2px 6px rgba(8,10,18,.3),inset 0 1px 0 rgba(255,255,255,.14);',
    'cursor:grab;user-select:none;-webkit-user-select:none;touch-action:none;',
    'transition:transform .2s cubic-bezier(.34,1.56,.64,1),box-shadow .2s ease;}',
    '#ai-orb:hover{transform:translateY(-3px) scale(1.06);',
    'box-shadow:0 14px 34px rgba(99,102,241,.35),0 3px 8px rgba(8,10,18,.3),inset 0 1px 0 rgba(255,255,255,.18);}',
    '#ai-orb:active{cursor:grabbing;}',
    '#ai-orb.on{transform:scale(.9);opacity:.92;}',
    '#ai-dock.ai-dragging #ai-orb{transform:scale(1.14);cursor:grabbing;}',
    '#ai-orb svg{pointer-events:none;filter:drop-shadow(0 1px 3px rgba(0,0,0,.35));}',
    '#ai-orb .ai-orb-ring{position:absolute;inset:-3px;border-radius:50%;pointer-events:none;',
    'background:conic-gradient(from 210deg,rgba(99,102,241,.65),rgba(139,92,246,.5),rgba(99,102,241,.65));',
    'opacity:.55;transition:opacity .25s ease;-webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 2.5px),#000 calc(100% - 2px));',
    'mask:radial-gradient(farthest-side,transparent calc(100% - 2.5px),#000 calc(100% - 2px));}',
    '#ai-orb:hover .ai-orb-ring{opacity:1;}',

    /* ----- 帮助按钮 ----- */
    '#ai-help{position:absolute;right:5px;bottom:calc(100% + 10px);width:34px;height:34px;border-radius:50%;',
    'border:1px solid rgba(15,23,42,.14);background:rgba(255,255,255,.9);backdrop-filter:blur(8px);',
    '-webkit-backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;',
    'cursor:pointer;box-shadow:0 4px 14px rgba(15,23,42,.14);transition:transform .18s ease,box-shadow .18s ease;}',
    '#ai-help:hover{transform:translateY(-2px) scale(1.08);box-shadow:0 6px 18px rgba(99,102,241,.3);}',

    /* ----- 面板：毛玻璃 ----- */
    '#ai-panel{position:fixed;right:26px;bottom:100px;z-index:2147483000;',
    'width:min(380px,calc(100vw - 16px));height:min(540px,76vh);display:none;flex-direction:column;',
    'border-radius:20px;overflow:hidden;',
    'background:rgba(252,253,255,.88);backdrop-filter:blur(20px) saturate(1.5);-webkit-backdrop-filter:blur(20px) saturate(1.5);',
    'border:1px solid rgba(15,23,42,.1);box-shadow:0 24px 64px rgba(15,23,42,.22),0 4px 14px rgba(15,23,42,.08);',
    'font:13px/1.65 -apple-system,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;color:#26303d;',
    'transform-origin:100% 100%;}',
    '#ai-panel.show{display:flex;animation:aiPop .22s cubic-bezier(.34,1.3,.64,1);}',
    '@keyframes aiPop{from{opacity:0;transform:scale(.94) translateY(8px);}to{opacity:1;transform:scale(1) translateY(0);}}',

    /* ----- 头部 ----- */
    '.ai-head{display:flex;align-items:center;gap:10px;padding:12px 14px;flex:none;cursor:grab;touch-action:none;',
    'user-select:none;-webkit-user-select:none;background:rgba(255,255,255,.4);border-bottom:1px solid rgba(15,23,42,.07);}',
    '.ai-head.ai-dragging{cursor:grabbing;background:rgba(255,255,255,.7);}',
    '.ai-ava{width:32px;height:32px;border-radius:10px;flex:none;display:flex;align-items:center;justify-content:center;',
    'background:' + ACCENT + ';box-shadow:0 3px 10px rgba(99,102,241,.4);}',
    '.ai-tt{display:flex;flex-direction:column;gap:1px;min-width:0;}',
    '.ai-name{font-weight:650;font-size:13.5px;letter-spacing:.2px;}',
    '.ai-st{display:flex;align-items:center;gap:5px;font-size:10.5px;color:#6b7686;}',
    '.ai-dot{width:6px;height:6px;border-radius:50%;flex:none;}',
    '.ai-dot.ok{background:#10b981;box-shadow:0 0 6px rgba(16,185,129,.8);}',
    '.ai-dot.off{background:#f59e0b;box-shadow:0 0 6px rgba(245,158,11,.7);}',
    '.ai-close{border:0;background:transparent;color:#8a94a6;width:28px;height:28px;border-radius:8px;',
    'font-size:16px;line-height:1;cursor:pointer;padding:0;flex:none;margin-left:auto;',
    'transition:background .15s ease,color .15s ease;}',
    '.ai-close:hover{background:rgba(15,23,42,.08);color:#26303d;}',
    '.ai-clear{border:0;background:transparent;color:#8a94a6;width:28px;height:28px;border-radius:8px;',
    'font-size:14px;line-height:1;cursor:pointer;padding:0;flex:none;display:inline-flex;align-items:center;justify-content:center;',
    'transition:background .15s ease,color .15s ease;}',
    '.ai-clear:hover{background:rgba(239,68,68,.1);color:#dc2626;}',
    '.ai-clear:disabled{opacity:.35;cursor:default;background:transparent;color:#8a94a6;}',

    /* ----- 消息区 ----- */
    '.ai-msgs{flex:1;overflow-y:auto;padding:16px 14px;display:flex;flex-direction:column;gap:12px;',
    'scrollbar-width:thin;scrollbar-color:rgba(120,130,150,.35) transparent;}',
    '.ai-msgs::-webkit-scrollbar{width:5px;}',
    '.ai-msgs::-webkit-scrollbar-thumb{background:rgba(120,130,150,.3);border-radius:3px;}',
    '.ai-m{max-width:86%;padding:9px 13px;border-radius:14px;word-break:break-word;font-size:13px;}',
    '.ai-m.u{align-self:flex-end;color:#fff;background:' + ACCENT + ';',
    'border-bottom-right-radius:5px;box-shadow:0 3px 10px rgba(99,102,241,.3);white-space:pre-wrap;}',
    '.ai-m.b{align-self:flex-start;background:rgba(15,23,42,.055);border-bottom-left-radius:5px;}',
    '.ai-m.b p{margin:0 0 6px;}.ai-m.b p:last-child{margin-bottom:0;}',
    '.ai-m.b .ai-br{height:6px;}',
    '.ai-m.b .ai-h{font-weight:650;margin:4px 0 2px;font-size:13.5px;}',
    '.ai-m.b .ai-ul{margin:2px 0;padding-left:18px;}',
    '.ai-m.b .ai-ul li{margin:2px 0;}',
    '.ai-ic{font-family:ui-monospace,Consolas,Menlo,monospace;font-size:12px;background:rgba(99,102,241,.12);',
    'color:#4f46e5;padding:1px 5px;border-radius:5px;}',
    '.ai-m.u .ai-ic{background:rgba(255,255,255,.22);color:#fff;}',
    '.ai-code{background:#151820;color:#dbe2f0;border-radius:10px;padding:10px 12px;margin:6px 0;',
    'overflow-x:auto;font:12px/1.55 ui-monospace,Consolas,Menlo,monospace;}',
    '.ai-m.b a{color:#4f46e5;}',
    '.ai-caret{display:inline-block;width:7px;height:14px;vertical-align:-2px;margin-left:2px;border-radius:2px;',
    'background:#6366f1;animation:aiCaret .9s steps(2) infinite;}',
    '@keyframes aiCaret{0%,49%{opacity:1;}50%,100%{opacity:0;}}',
    '.ai-typing{display:flex;gap:5px;align-items:center;padding:12px 14px;background:rgba(15,23,42,.055);}',
    '.ai-typing i{width:7px;height:7px;border-radius:50%;background:#8a94a6;animation:aiBlink 1.2s infinite;}',
    '.ai-typing i:nth-child(2){animation-delay:.18s;}',
    '.ai-typing i:nth-child(3){animation-delay:.36s;}',
    '@keyframes aiBlink{0%,80%,100%{opacity:.25;transform:translateY(0);}40%{opacity:1;transform:translateY(-3px);}}',

    /* ----- 快捷提问 ----- */
    '.ai-chips{display:flex;gap:6px;flex-wrap:wrap;padding:0 14px 10px;flex:none;}',
    '.ai-chip{border:1px solid rgba(99,102,241,.35);background:rgba(99,102,241,.07);color:#4f46e5;',
    'border-radius:999px;padding:5px 11px;font-size:11.5px;cursor:pointer;font-family:inherit;line-height:1.3;',
    'transition:background .15s ease,transform .15s ease;}',
    '.ai-chip:hover{background:rgba(99,102,241,.14);transform:translateY(-1px);}',

    /* ----- 输入区 ----- */
    '.ai-input{display:flex;gap:8px;align-items:flex-end;padding:10px 12px 12px;flex:none;',
    'background:rgba(255,255,255,.5);border-top:1px solid rgba(15,23,42,.07);}',
    '.ai-input textarea{flex:1;resize:none;border:1.5px solid rgba(15,23,42,.12);border-radius:13px;',
    'padding:9px 12px;font-family:inherit;font-size:13px;line-height:1.5;outline:none;max-height:100px;',
    'color:#26303d;background:rgba(255,255,255,.75);transition:border-color .15s ease,box-shadow .15s ease;}',
    '.ai-input textarea:focus{border-color:#6366f1;box-shadow:0 0 0 3px rgba(99,102,241,.12);}',
    '.ai-send{border:0;width:38px;height:38px;flex:none;border-radius:12px;cursor:pointer;',
    'background:' + ACCENT + ';color:#fff;display:flex;align-items:center;justify-content:center;',
    'box-shadow:0 3px 10px rgba(99,102,241,.35);transition:transform .15s ease,filter .15s ease;}',
    '.ai-send:hover{filter:brightness(1.1);transform:translateY(-1px);}',
    '.ai-send:disabled{opacity:.45;cursor:default;transform:none;}',

    /* ----- 帮助弹窗 ----- */
    '.ai-mask{position:fixed;inset:0;z-index:2147483600;background:rgba(10,12,20,.45);',
    'backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px);display:none;',
    'align-items:center;justify-content:center;padding:18px;}',
    '.ai-mask.show{display:flex;animation:aiFade .18s ease;}',
    '@keyframes aiFade{from{opacity:0;}to{opacity:1;}}',
    '.ai-doc{width:min(660px,100%);max-height:86vh;overflow-y:auto;border-radius:18px;',
    'background:#fdfdfe;border:1px solid rgba(15,23,42,.1);box-shadow:0 28px 80px rgba(8,10,18,.45);',
    'font:13.5px/1.75 -apple-system,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;color:#2a3342;',
    'scrollbar-width:thin;}',
    '.ai-doc::-webkit-scrollbar{width:6px;}',
    '.ai-doc::-webkit-scrollbar-thumb{background:rgba(120,130,150,.3);border-radius:3px;}',
    '.ai-doc-head{position:sticky;top:0;z-index:2;display:flex;align-items:center;gap:10px;padding:14px 18px;',
    'background:rgba(253,253,254,.92);backdrop-filter:blur(10px);border-bottom:1px solid rgba(15,23,42,.08);}',
    '.ai-doc-head .ai-t{font-weight:700;font-size:15px;}',
    '.ai-doc-body{padding:18px 22px 24px;}',
    '.ai-badge{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;padding:4px 10px;border-radius:999px;',
    'font-weight:600;letter-spacing:.2px;}',
    '.ai-badge.ok{background:rgba(16,185,129,.12);color:#059669;}',
    '.ai-badge.off{background:rgba(245,158,11,.14);color:#b45309;}',
    '.ai-doc h4{margin:22px 0 8px;font-size:14px;display:flex;align-items:center;gap:7px;}',
    '.ai-doc h4:first-of-type{margin-top:6px;}',
    '.ai-doc h4 .n{width:19px;height:19px;border-radius:6px;background:' + ACCENT + ';color:#fff;',
    'font-size:11px;display:inline-flex;align-items:center;justify-content:center;flex:none;}',
    '.ai-doc p{margin:6px 0;}',
    '.ai-doc ol,.ai-doc ul{margin:6px 0;padding-left:22px;}',
    '.ai-doc li{margin:4px 0;}',
    '.ai-doc table{border-collapse:collapse;width:100%;margin:10px 0;font-size:12.5px;}',
    '.ai-doc th,.ai-doc td{border:1px solid rgba(15,23,42,.12);padding:6px 10px;text-align:left;vertical-align:top;}',
    '.ai-doc th{background:rgba(99,102,241,.08);font-weight:650;white-space:nowrap;}',
    '.ai-doc .ai-ic{font-size:11.5px;}',
    '.ai-doc .tip{background:rgba(99,102,241,.07);border-left:3px solid #6366f1;border-radius:0 10px 10px 0;',
    'padding:9px 13px;margin:12px 0;font-size:12.5px;}',
    '.ai-doc .warn{background:rgba(245,158,11,.09);border-left:3px solid #f59e0b;border-radius:0 10px 10px 0;',
    'padding:9px 13px;margin:12px 0;font-size:12.5px;}',
    '.ai-doc .acts{display:flex;gap:10px;flex-wrap:wrap;margin:12px 0 4px;}',
    '.ai-copy{border:0;border-radius:10px;padding:8px 16px;font-size:12.5px;font-family:inherit;cursor:pointer;',
    'background:' + ACCENT + ';color:#fff;font-weight:600;box-shadow:0 3px 10px rgba(99,102,241,.3);',
    'transition:filter .15s ease,transform .15s ease;}',
    '.ai-copy:hover{filter:brightness(1.1);transform:translateY(-1px);}',
    '.ai-copy.done{background:linear-gradient(135deg,#10b981,#059669);box-shadow:0 3px 10px rgba(16,185,129,.3);}',
    '.ai-copy.ghost{background:transparent;color:#4f46e5;border:1.5px solid rgba(99,102,241,.4);box-shadow:none;}',
    '.ai-copy.ghost:hover{background:rgba(99,102,241,.08);}',

    /* ----- 深色页面适配 ----- */
    '.ai-dark #ai-panel{background:rgba(21,24,33,.9);border-color:rgba(255,255,255,.1);color:#dde3ef;',
    'box-shadow:0 24px 64px rgba(0,0,0,.55),0 4px 14px rgba(0,0,0,.3);}',
    '.ai-dark .ai-head{background:rgba(255,255,255,.04);border-bottom-color:rgba(255,255,255,.08);}',
    '.ai-dark .ai-head.ai-dragging{background:rgba(255,255,255,.08);}',
    '.ai-dark .ai-name{color:#f1f4fa;}',
    '.ai-dark .ai-st{color:#9aa5b8;}',
    '.ai-dark .ai-close{color:#9aa5b8;}',
    '.ai-dark .ai-close:hover{background:rgba(255,255,255,.1);color:#fff;}',
    '.ai-dark .ai-clear{color:#9aa5b8;}',
    '.ai-dark .ai-clear:hover{background:rgba(239,68,68,.18);color:#fca5a5;}',
    '.ai-dark .ai-clear:disabled{color:#9aa5b8;background:transparent;}',
    '.ai-dark .ai-m.b{background:rgba(255,255,255,.07);}',
    '.ai-dark .ai-ic{background:rgba(129,140,248,.18);color:#a5b4fc;}',
    '.ai-dark .ai-m.b a{color:#a5b4fc;}',
    '.ai-dark .ai-chip{border-color:rgba(129,140,248,.4);background:rgba(129,140,248,.1);color:#a5b4fc;}',
    '.ai-dark .ai-chip:hover{background:rgba(129,140,248,.18);}',
    '.ai-dark .ai-input{background:rgba(255,255,255,.03);border-top-color:rgba(255,255,255,.08);}',
    '.ai-dark .ai-input textarea{background:rgba(255,255,255,.06);border-color:rgba(255,255,255,.14);color:#e6eaf4;}',
    '.ai-dark .ai-input textarea:focus{border-color:#818cf8;box-shadow:0 0 0 3px rgba(129,140,248,.15);}',
    '.ai-dark .ai-msgs{scrollbar-color:rgba(255,255,255,.2) transparent;}',
    '.ai-dark .ai-msgs::-webkit-scrollbar-thumb{background:rgba(255,255,255,.18);}',
    '.ai-dark #ai-help{background:rgba(30,33,44,.92);border-color:rgba(255,255,255,.16);}',
    '.ai-dark .ai-doc{background:#171a22;border-color:rgba(255,255,255,.1);color:#dde3ef;}',
    '.ai-dark .ai-doc-head{background:rgba(23,26,34,.92);border-bottom-color:rgba(255,255,255,.08);}',
    '.ai-dark .ai-doc th{background:rgba(129,140,248,.12);}',
    '.ai-dark .ai-doc th,.ai-dark .ai-doc td{border-color:rgba(255,255,255,.12);}',
    '.ai-dark .ai-doc .tip{background:rgba(129,140,248,.1);}',
    '.ai-dark .ai-copy.ghost{color:#a5b4fc;border-color:rgba(129,140,248,.4);}'
  ].join('\n');
  (document.head || document.documentElement).appendChild(css);

  /* ---------- 图标 ---------- */
  function iconSparkle(size, fill) {
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none">' +
      '<path d="M11 3.5c.3 3.4 2.1 5.2 5.5 5.5-3.4.3-5.2 2.1-5.5 5.5-.3-3.4-2.1-5.2-5.5-5.5 3.4-.3 5.2-2.1 5.5-5.5z" fill="' + fill + '"/>' +
      '<path d="M17.5 13.5c.18 2 .18 2 2.5 2.3-2 .18-2 .18-2.3 2.5-.18-2-.18-2-2.5-2.3 2-.18 2-.18 2.3-2.5z" fill="' + fill + '" opacity=".6"/>' +
      '<circle cx="5.5" cy="17.5" r="1.6" fill="' + fill + '" opacity=".45"/></svg>';
  }
  function iconSend() {
    return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none">' +
      '<path d="M12 19V5M5 12l7-7 7 7" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }
  function iconHelp() {
    return '<svg width="17" height="17" viewBox="0 0 24 24" fill="none">' +
      '<path d="M9.2 9a3 3 0 1 1 4.6 2.5c-.9.6-1.8 1.1-1.8 2.4" stroke="#6366f1" stroke-width="1.9" stroke-linecap="round"/>' +
      '<circle cx="12" cy="17.6" r="1.15" fill="#6366f1"/></svg>';
  }
  function iconTrash() {
    return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none">' +
      '<path d="M5 7h14M10 7V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }

  /* ---------- 停靠区（球 + 帮助按钮） ---------- */
  var dock = document.createElement('div');
  dock.id = 'ai-dock';
  document.body.appendChild(dock);

  var orb = document.createElement('div');
  orb.id = 'ai-orb';
  orb.title = 'AI 助手（按住可拖拽）';
  orb.innerHTML = '<span class="ai-orb-ring"></span>' + iconSparkle(27, '#e8ebff');
  dock.appendChild(orb);

  var helpBtn = document.createElement('div');
  helpBtn.id = 'ai-help';
  helpBtn.title = 'AI 助手使用指南';
  helpBtn.innerHTML = iconHelp();
  dock.appendChild(helpBtn);

  /* ---------- 对话面板 ---------- */
  var panel = document.createElement('div');
  panel.id = 'ai-panel';
  panel.innerHTML =
    '<div class="ai-head">' +
    '<div class="ai-ava">' + iconSparkle(18, '#fff') + '</div>' +
    '<div class="ai-tt">' +
    '<span class="ai-name">情报局 AI 助手</span>' +
    '<span class="ai-st"><i class="ai-dot ' + (CONFIGURED ? 'ok' : 'off') + '"></i>' +
    (CONFIGURED ? '在线 · 可对话' : '未接入 API') + ' · 按住标题拖动</span>' +
    '</div>' +
    '<button class="ai-clear" title="清空当前对话" aria-label="清空当前对话">' + iconTrash() + '</button>' +
    '<button class="ai-close" title="收起（Esc）">×</button>' +
    '</div>' +
    '<div class="ai-msgs"></div>' +
    '<div class="ai-chips"></div>' +
    '<div class="ai-input">' +
    '<textarea rows="1" placeholder="问点什么…（Enter 发送 / Shift+Enter 换行）"></textarea>' +
    '<button class="ai-send" title="发送">' + iconSend() + '</button>' +
    '</div>';
  document.body.appendChild(panel);

  var msgs = panel.querySelector('.ai-msgs');
  var chipsBox = panel.querySelector('.ai-chips');
  var ta = panel.querySelector('textarea');
  var sendBtn = panel.querySelector('.ai-send');
  var closeBtn = panel.querySelector('.ai-close');
  var clearBtn = panel.querySelector('.ai-clear');
  clearBtn.disabled = true;
  var head = panel.querySelector('.ai-head');

  var POS_KEY = 'ai_orb_pos';
  var history = [];
  var busy = false;

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  /* ---------- 深浅色检测 ---------- */
  function pageIsDark() {
    var el = document.body;
    var bg = getComputedStyle(el).backgroundColor;
    var m = bg && bg.match(/\d+(\.\d+)?/g);
    if (!m || m.length < 3) {
      el = document.documentElement;
      bg = getComputedStyle(el).backgroundColor;
      m = bg && bg.match(/\d+(\.\d+)?/g);
    }
    if (!m || m.length < 3) return false;
    return (0.299 * +m[0] + 0.587 * +m[1] + 0.114 * +m[2]) / 255 < 0.45;
  }
  if (pageIsDark()) document.documentElement.classList.add('ai-dark');

  /* 恢复上次拖放的位置 */
  try {
    var p = JSON.parse(localStorage.getItem(POS_KEY) || 'null');
    if (p && typeof p.x === 'number') {
      dock.style.right = 'auto'; dock.style.bottom = 'auto';
      dock.style.left = clamp(p.x, 0, window.innerWidth - 60) + 'px';
      dock.style.top = clamp(p.y, 0, window.innerHeight - 100) + 'px';
    }
  } catch (e) {}

  /* ---------- 拖拽 + 点击 ---------- */
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
        if (moved && el === dock) {
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
    if (!msgs.childElementCount) {
      addMsg('b', AI_CONFIG.welcome);
      renderChips();
    }
    if (!panel.style.left) {
      var r = orb.getBoundingClientRect();
      var w = panel.offsetWidth || 380, h = panel.offsetHeight || 540;
      var x, y;
      if (window.innerWidth < 480) { x = (window.innerWidth - w) / 2; y = clamp((window.innerHeight - h) / 2, 8, 60); }
      else { x = clamp(r.left - w + 56, 8, window.innerWidth - w - 8); y = clamp(r.top - h - 12, 8, window.innerHeight - h - 8); }
      panel.style.left = x + 'px'; panel.style.top = y + 'px';
    }
    try { ta.focus(); } catch (e) {}
  }
  function closePanel() { panel.classList.remove('show'); orb.classList.remove('on'); }

  draggable(dock, orb, openPanel);
  draggable(panel, head, null);
  closeBtn.addEventListener('click', closePanel);

  /* ---------- 清空对话 ---------- */
  function clearChat() {
    history = [];
    msgs.innerHTML = '';
    addMsg('b', AI_CONFIG.welcome);
    renderChips();
    clearBtn.disabled = true;
    try { ta.focus(); } catch (e) {}
  }
  clearBtn.addEventListener('click', clearChat);
  window.addEventListener('resize', function () {
    var r = dock.getBoundingClientRect();
    dock.style.left = clamp(r.left, 0, Math.max(0, window.innerWidth - r.width)) + 'px';
    dock.style.top = clamp(r.top, 0, Math.max(0, window.innerHeight - r.height)) + 'px';
  });

  /* ---------- Markdown 简易渲染 ---------- */
  function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function inline(s) {
    return s
      .replace(/`([^`]+)`/g, '<code class="ai-ic">$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
      .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  }
  function md(src) {
    var out = '', inCode = false, codeBuf = '';
    var lines = esc(src).split('\n');
    var listOpen = false;
    function closeList() { if (listOpen) { out += '</ul>'; listOpen = false; } }
    for (var i = 0; i < lines.length; i++) {
      var l = lines[i];
      if (/^\s*```/.test(l)) {
        if (!inCode) { closeList(); inCode = true; codeBuf = ''; }
        else { inCode = false; out += '<pre class="ai-code"><code>' + codeBuf + '</code></pre>'; }
        continue;
      }
      if (inCode) { codeBuf += l + '\n'; continue; }
      var h = l.match(/^\s*#{1,4}\s+(.*)$/);
      if (h) { closeList(); out += '<div class="ai-h">' + inline(h[1]) + '</div>'; continue; }
      var li = l.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/);
      if (li) {
        if (!listOpen) { out += '<ul class="ai-ul">'; listOpen = true; }
        out += '<li>' + inline(li[1]) + '</li>'; continue;
      }
      closeList();
      if (l.trim() === '') out += '<div class="ai-br"></div>';
      else out += '<p>' + inline(l) + '</p>';
    }
    if (inCode) out += '<pre class="ai-code"><code>' + codeBuf + '</code></pre>';
    closeList();
    return out;
  }

  /* ---------- 消息 ---------- */
  function addMsg(role, text) {
    var d = document.createElement('div');
    d.className = 'ai-m ' + (role === 'u' ? 'u' : 'b');
    if (role === 'u') d.textContent = text;
    else d.innerHTML = md(text);
    msgs.appendChild(d);
    msgs.scrollTop = msgs.scrollHeight;
    return d;
  }
  function addTyping() {
    var d = document.createElement('div');
    d.className = 'ai-m b ai-typing';
    d.innerHTML = '<i></i><i></i><i></i>';
    msgs.appendChild(d);
    msgs.scrollTop = msgs.scrollHeight;
    return d;
  }
  function renderChips() {
    if (!AI_CONFIG.chips || !AI_CONFIG.chips.length) return;
    AI_CONFIG.chips.forEach(function (c) {
      var b = document.createElement('button');
      b.className = 'ai-chip';
      b.textContent = c.label;
      b.addEventListener('click', function () {
        chipsBox.innerHTML = '';
        ta.value = c.text;
        send();
      });
      chipsBox.appendChild(b);
    });
  }

  /* ---------- 页面上下文 ---------- */
  function systemWithPage() {
    var t = (document.title || '').slice(0, 80);
    return AI_CONFIG.systemPrompt + '\n\n当前用户正在浏览的页面：' + t + '（' + location.href + '）。回答时可结合该页面内容。';
  }

  /* ---------- 流式请求 ---------- */
  function streamChat(payloadMsgs, onDelta, onDone, onErr) {
    var headers = { 'Content-Type': 'application/json' };
    if (AI_CONFIG.apiKey) headers['Authorization'] = 'Bearer ' + AI_CONFIG.apiKey;
    fetch(AI_CONFIG.endpoint, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ model: AI_CONFIG.model, messages: payloadMsgs, stream: true, reasoning_split: true })
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      var ct = r.headers.get('content-type') || '';
      /* 非流式接口：直接读 JSON */
      if (ct.indexOf('event-stream') === -1) {
        return r.json().then(function (d) {
          var m = d && d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content;
          if (m) onDelta(m);
          onDone();
        });
      }
      var reader = r.body.getReader();
      var dec = new TextDecoder();
      var buf = '';
      function pump() {
        reader.read().then(function (res) {
          if (res.done) { onDone(); return; }
          buf += dec.decode(res.value, { stream: true });
          var lines = buf.split('\n');
          buf = lines.pop();
          for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            if (line.indexOf('data:') !== 0) continue;
            var data = line.slice(5).trim();
            if (data === '[DONE]') { onDone(); return; }
            try {
              var j = JSON.parse(data);
              var c = j.choices && j.choices[0];
              var delta = (c && ((c.delta && c.delta.content) || (c.message && c.message.content))) || '';
              if (delta) onDelta(delta);
            } catch (e) {}
          }
          pump();
        }).catch(onErr);
      }
      pump();
    }).catch(onErr);
  }

  /* ---------- 发送 ---------- */
  function send() {
    var text = ta.value.trim();
    if (!text || busy) return;
    chipsBox.innerHTML = '';
    addMsg('u', text);
    ta.value = '';
    ta.style.height = 'auto';
    history.push({ role: 'user', content: text });
    clearBtn.disabled = false;
    busy = true; sendBtn.disabled = true;

    /* 未配置 API：友好提示 */
    if (!CONFIGURED) {
      var tip = addTyping();
      setTimeout(function () {
        tip.remove();
        var reply = '收到：「' + (text.length > 40 ? text.slice(0, 40) + '…' : text) + '」\n\n' +
          '我还没接入 LLM API。\n站点主人请点旁边的 **? 按钮** 查看接入指南，或打开 `assets/ai-assistant.js` 填好顶部 `AI_CONFIG`（OpenAI 兼容格式）。';
        addMsg('b', reply);
        history.push({ role: 'assistant', content: reply });
        busy = false; sendBtn.disabled = false;
      }, 600);
      return;
    }

    var payloadMsgs = [{ role: 'system', content: systemWithPage() }].concat(history.slice(-20));
    var bubble = null, acc = '', finished = false;

    function ensureBubble() {
      if (!bubble) bubble = addMsg('b', '');
    }
    function onDelta(delta) {
      ensureBubble();
      acc += delta;
      bubble.innerHTML = md(acc) + '<span class="ai-caret"></span>';
      msgs.scrollTop = msgs.scrollHeight;
    }
    function onDone() {
      if (finished) return;
      finished = true;
      ensureBubble();
      bubble.innerHTML = md(acc || '（接口未返回内容）');
      history.push({ role: 'assistant', content: acc });
      busy = false; sendBtn.disabled = false;
      msgs.scrollTop = msgs.scrollHeight;
    }
    function onErr(err) {
      if (finished) return;
      finished = true;
      if (bubble) bubble.remove();
      var reply = '⚠️ 请求失败：' + err.message + '\n\n请检查 `AI_CONFIG` 里的 endpoint / apiKey / model 是否正确，或稍后重试。';
      addMsg('b', reply);
      history.push({ role: 'assistant', content: reply });
      busy = false; sendBtn.disabled = false;
    }

    var tip = addTyping();
    /* 收到首个 delta 时移除打字动画 */
    var origOnDelta = onDelta;
    onDelta = function (d) { if (tip) { tip.remove(); tip = null; } origOnDelta(d); };

    streamChat(payloadMsgs, onDelta, onDone, onErr);
  }

  sendBtn.addEventListener('click', send);
  ta.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  });
  ta.addEventListener('input', function () {
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 100) + 'px';
  });

  /* ============================================================
     帮助弹窗：AI 助手使用指南
     ============================================================ */
  var mask = null;

  function openHelp() {
    if (!mask) buildHelp();
    mask.classList.add('show');
  }
  function closeHelp() {
    if (mask) mask.classList.remove('show');
  }

  function buildHelp() {
    mask = document.createElement('div');
    mask.className = 'ai-mask';
    mask.innerHTML =
      '<div class="ai-doc" role="dialog" aria-label="AI 助手使用指南">' +
      '<div class="ai-doc-head">' +
      '<div class="ai-ava" style="width:26px;height:26px;border-radius:8px;">' + iconSparkle(15, '#fff') + '</div>' +
      '<span class="ai-t">AI 助手使用指南</span>' +
      '<span class="ai-badge ' + (CONFIGURED ? 'ok' : 'off') + '">' +
      (CONFIGURED ? '● 已接入 · ' + AI_CONFIG.model : '● 当前未接入 API') + '</span>' +
      '<button class="ai-close" title="关闭（Esc）" style="margin-left:auto;">×</button>' +
      '</div>' +
      '<div class="ai-doc-body">' +

      '<p>本站 AI 助手支持任何 <b>OpenAI 兼容接口</b>（DeepSeek / 硅基流动 / Kimi / 智谱 / OpenAI / OpenRouter 等）。配置集中在 <code class="ai-ic">assets/ai-assistant.js</code> 顶部的 <code class="ai-ic">AI_CONFIG</code>，改这一个文件，全站 15+ 页面同时生效。</p>' +

      '<h4><span class="n">A</span>方式一 · 直连（简单，5 分钟）</h4>' +
      '<p>直接把 API 信息填进 <code class="ai-ic">AI_CONFIG</code> 的三个字段：</p>' +
      '<table><tr><th>字段</th><th>填什么</th></tr>' +
      '<tr><td><code class="ai-ic">endpoint</code></td><td>接口地址 + <code class="ai-ic">/v1/chat/completions</code></td></tr>' +
      '<tr><td><code class="ai-ic">apiKey</code></td><td>你的 API Key</td></tr>' +
      '<tr><td><code class="ai-ic">model</code></td><td>模型名，如 <code class="ai-ic">deepseek-chat</code></td></tr></table>' +
      '<p>常用平台对照：</p>' +
      '<table><tr><th>平台</th><th>endpoint 前缀</th><th>示例模型</th></tr>' +
      '<tr><td>DeepSeek</td><td><code class="ai-ic">https://api.deepseek.com</code></td><td><code class="ai-ic">deepseek-chat</code></td></tr>' +
      '<tr><td>硅基流动</td><td><code class="ai-ic">https://api.siliconflow.cn</code></td><td><code class="ai-ic">Qwen/Qwen2.5-7B-Instruct</code></td></tr>' +
      '<tr><td>Kimi</td><td><code class="ai-ic">https://api.moonshot.cn</code></td><td><code class="ai-ic">moonshot-v1-8k</code></td></tr>' +
      '<tr><td>智谱 GLM</td><td><code class="ai-ic">https://open.bigmodel.cn</code></td><td><code class="ai-ic">glm-4-flash</code></td></tr>' +
      '<tr><td>MiniMax</td><td><code class="ai-ic">https://api.minimaxi.com</code></td><td><code class="ai-ic">MiniMax-M2.5</code></td></tr>' +
      '<tr><td>OpenRouter</td><td><code class="ai-ic">https://openrouter.ai</code></td><td>任选</td></tr></table>' +
      '<div class="warn">⚠️ 直连意味着 <b>Key 明文出现在网页源码里</b>（F12 可见），任何人都能拿去刷你的额度。适合用<b>免费额度 / 低额度小号</b>的场景；主力 Key 请用方式 B。</div>' +

      '<h4><span class="n">B</span>方式二 · Cloudflare Worker 中转（推荐，保护 Key）</h4>' +
      '<p>原理：<b>浏览器 → 你的 Worker（不带真 Key）→ LLM API（带真 Key）→ 原路返回</b>。真 Key 只存在 Worker 的加密变量里，网页源码永远不出现。脚本已内置：来源白名单（只允许本站）、口令校验、每 IP 每分钟限 10 次、流式透传。</p>' +
      '<ol>' +
      '<li>注册/登录 <a href="https://dash.cloudflare.com" target="_blank" rel="noopener">dash.cloudflare.com</a>（免费，无需绑卡）</li>' +
      '<li>左侧 <b>Workers 和 Pages</b> → 创建 Worker，起名如 <code class="ai-ic">llm-proxy</code></li>' +
      '<li>点「编辑代码」，粘贴下方脚本 → 右上角「部署」</li>' +
      '<li>设置 → 变量和机密，添加 4 个变量：</li>' +
      '</ol>' +
      '<table><tr><th>变量名</th><th>填什么</th></tr>' +
      '<tr><td><code class="ai-ic">API_KEY</code></td><td>真实 LLM Key（选「加密」类型）</td></tr>' +
      '<tr><td><code class="ai-ic">BASE_URL</code></td><td>上游根地址，如 <code class="ai-ic">https://api.deepseek.com</code></td></tr>' +
      '<tr><td><code class="ai-ic">MODEL</code></td><td>默认模型，如 <code class="ai-ic">deepseek-chat</code></td></tr>' +
      '<tr><td><code class="ai-ic">PROXY_KEY</code></td><td>随便编一串口令（浏览器端需带上，防别人白嫖）</td></tr></table>' +
      '<ol start="5">' +
      '<li>部署后得到地址 <code class="ai-ic">https://llm-proxy.你的子域.workers.dev</code>，把它填进 <code class="ai-ic">AI_CONFIG.endpoint</code>（记得补上 <code class="ai-ic">/v1/chat/completions</code>），<code class="ai-ic">apiKey</code> 填你编的 <code class="ai-ic">PROXY_KEY</code>，<code class="ai-ic">model</code> 填模型名</li>' +
      '</ol>' +
      '<div class="acts">' +
      '<button class="ai-copy" id="ai-copy-worker">📋 复制 Worker 脚本</button>' +
      '<a class="ai-copy ghost" style="text-decoration:none;display:inline-flex;align-items:center;" ' +
      'href="https://github.com/Xplore-LAB/llm-tracker/blob/master/assets/llm-proxy-worker.js" ' +
      'target="_blank" rel="noopener">在 GitHub 打开脚本</a>' +
      '</div>' +

      '<h4><span class="n">C</span>方式三 · 自托管服务器中转（自己的服务器 + 公网域名）</h4>' +
      '<p>与方式 B 等价，适合不想用 Cloudflare 的场景。原理相同：<b>真实 Key 只存在你服务器的环境变量里</b>，不写进任何文件、不发给任何人；网页端只放公网地址和自编口令。脚本是 Node 零依赖版（Node ≥ 18），与 Worker 版逻辑一致：来源白名单、口令校验、每 IP 每分钟限 10 次、流式透传。</p>' +
      '<ol>' +
      '<li>把脚本 <code class="ai-ic">assets/llm-proxy-server.js</code> 拷到你的服务器，启动（换成你的真实值）：<br>' +
      '<code class="ai-ic">MINIMAX_API_KEY=你的真实key PROXY_KEY=自编口令 PORT=8787 node llm-proxy-server.js</code></li>' +
      '<li>把本机 8787 端口暴露成 <b>https</b> 公网域名（二选一）：<br>' +
      '<code class="ai-ic">cpolar http 8787</code>（最省事，自动给 https 域名）<br>' +
      '<code class="ai-ic">caddy reverse-proxy --from 你的域名 --to localhost:8787</code>（有自己的域名和常开服务器时更稳）</li>' +
      '<li>验证隧道通了：<code class="ai-ic">curl https://你的公网域名/health</code>，返回 <code class="ai-ic">{"ok":true}</code> 即成</li>' +
      '<li>把公网地址填进 <code class="ai-ic">AI_CONFIG.endpoint</code>（补上 <code class="ai-ic">/v1/chat/completions</code>），<code class="ai-ic">apiKey</code> 填你编的 <code class="ai-ic">PROXY_KEY</code></li>' +
      '</ol>' +
      '<div class="warn">⚠️ 必须 <b>https</b>：GitHub Pages 是 https，浏览器会拦截发往 http 接口的请求。另外可用性跟着你的机器走：跑在自己电脑上时，合盖睡眠期间全站助手下线。</div>' +
      '<div class="acts">' +
      '<button class="ai-copy" id="ai-copy-server">📋 复制自托管脚本</button>' +
      '<a class="ai-copy ghost" style="text-decoration:none;display:inline-flex;align-items:center;" ' +
      'href="https://github.com/Xplore-LAB/llm-tracker/blob/master/assets/llm-proxy-server.js" ' +
      'target="_blank" rel="noopener">在 GitHub 打开脚本</a>' +
      '</div>' +
      '<div class="tip">💡 配置完成后，欢迎语里的「未接入」提示和头部状态点会自动变成「在线 · 可对话」，快捷提问、流式打字、Markdown 渲染即刻可用。</div>' +
      '</div>' +
      '</div>';
    document.body.appendChild(mask);

    mask.addEventListener('click', function (e) { if (e.target === mask) closeHelp(); });
    mask.querySelector('.ai-close').addEventListener('click', closeHelp);

    /* 复制中转脚本（Worker 版 / 自托管版通用） */
    function wireCopy(id, path, label, doneLabel, githubUrl) {
      var btn = mask.querySelector('#' + id);
      if (!btn) return;
      btn.addEventListener('click', function () {
        fetch(path)
          .then(function (r) { return r.text(); })
          .then(function (t) { return navigator.clipboard.writeText(t); })
          .then(function () {
            btn.classList.add('done');
            btn.textContent = doneLabel;
            setTimeout(function () {
              btn.classList.remove('done');
              btn.textContent = label;
            }, 2500);
          })
          .catch(function () {
            window.open(githubUrl, '_blank');
          });
      });
    }
    wireCopy('ai-copy-worker', '/llm-tracker/assets/llm-proxy-worker.js',
      '📋 复制 Worker 脚本', '✓ 已复制，去 Worker 编辑器粘贴',
      'https://github.com/Xplore-LAB/llm-tracker/blob/master/assets/llm-proxy-worker.js');
    wireCopy('ai-copy-server', '/llm-tracker/assets/llm-proxy-server.js',
      '📋 复制自托管脚本', '✓ 已复制，拷到你的服务器运行',
      'https://github.com/Xplore-LAB/llm-tracker/blob/master/assets/llm-proxy-server.js');
  }

  helpBtn.addEventListener('click', openHelp);

  /* Esc：先关帮助弹窗，再关对话面板 */
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (mask && mask.classList.contains('show')) { closeHelp(); return; }
    closePanel();
  });
})();
