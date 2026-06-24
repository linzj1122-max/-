import { Env } from "../types";
import { getMinPositiveSignals } from "../utils";

function scoreAmazon(data: any): { signal: "positive" | "negative" | "neutral"; details: string[] } {
  const details: string[] = [];
  let score = 0;

  if (data.competition_score === "low") {
    score += 2;
    details.push("竞争度低");
  } else if (data.competition_score === "medium") {
    score += 1;
    details.push("竞争度中等");
  } else if (data.competition_score === "high") {
    score -= 2;
    details.push("竞争度高");
  }

  if (data.market_demand === "high") {
    score += 1;
    details.push("市场需求高");
  } else if (data.market_demand === "low") {
    score -= 1;
    details.push("市场需求低");
  }

  if (data.review_themes?.length > 0) {
    score += 1;
    details.push(`发现${data.review_themes.length}个评论主题`);
  }

  if (data.price_range?.median && data.price_range.median > 0) {
    if (data.price_range.median < 20) {
      details.push(`中位价$${data.price_range.median}，适合冲动消费`);
      score += 0.5;
    } else if (data.price_range.median > 80) {
      details.push(`中位价$${data.price_range.median}，高客单价品类`);
      score -= 0.5;
    }
  }

  if (score >= 2) return { signal: "positive", details };
  if (score <= -1) return { signal: "negative", details };
  return { signal: "neutral", details };
}

function scoreTrends(data: any): { signal: "positive" | "negative" | "neutral"; details: string[] } {
  const details: string[] = [];
  let score = 0;

  if (data.trend_direction === "rising") {
    score += 2;
    details.push("搜索趋势上升");
  } else if (data.trend_direction === "declining") {
    score -= 2;
    details.push("搜索趋势下降");
  } else if (data.trend_direction === "stable") {
    details.push("搜索趋势稳定");
  }

  if (data.growth_rate_12m > 30) {
    score += 2;
    details.push(`年增长率${data.growth_rate_12m}%，高速增长`);
  } else if (data.growth_rate_12m > 15) {
    score += 1;
    details.push(`年增长率${data.growth_rate_12m}%，稳健增长`);
  } else if (data.growth_rate_12m > 0) {
    details.push(`年增长率${data.growth_rate_12m}%，小幅增长`);
  } else if (data.growth_rate_12m < 0) {
    score -= 1;
    details.push(`年增长率${data.growth_rate_12m}%，负增长`);
  }

  if (data.seasonality === "strong") {
    details.push("季节性明显，需注意备货节奏");
  }

  if (data.related_queries?.length > 0) {
    score += 0.5;
    details.push(`${data.related_queries.length}个相关上升查询`);
  }

  if (score >= 2) return { signal: "positive", details };
  if (score <= -1) return { signal: "negative", details };
  return { signal: "neutral", details };
}

function scoreTiktok(data: any): { signal: "positive" | "negative" | "neutral"; details: string[] } {
  const details: string[] = [];
  let score = 0;

  if (data.viral_potential === "high") {
    score += 2;
    details.push("病毒传播潜力高");
  } else if (data.viral_potential === "medium") {
    score += 1;
    details.push("病毒传播潜力中等");
  } else if (data.viral_potential === "low") {
    score -= 1;
    details.push("病毒传播潜力低");
  }

  if (data.engagement_rate > 5) {
    score += 2;
    details.push(`互动率${data.engagement_rate}%，高于5%阈值`);
  } else if (data.engagement_rate > 3) {
    score += 1;
    details.push(`互动率${data.engagement_rate}%，中等水平`);
  } else if (data.engagement_rate > 0 && data.engagement_rate < 2) {
    score -= 1;
    details.push(`互动率${data.engagement_rate}%，偏低`);
  }

  if (data.total_views > 5000000) {
    score += 1;
    details.push(`总浏览${(data.total_views / 1000000).toFixed(1)}M，流量大`);
  } else if (data.total_views > 1000000) {
    score += 0.5;
    details.push(`总浏览${(data.total_views / 1000000).toFixed(1)}M，流量可观`);
  }

  if (data.trending_hashtags?.length > 0) {
    score += 0.5;
    details.push(`${data.trending_hashtags.length}个热门标签`);
  }

  if (data.aesthetic_themes?.length > 0) {
    details.push(`审美趋势: ${data.aesthetic_themes.join(", ")}`);
  }

  if (score >= 2) return { signal: "positive", details };
  if (score <= -1) return { signal: "negative", details };
  return { signal: "neutral", details };
}

