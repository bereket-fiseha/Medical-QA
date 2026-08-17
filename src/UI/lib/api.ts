import type { ChatApiRequest, ChatApiResponse } from "./types";

export async function sendChatMessage(req: ChatApiRequest): Promise<ChatApiResponse> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    let detail = "The server returned an error.";
    try { const err = await res.json(); detail = err.detail ?? detail; } catch { /* ignore */ }
    throw new Error(detail);
  }

  return res.json() as Promise<ChatApiResponse>;
}

export type WarmupStatus = "idle" | "warming" | "ready" | "timeout" | "error" | "degraded";
export interface WarmupResult { status: WarmupStatus; elapsed_ms?: number; detail?: string; }

export async function warmupTranslationServer(): Promise<WarmupResult> {
  try {
    const res = await fetch("/api/warmup", { method: "GET" });
    return await res.json() as WarmupResult;
  } catch {
    return { status: "error", detail: "Could not reach the MediAssist API." };
  }
}

export async function checkHealth(): Promise<boolean> {
  try { return (await fetch("/api/health")).ok; } catch { return false; }
}
