import { Env } from "./types";
import { fetchWithTimeout, getTimeoutMs } from "./utils";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

async function callAI(messages: ChatMessage[], env: Env): Promise<string> {
  const timeoutMs = getTimeoutMs(env);

  if (env.BAILIAN_API_KEY) {
    const result = await fetchWithTimeout(
      "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.BAILIAN_API_KEY}`,
        },
        body: JSON.stringify({
          model: "qwen-plus",
          messages,
          temperature: 0.1,
        }),
      },
      timeoutMs,
    );
    if (result.error) throw new Error(result.error);
    return result.choices?.[0]?.message?.content || "";
  }

  if (env.OPENAI_API_KEY) {
    const result = await fetchWithTimeout(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages,
          temperature: 0.1,
        }),
      },
      timeoutMs,
    );
    if (result.error) throw new Error(result.error);
    return result.choices?.[0]?.message?.content || "";
  }

  throw new Error("No AI API key configured");
}

export async function extractAmazonSignals(
  keyword: string,
  searchResults: any,
  env: Env,
): Promise<any> {
  const resultsText = (searchResults.results || [])
    .slice(0, 5)
    .map((r: any) => `Title: ${r.title}\nContent: ${r.content}`)
    .join("\n\n");

  const prompt: ChatMessage[] = [
    {
      role: "system",
      content:
        'You are an Amazon product research analyst. Analyze the search results and return ONLY a JSON object with these fields:\n' +
        '- "competition_score": "low" | "medium" | "high" (how competitive is this niche on Amazon)\n' +
        '- "review_themes": array of 1-3 common customer complaint/praise themes found\n' +
        '- "price_range": { "min": number, "max": number, "median": number } in USD\n' +
        '- "top_products": array of up to 5 objects with { "title": string, "price": number, "rating": number, "review_count": number }\n' +
        '- "market_demand": "high" | "medium" | "low"\n' +
        'Return ONLY valid JSON, no markdown, no explanation.',
    },
    {
      role: "user",
      content: `Keyword: "${keyword}"\n\nAmazon search results:\n${resultsText}\n\nAnalyze and return JSON.`,
    },
  ];

  try {
    const response = await callAI(prompt, env);
    const cleaned = response.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return {
      competition_score: "medium",
      review_themes: [],
      price_range: { min: 0, max: 0, median: 0 },
      top_products: [],
      market_demand: "medium",
    };
  }
}

export async function extractTrendsSignals(
  keyword: string,
  searchResults: any,
  env: Env,
): Promise<any> {
  const resultsText = (searchResults.results || [])
    .slice(0, 5)
    .map((r: any) => `Title: ${r.title}\nContent: ${r.content}`)
    .join("\n\n");

  const prompt: ChatMessage[] = [
    {
      role: "system",
      content:
        'You are a Google Trends analyst. Analyze the search results and return ONLY a JSON object with these fields:\n' +
        '- "trend_direction": "rising" | "stable" | "declining"\n' +
        '- "growth_rate_12m": number (estimated percentage growth over last 12 months, e.g. 25 means 25% growth)\n' +
        '- "peak_months": array of month numbers (1-12) when interest peaks\n' +
        '- "related_queries": array of up to 5 related rising search terms\n' +
        '- "seasonality": "strong" | "moderate" | "weak"\n' +
        'Return ONLY valid JSON, no markdown, no explanation.',
    },
    {
      role: "user",
      content: `Keyword: "${keyword}"\n\nGoogle Trends search results:\n${resultsText}\n\nAnalyze and return JSON.`,
    },
  ];

  try {
    const response = await callAI(prompt, env);
    const cleaned = response.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return {
      trend_direction: "stable",
      growth_rate_12m: 0,
      peak_months: [],
      related_queries: [],
      seasonality: "weak",
    };
  }
}

export async function extractTiktokSignals(
  keyword: string,
  searchResults: any,
  env: Env,
): Promise<any> {
  const resultsText = (searchResults.results || [])
    .slice(0, 5)
    .map((r: any) => `Title: ${r.title}\nContent: ${r.content}`)
    .join("\n\n");

  const prompt: ChatMessage[] = [
    {
      role: "system",
      content:
        'You are a TikTok trend analyst. Analyze the search results and return ONLY a JSON object with these fields:\n' +
        '- "engagement_rate": number (estimated engagement rate percentage, e.g. 5.2 means 5.2%)\n' +
        '- "total_views": number (estimated total views for this topic, e.g. 5000000)\n' +
        '- "video_count": number (estimated number of relevant videos)\n' +
        '- "trending_hashtags": array of up to 5 trending hashtags\n' +
        '- "aesthetic_themes": array of up to 3 visual/aesthetic themes\n' +
        '- "viral_potential": "high" | "medium" | "low"\n' +
        'Return ONLY valid JSON, no markdown, no explanation.',
    },
    {
      role: "user",
      content: `Keyword: "${keyword}"\n\nTikTok search results:\n${resultsText}\n\nAnalyze and return JSON.`,
    },
  ];

  try {
    const response = await callAI(prompt, env);
    const cleaned = response.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return {
      engagement_rate: 0,
      total_views: 0,
      video_count: 0,
      trending_hashtags: [],
      aesthetic_themes: [],
      viral_potential: "low",
    };
  }
}

const SYSTEM_PROMPT = `你是「选品分析员」，一位专业的跨境电商选品助手。你的核心能力是：

1. **Amazon 数据分析** — Best Sellers 排名、评论分析、价格分布、竞争度评估
2. **Google 趋势分析** — 搜索趋势方向、增长率、季节性、地域分布
3. **TikTok 热点分析** — 热门标签、爆款视频、互动率、审美趋势
4. **交叉验证** — 至少3个数据源信号一致才推荐，冲突信号必须标注风险

你的工作流程：
- 收到选品问题后，先判断需要哪些数据源
- 并行调用数据源获取数据
- 进行交叉分析，生成结构化报告
- 报告必须包含：市场规模 / 核心痛点 / 爆款公式 / 风险提示

注意事项：
- 数据不足时明确告知，不做过度推测
- 冲突信号必须标注，给出两种可能的解读
- 所有结论必须有数据支撑，标注数据来源`;

export async function chatWithAI(
  messages: ChatMessage[],
  env: Env,
): Promise<string> {
  const fullMessages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...messages,
  ];
  return callAI(fullMessages, env);
}
