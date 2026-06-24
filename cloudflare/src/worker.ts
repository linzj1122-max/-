import { Env } from "./types";
import {
  jsonResponse,
  errorResponse,
  authenticate,
  getTimeoutMs,
} from "./utils";
import { handleAmazonResearch } from "./tools/amazon";
import { handleGoogleTrendsResearch } from "./tools/google-trends";
import { handleTiktokResearch } from "./tools/tiktok";
import { handleCrossAnalysis } from "./tools/cross-analysis";
import { chatWithAI } from "./ai";
import chatHtml from "./chat.html";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
    }

    if (path === "/chat") {
      return new Response(chatHtml, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    if (path === "/" || path === "/health") {
      return jsonResponse({
        service: "product-research-api",
        version: "1.0.0",
        status: "healthy",
        endpoints: [
          "POST /api/research/amazon",
          "POST /api/research/google-trends",
          "POST /api/research/tiktok",
          "POST /api/research/cross-analysis",
          "POST /api/chat",
          "POST /api/research/full",
          "GET  /api/history",
        ],
      });
    }

    if (path.startsWith("/api/")) {
      if (request.method !== "GET" && !authenticate(request, env)) {
        return errorResponse("Unauthorized: invalid or missing token", 401);
      }

      try {
        return await handleApiRoute(path, request, env, ctx);
      } catch (err: any) {
        return errorResponse(err.message || "Internal server error", 500);
      }
    }

    return errorResponse("Not found", 404);
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const cron = event.cron;
    const now = new Date(event.scheduledTime);
    const dateStr = now.toISOString().split("T")[0];

    if (cron === "0 0 * * *") {
      ctx.waitUntil(runMorningScan(env, dateStr));
    } else if (cron === "0 12 * * *") {
      ctx.waitUntil(runEveningScan(env, dateStr));
    } else if (cron === "0 10 * * 5") {
      ctx.waitUntil(runWeeklyReview(env, dateStr));
    }
  },
};

async function handleApiRoute(
  path: string,
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  if (path === "/api/research/amazon" && request.method === "POST") {
    const params = await request.json();
    const result = await handleAmazonResearch(params, env);
    return jsonResponse(result);
  }

  if (path === "/api/research/google-trends" && request.method === "POST") {
    const params = await request.json();
    const result = await handleGoogleTrendsResearch(params, env);
    return jsonResponse(result);
  }

  if (path === "/api/research/tiktok" && request.method === "POST") {
    const params = await request.json();
    const result = await handleTiktokResearch(params, env);
    return jsonResponse(result);
  }

  if (path === "/api/research/cross-analysis" && request.method === "POST") {
    const params = await request.json();
    const result = await handleCrossAnalysis(params, env);
    return jsonResponse(result);
  }

  if (path === "/api/chat" && request.method === "POST") {
    const { messages } = (await request.json()) as { messages: any[] };
    if (!messages || !Array.isArray(messages)) {
      return errorResponse("messages array is required", 400);
    }
    const reply = await chatWithAI(messages, env);
    return jsonResponse({ reply });
  }

  if (path === "/api/research/full" && request.method === "POST") {
    const { keyword, marketplace, geo, time_range } = (await request.json()) as {
      keyword: string;
      marketplace?: string;
      geo?: string;
      time_range?: string;
    };

    if (!keyword) {
      return errorResponse("keyword is required", 400);
    }

    const [amazonData, trendsData, tiktokData] = await Promise.all([
      handleAmazonResearch(
        { keyword, marketplace: marketplace || "US" },
        env,
      ),
      handleGoogleTrendsResearch(
        { keyword, geo: geo || "US", time_range: time_range || "past_12_months" },
        env,
      ),
      handleTiktokResearch({ keyword }, env),
    ]);

    const analysis = await handleCrossAnalysis(
      {
        keyword,
        amazon_data: amazonData,
        trends_data: trendsData,
        tiktok_data: tiktokData,
      },
      env,
    );

    const deepReport = await generateDeepReport(keyword, amazonData, trendsData, tiktokData, analysis, env);

    const report = {
      keyword,
      timestamp: new Date().toISOString(),
      data_sources: {
        amazon: amazonData,
        google_trends: trendsData,
        tiktok: tiktokData,
      },
      analysis,
      deep_report: deepReport,
    };

    ctx.waitUntil(
      env.RESEARCH_KV.put(
        `report:${keyword}:${Date.now()}`,
        JSON.stringify(report),
        { expirationTtl: 2592000 },
      ),
    );

    return jsonResponse(report);
  }

  if (path === "/api/history" && request.method === "GET") {
    const list = await env.RESEARCH_KV.list({ prefix: "report:", limit: 50 });
    const reports = await Promise.all(
      list.keys.map(async (key) => {
        const value = await env.RESEARCH_KV.get(key.name);
        return { key: key.name, data: value ? JSON.parse(value) : null };
      }),
    );
    return jsonResponse({ reports });
  }

  return errorResponse("Not found", 404);
}

