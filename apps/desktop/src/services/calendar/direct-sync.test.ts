import { afterEach, describe, expect, test } from "vitest";

import {
  getDirectSyncCount,
  subscribeDirectSync,
  trackDirectSync,
} from "./direct-sync";

describe("trackDirectSync", () => {
  afterEach(async () => {
    while (getDirectSyncCount() > 0) {
      await Promise.resolve();
    }
  });

  test("counts an in-flight direct sync and returns to zero", async () => {
    const counts: number[] = [];
    const unsubscribe = subscribeDirectSync(() => {
      counts.push(getDirectSyncCount());
    });

    expect(getDirectSyncCount()).toBe(0);

    let finish = () => {};
    const pending = trackDirectSync(
      () =>
        new Promise<string>((resolve) => {
          finish = () => resolve("ok");
        }),
    );

    expect(getDirectSyncCount()).toBe(1);
    expect(counts).toEqual([1]);

    finish();
    await expect(pending).resolves.toBe("ok");
    expect(getDirectSyncCount()).toBe(0);
    expect(counts).toEqual([1, 0]);
    unsubscribe();
  });
});
