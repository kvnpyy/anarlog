import { describe, expect, it } from "vitest";

import { toCopyableChatText } from "./copy-text";

describe("toCopyableChatText", () => {
  it("unwraps fenced drafts and strips markdown emphasis", () => {
    expect(
      toCopyableChatText(`\`\`\`markdown
**Subject:** Launch recap

Hi team,

Please review the ***timeline*** by Friday.

Thanks
\`\`\``),
    ).toBe(`Subject: Launch recap

Hi team,

Please review the timeline by Friday.

Thanks`);
  });

  it("leaves already-plain email text unchanged", () => {
    const email = `Subject: Follow-up

Hi Alex,

Thanks for today. I will send notes tomorrow.

Best,
Kevin`;

    expect(toCopyableChatText(email)).toBe(email);
  });
});
