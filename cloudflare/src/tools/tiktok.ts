import { Env } from "./types";
import { fetchWithTimeout, getTimeoutMs } from "./utils";

export async function handleTiktokResearch(
  params: {
    keyword?: string;
    hashtag?: string;
    max_results?: number;
  },
  env: Env,
): Promise<any> {
  const { keyword, hashtag, max_results = 20 } = params;
  const timeoutMs = getTimeoutMs(env);

  if (!env.TIKTOK_API_KEY) {
    if (env.TAVILY_API_KEY) {
      const searchQuery = `TikTok ${keyword ?? hashtag} trending viral product ${new Date().getFullYear()}`;
      const tavilyBody = {
        query: searchQuery,
        search_depth: "advanced",
        max_results: 8,
        include_answer: true,
        include_domains: ["tiktok.com", "trendtok.com", "tokboard.com"],
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
        note: "TikTok API not configured; data from web search",
        answer: result.answer,
        results: (result.results || []).map((r: any) => ({
          title: r.title,
          url: r.url,
          content: r.content,
        })),
      };
    }
    return { error: "No TikTok API key or Tavily key configured." };
  }

  const baseUrl =
    env.TIKTOK_API_BASE_URL || "https://api.example.com/tiktok";
  const endpoint = hashtag ? `${baseUrl}/hashtag` : `${baseUrl}/search`;
  const body: Record<string, any> = { max_results };
  if (hashtag) body.hashtag = hashtag;
  else body.keyword = keyword;

  const result = await fetchWithTimeout(
    endpoint,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.TIKTOK_API_KEY}`,
      },
      body: JSON.stringify(body),
    },
    timeoutMs,
  );

  if (result.error) return result;

  return {
    source: "tiktok_api",
    total_views: result.total_views,
    video_count: result.video_count,
    engagement_rate: result.engagement_rate,
    top_videos: (result.videos || [])
      .slice(0, 5)
      .map((v: any) => ({
        description: v.description,
        views: v.views,
        likes: v.likes,
        has_product_link: v.has_product_link,
      })),
    trending_hashtags: result.trending_hashtags,
    aesthetic_themes: result.aesthetic_themes,
    viral_features: result.viral_features,
  };
}