export async function handleCrossAnalysis(
  params: {
    amazon_data?: any;
    trends_data?: any;
    tiktok_data?: any;
    keyword: string;
  },
  env: Env,
): Promise<any> {
  const { amazon_data, trends_data, tiktok_data, keyword } = params;
  const minPositiveSignals = getMinPositiveSignals(env);

  const signals: Record<
    string,
    "positive" | "negative" | "neutral" | "unavailable"
  > = {};
  const signalDetails: Record<string, string[]> = {};
  const conflicts: string[] = [];
  const risks: string[] = [];

  if (amazon_data) {
    if (amazon_data.error) {
      signals.amazon = "unavailable";
      signalDetails.amazon = [`数据不可用: ${amazon_data.error}`];
      risks.push(`Amazon数据不可用: ${amazon_data.error}`);
    } else {
      const result = scoreAmazon(amazon_data);
      signals.amazon = result.signal;
      signalDetails.amazon = result.details;
      if (result.signal === "negative") {
        risks.push("Amazon竞争度高，头部品牌集中");
      }
    }
  } else {
    signals.amazon = "unavailable";
    signalDetails.amazon = ["未获取数据"];
    risks.push("未获取Amazon数据，市场容量和竞争度无法验证");
  }

  if (trends_data) {
    if (trends_data.error) {
      signals.google_trends = "unavailable";
      signalDetails.google_trends = [`数据不可用: ${trends_data.error}`];
      risks.push(`Google Trends数据不可用: ${trends_data.error}`);
    } else {
      const result = scoreTrends(trends_data);
      signals.google_trends = result.signal;
      signalDetails.google_trends = result.details;
      if (result.signal === "negative") {
        risks.push("搜索趋势下降，市场需求可能萎缩");
      }
    }
  } else {
    signals.google_trends = "unavailable";
    signalDetails.google_trends = ["未获取数据"];
    risks.push("未获取Google Trends数据，增长趋势无法验证");
  }

  if (tiktok_data) {
    if (tiktok_data.error) {
      signals.tiktok = "unavailable";
      signalDetails.tiktok = [`数据不可用: ${tiktok_data.error}`];
      risks.push(`TikTok数据不可用: ${tiktok_data.error}`);
    } else {
      const result = scoreTiktok(tiktok_data);
      signals.tiktok = result.signal;
      signalDetails.tiktok = result.details;
      if (result.signal === "negative") {
        risks.push("TikTok互动率低，社媒传播力不足");
      }
    }
  } else {
    signals.tiktok = "unavailable";
    signalDetails.tiktok = ["未获取数据"];
    risks.push("未获取TikTok数据，社媒趋势无法验证");
  }

  const positiveCount = Object.values(signals).filter(
    (s) => s === "positive",
  ).length;
  const negativeCount = Object.values(signals).filter(
    (s) => s === "negative",
  ).length;
  const availableCount = Object.values(signals).filter(
    (s) => s !== "unavailable",
  ).length;

  if (signals.amazon === "positive" && signals.google_trends === "negative") {
    conflicts.push(
      "Amazon数据积极但搜索趋势下降 — 市场可能已商品化，需求不增长但存量竞争",
    );
  }
  if (signals.google_trends === "positive" && signals.amazon === "negative") {
    conflicts.push(
      "搜索趋势上升但Amazon竞争激烈 — 需求增长但进入壁垒高",
    );
  }
  if (signals.tiktok === "positive" && signals.amazon === "negative") {
    conflicts.push(
      "TikTok热度高但Amazon表现差 — 可能是审美趋势而非购买需求",
    );
  }

  let recommendation: string;
  let confidence: string;

  if (positiveCount >= minPositiveSignals && negativeCount === 0) {
    recommendation = "推荐进入";
    confidence = "高";
  } else if (positiveCount >= 2 && negativeCount === 0) {
    recommendation = "谨慎进入";
    confidence = "中";
  } else if (positiveCount >= 2 && negativeCount >= 1) {
    recommendation = "谨慎进入";
    confidence = "低";
    risks.push("存在冲突信号，建议进一步验证");
  } else if (positiveCount === 1 && negativeCount === 0) {
    recommendation = "不建议进入";
    confidence = "中";
  } else if (negativeCount >= 2) {
    recommendation = "强烈不建议";
    confidence = "高";
  } else {
    recommendation = "数据不足，无法判断";
    confidence = "低";
  }

  if (availableCount < 2) {
    confidence = "低";
    risks.push("可用数据源不足2个，结论可靠性有限");
  }

  return {
    keyword,
    recommendation,
    confidence,
    signal_summary: signals,
    signal_details: signalDetails,
    positive_signal_count: positiveCount,
    negative_signal_count: negativeCount,
    conflicts,
    risks,
    next_steps:
      risks.length > 0
        ? risks.map((r) => `验证: ${r}`)
        : ["建议用选品工具二次验证数据", "小批量测试验证市场反应"],
  };
}
