export type ChatActivityStep = {
  id: string;
  kind: "think" | "write" | "tool";
  tool?: string;
  query?: string;
  state: "active" | "done";
  failed?: boolean;
};

export type ChatActivitySource = {
  id: string;
  label: string;
};

const SOURCE_LIMIT = 6;

export function chatActivityFromParts(parts: readonly unknown[] | undefined): {
  steps: ChatActivityStep[];
  sources: ChatActivitySource[];
} {
  const turn = currentTurn(parts);
  const tools = turn.filter((part) => part.type.startsWith("tool-"));

  if (tools.length === 0) {
    return {
      steps: [{ id: "think", kind: "think", state: "active" }],
      sources: [],
    };
  }

  const steps: ChatActivityStep[] = tools.map((part) => {
    const finished =
      part.state === "output-available" || part.state === "output-error";
    return {
      id: part.toolCallId || part.type,
      kind: "tool",
      tool: part.type.slice("tool-".length),
      query: readQuery(part.input),
      state: finished ? "done" : "active",
      failed: part.state === "output-error",
    };
  });

  if (steps.every((step) => step.state === "done")) {
    steps.push({ id: "write", kind: "write", state: "active" });
  }

  return { steps, sources: sourcesFrom(tools) };
}

type ActivityPart = {
  type: string;
  state?: string;
  toolCallId?: string;
  input?: unknown;
  output?: unknown;
};

function currentTurn(parts: readonly unknown[] | undefined): ActivityPart[] {
  const list = Array.isArray(parts) ? parts.flatMap(asPart) : [];
  let start = 0;
  list.forEach((part, index) => {
    if (part.type === "step-start") {
      start = index + 1;
    }
  });
  return list.slice(start);
}

function asPart(value: unknown): ActivityPart[] {
  if (!value || typeof value !== "object") {
    return [];
  }

  const part = value as {
    type?: unknown;
    state?: unknown;
    toolCallId?: unknown;
    input?: unknown;
    output?: unknown;
  };
  if (typeof part.type !== "string") {
    return [];
  }

  return [
    {
      type: part.type,
      state: typeof part.state === "string" ? part.state : undefined,
      toolCallId:
        typeof part.toolCallId === "string" ? part.toolCallId : undefined,
      input: part.input,
      output: part.output,
    },
  ];
}

function readQuery(input: unknown): string | undefined {
  if (!input || typeof input !== "object") {
    return undefined;
  }

  const query = (input as { query?: unknown }).query;
  if (typeof query !== "string") {
    return undefined;
  }

  const trimmed = query.trim();
  if (!trimmed) {
    return undefined;
  }

  return trimmed.length > 80 ? `${trimmed.slice(0, 77)}…` : trimmed;
}

function sourcesFrom(tools: ActivityPart[]): ChatActivitySource[] {
  const sources: ChatActivitySource[] = [];
  const seen = new Set<string>();

  for (const tool of tools) {
    if (tool.state !== "output-available") {
      continue;
    }

    for (const label of collectLabels(tool.output)) {
      const key = label.toLocaleLowerCase();
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      sources.push({
        id: `${tool.toolCallId ?? tool.type}:${sources.length}`,
        label,
      });
      if (sources.length >= SOURCE_LIMIT) {
        return sources;
      }
    }
  }

  return sources;
}

function collectLabels(output: unknown): string[] {
  if (!output || typeof output !== "object") {
    return [];
  }

  const record = output as Record<string, unknown>;
  const lists = [
    record.results,
    record.meetings,
    record.contacts,
    record.events,
  ]
    .filter(Array.isArray)
    .flat();
  const labels = lists.flatMap((item) => {
    const label = itemLabel(item);
    return label ? [label] : [];
  });

  if (labels.length > 0) {
    return labels;
  }

  const single = itemLabel(record);
  return single ? [single] : [];
}

function itemLabel(value: unknown): string | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  for (const key of ["title", "name"] as const) {
    const label = record[key];
    if (typeof label === "string" && label.trim()) {
      return label.trim();
    }
  }

  return null;
}
