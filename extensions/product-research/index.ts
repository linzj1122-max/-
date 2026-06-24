export default function register(api: any) {
  const config = api.config ?? {};
  const timeoutMs = (config.defaultTimeoutSeconds ?? 30) * 1000;
  const minPositiveSignals = config.minPositiveSignals ?? 3;

  api.log?.info?.("product-research: Plugin loading...");

  async function fetchWithTimeout(url: string, options: RequestInit): Promise<any> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) {
        const errText = await res.text();
        return { error: `API error (${res.status}): ${errText}` };
      }
      return await res.json();
    } catch (err: any) {
      clearTimeout(timer);
      if (err.name === "AbortError") {
        return { error: `Request timed out after ${config.defaultTimeoutSeconds ?? 30}s` };
      }
      return { error: `Request failed: ${err.message}` };
    }
  }

  api.registerTool({
    name: "amazon_research",
    description:
      "Fetch Amazon product data: Best Sellers rankings, review analysis, pricing, competition metrics. " +
      "Use when the user asks about Amazon product data, competition, reviews, or market size.",
    inputSchema: {
      type: "object",
      properties: {
        keyword: {
          type: "string",
          description: "Product keyword or category name to search"
        },
        asin_list: {
          type: "string",
          description: "Comma-separated ASINs for specific product lookup"
        },
        marketplace: {
          type: "string",
          enum: ["US", "EU", "UK", "DE", "JP"],
          default: "US",
          description: "Amazon marketplace"
        },
        max_results: {
          type: "number",
          default: 20,
          minimum: 1,
          maximum: 50,
          description: "Maximum number of products to return"
        },
        include_reviews: {
          type: "boolean",
          default: true,
          description: "Include review analysis in results"
        }
      },
      required: []
    },
    handler: async (params: any) => {
      const { keyword, asin_list, marketplace = "US", max_results = 20, include_reviews = true } = params;

      if (!config.amazonApiKey) {
        if (config.tavilyApiKey) {
          const tavilyBody = {
            query: `Amazon Best Sellers ${keyword ?? asin_list} ${new Date().getFullYear()}`,
            search_depth: "advanced",
            max_results: 10,
            include_answer: true,
            include_domains: ["amazon.com"]
          };
          const result = await fetchWithTimeout("https://api.tavily.com/search", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${config.tavilyApiKey}`
            },
            body: JSON.stringify(tavilyBody)
          });
          if (result.error) return result;
          return {
            source: "tavily_fallback",
            note: "Amazon API not configured; data from web search, not direct API",
            answer: result.answer,
            results: (result.results || []).map((r: any) => ({
              title: r.title,
              url: r.url,
              content: r.content
            }))
          };
        }
        return { error: "No Amazon API key or Tavily key configured. Set AMAZON_API_KEY or TAVILY_API_KEY." };
      }

      const baseUrl = config.amazonApiBaseUrl ?? "https://api.example.com/amazon";
      const endpoint = asin_list ? `${baseUrl}/products` : `${baseUrl}/search`;
      const body: Record<string, any> = {
        marketplace,
        max_results,
        include_reviews
      };
      if (keyword) body.keyword = keyword;
      if (asin_list) body.asins = asin_list;

      const result = await fetchWithTimeout(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.amazonApiKey}`
        },
        body: JSON.stringify(body)
      });

      if (result.error) return result;

      return {
        source: "amazon_api",
        marketplace,
        top_products: (result.results || []).slice(0, max_results).map((p: any) => ({
          asin: p.asin,
          title: p.title,
          price: p.price,
          rating: p.rating,
          review_count: p.review_count,
          bsr: p.bsr,
          monthly_sales_estimate: p.monthly_sales_estimate
        })),
        price_distribution: result.price_distribution,
        review_themes: result.review_themes,
        competition_score: result.competition_score
      };
    }
  });

  api.registerTool({
    name: "google_trends_research",
    description:
      "Fetch Google Trends data: search interest over time, related queries, geographic distribution, seasonal patterns. " +
      "Use when the user asks about search trends, market growth, or seasonal patterns.",
    inputSchema: {
      type: "object",
      properties: {
        keyword: {
          type: "string",
          description: "Keyword to analyze trends for"
        },
        keywords: {
          type: "array",
          items: { type: "string" },
          description: "Multiple keywords to compare trends (max 5)"
        },
        geo: {
          type: "string",
          default: "US",
          description: "Geographic region (country code)"
        },
        time_range: {
          type: "string",
          enum: ["past_30_days", "past_90_days", "past_12_months", "past_5_years"],
          default: "past_12_months",
          description: "Time range for trend data"
        }
      },
      required: []
    },
    handler: async (params: any) => {
      const { keyword, keywords, geo = "US", time_range = "past_12_months" } = params;

      if (!config.googleTrendsKey) {
        if (config.tavilyApiKey) {
          const searchQuery = `${keyword ?? keywords?.join(" vs ")} trend ${new Date().getFullYear()} market growth Google Trends`;
          const tavilyBody = {
            query: searchQuery,
            search_depth: "advanced",
            max_results: 8,
            include_answer: true
          };
          const result = await fetchWithTimeout("https://api.tavily.com/search", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${config.tavilyApiKey}`
            },
            body: JSON.stringify(tavilyBody)
          });
          if (result.error) return result;
          return {
            source: "tavily_fallback",
            note: "Google Trends API not configured; data from web search",
            answer: result.answer,
            results: (result.results || []).map((r: any) => ({
              title: r.title,
              url: r.url,
              content: r.content
            }))
          };
        }
        return { error: "No Google Trends API key or Tavily key configured." };
      }

      const baseUrl = config.googleTrendsApiBaseUrl ?? "https://api.example.com/trends";
      const isCompare = keywords && keywords.length > 1;
      const endpoint = isCompare ? `${baseUrl}/compare` : `${baseUrl}/explore`;
      const body: Record<string, any> = { geo, time_range };
      if (isCompare) body.keywords = keywords;
      else body.keyword = keyword;

      const result = await fetchWithTimeout(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.googleTrendsKey}`
        },
        body: JSON.stringify(body)
      });

      if (result.error) return result;

      return {
        source: "google_trends_api",
        geo,
        time_range,
        trend_direction: result.trend_direction,
        growth_rate_12m: result.growth_rate_12m,
        peak_months: result.peak_months,
        related_queries: result.related_queries,
        top_regions: result.interest_by_region?.slice(0, 5),
        seasonality: result.seasonality
      };
    }
  });

  api.registerTool({
    name: "tiktok_research",
    description:
      "Fetch TikTok data: trending hashtags, viral product videos, engagement metrics, aesthetic themes. " +
      "Use when the user asks about TikTok trends, viral products, or aesthetic trends.",
    inputSchema: {
      type: "object",
      properties: {
        keyword: {
          type: "string",
          description: "Keyword to search TikTok content"
        },
        hashtag: {
          type: "string",
          description: "Specific hashtag to analyze"
        },
        max_results: {
          type: "number",
          default: 20,
          minimum: 1,
          maximum: 50,
          description: "Maximum number of results"
        }
      },
      required: []
    },
    handler: async (params: any) => {
      const { keyword, hashtag, max_results = 20 } = params;

      if (!config.tiktokApiKey) {
        if (config.tavilyApiKey) {
          const searchQuery = `TikTok ${keyword ?? hashtag} trending viral product ${new Date().getFullYear()}`;
          const tavilyBody = {
            query: searchQuery,
            search_depth: "advanced",
            max_results: 8,
            include_answer: true,
            include_domains: ["tiktok.com", "trendtok.com", "tokboard.com"]
          };
          const result = await fetchWithTimeout("https://api.tavily.com/search", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${config.tavilyApiKey}`
            },
            body: JSON.stringify(tavilyBody)
          });
          if (result.error) return result;
          return {
            source: "tavily_fallback",
            note: "TikTok API not configured; data from web search",
            answer: result.answer,
            results: (result.results || []).map((r: any) => ({
              title: r.title,
              url: r.url,
              content: r.content
            }))
          };
        }
        return { error: "No TikTok API key or Tavily key configured." };
      }

      const baseUrl = config.tiktokApiBaseUrl ?? "https://api.example.com/tiktok";
      const endpoint = hashtag ? `${baseUrl}/hashtag` : `${baseUrl}/search`;
      const body: Record<string, any> = { max_results };
      if (hashtag) body.hashtag = hashtag;
      else body.keyword = keyword;

      const result = await fetchWithTimeout(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.tiktokApiKey}`
        },
        body: JSON.stringify(body)
      });

      if (result.error) return result;

      return {
        source: "tiktok_api",
        total_views: result.total_views,
        video_count: result.video_count,
        engagement_rate: result.engagement_rate,
        top_videos: (result.videos || []).slice(0, 5).map((v: any) => ({
          description: v.description,
          views: v.views,
          likes: v.likes,
          has_product_link: v.has_product_link
        })),
        trending_hashtags: result.trending_hashtags,
        aesthetic_themes: result.aesthetic_themes,
        viral_features: result.viral_features
      };
    }
  });

  api.registerTool({
    name: "cross_analysis",
    description:
      "Cross-validate signals from Amazon, Google Trends, and TikTok. " +
      "Only recommend a niche when at least the configured minimum of sources show positive signals. " +
      "Use AFTER collecting data from amazon_research, google_trends_research, and tiktok_research.",
    inputSchema: {
      type: "object",
      properties: {
        amazon_data: {
          type: "object",
          description: "Summarized data from amazon_research tool"
        },
        trends_data: {
          type: "object",
          description: "Summarized data from google_trends_research tool"
        },
        tiktok_data: {
          type: "object",
          description: "Summarized data from tiktok_research tool"
        },
        keyword: {
          type: "string",
          description: "The original keyword/category being researched"
        }
      },
      required: ["keyword"]
    },
    handler: async (params: any) => {
      const { amazon_data, trends_data, tiktok_data, keyword } = params;

      const signals: Record<string, "positive" | "negative" | "neutral" | "unavailable"> = {};
      const conflicts: string[] = [];
      const risks: string[] = [];

      if (amazon_data) {
        if (amazon_data.error) {
          signals.amazon = "unavailable";
          risks.push(`Amazon数据不可用: ${amazon_data.error}`);
        } else if (amazon_data.competition_score === "low" && amazon_data.review_themes?.length > 0) {
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
        } else if (trends_data.trend_direction === "rising" && trends_data.growth_rate_12m > 15) {
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
        } else if (tiktok_data.engagement_rate > 5 && tiktok_data.total_views > 1000000) {
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

      const positiveCount = Object.values(signals).filter((s) => s === "positive").length;
      const negativeCount = Object.values(signals).filter((s) => s === "negative").length;
      const availableCount = Object.values(signals).filter((s) => s !== "unavailable").length;

      if (signals.amazon === "positive" && signals.google_trends === "negative") {
        conflicts.push("Amazon数据积极但搜索趋势下降 — 市场可能已商品化，需求不增长但存量竞争");
      }
      if (signals.google_trends === "positive" && signals.amazon === "negative") {
        conflicts.push("搜索趋势上升但Amazon竞争激烈 — 需求增长但进入壁垒高");
      }
      if (signals.tiktok === "positive" && signals.amazon === "negative") {
        conflicts.push("TikTok热度高但Amazon表现差 — 可能是审美趋势而非购买需求");
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
        next_steps: risks.length > 0
          ? risks.map((r) => `验证: ${r}`)
          : ["建议用选品工具二次验证数据", "小批量测试验证市场反应"]
      };
    }
  });

  api.log?.info?.("product-research: Plugin loaded (amazon_research + google_trends_research + tiktok_research + cross_analysis)");
}
