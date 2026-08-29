import { t } from "@lingui/core/macro";
import { ArrowSquareOut } from "@phosphor-icons/react";

import { commands as openerCommands } from "@anlg/plugin-opener2";
import { Button } from "@anlg/ui/components/ui/button";
import { cn } from "@anlg/utils";

import { CliSettingsSections } from "./cli";
import { CloudApiSection } from "./cloud-api";
import { DevtoolsSection } from "./devtools";
import { WebhooksSection } from "./webhooks";

import { useBillingAccess } from "~/auth/billing-context";
import { SettingsPageTitle } from "~/settings/page-title";
import { useSetSettingValue } from "~/settings/queries";
import { SettingSwitchRow } from "~/settings/setting-row";
import { AcornProLockOverlay } from "~/shared/acorn-pro-dialog";
import { useConfigValue } from "~/shared/config";
import { LOCAL_ONLY } from "~/shared/product";

export { buildMcpConfiguration, getCliInstallNotification } from "./cli";

function AcornProFlagSection() {
  const acornPro = useConfigValue("acorn_pro") === true;
  const setAcornPro = useSetSettingValue("acorn_pro");

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-sans text-lg font-semibold">Acorn Pro</h2>
      <SettingSwitchRow
        title="acorn_pro"
        description="Local flag for the 365-day AI window. Off for everyone on the private beta unless you enable it."
        checked={acornPro}
        onChange={setAcornPro}
      />
    </section>
  );
}

const DEVELOPERS_GUIDE_URL = "https://docs.anarlog.so/agents/overview";

export function SettingsDevelopers() {
  const acornPro = useConfigValue("acorn_pro") === true;
  const locked = LOCAL_ONLY && !acornPro;
  const { upgradeToPro } = useBillingAccess();

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between gap-4">
        <SettingsPageTitle title={t`Developers`} />
        {LOCAL_ONLY ? null : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              void openerCommands.openUrl(DEVELOPERS_GUIDE_URL, null)
            }
          >
            {t`Guide`}
            <ArrowSquareOut className="size-3.5" />
          </Button>
        )}
      </div>
      <div className="relative min-h-[28rem]">
        <div
          className={cn([
            "flex flex-col gap-8",
            locked && "pointer-events-none opacity-40 select-none",
          ])}
          aria-hidden={locked}
        >
          <CliSettingsSections />
          {LOCAL_ONLY ? (
            acornPro ? (
              <AcornProFlagSection />
            ) : null
          ) : (
            <CloudApiSection />
          )}
          <WebhooksSection />
          <DevtoolsSection />
        </div>
        {locked ? (
          <AcornProLockOverlay
            description="CLI, MCP, and webhooks are on Pro. You can look around here, but these tools stay locked on Free."
            onSeePlans={upgradeToPro}
          />
        ) : null}
      </div>
    </div>
  );
}