async function runMorningScan(env: Env, dateStr: string): Promise<void> {
  const keywords = await env.RESEARCH_KV.get("monitored_keywords");
  const keywordList: string[] = keywords ? JSON.parse(keywords) : [];

  if (keywordList.length === 0) return;

  for (const keyword of keywordList) {
    try {
      const [amazonData, trendsData, tiktokData] = await Promise.all([
        handleAmazonResearch({ keyword }, env),
        handleGoogleTrendsResearch({ keyword }, env),
        handleTiktokResearch({ keyword }, env),
      ]);

      const analysis = await handleCrossAnalysis(
        { keyword, amazon_data: amazonData, trends_data: trendsData, tiktok_data: tiktokData },
        env,
      );

      await env.RESEARCH_KV.put(
        `scan:morning:${keyword}:${dateStr}`,
        JSON.stringify({ keyword, analysis, timestamp: new Date().toISOString() }),
        { expirationTtl: 2592000 },
      );

      if (analysis.negative_signal_count >= 2 || analysis.conflicts.length > 0) {
        await env.RESEARCH_KV.put(
          `alert:${keyword}:${dateStr}`,
          JSON.stringify({ type: "morning_alert", keyword, analysis }),
          { expirationTtl: 604800 },
        );
      }
    } catch (err) {
      console.error(`Morning scan failed for ${keyword}:`, err);
    }
  }
}

async function runEveningScan(env: Env, dateStr: string): Promise<void> {
  const keywords = await env.RESEARCH_KV.get("monitored_keywords");
  const keywordList: string[] = keywords ? JSON.parse(keywords) : [];

  if (keywordList.length === 0) return;

  for (const keyword of keywordList) {
    try {
      const morningScan = await env.RESEARCH_KV.get(`scan:morning:${keyword}:${dateStr}`);
      const [amazonData, trendsData, tiktokData] = await Promise.all([
        handleAmazonResearch({ keyword }, env),
        handleGoogleTrendsResearch({ keyword }, env),
        handleTiktokResearch({ keyword }, env),
      ]);

      const analysis = await handleCrossAnalysis(
        { keyword, amazon_data: amazonData, trends_data: trendsData, tiktok_data: tiktokData },
        env,
      );

      await env.RESEARCH_KV.put(
        `scan:evening:${keyword}:${dateStr}`,
        JSON.stringify({
          keyword,
          analysis,
          morning_comparison: morningScan ? JSON.parse(morningScan).analysis : null,
          timestamp: new Date().toISOString(),
        }),
        { expirationTtl: 2592000 },
      );
    } catch (err) {
      console.error(`Evening scan failed for ${keyword}:`, err);
    }
  }
}

async function runWeeklyReview(env: Env, dateStr: string): Promise<void> {
  const keywords = await env.RESEARCH_KV.get("monitored_keywords");
  const keywordList: string[] = keywords ? JSON.parse(keywords) : [];

  if (keywordList.length === 0) return;

  const weeklySummary: any[] = [];

  for (const keyword of keywordList) {
    try {
      const list = await env.RESEARCH_KV.list({ prefix: `scan:${keyword}` });
      const weekScans = await Promise.all(
        list.keys.slice(-14).map(async (key) => {
          const value = await env.RESEARCH_KV.get(key.name);
          return value ? JSON.parse(value) : null;
        }),
      );

      weeklySummary.push({
        keyword,
        scans: weekScans.filter(Boolean),
        total_scans: weekScans.filter(Boolean).length,
      });
    } catch (err) {
      console.error(`Weekly review failed for ${keyword}:`, err);
    }
  }

  await env.RESEARCH_KV.put(
    `weekly:${dateStr}`,
    JSON.stringify({ date: dateStr, summary: weeklySummary, timestamp: new Date().toISOString() }),
    { expirationTtl: 7776000 },
  );
}

