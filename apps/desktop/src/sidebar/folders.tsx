import { Trans, useLingui } from "@lingui/react/macro";
import { FolderSimple, Sparkle } from "@phosphor-icons/react";
import { useMemo, useState } from "react";

import { cn } from "@anlg/utils";

import { OrganizeFoldersDialog } from "./organize-folders-dialog";

import { useFolderSummaries } from "~/session/queries";
import { useFolderFilter } from "~/store/zustand/folder-filter";

export function SidebarFolders() {
  const { t } = useLingui();
  const folders = useFolderSummaries();
  const activeFolderPath = useFolderFilter((state) => state.activeFolderPath);
  const setActiveFolderPath = useFolderFilter(
    (state) => state.setActiveFolderPath,
  );
  const toggleActiveFolderPath = useFolderFilter(
    (state) => state.toggleActiveFolderPath,
  );
  const [organizeOpen, setOrganizeOpen] = useState(false);
  const items = useMemo(
    () => [
      { path: null as string | null, count: null as number | null },
      ...folders,
    ],
    [folders],
  );

  return (
    <div
      data-sidebar-folders
      className="border-border/70 shrink-0 border-b px-2 pb-2"
    >
      <div className="flex h-8 items-center gap-1 px-1">
        <span className="text-muted-foreground min-w-0 flex-1 truncate text-xs font-medium">
          <Trans>Folders</Trans>
        </span>
        <button
          type="button"
          aria-label={t`Organize meetings into folders`}
          title={t`Organize`}
          className={cn([
            "text-muted-foreground hover:bg-accent hover:text-foreground",
            "inline-flex size-6 shrink-0 items-center justify-center rounded-full transition-colors",
          ])}
          onClick={() => setOrganizeOpen(true)}
        >
          <Sparkle size={13} />
        </button>
      </div>
      <div className="flex max-h-40 flex-col gap-0.5 overflow-y-auto">
        {items.map((item) => {
          const selected = item.path
            ? activeFolderPath === item.path
            : activeFolderPath === null;
          const label = item.path ?? t`All notes`;
          return (
            <button
              key={item.path ?? ""}
              type="button"
              aria-pressed={selected}
              className={cn([
                "flex w-full min-w-0 items-center gap-2 rounded-lg px-2 py-1 text-left text-sm",
                selected
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
              ])}
              onClick={() =>
                item.path
                  ? toggleActiveFolderPath(item.path)
                  : setActiveFolderPath(null)
              }
            >
              <FolderSimple
                className="size-3.5 shrink-0 opacity-70"
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1 truncate">{label}</span>
              {item.count != null ? (
                <span className="text-muted-foreground text-[11px] tabular-nums">
                  {item.count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      <OrganizeFoldersDialog
        open={organizeOpen}
        onOpenChange={setOrganizeOpen}
      />
    </div>
  );
}
