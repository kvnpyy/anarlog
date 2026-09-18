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

  it("keeps customer meetings out of internal teammate folders", () => {
    const suggestions = suggestSmartFolders(
      [
        session({ id: "customer", title: "Check-in" }),
        session({ id: "internal", title: "Standup" }),
        session({ id: "internal-2", title: "Standup" }),
        session({ id: "customer-2", title: "Pricing" }),
      ],
      [
        participant({
          sessionId: "customer",
          humanId: "bob",
          name: "Bob",
          email: "bob@acme.com",
        }),
        participant({
          sessionId: "customer",
          humanId: "ada",
          name: "Ada",
          email: "ada@contoso.com",
          organizationName: "Contoso",
        }),
        participant({
          sessionId: "customer-2",
          humanId: "bob",
          name: "Bob",
          email: "bob@acme.com",
        }),
        participant({
          sessionId: "customer-2",
          humanId: "ada",
          name: "Ada",
          email: "ada@contoso.com",
          organizationName: "Contoso",
        }),
        participant({
          sessionId: "internal",
          humanId: "bob",
          name: "Bob",
          email: "bob@acme.com",
        }),
        participant({
          sessionId: "internal",
          humanId: "lin",
          name: "Lin",
          email: "lin@acme.com",
        }),
        participant({
          sessionId: "customer",
          humanId: "user-1",
          name: "Me",
          email: "me@acme.com",
        }),
        participant({
          sessionId: "customer-2",
          humanId: "user-1",
          name: "Me",
          email: "me@acme.com",
        }),
        participant({
          sessionId: "internal-2",
          humanId: "bob",
          name: "Bob",
          email: "bob@acme.com",
        }),
        participant({
          sessionId: "internal-2",
          humanId: "lin",
          name: "Lin",
          email: "lin@acme.com",
        }),
        participant({
          sessionId: "internal",
          humanId: "user-1",
          name: "Me",
          email: "me@acme.com",
        }),
        participant({
          sessionId: "internal-2",
          humanId: "user-1",
          name: "Me",
          email: "me@acme.com",
        }),
      ],
      "user-1",
      "me@acme.com",
    );

    const customer = suggestions.find((item) =>
      item.sessionIds.includes("customer"),
    );
    const internal = suggestions.find((item) =>
      item.sessionIds.includes("internal"),
    );
    expect(customer?.sessionIds).toEqual(
      expect.arrayContaining(["customer", "customer-2"]),
    );
    expect(customer?.sessionIds).not.toContain("internal");
    expect(customer?.name).toMatch(/Contoso/);
    expect(internal?.sessionIds).toEqual(
      expect.arrayContaining(["internal", "internal-2"]),
    );
    expect(internal?.sessionIds).not.toContain("customer");
    expect(internal?.name).toMatch(/Internal/);
  });

  it("names customer folders from the company and what was discussed", () => {
    const suggestions = suggestSmartFolders(
      [
        session({
          id: "a",
          title: "Check-in",
          discussed: "Q3 pricing",
        }),
        session({
          id: "b",
          title: "Follow-up",
          discussed: "Q3 pricing",
        }),
      ],
      [
        participant({
          sessionId: "a",
          humanId: "ada",
          name: "Ada",
          email: "ada@northwind.com",
          organizationName: "Northwind",
        }),
        participant({
          sessionId: "b",
          humanId: "ada",
          name: "Ada",
          email: "ada@northwind.com",
          organizationName: "Northwind",
        }),
      ],
      "user-1",
      "me@acme.com",
    );

    expect(suggestions[0]).toMatchObject({
      name: "Northwind · Q3 pricing",
      reason: "shared_participants",
      sessionIds: expect.arrayContaining(["a", "b"]),
    });
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
