---
name: google-trends
description: Fetch Google Trends data — search interest over time, related queries, geographic distribution, seasonal patterns for product research.
requires:
  env:
    - GOOGLE_TRENDS_KEY
  bins:
    - curl
    - jq
---

# Google Trends Research Skill

When the user asks about search trends, market growth, seasonal patterns, or geographic interest, use this skill.

## Mode 1: Keyword Trend Analysis

Fetch interest over time for a keyword:

```bash
cat > /tmp/gtrends_request.json << 'REQEOF'
{
  "keyword": "$KEYWORD",
  "geo": "US",
  "time_range": "past_12_months",
  "include_related_queries": true,
  "include_interest_by_region": true
}
REQEOF

bash -c 'curl -s -X POST "${GOOGLE_TRENDS_API_BASE_URL:-https://api.example.com/trends/explore}" \
  --header "Content-Type: application/json" \
  --header "Authorization: Bearer ${GOOGLE_TRENDS_KEY}" \
  -d @/tmp/gtrends_request.json' | jq '{
  trend_direction: .trend_direction,
  growth_rate_12m: .growth_rate_12m,
  peak_months: .peak_months,
  related_queries_rising: .related_queries.rising,
  related_queries_top: .related_queries.top,
  top_regions: .interest_by_region[:5],
  seasonality: .seasonality
}'
```

## Mode 2: Multi-Keyword Comparison

Compare trends across multiple keywords to find the best niche:

```bash
cat > /tmp/gtrends_compare.json << 'REQEOF'
{
  "keywords": ["$KEYWORD_1", "$KEYWORD_2", "$KEYWORD_3"],
  "geo": "US",
  "time_range": "past_12_months"
}
REQEOF

bash -c 'curl -s -X POST "${GOOGLE_TRENDS_API_BASE_URL:-https://api.example.com/trends/compare}" \
  --header "Content-Type: application/json" \
  --header "Authorization: Bearer ${GOOGLE_TRENDS_KEY}" \
  -d @/tmp/gtrends_compare.json' | jq '{
  comparison: [.results[] | {
    keyword: .keyword,
    avg_interest: .avg_interest,
    trend_direction: .trend_direction,
    growth_rate: .growth_rate_12m
  }]
}'
```

## Mode 3: Tavily Fallback (No Google Trends API)

If no Google Trends API is configured, use Tavily to search for trend information:

```bash
cat > /tmp/tavily_trends.json << 'REQEOF'
{
  "query": "$KEYWORD trend 2025 2026 market growth Google Trends",
  "search_depth": "advanced",
  "max_results": 8,
  "include_answer": true
}
REQEOF

bash -c 'curl -s -X POST "https://api.tavily.com/search" \
  --header "Content-Type: application/json" \
  --header "Authorization: Bearer ${TAVILY_API_KEY}" \
  -d @/tmp/tavily_trends.json' | jq '.answer, .results[] | {title, url, content}'
```

## Output Interpretation Guide

When presenting Google Trends data, always extract:

1. **Trend Direction**: Rising / Stable / Declining — based on 12-month trajectory
2. **Growth Rate**: Percentage change over 12 months; >20% = strong growth signal
3. **Seasonality**: Peak months and off-peak months — affects inventory planning
4. **Geographic Hotspots**: Top 5 states/regions by interest — informs ad targeting
5. **Related Queries**: Rising related queries reveal emerging sub-niches
6. **Signal Strength**:
   - Strong positive: Rising trend + >20% growth + seasonal peak approaching
   - Moderate positive: Stable trend + 5-20% growth
   - Negative: Declining trend + negative growth

## Cross-Validation Signals

Google Trends data contributes these signals to cross-analysis:
- **Market demand signal**: Search interest direction and volume
- **Growth signal**: Year-over-year growth rate
- **Seasonal signal**: Peak and trough timing
- **Geographic signal**: Where demand is concentrated
