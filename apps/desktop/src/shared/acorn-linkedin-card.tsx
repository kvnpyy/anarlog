import { CircleNotch } from "@phosphor-icons/react";
import { useMutation } from "@tanstack/react-query";

import { Button } from "@anlg/ui/components/ui/button";

import {
  grantLinkedInFollow,
  LINKEDIN_CHECK_MS,
  openLinkedInCompanyPage,
} from "~/auth/acorn-linkedin";
import { useConfigValues } from "~/shared/config";
import { PRODUCT_NAME } from "~/shared/product";

export function AcornLinkedInCard() {
  const { acorn_linkedin_granted_at: grantedAt } = useConfigValues([
    "acorn_linkedin_granted_at",
  ]);
  const follow = useMutation({
    mutationFn: async () => {
      await openLinkedInCompanyPage();
      await new Promise((resolve) =>
        window.setTimeout(resolve, LINKEDIN_CHECK_MS),
      );
      await grantLinkedInFollow();
    },
  });
  const granted = Boolean(grantedAt) || follow.isSuccess;

  return (
    <section className="border-border/80 bg-background/30 flex min-w-0 flex-col gap-3 rounded-2xl border p-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-medium">
          Follow {PRODUCT_NAME} on LinkedIn, get 1 month of Pro
        </h3>
        <p className="text-muted-foreground text-sm leading-5">
          Follow our company page. The month adds on top of any Pro time you
          already have.
        </p>
      </div>
      {granted ? (
        <p className="text-sm font-medium">
          Unlocked: 1 month of Pro on this Mac.
        </p>
      ) : follow.isPending ? (
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          <CircleNotch className="size-3.5 animate-spin" aria-hidden="true" />
          Checking your follow…
        </p>
      ) : (
        <Button
          className="h-8 w-fit rounded-full px-3 text-xs"
          onClick={() => follow.mutate()}
          type="button"
        >
          Follow on LinkedIn
        </Button>
      )}
      {follow.isError ? (
        <p className="text-destructive text-xs">
          Couldn’t open LinkedIn. Try again.
        </p>
      ) : null}
    </section>
  );
}
