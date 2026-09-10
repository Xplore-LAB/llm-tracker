<div align="center">

<img src="assets/icon.svg" alt="大模型情报局" width="120" />

### 每天 5 分钟,跟上大模型世界的每一天

为论文追更者打造的自更新情报站:每日自动追踪 arXiv 大模型前沿论文,34 家 AI 公司专栏,模型发布时序,学习路径,零后端零成本

[![在线访问](https://img.shields.io/badge/在线访问-Live%20Demo-55e5d5?style=flat)](https://xplore-lab.github.io/llm-tracker/)
[![Fork 部署](https://img.shields.io/badge/Fork-部署自己的%20Tracker-50a6ff?style=flat)](https://github.com/Xplore-LAB/llm-tracker/fork)
[![反馈问题](https://img.shields.io/badge/反馈-数据错误与建议-9f86ff?style=flat)](https://github.com/Xplore-LAB/llm-tracker/issues)

[![GitHub stars](https://img.shields.io/github/stars/Xplore-LAB/llm-tracker?style=flat&label=stars&color=gold)](https://github.com/Xplore-LAB/llm-tracker/stargazers)
[![license](https://img.shields.io/badge/license-see%20LICENSE-1683c4?style=flat)](LICENSE)
[![papers](https://img.shields.io/badge/papers-13%2C000%2B-32b643?style=flat)](https://xplore-lab.github.io/llm-tracker/)
[![stack](https://img.shields.io/badge/stack-GitHub%20Actions%20%2B%20Python-7e35d5?style=flat)](.github/workflows/)

**简体中文** · [English](README.en.md)

</div>

---

## ⚡ 一分钟看懂大模型情报局

arXiv 每天新增上百篇 AI 论文,没人读得完。这个站点替你读:自动抓取、自动分类、自动生成中文笔记,还把 OpenAI、DeepSeek、Qwen 等 34 家公司的官方论文单独归档。纯静态站点加 GitHub Actions 驱动,零后端、零成本。

| 你想完成的事 | 交付成果 |
| --- | --- |
| 快速跟进每日 LLM 新论文 | 主页收录 13,000+ 篇论文,中英文搜索,每日 UTC 01:00 自动更新,可选中文一句话笔记 |
| 盯紧大厂技术动态 | 34 家 AI 公司专栏,论文经作者单位关键词校验,侧栏时间轴直达 arXiv |
| 看清模型发布全景 | 248 个模型系列时序图,按公司、地区、开放度筛选,悬停可见架构图与代码仓库 |

直达入口:[🌐 在线访问](https://xplore-lab.github.io/llm-tracker/) · [📅 时间轴](https://xplore-lab.github.io/llm-tracker/timeline/) · [🧬 模型时序](https://xplore-lab.github.io/llm-tracker/models/)

## ✨ 核心能力

- **📰 论文追踪**:13,000+ 篇 LLM 相关论文并持续增长;支持中英文搜索、主题筛选、年份筛选;按最新日期、引用量、标题三种排序,高引用论文(≥1000)绿色高亮;⭐ 收藏基于 localStorage,无需登录
- **🏢 公司专栏**:追踪 OpenAI、Google、Meta、Anthropic、xAI、Mistral、DeepSeek、Qwen、Moonshot、Zhipu、MiniMax、ByteDance、Tencent、Huawei、Nvidia 等 34 家公司;每篇公司论文经作者单位关键词校验,避免标题撞名误标;品牌色侧栏时间轴可拖拽滚动
- **🇨🇳 中文笔记**:每日新论文由 LLM 自动生成中文标题与一句话笔记,30 秒判断论文在做什么;可选功能,不配 API Key 也能正常运行
- **🏷️ 八大主题自动分类**:`RAG` `Agent` `MCP` `Reasoning` `Multimodal` `Fine-tuning` `Safety` `LLM`,主题页一屏总览各方向论文数量
- **📅 论文热力图**:GitHub 贡献图风格的年度热力图,年、月、周三级视图,点击格子查看当日全部论文;顶部统计卡展示总数、今年、本月、今日新增
- **🧬 模型发布时序**:248 个模型系列,按公司、地区(中国、美国、其他)、开放度(开放权重、混合、闭源)三维筛选,时间范围可缩放
- **📚 学习路径**:从 Attention Is All You Need 到 RLHF 的分阶段经典论文精读路线,每篇附中文导读笔记和关键概念速览
- **📄 PDF 直链**:公司重点论文 PDF 自动归档到独立 `pdfs` 分支,站内一键直达原文

## 🚀 快速开始

### 方式一:直接使用

打开 [xplore-lab.github.io/llm-tracker](https://xplore-lab.github.io/llm-tracker/) 即可,手机端同样适配。

### 方式二:Fork 部署你自己的 Tracker(2 分钟)

1. **Fork** 本仓库
2. **开启 Pages**:`Settings → Pages → Source` 选 `Deploy from a branch` → `master` / `(root)`,保存后约 1 分钟即可通过 `https://<你的用户名>.github.io/llm-tracker/` 访问
3. **(可选)启用中文笔记**:`Settings → Secrets and variables → Actions` 添加 Secret `LLM_API_KEY`(任意 OpenAI 兼容 API 的密钥);如需更换服务商,添加 Variables `LLM_BASE_URL`(默认 `https://api.moonshot.cn/v1`)、`LLM_MODEL`(默认 `moonshot-v1-8k`)
4. **(可选)飞书每日推送**:添加 Secret `FEISHU_WEBHOOK`(飞书群机器人 Webhook 地址)
5. 完成。GitHub Actions 每天 UTC 01:00 自动更新;也可在 Actions 页手动触发,或点站点上的「⚡ 更新数据」按钮

### 方式三:本地跑数据脚本

```bash
git clone https://github.com/Xplore-LAB/llm-tracker.git
cd llm-tracker
pip install pymupdf
python scripts/fetch_papers.py   # 完整抓取一轮(约 20 分钟,含 arXiv 限速等待)
```

本地预览站点:任意静态服务器即可,如 `python -m http.server 8000`,访问 `http://localhost:8000`。

## 🔧 工作原理

```
                    ┌─────────────────────────────────────────────┐
                    │           GitHub Actions (每日 01:00 UTC)     │
                    └──────────────────┬──────────────────────────┘
                                       │
        ┌──────────────────────────────┼──────────────────────────────┐
        ▼                              ▼                              ▼
  ① 按 8 大主题 query          ② 按 34 家公司 query            ③ LLM 生成中文笔记
     抓取 arXiv 新论文             抓取 + 作者单位校验             (可选,OpenAI 兼容 API)
        └──────────────────────────────┼──────────────────────────────┘
                                       ▼
                    ④ 自动打标 / 合并去重 / 生成时间轴与模型数据
                                       ▼
                    ⑤ commit 回仓库(papers.json 等 8 个数据文件)
                                       ▼
              ┌────────────────────────┴────────────────────────┐
              ▼                                                  ▼
     GitHub Pages 自动发布                              公司论文 PDF 归档
     (纯静态站点,无构建)                                 (pdfs 孤儿分支,站内直链)
```

- **零后端**:站点是纯 HTML/JS,数据就是仓库里的 JSON,GitHub Pages 直接托管,没有服务器、没有数据库
- **数据即代码**:每次更新都是一个 git commit,天然带版本历史和回滚能力
- **防误标双保险**:公司论文先经作者单位关键词校验;若当日 arXiv 查询结果过少,自动回退到离线标题分类兜底
- **PDF 归档隔离**:PDF 放在独立孤儿分支,主分支保持苗条,克隆飞快
- **架构图自动抽取**:用 PyMuPDF 从技术报告 PDF 中抽取模型架构图,模型页悬停可见

## 📊 数据一览

| 指标 | 规模 |
| --- | --- |
| 收录论文 | 13,000+ 篇(每日自动增长) |
| 追踪公司 | 34 家(中美欧主流 AI 实验室) |
| 模型系列 | 248 个 |
| 主题分类 | 8 个方向 |
| 更新频率 | 每日 UTC 01:00 全自动 |
| 运行成本 | 0 元(GitHub Pages + Actions 免费额度) |

数据 Schema 与字段说明:主数据在 `papers.json`(按日期倒序,含 `id`、`title`、`title_zh`、`authors`、`abstract`、`date`、`cite`、`tags`、`note`、`company` 等字段);`company-papers.json` 为其子集(保留最近 1200 篇)。数据可直接用于二次开发,clone 即用,无需 API Key。

## 🗂 仓库结构

```
├── index.html            # 📰 论文追踪主页(纯静态,无构建)
├── timeline/             # 📅 论文热力图页
├── models/               # 🧬 模型发布时序页
├── papers.json           # 论文主数据(累积,含中文笔记)
├── company-papers.json   # 34 家公司论文索引(经作者单位校验)
├── timeline-data.json    # 热力图数据
├── models.json           # 模型发布数据(248 个系列)
├── learning-path.json    # 学习路径(分阶段经典论文)
├── pdfs-index.json       # 已归档 PDF 索引
├── scripts/              # 🐍 数据管线(Python):抓取、校验、打标、PDF 归档、架构图抽取
├── docs/                 # README 截图与 social preview
└── .github/workflows/    # 每日自动更新 + PDF 归档分支发布
```

## 🛡️ 边界与注意

- 论文元数据(标题、作者、摘要、引用数等)来自 [arXiv](https://arxiv.org/) 等公开来源,权利归原权利人所有,请遵守 arXiv 使用条款
- 中文笔记由 LLM 生成,仅供参考
- 站点 UI 目前为中文界面,英文界面切换在 Roadmap 中
- 本仓库原创内容的授权范围见 [LICENSE](LICENSE),请留意其与常见开源协议的差异

## 📚 文档导航

- [CONTRIBUTING.md](CONTRIBUTING.md):贡献指南,含数据错误反馈与论文推荐的 Issue 模板入口
- [docs/](docs/):README 截图与社交预览图
- [storage_table.md](storage_table.md):存储说明文档

## 🗺 Roadmap

- [ ] 英文界面切换(站点目前为中文 UI)
- [ ] RSS / 邮件订阅每日新论文
- [ ] 周榜与月报(高引趋势、公司动态综述)
- [ ] 论文引用量增长曲线
- [ ] 追踪更多公司与会议(NeurIPS / ICML / ACL 接收列表)
- [ ] 深色模式

欢迎开 Issue 投票或认领。

## 📈 Star History

[![Star History Chart](https://api.star-history.com/svg?repos=Xplore-LAB/llm-tracker&type=Date)](https://star-history.com/#Xplore-LAB/llm-tracker&Date)

## 📄 许可证

- 本仓库原创内容(包括但不限于大模型编年史文案、模型技术档案、硬件志、DGX Spark 专题、页面视觉设计与代码实现)保留所有权利,未经书面许可不得复制、转载、抓取、再发布或用于训练机器学习模型,详见 [LICENSE](LICENSE)
- 例外:论文元数据来自 [arXiv](https://arxiv.org/) 等公开来源,其权利归原权利人所有,不受上述声明限制
- 中文笔记由 LLM 生成,仅供参考
- Original project by [Xplore-LAB](https://github.com/Xplore-LAB) · [xplore-lab.github.io/llm-tracker](https://xplore-lab.github.io/llm-tracker/)

<div align="center">

**如果这个项目对你有帮助,欢迎 ⭐ Star 支持,也欢迎分享给同样需要追论文的朋友!**

</div>
