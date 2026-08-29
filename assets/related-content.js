/* Cross-page related-content cards for LLM Tracker. */
(function () {
  'use strict';

  var page = document.body && document.body.dataset.relatedPage;
  if (!page || document.getElementById('related-content')) return;

  var base = '/llm-tracker/';
  var pages = {
    home: { icon: '🤖', title: '论文追踪', href: '', note: '从每日论文、主题与公司动态开始' },
    models: { icon: '🧬', title: '模型时序', href: 'models/', note: '按公司与系列查看模型发布脉络' },
    timeline: { icon: '📅', title: '论文时间轴', href: 'timeline/', note: '按日期回看论文增量与研究热度' },
    chronicle: { icon: '📜', title: '大模型编年史', href: 'chronicle/', note: '沿关键论文回溯能力演进' },
    hardware: { icon: '🧮', title: '硬件志', href: 'hardware/', note: '理解算力、显存与系统约束' },
    'dgx-spark': { icon: '✨', title: 'DGX Spark 专题', href: 'dgx-spark/', note: '从桌面 AI 超算看本地推理边界' },
    deploy: { icon: '🚀', title: '部署实战', href: 'deploy/', note: '把模型、框架与硬件连成可运行链路' },
    glossary: { icon: '📖', title: '术语馆', href: 'glossary/', note: '快速补齐架构、训练与推理概念' },
    lab: { icon: '🧪', title: '实验室', href: 'lab/', note: '用交互工具理解核心原理与估算方法' },
    qiuzhao: { icon: '🎯', title: '秋招资料包', href: 'qiuzhao/', note: '将学习路径组织为面试准备行动' },
    handbook: { icon: '📖', title: 'LLM 秋招手册', href: 'qiuzhao/handbook/', note: '系统梳理高频问题、追问与简历钩子' },
    arch: { icon: '🏗️', title: '架构演进', href: 'qiuzhao/arch/', note: '从结构差异理解模型能力与工程权衡' },
    agents: { icon: '📡', title: 'Agent 前线', href: 'agents/', note: '工业界大模型 Agent 动态与协议基建' },
    leaderboard: { icon: '🏆', title: '模型排行榜', href: 'leaderboard/', note: '双榜口径看能力高低，雷达图横向对比' }
  };

  var related = {
    home: [
      ['leaderboard', '直接看当前模型的能力排名与对比'],
      ['models', '从论文热点回到模型发布谱系'],
      ['timeline', '按时间回看论文新增与趋势'],
      ['chronicle', '理解当下研究的历史位置']
    ],
    leaderboard: [
      ['models', '回到发布时序，看这些模型的论文谱系'],
      ['deploy', '选定模型后进入部署与推理框架选型'],
      ['hardware', '把参数规模与上下文换算成显存需求'],
      ['glossary', '补齐 MoE、上下文、量化等评测相关概念']
    ],
    models: [
      ['leaderboard', '从发布谱系转到能力高低与横向对比'],
      ['home', '回到最新论文，查看模型对应研究'],
      ['hardware', '从参数与规模进入算力和显存约束'],
      ['deploy', '继续查看推理框架和上线实践'],
      ['dgx-spark', '查看桌面级本地推理的真实边界']
    ],
    timeline: [
      ['home', '打开论文追踪，按主题或公司继续筛选'],
      ['models', '把研究热度映射到模型发布节奏'],
      ['chronicle', '从日历回到关键里程碑']
    ],
    chronicle: [
      ['home', '查看当前仍在延续的研究前沿'],
      ['timeline', '按时间维度补齐近期发展'],
      ['glossary', '遇到概念时快速查定义与上下文'],
      ['lab', '通过交互演示验证核心机制']
    ],
    hardware: [
      ['models', '结合模型规模判断资源需求'],
      ['dgx-spark', '查看桌面 AI 超算的完整案例'],
      ['deploy', '把硬件约束落到部署参数和架构'],
      ['lab', '用估算工具复核显存与吞吐']
    ],
    'dgx-spark': [
      ['hardware', '回到硬件志，补齐 GPU 与显存基础'],
      ['models', '选择适合本地运行的模型与规模'],
      ['deploy', '将设备能力转化为可执行部署方案']
    ],
    deploy: [
      ['models', '先确认模型规模、架构与技术特性'],
      ['hardware', '核对显存、带宽与多卡约束'],
      ['lab', '通过交互估算辅助参数决策'],
      ['dgx-spark', '参考桌面本地部署的设备边界']
    ],
    glossary: [
      ['chronicle', '看术语在关键论文中的真实演进'],
      ['lab', '用交互演示加深概念理解'],
      ['handbook', '转入面试语境，练习高频表达']
    ],
    lab: [
      ['glossary', '先查概念定义与关键术语'],
      ['hardware', '将估算结果映射到硬件选择'],
      ['arch', '继续查看模型结构与参数差异'],
      ['deploy', '把实验结论带回工程部署决策']
    ],
    qiuzhao: [
      ['handbook', '按章节系统学习高频面试题'],
      ['arch', '进入模型架构与 KV Cache 深度题'],
      ['lab', '用交互工具巩固算法与系统原理']
    ],
    handbook: [
      ['qiuzhao', '回到资料包，选择学习入口与面经'],
      ['arch', '对照架构演进补齐技术细节'],
      ['glossary', '快速回查回答中涉及的术语']
    ],
    arch: [
      ['qiuzhao', '回到秋招资料包，组织完整备战路径'],
      ['handbook', '将结构知识转化为面试回答'],
      ['lab', '继续用工具理解 KV Cache 与注意力机制']
    ],
    agents: [
      ['lab', '在实验室用交互工具理解 Agent 工作机制'],
      ['models', '把工业动态映射到模型能力演进'],
      ['glossary', '查清 Agent 与协议相关术语']
    ]
  };

  var themes = {
    home: ['#f7f5ff', '#302b63', '#e2dcf7'],
    models: ['#f7f5ff', '#302b63', '#e2dcf7'],
    timeline: ['#f7f5ff', '#302b63', '#e2dcf7'],
    chronicle: ['#f8f2e4', '#6b5138', '#e0d2b4'],
    hardware: ['#173a5a', '#d8e8f5', '#4a7396'],
    'dgx-spark': ['#f8f2e4', '#6b5138', '#e0d2b4'],
    deploy: ['#f2eedd', '#55522f', '#c9c19f'],
    glossary: ['#faf6ea', '#37414f', '#d9cfae'],
    lab: ['#263a30', '#ece9dc', '#577060'],
    qiuzhao: ['#182542', '#e8f4ff', '#38567c'],
    handbook: ['#ffffff', '#2c4271', '#e7e4dc'],
    arch: ['#ffffff', '#2c4271', '#e7e4dc'],
    agents: ['#f5f0e1', '#26221c', '#d6cfb8'],
    leaderboard: ['#f7f8fb', '#302b63', '#e2e4ee']
  };

  var theme = themes[page] || themes.home;
  var cards = (related[page] || []).map(function (item) {
    var target = pages[item[0]];
    if (!target) return '';
    return '<a class="rc-card" href="' + base + target.href + '">' +
      '<span class="rc-icon" aria-hidden="true">' + target.icon + '</span>' +
      '<span class="rc-copy"><strong>' + target.title + '</strong><span>' + item[1] + '</span></span>' +
      '<span class="rc-arrow" aria-hidden="true">→</span></a>';
  }).join('');
  if (!cards) return;

  var style = document.createElement('style');
  style.textContent =
    '#related-content{--rc-bg:' + theme[0] + ';--rc-ink:' + theme[1] + ';--rc-line:' + theme[2] + ';position:relative;z-index:2;max-width:1180px;margin:1.25rem auto 1.8rem;padding:0 1.2rem;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:var(--rc-ink)}' +
    '#related-content .rc-wrap{background:var(--rc-bg);border:1px solid var(--rc-line);border-radius:14px;padding:1rem 1.05rem;box-shadow:0 5px 16px rgba(0,0,0,.08)}' +
    '#related-content .rc-head{display:flex;align-items:baseline;gap:.55rem;margin-bottom:.7rem}' +
    '#related-content .rc-head b{font-size:.92rem;letter-spacing:.04em}' +
    '#related-content .rc-head span{font-size:.72rem;opacity:.68}' +
    '#related-content .rc-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:.55rem}' +
    '#related-content .rc-card{display:flex;align-items:center;gap:.62rem;min-height:64px;padding:.68rem .72rem;border:1px solid var(--rc-line);border-radius:10px;color:inherit;text-decoration:none;background:color-mix(in srgb,var(--rc-bg) 88%,white);transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease}' +
    '#related-content .rc-card:hover{transform:translateY(-2px);border-color:var(--rc-ink);box-shadow:0 7px 16px rgba(0,0,0,.12)}' +
    '#related-content .rc-icon{font-size:1.15rem;line-height:1;flex:none}' +
    '#related-content .rc-copy{min-width:0;display:flex;flex:1;flex-direction:column;gap:.18rem}' +
    '#related-content .rc-copy strong{font-size:.8rem;line-height:1.3}' +
    '#related-content .rc-copy span{font-size:.68rem;line-height:1.45;opacity:.74}' +
    '#related-content .rc-arrow{font-size:1rem;font-weight:700;opacity:.65}' +
    '@media(max-width:768px){#related-content{margin:1rem auto 1.35rem;padding:0 .7rem}#related-content .rc-wrap{padding:.8rem}#related-content .rc-grid{grid-template-columns:1fr;gap:.45rem}#related-content .rc-card{min-height:58px;padding:.58rem .65rem}#related-content .rc-copy strong{font-size:.78rem}#related-content .rc-copy span{font-size:.66rem}}';
  document.head.appendChild(style);

  var section = document.createElement('section');
  section.id = 'related-content';
  section.setAttribute('aria-label', '关联内容');
  section.innerHTML = '<div class="rc-wrap"><div class="rc-head"><b>关联探索</b><span>沿内容关系继续阅读</span></div><div class="rc-grid">' + cards + '</div></div>';

  var footer = document.querySelector('footer');
  if (footer && footer.parentNode) footer.parentNode.insertBefore(section, footer);
  else document.body.appendChild(section);
}());
