import { describe, expect, it } from "vitest";

import {
  formatInviteAttendee,
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

  it("reads dotted, underscored, and hyphenated email locals as names", () => {
    expect(formatInviteAttendee({ email: "jane.doe@acme.com" })).toBe(
      "Jane Doe <jane.doe@acme.com>",
    );
    expect(formatInviteAttendee({ email: "jane_doe@acme.com" })).toBe(
      "Jane Doe <jane_doe@acme.com>",
    );
    expect(formatInviteAttendee({ email: "jane-doe@acme.com" })).toBe(
      "Jane Doe <jane-doe@acme.com>",
    );
    expect(formatInviteAttendee({ email: "j.doe@acme.com" })).toBe(
      "J Doe <j.doe@acme.com>",
    );
    expect(formatInviteAttendee({ email: "firstname.lastname@acme.com" })).toBe(
      "Firstname Lastname <firstname.lastname@acme.com>",
    );
  });

  it("keeps a compact email beside the invite name and flags a conflicting reading", () => {
    expect(
      formatInviteAttendee({
        name: "Nick July",
        email: "njuly@shoesforcrews.com",
      }),
    ).toBe("Nick July <njuly@shoesforcrews.com>");
    expect(
      formatInviteAttendee({
        name: "Nick Julie",
        email: "nick.july@shoesforcrews.com",
      }),
    ).toBe("Nick Julie <nick.july@shoesforcrews.com> (email reads Nick July)");
  });

  it("does not turn a role address into a person", () => {
    expect(formatInviteAttendee({ email: "info@acme.com" })).toBe(
      "info@acme.com",
    );
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
