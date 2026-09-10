<div align="center">

<img src="assets/icon.svg" alt="LLM Papers Tracker" width="120" />

### 5 minutes a day to keep up with the LLM world

A self-updating intelligence hub for paper chasers: daily arXiv tracking of LLM research, dedicated columns for 34 AI companies, a model-release timeline, and a curated learning path. Zero backend, zero cost.

[![Live Demo](https://img.shields.io/badge/Live-Demo-55e5d5?style=flat)](https://xplore-lab.github.io/llm-tracker/)
[![Fork & Deploy](https://img.shields.io/badge/Fork-Deploy%20Your%20Own-50a6ff?style=flat)](https://github.com/Xplore-LAB/llm-tracker/fork)
[![Feedback](https://img.shields.io/badge/Feedback-Data%20Errors%20%26%20Ideas-9f86ff?style=flat)](https://github.com/Xplore-LAB/llm-tracker/issues)

[![GitHub stars](https://img.shields.io/github/stars/Xplore-LAB/llm-tracker?style=flat&label=stars&color=gold)](https://github.com/Xplore-LAB/llm-tracker/stargazers)
[![license](https://img.shields.io/badge/license-see%20LICENSE-1683c4?style=flat)](LICENSE)
[![papers](https://img.shields.io/badge/papers-13%2C000%2B-32b643?style=flat)](https://xplore-lab.github.io/llm-tracker/)
[![stack](https://img.shields.io/badge/stack-GitHub%20Actions%20%2B%20Python-7e35d5?style=flat)](.github/workflows/)

[简体中文](README.md) · **English**

</div>

---

## ⚡ The 60-second tour

Hundreds of AI papers hit arXiv daily, and nobody can read them all. This site reads them for you: auto-fetching, auto-tagging, auto-generated Chinese notes, plus a verified watch of official papers from 34 AI labs such as OpenAI, DeepSeek, and Qwen. Pure static pages driven by GitHub Actions, zero backend, zero cost.

| What you want | What you get |
| --- | --- |
| Follow daily LLM papers | 13,000+ papers on the homepage with bilingual search, refreshed daily at 01:00 UTC, optional Chinese one-line notes |
| Track AI lab activity | 34 company columns, every paper verified against author affiliations, brand-colored sidebar timeline linking straight to arXiv |
| See the model-release landscape | 248 model families on one timeline, filterable by company, region, and openness, with architecture figures and repo links on hover |

Quick links: [🌐 Live site](https://xplore-lab.github.io/llm-tracker/) · [📅 Timeline](https://xplore-lab.github.io/llm-tracker/timeline/) · [🧬 Model timeline](https://xplore-lab.github.io/llm-tracker/models/)

## ✨ Core features

- **📰 Paper tracking**: 13,000+ LLM papers and growing; bilingual search by title, author, or keyword; topic and year filters; sort by date, citations, or title; papers with 1000+ citations highlighted in green; localStorage-based favorites, no login needed
- **🏢 Company watch**: 34 AI labs including OpenAI, Google, Meta, Anthropic, xAI, Mistral, DeepSeek, Qwen, Moonshot, Zhipu, MiniMax, ByteDance, Tencent, Huawei, and Nvidia; each company paper verified by author-affiliation keywords to avoid title-collision false positives; draggable, brand-colored sidebar timeline
- **🇨🇳 Chinese notes**: daily LLM-generated Chinese titles and one-line summaries, so you can judge a paper in 30 seconds; optional, the site works fine without an API key
- **🏷️ Eight auto-classified topics**: `RAG` `Agent` `MCP` `Reasoning` `Multimodal` `Fine-tuning` `Safety` `LLM`, with a topic overview page
- **📅 Paper heatmap**: GitHub-contributions-style yearly heatmap with year, month, and week views; click a cell to read that day's papers; stat cards for total, this year, this month, and today
- **🧬 Model-release timeline**: 248 model families, filterable by company, region (China, US, others), and openness (open weights, mixed, closed), with a zoomable time range
- **📚 Learning path**: a staged reading list from *Attention Is All You Need* to RLHF, with Chinese reading notes and key-concept chips
- **📄 PDF archive**: key company papers archived to a dedicated `pdfs` orphan branch, one click to the original PDF in-site

## 🚀 Quick start

### Option 1: just use it

Open [xplore-lab.github.io/llm-tracker](https://xplore-lab.github.io/llm-tracker/). Mobile friendly.

### Option 2: fork and deploy your own tracker (2 minutes)

1. **Fork** this repo
2. **Enable Pages**: `Settings → Pages → Source` → `Deploy from a branch` → `master` / `(root)`. Your site goes live at `https://<your-username>.github.io/llm-tracker/` in about a minute
3. *(Optional)* **Chinese notes**: under `Settings → Secrets and variables → Actions`, add secret `LLM_API_KEY` (any OpenAI-compatible API key); to switch providers, add variables `LLM_BASE_URL` (default `https://api.moonshot.cn/v1`) and `LLM_MODEL` (default `moonshot-v1-8k`)
4. *(Optional)* **Daily Feishu push**: add secret `FEISHU_WEBHOOK` (a Feishu group-bot webhook URL)
5. Done. GitHub Actions refreshes daily at 01:00 UTC; you can also trigger it manually from the Actions page or the "⚡ 更新数据" button on the site

### Option 3: run the data pipeline locally

```bash
git clone https://github.com/Xplore-LAB/llm-tracker.git
cd llm-tracker
pip install pymupdf
python scripts/fetch_papers.py   # full fetch, about 20 minutes including arXiv rate-limit waits
```

Preview the site with any static server, e.g. `python -m http.server 8000`, then visit `http://localhost:8000`.

## 🔧 How it works

A scheduled GitHub Action runs `scripts/fetch_papers.py` daily at 01:00 UTC. It queries the arXiv API per topic and per company, verifies company papers by author-affiliation keywords, auto-tags, optionally generates Chinese notes via any OpenAI-compatible LLM API, merges and deduplicates, then commits the updated JSON (8 data files including `papers.json`) back to the repo. GitHub Pages publishes the static site, and company-paper PDFs are archived to the orphan `pdfs` branch.

- **Zero backend**: the site is pure HTML/JS, the data is JSON in the repo, GitHub Pages hosts it directly. No server, no database
- **Data as code**: every update is a git commit, with version history and rollback for free
- **Double protection against mislabeling**: company papers pass author-affiliation keyword verification, and if a day's arXiv query returns too few results, the pipeline falls back to offline title classification
- **Isolated PDF archive**: PDFs live in a separate orphan branch, keeping the main branch lean and fast to clone
- **Auto-extracted architecture figures**: PyMuPDF pulls model architecture diagrams from technical-report PDFs, visible on hover in the model timeline

## 📊 By the numbers

| Metric | Scale |
| --- | --- |
| Papers tracked | 13,000+ (growing daily) |
| Companies watched | 34 (major AI labs across China, the US, and Europe) |
| Model families | 248 |
| Topic categories | 8 |
| Update cadence | Fully automated, daily at 01:00 UTC |
| Running cost | $0 (GitHub Pages + Actions free tier) |

Data schema: the main dataset lives in `papers.json` (reverse-chronological, fields include `id`, `title`, `title_zh`, `authors`, `abstract`, `date`, `cite`, `tags`, `note`, `company`); `company-papers.json` is its subset (latest 1200 entries). The data is clone-and-use, no API key required.

## 🗂 Repository layout

```
├── index.html            # 📰 Paper-tracking homepage (pure static, no build)
├── timeline/             # 📅 Paper heatmap page
├── models/               # 🧬 Model-release timeline page
├── papers.json           # Main paper data (cumulative, with Chinese notes)
├── company-papers.json   # Paper index of the 34 companies (affiliation-verified)
├── timeline-data.json    # Heatmap data
├── models.json           # Model-release data (248 families)
├── learning-path.json    # Learning path (staged classic papers)
├── pdfs-index.json       # Archived PDF index
├── scripts/              # 🐍 Python pipeline: fetch, verify, tag, archive PDFs, extract figures
├── docs/                 # README screenshots and social preview
└── .github/workflows/    # Daily auto-update + PDF archive branch publishing
```

## 🛡️ Boundaries and notes

- Paper metadata (titles, authors, abstracts, citation counts) comes from public sources such as [arXiv](https://arxiv.org/); rights belong to their owners, please respect arXiv's terms of use
- Chinese notes are LLM-generated and for reference only
- The site UI is currently Chinese; an English UI toggle is on the roadmap
- Licensing of original content in this repo follows [LICENSE](LICENSE); please note it differs from common open-source licenses

## 📚 Documentation

- [CONTRIBUTING.md](CONTRIBUTING.md): contribution guide, with issue templates for data-error reports and paper suggestions
- [docs/](docs/): README screenshots and social preview image
- [storage_table.md](storage_table.md): storage notes

## 🗺 Roadmap

- [ ] English UI toggle (the site is currently Chinese-only)
- [ ] RSS / email subscription for daily new papers
- [ ] Weekly charts and monthly reports (citation trends, company roundups)
- [ ] Citation growth curves
- [ ] More companies and conferences (NeurIPS / ICML / ACL acceptance lists)
- [ ] Dark mode

Votes and claims welcome via issues.

## 📈 Star History

[![Star History Chart](https://api.star-history.com/svg?repos=Xplore-LAB/llm-tracker&type=Date)](https://star-history.com/#Xplore-LAB/llm-tracker&Date)

## 📄 License

- Original content in this repository (including but not limited to the LLM chronicle, model technical profiles, hardware notes, DGX Spark features, page visual design, and code implementation) is all rights reserved: no copying, republishing, scraping, or use for training machine learning models without written permission. See [LICENSE](LICENSE)
- Exception: paper metadata comes from public sources such as [arXiv](https://arxiv.org/); rights belong to their respective owners and are not covered by the above
- Chinese notes are LLM-generated and for reference only
- Original project by [Xplore-LAB](https://github.com/Xplore-LAB) · [xplore-lab.github.io/llm-tracker](https://xplore-lab.github.io/llm-tracker/)

<div align="center">

**If this saves you time, a ⭐ means a lot, and share it with fellow paper chasers!**

</div>
