import { writeText as writeClipboardText } from "@tauri-apps/plugin-clipboard-manager";
import { useEffect, useId, useState, type FormEvent } from "react";

import { Button } from "@anlg/ui/components/ui/button";
import { Input } from "@anlg/ui/components/ui/input";
import { cn } from "@anlg/utils";

import {
  confirmShareVerify,
  formatShareCode,
  loadShareStatus,
  parseInviteEmails,
  requestShareVerify,
  SHARE_QUALIFYING_INSTALLS,
  sendShareInvites,
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
  const [inviteInput, setInviteInput] = useState("");
  const [visibleCode, setVisibleCode] = useState(storedCode ?? "");
  const [sentTo, setSentTo] = useState<string[]>([]);
  const [codeInput, setCodeInput] = useState("");
  const [workEmail, setWorkEmail] = useState("");
  const [otpInput, setOtpInput] = useState("");
  const [awaitingCode, setAwaitingCode] = useState(false);
  const [qualifiedCount, setQualifiedCount] = useState(0);
  const [granted, setGranted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pending, setPending] = useState<"send" | "redeem" | "confirm" | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [redeemed, setRedeemed] = useState(false);
  const emailId = useId();
  const inviteId = useId();
  const codeId = useId();
  const otpId = useId();

  useEffect(() => {
    setEmail(storedEmail ?? "");
  }, [storedEmail]);

  useEffect(() => {
    if (storedCode) {
      setVisibleCode(storedCode);
    }
  }, [storedCode]);

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

  async function handleSendInvites(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) {
      return;
    }

    const recipients = parseInviteEmails(inviteInput, email);
    setPending("send");
    setError(null);
    setNotice(null);
    try {
      const result = await sendShareInvites(email, recipients);
      setVisibleCode(result.code);
      setSentTo(result.sent);
      const status = await loadShareStatus(result.code);
      if (status) {
        setQualifiedCount(status.qualifiedCount);
        setGranted(status.granted);
        if (status.granted) {
          await syncShareReferrerGrant();
        }
      }
      if (result.emailError) {
        setError(result.emailError);
        setNotice("Share the code below if they don’t get an email.");
      } else if (result.failed.length > 0) {
        setError(
          `Couldn’t email ${result.failed.join(", ")}. Share the code below instead.`,
        );
      } else if (result.sent.length > 0) {
        setNotice(
          `Emailed ${result.sent.join(", ")}. If they don’t see it, send them the code below.`,
        );
        setInviteInput("");
      } else {
        setNotice("If they don’t get an email, send them this code.");
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Couldn’t create your share code. Try again.",
      );
    } finally {
      setPending(null);
    }
  }

  async function handleCopyCode() {
    if (!visibleCode) {
      return;
    }

    try {
      await writeClipboardText(formatShareCode(visibleCode));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2_000);
    } catch {
      setNotice("Select the code and copy it if clipboard access is blocked.");
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
  const invitees = parseInviteEmails(inviteInput, email);

  return (
    <section className="border-border/80 bg-background/30 flex min-w-0 flex-col gap-4 rounded-2xl border p-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-medium">
          Share {PRODUCT_NAME}, get 3 months of Pro
        </h3>
        <p className="text-muted-foreground text-sm leading-5">
          Invite two people. We’ll email them a download link and a code. They
          install {PRODUCT_NAME} and confirm a work email — not Gmail or
          Outlook.
        </p>
      </div>
      <ShareProgress count={qualifiedCount} granted={granted} />
      <form
        className="flex min-w-0 flex-col gap-2"
        onSubmit={(event) => void handleSendInvites(event)}
      >
        <label className="text-muted-foreground text-xs" htmlFor={emailId}>
          Your email (so you can’t redeem your own invite)
        </label>
        <Input
          id={emailId}
          autoComplete="email"
          className="h-8 min-w-0 text-xs"
          disabled={pending !== null || Boolean(storedCode)}
          onChange={(event) => {
            setEmail(event.target.value);
            if (error) setError(null);
          }}
          placeholder="you@company.com"
          type="email"
          value={email}
        />
        <label className="text-muted-foreground text-xs" htmlFor={inviteId}>
          Their emails
        </label>
        <Input
          id={inviteId}
          autoComplete="off"
          className="h-8 min-w-0 text-xs"
          disabled={pending !== null}
          onChange={(event) => {
            setInviteInput(event.target.value);
            if (error) setError(null);
          }}
          placeholder="ada@company.com, sam@company.com"
          type="text"
          value={inviteInput}
        />
        <Button
          className="h-8 w-fit rounded-full px-3 text-xs"
          disabled={pending !== null || email.trim().length === 0}
          type="submit"
        >
          {pending === "send"
            ? invitees.length > 0
              ? "Sending…"
              : "Creating…"
            : invitees.length > 0
              ? "Send invites"
              : "Show code"}
        </Button>
        <p className="text-muted-foreground text-xs">
          We’ll email them Acorn plus a backup code. They can still use the code
          if the message is delayed.
        </p>
      </form>
      {visibleCode ? (
        <ShareCodePanel
          code={visibleCode}
          copied={copied}
          onCopy={() => void handleCopyCode()}
          sentTo={sentTo}
        />
      ) : null}
      <div className="border-border/70 border-t pt-4">
        {awaitingCode ? (
          <form
            className="flex min-w-0 flex-col gap-2"
            onSubmit={(event) => void handleConfirm(event)}
          >
            <label className="text-muted-foreground text-xs" htmlFor={otpId}>
              We sent a code to {mailbox ?? workEmail}. Enter it to prove that
              inbox is yours.
            </label>
            <Input
              id={otpId}
              autoComplete="one-time-code"
              autoFocus
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
            <div className="flex flex-wrap gap-2">
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
            className="flex min-w-0 flex-col gap-2"
            onSubmit={(event) => void handleRedeem(event)}
          >
            <label className="text-muted-foreground text-xs" htmlFor={codeId}>
              Have a share code?
            </label>
            <Input
              id={codeId}
              autoComplete="off"
              className="h-8 min-w-0 font-mono text-xs"
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
              className="h-8 min-w-0 text-xs"
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
      </div>
      {redeemed ? (
        <p className="text-xs">You have 30 days of Pro on this Mac.</p>
      ) : null}
      {notice ? <p className="text-xs">{notice}</p> : null}
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
    </section>
  );
}

function ShareCodePanel({
  code,
  copied,
  onCopy,
  sentTo,
}: {
  code: string;
  copied: boolean;
  onCopy: () => void;
  sentTo: string[];
}) {
  return (
    <div className="border-border/70 bg-background/40 flex min-w-0 flex-col gap-2 rounded-xl border p-3">
      <p className="text-xs font-medium">
        {sentTo.length > 0
          ? "Backup code if they don’t get the email"
          : "Share this code"}
      </p>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <code className="bg-muted/60 rounded-md px-2 py-1 font-mono text-xs tracking-wide select-all">
          {formatShareCode(code)}
        </code>
        <Button
          className="h-8 shrink-0 rounded-full px-3 text-xs"
          onClick={onCopy}
          type="button"
          variant="outline"
        >
          {copied ? "Copied" : "Copy code"}
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">
        They paste it in Settings → Pro, then confirm a work email.
      </p>
    </div>
  );
}

function ShareProgress({
  count,
  granted,
}: {
  count: number;
  granted: boolean;
}) {
  if (granted) {
    return (
      <p className="text-sm font-medium">
        Unlocked: 3 months of Pro on this Mac.
      </p>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-1.5" aria-hidden>
        {Array.from({ length: SHARE_QUALIFYING_INSTALLS }, (_, index) => (
          <span
            key={index}
            className={cn([
              "size-2 rounded-full",
              index < count ? "bg-primary" : "bg-muted-foreground/25",
            ])}
          />
        ))}
      </div>
      <p className="text-sm">
        {count}/{SHARE_QUALIFYING_INSTALLS} work-email installs
      </p>
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
