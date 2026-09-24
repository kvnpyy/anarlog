import { describe, expect, it } from "vitest";

import { chatActivityFromParts } from "./activity";

describe("chatActivityFromParts", () => {
  it("starts with thinking before any tool runs", () => {
    expect(chatActivityFromParts(undefined)).toEqual({
      steps: [{ id: "think", kind: "think", state: "active" }],
      sources: [],
    });
  });

  it("shows the running search and its query", () => {
    const activity = chatActivityFromParts([
      {
        type: "tool-web_search",
        toolCallId: "web-1",
        state: "input-available",
        input: { query: "  acorn pricing  " },
      },
    ]);

    expect(activity.steps).toEqual([
      {
        id: "web-1",
        kind: "tool",
        tool: "web_search",
        query: "acorn pricing",
        state: "active",
        failed: false,
      },
    ]);
    expect(activity.sources).toEqual([]);
  });

  it("keeps finished lookups and moves on to writing", () => {
    const activity = chatActivityFromParts([
      { type: "text", text: "Earlier", state: "done" },
      { type: "step-start" },
      {
        type: "tool-search_meetings",
        toolCallId: "search-1",
        state: "output-available",
        input: { query: "renewal" },
        output: {
          results: [{ title: "Renewal call" }, { title: "Renewal call" }],
        },
      },
    ]);

    expect(activity.steps.map((step) => step.kind)).toEqual(["tool", "write"]);
    expect(activity.steps[0]).toMatchObject({
      state: "done",
      query: "renewal",
      failed: false,
    });
    expect(activity.sources).toEqual([
      { id: "search-1:0", label: "Renewal call" },
    ]);
  });

  it("marks a failed tool without treating it as a source", () => {
    const activity = chatActivityFromParts([
      {
        type: "tool-search_contacts",
        toolCallId: "people-1",
        state: "output-error",
        input: { query: "Ada" },
      },
    ]);

    expect(activity.steps[0]).toMatchObject({ failed: true, state: "done" });
    expect(activity.steps[1]).toMatchObject({ kind: "write", state: "active" });
    expect(activity.sources).toEqual([]);
  });
});
