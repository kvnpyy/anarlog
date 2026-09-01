import { md2json, type JSONContent } from "@anlg/editor/markdown";

export function getStreamedEnhancePreview(
  streamedText: string,
): JSONContent | undefined {
  if (!streamedText.trim()) {
    return undefined;
  }

  return md2json(streamedText);
}
