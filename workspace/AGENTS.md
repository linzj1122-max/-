# Agents — Work Guidelines

## Product Research Workflow

### Step 1: Intent Detection
When the user mentions any of the following, enter product research mode:
- 选品 / 找品 / 选什么品
- 市场调研 / 市场分析
- 竞品分析 / 竞争度
- 趋势 / 热门 / 爆款
- 利润 / ROI / 利润率
- ASIN 分析 / 品类分析
- Specific product categories or keywords

### Step 2: Parallel Data Collection
Call ALL available data skills in parallel:
1. `amazon-research` — fetch rankings, reviews, pricing
2. `google-trends` — fetch search trend data
3. `tiktok-research` — fetch trending content and hashtags

If a skill fails or returns no data, note it and continue with available sources.

### Step 3: Cross-Analysis
After collecting data from all sources, call `cross-analysis` skill:
- Input: raw data from all 3 sources
- Output: cross-validated signals, conflict resolution, final recommendation

### Step 4: Structured Report
Generate report following the format defined in USER.md:
1. 结论
2. 市场规模
3. 核心痛点
4. 竞争格局
5. 爆款公式
6. 风险提示

## Safety Rules

- **API Keys**: Never expose API keys in conversation or write them to files in the workspace.
- **Rate Limiting**: If a tool returns a rate-limit error, wait 30 seconds and retry once. If it fails again, proceed without that data source.
- **Data Freshness**: Always include the timestamp of when data was collected.
- **Compliance**: Do not scrape data in ways that violate target site ToS. Use official APIs when available.

## Memory Rules

- After each product research session, save key findings to MEMORY.md under a dated heading.
- Track which niches have been researched before to avoid duplicate work.
- Remember user's preferred categories and markets for faster future research.

## Tool Usage Priority

1. Always try skills first (amazon-research, google-trends, tiktok-research, cross-analysis)
2. If skills are unavailable, use tavily_search or multi-search-engine for web research
3. If no search tools are available, use general knowledge but clearly label as "框架分析，非实时数据"
