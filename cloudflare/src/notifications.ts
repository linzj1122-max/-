import { Env } from "./types";
import { fetchWithTimeout, getTimeoutMs } from "./utils";

interface FeishuMessage {
  msg_type: string;
  content: Record<string, string>;
}

export async function sendFeishuMessage(
  webhookUrl: string,
  title: string,
  text: string,
  env: Env,
): Promise<any> {
  const timeoutMs = getTimeoutMs(env);

  const message: FeishuMessage = {
    msg_type: "interactive",
    content: {
      text: JSON.stringify({
        header: { title: { tag: "plain_text", content: title } },
        elements: [
          {
            tag: "markdown",
            content: text,
          },
        ],
      }),
    },
  };

  return fetchWithTimeout(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(message),
  }, timeoutMs);
}
