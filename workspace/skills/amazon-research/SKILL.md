---
name: amazon-research
description: Fetch Amazon product data — Best Sellers rankings, review analysis, pricing, competition metrics. Supports keyword search and ASIN lookup.
requires:
  env:
    - AMAZON_API_KEY
  bins:
    - curl
    - jq
---

# Amazon Product Research Skill

When the user asks about Amazon product data, competition, reviews, or Best Sellers, use this skill.

## Mode 1: Keyword Search — Category / Niche Overview

Fetch top products for a keyword to assess market size and competition:

```bash
cat > /tmp/amazon_request.json << 'REQEOF'
{
  "keyword": "$KEYWORD",
  "marketplace": "US",
  "max_results": 20,
  "include_reviews": true,
  "review_sample_size": 100
}
REQEOF

bash -c 'curl -s -X POST "${AMAZON_API_BASE_URL:-https://api.example.com/amazon/search}" \
  --header "Content-Type: application/json" \
  --header "Authorization: Bearer ${AMAZON_API_KEY}" \
  -d @/tmp/amazon_request.json' | jq '{
  top_products: [.results[] | {
    asin: .asin,
    title: .title,
    price: .price,
    rating: .rating,
    review_count: .review_count,
    bsr: .bsr,
    monthly_sales_estimate: .monthly_sales_estimate
  }],
  price_distribution: .price_distribution,
  review_themes: .review_themes,
  competition_score: .competition_score
}'
```

## Mode 2: ASIN Lookup — Competitor Deep Dive

Fetch detailed data for specific ASINs:

```bash
cat > /tmp/amazon_asin_request.json << 'REQEOF'
{
  "asins": "$ASIN_LIST",
  "marketplace": "US",
  "include_reviews": true,
  "include_bsr_history": true,
  "review_sample_size": 200
}
REQEOF

bash -c 'curl -s -X POST "${AMAZON_API_BASE_URL:-https://api.example.com/amazon/products}" \
  --header "Content-Type: application/json" \
  --header "Authorization: Bearer ${AMAZON_API_KEY}" \
  -d @/tmp/amazon_asin_request.json' | jq '{
  products: [.results[] | {
    asin: .asin,
    title: .title,
    price: .price,
    rating: .rating,
    review_count: .review_count,
    bsr: .bsr,
    monthly_sales_estimate: .monthly_sales_estimate,
    negative_review_themes: .negative_review_themes,
    positive_review_themes: .positive_review_themes
  }]
}'
```

## Mode 3: Best Sellers Scraping (via Tavily fallback)

If no dedicated Amazon API is configured, use Tavily to search Amazon Best Sellers:

```bash
cat > /tmp/tavily_amazon.json << 'REQEOF'
{
  "query": "Amazon Best Sellers $KEYWORD 2025",
  "search_depth": "advanced",
  "max_results": 10,
  "include_answer": true,
  "include_domains": ["amazon.com"]
}
REQEOF

bash -c 'curl -s -X POST "https://api.tavily.com/search" \
  --header "Content-Type: application/json" \
  --header "Authorization: Bearer ${TAVILY_API_KEY}" \
  -d @/tmp/tavily_amazon.json' | jq '.answer, .results[] | {title, url, content}'
```

## Output Interpretation Guide

When presenting Amazon data, always extract and highlight:

1. **Market Size Signal**: Total review count × 15-20 = estimated total sales; BSR trend indicates momentum
2. **Pain Points**: Cluster negative reviews into themes with percentage (e.g., "漏水 28%", "容量不足 22%")
3. **Competition Level**:
   - Low: BSR > 50000, < 500 reviews on top products, price variance > 50%
   - Medium: BSR 10000-50000, 500-2000 reviews, moderate price clustering
   - High: BSR < 10000, > 2000 reviews on top products, price clustering around single point
4. **Opportunity Gap**: Pain points that appear in >15% of negative reviews AND are not solved by top products

## Error Handling

- If API returns 429 (rate limit): wait 30s, retry once
- If API returns 401: report "Amazon API key invalid or expired"
- If no API configured: fall back to Tavily search mode and label data as "搜索数据，非API直连"
