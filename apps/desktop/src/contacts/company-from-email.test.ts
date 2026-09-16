import { describe, expect, test } from "vitest";

import {
  companyTermFromEmail,
  companyTermsFromEmails,
  isBusinessEmail,
  normalizeMailbox,
} from "./company-from-email";

describe("companyTermFromEmail", () => {
  test("learns a work domain like Yotpo", () => {
    expect(companyTermFromEmail("kevin.payoyo@yotpo.com")).toBe("Yotpo");
  });

  test("skips personal inbox domains", () => {
    expect(companyTermFromEmail("kevin@gmail.com")).toBeUndefined();
    expect(companyTermFromEmail("kevin@icloud.com")).toBeUndefined();
  });

  test("treats company domains as business email and collapses plus aliases", () => {
    expect(isBusinessEmail("kevin@yotpo.com")).toBe(true);
    expect(isBusinessEmail("kevin@gmail.com")).toBe(false);
    expect(normalizeMailbox("Kevin+share@Yotpo.com")).toBe("kevin@yotpo.com");
  });

  test("reads the org label from country-style domains", () => {
    expect(companyTermFromEmail("sam@brand.co.uk")).toBe("Brand");
  });

  test("dedupes company terms from mixed emails", () => {
    expect(
      companyTermsFromEmails([
        "kevin.payoyo@yotpo.com",
        "sales@yotpo.com",
        "friend@gmail.com",
        "tom@listtrak.io",
      ]),
    ).toEqual(["Yotpo", "Listtrak"]);
  });
});
