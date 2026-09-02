import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("~/auth/billing-context", () => ({
  useBillingAccess: () => ({ isPro: false }),
}));

vi.mock("~/auth/acorn-pro-invite", () => ({
  redeemAcornProInvite: vi.fn(),
}));

import { AcornPlansDialog } from "./acorn-pro-dialog";
import { ACORN_PRO_CHECKOUT_HREF } from "./product";

describe("AcornPlansDialog", () => {
  afterEach(() => {
    cleanup();
  });

  it("compares Free and Pro without opening checkout", () => {
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

    const getPro = screen.getByRole("link", { name: "Get Pro" });
    expect(getPro.getAttribute("href")).toBe(ACORN_PRO_CHECKOUT_HREF);

    fireEvent.click(getPro);
    expect(openSpy).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);

    openSpy.mockRestore();
  });
});
