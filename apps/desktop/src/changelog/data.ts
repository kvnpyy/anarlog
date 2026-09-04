import { useEffect, useState } from "react";
import {
  changelogByVersion,
  latestContent,
  latestVersion,
} from "virtual:changelog";

import { processContent } from "@anlg/changelog";

export function getLatestVersion(): string | null {
  return latestVersion;
}

export function fallbackChangelogMarkdown(): string {
  return `---
date: "2026-09-04"
summary: "Smaller, quieter improvements so Acorn stays out of the way."
---

Acorn just got a little smoother.

We polished the everyday experience — small fixes, calmer details, and the kind of refinements you feel more than you notice. Your notes stay yours. Everything else just works a bit better.
`;
}

export function resolveChangelogRaw(version: string): string {
  return (
    changelogByVersion?.[version] ??
    (version === latestVersion && latestContent ? latestContent : null) ??
    fallbackChangelogMarkdown()
  );
}

async function fetchChangelogFromGitHub(
  version: string,
): Promise<string | null> {
  const url = `https://raw.githubusercontent.com/fastrepl/anarlog/main/packages/changelog/content/${version}.md`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }
    return await response.text();
  } catch {
    return null;
  }
}

function parseChangelog(raw: string): {
  content: string;
  date: string | null;
} {
  const parsed = processContent(raw);
  if (parsed.content.trim()) {
    return parsed;
  }

  return processContent(fallbackChangelogMarkdown());
}

export function useChangelogContent(version: string) {
  const [content, setContent] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadChangelog() {
      const embedded = changelogByVersion?.[version];
      if (embedded) {
        const parsed = parseChangelog(embedded);
        if (!cancelled) {
          setContent(parsed.content);
          setDate(parsed.date);
          setLoading(false);
        }
        return;
      }

      if (version === latestVersion && latestContent) {
        const parsed = parseChangelog(latestContent);
        if (!cancelled) {
          setContent(parsed.content);
          setDate(parsed.date);
          setLoading(false);
        }
        return;
      }

      const raw = await fetchChangelogFromGitHub(version);
      if (cancelled) return;

      const parsed = parseChangelog(raw ?? fallbackChangelogMarkdown());
      setContent(parsed.content);
      setDate(parsed.date);
      setLoading(false);
    }

    setLoading(true);
    void loadChangelog();

    return () => {
      cancelled = true;
    };
  }, [version]);

  return { content, date, loading };
}
