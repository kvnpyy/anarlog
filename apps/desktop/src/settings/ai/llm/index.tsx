import { Trans } from "@lingui/react/macro";

import { ConfigureProviders } from "./configure";
import { LlmSettingsProvider } from "./context";
import { SelectProviderAndModel } from "./select";

import { SettingsPageTitle } from "~/settings/page-title";
import { useConfigValue } from "~/shared/config";
import { LOCAL_ONLY } from "~/shared/product";

export function LLM() {
  const acornPro = useConfigValue("acorn_pro") === true;
  const showOwnKeys = !LOCAL_ONLY || acornPro;

  return (
    <LlmSettingsProvider>
      <div className="flex flex-col gap-6">
        <SettingsPageTitle title={<Trans>Intelligence</Trans>} />
        <SelectProviderAndModel />
        {showOwnKeys ? (
          <ConfigureProviders />
        ) : (
          <p className="text-muted-foreground text-sm">
            Free stays on Default AI (Haiku). Pro adds smarter AI and your own
            keys.
          </p>
        )}
      </div>
    </LlmSettingsProvider>
  );
}
