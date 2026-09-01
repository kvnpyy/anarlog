import type { EditorView } from "prosemirror-view";
import {
  forwardRef,
  type MouseEventHandler,
  type UIEventHandler,
  useCallback,
  useDeferredValue,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import { useHotkeys } from "react-hotkeys-hook";

import type { JSONContent, NoteEditorRef } from "@anlg/editor/note";

import { Enhanced } from "./enhanced";
import { Header, useEditorTabs } from "./header";
import { MeetingNotePane } from "./meeting-panes";
import { RawEditor } from "./raw";
import { SearchBar } from "./search/bar";
import { useSearch } from "./search/context";
import { Transcript } from "./transcript";

import {
  registerCanonicalSessionEditor,
  unregisterCanonicalSessionEditor,
} from "~/session-sharing/editor-activity";
import {
  getMeetingNotePane,
  getSelectedEnhancedNoteId,
} from "~/session/components/compute-note-tab";
import {
  hasStoredNoteContent,
  useCurrentNoteTab,
} from "~/session/components/shared";
import { useIsSessionEnhancing } from "~/session/hooks/useEnhancedNotes";
import { useEnhancedNote } from "~/session/queries";
import { useScrollPreservation } from "~/shared/hooks/useScrollPreservation";
import type { SessionMode } from "~/store/zustand/listener/general";
import { type Tab, useTabs } from "~/store/zustand/tabs";
import { type EditorView as TabEditorView } from "~/store/zustand/tabs/schema";
import { useListener } from "~/stt/contexts";

export interface NoteInputHandle {
  focus: () => void;
  focusAtStart: () => void;
  focusAtPixelWidth: (pixelWidth: number) => void;
  insertAtStartAndFocus: (content: string) => void;
  replaceContent: (content: JSONContent) => void;
  flushPendingChanges: () => void;
  prepareForTabChange: () => void;
}

type NoteInputProps = {
  tab: Extract<Tab, { type: "sessions" }>;
  rawMd: string;
  sessionTitle: string;
  eventTitle?: string;
  eventDescription?: string;
  onNavigateToTitle?: (pixelWidth?: number) => void;
  onScroll?: UIEventHandler<HTMLDivElement>;
  editorTabs?: TabEditorView[];
  currentTab?: TabEditorView;
  handleTabChange?: (view: TabEditorView) => void;
  hideHeader?: boolean;
  sessionMode?: SessionMode;
  transcriptEditMode?: boolean;
};

export const NoteInput = forwardRef<NoteInputHandle, NoteInputProps>(
  function NoteInput(props, ref) {
    if (
      props.editorTabs &&
      props.currentTab &&
      props.handleTabChange &&
      props.sessionMode !== undefined
    ) {
      return (
        <NoteInputContent
          {...props}
          ref={ref}
          editorTabs={props.editorTabs}
          currentTab={props.currentTab}
          commitTabChange={props.handleTabChange}
          sessionMode={props.sessionMode}
        />
      );
    }

    return <NoteInputWithDerivedState {...props} ref={ref} />;
  },
);

const NoteInputWithDerivedState = forwardRef<NoteInputHandle, NoteInputProps>(
  function NoteInputWithDerivedState(
    { tab, editorTabs, currentTab, handleTabChange, ...props },
    ref,
  ) {
    const fallbackEditorTabs = useEditorTabs({ sessionId: tab.id });
    const fallbackCurrentTab: TabEditorView = useCurrentNoteTab(tab);
    const updateSessionTabState = useTabs(
      (state) => state.updateSessionTabState,
    );
    const tabRef = useRef(tab);
    tabRef.current = tab;
    const sessionMode = useListener((state) => state.getSessionMode(tab.id));

    const commitTabChange = useCallback(
      (tabView: TabEditorView) => {
        if (handleTabChange) {
          handleTabChange(tabView);
          return;
        }

        updateSessionTabState(tabRef.current, {
          ...tabRef.current.state,
          view: tabView,
        });
      },
      [handleTabChange, updateSessionTabState],
    );

    return (
      <NoteInputContent
        {...props}
        ref={ref}
        tab={tab}
        editorTabs={editorTabs ?? fallbackEditorTabs}
        currentTab={currentTab ?? fallbackCurrentTab}
        commitTabChange={commitTabChange}
        sessionMode={props.sessionMode ?? sessionMode}
      />
    );
  },
);

const NoteInputContent = forwardRef<
  NoteInputHandle,
  Omit<NoteInputProps, "editorTabs" | "currentTab" | "handleTabChange"> & {
    editorTabs: TabEditorView[];
    currentTab: TabEditorView;
    commitTabChange: (view: TabEditorView) => void;
    sessionMode: SessionMode;
  }
>(
  (
    {
      tab,
      rawMd,
      sessionTitle,
      eventTitle,
      eventDescription,
      onNavigateToTitle,
      onScroll,
      editorTabs,
      currentTab,
      commitTabChange,
      hideHeader = false,
      sessionMode,
      transcriptEditMode = false,
    },
    ref,
  ) => {
    const rawEditorRef = useRef<NoteEditorRef>(null);
    const enhancedEditorRef = useRef<NoteEditorRef>(null);
    const sessionId = tab.id;
    const deferredCurrentTab = useDeferredValue(currentTab);
    const renderedCurrentTab = editorTabs.some((editorTab) =>
      isSameEditorView(editorTab, deferredCurrentTab),
    )
      ? deferredCurrentTab
      : currentTab;

    const isRecording = sessionMode === "active";
    const isMeetingInProgress =
      isRecording ||
      sessionMode === "finalizing" ||
      sessionMode === "running_batch";
    const enhancedNoteIds = useMemo(
      () =>
        editorTabs.flatMap((view) =>
          view.type === "enhanced" ? [view.id] : [],
        ),
      [editorTabs],
    );
    const selectedEnhancedNoteId = getSelectedEnhancedNoteId(
      renderedCurrentTab,
      enhancedNoteIds,
    );
    const enhancedNote = useEnhancedNote(selectedEnhancedNoteId ?? "");
    const isEnhancing = useIsSessionEnhancing(sessionId);
    const meetingPane = getMeetingNotePane({
      currentView: renderedCurrentTab,
      isRecording,
      enhancedHasContent: hasStoredNoteContent(enhancedNote?.content),
      isEnhancing,
    });
    const showTranscript = meetingPane === "transcript";
    const showEnhanced = meetingPane === "enhanced";
    const activeEditorRef = showEnhanced ? enhancedEditorRef : rawEditorRef;

    const { scrollRef: transcriptScrollRef, onBeforeTabChange } =
      useScrollPreservation("transcript", {
        skipRestoration: !showTranscript,
      });

    const flushPendingChanges = useCallback(() => {
      rawEditorRef.current?.flushPendingChanges();
      enhancedEditorRef.current?.flushPendingChanges();
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        focus: () => activeEditorRef.current?.commands.focus(),
        focusAtStart: () => activeEditorRef.current?.commands.focusAtStart(),
        focusAtPixelWidth: (px) =>
          activeEditorRef.current?.commands.focusAtPixelWidth(px),
        insertAtStartAndFocus: (content) =>
          activeEditorRef.current?.commands.insertAtStartAndFocus(content),
        replaceContent: (content) =>
          activeEditorRef.current?.commands.replaceContent(content),
        flushPendingChanges,
        prepareForTabChange: onBeforeTabChange,
      }),
      [activeEditorRef, flushPendingChanges, onBeforeTabChange],
    );

    const handleTabChange = useCallback(
      (tabView: TabEditorView) => {
        if (
          isSameEditorView(tabView, currentTab) ||
          isSameEditorView(tabView, renderedCurrentTab)
        ) {
          if (tabView.type === "transcript") {
            onBeforeTabChange();
            flushPendingChanges();
            commitTabChange({ type: "raw" });
          }
          return;
        }

        onBeforeTabChange();
        flushPendingChanges();
        commitTabChange(tabView);
      },
      [
        commitTabChange,
        currentTab,
        flushPendingChanges,
        onBeforeTabChange,
        renderedCurrentTab,
      ],
    );

    const handleAdjacentViewShortcut = useCallback(
      (direction: "previous" | "next") => {
        if (editorTabs.length <= 1) {
          return;
        }

        const currentIndex = editorTabs.findIndex((editorTab) =>
          isSameEditorView(editorTab, renderedCurrentTab),
        );
        if (currentIndex === -1) {
          return;
        }

        const nextIndex =
          direction === "previous"
            ? (currentIndex - 1 + editorTabs.length) % editorTabs.length
            : (currentIndex + 1) % editorTabs.length;
        const nextView = editorTabs[nextIndex];
        if (nextView) {
          handleTabChange(nextView);
        }
      },
      [editorTabs, handleTabChange, renderedCurrentTab],
    );

    useHotkeys(
      "mod+alt+left",
      () => handleAdjacentViewShortcut("previous"),
      {
        preventDefault: true,
        enableOnFormTags: true,
        enableOnContentEditable: true,
      },
      [handleAdjacentViewShortcut],
    );

    useHotkeys(
      "mod+alt+right",
      () => handleAdjacentViewShortcut("next"),
      {
        preventDefault: true,
        enableOnFormTags: true,
        enableOnContentEditable: true,
      },
      [handleAdjacentViewShortcut],
    );

    useEffect(() => {
      if (meetingPane === "raw" && isMeetingInProgress) {
        requestAnimationFrame(() => {
          rawEditorRef.current?.commands.focus();
        });
      }
    }, [isMeetingInProgress, meetingPane]);

    const search = useSearch();
    const showSearchBar =
      (search?.isVisible ?? false) && meetingPane !== "transcript";

    useEffect(() => {
      search?.close();
    }, [currentTab]);

    const handleMemoMouseDown = useBlankEditorClick(rawEditorRef);
    const handleEnhancedMouseDown = useBlankEditorClick(enhancedEditorRef);

    const handleRawViewReady = useCallback(
      (view: EditorView) =>
        registerCanonicalSessionEditor(sessionId, view, () => {
          const editor = rawEditorRef.current;
          if (!editor || editor.view !== view) {
            throw new Error("Canonical session editor changed");
          }
          editor.flushPendingChanges();
        }),
      [sessionId],
    );
    const handleRawViewDisposed = useCallback(
      (view: EditorView) => unregisterCanonicalSessionEditor(sessionId, view),
      [sessionId],
    );
    const handleEnhancedViewReady = useCallback(
      (view: EditorView) =>
        registerCanonicalSessionEditor(sessionId, view, () => {
          const editor = enhancedEditorRef.current;
          if (!editor || editor.view !== view) {
            throw new Error("Canonical session editor changed");
          }
          editor.flushPendingChanges();
        }),
      [sessionId],
    );
    const handleEnhancedViewDisposed = useCallback(
      (view: EditorView) => unregisterCanonicalSessionEditor(sessionId, view),
      [sessionId],
    );

    return (
      <div className="-mx-2 flex h-full flex-col">
        {!hideHeader && (
          <div className="relative px-2">
            <div className="flex items-center justify-end gap-1">
              <Header sessionId={sessionId} />
            </div>
          </div>
        )}

        {showSearchBar && (
          <div className="px-3 pt-1">
            <SearchBar editorRef={activeEditorRef} />
          </div>
        )}

        <div className="relative min-h-0 flex-1 overflow-hidden">
          {showTranscript ? (
            <MeetingNotePane
              testId="meeting-transcript-pane"
              scrollRef={transcriptScrollRef}
            >
              <div onScroll={onScroll} className="h-full overflow-hidden pt-2">
                <Transcript
                  sessionId={sessionId}
                  scrollRef={transcriptScrollRef}
                  editMode={transcriptEditMode}
                />
              </div>
            </MeetingNotePane>
          ) : showEnhanced ? (
            <MeetingNotePane
              testId="enhanced-pane"
              onMouseDown={handleEnhancedMouseDown}
            >
              <Enhanced
                ref={enhancedEditorRef}
                sessionId={sessionId}
                sessionTitle={sessionTitle}
                enhancedNoteId={selectedEnhancedNoteId}
                onNavigateToTitle={onNavigateToTitle}
                onViewReady={handleEnhancedViewReady}
                onViewDisposed={handleEnhancedViewDisposed}
              />
            </MeetingNotePane>
          ) : (
            <MeetingNotePane
              testId="memo-pane"
              onMouseDown={handleMemoMouseDown}
            >
              <RawEditor
                ref={rawEditorRef}
                sessionId={sessionId}
                rawMd={rawMd}
                sessionTitle={sessionTitle}
                eventTitle={eventTitle}
                eventDescription={eventDescription}
                onNavigateToTitle={onNavigateToTitle}
                onViewReady={handleRawViewReady}
                onViewDisposed={handleRawViewDisposed}
              />
            </MeetingNotePane>
          )}
        </div>
      </div>
    );
  },
);

function useBlankEditorClick(
  editorRef: React.RefObject<NoteEditorRef | null>,
): MouseEventHandler<HTMLDivElement> {
  return (event) => {
    if (event.button !== 0) {
      return;
    }

    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    if (target.closest(".ProseMirror") !== null) {
      return;
    }

    if (
      target.closest(
        "button, a, input, textarea, select, [role='button'], [contenteditable='true']",
      ) !== null
    ) {
      return;
    }

    if (event.currentTarget.querySelector(".ProseMirror") === null) {
      return;
    }

    event.preventDefault();
    editorRef.current?.commands.focusAtTrailingEmptyLine();
  };
}

function isSameEditorView(left: TabEditorView, right: TabEditorView): boolean {
  if (left.type !== right.type) {
    return false;
  }

  if (left.type === "enhanced" && right.type === "enhanced") {
    return left.id === right.id;
  }

  return true;
}
