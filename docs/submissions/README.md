# 投稿信息维护

`conferences.json` 是现有会议时间轴数据的可读源；`journals.json` 是新增期刊投稿指南。
`index.template.html`、`assets/submissions.css`、`assets/submissions.js` 构成投稿指南页面。

修改数据后在仓库根目录执行：

```sh
python3 tools/build_submissions.py
```

构建会生成 `research/submissions/index.html`，按站点现有 XOR + base64 格式生成根目录
`conferences.json`，添加首页、科研页和会议志导航，并合并期刊到全站搜索索引。
新增页面采用静态内容与渐进增强，关闭 JavaScript 也能阅读全部条目。
不要直接修改编码后的 `conferences.json` 或生成的投稿页面。

2026-10-10 增量更新核对了 CVPR、IJCAI、ICSE、AAAI、ICLR 及 KDD 第一轮官方节点。
旧会议条目保留原核验日期，更新日期不代表全部会议信息重新核实。
期刊 `checkedAt: null` 表示已收录官方入口，但投稿细则本次未完成读取核验。
CCF 等级以每条 `classificationSource` 为依据；其他高水平期刊只作方向参考，不宣称
与 CCF-A 等价。普通稿件滚动投稿，特刊需要另行核对 CFP。

截止状态在浏览器按当前时间更新。AoE 截止按 UTC-12 的当天 23:59:59 计算；
TACL 按每月 1 日 23:59 Honolulu（UTC-10）计算，并显示下一截止的北京时间。
