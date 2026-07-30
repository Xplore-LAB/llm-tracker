<div align="center">

# 🤖 LLM Papers Tracker

**每日自动追踪 arXiv 大模型前沿论文 · 34 家 AI 公司专栏 · 模型发布时序 · 学习路径**

**A self-updating intelligence hub for LLM research — papers, company watch, model timeline & learning path**

[![Daily Update](https://github.com/Xplore-LAB/llm-tracker/actions/workflows/update-papers.yml/badge.svg)](https://github.com/Xplore-LAB/llm-tracker/actions/workflows/update-papers.yml)
[![GitHub Pages](https://github.com/Xplore-LAB/llm-tracker/actions/workflows/pages/pages-deployment/badge.svg)](https://xplore-lab.github.io/llm-tracker/)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Papers](https://img.shields.io/badge/papers-13%2C000%2B-302b63)](https://xplore-lab.github.io/llm-tracker/)
[![Companies](https://img.shields.io/badge/AI%20labs-34-d97706)](https://xplore-lab.github.io/llm-tracker/)
[![Stars](https://img.shields.io/github/stars/Xplore-LAB/llm-tracker?style=social)](https://github.com/Xplore-LAB/llm-tracker/stargazers)

### [🌐 Live Demo 在线访问](https://xplore-lab.github.io/llm-tracker/) · [📅 时间轴](https://xplore-lab.github.io/llm-tracker/timeline/) · [🧬 模型时序](https://xplore-lab.github.io/llm-tracker/models/)

[中文](#-中文) · [English](#-english)

![LLM Papers Tracker](docs/social-preview.png)

</div>

> **每天 5 分钟,跟上大模型世界的每一天。**
> arXiv 每天新增上百篇 AI 论文,没人读得完——这个站点替你读:自动抓取、自动分类、自动生成中文笔记,还把 OpenAI、DeepSeek、Qwen 等 34 家公司的官方论文单独归档。零后端、零成本,纯静态 + GitHub Actions 驱动。

---

## 🇨🇳 中文

### 🎯 为什么做这个

- **信息过载**:arXiv 上 LLM 相关论文日均数十篇,刷 Twitter / 微信群追进展既碎又累
- **英文门槛**:大量论文只有英文标题和摘要,快速判断「值不值得读」成本高
- **公司动态分散**:OpenAI、Google、DeepSeek 等大厂的技术报告散落在各处,没有统一的追踪入口
- **模型爆炸**:每家都在发模型,版本号眼花缭乱,缺一张「谁、什么时候、发了什么」的全景图

LLM Papers Tracker 就是为这四个痛点造的:**一个页面,看尽全局**。

### ✨ 功能亮点

#### 📰 论文追踪(主页)
- **13,000+ 篇** LLM 相关论文并持续增长,GitHub Actions 每日 UTC 01:00 自动抓取 arXiv
- 支持**中英文搜索**(标题/作者/关键词)、主题筛选、年份筛选
- 三种排序:最新日期 / 引用量 / 标题;高引用论文(≥1000)绿色高亮
- ⭐ 收藏功能,基于 localStorage,无需登录,换页不丢

#### 🏢 公司专栏(侧栏时间轴)
- 追踪 **34 家 AI 公司**:OpenAI、Google、Meta、Anthropic、xAI、Mistral、DeepSeek、Qwen、Moonshot、Zhipu、MiniMax、ByteDance、Tencent、Huawei、Nvidia……
- 每篇公司论文都经过**作者单位关键词校验**,不是标题撞名就收,最大限度避免误标
- 侧栏时间轴按公司品牌色着色,可拖拽滚动,点击直达 arXiv

#### 🇨🇳 中文笔记
- 每日新论文由 LLM 自动生成**中文标题 + 一句话笔记**,30 秒判断论文在做什么
- 可选功能:不配 API Key 也能正常运行,只是没有中文笔记

#### 🏷️ 八大主题自动分类
`RAG` · `Agent` · `MCP` · `Reasoning` · `Multimodal` · `Fine-tuning` · `Safety` · `LLM`
主题页一屏总览各方向论文数量,点击主题卡直达筛选结果。

#### 📅 论文热力图(时间轴页)
- GitHub 贡献图风格的**年度论文热力图**,哪几天论文爆发一目了然
- 年 / 月 / 周三级视图,点击格子查看当日全部论文
- 顶部统计卡:总论文数、今年收录、本月新增、今日新增

#### 🧬 模型发布时序(模型页)
- **248 个模型系列**的发布全景,数据来自 arXiv 追踪库与官方发布
- 按公司 / 地区(中国、美国、其他)/ 开放度(开放权重、混合、闭源)三维筛选
- 时间范围可缩放(近半年 / 近一年 / 近两年 / 全部)
- 悬停节点查看详情:**架构图、论文链接、代码仓库**

#### 📚 学习路径
从 Attention Is All You Need 到 RLHF,分阶段的经典论文精读路线,每篇附中文导读笔记和关键概念速览,适合入门和体系化补课。

#### 📄 PDF 直链
公司重点论文的 PDF 自动归档到独立 `pdfs` 分支,站内一键直达原文,不用再打开 arXiv 找下载按钮。

### 📸 截图

| 📰 论文追踪 | 📅 时间轴热力图 | 🧬 模型发布时序 |
|:---:|:---:|:---:|
| ![论文追踪](docs/screenshot-papers.png) | ![时间轴](docs/screenshot-timeline.png) | ![模型时序](docs/screenshot-models.png) |

### 📊 数据一览

| 指标 | 规模 |
|---|---|
| 收录论文 | 13,000+ 篇(每日自动增长) |
| 追踪公司 | 34 家(中美欧主流 AI 实验室) |
| 模型系列 | 248 个 |
| 主题分类 | 8 个方向 |
| 更新频率 | 每日 UTC 01:00 全自动 |
| 运行成本 | **0 元**(GitHub Pages + Actions 免费额度) |

### 🔧 工作原理

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

**工程上的几个巧思**:

- **零后端**:站点是纯 HTML/JS,数据就是仓库里的 JSON,GitHub Pages 直接托管,没有服务器、没有数据库
- **数据即代码**:每次更新都是一个 git commit,天然带版本历史和回滚能力
- **防误标双保险**:公司论文先经作者单位关键词校验;若当日 arXiv 查询结果过少,自动回退到离线标题分类兜底
- **PDF 归档隔离**:PDF 放在独立孤儿分支,主分支保持苗条,克隆飞快
- **架构图自动抽取**:用 PyMuPDF 从技术报告 PDF 中抽取模型架构图,模型页悬停可见

### 🚀 快速开始

#### 方式一:直接使用

打开 [xplore-lab.github.io/llm-tracker](https://xplore-lab.github.io/llm-tracker/) 即可,手机端同样适配。

#### 方式二:Fork 部署你自己的 Tracker(2 分钟)

1. **Fork** 本仓库
2. **开启 Pages**:`Settings → Pages → Source` 选 `Deploy from a branch` → `master` / `(root)`,保存后约 1 分钟即可通过 `https://<你的用户名>.github.io/llm-tracker/` 访问
3. **(可选)启用中文笔记**:`Settings → Secrets and variables → Actions`
   - 添加 Secret `LLM_API_KEY`(任意 OpenAI 兼容 API 的密钥)
   - 如需更换服务商,添加 Variables:`LLM_BASE_URL`(默认 `https://api.moonshot.cn/v1`)、`LLM_MODEL`(默认 `moonshot-v1-8k`)
4. **(可选)飞书每日推送**:添加 Secret `FEISHU_WEBHOOK`(飞书群机器人 Webhook 地址)
5. 完成 ✅ GitHub Actions 每天 UTC 01:00 自动更新;也可在 Actions 页手动触发,或点站点上的「⚡ 更新数据」按钮

#### 方式三:本地跑数据脚本

```bash
git clone https://github.com/Xplore-LAB/llm-tracker.git
cd llm-tracker
pip install pymupdf
python scripts/fetch_papers.py   # 完整抓取一轮(约 20 分钟,含 arXiv 限速等待)
```

本地预览站点:任意静态服务器即可,如 `python -m http.server 8000`,访问 `http://localhost:8000`。

### 🗂 仓库结构

```
├── index.html            # 📰 论文追踪主页(纯静态,无构建)
├── timeline/             # 📅 论文热力图页
├── models/               # 🧬 模型发布时序页
│   └── img/              #     模型架构图(PyMuPDF 自动抽取)
├── papers.json           # 论文主数据(累积,含中文笔记)
├── company-papers.json   # 34 家公司论文索引(经作者单位校验)
├── timeline-data.json    # 热力图数据
├── models.json           # 模型发布数据(248 个系列)
├── models-extra.json     # 模型补充信息
├── models-figures.json   # 模型 → 架构图映射
├── learning-path.json    # 学习路径(分阶段经典论文)
├── pdfs-index.json       # 已归档 PDF 索引
├── scripts/              # 🐍 数据管线(Python)
│   ├── fetch_papers.py       # 每日主任务:抓取、校验、打标、中文笔记
│   ├── download_pdfs.py      # 公司论文 PDF 归档(保留最新 N 篇)
│   ├── extract_models.py     # 模型发布信息抽取
│   ├── extract_figures.py    # 架构图抽取(PyMuPDF)
│   ├── fetch_by_ids.py       # 按 arXiv ID 定向补录
│   └── backfill_history.py   # 历史数据回填
├── docs/                 # README 截图与 social preview
└── .github/workflows/    # 每日自动更新 + PDF 归档分支发布
```

### 📄 数据 Schema

`papers.json`(主数据,按日期倒序):

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | arXiv ID,如 `2501.12345` |
| `title` / `title_zh` | string | 英文标题 / 中文标题 |
| `authors` | string | 作者(前几位 + et al.) |
| `abstract` | string | 英文摘要 |
| `date` / `year` | string / int | 发布日期 / 年份 |
| `cite` | int | 引用量 |
| `tags` | string[] | 主题标签:`RAG` `Agent` `MCP` `Reasoning` `Multimodal` `Fine-tuning` `Safety` `LLM` |
| `note` | string | 中文一句话笔记(LLM 生成) |
| `company` | string | 归属公司(仅公司论文有此字段) |

`company-papers.json` 为其子集(含 `company` 字段,按日期倒序,保留最近 1200 篇)。数据可直接用于二次开发,**clone 即用,无需 API Key**。

### 🗺 Roadmap

- [ ] 英文界面切换(站点目前为中文 UI)
- [ ] RSS / 邮件订阅每日新论文
- [ ] 周榜与月报(高引趋势、公司动态综述)
- [ ] 论文引用量增长曲线
- [ ] 追踪更多公司与会议(NeurIPS / ICML / ACL 接收列表)
- [ ] 深色模式

欢迎开 Issue 投票或认领!

### 🤝 参与贡献

- 🐞 发现论文归错公司、标签不对?→ [数据错误反馈](https://github.com/Xplore-LAB/llm-tracker/issues/new?template=data-error.md)
- 📄 想推荐收录某篇论文?→ [论文推荐](https://github.com/Xplore-LAB/llm-tracker/issues/new?template=paper-suggestion.md)
- 💡 功能建议、代码贡献 → 详见 [CONTRIBUTING.md](CONTRIBUTING.md)

### ❓ FAQ

**Q: 数据多久更新一次?**
每日 UTC 01:00(北京时间 09:00)自动更新。也可以点站点上的「⚡ 更新数据」按钮立即触发。

**Q: 我想追踪的公司不在列表里,怎么加?**
开 Issue 告诉我们;或直接改 `scripts/fetch_papers.py` 里的 `COMPANY_CONFIG`(一个 query + 作者单位关键词)提 PR。

**Q: 可以把数据拿去训练/做产品吗?**
代码 MIT;论文元数据来自 [arXiv](https://arxiv.org/),请遵守其使用条款;中文笔记由 LLM 生成,仅供参考。

---

## 🇬🇧 English

> **5 minutes a day to keep up with the LLM world.**
> Hundreds of AI papers hit arXiv daily — nobody can read them all. This site reads them for you: auto-fetching, auto-tagging, auto Chinese notes, plus a verified watch of 34 AI labs' official papers. Zero backend, zero cost — pure static pages driven by GitHub Actions.

### ✨ Features

- **📰 Paper tracking** — 13,000+ LLM papers and growing, refreshed daily at 01:00 UTC; bilingual search, topic & year filters, sort by date/citations/title, localStorage favorites
- **🏢 Company watch** — 34 AI labs (OpenAI, Google, Meta, Anthropic, xAI, Mistral, DeepSeek, Qwen, Moonshot…), each paper **verified against author affiliations** to avoid title-collision false positives; brand-colored draggable sidebar timeline
- **🇨🇳 Chinese notes** — daily LLM-generated Chinese titles & one-line summaries (optional; works fine without an API key)
- **🏷️ 8 auto-classified topics** — RAG / Agent / MCP / Reasoning / Multimodal / Fine-tuning / Safety / LLM
- **📅 Heatmap** — GitHub-style yearly paper heatmap with year/month/week views; click a cell to read that day's papers
- **🧬 Model timeline** — 248 model families, filterable by company / region / openness (open-weights vs closed), zoomable time range, hover for **architecture figures & repo links**
- **📚 Learning path** — staged reading list from *Attention Is All You Need* to RLHF, with Chinese reading notes and key-concept chips
- **📄 PDF archive** — key company papers archived to a dedicated orphan branch with direct in-site links

### 🔧 How it works

A scheduled GitHub Action runs `scripts/fetch_papers.py` daily: it queries the arXiv API per topic and per company, verifies company papers by author-affiliation keywords, auto-tags, generates optional Chinese notes via any OpenAI-compatible LLM API, commits the updated JSON back to the repo, publishes the static site via GitHub Pages, and archives company-paper PDFs to the orphan `pdfs` branch. No server, no database — **data lives as versioned JSON in git**.

### 🚀 Self-host in 2 minutes

1. **Fork** this repo
2. **Enable Pages**: `Settings → Pages → Deploy from a branch` → `master` / `(root)`
3. *(Optional)* Add secret `LLM_API_KEY` for Chinese notes; variables `LLM_BASE_URL` / `LLM_MODEL` to switch providers; secret `FEISHU_WEBHOOK` for daily Feishu push
4. Done — Actions refreshes daily at 01:00 UTC, or trigger manually anytime

Run the pipeline locally: `pip install pymupdf && python scripts/fetch_papers.py`. Preview the site with any static server, e.g. `python -m http.server`.

### 🤝 Contributing

Data errors, paper suggestions, new features — see [CONTRIBUTING.md](CONTRIBUTING.md) or open an [issue](https://github.com/Xplore-LAB/llm-tracker/issues). The data JSON is clone-and-use, no API key required; code is MIT, arXiv metadata under arXiv's terms.

---

## 📈 Star History

[![Star History Chart](https://api.star-history.com/svg?repos=Xplore-LAB/llm-tracker&type=Date)](https://star-history.com/#Xplore-LAB/llm-tracker&Date)

## 📜 License & Acknowledgements

- Code: [MIT License](LICENSE)
- Paper metadata: [arXiv](https://arxiv.org/) — please respect its terms of use
- Chinese notes are LLM-generated and for reference only

<div align="center">

**如果这个项目对你有帮助,欢迎 ⭐ Star 支持,也欢迎分享给同样需要追论文的朋友!**
**If this saves you time, a ⭐ means a lot — and share it with fellow paper-chasers!**

</div>
