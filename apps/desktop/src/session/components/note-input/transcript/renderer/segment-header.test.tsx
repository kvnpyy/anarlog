import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SegmentHeader } from "./segment-header";
import { TranscriptSelectionProvider } from "./selection-context";

import type { Segment } from "~/stt/live-segment";

const mocks = vi.hoisted(() => ({
  assignTranscriptSpeaker: vi.fn(() => Promise.resolve()),
}));

vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children?: ReactNode }) => <>{children}</>,
  useLingui: () => ({
    t: (strings: TemplateStringsArray, ...values: unknown[]) =>
      strings.reduce(
        (message, part, index) =>
          `${message}${part}${index < values.length ? String(values[index]) : ""}`,
        "",
      ),
  }),
}));

vi.mock("./speaker-assign", () => ({
  SpeakerAssignPopover: ({ label }: { label: string }) => (
    <button type="button">{label}</button>
  ),
  getAssignmentAnchorWordId: (segment: Segment) => segment.words[0]?.id,
  getAssignmentWordIds: (segment: Segment) =>
    segment.words
      .map((word) => word.id)
      .filter((wordId): wordId is string => typeof wordId === "string"),
}));

vi.mock("~/stt/queries", () => ({
  assignTranscriptSpeaker: mocks.assignTranscriptSpeaker,
}));

vi.mock("~/analytics", () => ({
  trackAnalyticsEvent: vi.fn(),
}));

beforeEach(() => {
  cleanup();
});

describe("SegmentHeader", () => {
  it("shows a selection marker in select mode", () => {
    render(
      <TranscriptSelectionProvider
        selectMode
        selectedKeys={new Set()}
        registerSource={() => () => {}}
      >
        <SegmentHeader
          transcriptId="transcript-1"
          sessionId="session-1"
          label="Speaker 3"
          segment={createRemoteSegment(2)}
        />
      </TranscriptSelectionProvider>,
    );

    expect(screen.getByRole("button", { name: "Speaker 3" })).toBeTruthy();
    expect(document.querySelector("[aria-hidden='true']")?.className).toContain(
      "rounded-full",
    );
  });
  it("keeps the speaker label visible without exposing timestamps", () => {
    render(
      <SegmentHeader
        transcriptId="transcript-1"
        sessionId="session-1"
        label="Speaker 3"
        segment={createRemoteSegment(2)}
      />,
    );

    expect(screen.getByRole("button", { name: "Speaker 3" })).toBeTruthy();
    expect(screen.queryByText("00:12 - 00:18")).toBeNull();
  });

  it("keeps speaker labels in document flow with their text", () => {
    const view = render(
      <SegmentHeader
        transcriptId="transcript-1"
        sessionId="session-1"
        label="J"
        segment={createRemoteSegment(0)}
      />,
    );

    const header = view.container.firstElementChild;
    expect(header?.className).not.toContain("sticky");
    expect(header?.className).not.toContain("-mx-3");
    expect(header?.className).not.toContain("z-20");
  });

  it("labels remote live segments as the unique other participant", () => {
    render(
      <SegmentHeader
        transcriptId="transcript-1"
        sessionId="session-1"
        label="Artem"
        segment={createRemoteSegment(0)}
      />,
    );

    expect(screen.getByRole("button", { name: "Artem" })).toBeTruthy();
  });

  it("updates cached remote labels when session participants change", () => {
    const segment = createRemoteSegment(0);
    const { rerender } = render(
      <SegmentHeader
        transcriptId="transcript-1"
        sessionId="session-1"
        label="Artem"
        segment={segment}
      />,
    );

    expect(screen.getByRole("button", { name: "Artem" })).toBeTruthy();

    rerender(
      <SegmentHeader
        transcriptId="transcript-1"
        sessionId="session-1"
        label="Speaker 1"
        segment={segment}
      />,
    );

    expect(screen.getByRole("button", { name: "Speaker 1" })).toBeTruthy();
  });

  it("confirms a suggested speaker in one tap", () => {
    render(
      <SegmentHeader
        transcriptId="transcript-1"
        sessionId="session-1"
        label="Ada?"
        suggestedHumanId="ada"
        segment={createRemoteSegment(1)}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Confirm speaker" }));

    expect(mocks.assignTranscriptSpeaker).toHaveBeenCalledWith({
      transcriptId: "transcript-1",
      segmentKey: {
        channel: "RemoteParty",
        speaker_index: 1,
        speaker_human_id: null,
      },
      humanId: "ada",
      anchorWordId: "word-1",
      mode: "all",
      wordIds: ["word-1"],
    });
  });
});

function createRemoteSegment(speakerIndex: number): Segment {
  return {
    id: "segment-1",
    key: {
      channel: "RemoteParty",
      speaker_index: speakerIndex,
      speaker_human_id: null,
    },
    start_ms: 12_000,
    end_ms: 18_000,
    text: "hello world",
    words: [
      {
        id: "word-1",
        text: "hello",
        start_ms: 12_000,
        end_ms: 13_000,
        channel: "RemoteParty",
        is_final: true,
      },
    ],
  } as Segment;
}
