import { describe, expect, it } from "vitest";

import {
  appendNoteAudienceGuidance,
  formatNoteAudienceGuidance,
  formatNoteAuthorLine,
  formatUserProfileGuidance,
  hasUserProfile,
  prependNoteAuthorToMemo,
  readUserProfile,
  renderUserProfileGuidance,
  userProfileInitials,
  userProfileSubtitle,
} from "./user-profile";

describe("user profile", () => {
  it("treats blank fields as empty", () => {
    expect(
      hasUserProfile(
        readUserProfile({
          user_profile_name: "  ",
          user_profile_role: "",
        }),
      ),
    ).toBe(false);
  });

  it("formats initials, subtitle, and prompt guidance", () => {
    const profile = readUserProfile({
      user_profile_name: "Kevin Payoyo",
      user_profile_role: "Product",
      user_profile_department: "Engineering",
      user_profile_context: "I work on the meeting notepad.",
    });

    expect(userProfileInitials(profile)).toBe("KP");
    expect(userProfileSubtitle(profile)).toBe("Product · Engineering");
    expect(renderUserProfileGuidance(profile)).toContain("Name: Kevin Payoyo");
    expect(formatUserProfileGuidance("Base prompt", profile)).toContain(
      "Base prompt",
    );
    expect(formatUserProfileGuidance("Base prompt", profile)).toContain(
      "Tailor answers, recaps, drafts, and summaries",
    );
    expect(formatUserProfileGuidance("Base prompt", profile)).toContain(
      "Match how they speak and write",
    );
    expect(formatNoteAudienceGuidance(profile)).toContain("# Note audience");
    expect(formatNoteAudienceGuidance(profile)).toContain("Role: Product");
    expect(appendNoteAudienceGuidance("Base prompt", profile)).toContain(
      "Base prompt",
    );
    expect(appendNoteAudienceGuidance("Base prompt", undefined)).toBe(
      "Base prompt",
    );
    expect(formatNoteAuthorLine(profile)).toBe(
      "Note author: Kevin Payoyo, Product · Engineering. I work on the meeting notepad.",
    );
    expect(prependNoteAuthorToMemo("Agenda: launch", profile)).toContain(
      "Agenda: launch",
    );
  });
});
