import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isPro: false,
  setAcornProEntitlement: vi.fn(),
  redeemAcornProInvite: vi.fn(),
}));

vi.mock("~/auth/billing-context", () => ({
  useBillingAccess: () => ({ isPro: mocks.isPro }),
}));

vi.mock("~/auth/acorn-pro", () => ({
  setAcornProEntitlement: mocks.setAcornProEntitlement,
}));

vi.mock("~/auth/acorn-pro-invite", () => ({
  redeemAcornProInvite: mocks.redeemAcornProInvite,
}));

vi.mock("~/shared/acorn-share-card", () => ({
  AcornShareCard: () => <div>Share Acorn, get 3 months of Pro</div>,
}));

import { SettingsPro } from "./index";

describe("SettingsPro", () => {
  afterEach(() => {
    cleanup();
    mocks.isPro = false;
    mocks.setAcornProEntitlement.mockReset();
    mocks.redeemAcornProInvite.mockReset();
  });

  it("shows plans, sharing, and invite redemption on Free", () => {
    render(<SettingsPro />);

    expect(screen.getByRole("heading", { name: "Pro" })).toBeTruthy();
    expect(screen.getByText(/share Acorn or redeem an invite/)).toBeTruthy();
    expect(screen.getByText("Free")).toBeTruthy();
    expect(screen.getAllByText("Pro").length).toBeGreaterThan(1);
    expect(screen.getByText("Share Acorn, get 3 months of Pro")).toBeTruthy();
    expect(screen.getByLabelText("Have a Pro invite?")).toBeTruthy();
    expect(screen.queryByText("Share or redeem below")).toBeNull();
  });

  it("hides invite redemption when already Pro", () => {
    mocks.isPro = true;
    render(<SettingsPro />);

    expect(screen.getByText("You’re on Acorn Pro on this Mac.")).toBeTruthy();
    expect(screen.queryByLabelText("Have a Pro invite?")).toBeNull();
    expect(screen.getByText("Current plan")).toBeTruthy();
  });

  it("redeems an invite code on Free", () => {
    mocks.redeemAcornProInvite.mockResolvedValue("ok");
    render(<SettingsPro />);

    fireEvent.change(screen.getByLabelText("Have a Pro invite?"), {
      target: { value: "ACORN-TEST-CODE-0001" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Redeem" }));

    expect(mocks.redeemAcornProInvite).toHaveBeenCalledWith(
      "ACORN-TEST-CODE-0001",
      false,
    );
  });
});
