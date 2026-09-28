import { describe, expect, it } from "vitest";

import {
  mentionsAccount,
  questionNeedsSmarterModel,
  textFromUiMessage,
} from "./analysis";

describe("deal analysis helpers", () => {
  it("routes named sales frameworks to the smarter model", () => {
    expect(
      questionNeedsSmarterModel("give me a full meddpic for the bonobos deal"),
    ).toBe(true);
    expect(questionNeedsSmarterModel("Who is the economic buyer?")).toBe(true);
    expect(questionNeedsSmarterModel("What did Frank say about pricing?")).toBe(
      false,
    );
  });

  it("matches an account name without prefix collisions", () => {
    expect(mentionsAccount("Bonobos loyalty program", "Bonobos")).toBe(true);
    expect(
      mentionsAccount("Expression Fiber Arts founder travel", "Express"),
    ).toBe(false);
    expect(mentionsAccount("Express Men assortment", "Express")).toBe(true);
  });

  it("reads text parts from a chat message", () => {
    expect(
      textFromUiMessage({
        parts: [
          { type: "text", text: "MEDDPICC" },
          { type: "tool", text: "ignored" },
        ],
      }),
    ).toBe("MEDDPICC");
  });
});
