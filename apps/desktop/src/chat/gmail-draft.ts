export const GMAIL_TEXT_FONT = "Arial, Helvetica, sans-serif";
export const GMAIL_TEXT_SIZE = "13px";
export const GMAIL_TEXT_COLOR = "#222222";
export const GMAIL_LINE_HEIGHT = "1.5";
export const GMAIL_COMPOSE_URL_MAX = 1800;

const GMAIL_TEXT_STYLE = `font-family:${GMAIL_TEXT_FONT};font-size:${GMAIL_TEXT_SIZE};color:${GMAIL_TEXT_COLOR};line-height:${GMAIL_LINE_HEIGHT}`;

export function isEmailDraft(text: string): boolean {
  return /^\s*subject\s*:/im.test(text);
}

export function splitEmailDraft(text: string): {
  subject: string | null;
  body: string;
} {
  const value = text.replace(/\r\n/g, "\n").trim();
  const match = value.match(/^subject\s*:\s*(.*)$/im);
  if (!match || match.index === undefined) {
    return { subject: null, body: value };
  }

  const subject = (match[1] ?? "").trim();
  const afterSubject = value
    .slice(match.index + match[0].length)
    .replace(/^\n+/, "");

  return {
    subject: subject || null,
    body: afterSubject.trim(),
  };
}

export function toGmailCopyHtml(text: string): string {
  const { body } = splitEmailDraft(text);
  return `<div style="${GMAIL_TEXT_STYLE}">${markdownToGmailHtml(body)}</div>`;
}

export function toGmailCopyPlainText(text: string): string {
  const { body } = splitEmailDraft(text);
  return body;
}

export function toGmailComposeUrl(text: string): {
  url: string;
  includesBody: boolean;
} {
  const { subject, body } = splitEmailDraft(text);
  const params = new URLSearchParams();
  if (subject) {
    params.set("su", subject);
  }

  const compose = (query: URLSearchParams) => {
    const encoded = query.toString();
    return encoded
      ? `https://mail.google.com/mail/?view=cm&fs=1&tf=1&${encoded}`
      : "https://mail.google.com/mail/?view=cm&fs=1&tf=1";
  };

  if (body) {
    params.set("body", body);
    const withBody = compose(params);
    if (withBody.length <= GMAIL_COMPOSE_URL_MAX) {
      return { url: withBody, includesBody: true };
    }
    params.delete("body");
  }

  return { url: compose(params), includesBody: false };
}

function markdownToGmailHtml(markdown: string): string {
  const blocks = splitBlocks(markdown);
  return blocks.map(blockToHtml).join("");
}

function splitBlocks(markdown: string): string[] {
  const normalized = markdown.replace(/\n{3,}/g, "\n\n").trim();
  if (!normalized) {
    return [];
  }

  const blocks: string[] = [];
  let current: string[] = [];
  let inList = false;

  for (const line of normalized.split("\n")) {
    const isListItem = /^\s*(?:[-*+]|\d+\.)\s+/.test(line);
    if (isListItem) {
      if (!inList && current.length > 0) {
        blocks.push(current.join("\n"));
        current = [];
      }
      inList = true;
      current.push(line);
      continue;
    }

    if (inList) {
      blocks.push(current.join("\n"));
      current = [];
      inList = false;
    }

    if (line.trim() === "") {
      if (current.length > 0) {
        blocks.push(current.join("\n"));
        current = [];
      }
      continue;
    }

    current.push(line);
  }

  if (current.length > 0) {
    blocks.push(current.join("\n"));
  }

  return blocks;
}

function blockToHtml(block: string): string {
  const lines = block.split("\n");
  const isUnordered = lines.every((line) => /^\s*[-*+]\s+/.test(line));
  const isOrdered = lines.every((line) => /^\s*\d+\.\s+/.test(line));

  if (isUnordered || isOrdered) {
    const tag = isOrdered ? "ol" : "ul";
    const items = lines
      .map((line) => {
        const text = line.replace(/^\s*(?:[-*+]|\d+\.)\s+/, "");
        return `<li>${inlineToHtml(text)}</li>`;
      })
      .join("");
    return `<${tag} style="margin:0 0 12px 0;padding-left:24px">${items}</${tag}>`;
  }

  return `<div style="margin:0 0 12px 0">${inlineToHtml(block.replace(/\n/g, "<br>"))}</div>`;
}

function inlineToHtml(text: string): string {
  const escaped = escapeHtml(text);
  return escaped
    .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
    .replace(/__(.+?)__/g, "<b>$1</b>");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
