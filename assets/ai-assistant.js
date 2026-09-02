/* ============================================================
   AI 助手 v2.2（大模型情报局）
   · 深色玻璃悬浮球（右下角，可拖拽），点击展开毛玻璃对话面板
   · 流式输出 + Markdown 渲染 + 快捷提问
   · v2.2 页面上下文感知：提问瞬间快照当前页面
     （标题 / 路由深链 / 小节大纲 / 搜索筛选状态 / 视口可见正文 /
      可见表格转 Markdown），拼入 system 消息发给 AI；
     消息下方 📍 徽标可展开查看实际捕获内容（透明可审计）
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
    systemPrompt: '你是「大模型情报局」（llm-tracker.github.io / xplore-lab.github.io/llm-tracker）的 AI 助手，专长于大语言模型（LLM）与 AI 求职面试方向。\n\n【身份与领域】\n- 服务对象：浏览本站的用户，主要关心 LLM 基础知识、前沿研究、主流模型、训练/微调/推理技术、AI 行业动态、秋招/校招面试题与职业路径。\n- 站点内容覆盖：模型卡片（GPT/Claude/Gemini/DeepSeek/Qwen/GLM/Mistral/Llama 等）、技术专题（Transformer / MoE / RLHF / 推理时计算 / 长上下文 / RAG / Agent）、求职资料（秋招时间线、面经、笔试题、岗位选择）。\n\n【回答风格】\n- 默认中文，简明、结构化（要点 + 必要时小标题 + 必要时表格/列表）。\n- 涉及代码只给关键片段，不要大段堆砌；注释行用中文。\n- 涉及论文 / 模型 / 数据集，给出来源（作者+年份+arXiv/DOI），不确定就明说「未核实」。\n- 涉及时间敏感信息（榜单、API 价格、模型版本），提醒「请以官网最新为准」。\n\n【页面上下文】\n- system 消息末尾附有用户提问瞬间的页面快照：页面标题、路由（含深链参数）、页面小节大纲、当前搜索/筛选状态、视口可见内容摘录、可见表格节选。\n- 回答优先结合快照内容；用户说「这页 / 这个表 / 这一段 / 当前这个模型」等指代时，按快照理解。\n- 快照只覆盖用户当时可见的部分，页面其余内容可能未捕获；若信息不足以回答，请说明并请用户补充。\n\n【边界】\n- 拒绝涉政、涉黄、暴力违法内容。\n- 不冒充真实人物、不提供医疗/法律/金融的最终结论（给方向不给结论）。\n- 涉及 MiniMax / Anthropic / OpenAI / Google 等厂商内部信息，明确「未公开 / 未核实」。',
    welcome: '你好，我是情报局 AI 助手 ✦\n可以问我大模型、秋招面试相关的问题。我会**自动感知你正在看的页面**，直接问「这个表怎么读」「当前这个模型」就行。**按住我可以拖到任何角落**，面板标题栏也能拖动。',
    contextChars: 3000,  /* 页面上下文字符预算（标题+大纲约0.8K / 正文摘录约45% / 表格约35%），省 token */
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
    '.ai-maxbtn{border:0;background:transparent;color:#8a94a6;width:28px;height:28px;border-radius:8px;',
    'font-size:14px;line-height:1;cursor:pointer;padding:0;flex:none;display:inline-flex;align-items:center;justify-content:center;',
    'transition:background .15s ease,color .15s ease;}',
    '.ai-maxbtn:hover{background:rgba(15,23,42,.08);color:#26303d;}',
    '.ai-resize{position:absolute;right:0;bottom:0;width:20px;height:20px;cursor:nwse-resize;z-index:6;',
    'background:linear-gradient(135deg,transparent 52%,rgba(120,130,150,.5) 52%);}',

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
    '.ai-code{position:relative;background:#151820;color:#dbe2f0;border-radius:10px;padding:10px 12px;margin:6px 0;',
    'overflow-x:auto;font:12px/1.55 ui-monospace,Consolas,Menlo,monospace;}',
    '.ai-code-lang{position:absolute;top:5px;right:8px;font-size:10px;letter-spacing:.4px;color:rgba(148,163,184,.75);',
    'font-family:ui-monospace,Consolas,Menlo,monospace;pointer-events:none;}',
    '.ai-copy{position:absolute;bottom:5px;right:8px;font-size:10.5px;line-height:1;padding:4px 9px;border-radius:6px;',
    'border:1px solid rgba(148,163,184,.35);background:rgba(255,255,255,.05);color:#94a3b8;cursor:pointer;',
    'transition:color .15s ease,border-color .15s ease,background .15s ease;}',
    '.ai-copy:hover{color:#e2e8f0;border-color:rgba(148,163,184,.65);background:rgba(255,255,255,.1);}',
    '.ai-copy.ok{color:#34d399;border-color:rgba(52,211,153,.55);}',
    '.ai-m.b a{color:#4f46e5;}',
    '.ai-m.b .ai-h1{font-size:15px;font-weight:700;margin:10px 0 4px;padding-bottom:3px;',
    'border-bottom:1px solid rgba(99,102,241,.28);}',
    '.ai-m.b .ai-h2{font-size:14px;font-weight:700;margin:8px 0 3px;color:#3730a3;}',
    '.ai-m.b .ai-h3{font-size:13px;font-weight:650;margin:6px 0 2px;color:#4338ca;}',
    '.ai-m.b .ai-ol{margin:2px 0;padding-left:20px;}',
    '.ai-m.b .ai-ol li{margin:2px 0;}',
    '.ai-m.b .ai-bq{margin:6px 0;padding:6px 10px;border-left:3px solid rgba(99,102,241,.5);',
    'background:rgba(99,102,241,.07);border-radius:0 8px 8px 0;font-size:12.5px;color:#475569;}',
    '.ai-m.b .ai-hr{height:1px;background:rgba(100,116,139,.22);margin:8px 0;}',
    '.ai-tblw{overflow-x:auto;margin:6px 0;border:1px solid rgba(100,116,139,.22);border-radius:8px;}',
    '.ai-tbl{border-collapse:collapse;width:100%;font-size:12px;}',
    '.ai-tbl th{background:rgba(99,102,241,.1);font-weight:650;padding:5px 9px;text-align:left;white-space:nowrap;}',
    '.ai-tbl td{padding:4px 9px;border-top:1px solid rgba(100,116,139,.15);vertical-align:top;}',
    '.ai-tbl tbody tr:nth-child(even){background:rgba(100,116,139,.05);}',

    /* ----- 页面上下文徽标（用户消息下方） ----- */
    '.ai-ctx{align-self:flex-end;margin:-7px 2px 2px;font-size:10.5px;color:#8a94a6;cursor:pointer;',
    'user-select:none;-webkit-user-select:none;display:inline-flex;align-items:center;gap:3px;max-width:100%;',
    'padding:2px 9px;border-radius:999px;border:1px solid rgba(15,23,42,.1);background:rgba(255,255,255,.55);',
    'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;',
    'transition:color .15s ease,border-color .15s ease;}',
    '.ai-ctx:hover,.ai-ctx.open{color:#4f46e5;border-color:rgba(99,102,241,.45);}',
    '.ai-ctx-view{align-self:stretch;margin:0 2px 8px;display:none;max-height:170px;overflow-y:auto;',
    'background:rgba(99,102,241,.05);border:1px dashed rgba(99,102,241,.35);border-radius:10px;padding:8px 10px;',
    'font:10.5px/1.55 ui-monospace,Consolas,Menlo,monospace;color:#5b6575;white-space:pre-wrap;word-break:break-word;}',
    '.ai-ctx-view::-webkit-scrollbar{width:4px;}',
    '.ai-ctx-view::-webkit-scrollbar-thumb{background:rgba(120,130,150,.3);border-radius:3px;}',
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
    '.ai-dark .ai-maxbtn{color:#9aa5b8;}',
    '.ai-dark .ai-maxbtn:hover{background:rgba(255,255,255,.1);color:#fff;}',
    '.ai-dark .ai-resize{background:linear-gradient(135deg,transparent 52%,rgba(255,255,255,.28) 52%);}',
    '.ai-dark .ai-m.b{background:rgba(255,255,255,.07);}',
    '.ai-dark .ai-ic{background:rgba(129,140,248,.18);color:#a5b4fc;}',
    '.ai-dark .ai-m.b a{color:#a5b4fc;}',
    '.ai-dark .ai-m.b .ai-h1{border-bottom-color:rgba(129,140,248,.35);}',
    '.ai-dark .ai-m.b .ai-h2{color:#c7d2fe;}',
    '.ai-dark .ai-m.b .ai-h3{color:#a5b4fc;}',
    '.ai-dark .ai-m.b .ai-bq{color:#cbd5e1;background:rgba(129,140,248,.08);border-left-color:rgba(129,140,248,.5);}',
    '.ai-dark .ai-m.b .ai-hr{background:rgba(148,163,184,.25);}',
    '.ai-dark .ai-tblw{border-color:rgba(148,163,184,.25);}',
    '.ai-dark .ai-tbl th{background:rgba(129,140,248,.13);}',
    '.ai-dark .ai-tbl td{border-top-color:rgba(148,163,184,.15);}',
    '.ai-dark .ai-tbl tbody tr:nth-child(even){background:rgba(148,163,184,.06);}',
    '.ai-dark .ai-chip{border-color:rgba(129,140,248,.4);background:rgba(129,140,248,.1);color:#a5b4fc;}',
    '.ai-dark .ai-chip:hover{background:rgba(129,140,248,.18);}',
    '.ai-dark .ai-ctx{background:rgba(255,255,255,.05);border-color:rgba(255,255,255,.12);color:#9aa5b8;}',
    '.ai-dark .ai-ctx:hover,.ai-dark .ai-ctx.open{color:#a5b4fc;border-color:rgba(129,140,248,.45);}',
    '.ai-dark .ai-ctx-view{background:rgba(129,140,248,.08);border-color:rgba(129,140,248,.35);color:#c3cadb;}',
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
  function iconMax() {
    return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none">' +
      '<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }
  function iconRestore() {
    return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none">' +
      '<path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
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
    '<button class="ai-maxbtn" title="放大" aria-label="放大">' + iconMax() + '</button>' +
    '<button class="ai-clear" title="清空当前对话" aria-label="清空当前对话">' + iconTrash() + '</button>' +
    '<button class="ai-close" title="收起（Esc）">×</button>' +
    '</div>' +
    '<div class="ai-msgs"></div>' +
    '<div class="ai-chips"></div>' +
    '<div class="ai-input">' +
    '<textarea rows="1" placeholder="问点什么…（Enter 发送 / Shift+Enter 换行）"></textarea>' +
    '<button class="ai-send" title="发送">' + iconSend() + '</button>' +
    '</div>' +
    '<div class="ai-resize" title="拖拽调整大小"></div>';
  document.body.appendChild(panel);

  var msgs = panel.querySelector('.ai-msgs');
  var chipsBox = panel.querySelector('.ai-chips');
  var ta = panel.querySelector('textarea');
  var sendBtn = panel.querySelector('.ai-send');
  var closeBtn = panel.querySelector('.ai-close');
  var clearBtn = panel.querySelector('.ai-clear');
  clearBtn.disabled = true;
  var maxBtn = panel.querySelector('.ai-maxbtn');
  var rs = panel.querySelector('.ai-resize');
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

  /* ---------- 最大化 / 还原 ---------- */
  function toggleMax() {
    var willMax = !panel.classList.contains('ai-max');
    panel.classList.toggle('ai-max', willMax);
    var vw = window.innerWidth, vh = window.innerHeight;
    panel.style.width = (willMax ? Math.min(780, vw - 24) : Math.min(380, vw - 16)) + 'px';
    panel.style.height = (willMax ? Math.min(Math.round(vh * 0.84), 900) : Math.min(540, Math.round(vh * 0.76))) + 'px';
    var r = panel.getBoundingClientRect();
    panel.style.right = 'auto'; panel.style.bottom = 'auto';
    panel.style.left = clamp(r.left, 8, Math.max(8, vw - r.width - 8)) + 'px';
    panel.style.top = clamp(r.top, 8, Math.max(8, vh - r.height - 8)) + 'px';
    maxBtn.innerHTML = willMax ? iconRestore() : iconMax();
    maxBtn.title = willMax ? '还原' : '放大';
  }
  maxBtn.addEventListener('click', toggleMax);

  /* ---------- 右下角拖拽调整大小 ---------- */
  rs.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    var r = panel.getBoundingClientRect();
    panel.style.right = 'auto'; panel.style.bottom = 'auto';
    panel.style.left = r.left + 'px'; panel.style.top = r.top + 'px';
    if (panel.classList.contains('ai-max')) {
      panel.classList.remove('ai-max');
      maxBtn.innerHTML = iconMax(); maxBtn.title = '放大';
    }
    var sw = panel.offsetWidth, sh = panel.offsetHeight, sx = e.clientX, sy = e.clientY;
    try { rs.setPointerCapture(e.pointerId); } catch (err) {}
    function mv(ev) {
      panel.style.width = clamp(sw + ev.clientX - sx, 320, window.innerWidth - 16) + 'px';
      panel.style.height = clamp(sh + ev.clientY - sy, 420, window.innerHeight - 16) + 'px';
    }
    function up(ev) {
      try { rs.releasePointerCapture(ev.pointerId); } catch (err) {}
      document.removeEventListener('pointermove', mv);
      document.removeEventListener('pointerup', up);
    }
    document.addEventListener('pointermove', mv);
    document.addEventListener('pointerup', up);
  });

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

  /* ---------- Markdown 简易渲染（v2.2：标题分级/有序列表/表格/引用/分隔线/斜体删除线） ---------- */
  function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function inline(s) {
    return s
      .replace(/`([^`]+)`/g, '<code class="ai-ic">$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
      .replace(/(^|[^*\w])\*([^*\n]+)\*(?![*\w])/g, '$1<i>$2</i>')
      .replace(/~~([^~\n]+)~~/g, '<s>$1</s>')
      .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  }
  function codeBlock(lang, code) {
    return '<pre class="ai-code">' + (lang ? '<span class="ai-code-lang">' + lang + '</span>' : '') +
      '<code>' + code + '</code></pre>';
  }
  function mdTable(rows) {
    function cells(r) {
      return r.trim().replace(/^\|/, '').replace(/\|$/, '').split('|');
    }
    var head = cells(rows[0]).map(function (c) { return c.trim(); });
    var out = '<div class="ai-tblw"><table class="ai-tbl"><thead><tr>';
    for (var c = 0; c < head.length; c++) out += '<th>' + inline(head[c]) + '</th>';
    out += '</tr></thead><tbody>';
    for (var r = 2; r < rows.length; r++) {
      var cs = cells(rows[r]).map(function (c) { return c.trim(); });
      out += '<tr>';
      for (var c2 = 0; c2 < head.length; c2++) out += '<td>' + inline(cs[c2] || '') + '</td>';
      out += '</tr>';
    }
    return out + '</tbody></table></div>';
  }
  function md(src) {
    var out = '', inCode = false, codeBuf = '', codeLang = '';
    var lines = esc(src).split('\n');
    var listOpen = null; /* 'ul' | 'ol' */
    function closeList() { if (listOpen) { out += '</' + listOpen + '>'; listOpen = null; } }
    for (var i = 0; i < lines.length; i++) {
      var l = lines[i];
      var fence = l.match(/^\s*```(\w*)/);
      if (fence) {
        if (!inCode) { closeList(); inCode = true; codeBuf = ''; codeLang = fence[1] || ''; }
        else { inCode = false; out += codeBlock(codeLang, codeBuf); }
        continue;
      }
      if (inCode) { codeBuf += l + '\n'; continue; }
      /* 表格：表头行 + 紧随的分隔行 */
      if (/^\s*\|.*\|\s*$/.test(l) && i + 1 < lines.length && /^\s*\|[\s:|\-]+\|\s*$/.test(lines[i + 1])) {
        closeList();
        var rows = [];
        while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) { rows.push(lines[i]); i++; }
        out += mdTable(rows);
        i--;
        continue;
      }
      if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(l)) { closeList(); out += '<div class="ai-hr"></div>'; continue; }
      var h = l.match(/^\s*(#{1,4})\s+(.*)$/);
      if (h) { closeList(); out += '<div class="ai-h ai-h' + h[1].length + '">' + inline(h[2]) + '</div>'; continue; }
      var bq = l.match(/^\s*&gt;\s?(.*)$/);
      if (bq) { closeList(); out += '<blockquote class="ai-bq">' + inline(bq[1]) + '</blockquote>'; continue; }
      var li = l.match(/^\s*(?:([-*•])|(\d+[.)]))\s+(.*)$/);
      if (li) {
        var tag = li[2] ? 'ol' : 'ul';
        if (listOpen !== tag) { closeList(); out += '<' + tag + ' class="ai-ul">'; listOpen = tag; }
        out += '<li>' + inline(li[3]) + '</li>'; continue;
      }
      closeList();
      if (l.trim() === '') out += '<div class="ai-br"></div>';
      else out += '<p>' + inline(l) + '</p>';
    }
    if (inCode) out += codeBlock(codeLang, codeBuf);
    closeList();
    return out;
  }
  /* 渲染完成后给代码块挂复制按钮（流式中间帧不挂，最终帧与历史消息挂） */
  function decorateMd(root) {
    if (!root || !navigator.clipboard) return;
    var pres = root.querySelectorAll('.ai-code');
    for (var i = 0; i < pres.length; i++) {
      if (pres[i].querySelector('.ai-copy')) continue;
      var b = document.createElement('button');
      b.className = 'ai-copy';
      b.type = 'button';
      b.textContent = '复制';
      (function (pre) {
        b.onclick = function () {
          var code = pre.querySelector('code');
          if (!code) return;
          navigator.clipboard.writeText(code.textContent).then(function () {
            b.textContent = '已复制 ✓';
            b.classList.add('ok');
            setTimeout(function () { b.textContent = '复制'; b.classList.remove('ok'); }, 1600);
          });
        };
      })(pres[i]);
      pres[i].appendChild(b);
    }
  }

  /* ---------- 消息 ---------- */
  function addMsg(role, text) {
    var d = document.createElement('div');
    d.className = 'ai-m ' + (role === 'u' ? 'u' : 'b');
    if (role === 'u') d.textContent = text;
    else { d.innerHTML = md(text); decorateMd(d); }
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
  /* 用户消息下方的「已附页面上下文」徽标：点击展开查看实际捕获内容 */
  function addCtxBadge(ctx) {
    if (!ctx || !ctx.text) return;
    var b = document.createElement('div');
    b.className = 'ai-ctx';
    b.textContent = '📍 已附本页上下文 · ' + (ctx.title || location.pathname).slice(0, 30);
    b.title = '点击查看随这条消息发送给 AI 的页面上下文';
    var view = document.createElement('div');
    view.className = 'ai-ctx-view';
    view.textContent = ctx.text;
    b.addEventListener('click', function () {
      var open = view.style.display !== 'block';
      view.style.display = open ? 'block' : 'none';
      b.classList.toggle('open', open);
      if (open) msgs.scrollTop = msgs.scrollHeight;
    });
    msgs.appendChild(b);
    msgs.appendChild(view);
    msgs.scrollTop = msgs.scrollHeight;
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

  /* ---------- 页面上下文感知（v2.2） ----------
     提问瞬间对当前页做一次 DOM 快照（每次提问重新捕获，反映滚动/筛选变化）：
     ① 标题 + 路由（深链参数天然携带搜索/展开状态）
     ② 页面小节大纲（h1~h3，全页可见即可，无需在视口内）
     ③ 搜索框 / 下拉 / .active 筛选 chip 的当前值
     ④ 与视口相交的可见正文块（p/li/blockquote 等，折叠内容天然过滤）
     ⑤ 可见表格转紧凑 Markdown（视口相交行优先，行×列×单元格均限幅）
     预算：AI_CONFIG.contextChars（默认 6000），超额优先保标题+表格、截断正文并注明 */
  var CTX_EXCLUDE = '#ai-dock,#ai-panel,.ai-mask,script,style,noscript,template,nav,footer,.tabs,#related-content';

  function ctxExcluded(el) {
    return !!(el && el.closest && el.closest(CTX_EXCLUDE));
  }
  /* 元素对用户可见：非 display:none，有尺寸，且与视口相交（上下各放宽 120px 缓冲） */
  function ctxInView(el) {
    var r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    return r.bottom > -120 && r.top < window.innerHeight + 120;
  }
  /* 元素已渲染（不要求在视口内，用于全页大纲） */
  function ctxShown(el) {
    return !!(el.offsetParent || (el.getBoundingClientRect().width > 2));
  }
  function ctxTxt(el, cap) {
    return (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, cap || 200);
  }

  /* ② 小节大纲 */
  function ctxOutline() {
    var out = [], hs = document.querySelectorAll('h1,h2,h3');
    for (var i = 0; i < hs.length && out.length < 60; i++) {
      var h = hs[i];
      if (ctxExcluded(h) || !ctxShown(h)) continue;
      var t = ctxTxt(h, 60);
      if (t) out.push(new Array(Math.max(1, +h.tagName.charAt(1))).join('  ') + '- ' + t);
    }
    return out;
  }

  /* ③ 搜索 / 筛选状态 */
  function ctxState() {
    var parts = [];
    var inputs = document.querySelectorAll('input[type=text],input[type=search],input:not([type])');
    for (var i = 0; i < inputs.length && parts.length < 6; i++) {
      if (ctxExcluded(inputs[i])) continue;
      var v = (inputs[i].value || '').trim();
      if (v) parts.push('搜索「' + v.slice(0, 40) + '」');
    }
    var sels = document.querySelectorAll('select');
    for (var j = 0; j < sels.length && parts.length < 8; j++) {
      if (ctxExcluded(sels[j])) continue;
      var so = sels[j].selectedOptions && sels[j].selectedOptions[0];
      if (so && so.value) parts.push(ctxTxt(sels[j].labels && sels[j].labels[0] || sels[j], 12) + '=' + ctxTxt(so, 30));
    }
    var acts = document.querySelectorAll('button.active,.chip.active,.seg.active,.tab.active,.filter.active,[aria-pressed=true]');
    for (var k = 0; k < acts.length && parts.length < 14; k++) {
      if (ctxExcluded(acts[k])) continue;
      var t = ctxTxt(acts[k], 20);
      if (t) parts.push('选中「' + t + '」');
    }
    return parts;
  }

  /* ④ 视口可见正文：TreeWalker 文本节点归组，兼容纯 DIV/SPAN 结构的页面
       归宿规则：向上找到 P/LI/H4~H6/BLOCKQUOTE 等细块 → 全文为一行；
       遇到无块级子元素的 DIV/SECTION（叶子容器）→ 其文本为一行；
       表格单元格 / 链接 / 按钮 / h1~h3 的文本跳过（表格另有转换，标题走大纲） */
  var CTX_SKIP_UP = { TABLE: 1, THEAD: 1, TBODY: 1, TFOOT: 1, TR: 1, TD: 1, TH: 1, CAPTION: 1, BUTTON: 1, A: 1, SELECT: 1, OPTION: 1, LABEL: 1, H1: 1, H2: 1, H3: 1, NOSCRIPT: 1 };
  var CTX_FINE = { P: 1, LI: 1, BLOCKQUOTE: 1, FIGCAPTION: 1, DT: 1, DD: 1, PRE: 1, SUMMARY: 1, H4: 1, H5: 1, H6: 1 };
  function ctxHostOf(el) {
    for (var e = el; e && e !== document.body; e = e.parentElement) {
      var tag = e.tagName;
      if (CTX_SKIP_UP[tag]) return null;
      if (CTX_FINE[tag]) return e;
      if (tag === 'DIV' || tag === 'SECTION') {
        var blocky = false;
        for (var c = e.firstElementChild; c; c = c.nextElementSibling) {
          var ct = c.tagName;
          if (ct === 'DIV' || ct === 'P' || ct === 'UL' || ct === 'OL' || ct === 'LI' || ct === 'TABLE' ||
              ct === 'SECTION' || ct === 'H1' || ct === 'H2' || ct === 'H3' || ct === 'H4' ||
              ct === 'BLOCKQUOTE' || ct === 'PRE') { blocky = true; break; }
        }
        if (!blocky) return e;
      }
    }
    return null;
  }
  function ctxTextLines() {
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    var node, lines = [], outer = [], count = 0;
    while ((node = walker.nextNode()) && count < 8000 && lines.length < 120) {
      count++;
      if (!(node.nodeValue || '').trim()) continue;
      var parent = node.parentElement;
      if (!parent || ctxExcluded(parent)) continue;
      var host = ctxHostOf(parent);
      if (!host || ctxExcluded(host)) continue;
      var dup = false;
      for (var j = 0; j < outer.length; j++) {
        if (outer[j].contains(host)) { dup = true; break; }
      }
      if (dup) continue;
      if (!ctxInView(host)) continue;
      var t = ctxTxt(host, 200);
      if (t.length < 2) continue;
      lines.push((host.tagName === 'SUMMARY' ? '▸ ' : '') + t);
      outer.push(host);
    }
    return lines;
  }

  /* ⑤ 表格转 Markdown：视口相交行优先，不足则从头补；限 24 行 × 10 列 × 单元格 20 字 */
  function ctxRowMd(tr) {
    var cells = tr.querySelectorAll('th,td'), vals = [];
    for (var c = 0; c < cells.length && c < 10; c++) vals.push(ctxTxt(cells[c], 20));
    return '| ' + vals.join(' | ') + ' |';
  }
  function ctxTableMd(tb) {
    var rows = tb.querySelectorAll('tr'), inView = [];
    for (var i = 0; i < rows.length; i++) {
      if (ctxInView(rows[i])) inView.push(rows[i]);
    }
    var use = inView.length >= 6 ? inView : Array.prototype.slice.call(rows, 0);
    if (use.length > 12) use = use.slice(0, 12);
    var out = [];
    for (var r = 0; r < use.length; r++) {
      out.push(ctxRowMd(use[r]));
      if (r === 0) {
        var n = Math.min(use[0].querySelectorAll('th,td').length, 10), sep = [];
        for (var s = 0; s < n; s++) sep.push('---');
        out.push('| ' + sep.join(' | ') + ' |');
      }
    }
    return '（共 ' + rows.length + ' 行' + (rows.length > 24 ? '，节选前/可见 ' + use.length + ' 行' : '') + '）\n' + out.join('\n');
  }
  function ctxTables() {
    var tbs = document.querySelectorAll('table'), picked = [];
    for (var i = 0; i < tbs.length && picked.length < 2; i++) {
      if (!ctxExcluded(tbs[i]) && tbs[i].rows && tbs[i].rows.length >= 2 && ctxInView(tbs[i])) picked.push(tbs[i]);
    }
    if (!picked.length) {  /* 视口无表格时兜底：页面第一个大表（≥6 行）取开头 */
      for (var k = 0; k < tbs.length; k++) {
        if (!ctxExcluded(tbs[k]) && tbs[k].rows && tbs[k].rows.length >= 6) { picked.push(tbs[k]); break; }
      }
    }
    if (!picked.length) return '';
    var out = [];
    for (var p = 0; p < picked.length; p++) out.push('表格' + (picked.length > 1 ? (p + 1) : '') + ' ' + ctxTableMd(picked[p]));
    return out.join('\n\n');
  }

  /* 组装快照，预算分配：基础信息 ≤1200，正文摘录 ≤45%，表格 ≤35% */
  function buildPageContext() {
    var budget = +AI_CONFIG.contextChars > 500 ? +AI_CONFIG.contextChars : 3000;
    var title = (document.title || '').replace(/\s+/g, ' ').trim().slice(0, 100);
    var lines = [];
    lines.push('【用户当前页面上下文】（系统于提问时刻自动捕获）');
    lines.push('页面：' + title);
    lines.push('路由：' + location.href);
    var st = ctxState();
    if (st.length) lines.push('当前搜索/筛选状态：' + st.join('；'));
    var outline = ctxOutline();
    if (outline.length) {
      var o = outline.join('\n');
      if (o.length > 800) o = o.slice(0, 800) + '\n…（小节过多已截断）';
      lines.push('页面小节结构：\n' + o);
    }
    var tl = ctxTextLines();
    if (tl.length) {
      var capTxt = Math.round(budget * 0.45), buf = [], used = 0;
      for (var i = 0; i < tl.length; i++) {
        if (used + tl[i].length > capTxt) { buf.push('…（可见内容较多已截断）'); break; }
        buf.push('- ' + tl[i]);
        used += tl[i].length + 2;
      }
      lines.push('用户当前视口可见内容摘录：\n' + buf.join('\n'));
    }
    var tbs = ctxTables();
    if (tbs) {
      var capTb = Math.round(budget * 0.35);
      lines.push('页面表格节选：\n' + (tbs.length > capTb ? tbs.slice(0, capTb) + '\n…（表格已截断）' : tbs));
    }
    var text = lines.join('\n\n');
    if (text.length > budget) text = text.slice(0, budget) + '\n…（上下文已达上限，未能全部附上）';
    return { title: title, text: text };
  }

  function systemWithPage(ctx) {
    return AI_CONFIG.systemPrompt + '\n\n' + ctx.text;
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
    var pageCtx = buildPageContext();  /* 提问瞬间快照：滚动/筛选/展开状态最新 */
    addCtxBadge(pageCtx);
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

    var payloadMsgs = [{ role: 'system', content: systemWithPage(pageCtx) }].concat(history.slice(-20));
    var bubble = null, acc = '', finished = false, rafId = null;

    function ensureBubble() {
      if (!bubble) bubble = addMsg('b', '');
    }
    function onDelta(delta) {
      ensureBubble();
      acc += delta;
      if (rafId === null) {
        rafId = requestAnimationFrame(function () {
          rafId = null;
          bubble.innerHTML = md(acc) + '<span class="ai-caret"></span>';
          msgs.scrollTop = msgs.scrollHeight;
        });
      }
    }
    function onDone() {
      if (finished) return;
      finished = true;
      if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
      ensureBubble();
      bubble.innerHTML = md(acc || '（接口未返回内容）');
      decorateMd(bubble);
      history.push({ role: 'assistant', content: acc });
      busy = false; sendBtn.disabled = false;
      msgs.scrollTop = msgs.scrollHeight;
    }
    function onErr(err) {
      if (finished) return;
      finished = true;
      if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
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

      '<div class="tip">📍 <b>页面上下文感知（v2.2 已上线）</b>：提问时助手会自动捕获你正在看的页面（标题、路由、小节结构、搜索筛选状态、视口可见内容与表格节选）一并发给 AI，所以可以直接问「这个表怎么读」「当前这个模型」。每条消息下方有 <b>📍 徽标</b>，点击可查看实际发送了哪些上下文。捕获预算由 <code class="ai-ic">AI_CONFIG.contextChars</code> 控制（默认 6000 字符）。</div>' +

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

      '<h4><span class="n">D</span>更新待办</h4>' +
      '<table><tr><th>事项</th><th>状态</th><th>说明</th></tr>' +
      '<tr>' +
      '<td>页面上下文感知</td>' +
      '<td>✅ 已上线（2026-09-02）</td>' +
      '<td>AI 助手 v2.2：提问时自动捕获当前页面（标题 / 路由深链 / 小节大纲 / 搜索筛选状态 / 视口可见内容 / 表格节选）作为回答上下文，消息下方 📍 徽标可展开审计。预算 <code class="ai-ic">contextChars</code> 可调。</td>' +
      '</tr>' +
      '<tr>' +
      '<td>飞书推送接入</td>' +
      '<td>⏳ 待配置</td>' +
      '<td>「Agent 前线」每日自动搜寻管线的可选通知 <code class="ai-ic">FEISHU_WEBHOOK</code> 尚未配置，不影响抓取与自动合入。配置后每天的运行摘要会推送到飞书群：群内添加自定义机器人取得 Webhook 地址，在仓库 Settings → Secrets and variables → Actions 新建 <code class="ai-ic">FEISHU_WEBHOOK</code> 填入该地址即可。</td>' +
      '</tr></table>' +

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
