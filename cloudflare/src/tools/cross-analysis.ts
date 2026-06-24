import { Env } from "./types";
import { getMinPositiveSignals } from "./utils";

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
  const conflicts: string[] = [];
  const risks: string[] = [];

  if (amazon_data) {
    if (amazon_data.error) {
      signals.amazon = "unavailable";
      risks.push(`Amazon数据不可用: ${amazon_data.error}`);
    } else if (
      amazon_data.competition_score === "low" &&
      amazon_data.review_themes?.length > 0
    ) {
      signals.amazon = "positive";
    } else if (amazon_data.competition_score === "high") {
      signals.amazon = "negative";
      risks.push("Amazon竞争度高，头部品牌集中");
    } else {
      signals.amazon = "neutral";
    }
  } else {
    signals.amazon = "unavailable";
    risks.push("未获取Amazon数据，市场容量和竞争度无法验证");
  }

  if (trends_data) {
    if (trends_data.error) {
      signals.google_trends = "unavailable";
      risks.push(`Google Trends数据不可用: ${trends_data.error}`);
    } else if (
      trends_data.trend_direction === "rising" &&
      trends_data.growth_rate_12m > 15
    ) {
      signals.google_trends = "positive";
    } else if (trends_data.trend_direction === "declining") {
      signals.google_trends = "negative";
      risks.push("搜索趋势下降，市场需求可能萎缩");
    } else {
      signals.google_trends = "neutral";
    }
  } else {
    signals.google_trends = "unavailable";
    risks.push("未获取Google Trends数据，增长趋势无法验证");
  }

  if (tiktok_data) {
    if (tiktok_data.error) {
      signals.tiktok = "unavailable";
      risks.push(`TikTok数据不可用: ${tiktok_data.error}`);
    } else if (
      tiktok_data.engagement_rate > 5 &&
      tiktok_data.total_views > 1000000
    ) {
      signals.tiktok = "positive";
    } else if (tiktok_data.engagement_rate < 2) {
      signals.tiktok = "negative";
      risks.push("TikTok互动率低，社媒传播力不足");
    } else {
      signals.tiktok = "neutral";
    }
  } else {
    signals.tiktok = "unavailable";
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
