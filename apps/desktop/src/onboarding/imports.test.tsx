import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  importMeetingFiles: vi.fn(),
  readTextFiles: vi.fn(),
  selectFiles: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: mocks.selectFiles,
}));

vi.mock("@anlg/plugin-importer", () => ({
  commands: { readTextFiles: mocks.readTextFiles },
}));

vi.mock("~/imports/queries", () => ({
  importMeetingFiles: mocks.importMeetingFiles,
}));

import { ImportSection } from "./imports";

function renderImport(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.selectFiles.mockResolvedValue(["/tmp/meet.vtt"]);
  mocks.readTextFiles.mockResolvedValue({
    status: "ok",
    data: [{ name: "meet.vtt", path: "/tmp/meet.vtt", content: "WEBVTT" }],
  });
  mocks.importMeetingFiles.mockResolvedValue({
    discovered: 1,
    imported: 1,
    matched: 0,
    conflicts: 0,
    errors: 0,
  });
});

afterEach(cleanup);

it("imports chosen transcript files instead of connecting Meet or Zoom", async () => {
  const onContinue = vi.fn();
  const onSkip = vi.fn();

  renderImport(<ImportSection onContinue={onContinue} onSkip={onSkip} />);

  expect(screen.queryByText("Google Meet")).toBeNull();
  expect(screen.queryByText("Zoom")).toBeNull();
  expect(screen.queryByRole("button", { name: "Connect & import" })).toBeNull();

  fireEvent.click(screen.getByRole("button", { name: "Choose files" }));

  await waitFor(() => {
    expect(mocks.importMeetingFiles).toHaveBeenCalledWith("files", [
      { name: "meet.vtt", path: "/tmp/meet.vtt", content: "WEBVTT" },
    ]);
  });
  expect(screen.getByText(/Brought in 1 new meetings/)).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  expect(onContinue).toHaveBeenCalledOnce();
  expect(onSkip).not.toHaveBeenCalled();
});

it("lets the user skip file import", () => {
  const onContinue = vi.fn();
  const onSkip = vi.fn();

  renderImport(<ImportSection onContinue={onContinue} onSkip={onSkip} />);
  fireEvent.click(screen.getByRole("button", { name: "Skip for now" }));

  expect(onSkip).toHaveBeenCalledOnce();
  expect(onContinue).not.toHaveBeenCalled();
  expect(mocks.selectFiles).not.toHaveBeenCalled();
});
