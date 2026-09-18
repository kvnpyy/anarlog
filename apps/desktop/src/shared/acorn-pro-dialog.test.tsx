import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  openNew: vi.fn(),
}));

vi.mock("~/auth/billing-context", () => ({
  useBillingAccess: () => ({ isPro: false }),
}));

vi.mock("~/auth/acorn-pro-invite", () => ({
  redeemAcornProInvite: vi.fn(),
}));

vi.mock("~/shared/acorn-share-card", () => ({
  AcornShareCard: () => <div>Share Acorn, get 3 months of Pro</div>,
}));

vi.mock("~/store/zustand/tabs", () => ({
  useTabs: (selector: (state: { openNew: typeof mocks.openNew }) => unknown) =>
    selector({ openNew: mocks.openNew }),
}));

import { AcornPlansDialog } from "./acorn-pro-dialog";

describe("AcornPlansDialog", () => {
  afterEach(() => {
    cleanup();
    mocks.openNew.mockReset();
  });

  it("compares Free and Pro and keeps checkout closed", () => {
    const onOpenChange = vi.fn();
    const openSpy = vi.spyOn(window, "open");
    render(<AcornPlansDialog open={true} onOpenChange={onOpenChange} />);

    expect(screen.getByRole("heading", { name: "Plans" })).toBeTruthy();
    expect(screen.getByText(/Free runs Haiku. Pro is smarter AI/)).toBeTruthy();
    expect(screen.getAllByText("Smarter AI").length).toBeGreaterThan(0);
    expect(screen.getByText("Default AI (Haiku)")).toBeTruthy();
    expect(screen.getByText("30-day AI memory")).toBeTruthy();
    expect(screen.getAllByText("365-day AI memory").length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(
        "Your own Anthropic, OpenAI, Grok, Gemini, or custom keys",
      ).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("CLI, MCP & webhooks").length).toBeGreaterThan(
      0,
    );
    expect(screen.getByText("Current plan")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Get Pro" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Share to get Pro" }),
    ).toBeTruthy();
    expect(screen.getByText("Share Acorn, get 3 months of Pro")).toBeTruthy();
    expect(screen.getByLabelText("Have a Pro invite?")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(openSpy).not.toHaveBeenCalled();

    openSpy.mockRestore();
  });

  it("opens the Pro settings page from the dialog", () => {
    const onOpenChange = vi.fn();
    render(<AcornPlansDialog open={true} onOpenChange={onOpenChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Open in Settings" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(mocks.openNew).toHaveBeenCalledWith({
      type: "settings",
      state: { tab: "pro" },
    });
  });

  it("stays inside the viewport instead of growing with share forms", () => {
    render(<AcornPlansDialog open={true} onOpenChange={vi.fn()} />);

    const dialog = screen.getByRole("dialog");
    expect(dialog.className).toContain("max-h-[min(88dvh,720px)]");
    expect(dialog.className).toContain("overflow-auto");
    expect(dialog.className).not.toContain("overflow-hidden");
    expect(dialog.className).toContain("max-w-[560px]");
  });
});
