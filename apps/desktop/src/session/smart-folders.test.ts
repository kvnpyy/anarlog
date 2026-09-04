import { describe, expect, it } from "vitest";

import { folderMatchesPath } from "./folders";
import {
  sessionSeriesId,
  sessionTitleKey,
  suggestSmartFolders,
  type SmartFolderParticipant,
  type SmartFolderSession,
} from "./smart-folders";

function session(
  overrides: Partial<SmartFolderSession> & Pick<SmartFolderSession, "id">,
): SmartFolderSession {
  return {
    title: "Untitled",
    folderPath: "",
    seriesId: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    ownerUserId: "user-1",
    eventJson: "",
    ...overrides,
  };
}

function participant(
  overrides: Partial<SmartFolderParticipant> &
    Pick<SmartFolderParticipant, "sessionId" | "humanId">,
): SmartFolderParticipant {
  return {
    source: "auto",
    name: overrides.humanId,
    email: "",
    organizationName: "",
    ...overrides,
  };
}

describe("suggestSmartFolders", () => {
  it("groups unfiled recurring meetings and names the folder from the title", () => {
    const suggestions = suggestSmartFolders(
      [
        session({
          id: "a",
          title: "Weekly standup",
          seriesId: "series-1",
          createdAt: "2026-03-01T00:00:00.000Z",
        }),
        session({
          id: "b",
          title: "Weekly standup",
          seriesId: "series-1",
          createdAt: "2026-03-08T00:00:00.000Z",
        }),
        session({
          id: "filed",
          title: "Weekly standup",
          seriesId: "series-1",
          folderPath: "Engineering",
        }),
      ],
      [],
      "user-1",
    );

    expect(suggestions).toEqual([
      expect.objectContaining({
        name: "Weekly standup",
        reason: "same_series",
        sessionIds: ["b", "a"],
      }),
    ]);
  });

  it("groups same-title meetings that share people", () => {
    const suggestions = suggestSmartFolders(
      [
        session({ id: "a", title: "Acme intro" }),
        session({ id: "b", title: "Acme intro" }),
        session({ id: "c", title: "Acme intro" }),
      ],
      [
        participant({ sessionId: "a", humanId: "alice", name: "Alice" }),
        participant({ sessionId: "b", humanId: "alice", name: "Alice" }),
        participant({ sessionId: "c", humanId: "bob", name: "Bob" }),
      ],
      "user-1",
    );

    expect(suggestions).toEqual([
      expect.objectContaining({
        name: "Acme intro",
        reason: "matching_title",
        sessionIds: expect.arrayContaining(["a", "b"]),
      }),
    ]);
    expect(suggestions[0]?.sessionIds).not.toContain("c");
  });

  it("names a people cluster from a shared company or email domain", () => {
    const orgSuggestions = suggestSmartFolders(
      [
        session({ id: "a", title: "Check-in" }),
        session({ id: "b", title: "Pricing" }),
      ],
      [
        participant({
          sessionId: "a",
          humanId: "ada",
          name: "Ada",
          organizationName: "Northwind",
        }),
        participant({
          sessionId: "a",
          humanId: "lin",
          name: "Lin",
          organizationName: "Northwind",
        }),
        participant({
          sessionId: "b",
          humanId: "ada",
          name: "Ada",
          organizationName: "Northwind",
        }),
        participant({
          sessionId: "b",
          humanId: "lin",
          name: "Lin",
          organizationName: "Northwind",
        }),
      ],
      "user-1",
    );

    expect(orgSuggestions[0]).toMatchObject({
      name: "Northwind",
      reason: "shared_participants",
      sessionIds: expect.arrayContaining(["a", "b"]),
    });

    const domainSuggestions = suggestSmartFolders(
      [
        session({ id: "a", title: "Intro" }),
        session({ id: "b", title: "Follow-up" }),
      ],
      [
        participant({
          sessionId: "a",
          humanId: "ada",
          name: "Ada",
          email: "ada@contoso.com",
        }),
        participant({
          sessionId: "a",
          humanId: "lin",
          name: "Lin",
          email: "lin@contoso.com",
        }),
        participant({
          sessionId: "b",
          humanId: "ada",
          name: "Ada",
          email: "ada@contoso.com",
        }),
        participant({
          sessionId: "b",
          humanId: "lin",
          name: "Lin",
          email: "lin@contoso.com",
        }),
      ],
      "user-1",
    );

    expect(domainSuggestions[0]?.name).toBe("Contoso");
  });

  it("names 1:1 clusters after the other person", () => {
    const suggestions = suggestSmartFolders(
      [
        session({ id: "a", title: "Chat" }),
        session({ id: "b", title: "Sync" }),
      ],
      [
        participant({ sessionId: "a", humanId: "maya", name: "Maya Chen" }),
        participant({ sessionId: "b", humanId: "maya", name: "Maya Chen" }),
        participant({ sessionId: "a", humanId: "user-1", name: "Me" }),
        participant({ sessionId: "b", humanId: "user-1", name: "Me" }),
      ],
      "user-1",
    );

    expect(suggestions).toEqual([
      expect.objectContaining({
        name: "Meetings with Maya Chen",
        reason: "shared_participants",
        sessionIds: expect.arrayContaining(["a", "b"]),
      }),
    ]);
  });

  it("ignores generic titles and already filed notes", () => {
    expect(
      suggestSmartFolders(
        [
          session({ id: "a", title: "Untitled" }),
          session({ id: "b", title: "New note" }),
        ],
        [
          participant({ sessionId: "a", humanId: "alice" }),
          participant({ sessionId: "b", humanId: "alice" }),
        ],
        "user-1",
      )[0]?.reason,
    ).toBe("shared_participants");

    expect(
      suggestSmartFolders(
        [
          session({
            id: "a",
            title: "Weekly standup",
            seriesId: "series-1",
            folderPath: "Standups",
          }),
          session({
            id: "b",
            title: "Weekly standup",
            seriesId: "series-1",
            folderPath: "Standups",
          }),
        ],
        [],
        "user-1",
      ),
    ).toEqual([]);
  });
});

describe("session series and title keys", () => {
  it("reads a series id from the session column or event json", () => {
    expect(sessionSeriesId({ seriesId: "series-1", eventJson: "" })).toBe(
      "series-1",
    );
    expect(
      sessionSeriesId({
        seriesId: "",
        eventJson: JSON.stringify({ recurrence_series_id: "series-2" }),
      }),
    ).toBe("series-2");
  });

  it("treats untitled notes as having no title key", () => {
    expect(sessionTitleKey("Weekly standup")).toBe("weekly standup");
    expect(sessionTitleKey("Untitled")).toBe("");
    expect(sessionTitleKey("new note")).toBe("");
  });
});

describe("folderMatchesPath", () => {
  it("matches stored nested paths to the selected top-level folder", () => {
    expect(folderMatchesPath("work/meetings", "work")).toBe(true);
    expect(folderMatchesPath("work", "personal")).toBe(false);
    expect(folderMatchesPath("", "work")).toBe(false);
  });
});
