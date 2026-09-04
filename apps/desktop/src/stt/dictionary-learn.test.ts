import { beforeEach, describe, expect, test, vi } from "vitest";

const updateSettingValue = vi.hoisted(() => vi.fn());

vi.mock("~/settings/queries", () => ({
  updateSettingValue,
}));

import { rememberLearnedContactTerms } from "./dictionary-learn";

describe("rememberLearnedContactTerms", () => {
  beforeEach(() => {
    updateSettingValue.mockReset();
    updateSettingValue.mockImplementation(
      async (_key: string, update: (current: unknown) => string) =>
        update(JSON.stringify(["Anarlog"])),
    );
  });

  test("adds a work domain that is not already in the dictionary", async () => {
    await expect(
      rememberLearnedContactTerms({
        emails: ["kevin.payoyo@yotpo.com", "friend@gmail.com"],
        organizationNames: ["ListTrak"],
      }),
    ).resolves.toEqual(["Yotpo", "ListTrak"]);

    expect(updateSettingValue).toHaveBeenCalledWith(
      "personalization_dictionary_terms",
      expect.any(Function),
    );
    expect(
      updateSettingValue.mock.calls[0][1](JSON.stringify(["Anarlog"])),
    ).toBe(JSON.stringify(["Anarlog", "Yotpo", "ListTrak"]));
  });

  test("does not rewrite the dictionary when every term is already known", async () => {
    updateSettingValue.mockImplementation(
      async (_key: string, update: (current: unknown) => string) =>
        update(JSON.stringify(["Yotpo"])),
    );

    await expect(
      rememberLearnedContactTerms({
        emails: ["kevin.payoyo@yotpo.com"],
      }),
    ).resolves.toEqual([]);
  });
});
