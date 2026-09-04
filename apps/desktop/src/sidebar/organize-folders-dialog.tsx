import { Plural, Trans, useLingui } from "@lingui/react/macro";
import { useMutation } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { Button } from "@anlg/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@anlg/ui/components/ui/dialog";
import { sonnerToast } from "@anlg/ui/components/ui/toast";
import { cn } from "@anlg/utils";

import {
  assignSessionsToFolder,
  useSmartFolderSuggestions,
} from "~/session/queries";
import type { SmartFolderSuggestion } from "~/session/smart-folders";
import { useFolderFilter } from "~/store/zustand/folder-filter";

export function OrganizeFoldersDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useLingui();
  const suggestions = useSmartFolderSuggestions(open);
  const setActiveFolderPath = useFolderFilter(
    (state) => state.setActiveFolderPath,
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const selectedSuggestions = useMemo(
    () => suggestions.filter((suggestion) => selectedIds.has(suggestion.id)),
    [selectedIds, suggestions],
  );

  const applyMutation = useMutation({
    mutationFn: async (groups: SmartFolderSuggestion[]) => {
      let filed = 0;
      for (const group of groups) {
        filed += await assignSessionsToFolder(group.sessionIds, group.name);
      }
      return { filed, folderName: groups[0]?.name ?? "" };
    },
    onSuccess: ({ filed, folderName }, groups) => {
      if (filed > 0 && groups.length === 1 && folderName) {
        setActiveFolderPath(folderName);
      }
      onOpenChange(false);
      setSelectedIds(new Set());
      sonnerToast.success(
        filed === 1
          ? t`Filed 1 meeting`
          : t`Filed ${filed} meetings into folders`,
      );
    },
    onError: (error) => {
      sonnerToast.error(
        error instanceof Error
          ? error.message
          : t`Could not file meetings into folders`,
      );
    },
  });

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setSelectedIds(new Set());
    }
    onOpenChange(nextOpen);
  };

  const toggleSuggestion = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            <Trans>Organize meetings</Trans>
          </DialogTitle>
          <DialogDescription>
            <Trans>
              Group recurring meetings, same titles, and people you meet often
              into folders.
            </Trans>
          </DialogDescription>
        </DialogHeader>
        {suggestions.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            <Trans>
              Nothing to group yet. Recurring meetings and repeat guests will
              show up here.
            </Trans>
          </p>
        ) : (
          <ul className="flex max-h-80 flex-col gap-1 overflow-y-auto">
            {suggestions.map((suggestion) => {
              const selected = selectedIds.has(suggestion.id);
              return (
                <li key={suggestion.id}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    className={cn([
                      "flex w-full flex-col gap-0.5 rounded-lg border px-3 py-2 text-left",
                      selected
                        ? "border-foreground/20 bg-accent"
                        : "hover:bg-accent/60 border-transparent",
                    ])}
                    onClick={() => toggleSuggestion(suggestion.id)}
                  >
                    <span className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {suggestion.name}
                      </span>
                      <span className="text-muted-foreground shrink-0 text-xs">
                        <Plural
                          value={suggestion.sessionIds.length}
                          one="# meeting"
                          other="# meetings"
                        />
                      </span>
                    </span>
                    <span className="text-muted-foreground truncate text-xs">
                      {suggestion.reason === "same_series"
                        ? t`Recurring series`
                        : suggestion.reason === "matching_title"
                          ? t`Same title`
                          : t`Same people`}
                      {suggestion.titles[0]
                        ? ` · ${suggestion.titles.slice(0, 2).join(" · ")}`
                        : ""}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => handleOpenChange(false)}
          >
            <Trans>Cancel</Trans>
          </Button>
          <Button
            type="button"
            disabled={
              selectedSuggestions.length === 0 || applyMutation.isPending
            }
            onClick={() => applyMutation.mutate(selectedSuggestions)}
          >
            {selectedSuggestions.length === 0 ? (
              <Trans>File selected</Trans>
            ) : (
              <Trans>File selected ({selectedSuggestions.length})</Trans>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
