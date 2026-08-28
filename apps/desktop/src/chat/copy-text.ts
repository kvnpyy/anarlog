export function toCopyableChatText(text: string): string {
  let value = text.replace(/\r\n/g, "\n").trim();
  if (!value) {
    return "";
  }

  value = value.replace(/```(?:[a-zA-Z0-9_-]+)?\n?([\s\S]*?)```/g, "$1");
  value = value
    .replace(/\*\*\*(.+?)\*\*\*/g, "$1")
    .replace(/___(.+?)___/g, "$1")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/(^|[^*])\*(?!\*)([^*\n]+)\*(?!\*)/g, "$1$2")
    .replace(/(^|[^_])_(?!_)([^_\n]+)_(?!_)/g, "$1$2")
    .replace(/^#{1,6}\s+/gm, "");

  return value.replace(/\n{3,}/g, "\n\n").trim();
}
