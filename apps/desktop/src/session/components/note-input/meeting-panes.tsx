import type { MouseEventHandler, ReactNode } from "react";

export function MeetingNotePane({
  testId,
  children,
  onMouseDown,
  scrollRef,
}: {
  testId: string;
  children: ReactNode;
  onMouseDown?: MouseEventHandler<HTMLDivElement>;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <section
      data-testid={testId}
      className="flex h-full min-h-0 min-w-0 flex-1 flex-col"
    >
      <div
        ref={scrollRef}
        onMouseDown={onMouseDown}
        className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-3 pb-6"
      >
        {children}
      </div>
    </section>
  );
}
