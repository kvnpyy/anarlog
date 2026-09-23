import { describe, expect, it } from "vitest";

import {
  attachmentsFromEditorJson,
  draftLabel,
  messagePartsFromDraft,
  parseAttachedFileText,
} from "./attachments";

describe("chat draft attachments", () => {
  it("turns pasted images into file parts the model can read", () => {
    const json = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "What is this?" },
            {
              type: "attachment",
              attrs: {
                name: "diagram.png",
                mimeType: "image/png",
                url: "data:image/png;base64,abc",
              },
            },
          ],
        },
      ],
    };

    expect(
      messagePartsFromDraft("What is this?", attachmentsFromEditorJson(json)),
    ).toEqual([
      { type: "text", text: "What is this?" },
      {
        type: "file",
        mediaType: "image/png",
        filename: "diagram.png",
        url: "data:image/png;base64,abc",
      },
    ]);
  });

  it("inlines text files so the model reads the contents", () => {
    const notes = btoa("Ship the loyalty email Friday.");
    const parts = messagePartsFromDraft(
      "",
      attachmentsFromEditorJson({
        type: "doc",
        content: [
          {
            type: "attachment",
            attrs: {
              name: "notes.txt",
              mimeType: "text/plain",
              url: `data:text/plain;base64,${notes}`,
            },
          },
        ],
      }),
    );

    expect(parts).toEqual([
      {
        type: "text",
        text: 'Attached file "notes.txt":\nShip the loyalty email Friday.',
      },
    ]);
    expect(
      parseAttachedFileText(parts[0]?.type === "text" ? parts[0].text : ""),
    ).toEqual({
      name: "notes.txt",
      body: "Ship the loyalty email Friday.",
    });
    expect(
      draftLabel("", [
        { name: "notes.txt", mimeType: "text/plain", url: "data:" },
      ]),
    ).toBe("notes.txt");
  });

  it("keeps pdfs as files and ignores attachments that were not read", () => {
    expect(
      attachmentsFromEditorJson({
        type: "doc",
        content: [
          {
            type: "attachment",
            attrs: {
              name: "brief.pdf",
              mimeType: "application/pdf",
              url: null,
            },
          },
        ],
      }),
    ).toEqual([]);
  });
});
