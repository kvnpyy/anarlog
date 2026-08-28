import { describe, expect, it, vi } from "vitest";

import { getStreamedEnhancePreview } from "./stream-preview";

vi.mock("@anlg/editor/markdown", () => ({
  md2json: (markdown: string) => ({
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: markdown }] },
    ],
  }),
}));

describe("getStreamedEnhancePreview", () => {
  it("returns nothing until streamed text arrives", () => {
    expect(getStreamedEnhancePreview("")).toBeUndefined();
    expect(getStreamedEnhancePreview("   ")).toBeUndefined();
  });

  it("converts streamed markdown into editor content", () => {
    expect(getStreamedEnhancePreview("Hello")).toEqual({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Hello" }] },
      ],
    });
  });
});
