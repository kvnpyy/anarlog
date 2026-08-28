import { t } from "@lingui/core/macro";
import { Gear, User } from "@phosphor-icons/react";

import { cn } from "@anlg/utils";

import {
  readUserProfile,
  userProfileInitials,
  userProfileSubtitle,
} from "~/chat/context/user-profile";
import { useConfigValues } from "~/shared/config";
import { useTabs } from "~/store/zustand/tabs";

export function SidebarUserFooter() {
  const openNew = useTabs((state) => state.openNew);
  const profile = readUserProfile(
    useConfigValues([
      "user_profile_name",
      "user_profile_role",
      "user_profile_department",
      "user_profile_context",
    ]),
  );
  const initials = userProfileInitials(profile);
  const subtitle = userProfileSubtitle(profile);
  const displayName = profile.name || t`Add your profile`;

  return (
    <div
      data-sidebar-user-footer
      className="border-border/70 bg-background shrink-0 border-t px-2 pt-2 pb-2"
    >
      <div className="flex items-center gap-1">
        <button
          type="button"
          data-sidebar-profile
          onClick={() =>
            openNew({ type: "settings", state: { tab: "profile" } })
          }
          className={cn([
            "flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left",
            "hover:bg-sidebar-accent/50 transition-colors",
          ])}
        >
          <span
            aria-hidden="true"
            className={cn([
              "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-medium",
              initials
                ? "bg-sidebar-accent text-foreground"
                : "bg-muted text-muted-foreground",
            ])}
          >
            {initials || <User size={14} />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">
              {displayName}
            </span>
            <span className="text-muted-foreground block truncate text-[11px] leading-4">
              {subtitle || t`Name, role, and department`}
            </span>
          </span>
        </button>
        <button
          type="button"
          data-sidebar-settings
          aria-label={t`Settings`}
          onClick={() => openNew({ type: "settings" })}
          className={cn([
            "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground",
            "inline-flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors",
          ])}
        >
          <Gear size={16} />
        </button>
      </div>
    </div>
  );
}
