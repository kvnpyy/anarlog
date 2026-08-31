import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import {
  GOOGLE_CALENDAR_CONNECTIONS_QUERY_KEY,
  GOOGLE_CALENDAR_INTEGRATION_ID,
  listGoogleCalendarConnections,
  toConnectionItem,
} from "./storage";

import { useAuth } from "~/auth";
import { useConnections } from "~/auth/useConnections";
import { LOCAL_ONLY } from "~/shared/product";

export function useGoogleCalendarConnections(options?: {
  refetchInterval?: number | false;
}) {
  return useQuery({
    queryKey: GOOGLE_CALENDAR_CONNECTIONS_QUERY_KEY,
    queryFn: listGoogleCalendarConnections,
    refetchInterval: options?.refetchInterval,
  });
}

export function useMergedCalendarConnections(
  enabled = true,
  options?: { refetchInterval?: number | false },
) {
  const auth = useAuth();
  const remote = useConnections(
    !LOCAL_ONLY && enabled && Boolean(auth.session),
    options,
  );
  const localGoogle = useGoogleCalendarConnections(options);

  const data = useMemo(() => {
    const remoteConnections = remote.data ?? [];
    const googleConnections = (localGoogle.data ?? []).map(toConnectionItem);
    const withoutRemoteGoogle = remoteConnections.filter(
      (connection) =>
        connection.integration_id !== GOOGLE_CALENDAR_INTEGRATION_ID,
    );
    return [...withoutRemoteGoogle, ...googleConnections];
  }, [localGoogle.data, remote.data]);

  return {
    data,
    isPending: localGoogle.isPending || (!LOCAL_ONLY && remote.isPending),
    isError: localGoogle.isError || (!LOCAL_ONLY && remote.isError),
  };
}
