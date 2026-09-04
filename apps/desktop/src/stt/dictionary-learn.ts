import {
  companyTermsFromEmails,
  normalizeCompanyName,
} from "~/contacts/company-from-email";
import { updateSettingValue } from "~/settings/queries";
import { normalizeKeywordList, parseDictionaryTermsJson } from "~/stt/keywords";

function dictionaryKey(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

export async function rememberDictionaryTerms(
  terms: string[],
): Promise<string[]> {
  const incoming = normalizeKeywordList(terms);
  if (incoming.length === 0) {
    return [];
  }

  let addedTerms: string[] = [];
  await updateSettingValue(
    "personalization_dictionary_terms",
    (storedValue) => {
      const currentTerms = parseDictionaryTermsJson(storedValue);
      const currentKeys = new Set(currentTerms.map(dictionaryKey));
      addedTerms = incoming.filter(
        (term) => !currentKeys.has(dictionaryKey(term)),
      );
      if (addedTerms.length === 0) {
        return JSON.stringify(currentTerms);
      }
      return JSON.stringify(
        normalizeKeywordList([...currentTerms, ...addedTerms]),
      );
    },
  );

  return addedTerms;
}

export function learnableTermsFromContacts({
  emails = [],
  organizationNames = [],
}: {
  emails?: Iterable<string | undefined | null>;
  organizationNames?: Iterable<string | undefined | null>;
}) {
  const organizationTerms = [];
  for (const name of organizationNames) {
    const term = normalizeCompanyName(name);
    if (term) {
      organizationTerms.push(term);
    }
  }

  return normalizeKeywordList([
    ...companyTermsFromEmails(emails),
    ...organizationTerms,
  ]);
}

export async function rememberLearnedContactTerms({
  emails = [],
  organizationNames = [],
}: {
  emails?: Iterable<string | undefined | null>;
  organizationNames?: Iterable<string | undefined | null>;
}) {
  return rememberDictionaryTerms(
    learnableTermsFromContacts({ emails, organizationNames }),
  );
}