async function generateDeepReport(
  keyword: string,
  amazonData: any,
  trendsData: any,
  tiktokData: any,
  analysis: any,
  env: Env,
): Promise<string> {
  const { chatWithAI } = await import("./ai");

  const dataSummary = [
    `## Amazon 数据`,
    `- 竞争度: ${amazonData?.competition_score || "N/A"}`,
    `- 市场需求: ${amazonData?.market_demand || "N/A"}`,
    `- 价格区间: $${amazonData?.price_range?.min || "??"} - $${amazonData?.price_range?.max || "??"} (中位价 $${amazonData?.price_range?.median || "??"})`,
    `- 评论主题: ${(amazonData?.review_themes || []).join(", ") || "无"}`,
    `- 头部产品: ${(amazonData?.top_products || []).slice(0, 3).map((p: any) => `${p.title} $${p.price} ${p.rating}星 ${p.review_count}评`).join("; ") || "无"}`,
    ``,
    `## Google Trends 数据`,
    `- 趋势方向: ${trendsData?.trend_direction || "N/A"}`,
    `- 年增长率: ${trendsData?.growth_rate_12m || 0}%`,
    `- 季节性: ${trendsData?.seasonality || "N/A"}`,
    `- 旺季月份: ${(trendsData?.peak_months || []).join(", ") || "N/A"}`,
    `- 相关搜索: ${(trendsData?.related_queries || []).join(", ") || "无"}`,
    ``,
    `## TikTok 数据`,
    `- 病毒潜力: ${tiktokData?.viral_potential || "N/A"}`,
    `- 互动率: ${tiktokData?.engagement_rate || 0}%`,
    `- 总浏览: ${tiktokData?.total_views || 0}`,
    `- 热门标签: ${(tiktokData?.trending_hashtags || []).join(", ") || "无"}`,
    `- 审美趋势: ${(tiktokData?.aesthetic_themes || []).join(", ") || "无"}`,
    ``,
    `## 交叉分析结果`,
    `- 推荐: ${analysis?.recommendation || "N/A"}`,
    `- 置信度: ${analysis?.confidence || "N/A"}`,
    `- 信号: ${JSON.stringify(analysis?.signal_summary || {})}`,
    `- 冲突: ${(analysis?.conflicts || []).join("; ") || "无"}`,
    `- 风险: ${(analysis?.risks || []).join("; ") || "无"}`,
  ].join("\n");

  const prompt = [
    {
      role: "system",
      content: `你是一位资深跨境电商选品顾问，擅长从 Amazon / Google Trends / TikTok 三方数据中提炼可执行的选品建议。

你的报告必须包含以下结构，每个部分都要有具体数据和可执行建议：

1. **选品总览** — 列出 3-5 个相关细分产品，包含竞争度(1-5星)、推荐指数(1-5星)、1688参考价、建议零售价
2. **每个产品的详细分析**:
   - 市场数据（亚马逊排名/月销量/评价数/TikTok播放量）
   - 产品规格建议
   - 1688 采购信息（搜索关键词、参考价、MOQ、货期）
   - 差异化建议（3条以上）
3. **采购行动清单** — 分步骤的操作指南
4. **风险提示和合规提醒**

注意：
- 1688价格和工厂信息基于你的行业知识给出合理估算
- 所有建议必须基于提供的数据，不要编造具体产品链接
- 用中文输出，价格用美元和人民币双标`,
    },
    {
      role: "user",
      content: `关键词: "${keyword}"\n\n以下是采集到的数据：\n\n${dataSummary}\n\n请生成完整的选品调研报告。`,
    },
  ];

  try {
    return await chatWithAI(prompt, env);
  } catch (err: any) {
    return `深度报告生成失败: ${err.message}`;
  }
}
