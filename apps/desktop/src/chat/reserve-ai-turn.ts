import { updateSettingValue } from "~/settings/queries";
import { freeAiDailyLimitNotice, nextAiUsage } from "~/shared/ai-usage";

export async function reserveFreeAiTurn(
  now = new Date(),
): Promise<{ allowed: true } | { allowed: false; message: string }> {
  let blocked = false;

  try {
    await updateSettingValue("ai_usage_daily", (current) => {
      const next = nextAiUsage(
        typeof current === "string" ? current : undefined,
        now,
      );
      blocked = !next.decision.allowed;
      return next.stored;
    });
  } catch (error) {
    console.error("Failed to record free AI usage", error);
    return { allowed: true };
  }

  if (blocked) {
    return { allowed: false, message: freeAiDailyLimitNotice() };
  }

  return { allowed: true };
}
