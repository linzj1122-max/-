import { Env } from "./types";

export class ResearchError extends Error {
  constructor(
    message: string,
    public status: number = 500,
  ) {
    super(message);
    this.name = "ResearchError";
  }
}

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

export function errorResponse(message: string, status = 500): Response {
  return jsonResponse({ error: message }, status);
}

export function authenticate(request: Request, env: Env): boolean {
  const auth = request.headers.get("Authorization");
  if (!auth) return false;
  const token = auth.replace("Bearer ", "");
  return token === env.GATEWAY_TOKEN;
}

export async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number,
): Promise<any> {
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
      return { error: `Request timed out after ${timeoutMs / 1000}s` };
    }
    return { error: `Request failed: ${err.message}` };
  }
}

export function getTimeoutMs(env: Env): number {
  return (parseInt(env.DEFAULT_TIMEOUT_SECONDS || "30") || 30) * 1000;
}

export function getMinPositiveSignals(env: Env): number {
  return parseInt(env.MIN_POSITIVE_SIGNALS || "3") || 3;
}
