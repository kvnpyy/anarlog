import { Check } from "@phosphor-icons/react";
import { motion } from "motion/react";
import type { ComponentProps } from "react";

import { cn } from "@anlg/utils";

export type ActivityStepState = "active" | "done" | "failed" | "queued";

export type ActivityTrailStep = {
  id: string;
  label: string;
  detail?: string;
  state: ActivityStepState;
};

export type ActivityTrailSource = {
  id: string;
  label: string;
};

const SKELETON_WIDTHS = ["w-4/5", "w-full", "w-11/12", "w-2/3"] as const;

export function ActivityTrail({
  steps,
  sources = [],
  sourceHeading,
  caption,
  compact = false,
  showNoteSkeleton = false,
  className,
  ...rest
}: {
  steps: ActivityTrailStep[];
  sources?: ActivityTrailSource[];
  sourceHeading?: string;
  caption?: string;
  compact?: boolean;
  showNoteSkeleton?: boolean;
  className?: string;
} & ComponentProps<"div">) {
  const visibleSteps = compact
    ? steps.filter((step) => step.state === "active").slice(-1)
    : steps;
  const shownSources = sources.slice(0, compact ? 2 : 4);
  const hiddenSourceCount = sources.length - shownSources.length;
  const active = steps.some((step) => step.state === "active");
  const doneCount = steps.filter((step) => step.state === "done").length;
  const inkedLines = Math.round(
    (doneCount / Math.max(steps.length, 1)) * SKELETON_WIDTHS.length,
  );

  return (
    <div
      data-activity-trail={compact ? "compact" : "full"}
      className={cn([
        "relative",
        compact
          ? "flex flex-col gap-1.5"
          : "border-border/70 bg-muted/35 overflow-hidden rounded-2xl border px-3.5 py-3",
        className,
      ])}
      {...rest}
    >
      {active && !compact ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          <span className="animate-shimmer via-foreground/10 absolute inset-y-0 w-1/2 bg-linear-to-r from-transparent to-transparent motion-reduce:animate-none" />
        </span>
      ) : null}
      <ol className={cn(["relative flex flex-col", compact && "gap-0"])}>
        {visibleSteps.map((step, index) => (
          <li
            key={step.id}
            className={cn([
              !compact && "grid grid-cols-[0.875rem_1fr] gap-x-2.5",
            ])}
          >
            {compact ? null : (
              <div className="flex flex-col items-center">
                <StepNode state={step.state} />
                {index < visibleSteps.length - 1 ? (
                  <span
                    aria-hidden="true"
                    className={cn([
                      "my-1 w-px flex-1",
                      step.state === "done" ? "bg-foreground/25" : "bg-border",
                    ])}
                  />
                ) : null}
              </div>
            )}
            <div
              className={cn([
                compact ? "flex min-w-0 items-center gap-2" : "min-w-0",
                !compact && index < visibleSteps.length - 1 && "pb-3",
                step.state === "queued" && "opacity-45",
              ])}
              data-activity-step={step.state}
            >
              {compact ? <StepNode state={step.state} /> : null}
              <div className="min-w-0">
                <p
                  className={cn([
                    "text-sm leading-5",
                    step.state === "active"
                      ? "text-foreground"
                      : "text-muted-foreground",
                  ])}
                >
                  {step.label}
                </p>
                {step.detail && step.state !== "queued" ? (
                  <p className="text-muted-foreground truncate text-xs leading-5">
                    {step.detail}
                  </p>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ol>
      {shownSources.length > 0 ? (
        <div className={cn(["flex flex-col gap-1.5", !compact && "mt-1"])}>
          {sourceHeading && !compact ? (
            <p className="text-muted-foreground text-[11px] tracking-wide">
              {sourceHeading}
            </p>
          ) : null}
          <ul className="flex flex-wrap items-center gap-1.5">
            {shownSources.map((source) => (
              <motion.li
                key={source.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, ease: "easeOut" }}
                className="border-border bg-background text-foreground/80 max-w-40 truncate rounded-full border px-2 py-0.5 text-[11px] leading-4"
              >
                {source.label}
              </motion.li>
            ))}
            {hiddenSourceCount > 0 ? (
              <li className="text-muted-foreground text-[11px] leading-4">
                +{hiddenSourceCount}
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
      {showNoteSkeleton ? (
        <div
          aria-hidden="true"
          data-testid="summary-forming"
          className="border-foreground/10 mt-3 flex flex-col gap-2 border-t pt-3"
        >
          {SKELETON_WIDTHS.map((width, index) => (
            <span
              key={width}
              data-inked={index < inkedLines ? "true" : "false"}
              className={cn([
                "h-2 rounded-full",
                width,
                index < inkedLines
                  ? "bg-foreground/15"
                  : "bg-foreground/10 animate-pulse motion-reduce:animate-none",
              ])}
            />
          ))}
        </div>
      ) : null}
      {caption ? (
        <p className="text-muted-foreground mt-2 text-xs leading-5">
          {caption}
        </p>
      ) : null}
    </div>
  );
}

function StepNode({ state }: { state: ActivityStepState }) {
  if (state === "done") {
    return (
      <span className="bg-foreground text-background mt-0.5 flex size-3.5 shrink-0 items-center justify-center rounded-full">
        <Check weight="bold" className="size-2" />
      </span>
    );
  }

  if (state === "active") {
    return (
      <span className="relative mt-1 flex size-3.5 shrink-0 items-center justify-center">
        <span className="bg-foreground/20 absolute size-3.5 animate-ping rounded-full motion-reduce:animate-none" />
        <span className="bg-foreground relative size-1.5 rounded-full" />
      </span>
    );
  }

  return (
    <span
      className={cn([
        "border-foreground/25 mt-1 size-3.5 shrink-0 rounded-full border",
        state === "failed" && "bg-foreground/10",
      ])}
    />
  );
}
