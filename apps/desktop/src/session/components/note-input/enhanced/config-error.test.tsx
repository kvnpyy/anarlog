import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  openNew: vi.fn(),
  upgradeToPro: vi.fn(),
}));

vi.mock("~/store/zustand/tabs", () => ({
  useTabs: (selector: (state: { openNew: typeof mocks.openNew }) => unknown) =>
    selector({ openNew: mocks.openNew }),
}));

vi.mock("~/auth/billing-context", () => ({
  useBillingAccess: () => ({ upgradeToPro: mocks.upgradeToPro }),
}));

import { ConfigError } from "./config-error";

describe("ConfigError", () => {
  afterEach(() => {
    cleanup();
    mocks.openNew.mockReset();
    mocks.upgradeToPro.mockReset();
  });

  it("offers API key setup from the empty summary state", () => {
    render(<ConfigError />);

    expect(screen.getByRole("alert")).not.toBeNull();
    expect(screen.getByText("Set up AI summaries")).not.toBeNull();
    expect(
      screen.getByText(
        "Add your own LLM API key to generate a summary from this transcript.",
      ),
    ).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Get Pro" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Add API key" }));
    expect(mocks.openNew).toHaveBeenCalledWith({
      type: "settings",
      state: { tab: "intelligence" },
    });
  });

  it("opens the Acorn Pro dialog instead of a checkout page", () => {
    render(<ConfigError />);

    fireEvent.click(screen.getByRole("button", { name: "Acorn Pro" }));
    expect(mocks.upgradeToPro).toHaveBeenCalledOnce();
    expect(mocks.openNew).not.toHaveBeenCalled();
  });
});
