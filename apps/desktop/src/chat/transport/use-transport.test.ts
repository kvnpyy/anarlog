import { describe, expect, it } from "vitest";

import {
  appendAiKnowledgeWindowGuidance,
  appendGlobalAskToolGuidance,
  appendLiveAskToolGuidance,
  appendMeetingContextToolGuidance,
  omitLiveAskTools,
} from "./use-transport";

describe("chat transport prompt guidance", () => {
  it("tells chat to use typed meeting search tools", () => {
    const prompt = appendMeetingContextToolGuidance("Base prompt");

    expect(prompt).toContain("Base prompt");
    expect(prompt).toContain("Use list_meetings");
    expect(prompt).toContain("Use search_meetings");
    expect(prompt).toContain("Use search_meeting_content");
    expect(prompt).toContain("use get_meeting");
    expect(prompt).toContain("Use get_meeting_transcript");
    expect(prompt).toContain("Use get_recurring_meeting_history");
    expect(prompt).toContain("Use typed meeting tools");
    expect(prompt).toContain("Do not ask the user to open or share a meeting");
    expect(prompt).toContain("call edit_memo");
    expect(prompt).toContain("Use edit_memo even when the memo is empty");
    expect(prompt).toContain("do not use edit_summary for meeting preparation");
    expect(prompt).toContain("call edit_summary");
    expect(prompt).toContain("complete replacement markdown");
    expect(prompt).toContain(
      "Use apply_session_correction for narrow exact old-to-new corrections and edit_summary for broader summary rewrites",
    );
    expect(prompt).toContain("call move_meeting_contents");
    expect(prompt).toContain("Do not guess IDs");
    expect(prompt).toContain(
      "Use edit_summary only for existing generated post-meeting summaries",
    );
    expect(prompt).toContain(
      "Do not return the rewrite only as a fenced markdown block",
    );
    expect(prompt).toContain("write plain text only");
    expect(prompt).toContain("copy-paste into Gmail");
    expect(prompt).toContain("Write in the user's voice");
    expect(prompt).toContain("Avoid obvious AI writing");
    expect(prompt).not.toContain("grep_notes");
    expect(prompt).not.toContain("search_sessions");
    expect(prompt).not.toContain("read_note");
    expect(prompt).not.toContain("read_current_note");
  });

  it("tells workspace Ask to search across all meetings", () => {
    const prompt = appendGlobalAskToolGuidance(
      appendMeetingContextToolGuidance("Base prompt"),
    );

    expect(prompt).toContain("Base prompt");
    expect(prompt).toContain("No specific meeting is attached");
    expect(prompt).toContain(
      "Search across meetings in the AI knowledge window",
    );
    expect(prompt).toContain("Prefer search_meetings");
  });

  it("tells live Ask to answer in the rail instead of opening editors", () => {
    const prompt = appendLiveAskToolGuidance(
      appendMeetingContextToolGuidance("Base prompt"),
    );

    expect(prompt).toContain("Base prompt");
    expect(prompt).toContain("Reply only in this chat");
    expect(prompt).toContain("Do not call edit_memo");
    expect(prompt).toContain("Keep answers short");
  });

  it("tells the model about the Free 30-day AI window", () => {
    const prompt = appendAiKnowledgeWindowGuidance("Base prompt", {
      days: 30,
      isPro: false,
    });

    expect(prompt).toContain("last 30 days");
    expect(prompt).toContain("Acorn Pro remembers 365 days");
  });

  it("omits note-editing tools while Live Ask is active", () => {
    const tools = omitLiveAskTools({
      search_meetings: {},
      edit_memo: {},
      edit_summary: {},
      apply_session_correction: {},
      move_meeting_contents: {},
    });

    expect(tools).toHaveProperty("search_meetings");
    expect(tools).not.toHaveProperty("edit_memo");
    expect(tools).not.toHaveProperty("edit_summary");
    expect(tools).not.toHaveProperty("apply_session_correction");
    expect(tools).not.toHaveProperty("move_meeting_contents");
  });
});
