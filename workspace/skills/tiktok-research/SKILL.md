---
name: tiktok-research
description: Fetch TikTok data — trending hashtags, viral product videos, engagement metrics, aesthetic themes for product research.
requires:
  env:
    - TIKTOK_API_KEY
  bins:
    - curl
    - jq
---

# TikTok Research Skill

When the user asks about TikTok trends, viral products, aesthetic trends, or content performance, use this skill.

## Mode 1: Hashtag Trend Analysis

Fetch trending data for a product-related hashtag:

```bash
cat > /tmp/tiktok_hashtag.json << 'REQEOF'
{
  "hashtag": "$HASHTAG",
  "max_results": 20,
  "include_video_stats": true,
  "include_creator_stats": true
}
REQEOF

bash -c 'curl -s -X POST "${TIKTOK_API_BASE_URL:-https://api.example.com/tiktok/hashtag}" \
  --header "Content-Type: application/json" \
  --header "Authorization: Bearer ${TIKTOK_API_KEY}" \
  -d @/tmp/tiktok_hashtag.json' | jq '{
  hashtag: .hashtag,
  total_views: .total_views,
  video_count: .video_count,
  engagement_rate: .engagement_rate,
  top_videos: [.videos[:5][] | {
    description: .description,
    views: .views,
    likes: .likes,
    comments: .comments,
    shares: .shares,
    creator_followers: .creator.followers
  }],
  aesthetic_themes: .aesthetic_themes,
  product_mentions: .product_mentions
}'
```

## Mode 2: Keyword Search — Product Discovery

Search TikTok for product-related content:

```bash
cat > /tmp/tiktok_search.json << 'REQEOF'
{
  "keyword": "$KEYWORD",
  "max_results": 20,
  "sort_by": "relevance",
  "include_product_links": true
}
REQEOF

bash -c 'curl -s -X POST "${TIKTOK_API_BASE_URL:-https://api.example.com/tiktok/search}" \
  --header "Content-Type: application/json" \
  --header "Authorization: Bearer ${TIKTOK_API_KEY}" \
  -d @/tmp/tiktok_search.json' | jq '{
  total_results: .total_results,
  top_content: [.videos[:10][] | {
    description: .description,
    views: .views,
    likes: .likes,
    has_product_link: .has_product_link,
    product_name: .product_name
  }],
  trending_hashtags: .trending_hashtags,
  viral_features: .viral_features,
  aesthetic_categories: .aesthetic_categories
}'
```

## Mode 3: Tavily / Agent-Reach Fallback

If no TikTok API is configured, use Tavily to search TikTok content:

```bash
cat > /tmp/tavily_tiktok.json << 'REQEOF'
{
  "query": "TikTok $KEYWORD trending viral product 2025",
  "search_depth": "advanced",
  "max_results": 8,
  "include_answer": true,
  "include_domains": ["tiktok.com", "trendtok.com", "tokboard.com"]
}
REQEOF

bash -c 'curl -s -X POST "https://api.tavily.com/search" \
  --header "Content-Type: application/json" \
  --header "Authorization: Bearer ${TAVILY_API_KEY}" \
  -d @/tmp/tavily_tiktok.json' | jq '.answer, .results[] | {title, url, content}'
```

## Output Interpretation Guide

When presenting TikTok data, always extract:

1. **Trend Momentum**: Total views and growth rate for relevant hashtags
2. **Aesthetic Themes**: What visual style is trending (minimalist / cottagecore / Y2K / tech-aesthetic etc.)
3. **Viral Product Features**: Specific features that get shared/liked disproportionately
4. **Engagement Patterns**: What type of content drives purchases (unboxing / review / lifestyle / tutorial)
5. **Hashtag Strategy**: Top hashtags and their view counts for content planning
6. **Signal Strength**:
   - Strong positive: >1M total views + >5% engagement rate + rising hashtag trend
   - Moderate positive: 100K-1M views + 2-5% engagement
   - Weak: <100K views or declining trend

## Cross-Validation Signals

TikTok data contributes these signals to cross-analysis:
- **Aesthetic signal**: What visual/Design trends are resonating
- **Virality signal**: Whether the product category has TikTok momentum
- **Content gap signal**: What content types are under-served (opportunity for new entrants)
- **Pricing signal**: Price points that perform well in TikTok content
