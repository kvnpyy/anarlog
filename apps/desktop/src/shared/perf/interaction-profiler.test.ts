import { describe, expect, it } from "vitest";

import { perfEventTargetLabel } from "./interaction-profiler";

describe("perfEventTargetLabel", () => {
  it("labels element targets without exposing the DOM node", () => {
    const button = document.createElement("button");

    expect(perfEventTargetLabel(button)).toBe("button");
  });

  it("ignores non-element targets", () => {
    expect(perfEventTargetLabel(window)).toBeUndefined();
    expect(perfEventTargetLabel(null)).toBeUndefined();
  });
});
