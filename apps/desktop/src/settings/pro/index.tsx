import { setAcornProEntitlement } from "~/auth/acorn-pro";
import { useBillingAccess } from "~/auth/billing-context";
import { SettingsPageTitle } from "~/settings/page-title";
import { SettingSwitchRow } from "~/settings/setting-row";
import { AcornPlanCards } from "~/shared/acorn-plans";
import { AcornProInviteForm } from "~/shared/acorn-pro-invite-form";
import { AcornShareCard } from "~/shared/acorn-share-card";
import { PRODUCT_NAME } from "~/shared/product";

export function SettingsPro() {
  const { isPro } = useBillingAccess();

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <div className="flex flex-col gap-2">
        <SettingsPageTitle title="Pro" />
        <p className="text-muted-foreground max-w-xl text-sm leading-6">
          {isPro
            ? `You’re on ${PRODUCT_NAME} Pro on this Mac.`
            : `You’re on Free. Checkout isn’t open yet — share ${PRODUCT_NAME} or redeem an invite.`}
        </p>
      </div>

      <AcornPlanCards isPro={isPro} />

      <AcornShareCard />

      {isPro ? null : <AcornProInviteForm alreadyPro={isPro} />}

      <AcornProDevControls isPro={isPro} />
    </div>
  );
}

export function AcornProDevControls({
  isPro,
  showDevToggle = import.meta.env.DEV,
}: {
  isPro: boolean;
  showDevToggle?: boolean;
}) {
  if (showDevToggle) {
    return (
      <SettingSwitchRow
        title="Pro on this Mac"
        description="Local testing only. Testers should redeem an invite instead."
        checked={isPro}
        onChange={(enabled) => {
          void setAcornProEntitlement(enabled, enabled ? "dev" : null);
        }}
      />
    );
  }

  if (!isPro) {
    return null;
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          void setAcornProEntitlement(false);
        }}
        className="text-muted-foreground hover:text-foreground text-xs underline-offset-2 hover:underline"
      >
        Use Free on this Mac
      </button>
    </div>
  );
}
