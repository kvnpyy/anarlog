const listeners = new Set<() => void>();

let directSyncCount = 0;

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

export function getDirectSyncCount() {
  return directSyncCount;
}

export function subscribeDirectSync(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function trackDirectSync<T>(run: () => Promise<T>): Promise<T> {
  directSyncCount += 1;
  notify();
  try {
    return await run();
  } finally {
    directSyncCount = Math.max(0, directSyncCount - 1);
    notify();
  }
}
