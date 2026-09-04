import { describe, expect, it } from "vitest";

import {
  isPageChatThreadCollapsed,
  isPageIntegratedChat,
  shouldCollapsePageChatOnNoteClick,
  shouldExpandPageChatOnComposerClick,
  shouldShowPersistentChatOverlay,
} from "./page-integrated";

describe("shouldShowPersistentChatOverlay", () => {
  it("keeps Ask on notes and the empty home", () => {
    expect(shouldShowPersistentChatOverlay({ type: "sessions" })).toBe(true);
    expect(shouldShowPersistentChatOverlay({ type: "empty" })).toBe(true);
  });

  it("hides Ask on settings and other app pages", () => {
    expect(shouldShowPersistentChatOverlay({ type: "settings" })).toBe(false);
    expect(shouldShowPersistentChatOverlay({ type: "calendar" })).toBe(false);
    expect(shouldShowPersistentChatOverlay({ type: "contacts" })).toBe(false);
    expect(shouldShowPersistentChatOverlay({ type: "templates" })).toBe(false);
    expect(shouldShowPersistentChatOverlay({ type: "automations" })).toBe(
      false,
    );
    expect(shouldShowPersistentChatOverlay({ type: "changelog" })).toBe(false);
    expect(shouldShowPersistentChatOverlay({ type: "onboarding" })).toBe(false);
    expect(shouldShowPersistentChatOverlay(null)).toBe(false);
  });
});

describe("isPageIntegratedChat", () => {
  it("keeps the notepad-page composer until a conversation exists", () => {
    expect(
      isPageIntegratedChat({
        mode: "FloatingClosed",
        messageCount: 0,
        status: "ready",
      }),
    ).toBe(true);
    expect(
      isPageIntegratedChat({
        mode: "FloatingOpen",
        messageCount: 0,
        status: "ready",
      }),
    ).toBe(true);
  });

  it("switches to a chat panel once a conversation is happening", () => {
    expect(
      isPageIntegratedChat({
        mode: "FloatingOpen",
        messageCount: 1,
        status: "ready",
      }),
    ).toBe(false);
    expect(
      isPageIntegratedChat({
        mode: "FloatingOpen",
        messageCount: 0,
        status: "submitted",
      }),
    ).toBe(false);
    expect(
      isPageIntegratedChat({
        mode: "FloatingOpen",
        messageCount: 0,
        status: "streaming",
      }),
    ).toBe(false);
  });

  it("keeps a note conversation on the page instead of lifting a card", () => {
    expect(
      isPageIntegratedChat({
        mode: "FloatingOpen",
        messageCount: 2,
        status: "ready",
        tabType: "sessions",
      }),
    ).toBe(true);
    expect(
      isPageIntegratedChat({
        mode: "FloatingOpen",
        messageCount: 0,
        status: "streaming",
        tabType: "sessions",
      }),
    ).toBe(true);
  });

  it("collapses back to the notepad composer when chat is closed", () => {
    expect(
      isPageIntegratedChat({
        mode: "FloatingClosed",
        messageCount: 2,
        status: "ready",
      }),
    ).toBe(true);
  });

  it("never page-integrates the docked right panel", () => {
    expect(
      isPageIntegratedChat({
        mode: "RightPanelOpen",
        messageCount: 0,
        status: "ready",
      }),
    ).toBe(false);
    expect(
      isPageIntegratedChat({
        mode: "RightPanelOpen",
        messageCount: 1,
        status: "ready",
        tabType: "sessions",
      }),
    ).toBe(false);
  });
});

describe("page chat thread collapse", () => {
  it("collapses the notepad thread while chat is closed", () => {
    expect(
      isPageChatThreadCollapsed({
        pageIntegrated: true,
        mode: "FloatingClosed",
      }),
    ).toBe(true);
    expect(
      isPageChatThreadCollapsed({
        pageIntegrated: true,
        mode: "FloatingOpen",
      }),
    ).toBe(false);
  });

  it("collapses an open note conversation when the notes are clicked", () => {
    expect(
      shouldCollapsePageChatOnNoteClick({
        pageIntegrated: true,
        mode: "FloatingOpen",
        messageCount: 2,
        status: "ready",
      }),
    ).toBe(true);
    expect(
      shouldCollapsePageChatOnNoteClick({
        pageIntegrated: true,
        mode: "FloatingClosed",
        messageCount: 2,
        status: "ready",
      }),
    ).toBe(false);
    expect(
      shouldCollapsePageChatOnNoteClick({
        pageIntegrated: true,
        mode: "FloatingOpen",
        messageCount: 0,
        status: "ready",
      }),
    ).toBe(false);
  });

  it("expands the notepad thread when the composer is clicked", () => {
    expect(
      shouldExpandPageChatOnComposerClick({
        pageIntegrated: true,
        mode: "FloatingClosed",
      }),
    ).toBe(true);
    expect(
      shouldExpandPageChatOnComposerClick({
        pageIntegrated: true,
        mode: "FloatingOpen",
      }),
    ).toBe(false);
  });
});
