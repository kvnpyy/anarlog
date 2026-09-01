import { t } from "@lingui/core/macro";
import { CircleNotch } from "@phosphor-icons/react";
import { useCallback, useMemo } from "react";

import type { ConnectionItem } from "@anlg/api-client";

import {
  OAuthCalendarSelection,
  useOAuthCalendarSelection,
} from "./calendar-selection";
import { ReconnectRequiredIndicator } from "./status";

import { useAuth } from "~/auth";
import type { CalendarProvider } from "~/calendar/components/shared";
import { usesNativeGoogleCalendarOAuth } from "~/calendar/components/shared";
import { useGoogleCalendarConnect } from "~/calendar/google-oauth";
import { useMergedCalendarConnections } from "~/calendar/google-oauth/use-connections";
import { useOpenIntegrationUrl } from "~/shared/integration";

export function OAuthProviderContent({
  config,
  returnTo = "calendar",
  onConnectStarted,
}: {
  config: CalendarProvider;
  returnTo?: string;
  onConnectStarted?: () => void;
}) {
  const auth = useAuth();
  const nativeGoogle = usesNativeGoogleCalendarOAuth(config);
  const { openIntegration, openingAction: hostedOpeningAction } =
    useOpenIntegrationUrl();
  const { connectGoogle, openingAction: googleOpeningAction } =
    useGoogleCalendarConnect();
  const { data: connections, isError } = useMergedCalendarConnections();
  const openingAction = nativeGoogle
    ? googleOpeningAction
    : hostedOpeningAction;
  const providerConnections = useMemo(
    () =>
      connections?.filter(
        (c) => c.integration_id === config.nangoIntegrationId,
      ) ?? [],
    [connections, config.nangoIntegrationId],
  );

  const startOAuth = useCallback(
    (action: "connect" | "reconnect" | "disconnect", connectionId?: string) => {
      onConnectStarted?.();
      if (nativeGoogle) {
        connectGoogle({ action, connectionId });
        return;
      }
      openIntegration({
        nangoIntegrationId: config.nangoIntegrationId,
        connectionId,
        action,
        returnTo,
      });
    },
    [
      config.nangoIntegrationId,
      connectGoogle,
      nativeGoogle,
      onConnectStarted,
      openIntegration,
      returnTo,
    ],
  );

  if (!nativeGoogle && !auth.session) {
    return (
      <div className="pt-1 pb-2">
        <button
          type="button"
          onClick={() => void auth.signIn()}
          className="text-muted-foreground hover:text-foreground inline-flex cursor-pointer items-center gap-1 text-xs underline transition-colors"
        >
          {t`Connect ${config.displayName} Calendar`}
        </button>
      </div>
    );
  }

  if (providerConnections.length > 0) {
    const reconnectRequired = providerConnections.filter(
      (c) => c.status === "reconnect_required",
    );

    return (
      <div className="flex flex-col gap-3 pb-2">
        {reconnectRequired.map((connection) => (
          <ReconnectRequiredContent
            key={connection.connection_id}
            config={config}
            onReconnect={() =>
              startOAuth("reconnect", connection.connection_id)
            }
            onDisconnect={() =>
              startOAuth("disconnect", connection.connection_id)
            }
            openingAction={openingAction}
            errorDescription={connection.last_error_description ?? null}
          />
        ))}

        <ConnectedContent
          config={config}
          connections={providerConnections}
          onReconnect={(connectionId) => startOAuth("reconnect", connectionId)}
          onDisconnect={(connectionId) =>
            startOAuth("disconnect", connectionId)
          }
        />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="pt-1 pb-2">
        <span className="text-xs text-red-600">
          {t`Failed to load integration status`}
        </span>
      </div>
    );
  }

  return (
    <div className="pt-1 pb-2">
      <button
        onClick={() => startOAuth("connect")}
        disabled={openingAction !== null}
        className="text-muted-foreground hover:text-foreground inline-flex cursor-pointer items-center gap-1 text-xs underline transition-colors disabled:opacity-50"
      >
        {openingAction === "connect" && (
          <CircleNotch className="size-3 animate-spin" aria-hidden="true" />
        )}
        {t`Connect ${config.displayName} Calendar`}
      </button>
    </div>
  );
}

function ReconnectRequiredContent({
  config,
  onReconnect,
  onDisconnect,
  openingAction,
  errorDescription,
}: {
  config: CalendarProvider;
  onReconnect: () => void;
  onDisconnect: () => void;
  openingAction: "connect" | "reconnect" | "disconnect" | null;
  errorDescription: string | null;
}) {
  return (
    <div className="flex flex-col gap-2 pb-2">
      <div className="flex items-center gap-2 text-xs text-amber-700">
        <ReconnectRequiredIndicator />
        <span>{t`Reconnect required for ${config.displayName} Calendar`}</span>
      </div>

      {errorDescription && (
        <p className="text-muted-foreground text-xs">{errorDescription}</p>
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={onReconnect}
          disabled={openingAction !== null}
          className="text-muted-foreground hover:text-foreground inline-flex cursor-pointer items-center gap-1 text-xs underline transition-colors disabled:opacity-50"
        >
          {openingAction === "reconnect" && (
            <CircleNotch className="size-3 animate-spin" aria-hidden="true" />
          )}
          {t`Reconnect`}
        </button>
        <span className="text-muted-foreground text-xs">{t`or`}</span>
        <button
          onClick={onDisconnect}
          disabled={openingAction !== null}
          className="inline-flex cursor-pointer items-center gap-1 text-xs text-red-500 underline transition-colors hover:text-red-700 disabled:opacity-50"
        >
          {openingAction === "disconnect" && (
            <CircleNotch className="size-3 animate-spin" aria-hidden="true" />
          )}
          {t`Disconnect`}
        </button>
      </div>
    </div>
  );
}

function ConnectedContent({
  config,
  connections,
  onReconnect,
  onDisconnect,
}: {
  config: CalendarProvider;
  connections: ConnectionItem[];
  onReconnect: (connectionId: string) => void;
  onDisconnect: (connectionId: string) => void;
}) {
  const {
    groups,
    connectionSourceMap,
    handleRefresh,
    handleToggle,
    isLoading,
  } = useOAuthCalendarSelection(config);

  const groupsWithMenus = useMemo(
    () =>
      groups.map((group) => {
        const connection = connections.find(
          (item) =>
            item.connection_id === group.id ||
            connectionSourceMap.get(item.connection_id) === group.sourceName,
        );

        if (!connection) return group;

        return {
          ...group,
          menuItems: [
            {
              id: `reconnect-${connection.connection_id}`,
              text: t`Reconnect`,
              action: () => onReconnect(connection.connection_id),
            },
            {
              id: `disconnect-${connection.connection_id}`,
              text: t`Disconnect`,
              action: () => onDisconnect(connection.connection_id),
            },
          ],
        };
      }),
    [connectionSourceMap, connections, groups, onDisconnect, onReconnect],
  );

  return (
    <OAuthCalendarSelection
      groups={groupsWithMenus}
      onToggle={handleToggle}
      onRefresh={handleRefresh}
      isLoading={isLoading}
    />
  );
}
