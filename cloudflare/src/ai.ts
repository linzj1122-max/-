import { Env } from "./types";
import { fetchWithTimeout, getTimeoutMs } from "./utils";

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

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function chatWithAI(
  messages: ChatMessage[],
  env: Env,
): Promise<string> {
  const timeoutMs = getTimeoutMs(env);

  const fullMessages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...messages,
  ];

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
          messages: fullMessages,
          temperature: 0.2,
        }),
      },
      timeoutMs,
    );
    if (result.error) {
      throw new Error(`Bailian API error: ${result.error}`);
    }
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
          messages: fullMessages,
          temperature: 0.2,
        }),
      },
      timeoutMs,
    );
    if (result.error) {
      throw new Error(`OpenAI API error: ${result.error}`);
    }
    return result.choices?.[0]?.message?.content || "";
  }

  throw new Error(
    "No AI API key configured. Set BAILIAN_API_KEY or OPENAI_API_KEY.",
  );
}
