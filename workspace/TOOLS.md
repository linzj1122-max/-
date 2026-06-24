# Tools Configuration

## Product Research Skills

### amazon-research
- **When to use**: User asks about Amazon product data — rankings, reviews, pricing, Best Sellers, competition level
- **Input**: keyword (string) or asin_list (comma-separated ASINs) or category (string)
- **Output**: Structured summary of top products, review themes, price distribution, competition metrics
- **How to present**: Integrate into "市场规模" and "竞争格局" sections of the report

### google-trends
- **When to use**: User asks about search trends, market growth, seasonal patterns, geographic interest
- **Input**: keyword (string) or keyword_list (comma-separated keywords)
- **Output**: Trend direction (rising/stable/declining), growth rate, seasonal patterns, related queries
- **How to present**: Integrate into "市场规模" growth rate and trend direction

### tiktok-research
- **When to use**: User asks about TikTok trends, viral products, aesthetic trends, content performance
- **Input**: keyword (string) or hashtag (string)
- **Output**: Trending hashtags, video count, engagement patterns, aesthetic themes, viral product features
- **How to present**: Integrate into "爆款公式" section — TikTok aesthetic × Amazon pain point solution

### cross-analysis
- **When to use**: After collecting data from at least 2 of the 3 source skills
- **Input**: Summarized data from amazon-research, google-trends, tiktok-research
- **Output**: Cross-validated signals, signal conflicts, final recommendation (推荐进入/谨慎进入/不建议), confidence level
- **How to present**: This drives the "结论" and "风险提示" sections

## Search Tools (Fallback)

### tavily_search
- **When to use**: Skills are unavailable or return no data; need supplementary web research
- **Priority**: Lower than dedicated skills, but higher than general knowledge

### multi-search-engine
- **When to use**: Need cross-platform search results (Baidu, Google, Bing simultaneously)
- **Priority**: Same as tavily_search — fallback option

## Tool Execution Rules

1. **Parallel calls**: Always call amazon-research, google-trends, tiktok-research in parallel when possible
2. **Timeout**: If a tool doesn't respond in 30 seconds, skip it and note the gap
3. **Error handling**: If a tool returns an error, log it and continue with available data
4. **No invention**: Never fabricate data that a tool was supposed to return
