import type { JSONContent } from "@anlg/editor/chat";

import type { AnlgUIMessage } from "~/chat/types";

const MAX_ATTACHED_TEXT_CHARS = 80_000;

const TEXT_EXTENSIONS = new Set([
  "txt",
  "md",
  "markdown",
  "csv",
  "tsv",
  "json",
  "jsonl",
  "xml",
  "yaml",
  "yml",
  "html",
  "css",
  "js",
  "jsx",
  "ts",
  "tsx",
  "py",
  "rb",
  "go",
  "rs",
  "java",
  "kt",
  "swift",
  "sql",
  "sh",
  "log",
]);

const TEXT_MIME_TYPES = new Set([
  "application/json",
  "application/ld+json",
  "application/xml",
  "application/javascript",
  "application/x-javascript",
  "application/typescript",
  "application/x-yaml",
  "application/yaml",
  "application/csv",
  "application/sql",
]);

export type DraftAttachment = {
  name: string;
  mimeType: string;
  url: string;
};

export function attachmentsFromEditorJson(
  json: JSONContent | undefined,
): DraftAttachment[] {
  const attachments: DraftAttachment[] = [];

  const visit = (node: JSONContent | undefined) => {
    if (!node || typeof node !== "object") {
      return;
    }

    if (node.type === "attachment") {
      const url = typeof node.attrs?.url === "string" ? node.attrs.url : "";
      if (url.startsWith("data:")) {
        const name =
          typeof node.attrs?.name === "string" ? node.attrs.name.trim() : "";
        attachments.push({
          name: name || "Attachment",
          mimeType:
            typeof node.attrs?.mimeType === "string" ? node.attrs.mimeType : "",
          url,
        });
      }
    }

    if (Array.isArray(node.content)) {
      for (const child of node.content) {
        visit(child);
      }
    }
  };

  visit(json);
  return attachments;
}

export function messagePartsFromDraft(
  text: string,
  attachments: DraftAttachment[],
): AnlgUIMessage["parts"] {
  const parts: AnlgUIMessage["parts"] = [];
  const trimmed = text.trim();
  if (trimmed) {
    parts.push({ type: "text", text: trimmed });
  }

  for (const attachment of attachments) {
    const textBody = isTextAttachment(attachment)
      ? textFromDataUrl(attachment.url)
      : null;
    if (textBody != null && !textBody.includes("\u0000")) {
      parts.push({
        type: "text",
        text: formatAttachedFileText(attachment.name, textBody),
      });
      continue;
    }

    parts.push({
      type: "file",
      mediaType: attachment.mimeType || "application/octet-stream",
      filename: attachment.name,
      url: attachment.url,
    });
  }

  return parts;
}

export function draftLabel(
  text: string,
  attachments: DraftAttachment[],
): string {
  const trimmed = text.trim();
  if (trimmed) {
    return trimmed;
  }

  return attachments.map((attachment) => attachment.name).join(", ");
}

export function parseAttachedFileText(
  text: string,
): { name: string; body: string } | null {
  const match = /^Attached file "([^"]+)":\n([\s\S]*)$/.exec(text);
  if (!match?.[1]) {
    return null;
  }

  return { name: match[1], body: match[2] ?? "" };
}

function formatAttachedFileText(name: string, body: string): string {
  const safeName = name.split('"').join("'") || "Attachment";
  const clipped =
    body.length > MAX_ATTACHED_TEXT_CHARS
      ? `${body.slice(0, MAX_ATTACHED_TEXT_CHARS)}\n[truncated]`
      : body;
  return `Attached file "${safeName}":\n${clipped}`;
}

function isTextAttachment(attachment: DraftAttachment): boolean {
  const mimeType = attachment.mimeType.toLowerCase();
  if (mimeType.startsWith("image/") || mimeType === "application/pdf") {
    return false;
  }
  if (mimeType.startsWith("text/") || TEXT_MIME_TYPES.has(mimeType)) {
    return true;
  }

  const extension = attachment.name.split(".").pop()?.toLowerCase() ?? "";
  return TEXT_EXTENSIONS.has(extension);
}

function textFromDataUrl(url: string): string | null {
  const comma = url.indexOf(",");
  if (!url.startsWith("data:") || comma === -1) {
    return null;
  }

  const meta = url.slice(5, comma);
  const body = url.slice(comma + 1);
  try {
    if (meta.includes(";base64")) {
      const binary = atob(body);
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      return new TextDecoder().decode(bytes);
    }
    return decodeURIComponent(body);
  } catch {
    return null;
  }
}
