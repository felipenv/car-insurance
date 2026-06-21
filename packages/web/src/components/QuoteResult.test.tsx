import {
  rateQuote,
  type QuoteInput,
  type QuoteResult as CoreQuoteResult,
} from "@car-insurance/core";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { formatCurrency } from "../lib/formatCurrency.js";
import { DISCLAIMER, QuoteResult } from "./QuoteResult.js";

/** A valid input mirroring the spec's illustrative example. */
const SAMPLE_INPUT: QuoteInput = {
  driverAge: 35,
  yearsLicensed: 10,
  vehicleValue: 150_000,
  annualMileage: 12_000,
  priorClaims: 0,
  coverageTier: "standard",
};

/** Rates SAMPLE_INPUT through the real CORE engine (no duplicated constants). */
function ratedSample(): CoreQuoteResult {
  return rateQuote(SAMPLE_INPUT);
}

/** The `<tr>` whose row-header text matches `label`. */
function rowFor(label: string): HTMLElement {
  const row = screen.getByText(label).closest("tr");
  if (!row) {
    throw new Error(`No row found for "${label}"`);
  }
  return row;
}

describe("QuoteResult — final premium (AC1)", () => {
  it("renders the engine's finalPremium formatted as ₪ comma-grouped integer", () => {
    const result = ratedSample();
    render(<QuoteResult result={result} />);

    const expected = formatCurrency(result.finalPremium);
    // Appears as the headline and again on the total line.
    expect(screen.getAllByText(expected).length).toBeGreaterThanOrEqual(2);
    expect(rowFor("Total annual premium").textContent).toContain(expected);
  });
});

describe("QuoteResult — breakdown structure (AC2)", () => {
  it("lists a base line, the six factors in fixed order, then a total line", () => {
    const result = ratedSample();
    render(<QuoteResult result={result} />);

    const rowHeaders = screen
      .getAllByRole("rowheader")
      .map((el) => el.textContent);

    expect(rowHeaders[0]).toBe("Base premium");
    expect(rowHeaders[rowHeaders.length - 1]).toBe("Total annual premium");

    // The middle rows are the six factors, in the engine's frozen order.
    const factorRows = rowHeaders.slice(1, -1);
    expect(factorRows).toEqual(result.factors.map((f) => f.label));
    expect(factorRows).toHaveLength(6);
  });

  it("shows the base premium amount on the base line", () => {
    const result = ratedSample();
    render(<QuoteResult result={result} />);
    expect(rowFor("Base premium").textContent).toContain(
      formatCurrency(result.base),
    );
  });
});

describe("QuoteResult — per-factor lines (AC3)", () => {
  it("shows multiplier, signed delta, and running subtotal per factor", () => {
    const result = ratedSample();
    render(<QuoteResult result={result} />);

    // Years licensed is ×0.95 → −₪120 → → ₪2,280 in this sample.
    const row = within(rowFor(result.factors[1].label));
    expect(row.getByText("×0.95")).toBeDefined();
    expect(row.getByText("−₪120")).toBeDefined();
    expect(row.getByText("→ ₪2,280")).toBeDefined();
  });

  it("renders the last factor's subtotal equal to the headline premium", () => {
    const result = ratedSample();
    render(<QuoteResult result={result} />);
    expect(rowFor(result.factors[5].label).textContent).toContain(
      `→ ${formatCurrency(result.finalPremium)}`,
    );
  });
});

describe("QuoteResult — ×1.00 factor (AC4)", () => {
  it("shows +₪0 and leaves the running subtotal unchanged", () => {
    const result = ratedSample();
    render(<QuoteResult result={result} />);

    // Driver age 35 is ×1.00; the base is unchanged at ₪2,400.
    const row = within(rowFor(result.factors[0].label));
    expect(row.getByText("×1.00")).toBeDefined();
    expect(row.getByText("+₪0")).toBeDefined();
    expect(row.getByText("→ ₪2,400")).toBeDefined();
  });
});

describe("QuoteResult — disclaimer (AC8)", () => {
  it("renders the verbatim disclaimer text", () => {
    render(<QuoteResult result={ratedSample()} />);
    expect(screen.getByText(DISCLAIMER)).toBeDefined();
    expect(DISCLAIMER).toBe(
      "Illustrative estimate only — not a real Harel quote. " +
        "Figures use a sample rating model for demonstration purposes.",
    );
  });

  it("keeps the disclaimer inside the result region", () => {
    render(<QuoteResult result={ratedSample()} />);
    const region = screen.getByRole("region", {
      name: "Estimated annual premium",
    });
    expect(within(region).getByText(DISCLAIMER)).toBeDefined();
  });
});
