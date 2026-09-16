import { useEffect, useState, type FormEvent } from "react";

import { Button } from "@anlg/ui/components/ui/button";
import { Input } from "@anlg/ui/components/ui/input";

import {
  confirmShareVerify,
  ensureShareCode,
  loadShareStatus,
  requestShareVerify,
  SHARE_QUALIFYING_INSTALLS,
  shareMessage,
  syncShareReferrerGrant,
  type ShareRedeemStatus,
} from "~/auth/acorn-share";
import {
  isBusinessEmail,
  normalizeMailbox,
} from "~/contacts/company-from-email";
import { useConfigValues } from "~/shared/config";
import { PRODUCT_NAME } from "~/shared/product";

export function AcornShareCard() {
  const { acorn_share_code: storedCode, acorn_share_email: storedEmail } =
    useConfigValues(["acorn_share_code", "acorn_share_email"]);
  const [email, setEmail] = useState(storedEmail ?? "");
  const [codeInput, setCodeInput] = useState("");
  const [workEmail, setWorkEmail] = useState("");
  const [otpInput, setOtpInput] = useState("");
  const [awaitingCode, setAwaitingCode] = useState(false);
  const [qualifiedCount, setQualifiedCount] = useState(0);
  const [granted, setGranted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pending, setPending] = useState<"copy" | "redeem" | "confirm" | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [redeemed, setRedeemed] = useState(false);

  useEffect(() => {
    setEmail(storedEmail ?? "");
  }, [storedEmail]);

  useEffect(() => {
    if (!storedCode) {
      return;
    }

    let stale = false;
    void (async () => {
      try {
        const status = await loadShareStatus(storedCode);
        if (stale || !status) {
          return;
        }
        setQualifiedCount(status.qualifiedCount);
        setGranted(status.granted);
        if (status.granted) {
          await syncShareReferrerGrant();
        }
      } catch {
        if (!stale) {
          setError("Couldn’t check your share progress. Try again.");
        }
      }
    })();

    return () => {
      stale = true;
    };
  }, [storedCode]);

  async function handleCopyLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) {
      return;
    }

    setPending("copy");
    setError(null);
    try {
      const code = await ensureShareCode(email);
      const status = await loadShareStatus(code);
      if (status) {
        setQualifiedCount(status.qualifiedCount);
        setGranted(status.granted);
        if (status.granted) {
          await syncShareReferrerGrant();
        }
      }
      await navigator.clipboard.writeText(shareMessage(code));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2_000);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Couldn’t create your share link. Try again.",
      );
    } finally {
      setPending(null);
    }
  }

  async function handleRedeem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await sendVerify();
  }

  async function sendVerify() {
    if (pending) {
      return;
    }

    setPending("redeem");
    setError(null);
    try {
      const status = await requestShareVerify(codeInput, workEmail);
      if (status === "ok") {
        finishRedeem();
        return;
      }
      if (status === "sent") {
        setAwaitingCode(true);
        setOtpInput("");
        return;
      }
      setError(redeemError(status));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Couldn’t email a confirmation code. Try again.",
      );
    } finally {
      setPending(null);
    }
  }

  async function handleConfirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) {
      return;
    }

    setPending("confirm");
    setError(null);
    try {
      const status = await confirmShareVerify(codeInput, workEmail, otpInput);
      if (status === "ok") {
        finishRedeem();
        return;
      }
      if (status === "expired") {
        setAwaitingCode(false);
        setOtpInput("");
      }
      setError(redeemError(status));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Couldn’t confirm that code. Try again.",
      );
    } finally {
      setPending(null);
    }
  }

  function finishRedeem() {
    setRedeemed(true);
    setAwaitingCode(false);
    setCodeInput("");
    setWorkEmail("");
    setOtpInput("");
  }

  const mailbox = normalizeMailbox(workEmail);

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-medium">
          Share {PRODUCT_NAME}, get a year of Pro
        </h3>
        <p className="text-muted-foreground mt-1 text-sm">
          Two people install {PRODUCT_NAME} and confirm a work email — not Gmail
          or Outlook. They don’t have to be coworkers.
        </p>
      </div>
      <p className="text-sm">
        {granted
          ? "Unlocked: a year of Pro on this Mac."
          : `${qualifiedCount}/${SHARE_QUALIFYING_INSTALLS} work-email installs`}
      </p>
      <form
        className="flex flex-col gap-2"
        onSubmit={(event) => void handleCopyLink(event)}
      >
        <label
          className="text-muted-foreground text-xs"
          htmlFor="acorn-share-email"
        >
          Your email (so you can’t redeem your own link)
        </label>
        <div className="flex gap-2">
          <Input
            id="acorn-share-email"
            autoComplete="email"
            className="h-8 text-xs"
            disabled={pending !== null}
            onChange={(event) => {
              setEmail(event.target.value);
              if (error) setError(null);
            }}
            placeholder="you@company.com"
            type="email"
            value={email}
          />
          <Button
            className="h-8 shrink-0 rounded-full px-3 text-xs"
            disabled={pending !== null || email.trim().length === 0}
            type="submit"
          >
            {copied ? "Copied" : pending === "copy" ? "Copying…" : "Copy link"}
          </Button>
        </div>
      </form>
      {awaitingCode ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(event) => void handleConfirm(event)}
        >
          <label
            className="text-muted-foreground text-xs"
            htmlFor="acorn-share-otp"
          >
            We sent a code to {mailbox ?? workEmail}. Enter it to prove that
            inbox is yours.
          </label>
          <Input
            id="acorn-share-otp"
            autoComplete="one-time-code"
            className="h-8 font-mono text-xs tracking-widest"
            disabled={pending !== null}
            inputMode="numeric"
            maxLength={6}
            onChange={(event) => {
              setOtpInput(event.target.value.replace(/\D/g, "").slice(0, 6));
              if (error) setError(null);
            }}
            placeholder="6-digit code"
            value={otpInput}
          />
          <div className="flex gap-2">
            <Button
              className="h-8 w-fit rounded-full px-3 text-xs"
              disabled={pending !== null || otpInput.length !== 6}
              type="submit"
            >
              {pending === "confirm" ? "Confirming…" : "Confirm email"}
            </Button>
            <Button
              className="h-8 w-fit rounded-full px-3 text-xs"
              disabled={pending !== null}
              onClick={() => void sendVerify()}
              type="button"
              variant="ghost"
            >
              {pending === "redeem" ? "Sending…" : "Resend code"}
            </Button>
          </div>
        </form>
      ) : (
        <form
          className="flex flex-col gap-2"
          onSubmit={(event) => void handleRedeem(event)}
        >
          <label
            className="text-muted-foreground text-xs"
            htmlFor="acorn-share-code"
          >
            Have a share code?
          </label>
          <Input
            id="acorn-share-code"
            autoComplete="off"
            className="h-8 font-mono text-xs"
            disabled={pending !== null}
            onChange={(event) => {
              setCodeInput(event.target.value);
              if (error) setError(null);
            }}
            placeholder="Share code"
            spellCheck={false}
            value={codeInput}
          />
          <Input
            aria-label="Work email for share code"
            autoComplete="email"
            className="h-8 text-xs"
            disabled={pending !== null}
            onChange={(event) => {
              setWorkEmail(event.target.value);
              if (error) setError(null);
            }}
            placeholder="Work email"
            type="email"
            value={workEmail}
          />
          <Button
            className="h-8 w-fit rounded-full px-3 text-xs"
            disabled={
              pending !== null ||
              codeInput.trim().length === 0 ||
              workEmail.trim().length === 0 ||
              !isBusinessEmail(workEmail)
            }
            type="submit"
          >
            {pending === "redeem" ? "Sending code…" : "Email me a code"}
          </Button>
          {workEmail.trim() && !isBusinessEmail(workEmail) ? (
            <p className="text-muted-foreground text-xs">
              Use a company email, not Gmail, Outlook, or iCloud.
            </p>
          ) : (
            <p className="text-muted-foreground text-xs">
              We’ll email that work inbox a code. Typing the address isn’t
              enough.
            </p>
          )}
        </form>
      )}
      {redeemed ? (
        <p className="text-xs">You have 30 days of Pro on this Mac.</p>
      ) : null}
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
    </div>
  );
}

function redeemError(status: ShareRedeemStatus): string {
  switch (status) {
    case "personal":
      return "Use a company email, not Gmail, Outlook, or iCloud.";
    case "self":
      return "You can’t redeem your own share link.";
    case "duplicate":
      return "That work email already counted toward a share.";
    case "missing":
      return "That share code wasn’t found.";
    case "full":
      return "That share already has two installs.";
    case "cooldown":
      return "Wait a minute, then resend the code.";
    case "mismatch":
      return "That code doesn’t match. Check the email and try again.";
    case "expired":
      return "That code expired. Send a new one.";
    case "sent":
      return "Check that work inbox for a 6-digit code.";
    default:
      return "That share code isn’t valid.";
  }
}
