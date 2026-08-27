(()=>{
  const ROOT='/llm-tracker/';
  const GUIDES={
    home:{title:'本页阅读路径',desc:'从前沿论文开始，按主题定位，再进入模型、历史与实践。',items:[['今日论文',ROOT,'从最新研究进入'],['按主题浏览',ROOT+'#topics','聚合同一研究方向'],['模型技术档案',ROOT+'models/','回到模型能力与架构'],['编年史',ROOT+'chronicle/','追溯原始工作'] ]},
    models:{title:'模型研究路径',desc:'先定位模型与厂商，再查看技术档案，最后落到算力与部署约束。',items:[['模型时间轴',ROOT+'models/','按发布时间浏览'],['技术档案',ROOT+'models/','查看架构、解码与训练'],['硬件志',ROOT+'hardware/?chapter=deep','理解显存与互联'],['部署实战',ROOT+'deploy/?section=frameworks','选择服务框架']]},
    timeline:{title:'论文追踪路径',desc:'先锁定时间尺度，再阅读当天论文，随后进入模型与技术背景。',items:[['按年浏览',ROOT+'timeline/','观察长期趋势'],['按月浏览',ROOT+'timeline/','定位阶段热点'],['模型时序',ROOT+'models/','查看模型发布脉络'],['编年史',ROOT+'chronicle/','阅读精编里程碑']]},
    chronicle:{title:'技术演进路径',desc:'沿八幕阅读关键论文，再回到术语、模型和工程实践理解影响。',items:[['Transformer 时代',ROOT+'chronicle/?era=e2','范式起点'],['缩放定律',ROOT+'chronicle/?era=e3','能力扩展规律'],['效率革命',ROOT+'chronicle/?era=e6','推理与系统基建'],['术语馆',ROOT+'glossary/','补齐概念'],['部署实战',ROOT+'deploy/?section=frameworks','落到工程选择']]},
    hardware:{title:'硬件决策路径',desc:'先统一术语，再理解显存与互联，最后使用计算器做容量估算。',items:[['硬件术语',ROOT+'hardware/?chapter=terms','建立共同语言'],['显卡分类',ROOT+'hardware/?chapter=classes','按场景选卡'],['硬件深挖',ROOT+'hardware/?chapter=deep','HBM 与 NVLink'],['显存计算器',ROOT+'hardware/?chapter=calc','完成容量估算'],['部署实战',ROOT+'deploy/?section=parallel','匹配并行方案']]},
    dgx:{title:'DGX Spark 实战路径',desc:'先理解规格和互联，再结合模型规模与部署约束判断是否适配。',items:[['硬件深挖',ROOT+'hardware/?chapter=deep','理解带宽账本'],['显存计算器',ROOT+'hardware/?chapter=calc','估算模型容量'],['部署实战',ROOT+'deploy/?section=parallel','选择多卡与多机方案'],['模型时序',ROOT+'models/','对照目标模型规模']]},
    deploy:{title:'部署决策路径',desc:'按框架、精度、Serving、并行和上线检查的顺序完成一次部署决策。',items:[['选择框架',ROOT+'deploy/?section=frameworks','确定服务底座'],['量化与格式',ROOT+'deploy/?section=quant','平衡显存与质量'],['Serving 参数',ROOT+'deploy/?section=serving','控制 TTFT 与吞吐'],['并行方案',ROOT+'deploy/?section=parallel','规划扩展路径'],['上线检查',ROOT+'deploy/?section=checklist','按清单压测上线']]},
    glossary:{title:'概念学习路径',desc:'术语按七个知识层连续组织，建议沿架构、训练、对齐、推理到系统效率阅读。',items:[['架构与注意力',ROOT+'glossary/#glossary-arch','模型如何计算'],['训练与扩展',ROOT+'glossary/#glossary-train','能力如何获得'],['后训练与对齐',ROOT+'glossary/#glossary-align','行为如何塑形'],['推理与解码',ROOT+'glossary/#glossary-infer','答案如何生成'],['系统与效率',ROOT+'glossary/#glossary-sys','服务如何运行']]},
    lab:{title:'实验路径',desc:'先把容量和吞吐算清楚，再用原理实验验证机制，最后到检索与 Agent 沙盒做工程演练。',items:[['KV Cache 实验室',ROOT+'lab/?tool=kv','算清显存与上下文上限'],['推理吞吐模拟器',ROOT+'lab/?tool=throughput','找并发与延迟的平衡点'],['采样策略实验室',ROOT+'lab/?tool=temp','看参数如何改变输出'],['RAG 检索实验台',ROOT+'lab/?tool=rag','调切块与 top-k'],['Agent 沙盒',ROOT+'lab/?tool=agent','推演 ReAct 循环']]}
  };
  const key=document.body&&document.body.dataset.contentGuide;
  const guide=GUIDES[key];
  if(!guide||document.querySelector('.content-guide'))return;
  const wrap=document.createElement('section');
  wrap.className='content-guide';
  wrap.setAttribute('aria-label',guide.title);
  wrap.innerHTML=`<style>
    .content-guide{max-width:1060px;margin:1rem auto .35rem;padding:.9rem 1.1rem;border:1px solid rgba(126,103,69,.24);border-radius:14px;background:rgba(255,252,244,.78);position:relative;z-index:2;box-shadow:0 5px 18px rgba(42,39,33,.05)}
    .content-guide-head{display:flex;align-items:baseline;gap:.6rem;flex-wrap:wrap}.content-guide h2{font-size:.88rem;margin:0;color:#6b5138;letter-spacing:.08em}.content-guide p{margin:0;color:#786e5c;font-size:.76rem;line-height:1.55}.content-guide-list{display:flex;gap:.45rem;flex-wrap:wrap;margin-top:.7rem}.content-guide a{display:flex;flex-direction:column;gap:.08rem;min-width:112px;flex:1;padding:.42rem .58rem;border-radius:9px;border:1px solid rgba(126,103,69,.22);text-decoration:none;background:rgba(255,255,255,.7);color:#4f493e;transition:transform .16s ease,background .16s ease}.content-guide a:hover,.content-guide a:focus-visible{background:#6b5138;color:#fff;transform:translateY(-1px)}.content-guide strong{font-size:.74rem}.content-guide small{font-size:.64rem;opacity:.78}@media(max-width:768px){.content-guide{margin:.6rem .7rem .2rem;padding:.7rem .75rem}.content-guide-list{display:grid;grid-template-columns:1fr 1fr}.content-guide a{min-width:0}.content-guide p{font-size:.7rem}}html.dark .content-guide{background:rgba(37,43,54,.86);border-color:#4b5362}.content-guide h2{color:#9c2f2f}html.dark .content-guide h2{color:#d98a8a}html.dark .content-guide p{color:#b8b09a}html.dark .content-guide a{background:#252b36;border-color:#465061;color:#d9d2bd}html.dark .content-guide a:hover,html.dark .content-guide a:focus-visible{background:#6b5138;color:#fff}
  </style><div class="content-guide-head"><h2>${guide.title}</h2><p>${guide.desc}</p></div><div class="content-guide-list">${guide.items.map(([label,url,note])=>`<a href="${url}"><strong>${label} ↗</strong><small>${note}</small></a>`).join('')}</div>`;
  const anchor=document.querySelector('.tabs')||document.querySelector('header');
  anchor.insertAdjacentElement('afterend',wrap);
})();
