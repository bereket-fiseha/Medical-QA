import type { ChatApiRequest, ChatApiResponse } from "./types";

/**
 * Sends a chat message through the Next.js rewrite proxy → FastAPI backend.
 * The /api/* prefix is rewritten to FASTAPI_URL in next.config.ts.
 */
export async function sendChatMessage(
  req: ChatApiRequest
): Promise<ChatApiResponse> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    let detail = "The server returned an error.";
    try {
      const err = await res.json();
      detail = err.detail ?? detail;
    } catch {
      // ignore parse error
    }
    throw new Error(detail);
  }

  return res.json() as Promise<ChatApiResponse>;
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch("/api/health", { method: "GET" });
    return res.ok;
  } catch {
    return false;
  }
}
