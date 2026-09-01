import { Trans } from "@lingui/react/macro";
import { WarningCircle } from "@phosphor-icons/react";
import { useMutation } from "@tanstack/react-query";

import { Button } from "@anlg/ui/components/ui/button";

import { useAuth } from "~/auth";

export function EnhanceError({
  error,
  isUnauthenticated,
}: {
  sessionId: string;
  enhancedNoteId: string;
  error: Error | undefined;
  isUnauthenticated: boolean;
}) {
  const auth = useAuth();
  const signInMutation = useMutation({ mutationFn: () => auth.signIn() });

  return (
    <div
      role="alert"
      className="flex h-full min-h-[400px] flex-col items-center justify-center px-6 text-center"
    >
      <WarningCircle
        aria-hidden
        className="text-muted-foreground mb-5 size-9 stroke-[1.5]"
      />
      <div className="mb-6 flex max-w-md flex-col gap-2">
        <p className="text-base font-medium">
          {isUnauthenticated ? (
            <Trans>Sign in to generate this summary</Trans>
          ) : (
            <Trans>Summary generation failed</Trans>
          )}
        </p>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {isUnauthenticated ? (
            <Trans>
              Acorn could not generate this summary because you were not signed
              in. Sign in, then try again.
            </Trans>
          ) : (
            error?.message || (
              <Trans>Something went wrong while generating the summary.</Trans>
            )
          )}
        </p>
      </div>
      {isUnauthenticated ? (
        <Button
          onClick={() => signInMutation.mutate()}
          disabled={signInMutation.isPending}
          size="sm"
          variant="default"
        >
          {signInMutation.isPending ? (
            <Trans>Opening…</Trans>
          ) : (
            <Trans>Sign in</Trans>
          )}
        </Button>
      ) : null}
    </div>
  );
}
