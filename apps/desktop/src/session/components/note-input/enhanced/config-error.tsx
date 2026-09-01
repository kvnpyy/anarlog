import { Trans } from "@lingui/react/macro";

import { Button } from "@anlg/ui/components/ui/button";

import { useBillingAccess } from "~/auth/billing-context";
import { LOCAL_ONLY } from "~/shared/product";
import { useTabs } from "~/store/zustand/tabs";

export function ConfigError() {
  const openNew = useTabs((state) => state.openNew);
  const { upgradeToPro } = useBillingAccess();

  return (
    <div
      role="alert"
      className="flex h-full min-h-[400px] flex-col items-center justify-center px-6"
    >
      <div className="mb-6 flex max-w-md flex-col gap-2 text-center">
        <p className="text-base font-medium">
          <Trans>Set up AI summaries</Trans>
        </p>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {LOCAL_ONLY ? (
            <Trans>
              Add your own LLM API key to generate a summary from this
              transcript.
            </Trans>
          ) : (
            <Trans>
              Start a Pro trial or add your own LLM API key to generate a
              summary from this transcript.
            </Trans>
          )}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {LOCAL_ONLY ? (
          <Button className="shadow-none" onClick={upgradeToPro}>
            Acorn Pro
          </Button>
        ) : (
          <Button
            className="shadow-none"
            onClick={() =>
              openNew({ type: "settings", state: { tab: "account" } })
            }
          >
            <Trans>Get Pro</Trans>
          </Button>
        )}
        <Button
          variant="outline"
          className="shadow-none"
          onClick={() =>
            openNew({ type: "settings", state: { tab: "intelligence" } })
          }
        >
          <Trans>Add API key</Trans>
        </Button>
      </div>
    </div>
  );
}
