import { useEffect, useState } from "react";

import {
  commands as windowsCommands,
  events as windowsEvents,
  type FloatingBarState,
} from "@anlg/plugin-windows";

import { FloatingBarOverlay } from "./bar";

export function FloatingBarOverlayScreen() {
  const [state, setState] = useState<FloatingBarState | null>(null);

  useEffect(() => {
    document.documentElement.dataset.floatingBar = "";

    let cancelled = false;
    const unlisteners: Array<() => void> = [];

    const applyCurrentState = () => {
      void windowsCommands.floatingBarCurrentState().then((result) => {
        if (cancelled || result.status === "error" || !result.data) {
          return;
        }
        setState(result.data);
      });
    };

    Promise.all([
      windowsEvents.floatingBarOverlayState.listen((event) => {
        if (!cancelled) {
          setState(event.payload.state);
        }
      }),
      windowsEvents.floatingBarOverlayAmplitude.listen((event) => {
        if (cancelled) {
          return;
        }
        setState((current) =>
          current
            ? { ...current, amplitude: event.payload.amplitude }
            : current,
        );
      }),
    ]).then((unlistens) => {
      if (cancelled) {
        unlistens.forEach((unlisten) => unlisten());
        return;
      }

      unlisteners.push(...unlistens);
      applyCurrentState();
    });

    return () => {
      cancelled = true;
      delete document.documentElement.dataset.floatingBar;
      unlisteners.forEach((unlisten) => unlisten());
    };
  }, []);

  if (!state) {
    return <div className="h-screen w-screen bg-transparent" />;
  }

  return (
    <div className="h-screen w-screen bg-transparent">
      <FloatingBarOverlay
        state={state}
        onStop={() => {
          void windowsEvents.floatingBarStop.emit({});
        }}
        onToggleExpanded={(expanded) => {
          void windowsEvents.floatingBarSettingsChange.emit({
            floatingBarOpacity: null,
            liveCaptionOpacity: null,
            liveCaptionWidth: null,
            liveCaptionLineCount: null,
            liveCaptionPosition: null,
            liveCaptionMinimized: !expanded,
          });
        }}
      />
    </div>
  );
}
