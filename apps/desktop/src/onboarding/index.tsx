import { Trans } from "@lingui/react/macro";
import { SpeakerHigh, SpeakerX } from "@phosphor-icons/react";
import { useQueryClient } from "@tanstack/react-query";
import { platform } from "@tauri-apps/plugin-os";
import { motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";

import { commands as sfxCommands } from "@anlg/plugin-sfx";
import { cn } from "@anlg/utils";

import { LoginSection } from "./account";
import { CalendarSection } from "./calendar";
import {
  getInitialStep,
  getNextStep,
  getPrevStep,
  getStepStatus,
} from "./config";
import { FinalDescription, FinalSection, finishOnboarding } from "./final";
import { FolderLocationSection } from "./folder-location";
import { ImportSection } from "./imports";
import { PermissionsSection } from "./permissions";
import { OnboardingSection } from "./shared";

import { trackAnalyticsEvent } from "~/analytics";
import { useAuth } from "~/auth";
import { LOCAL_ONLY, PRODUCT_NAME, PRODUCT_TAGLINE } from "~/shared/product";
import { StandaloneWindowShell } from "~/shared/window-shell";
import { type Tab, useTabs } from "~/store/zustand/tabs";

export function TabContentOnboarding({
  tab: _tab,
}: {
  tab: Extract<Tab, { type: "onboarding" }>;
}) {
  const openCurrent = useTabs((state) => state.openCurrent);

  const handleFinish = useCallback(
    (sessionId: string) => {
      openCurrent({ type: "sessions", id: sessionId });
    },
    [openCurrent],
  );

  return <OnboardingScreen onFinish={handleFinish} />;
}

function OnboardingScreen({
  onFinish,
}: {
  onFinish: (sessionId: string) => void;
}) {
  return (
    <OnboardingScreenContent
      onFinish={onFinish}
      headerClassName="px-12 pt-4 pb-8"
      headerDragRegion
    />
  );
}

export function StandaloneOnboardingScreen({
  onFinish,
}: {
  onFinish: (sessionId: string) => void;
}) {
  return (
    <StandaloneWindowShell>
      <OnboardingScreenContent
        onFinish={onFinish}
        headerClassName="px-12 pt-4 pb-8"
        headerDragRegion
      />
    </StandaloneWindowShell>
  );
}

function OnboardingScreenContent({
  onFinish,
  headerClassName,
  headerDragRegion = false,
}: {
  onFinish: (sessionId: string) => void;
  headerClassName: string;
  headerDragRegion?: boolean;
}) {
  const queryClient = useQueryClient();
  const auth = useAuth();
  const [isMuted, setIsMuted] = useState(false);
  const [currentStep, setCurrentStep] = useState(getInitialStep);
  const [didSkipLogin, setDidSkipLogin] = useState(false);
  const currentPlatform = platform();

  const goNext = useCallback(() => {
    trackAnalyticsEvent("onboarding_step_completed", {
      step: currentStep,
      platform: currentPlatform,
    });
    const next = getNextStep(currentStep);
    if (next) setCurrentStep(next);
  }, [currentPlatform, currentStep]);

  const skipCurrentStep = useCallback(() => {
    trackAnalyticsEvent("onboarding_step_skipped", {
      step: currentStep,
      platform: currentPlatform,
    });
    const next = getNextStep(currentStep);
    if (next) setCurrentStep(next);
  }, [currentPlatform, currentStep]);

  const goBack = useCallback(() => {
    const prev = getPrevStep(currentStep);
    if (prev) setCurrentStep(prev);
  }, [currentStep]);

  const handleCalendarSignIn = useCallback(() => {
    if (!LOCAL_ONLY) {
      setCurrentStep("login");
    }
    void auth.signIn();
  }, [auth]);

  useEffect(() => {
    trackAnalyticsEvent("onboarding_step_viewed", {
      step: currentStep,
      platform: currentPlatform,
    });
  }, [currentPlatform, currentStep]);

  useEffect(() => {
    sfxCommands.play("BGM").catch(console.error);
    return () => {
      sfxCommands.stop("BGM").catch(console.error);
    };
  }, []);

  useEffect(() => {
    sfxCommands.setVolume("BGM", isMuted ? 0 : 0.2).catch(console.error);
  }, [isMuted]);

  const handleFinish = useCallback(
    (sessionId: string) => {
      trackAnalyticsEvent("onboarding_step_completed", {
        step: "final",
        platform: currentPlatform,
      });
      void queryClient.invalidateQueries({ queryKey: ["onboarding-needed"] });
      onFinish(sessionId);
    },
    [currentPlatform, onFinish, queryClient],
  );

  return (
    <div className="bg-card relative flex h-full min-h-0 flex-col overflow-hidden">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="from-background via-background/90 to-background/40 absolute inset-0 bg-linear-to-b" />
        <motion.div
          className="bg-background absolute inset-0"
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 1.0, ease: "easeOut", delay: 0.1 }}
        />
      </div>

      <div
        data-tauri-drag-region={headerDragRegion || undefined}
        className="relative z-30 flex h-12 shrink-0 items-center justify-end pr-3 pl-12"
      >
        <button
          onClick={() => setIsMuted((prev) => !prev)}
          data-tauri-drag-region="false"
          className="hover:bg-accent rounded-full p-1.5 transition-colors"
          aria-label={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? (
            <SpeakerX size={16} className="text-muted-foreground" />
          ) : (
            <SpeakerHigh size={16} className="text-muted-foreground" />
          )}
        </button>
      </div>

      <div
        data-tauri-drag-region={headerDragRegion || undefined}
        className={cn([
          "relative z-10 flex shrink-0 flex-col items-start justify-center",
          headerClassName,
        ])}
      >
        <div className="flex items-center gap-4">
          <img
            src="/assets/app-icons/stable-light.png"
            alt=""
            className="size-16 shrink-0 rounded-[14px] object-cover object-center"
          />
          <div>
            <h1 className="font-hand text-foreground text-4xl leading-none font-medium tracking-tight">
              Welcome to {PRODUCT_NAME}
            </h1>
            <p className="text-muted-foreground mt-2 text-sm">
              {PRODUCT_TAGLINE}
            </p>
          </div>
        </div>
      </div>

      <div className="scroll-fade-y relative z-10 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-4 px-12 pb-16">
          <OnboardingSection
            title={<Trans>Start with permissions</Trans>}
            completedTitle={<Trans>Permissions granted</Trans>}
            description={
              currentPlatform === "macos"
                ? `${PRODUCT_NAME} needs microphone and system audio to transcribe your meetings, plus Accessibility to read meeting controls, visible chat, and participant status.`
                : `${PRODUCT_NAME} needs access to your microphone and system audio to record and transcribe your meetings`
            }
            status={getStepStatus("permissions", currentStep)}
            skippable={false}
            onBack={goBack}
            onNext={goNext}
          >
            <PermissionsSection onContinue={goNext} />
          </OnboardingSection>

          {!LOCAL_ONLY ? (
            <OnboardingSection
              title={<Trans>Create account</Trans>}
              description={
                <Trans>
                  Sign in to unlock powerful AI models, sync across devices, and
                  personalization.
                </Trans>
              }
              completedTitle={
                auth.session ? (
                  <Trans>Signed in</Trans>
                ) : didSkipLogin ? (
                  <Trans>Skipped</Trans>
                ) : (
                  <Trans>Account</Trans>
                )
              }
              status={getStepStatus("login", currentStep)}
              onBack={goBack}
              onNext={goNext}
              onSkip={() => {
                setDidSkipLogin(true);
                trackAnalyticsEvent("onboarding_login_skipped");
                trackAnalyticsEvent("onboarding_step_skipped", {
                  step: "login",
                  platform: currentPlatform,
                });
                const next = getNextStep("login");
                if (next) setCurrentStep(next);
              }}
            >
              <LoginSection
                onContinue={goNext}
                onSkip={() => setDidSkipLogin(true)}
              />
            </OnboardingSection>
          ) : null}

          <OnboardingSection
            title={<Trans>Connect calendar</Trans>}
            description={`${PRODUCT_NAME} will use your calendar to get meeting reminders`}
            completedTitle={<Trans>Calendar connected</Trans>}
            status={getStepStatus("calendar", currentStep)}
            onBack={goBack}
            onNext={goNext}
            onSkip={skipCurrentStep}
          >
            <CalendarSection
              onContinue={goNext}
              onSignIn={handleCalendarSignIn}
            />
          </OnboardingSection>

          <OnboardingSection
            title={<Trans>Import past notes</Trans>}
            description={
              <Trans>
                Bring in transcripts or exports from Zoom, Meet, or another app.
                Acorn records new meetings locally — cloud connect isn’t
                available yet.
              </Trans>
            }
            completedTitle={<Trans>Notes imported</Trans>}
            status={getStepStatus("imports", currentStep)}
            onBack={goBack}
            onNext={goNext}
            onSkip={skipCurrentStep}
          >
            <ImportSection onContinue={goNext} onSkip={skipCurrentStep} />
          </OnboardingSection>

          <OnboardingSection
            title={<Trans>Storage</Trans>}
            description={
              <Trans>Where your notes and recordings are stored</Trans>
            }
            completedTitle={<Trans>Storage configured</Trans>}
            status={getStepStatus("folder-location", currentStep)}
            onBack={goBack}
            onNext={goNext}
            onSkip={skipCurrentStep}
          >
            <FolderLocationSection onContinue={goNext} />
          </OnboardingSection>

          <OnboardingSection
            title={<Trans>Ready to go</Trans>}
            description={<FinalDescription />}
            status={getStepStatus("final", currentStep)}
            skippable={false}
            onBack={goBack}
            onNext={() => void finishOnboarding(handleFinish)}
          >
            <FinalSection onContinue={handleFinish} />
          </OnboardingSection>
        </div>
      </div>
    </div>
  );
}
