import { Trans } from "@lingui/react/macro";

export function EmptyEnhanced() {
  return (
    <div
      data-testid="empty-enhanced"
      className="flex h-full min-h-[240px] flex-col justify-center px-3 py-8"
    >
      <div className="flex max-w-sm flex-col gap-1.5">
        <p className="text-foreground text-sm font-medium">
          <Trans>Enhanced note</Trans>
        </p>
        <p className="text-muted-foreground text-sm leading-relaxed">
          <Trans>
            Type during the call. After you stop, this note fills in from your
            words and the transcript.
          </Trans>
        </p>
      </div>
    </div>
  );
}
