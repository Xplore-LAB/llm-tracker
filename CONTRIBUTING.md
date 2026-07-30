# Contributing / 参与贡献

感谢你对 LLM Tracker 的关注!以下是几种参与方式。
Thanks for your interest in LLM Tracker! Here's how you can contribute.

## 报告数据错误 / Report a Data Error

如果网站上某篇论文的信息有误(分类错误、公司归属错误、日期错误等),请[提交 Issue](../../issues/new?template=data-error.md),注明论文标题、arXiv ID 和错误描述。

If you spot incorrect data on the site (wrong tag, wrong company attribution, wrong date, etc.), please [open an issue](../../issues/new?template=data-error.md) with the paper title, arXiv ID, and a description of the error.

## 推荐论文 / Suggest a Paper

想推荐一篇值得收录的论文?请[提交推荐 Issue](../../issues/new?template=paper-suggestion.md),附上 arXiv 链接、推荐理由和建议标签。

Want to suggest a paper worth tracking? [Open a suggestion issue](../../issues/new?template=paper-suggestion.md) with the arXiv link, your reason, and suggested tags.

## 本地运行脚本 / Run the Scripts Locally

需要 Python 3.10+:
Requires Python 3.10+:

```bash
pip install pymupdf
python scripts/fetch_papers.py
```

脚本会在仓库根目录更新 `papers.json`、`company-papers.json`、`timeline-data.json` 等站点数据文件。

The script updates the site data files (`papers.json`, `company-papers.json`, `timeline-data.json`, etc.) in the repository root.

可选:设置环境变量 `LLM_API_KEY`(兼容 OpenAI 格式的 API,可用 `LLM_BASE_URL` / `LLM_MODEL` 覆盖),脚本会为当日新增论文生成中文一句话笔记;不设置则自动跳过。

Optional: set the `LLM_API_KEY` environment variable (any OpenAI-compatible API; override with `LLM_BASE_URL` / `LLM_MODEL`) to generate one-line Chinese notes for newly added papers. Without it, note generation is skipped silently.
