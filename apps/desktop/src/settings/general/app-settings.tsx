import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { platform } from "@tauri-apps/plugin-os";

import { SettingSwitchRow } from "~/settings/setting-row";
import {
  PRODUCT_ATTRIBUTION,
  PRODUCT_COPYRIGHT,
  PRODUCT_NAME,
  PRODUCT_TAGLINE,
} from "~/shared/product";

export const privacyMessages = {
  title: msg`Privacy`,
  posthogTitle: msg`Share usage data`,
  posthogDescription: msg`Help improve Acorn with anonymous usage data.`,
};

interface SettingItem {
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}

interface AppSettingsViewProps {
  appStoreBuild: boolean;
  autostart: SettingItem;
  automaticUpdates: SettingItem;
  showAppInDock: SettingItem;
  showTrayIcon: SettingItem;
}

export function AppSettingsView({
  appStoreBuild,
  autostart,
  automaticUpdates,
  showAppInDock,
  showTrayIcon,
}: AppSettingsViewProps) {
  const currentPlatform = platform();
  const isMacos = currentPlatform === "macos";

  return (
    <div className="flex flex-col gap-8">
      <section>
        <div className="flex flex-col gap-4">
          {!appStoreBuild && (
            <>
              <SettingSwitchRow
                title={<span>Start {PRODUCT_NAME} at login</span>}
                description={
                  <span>Have {PRODUCT_NAME} ready when you sign in.</span>
                }
                checked={autostart.value}
                onChange={autostart.onChange}
              />
              <SettingSwitchRow
                title={<Trans>Automatically install updates</Trans>}
                description={
                  <span>
                    Stay current with updates installed the next time{" "}
                    {PRODUCT_NAME} opens.
                  </span>
                }
                checked={automaticUpdates.value}
                onChange={automaticUpdates.onChange}
              />
            </>
          )}
          {isMacos && (
            <SettingSwitchRow
              title={<Trans>Show app in Dock</Trans>}
              description={
                <span>Show {PRODUCT_NAME} in the Dock and app switcher.</span>
              }
              checked={showAppInDock.value}
              onChange={showAppInDock.onChange}
            />
          )}
          <SettingSwitchRow
            title={<Trans>Show tray icon</Trans>}
            description={
              isMacos ? (
                <span>Open {PRODUCT_NAME} from the menu bar.</span>
              ) : undefined
            }
            checked={showTrayIcon.value}
            onChange={showTrayIcon.onChange}
          />
        </div>
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">About</h2>
        <p className="text-muted-foreground text-sm">{PRODUCT_TAGLINE}</p>
        <p className="text-muted-foreground text-sm">{PRODUCT_ATTRIBUTION}</p>
        <p className="text-muted-foreground text-xs leading-5">
          MIT License
          <br />
          {PRODUCT_COPYRIGHT}
        </p>
      </section>
    </div>
  );
}

export function AcornProSettingsCard({
  isPro,
  onUpgrade,
}: {
  isPro: boolean;
  onUpgrade: () => void;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-medium">Acorn Pro</h2>
      <p className="text-muted-foreground text-sm">
        {isPro ? "You’re on Acorn Pro (private beta)." : "You’re on Free."}
      </p>
      <ul className="text-muted-foreground list-disc space-y-1 pl-5 text-sm">
        <li>AI memory: {isPro ? "365 days" : "14 days vs 365 days"}</li>
        <li>Teams & shared notes: coming on Pro</li>
        <li>CLI, MCP & webhooks: coming on Pro</li>
      </ul>
      {isPro ? null : (
        <div>
          <button
            type="button"
            onClick={onUpgrade}
            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-8 items-center rounded-full px-3 text-xs font-medium"
          >
            Acorn Pro
          </button>
        </div>
      )}
    </section>
  );
}
