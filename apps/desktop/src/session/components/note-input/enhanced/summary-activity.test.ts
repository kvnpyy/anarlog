import { describe, expect, it } from "vitest";

import { summaryActivityStates } from "./summary-activity";

describe("summaryActivityStates", () => {
  it("starts by gathering the transcript", () => {
    expect(summaryActivityStates(true, false)).toEqual({
      gather: "active",
      shape: "queued",
      write: "queued",
    });
  });

  it("shapes the notes once the transcript is ready", () => {
    expect(summaryActivityStates(false, false)).toEqual({
      gather: "done",
      shape: "active",
      write: "queued",
    });
  });

  it("writes once summary text is arriving", () => {
    expect(summaryActivityStates(false, true)).toEqual({
      gather: "done",
      shape: "done",
      write: "active",
    });
  });
});
