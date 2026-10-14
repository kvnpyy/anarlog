import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  openLinkedInCompanyPage: vi.fn(),
  grantLinkedInFollow: vi.fn(),
  config: { acorn_linkedin_granted_at: "" },
}));

vi.mock("~/auth/acorn-linkedin", async () => ({
  ...(await vi.importActual<typeof import("~/auth/acorn-linkedin")>(
    "~/auth/acorn-linkedin",
  )),
  openLinkedInCompanyPage: mocks.openLinkedInCompanyPage,
  grantLinkedInFollow: mocks.grantLinkedInFollow,
}));

vi.mock("~/shared/config", () => ({
  useConfigValues: () => mocks.config,
}));

import { AcornLinkedInCard } from "./acorn-linkedin-card";

function renderCard() {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <AcornLinkedInCard />
    </QueryClientProvider>,
  );
}

describe("AcornLinkedInCard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.config.acorn_linkedin_granted_at = "";
    mocks.openLinkedInCompanyPage.mockReset().mockResolvedValue(undefined);
    mocks.grantLinkedInFollow.mockReset().mockResolvedValue(true);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("opens LinkedIn, checks for 15 seconds, then unlocks a month", async () => {
    renderCard();

    fireEvent.click(screen.getByRole("button", { name: "Follow on LinkedIn" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(mocks.openLinkedInCompanyPage).toHaveBeenCalledOnce();
    expect(screen.getByText("Checking your follow…")).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(14_000);
    });
    expect(mocks.grantLinkedInFollow).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(mocks.grantLinkedInFollow).toHaveBeenCalledOnce();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(
      screen.getByText("Unlocked: 1 month of Pro on this Mac."),
    ).toBeTruthy();
  });

  it("shows the reward as claimed once granted", () => {
    mocks.config.acorn_linkedin_granted_at = "2026-10-01T00:00:00.000Z";
    renderCard();

    expect(
      screen.getByText("Unlocked: 1 month of Pro on this Mac."),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Follow on LinkedIn" }),
    ).toBeNull();
  });
});
