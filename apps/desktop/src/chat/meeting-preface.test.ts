import { describe, expect, it } from "vitest";

import {
  buildIdentityCard,
  draftAddressesSender,
  draftUsesOtherPartyVoice,
  questionNeedsAccountHistory,
} from "./meeting-preface";

describe("meeting identity", () => {
  it("names the sender and keeps invite spellings", () => {
    const card = buildIdentityCard({
      senderName: "Kevin Payoyo",
      attendees: [
        { name: "Kevin Payoyo", email: "kevin@yotpo.com" },
        { name: "Nick Julie", email: "nick.july@shoesforcrews.com" },
        { name: "Nichole", email: "nichole@shoesforcrews.com" },
      ],
    });

    expect(card).toContain("Sender: Kevin Payoyo");
    expect(card).toContain("email reads Nick July");
    expect(card).toContain("Nichole <nichole@shoesforcrews.com>");
    expect(card).not.toContain("kevin@yotpo.com");
    expect(card).toContain('mean "you" and "your"');
  });

  it("loads earlier calls for coaching and deal reviews", () => {
    expect(
      questionNeedsAccountHistory("How did I do from a sales perspective?"),
    ).toBe(true);
    expect(questionNeedsAccountHistory("full meddpicc for Bonobos")).toBe(true);
    expect(questionNeedsAccountHistory("What time is it?")).toBe(false);
  });

  it("catches a follow-up that copies the customer's we", () => {
    const transcript = [
      "You: I'll send the pricing Thursday.",
      "Nichole: We need this live December 7.",
    ].join("\n");

    expect(
      draftUsesOtherPartyVoice(
        "Hi Nichole,\n\nWe need this live December 7.",
        transcript,
        "Kevin Payoyo",
      ),
    ).toBe(true);
    expect(
      draftUsesOtherPartyVoice(
        "Hi Nichole,\n\nYou need this live December 7. I'll send pricing Thursday.",
        transcript,
        "Kevin Payoyo",
      ),
    ).toBe(false);
  });

  it("catches a follow-up written to the sender", () => {
    expect(
      draftAddressesSender(
        "Subject: Thanks for the demo\n\nHi Kevin,\n\nWe need this live December 7.",
        "Kevin Payoyo",
      ),
    ).toBe(true);
    expect(
      draftAddressesSender(
        "Subject: ShoesForCrews next steps\n\nHi Nichole,\n\nI'll send pricing Thursday.",
        "Kevin Payoyo",
      ),
    ).toBe(false);
  });
});
