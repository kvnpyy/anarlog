import { useId, useState, type FormEvent } from "react";

import { Button } from "@anlg/ui/components/ui/button";
import { Input } from "@anlg/ui/components/ui/input";

import { redeemAcornProInvite } from "~/auth/acorn-pro-invite";

export function AcornProInviteForm({
  alreadyPro,
  onRedeemed,
}: {
  alreadyPro: boolean;
  onRedeemed?: () => void;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const inputId = useId();

  if (alreadyPro) {
    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) {
      return;
    }

    setPending(true);
    setError(null);
    try {
      const result = await redeemAcornProInvite(code, alreadyPro);
      if (result === "invalid") {
        setError("That invite doesn’t work.");
        return;
      }
      if (result === "used") {
        setError("That invite was already used.");
        return;
      }
      setCode("");
      onRedeemed?.();
    } catch {
      setError("Couldn’t apply that invite. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      className="border-border/80 bg-background/30 flex min-w-0 flex-col gap-2 rounded-2xl border p-4"
      onSubmit={handleSubmit}
    >
      <label className="text-sm font-medium" htmlFor={inputId}>
        Have a Pro invite?
      </label>
      <p className="text-muted-foreground text-xs">
        If someone sent you an Acorn Pro code, paste it here.
      </p>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Input
          id={inputId}
          autoComplete="off"
          className="h-8 w-auto min-w-0 flex-1 font-mono text-xs"
          disabled={pending}
          onChange={(event) => {
            setCode(event.target.value);
            if (error) {
              setError(null);
            }
          }}
          placeholder="ACORN-XXXX-XXXX-XXXX"
          spellCheck={false}
          value={code}
        />
        <Button
          className="h-8 shrink-0 rounded-full px-3 text-xs"
          disabled={pending || code.trim().length === 0}
          type="submit"
        >
          Redeem
        </Button>
      </div>
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
    </form>
  );
}
