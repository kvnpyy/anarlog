import { describe, expect, it } from "vitest";

import {
  GMAIL_TEXT_COLOR,
  GMAIL_TEXT_FONT,
  GMAIL_TEXT_SIZE,
  isEmailDraft,
  splitEmailDraft,
  toGmailCopyHtml,
  toGmailCopyPlainText,
} from "./gmail-draft";

const SAMPLE = `Subject: Launch recap

Hi team,

Thanks for today. Next steps:

- Ship the calendar fix
- Keep emails under 150 words

Best,
Kevin`;

describe("gmail draft helpers", () => {
  it("detects subject-prefixed email drafts", () => {
    expect(isEmailDraft(SAMPLE)).toBe(true);
    expect(isEmailDraft("Catch me up on the last five minutes.")).toBe(false);
  });

  it("splits the subject from the body", () => {
    expect(splitEmailDraft(SAMPLE)).toEqual({
      subject: "Launch recap",
      body: `Hi team,

Thanks for today. Next steps:

- Ship the calendar fix
- Keep emails under 150 words

Best,
Kevin`,
    });
  });

  it("copies Gmail-styled HTML without the subject line", () => {
    const html = toGmailCopyHtml(SAMPLE);

    expect(html).toContain(`font-family:${GMAIL_TEXT_FONT}`);
    expect(html).toContain(`font-size:${GMAIL_TEXT_SIZE}`);
    expect(html).toContain(`color:${GMAIL_TEXT_COLOR}`);
    expect(html).toContain("<ul");
    expect(html).toContain("<li>Ship the calendar fix</li>");
    expect(html).not.toContain("Subject:");
    expect(html).not.toContain("Launch recap");
    expect(toGmailCopyPlainText(SAMPLE)).toContain("Hi team,");
    expect(toGmailCopyPlainText(SAMPLE)).not.toContain("Subject:");
  });
});
