import { AnimatePresence, motion } from "motion/react";
import { useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useHotkeys } from "react-hotkeys-hook";

import { cn } from "@anlg/utils";

import { ChatPanelFrame } from "./chat-panel";

import type { ChatSessionRenderProps } from "~/chat/components/session-provider";
import {
  isPageIntegratedChat,
  shouldCollapsePageChatOnNoteClick,
  shouldExpandPageChatOnComposerClick,
} from "~/chat/page-integrated";
import {
  chatFloatingPanelShellClassNames,
  chatPageIntegratedShellClassNames,
} from "~/chat/surface";
import { useShell } from "~/contexts/shell";

const FLOATING_CHAT_INPUT_MAX_WIDTH = 640;
const FLOATING_CHAT_SHELL_INSET = 4;
const FLOATING_PANEL_MIN_WIDTH = 476;
const FLOATING_PANEL_DEFAULT_MAX_WIDTH =
  FLOATING_CHAT_INPUT_MAX_WIDTH + FLOATING_CHAT_SHELL_INSET * 2;
const FLOATING_PANEL_TOP_CLEARANCE = 46;
const FLOATING_PANEL_EASE = [0.22, 1, 0.36, 1] as const;
const PAGE_COMPOSER_MAX_HEIGHT = "22rem";

type FloatingContainerRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

