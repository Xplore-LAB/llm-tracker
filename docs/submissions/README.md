# 科研会议与期刊数据维护

`conferences.json` 为现有科研会议时间轴的可读数据源，包含会议系列、节点、待公布条目、期刊投稿信息及分级口径。

修改后执行 `python3 tools/build_research_data.py`，生成根目录编码数据，并更新 `research/index.html` 内的期刊补充。期刊通过科研页面中与“会议时间轴”并列的“期刊投稿”按钮展示（`?view=journal`），不新增独立页面。

2026-10-10 核对 CVPR、IJCAI、ICSE、AAAI、ICLR 与 KDD 第一轮节点；其余保留原核验日期。期刊 `checkedAt: null` 表示官方入口已收录、细则待复核。CCF 分级和领域高水平定位分开表达。
