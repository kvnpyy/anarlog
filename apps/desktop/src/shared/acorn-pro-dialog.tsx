import { useRef } from "react";

import { Button } from "@anlg/ui/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@anlg/ui/components/ui/dialog";

import { useBillingAccess } from "~/auth/billing-context";
import { AcornPlanCards } from "~/shared/acorn-plans";
import { AcornProInviteForm } from "~/shared/acorn-pro-invite-form";
import { AcornShareCard } from "~/shared/acorn-share-card";
import { PRODUCT_NAME } from "~/shared/product";
import {
  GlassDialogCancelButton,
  GlassDialogContent,
} from "~/shared/ui/glass-dialog";
import { useTabs } from "~/store/zustand/tabs";

export function AcornPlansDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { isPro } = useBillingAccess();
  const openNew = useTabs((state) => state.openNew);
  const shareSectionRef = useRef<HTMLDivElement>(null);

  function openProSettings() {
    onOpenChange(false);
    openNew({ type: "settings", state: { tab: "pro" } });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <GlassDialogContent className="max-h-[min(88dvh,720px)] w-[calc(100vw-32px)] max-w-[560px] min-w-0 gap-0 overflow-auto overscroll-contain p-0">
        <DialogHeader className="bg-card/75 sticky top-0 z-10 px-5 pt-5 pb-3 text-left backdrop-blur-md sm:text-left">
          <DialogTitle>Plans</DialogTitle>
          <DialogDescription>
            Free runs Haiku. Pro is smarter AI. Checkout isn’t open yet — share{" "}
            {PRODUCT_NAME} or redeem an invite.
          </DialogDescription>
        </DialogHeader>
        <div className="px-5">
          <AcornPlanCards
            compact
            isPro={isPro}
            onShareForPro={() => {
              shareSectionRef.current?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              });
            }}
          />
          <div ref={shareSectionRef} className="mt-5 scroll-mt-16">
            <AcornShareCard />
          </div>
          <div className="mt-4 mb-5">
            <AcornProInviteForm
              alreadyPro={isPro}
              onRedeemed={() => onOpenChange(false)}
            />
          </div>
        </div>
        <DialogFooter className="border-border/60 bg-card/75 sticky bottom-0 z-10 flex-row items-center justify-between gap-2 border-t px-5 py-3 backdrop-blur-md sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            className="text-muted-foreground h-8 rounded-full px-3 text-xs"
            onClick={openProSettings}
          >
            Open in Settings
          </Button>
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
