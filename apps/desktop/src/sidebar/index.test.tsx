import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  currentTab: { type: "empty" } as { type: string } | null,
  openNew: vi.fn(),
}));

vi.mock("~/store/zustand/tabs", () => ({
  useTabs: (
    selector: (state: {
      currentTab: typeof mocks.currentTab;
      openNew: typeof mocks.openNew;
    }) => unknown,
  ) => selector({ currentTab: mocks.currentTab, openNew: mocks.openNew }),
}));

vi.mock("~/shared/config", () => ({
  useConfigValues: () => ({
    user_profile_name: "",
    user_profile_role: "",
    user_profile_department: "",
    user_profile_context: "",
  }),
}));

vi.mock("~/sidebar/timeline", () => ({
  TimelineView: ({
    showOpenCalendarButton = true,
    topChipsOverlapHeader = false,
    topChromeInset = false,
  }: {
    showOpenCalendarButton?: boolean;
    topChipsOverlapHeader?: boolean;
    topChromeInset?: boolean;
  }) => (
    <div
      data-testid="timeline-view"
      data-show-open-calendar-button={String(showOpenCalendarButton)}
      data-top-chips-overlap-header={String(topChipsOverlapHeader)}
      data-top-chrome-inset={String(topChromeInset)}
    />
  ),
}));

vi.mock("./folders", () => ({
  SidebarFolders: () => <div data-testid="sidebar-folders" />,
}));

vi.mock("~/sidebar/calendar", () => ({
  CalendarNav: () => <div data-testid="calendar-nav" />,
}));

vi.mock("~/sidebar/automations", () => ({
  AutomationsNav: () => <div data-testid="automations-nav" />,
}));

vi.mock("~/sidebar/contacts", () => ({
  ContactsNav: () => <div data-testid="contacts-nav" />,
}));

vi.mock("~/sidebar/settings", () => ({
  SettingsNav: () => <div data-testid="settings-nav" />,
}));

vi.mock("~/sidebar/templates", () => ({
  TemplatesNav: () => <div data-testid="templates-nav" />,
}));

vi.mock("~/sidebar/shared-notes", () => ({
  SharedNotesNav: () => <div data-testid="shared-notes-nav" />,
}));

import { LeftSidebar } from "./index";

describe("LeftSidebar", () => {
  beforeEach(() => {
    mocks.currentTab = { type: "empty" };
  });

  afterEach(() => {
    cleanup();
  });

  it("uses the timeline layout without a duplicate sidebar top offset", () => {
    const { container } = render(<LeftSidebar />);

    expect(screen.getByTestId("timeline-view")).toBeTruthy();
    expect(
      screen
        .getByTestId("timeline-view")
        .getAttribute("data-show-open-calendar-button"),
    ).toBe("true");
    expect(
      screen.getByTestId("timeline-view").getAttribute("data-top-chrome-inset"),
    ).toBe("true");
    expect(
      screen
        .getByTestId("timeline-view")
        .getAttribute("data-top-chips-overlap-header"),
    ).toBe("false");
    expect(container.firstElementChild?.className).toContain("pt-0");
    expect(container.firstElementChild?.className).not.toContain("pr-1");
    expect(screen.getByRole("button", { name: "Settings" })).toBeTruthy();
    const footer = document.querySelector("[data-sidebar-user-footer]");
    const overflow = footer?.previousElementSibling;
    expect(footer).toBeTruthy();
    expect(overflow?.className).toContain("overflow-hidden");
    expect(overflow?.contains(screen.getByTestId("timeline-view"))).toBe(true);
    expect(overflow?.contains(screen.getByTestId("sidebar-folders"))).toBe(
      true,
    );
    expect(footer && overflow?.contains(footer)).toBe(false);
  });

  it("renders timeline header as normal sidebar content", () => {
    render(
      <LeftSidebar timelineHeader={<div data-testid="timeline-header" />} />,
    );

    expect(
      screen
        .getByTestId("timeline-header")
        .parentElement?.contains(screen.getByTestId("timeline-view")),
    ).toBe(true);
    expect(
      screen.getByTestId("timeline-view").getAttribute("data-top-chrome-inset"),
    ).toBe("false");
    expect(
      screen
        .getByTestId("timeline-view")
        .getAttribute("data-top-chips-overlap-header"),
    ).toBe("true");
  });

  it("shows received notes without the personal timeline", () => {
    render(<LeftSidebar noteFilter="shared" />);

    expect(screen.queryByTestId("timeline-view")).toBeNull();
    expect(screen.getByTestId("shared-notes-nav")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Settings" })).toBeTruthy();
  });

  it.each([
    ["settings", "settings-nav"],
    ["calendar", "calendar-nav"],
    ["contacts", "contacts-nav"],
    ["templates", "templates-nav"],
    ["automations", "automations-nav"],
  ])(
    "lets the %s nav place its own header in the chrome row",
    (type, testId) => {
      mocks.currentTab = { type };

      const { container } = render(<LeftSidebar />);
      const classList = container.firstElementChild?.className.split(" ") ?? [];

      expect(screen.getByTestId(testId)).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Settings" })).toBeNull();
      expect(classList).toContain("pt-0");
      expect(classList).toContain("pr-1");
      expect(classList).not.toContain("pt-11");
    },
  );
});
