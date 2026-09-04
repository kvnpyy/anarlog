import { t } from "@lingui/core/macro";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef } from "react";

import { sonnerToast } from "@anlg/ui/components/ui/toast";

import { connectGoogleCalendar, disconnectGoogleCalendar } from "./connect";
import { GOOGLE_CALENDAR_CONNECTIONS_QUERY_KEY } from "./storage";

import { captureOperationalError } from "~/error-reporting";
import {
  allowReconnectedCalendarConnections,
  removeDisconnectedCalendarConnection,
  syncCalendarEvents,
  trackDirectSync,
} from "~/services/calendar";

export function useGoogleCalendarConnect() {
  const queryClient = useQueryClient();
  const inFlightRef = useRef(false);
  const { mutate, isPending, variables } = useMutation({
    mutationFn: async (input: {
      action: "connect" | "reconnect" | "disconnect";
      connectionId?: string;
    }) => {
      if (input.action === "disconnect") {
        if (!input.connectionId) {
          throw new Error("No Google Calendar account to disconnect.");
        }
        await disconnectGoogleCalendar(input.connectionId);
        await removeDisconnectedCalendarConnection(
          "google-calendar",
          input.connectionId,
        );
        return;
      }

      allowReconnectedCalendarConnections("google-calendar");
      await connectGoogleCalendar({ connectionId: input.connectionId });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: GOOGLE_CALENDAR_CONNECTIONS_QUERY_KEY,
      });
      await queryClient.invalidateQueries({ queryKey: ["integration-status"] });
      try {
        await trackDirectSync(() => syncCalendarEvents());
      } catch (error) {
        captureOperationalError(error, {
          operation: "google_calendar_sync",
          tags: { integration: "google-calendar" },
        });
        sonnerToast.error(
          "Google Calendar connected, but events could not be synced yet.",
        );
      }
    },
    onError: (caught) => {
      captureOperationalError(caught, {
        operation: "google_calendar_connect",
        tags: { integration: "google-calendar" },
      });
      sonnerToast.error(
        caught instanceof Error
          ? caught.message
          : t`Could not connect Google Calendar.`,
      );
    },
  });

  const connectGoogle = useCallback<typeof mutate>(
    (input, options) => {
      if (inFlightRef.current) {
        return;
      }
      inFlightRef.current = true;
      mutate(input, {
        ...options,
        onSettled: (...args) => {
          inFlightRef.current = false;
          options?.onSettled?.(...args);
        },
      });
    },
    [mutate],
  );

  return {
    connectGoogle,
    openingAction: isPending ? (variables?.action ?? null) : null,
  };
}
