import { tool } from "ai";
import { z } from "zod";

import type { ToolDependencies } from "./types";

export const buildSearchCalendarEventsTool = (deps: ToolDependencies) =>
  tool({
    description:
      "Search calendar events by title, description, or attendee name and email. Returns each attendee's name and email. Use email spellings when a transcript name is only how it sounded.",
    inputSchema: z.object({
      query: z.string().describe("Search query for calendar events"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(20)
        .optional()
        .describe("Maximum number of events to return"),
    }),
    execute: async (params: { query: string; limit?: number }) => {
      const limit = params.limit ?? 8;
      const results = await deps.getCalendarEventSearchResults(
        params.query,
        limit,
      );

      return {
        query: params.query,
        results,
      };
    },
  });
