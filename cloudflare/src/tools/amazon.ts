import { Env } from "../types";
import { fetchWithTimeout, getTimeoutMs } from "../utils";
import { extractAmazonSignals } from "../ai";

export async function handleAmazonResearch(
  params: {
    keyword?: string;
    asin_list?: string;
    marketplace?: string;
    max_results?: number;
    include_reviews?: boolean;
  },
  env: Env,
): Promise<any> {
  const {
    keyword,
    asin_list,
    marketplace = "US",
    max_results = 20,
    include_reviews = true,
  } = params;
  const timeoutMs = getTimeoutMs(env);

  if (!env.AMAZON_API_KEY) {
    if (env.TAVILY_API_KEY) {
      const tavilyBody = {
        query: `Amazon Best Sellers ${keyword ?? asin_list} ${new Date().getFullYear()}`,
        search_depth: "advanced",
        max_results: 10,
        include_answer: true,
        include_domains: ["amazon.com"],
      };
      const result = await fetchWithTimeout(
        "https://api.tavily.com/search",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${env.TAVILY_API_KEY}`,
          },
          body: JSON.stringify(tavilyBody),
        },
        timeoutMs,
      );
      if (result.error) return result;

      const aiSignals = await extractAmazonSignals(keyword ?? asin_list ?? "", result, env);

      return {
        source: "tavily_ai_analyzed",
        note: "Amazon API not configured; data from web search + AI analysis",
        ...aiSignals,
      };
    }
    return {
      error:
        "No Amazon API key or Tavily key configured. Set AMAZON_API_KEY or TAVILY_API_KEY.",
    };
  }

  const baseUrl =
    env.AMAZON_API_BASE_URL || "https://api.example.com/amazon";
  const endpoint = asin_list ? `${baseUrl}/products` : `${baseUrl}/search`;
  const body: Record<string, any> = {
    marketplace,
    max_results,
    include_reviews,
  };
  if (keyword) body.keyword = keyword;
  if (asin_list) body.asins = asin_list;

  const result = await fetchWithTimeout(
    endpoint,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.AMAZON_API_KEY}`,
      },
      body: JSON.stringify(body),
    },
    timeoutMs,
  );

  if (result.error) return result;

  return {
    source: "amazon_api",
    marketplace,
    top_products: (result.results || [])
      .slice(0, max_results)
      .map((p: any) => ({
        asin: p.asin,
        title: p.title,
        price: p.price,
        rating: p.rating,
        review_count: p.review_count,
        bsr: p.bsr,
        monthly_sales_estimate: p.monthly_sales_estimate,
      })),
    price_distribution: result.price_distribution,
    review_themes: result.review_themes,
    competition_score: result.competition_score,
  };
}
