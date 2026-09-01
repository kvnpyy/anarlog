import { tool } from "ai";
import { z } from "zod";

import {
  getMeeting,
  getMeetingTranscript,
  getRecurringMeetingHistory,
  listMeetings,
  type ListMeetingsInput,
  type MeetingPage,
} from "@anlg/plugin-db";

import type { ToolDependencies } from "./types";

import {
  type AiKnowledgeWindow,
  getAiKnowledgeWindow,
  isWithinAiWindow,
  outsideAiWindowResult,
  parseMeetingTimeMs,
  withAiWindowMeta,
} from "~/shared/ai-window";

const listLimitSchema = z
  .number()
  .int()
  .min(1)
  .max(200)
  .optional()
  .describe("Maximum results; defaults to 20 and is capped at 200");

const offsetSchema = z
  .number()
  .int()
  .min(0)
  .optional()
  .describe("Number of results to skip; defaults to 0");

const historyLimitSchema = z
  .number()
  .int()
  .min(1)
  .max(200)
  .optional()
  .describe("Maximum meetings; defaults to 20 and is capped at 200");

const historyOffsetSchema = z
  .number()
  .int()
  .min(0)
  .optional()
  .describe("Number of meetings to skip; defaults to 0");

type MeetingListItem = MeetingPage["meetings"][number];

function resolveWindow(
  deps?: Pick<ToolDependencies, "getAiKnowledgeWindow">,
): AiKnowledgeWindow {
  return deps?.getAiKnowledgeWindow?.() ?? getAiKnowledgeWindow(false);
}

function meetingInWindow(meeting: MeetingListItem, cutoffMs: number): boolean {
  return isWithinAiWindow(
    parseMeetingTimeMs(meeting.started_at, meeting.created_at),
    cutoffMs,
  );
}

async function listMeetingsInWindow(
  input: ListMeetingsInput,
  window: AiKnowledgeWindow,
): Promise<MeetingPage & { notice?: string }> {
  const limit = input.limit ?? 20;
  const collected: MeetingListItem[] = [];
  let dbOffset = input.offset ?? 0;
  let exhausted = false;

  while (collected.length < limit && !exhausted) {
    const pageSize = Math.min(Math.max(limit - collected.length, 1), 200);
    const page = await listMeetings({
      ...input,
      offset: dbOffset,
      limit: pageSize,
    });
    if (page.meetings.length === 0) {
      exhausted = true;
      break;
    }

    for (const meeting of page.meetings) {
      if (!meetingInWindow(meeting, window.cutoffMs)) {
        exhausted = true;
        break;
      }
      collected.push(meeting);
      dbOffset += 1;
      if (collected.length >= limit) {
        break;
      }
    }

    if (!exhausted && page.meetings.length < pageSize) {
      exhausted = true;
    }
  }

  return withAiWindowMeta(
    {
      meetings: collected,
      pagination: {
        offset: input.offset ?? 0,
        limit,
        returned: collected.length,
        total: null,
        next_offset: exhausted ? null : dbOffset,
      },
    },
    window,
  );
}

function allowCurrentMeeting(
  meetingId: string,
  deps?: Pick<ToolDependencies, "getSessionId">,
): boolean {
  return deps?.getSessionId?.() === meetingId;
}

export const buildListMeetingsTool = (deps?: ToolDependencies) =>
  tool({
    description:
      "List recent Acorn meetings with pagination metadata. Use query to narrow by title or meeting id, then pass next_offset as offset to continue.",
    inputSchema: z.object({
      query: z
        .string()
        .optional()
        .describe("Case-insensitive title or meeting id substring"),
      series_id: z.string().optional().describe("Exact recurring series id"),
      limit: listLimitSchema,
      offset: offsetSchema,
    }),
    execute: (input: ListMeetingsInput) =>
      listMeetingsInWindow(input, resolveWindow(deps)),
  });

export const buildGetMeetingTool = (deps?: ToolDependencies) =>
  tool({
    description:
      "Get one Acorn meeting with its canonical note, summaries, participants, and action items. Use get_meeting_transcript separately for transcript words.",
    inputSchema: z.object({
      meeting_id: z.string().describe("Acorn meeting id"),
    }),
    execute: async (input: { meeting_id: string }) => {
      const window = resolveWindow(deps);
      const meeting = await getMeeting(input);
      if (
        allowCurrentMeeting(meeting.id, deps) ||
        isWithinAiWindow(
          parseMeetingTimeMs(meeting.started_at, meeting.created_at),
          window.cutoffMs,
        )
      ) {
        return meeting;
      }
      return outsideAiWindowResult(meeting.id, window);
    },
  });

export const buildGetMeetingTranscriptTool = (deps?: ToolDependencies) =>
  tool({
    description:
      "Get a bounded page of transcript words and readable text for an Acorn meeting. Pass pagination.next_offset as offset to continue.",
    inputSchema: z.object({
      meeting_id: z.string().describe("Acorn meeting id"),
      offset: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe("Word offset; defaults to 0"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(500)
        .optional()
        .describe("Maximum words; defaults to 200 and is capped at 500"),
    }),
    execute: async (input: {
      meeting_id: string;
      offset?: number;
      limit?: number;
    }) => {
      const window = resolveWindow(deps);
      if (!allowCurrentMeeting(input.meeting_id, deps)) {
        const meeting = await getMeeting({ meeting_id: input.meeting_id });
        if (
          !isWithinAiWindow(
            parseMeetingTimeMs(meeting.started_at, meeting.created_at),
            window.cutoffMs,
          )
        ) {
          return outsideAiWindowResult(input.meeting_id, window);
        }
      }
      return getMeetingTranscript(input);
    },
  });

export const buildGetRecurringMeetingHistoryTool = (deps?: ToolDependencies) =>
  tool({
    description:
      "List meetings in the same recurring series as the supplied meeting, newest first, with pagination metadata.",
    inputSchema: z.object({
      meeting_id: z
        .string()
        .describe("A meeting id used to resolve its recurring series"),
      limit: historyLimitSchema,
      offset: historyOffsetSchema,
    }),
    execute: async (input: {
      meeting_id: string;
      limit?: number;
      offset?: number;
    }) => {
      const window = resolveWindow(deps);
      const page = await getRecurringMeetingHistory(input);
      const meetings = page.meetings.filter((meeting) =>
        meetingInWindow(meeting, window.cutoffMs),
      );
      return withAiWindowMeta(
        {
          ...page,
          meetings,
          pagination: {
            ...page.pagination,
            returned: meetings.length,
            next_offset:
              meetings.length < (input.limit ?? 20)
                ? null
                : page.pagination.next_offset,
          },
        },
        window,
      );
    },
  });
