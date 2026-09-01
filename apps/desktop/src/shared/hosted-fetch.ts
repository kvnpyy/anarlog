import { Channel } from "@tauri-apps/api/core";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";

import { ACORN_HOSTED_API_KEY } from "~/shared/acorn-defaults";
import { commands, type HostedFetchEvent } from "~/types/tauri.gen";

const HOSTED_AUTH_HEADERS = [
  "authorization",
  "x-api-key",
  "x-goog-api-key",
  "api-key",
];

export function headersContainHostedPlaceholder(headers: Headers): boolean {
  for (const name of HOSTED_AUTH_HEADERS) {
    const value = headers.get(name);
    if (!value) {
      continue;
    }
    if (value === ACORN_HOSTED_API_KEY) {
      return true;
    }
    if (value === `Bearer ${ACORN_HOSTED_API_KEY}`) {
      return true;
    }
  }
  return false;
}

function urlContainsHostedPlaceholder(input: RequestInfo | URL): boolean {
  const href = requestUrl(input);
  try {
    const parsed = new URL(href);
    for (const value of parsed.searchParams.values()) {
      if (value === ACORN_HOSTED_API_KEY) {
        return true;
      }
    }
  } catch {
    return href.includes(ACORN_HOSTED_API_KEY);
  }
  return false;
}

export function needsHostedNativeFetch(
  input: RequestInfo | URL,
  headers: Headers,
): boolean {
  return (
    headersContainHostedPlaceholder(headers) ||
    urlContainsHostedPlaceholder(input)
  );
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") {
    return input;
  }
  if (input instanceof URL) {
    return input.href;
  }
  return input.url;
}

async function requestBodyBytes(
  body: BodyInit | null | undefined,
): Promise<number[] | null> {
  if (body == null) {
    return null;
  }
  if (typeof body === "string") {
    return Array.from(new TextEncoder().encode(body));
  }
  if (body instanceof Uint8Array) {
    return Array.from(body);
  }
  if (body instanceof ArrayBuffer) {
    return Array.from(new Uint8Array(body));
  }
  return Array.from(new Uint8Array(await new Response(body).arrayBuffer()));
}

export const hostedFetch: typeof fetch = async (input, init) => {
  const headers = new Headers(init?.headers);
  if (input instanceof Request) {
    for (const [name, value] of input.headers) {
      if (!headers.has(name)) {
        headers.set(name, value);
      }
    }
  }

  if (!needsHostedNativeFetch(input, headers)) {
    return tauriFetch(input, { ...init, headers });
  }

  const method = (
    init?.method ?? (input instanceof Request ? input.method : "GET")
  ).toUpperCase();
  const body = await requestBodyBytes(
    init?.body ?? (input instanceof Request ? input.body : null),
  );

  const channel = new Channel<HostedFetchEvent>();
  let streamController: ReadableStreamDefaultController<Uint8Array> | undefined;
  const pendingChunks: Uint8Array[] = [];
  let finished = false;
  let startResolve:
    | ((value: { status: number; headers: Headers }) => void)
    | undefined;
  let startReject: ((error: unknown) => void) | undefined;

  const startPromise = new Promise<{ status: number; headers: Headers }>(
    (resolve, reject) => {
      startResolve = resolve;
      startReject = reject;
    },
  );

  channel.onmessage = (event) => {
    if (event.type === "start") {
      const responseHeaders = new Headers();
      for (const [name, value] of event.headers) {
        responseHeaders.append(name, value);
      }
      startResolve?.({ status: event.status, headers: responseHeaders });
      return;
    }
    if (event.type === "chunk") {
      const chunk = Uint8Array.from(event.data);
      if (streamController) {
        streamController.enqueue(chunk);
      } else {
        pendingChunks.push(chunk);
      }
      return;
    }
    if (event.type === "end") {
      finished = true;
      streamController?.close();
    }
  };

  void commands
    .acornHostedFetch(
      requestUrl(input),
      method,
      [...headers.entries()],
      body,
      channel,
    )
    .then((result) => {
      if (result.status === "error") {
        const error = new Error(result.error);
        streamController?.error(error);
        startReject?.(error);
      }
    })
    .catch((error) => {
      streamController?.error(error);
      startReject?.(error);
    });

  const start = await startPromise;
  const abort = init?.signal;
  const bodyStream = new ReadableStream<Uint8Array>({
    start(controller) {
      streamController = controller;
      for (const chunk of pendingChunks) {
        controller.enqueue(chunk);
      }
      pendingChunks.length = 0;
      if (finished) {
        controller.close();
      }
      abort?.addEventListener("abort", () => {
        controller.error(
          abort.reason ?? new DOMException("Aborted", "AbortError"),
        );
      });
    },
  });

  return new Response(bodyStream, {
    status: start.status,
    headers: start.headers,
  });
};
