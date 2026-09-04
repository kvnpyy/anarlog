import { cn } from "@anlg/utils";

import { setSessionFabSelectionHost } from "./selection-slot";

import type { EditorView, Tab } from "~/store/zustand/tabs/schema";

export function FloatingActionButton(_props: {
  allowListening?: boolean;
  audioExists?: boolean;
  currentView: EditorView;
  skipReason?: string | null;
  tab: Extract<Tab, { type: "sessions" }>;
}) {
  return (
    <div
      className={cn([
        "pointer-events-none absolute bottom-3 left-1/2 z-30 flex max-w-[calc(100%-2rem)] -translate-x-1/2 flex-col-reverse items-center",
      ])}
    >
      <div
        className="h-10 w-[min(640px,100%)]"
        aria-hidden="true"
        data-session-chat-input-spacer
      />
      <div
        ref={setSessionFabSelectionHost}
        data-session-fab-selection
        className="pointer-events-auto z-10 mb-2"
      />
    </div>
  );
}
