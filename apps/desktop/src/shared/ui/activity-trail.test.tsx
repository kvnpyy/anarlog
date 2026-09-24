import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ActivityTrail } from "./activity-trail";

afterEach(cleanup);

describe("ActivityTrail", () => {
  it("shows completed steps, the live step, and the sources it pulled", () => {
    render(
      <ActivityTrail
        sourceHeading="Pulled from"
        showNoteSkeleton
        steps={[
          { id: "search", label: "Searched your meetings", state: "done" },
          { id: "write", label: "Writing the answer", state: "active" },
        ]}
        sources={[
          { id: "1", label: "Renewal call" },
          { id: "2", label: "Pricing review" },
        ]}
      />,
    );

    expect(screen.getByText("Searched your meetings")).toBeTruthy();
    expect(screen.getByText("Writing the answer")).toBeTruthy();
    expect(screen.getByText("Pulled from")).toBeTruthy();
    expect(screen.getByText("Renewal call")).toBeTruthy();
    expect(screen.getByText("Pricing review")).toBeTruthy();
    expect(
      screen
        .getByTestId("summary-forming")
        .querySelectorAll("[data-inked='true']"),
    ).toHaveLength(2);
  });

  it("keeps the compact trail on the current step", () => {
    render(
      <ActivityTrail
        compact
        steps={[
          { id: "search", label: "Searched your meetings", state: "done" },
          { id: "write", label: "Writing the answer", state: "active" },
        ]}
      />,
    );

    expect(screen.queryByText("Searched your meetings")).toBeNull();
    expect(screen.getByText("Writing the answer")).toBeTruthy();
  });
});
