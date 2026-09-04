import { useEffect, useMemo } from "react";

import { useLiveQuery } from "~/db";
import { rememberLearnedContactTerms } from "~/stt/dictionary-learn";

type ContactLearnSqlRow = {
  email: string;
  organization_name: string;
};

export function useLearnDictionaryFromContacts() {
  const { data } = useLiveQuery<ContactLearnSqlRow, ContactLearnSqlRow[]>({
    sql: `
      SELECT
        COALESCE(humans.email, '') AS email,
        COALESCE(organizations.name, '') AS organization_name
      FROM humans
      LEFT JOIN organizations
        ON organizations.id = humans.organization_id
        AND organizations.deleted_at IS NULL
      WHERE humans.deleted_at IS NULL
        AND (
          COALESCE(humans.email, '') <> ''
          OR COALESCE(organizations.name, '') <> ''
        )
    `,
    mapRows: (rows) => rows,
  });

  const emails = useMemo(
    () => (data ?? []).map((row) => row.email).filter(Boolean),
    [data],
  );
  const organizationNames = useMemo(
    () => (data ?? []).map((row) => row.organization_name).filter(Boolean),
    [data],
  );
  const learnKey = `${emails.join("\n")}\n${organizationNames.join("\n")}`;

  useEffect(() => {
    if (emails.length === 0 && organizationNames.length === 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      void rememberLearnedContactTerms({
        emails,
        organizationNames,
      }).catch((error) => {
        console.warn("[dictionary] failed to learn contact terms", error);
      });
    }, 1500);

    return () => {
      window.clearTimeout(timer);
    };
  }, [emails, learnKey, organizationNames]);
}
