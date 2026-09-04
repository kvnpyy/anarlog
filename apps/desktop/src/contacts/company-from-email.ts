const PERSONAL_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.uk",
  "ymail.com",
  "outlook.com",
  "outlook.co.uk",
  "hotmail.com",
  "hotmail.co.uk",
  "live.com",
  "msn.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "pm.me",
  "hey.com",
  "fastmail.com",
]);

const GENERIC_DOMAIN_LABELS = new Set([
  "mail",
  "email",
  "smtp",
  "google",
  "microsoft",
  "apple",
]);

export function companyTermFromEmail(
  email: string | undefined,
): string | undefined {
  const domain = email?.split("@")[1]?.toLowerCase();
  if (!domain || PERSONAL_EMAIL_DOMAINS.has(domain)) {
    return undefined;
  }

  const labels = domain.split(".").filter(Boolean);
  if (labels.length < 2) {
    return undefined;
  }

  const secondLast = labels[labels.length - 2];
  const companyLabel =
    labels.length >= 3 &&
    secondLast &&
    ["co", "com", "org", "net", "ac"].includes(secondLast)
      ? labels[labels.length - 3]
      : secondLast;
  if (
    !companyLabel ||
    companyLabel.length < 2 ||
    GENERIC_DOMAIN_LABELS.has(companyLabel)
  ) {
    return undefined;
  }

  return normalizeCompanyName(
    companyLabel.charAt(0).toUpperCase() + companyLabel.slice(1),
  );
}

export function companyTermsFromEmails(
  emails: Iterable<string | undefined | null>,
): string[] {
  const terms: string[] = [];
  const seen = new Set<string>();

  for (const email of emails) {
    const term = companyTermFromEmail(email ?? undefined);
    if (!term) continue;
    const key = term.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    terms.push(term);
  }

  return terms;
}

export function normalizeCompanyName(
  value: string | undefined | null,
): string | undefined {
  const name = value?.trim().replace(/\s+/g, " ");
  if (!name || name.length < 2 || name.length > 80) {
    return undefined;
  }

  if (name.includes("@") || /^https?:\/\//i.test(name)) {
    return undefined;
  }

  return name;
}
