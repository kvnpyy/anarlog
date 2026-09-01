import { platform } from "@tauri-apps/plugin-os";

import type { SectionStatus } from "./shared";

import { LOCAL_ONLY } from "~/shared/product";

export type OnboardingStep =
  | "permissions"
  | "login"
  | "calendar"
  | "imports"
  | "folder-location"
  | "final";

const STEPS_MACOS: OnboardingStep[] = LOCAL_ONLY
  ? ["permissions", "calendar", "imports", "folder-location", "final"]
  : ["permissions", "login", "calendar", "imports", "folder-location", "final"];
const STEPS_OTHER: OnboardingStep[] = LOCAL_ONLY
  ? ["calendar", "imports", "folder-location", "final"]
  : ["login", "calendar", "imports", "folder-location", "final"];

function getOnboardingSteps(): OnboardingStep[] {
  return platform() === "macos" ? STEPS_MACOS : STEPS_OTHER;
}

export function getInitialStep(): OnboardingStep {
  return getOnboardingSteps()[0];
}

export function getNextStep(
  currentStep: OnboardingStep,
): OnboardingStep | null {
  const steps = getOnboardingSteps();
  const idx = steps.indexOf(currentStep);
  return idx < steps.length - 1 ? steps[idx + 1] : null;
}

export function getPrevStep(
  currentStep: OnboardingStep,
): OnboardingStep | null {
  const steps = getOnboardingSteps();
  const idx = steps.indexOf(currentStep);
  return idx > 0 ? steps[idx - 1] : null;
}

export function getStepStatus(
  step: OnboardingStep,
  currentStep: OnboardingStep,
): SectionStatus | null {
  const steps = getOnboardingSteps();
  const stepIdx = steps.indexOf(step);
  if (stepIdx === -1) return null;
  const currentIdx = steps.indexOf(currentStep);
  if (stepIdx < currentIdx) return "completed";
  if (stepIdx === currentIdx) return "active";
  return "upcoming";
}
