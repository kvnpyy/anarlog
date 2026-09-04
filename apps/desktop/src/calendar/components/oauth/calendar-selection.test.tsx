import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  scheduleSync: vi.fn(),
  scheduleDebouncedSync: vi.fn(),
  cancelDebouncedSync: vi.fn(),
  setCalendarEnabled: vi.fn(),
  calendars: [] as Array<{
    id: string;
    name: string;
    enabled: boolean;
    source: string;
    color: string;
    connection_id: string;
  }>,
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
  }),
}));

vi.mock("../context", () => ({
  useSync: () => ({
    cancelDebouncedSync: mocks.cancelDebouncedSync,
    status: "idle",
    scheduleDebouncedSync: mocks.scheduleDebouncedSync,
    scheduleSync: mocks.scheduleSync,
  }),
}));

vi.mock("~/calendar/queries", () => ({
  setCalendarEnabled: mocks.setCalendarEnabled,
  useCalendarRows: () => mocks.calendars,
}));

import { PROVIDERS } from "../shared";
import { useOAuthCalendarSelection } from "./calendar-selection";

const GOOGLE_PROVIDER = PROVIDERS.find((provider) => provider.id === "google")!;

function HookHarness() {
  const selection = useOAuthCalendarSelection(GOOGLE_PROVIDER);
  return (
    <button
      type="button"
      onClick={() =>
        void selection.handleToggle(
          {
            id: "cal-1",
            title: "Work",
            color: "#4285f4",
            enabled: false,
          },
          true,
        )
      }
    >
      enable
    </button>
  );
}

describe("useOAuthCalendarSelection", () => {
  beforeEach(() => {
    mocks.setCalendarEnabled.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
    mocks.scheduleSync.mockClear();
    mocks.scheduleDebouncedSync.mockClear();
    mocks.cancelDebouncedSync.mockClear();
    mocks.setCalendarEnabled.mockReset();
    mocks.setCalendarEnabled.mockResolvedValue(undefined);
    mocks.calendars = [];
  });

  it("does not sync on mount while calendar rows are still empty", () => {
    render(<HookHarness />);

    expect(mocks.scheduleSync).not.toHaveBeenCalled();
  });

  it("does not sync on mount when calendars are already present", () => {
    mocks.calendars = [
      {
        id: "cal-1",
        name: "Work",
        enabled: true,
        source: "user@example.com",
        color: "#4285f4",
        connection_id: "conn-1",
      },
    ];

    render(<HookHarness />);

    expect(mocks.scheduleSync).not.toHaveBeenCalled();
  });

  it("syncs immediately when the first calendar is enabled", async () => {
    mocks.calendars = [
      {
        id: "cal-1",
        name: "Work",
        enabled: false,
        source: "user@example.com",
        color: "#4285f4",
        connection_id: "conn-1",
      },
    ];

    render(<HookHarness />);
    fireEvent.click(screen.getByRole("button", { name: "enable" }));

    await waitFor(() => {
      expect(mocks.scheduleSync).toHaveBeenCalledOnce();
    });
    expect(mocks.cancelDebouncedSync).toHaveBeenCalledOnce();
    expect(mocks.scheduleDebouncedSync).not.toHaveBeenCalled();
  });

  it("debounces later calendar toggles", async () => {
    mocks.calendars = [
      {
        id: "cal-1",
        name: "Work",
        enabled: true,
        source: "user@example.com",
        color: "#4285f4",
        connection_id: "conn-1",
      },
      {
        id: "cal-2",
        name: "Personal",
        enabled: false,
        source: "user@example.com",
        color: "#0f9d58",
        connection_id: "conn-1",
      },
    ];

    function SecondCalendarHarness() {
      const selection = useOAuthCalendarSelection(GOOGLE_PROVIDER);
      return (
        <button
          type="button"
          onClick={() =>
            void selection.handleToggle(
              {
                id: "cal-2",
                title: "Personal",
                color: "#0f9d58",
                enabled: false,
              },
              true,
            )
          }
        >
          enable second
        </button>
      );
    }

    render(<SecondCalendarHarness />);
    fireEvent.click(screen.getByRole("button", { name: "enable second" }));

    await waitFor(() => {
      expect(mocks.scheduleDebouncedSync).toHaveBeenCalledOnce();
    });
    expect(mocks.scheduleSync).not.toHaveBeenCalled();
  });
});