export function PersistentChatPanel({
  floatingContainerRef,
  sessionProps,
  tabType,
}: {
  floatingContainerRef: React.RefObject<HTMLDivElement | null>;
  sessionProps: ChatSessionRenderProps | null;
  tabType?: string;
}) {
  const { chat } = useShell();
  const isVisible = chat.mode !== "RightPanelOpen";
  const messageCount = sessionProps?.messages.length ?? 0;
  const pageIntegrated = isPageIntegratedChat({
    mode: chat.mode,
    messageCount,
    status: sessionProps?.status,
    tabType,
  });
  const collapseOnNoteClick = shouldCollapsePageChatOnNoteClick({
    pageIntegrated,
    mode: chat.mode,
    messageCount,
    status: sessionProps?.status,
  });
  const expandOnComposerClick = shouldExpandPageChatOnComposerClick({
    pageIntegrated,
    mode: chat.mode,
  });

  const [containerRect, setContainerRect] =
    useState<FloatingContainerRect | null>(null);
  const [pageSlot, setPageSlot] = useState<HTMLElement | null>(null);
  const [draftHasContent, setDraftHasContent] = useState(false);

  const getActiveContainer = () => {
    return (
      floatingContainerRef.current?.querySelector<HTMLDivElement>(
        "[data-chat-floating-anchor]",
      ) ?? floatingContainerRef.current
    );
  };

  const getPageSlot = () => {
    return (
      floatingContainerRef.current?.querySelector<HTMLElement>(
        "[data-chat-page-slot]",
      ) ?? null
    );
  };

  const getContainerRect = () => {
    const anchor = getActiveContainer();

    if (!anchor) {
      return null;
    }

    return toFloatingContainerRect(anchor.getBoundingClientRect());
  };

  useHotkeys(
    "esc",
    () => chat.sendEvent({ type: "CLOSE" }),
    {
      enabled: isVisible && (!pageIntegrated || collapseOnNoteClick),
      preventDefault: true,
      enableOnFormTags: true,
      enableOnContentEditable: true,
    },
    [chat, isVisible, pageIntegrated, collapseOnNoteClick],
  );

  useEffect(() => {
    if (!collapseOnNoteClick) {
      return;
    }

    const noteSurface = floatingContainerRef.current?.querySelector(
      "[data-chat-page-content]",
    );
    if (!noteSurface) {
      return;
    }

    const handleNotePointerDown = () => {
      chat.sendEvent({ type: "CLOSE" });
    };

    noteSurface.addEventListener("pointerdown", handleNotePointerDown);
    return () => {
      noteSurface.removeEventListener("pointerdown", handleNotePointerDown);
    };
  }, [chat, collapseOnNoteClick, floatingContainerRef, pageSlot]);

  useLayoutEffect(() => {
    if (!isVisible || !pageIntegrated) {
      setPageSlot(null);
      return;
    }

    const syncSlot = () => {
      const nextSlot = getPageSlot();
      setPageSlot((currentSlot) =>
        currentSlot === nextSlot ? currentSlot : nextSlot,
      );
      return nextSlot;
    };

    if (syncSlot()) {
      const root = floatingContainerRef.current;
      if (!root) {
        return;
      }

      const observer = new MutationObserver(() => {
        syncSlot();
      });
      observer.observe(root, { childList: true, subtree: true });
      return () => {
        observer.disconnect();
      };
    }

    const frame = window.requestAnimationFrame(() => {
      syncSlot();
    });
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [isVisible, pageIntegrated, floatingContainerRef, pageSlot]);

  useLayoutEffect(() => {
    const root = floatingContainerRef.current;
    const container = getActiveContainer();

    if (!isVisible || pageIntegrated || !root || !container) {
      return;
    }

    const updateRect = () => {
      const nextRect = getContainerRect();
      setContainerRect((currentRect) =>
        areFloatingContainerRectsEqual(currentRect, nextRect)
          ? currentRect
          : nextRect,
      );
    };

    updateRect();
    const observer = new ResizeObserver(updateRect);
    if (root !== container) {
      observer.observe(root);
    }
    observer.observe(container);
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
    };
  }, [isVisible, pageIntegrated, floatingContainerRef]);

  const panelMotion = {
    initial: { y: 10, scale: 0.985 },
    animate: { y: 0, scale: 1 },
    exit: { y: 6, scale: 0.99 },
  };
  const panelTransition = { duration: 0.18, ease: FLOATING_PANEL_EASE };
  const panelStyle = {
    width: "100%",
    minWidth: `min(${FLOATING_PANEL_MIN_WIDTH}px, 100%)`,
    maxWidth: `${FLOATING_PANEL_DEFAULT_MAX_WIDTH}px`,
    maxHeight: "100%",
    transformOrigin: "bottom center",
    willChange: "transform",
  };

  if (typeof document === "undefined") {
    return null;
  }

  if (pageIntegrated) {
    if (!isVisible || !pageSlot) {
      return null;
    }

    return createPortal(
      <div
        data-chat-page-composer
        data-chat-page-integrated="true"
        data-chat-page-thread={collapseOnNoteClick ? "expanded" : "collapsed"}
        className="pointer-events-auto mx-auto w-full max-w-[648px] px-3 pt-1 pb-2"
        onPointerDown={() => {
          if (!expandOnComposerClick) {
            return;
          }
          chat.sendEvent({ type: "OPEN" });
        }}
      >
        <div
          data-chat-panel
          data-chat-panel-reveal="page"
          data-chat-size="floating"
          className={cn([
            "relative flex min-h-0 flex-col overflow-hidden",
            chatPageIntegratedShellClassNames(),
          ])}
          style={{ maxHeight: PAGE_COMPOSER_MAX_HEIGHT }}
        >
          <ChatPanelFrame
            layout="floating"
            pageIntegrated
            onDraftContentChange={setDraftHasContent}
            onOpenRightPanel={() =>
              chat.sendEvent({ type: "OPEN_RIGHT_PANEL" })
            }
            sessionProps={sessionProps}
          />
        </div>
      </div>,
      pageSlot,
    );
  }

  return createPortal(
    <AnimatePresence initial={false}>
      {isVisible && (
        <motion.div
          className="pointer-events-none fixed"
          style={
            containerRect
              ? {
                  top: containerRect.top,
                  left: containerRect.left,
                  width: containerRect.width,
                  height: containerRect.height,
                  willChange: "opacity",
                }
              : { display: "none" }
          }
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12, ease: FLOATING_PANEL_EASE }}
        >
          <div
            data-chat-floating-frame
            className={cn([
              "relative flex h-full min-h-0",
              "pointer-events-auto items-end justify-center px-3 pb-2",
            ])}
            style={{
              paddingTop: FLOATING_PANEL_TOP_CLEARANCE,
            }}
            onClick={(event) => {
              if (event.target !== event.currentTarget) {
                return;
              }
              if (draftHasContent) {
                return;
              }

              chat.sendEvent({ type: "CLOSE" });
            }}
          >
            <motion.div
              data-chat-panel
              data-chat-panel-reveal="lift"
              data-chat-size="floating"
              className={cn([
                "pointer-events-auto relative flex min-h-0 flex-col overflow-hidden",
                chatFloatingPanelShellClassNames(),
              ])}
              style={panelStyle}
              initial={panelMotion.initial}
              animate={panelMotion.animate}
              exit={panelMotion.exit}
              transition={panelTransition}
            >
              <ChatPanelFrame
                layout="floating"
                pageIntegrated={false}
                onDraftContentChange={setDraftHasContent}
                onOpenRightPanel={() =>
                  chat.sendEvent({ type: "OPEN_RIGHT_PANEL" })
                }
                sessionProps={sessionProps}
              />
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function toFloatingContainerRect(rect: DOMRect): FloatingContainerRect {
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  };
}

function areFloatingContainerRectsEqual(
  currentRect: FloatingContainerRect | null,
  nextRect: FloatingContainerRect | null,
) {
  return (
    currentRect?.top === nextRect?.top &&
    currentRect?.left === nextRect?.left &&
    currentRect?.width === nextRect?.width &&
    currentRect?.height === nextRect?.height
  );
}
