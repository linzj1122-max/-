import { Env } from "../types";
import { fetchWithTimeout, getTimeoutMs } from "../utils";

export async function handleGoogleTrendsResearch(
  params: {
    keyword?: string;
    keywords?: string[];
    geo?: string;
    time_range?: string;
  },
  env: Env,
): Promise<any> {
  const { keyword, keywords, geo = "US", time_range = "past_12_months" } =
    params;
  const timeoutMs = getTimeoutMs(env);

  if (!env.GOOGLE_TRENDS_KEY) {
    if (env.TAVILY_API_KEY) {
      const searchQuery = `${keyword ?? keywords?.join(" vs ")} trend ${new Date().getFullYear()} market growth Google Trends`;
      const tavilyBody = {
        query: searchQuery,
        search_depth: "advanced",
        max_results: 8,
        include_answer: true,
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
      return {
        source: "tavily_fallback",
        note: "Google Trends API not configured; data from web search",
        answer: result.answer,
        results: (result.results || []).map((r: any) => ({
          title: r.title,
          url: r.url,
          content: r.content,
        })),
      };
    }
    return { error: "No Google Trends API key or Tavily key configured." };
  }

  const baseUrl =
    env.GOOGLE_TRENDS_API_BASE_URL || "https://api.example.com/trends";
  const isCompare = keywords && keywords.length > 1;
  const endpoint = isCompare ? `${baseUrl}/compare` : `${baseUrl}/explore`;
  const body: Record<string, any> = { geo, time_range };
  if (isCompare) body.keywords = keywords;
  else body.keyword = keyword;

  const result = await fetchWithTimeout(
    endpoint,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.GOOGLE_TRENDS_KEY}`,
      },
      body: JSON.stringify(body),
    },
    timeoutMs,
  );

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
    seasonality: result.seasonality,
  };
}
