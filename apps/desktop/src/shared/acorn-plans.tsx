import { PlanFeatureList } from "@anlg/pricing";
import { cn } from "@anlg/utils";

import { ACORN_PLANS } from "~/shared/product";

export function AcornPlanCards({
  isPro,
  compact = false,
  onShareForPro,
}: {
  isPro: boolean;
  compact?: boolean;
  onShareForPro?: () => void;
}) {
  return (
    <div
      className={cn([
        "grid min-w-0 grid-cols-1 gap-3",
        compact ? "sm:grid-cols-2 sm:gap-2" : "sm:grid-cols-2 sm:gap-3",
      ])}
    >
      {ACORN_PLANS.map((tier) => {
        const isCurrent =
          (tier.id === "pro" && isPro) || (tier.id === "free" && !isPro);
        const cta = isCurrent ? (
          <div className="border-border bg-muted text-muted-foreground flex h-8 w-full items-center justify-center rounded-full border text-xs">
            Current plan
          </div>
        ) : tier.id === "pro" && onShareForPro ? (
          <button
            type="button"
            onClick={onShareForPro}
            className="bg-primary text-primary-foreground hover:bg-primary/90 flex h-8 w-full items-center justify-center rounded-full text-xs font-medium"
          >
            Share to get Pro
          </button>
        ) : null;

        return (
          <div
            key={tier.id}
            className={cn([
              "flex min-w-0 flex-col rounded-2xl border",
              compact ? "gap-2.5 p-3.5" : "gap-3 p-4",
              isCurrent
                ? "border-border bg-muted/40"
                : "border-border/70 bg-background/40",
            ])}
          >
            <div>
              <span className="text-foreground font-sans text-base font-medium">
                {tier.name}
              </span>
              <div className={compact ? "mt-0.5" : "mt-1"}>
                <span
                  className={cn([
                    "text-muted-foreground font-sans",
                    compact ? "text-base" : "text-xl",
                  ])}
                >
                  {tier.price}
                </span>
              </div>
              {tier.subtitle ? (
                <p className="text-muted-foreground mt-0.5 text-xs">
                  {tier.subtitle}
                </p>
              ) : null}
            </div>
            <PlanFeatureList features={tier.features} dense />
            {cta ? <div className="mt-auto pt-1">{cta}</div> : null}
          </div>
        );
      })}
    </div>
  );
}
