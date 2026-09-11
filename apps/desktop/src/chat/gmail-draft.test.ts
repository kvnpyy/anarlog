import { describe, expect, it } from "vitest";

import {
  GMAIL_COMPOSE_URL_MAX,
  GMAIL_TEXT_COLOR,
  GMAIL_TEXT_FONT,
  GMAIL_TEXT_SIZE,
  isEmailDraft,
  splitEmailDraft,
  toGmailComposeUrl,
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
    expect(html).toContain("Best,<br>Kevin");
    expect(html).not.toContain("&lt;br&gt;");
  });

  it("turns pasted HTML line breaks into real line breaks instead of visible tags", () => {
    const draft = `Subject: Launch recap

Hi team,<br>Thanks for today.

Best,<br/>Kevin`;

    expect(toGmailCopyPlainText(draft)).toBe(`Hi team,
Thanks for today.

Best,
Kevin`);
    expect(toGmailCopyHtml(draft)).toContain("Hi team,<br>Thanks for today.");
    expect(toGmailCopyHtml(draft)).not.toContain("&lt;br");
  });

  it("builds a Gmail compose URL with subject and body", () => {
    const { url, includesBody } = toGmailComposeUrl(SAMPLE);
    const parsed = new URL(url);

    expect(includesBody).toBe(true);
    expect(parsed.origin + parsed.pathname).toBe(
      "https://mail.google.com/mail/",
    );
    expect(parsed.searchParams.get("view")).toBe("cm");
    expect(parsed.searchParams.get("su")).toBe("Launch recap");
    expect(parsed.searchParams.get("body")).toContain("Hi team,");
    expect(parsed.searchParams.get("body")).not.toContain("Subject:");
  });

  it("omits the body from the compose URL when it would exceed the length cap", () => {
    const longBody = "Please review this.\n".repeat(400);
    const { url, includesBody } = toGmailComposeUrl(
      `Subject: Long recap\n\n${longBody}`,
    );

    expect(includesBody).toBe(false);
    expect(url.length).toBeLessThanOrEqual(GMAIL_COMPOSE_URL_MAX);
    expect(new URL(url).searchParams.get("su")).toBe("Long recap");
    expect(new URL(url).searchParams.get("body")).toBeNull();
  });
});
