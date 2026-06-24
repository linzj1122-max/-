---
name: cross-analysis
description: Cross-validate signals from Amazon, Google Trends, and TikTok data sources. Only recommend a niche when at least 3 sources show positive signals.
requires:
  bins:
    - jq
---

# Cross-Analysis Engine Skill

After collecting data from amazon-research, google-trends, and tiktok-research, use this skill to cross-validate signals and generate the final recommendation.

## Signal Classification

Each data source produces signals in two categories:

### Positive Signals (支持进入)
- Amazon: Low competition + high demand + clear pain point gaps
- Google Trends: Rising trend + >15% growth + seasonal peak approaching
- TikTok: High engagement + rising hashtag + aesthetic-product fit

### Negative Signals (不建议进入)
- Amazon: Saturated market + dominated by top brands + price war
- Google Trends: Declining trend + negative growth
- TikTok: Low engagement + declining hashtag + no product-aesthetic fit

### Conflicting Signals (需进一步验证)
- Amazon positive but Trends negative → market may be commoditized
- Trends positive but Amazon negative → demand may not translate to purchases
- TikTok positive but Amazon negative → aesthetic trend without purchasing intent

## Cross-Validation Logic

### Step 1: Count Signal Alignment

```
signal_count = count of sources showing POSITIVE signal

if signal_count >= 3:
    recommendation = "推荐进入"
    confidence = "高"
elif signal_count == 2:
    recommendation = "谨慎进入"
    confidence = "中"
    flag_conflicts()
elif signal_count == 1:
    recommendation = "不建议进入"
    confidence = "中"
    explain_why_other_sources_disagree()
elif signal_count == 0:
    recommendation = "强烈不建议"
    confidence = "高"
```

### Step 2: Conflict Resolution

When signals conflict, apply these rules:

1. **Amazon > Trends > TikTok** for purchase-intent signals (Amazon reflects actual buying behavior)
2. **Trends > TikTok > Amazon** for growth signals (Trends captures early demand)
3. **TikTok > Trends > Amazon** for aesthetic/virality signals (TikTok leads cultural trends)
4. **Any source showing strong negative → always flag as risk**, even if others are positive

### Step 3: Generate Structured Output

Synthesize the cross-analysis into this format:

```json
{
  "recommendation": "推荐进入 | 谨慎进入 | 不建议进入 | 强烈不建议",
  "confidence": "高 | 中 | 低",
  "signal_summary": {
    "amazon": "positive | negative | neutral | unavailable",
    "google_trends": "positive | negative | neutral | unavailable",
    "tiktok": "positive | negative | neutral | unavailable"
  },
  "conflicts": ["description of any conflicting signals"],
  "market_size": {
    "annual_sales_estimate": "X-Y万件",
    "growth_rate": "X-Y%",
    "data_sources": ["which sources contributed"],
    "confidence": "高 | 中 | 低"
  },
  "pain_points": [
    {"pain": "漏水", "frequency": "28%", "opportunity": "high"}
  ],
  "winning_formula": "TikTok [aesthetic] × Amazon [pain point solution]",
  "risks": ["list of identified risks"],
  "next_steps": ["recommended verification actions"]
}
```

## Analysis Templates

### Market Size Estimation

When Amazon provides BSR and review data:
- BSR < 1000 in category → high-demand niche
- BSR 1000-10000 → medium demand
- BSR > 10000 → low demand (but may indicate less competition)
- Review count × 15-20 = rough total sales estimate
- Cross-check with Google Trends search volume for consistency

### Pain Point Extraction

When Amazon provides review data:
1. Cluster negative reviews into themes
2. Calculate frequency percentage for each theme
3. Rank by: frequency × severity × opportunity (is this solvable?)
4. Only include themes with >10% frequency in the report

### Winning Formula Construction

Combine signals from all 3 sources:
1. From TikTok: What aesthetic/feature is trending? (e.g., "极简风", "复古色系")
2. From Amazon: What pain point is underserved? (e.g., "漏水", "容量不足")
3. Formula: "TikTok [aesthetic] × Amazon [pain point solution]"
4. Example: "TikTok极简设计 × 亚马逊漏水痛点解决 = 极简防漏水壶"

## Quality Gates

Before outputting any recommendation, verify:
- [ ] At least 2 data sources were successfully queried
- [ ] No data source was "invented" — all numbers trace to actual tool output
- [ ] Conflicting signals are explicitly flagged
- [ ] Confidence level reflects the number and quality of available sources
- [ ] Next steps include specific verification actions
