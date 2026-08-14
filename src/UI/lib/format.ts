/**
 * Lightweight markdown-ish formatter for assistant responses.
 * Handles bold, italic, bullet lists, ordered lists, and the medical disclaimer.
 * Returns an HTML string — rendered via dangerouslySetInnerHTML inside a sanitised bubble.
 */

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface FormattedMessage {
  bodyHtml: string;
  disclaimer: string | null;
}

const DISCLAIMER_RE =
  /\n*[⚕️🏥]*\s*\*?(This information is for educational purposes only[^*\n]*)\*?/i;

export function formatAssistantText(raw: string): FormattedMessage {
  let text = raw;
  let disclaimer: string | null = null;

  const match = text.match(DISCLAIMER_RE);
  if (match) {
    disclaimer = match[1].trim();
    text = text.replace(DISCLAIMER_RE, "").trim();
  }

  let html = escapeHtml(text);

  // Bold **text**
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  // Italic *text* or _text_
  html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "<em>$1</em>");
  html = html.replace(/_(.+?)_/g, "<em>$1</em>");

  const lines = html.split("\n");
  let result = "";
  let inUl = false;
  let inOl = false;

  for (const line of lines) {
    const bullet = line.match(/^[\-•]\s+(.+)/);
    const ordered = line.match(/^\d+\.\s+(.+)/);

    if (bullet) {
      if (inOl) { result += "</ol>"; inOl = false; }
      if (!inUl) { result += '<ul class="list-disc pl-5 space-y-1 my-2">'; inUl = true; }
      result += `<li>${bullet[1]}</li>`;
    } else if (ordered) {
      if (inUl) { result += "</ul>"; inUl = false; }
      if (!inOl) { result += '<ol class="list-decimal pl-5 space-y-1 my-2">'; inOl = true; }
      result += `<li>${ordered[1]}</li>`;
    } else {
      if (inUl) { result += "</ul>"; inUl = false; }
      if (inOl) { result += "</ol>"; inOl = false; }
      if (line.trim() === "") {
        result += "<br/>";
      } else {
        result += `<p class="mb-2 last:mb-0">${line}</p>`;
      }
    }
  }
  if (inUl) result += "</ul>";
  if (inOl) result += "</ol>";

  return { bodyHtml: result, disclaimer };
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
