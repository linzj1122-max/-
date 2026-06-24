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

    const report = {
      keyword,
      timestamp: new Date().toISOString(),
      data_sources: {
        amazon: amazonData,
        google_trends: trendsData,
        tiktok: tiktokData,
      },
      analysis,
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
