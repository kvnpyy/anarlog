import { Trans, useLingui } from "@lingui/react/macro";
import { CircleNotch, UploadSimple } from "@phosphor-icons/react";
import { useMutation } from "@tanstack/react-query";
import { open as selectFiles } from "@tauri-apps/plugin-dialog";

import { commands as importerCommands } from "@anlg/plugin-importer";

import { OnboardingButton } from "./shared";

import { importMeetingFiles } from "~/imports/queries";

const IMPORT_EXTENSIONS = [
  "csv",
  "json",
  "md",
  "markdown",
  "srt",
  "txt",
  "vtt",
];

const FILE_IMPORT_PROVIDER_ID = "files";

export function ImportSection({
  onContinue,
  onSkip,
}: {
  onContinue: () => void;
  onSkip: () => void;
}) {
  const { t } = useLingui();
  const importMutation = useMutation({
    mutationFn: async () => {
      const selection = await selectFiles({
        title: t`Choose transcript or export files`,
        multiple: true,
        directory: false,
        filters: [
          {
            name: t`Transcripts and exports`,
            extensions: IMPORT_EXTENSIONS,
          },
        ],
      });
      const paths = Array.isArray(selection)
        ? selection
        : selection
          ? [selection]
          : [];
      if (paths.length === 0) return null;

      const filesResult = await importerCommands.readTextFiles(paths);
      if (filesResult.status === "error") throw new Error(filesResult.error);
      return importMeetingFiles(FILE_IMPORT_PROVIDER_ID, filesResult.data);
    },
  });

  const result = importMutation.data;

  return (
    <div className="flex flex-col items-start gap-3">
      {importMutation.error ? (
        <p className="text-destructive text-sm">
          {importMutation.error.message}
        </p>
      ) : null}
      {result ? (
        <div className="border-border bg-card rounded-xl border px-4 py-3 text-sm">
          {result.imported > 0 ? (
            <Trans>
              Brought in {result.imported} new meetings. {result.matched} were
              already here.
            </Trans>
          ) : result.errors > 0 || result.conflicts > 0 ? (
            <Trans>
              Nothing new was imported. {result.conflicts} meetings need review
              and {result.errors} could not be imported.
            </Trans>
          ) : (
            <Trans>Everything is already here.</Trans>
          )}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <OnboardingButton
          onClick={() => void importMutation.mutateAsync()}
          disabled={importMutation.isPending}
          className="flex items-center gap-2 px-6 py-2 text-sm disabled:opacity-70"
        >
          {importMutation.isPending ? (
            <CircleNotch className="size-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <UploadSimple className="size-3.5" aria-hidden="true" />
          )}
          <Trans>Choose files</Trans>
        </OnboardingButton>
        {result && result.imported > 0 ? (
          <OnboardingButton onClick={onContinue} className="px-6 py-2">
            <Trans>Continue</Trans>
          </OnboardingButton>
        ) : (
          <OnboardingButton
            variant="secondary"
            onClick={onSkip}
            className="px-6 py-2"
          >
            <Trans>Skip for now</Trans>
          </OnboardingButton>
        )}
      </div>
    </div>
  );
}
