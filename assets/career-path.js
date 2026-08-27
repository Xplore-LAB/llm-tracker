(()=>{
  const page=document.body&&document.body.dataset.careerPage;
  const items=[
    ['资料包','/llm-tracker/qiuzhao/','定位与总览'],
    ['学习手册','/llm-tracker/qiuzhao/handbook/','核心知识与刷题'],
    ['架构专项','/llm-tracker/qiuzhao/arch/#evo','原理进阶与算题'],
    ['面试经验','/llm-tracker/qiuzhao/jingyan/','公司真题与复盘']
  ];
  if(!page||document.querySelector('.career-path'))return;
  const el=document.createElement('nav');
  el.className='career-path';
  el.setAttribute('aria-label','秋招资料路径');
  el.innerHTML=`<style>
    .career-path{display:flex;align-items:stretch;gap:.4rem;flex-wrap:wrap;max-width:960px;margin:1rem auto;padding:.55rem .65rem;border:1px solid rgba(143,211,254,.25);border-radius:12px;background:rgba(14,35,67,.72);box-shadow:0 6px 18px rgba(0,0,0,.16)}.career-path a{display:flex;flex-direction:column;gap:.08rem;min-width:112px;flex:1;padding:.42rem .62rem;border:1px solid rgba(143,211,254,.16);border-radius:8px;text-decoration:none;color:#dcecff;background:rgba(255,255,255,.035);transition:background .18s ease,transform .18s ease}.career-path a:hover,.career-path a:focus-visible,.career-path a.on{background:rgba(72,139,199,.38);transform:translateY(-1px);border-color:rgba(143,211,254,.48)}.career-path strong{font-size:.76rem}.career-path small{font-size:.63rem;color:#9fb3c8}@media(max-width:768px){.career-path{margin:.6rem .75rem;padding:.45rem;display:grid;grid-template-columns:1fr 1fr}.career-path a{min-width:0}.career-path strong{font-size:.7rem}}
  </style>${items.map(([label,url,note])=>`<a href="${url}" class="${page===label?'on':''}"><strong>${label}</strong><small>${note}</small></a>`).join('')}`;
  const target=document.querySelector('.wrap')||document.querySelector('header')||document.body.firstElementChild;
  target.insertAdjacentElement(target.classList&&target.classList.contains('wrap')?'beforebegin':'afterend',el);
})();
