import type { MouseEvent } from "react";

import { PlanFeatureList } from "@anlg/pricing";
import { Button } from "@anlg/ui/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@anlg/ui/components/ui/dialog";

import {
  ACORN_PLANS,
  ACORN_PRO_CHECKOUT_HREF,
  PRODUCT_NAME,
} from "~/shared/product";
import {
  GlassDialogCancelButton,
  GlassDialogContent,
} from "~/shared/ui/glass-dialog";

function handleInertCheckout(event: MouseEvent<HTMLAnchorElement>) {
  event.preventDefault();
}

export function AcornPlansDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <GlassDialogContent className="max-w-[640px] overflow-y-auto">
        <DialogHeader className="text-left sm:text-left">
          <DialogTitle>Plans</DialogTitle>
          <DialogDescription>
            Compare {PRODUCT_NAME} Free and Pro. Checkout will open when{" "}
            {PRODUCT_NAME} is public.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {ACORN_PLANS.map((tier) => (
            <div key={tier.id} className="flex flex-col p-2">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-foreground font-sans text-base font-medium">
                  {tier.name}
                </span>
              </div>
              <div className="mb-2">
                <span className="text-muted-foreground font-sans text-xl">
                  {tier.price}
                </span>
                {tier.period ? (
                  <span className="text-muted-foreground ml-1 text-sm">
                    {tier.period}
                  </span>
                ) : null}
                {tier.subtitle ? (
                  <div className="text-muted-foreground mt-0.5 text-xs">
                    {tier.subtitle}
                  </div>
                ) : null}
              </div>
              <div className="mb-3">
                <PlanFeatureList features={tier.features} dense />
              </div>
              <div className="mt-auto">
                {tier.id === "free" ? (
                  <div className="border-border bg-muted text-muted-foreground flex h-8 w-full items-center justify-center rounded-full border text-xs">
                    Current plan
                  </div>
                ) : (
                  <a
                    href={ACORN_PRO_CHECKOUT_HREF}
                    aria-disabled="true"
                    onClick={handleInertCheckout}
                    className="bg-primary text-primary-foreground flex h-8 w-full cursor-not-allowed items-center justify-center rounded-full text-xs font-medium no-underline opacity-80"
                  >
                    Get Pro
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
        <DialogFooter className="sm:justify-end">
          <GlassDialogCancelButton
            type="button"
            onClick={() => onOpenChange(false)}
          >
            Dismiss
          </GlassDialogCancelButton>
        </DialogFooter>
      </GlassDialogContent>
    </Dialog>
  );
}

export function AcornProLockOverlay({
  title,
  description,
  onSeePlans,
}: {
  title?: string;
  description: string;
  onSeePlans: () => void;
}) {
  return (
    <div className="bg-background/40 absolute inset-0 z-10 flex justify-center pt-10 backdrop-blur-[1px]">
      <div className="border-border bg-card/95 sticky top-10 mx-4 flex h-fit max-w-sm flex-col gap-3 rounded-2xl border p-5 shadow-lg">
        <h3 className="font-sans text-base font-semibold">
          {title ?? `${PRODUCT_NAME} Pro`}
        </h3>
        <p className="text-muted-foreground text-sm leading-5">{description}</p>
        <Button
          type="button"
          className="h-8 rounded-full text-xs"
          onClick={onSeePlans}
        >
          See plans
        </Button>
      </div>
    </div>
  );
}
