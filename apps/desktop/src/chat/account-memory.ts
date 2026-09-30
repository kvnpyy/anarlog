import { getStoredSettingValues, updateSettingValue } from "~/settings/queries";

const PUBLIC_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "hotmail.com",
  "icloud.com",
  "live.com",
  "outlook.com",
  "yahoo.com",
]);

export function emailDomain(email: string | null | undefined): string | null {
  const domain = email?.split("@")[1]?.trim().toLowerCase();
  if (!domain || PUBLIC_EMAIL_DOMAINS.has(domain)) {
    return null;
  }
  return domain;
}

export function factsFromUserCorrection(text: string): string[] {
  const facts: string[] = [];
  for (const match of text.matchAll(
    /\b(?:it'?s|it is)\s+(.{2,80}?)\s+not\s+[^.,\n]+/gi,
  )) {
    facts.push(match[1].replace(/\s+/g, " ").trim());
  }
  const locations = text.match(
    /\bthey have\s+(?:\d+|one|only one|a single)\b[^.\n]*/i,
  );
  if (locations) {
    facts.push(locations[0].replace(/\s+/g, " ").trim());
  }
  return [...new Set(facts)];
}

function parseMemory(stored: string | undefined): Record<string, string[]> {
  if (!stored) {
    return {};
  }
  try {
    const value = JSON.parse(stored) as Record<string, unknown>;
    const memory: Record<string, string[]> = {};
    for (const [domain, facts] of Object.entries(value)) {
      if (Array.isArray(facts)) {
        memory[domain] = facts.filter(
          (fact): fact is string =>
            typeof fact === "string" && fact.trim().length > 0,
        );
      }
    }
    return memory;
  } catch {
    return {};
  }
}

export async function rememberAccountFacts(
  domains: string[],
  facts: string[],
): Promise<void> {
  const uniqueFacts = [
    ...new Set(facts.map((fact) => fact.trim()).filter(Boolean)),
  ];
  const uniqueDomains = [...new Set(domains)];
  if (uniqueFacts.length === 0 || uniqueDomains.length === 0) {
    return;
  }

  await updateSettingValue("account_memory", (current) => {
    const memory = parseMemory(
      typeof current === "string" ? current : undefined,
    );
    for (const domain of uniqueDomains) {
      const existing = new Set(memory[domain] ?? []);
      for (const fact of uniqueFacts) {
        existing.add(fact);
      }
      memory[domain] = [...existing];
    }
    return JSON.stringify(memory);
  });
}

export async function accountFactsForDomains(
  domains: string[],
): Promise<string[]> {
  const uniqueDomains = [...new Set(domains)];
  if (uniqueDomains.length === 0) {
    return [];
  }
  const stored = await getStoredSettingValues();
  const memory = parseMemory(stored.values.account_memory);
  return [...new Set(uniqueDomains.flatMap((domain) => memory[domain] ?? []))];
}
