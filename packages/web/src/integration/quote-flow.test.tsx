/**
 * Acceptance / end-to-end suite for the assembled quote flow (App shell).
 *
 * Drives the real {@link App} — form, the in-process CORE engine, and the
 * result UI together — through jsdom, asserting the cross-cutting acceptance
 * criteria from the spec:
 *
 *   AC1  final premium equals the engine's result, ₪ comma-grouped integer
 *   AC2  base line → six factors in fixed order → total line
 *   AC3  per-line deltas reconcile base → final subtotal
 *   AC4  a ×1.00 factor shows +₪0 and leaves the subtotal unchanged
 *   AC5  each FR3 rule blocks submit with its message; boundaries are accepted
 *   AC6  years-licensed > (age − 17) blocks submit with the cross-field message
 *   AC8  the verbatim disclaimer appears near every computed result
 *   AC9  no network requests and no persistence across the flow
 *   FR10 re-edit + resubmit replaces the prior result with a fresh one
 *
 * Numbers are never hardcoded: expected premiums and waterfall figures come
 * from the CORE engine itself, so this suite cannot drift from the model and
 * cannot duplicate its constants (AC10 is guarded separately).
 */

import {
  rateQuote,
  type CoverageTier,
  type QuoteInput,
} from "@car-insurance/core";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../App.js";
import { formatCurrency } from "../lib/formatCurrency.js";
import { DISCLAIMER } from "../components/QuoteResult.js";
import { MESSAGES } from "../validation.js";

const TIER_LABELS: Record<CoverageTier, "Basic" | "Standard" | "Premium"> = {
  basic: "Basic",
  standard: "Standard",
  premium: "Premium",
};

/** Fills all six fields from a typed input and submits the form. */
function submitQuote(input: QuoteInput): void {
  fireEvent.change(screen.getByLabelText("Driver age"), {
    target: { value: String(input.driverAge) },
  });
  fireEvent.change(screen.getByLabelText("Years licensed"), {
    target: { value: String(input.yearsLicensed) },
  });
  fireEvent.change(screen.getByLabelText("Vehicle value (₪)"), {
    target: { value: String(input.vehicleValue) },
  });
  fireEvent.change(screen.getByLabelText("Annual mileage (km)"), {
    target: { value: String(input.annualMileage) },
  });
  fireEvent.change(screen.getByLabelText("Prior claims (last 3 years)"), {
    target: { value: String(input.priorClaims) },
  });
  fireEvent.click(screen.getByLabelText(TIER_LABELS[input.coverageTier]));
  fireEvent.click(screen.getByRole("button", { name: "Get estimate" }));
}

/** The result region (present only once a quote has been computed). */
function resultRegion(): HTMLElement {
  return screen.getByLabelText("Estimated annual premium");
}

/**
 * The waterfall `<tr>` whose row-header text contains `label`. Scoped to the
 * result region so factor labels ("Driver age") don't collide with the form's
 * field labels of the same name.
 */
function rowFor(label: string): HTMLElement {
  const row = within(resultRegion())
    .getByText(label, { exact: false })
    .closest("tr");
  if (!row) {
    throw new Error(`No waterfall row found for "${label}"`);
  }
  return row;
}

/** Parses a displayed ₪ amount ("→ ₪2,964", "+₪0", "−₪120") to a number. */
function parseShekel(text: string): number {
  const cleaned = text
    .replace(/[₪,+→\s]/g, "")
    .replace(/−/g, "-") // U+2212 minus → ASCII hyphen
    .trim();
  return Number(cleaned);
}

/** The ₪ amount in a row's final cell (the subtotal/amount column). */
function lastCellAmount(row: HTMLElement): number {
  const cells = row.querySelectorAll("td");
  return parseShekel(cells[cells.length - 1]?.textContent ?? "");
}

/** The spec's illustrative sample: driver-age and tier are both ×1.00 factors. */
const SAMPLE: QuoteInput = {
  driverAge: 35,
  yearsLicensed: 10,
  vehicleValue: 150_000,
  annualMileage: 12_000,
  priorClaims: 0,
  coverageTier: "standard",
};

describe("quote flow — full valid submit (AC1, AC2, AC3, AC8)", () => {
  it("renders the engine premium, ordered waterfall, and disclaimer", () => {
    const rated = rateQuote(SAMPLE);
    render(<App />);
    submitQuote(SAMPLE);

    const region = resultRegion();

    // AC1: headline + total both show the engine's authoritative finalPremium.
    const premium = formatCurrency(rated.finalPremium);
    expect(within(region).getAllByText(premium).length).toBeGreaterThanOrEqual(
      2,
    );
    expect(rowFor("Total annual premium").textContent).toContain(premium);

    // AC2: base line, then the six factors in the engine's frozen order, total.
    const headers = within(region)
      .getAllByRole("rowheader")
      .map((el) => el.textContent ?? "");
    expect(headers[0]).toBe("Base premium");
    expect(headers[headers.length - 1]).toBe("Total annual premium");
    const factorHeaders = headers.slice(1, -1);
    expect(factorHeaders).toHaveLength(6);
    rated.factors.forEach((factor, i) => {
      expect(factorHeaders[i]).toBe(factor.label);
    });

    // AC8: the disclaimer appears verbatim, inside the result region.
    expect(within(region).getByText(DISCLAIMER)).toBeDefined();
    expect(DISCLAIMER).toBe(
      "Illustrative estimate only — not a real Harel quote. " +
        "Figures use a sample rating model for demonstration purposes.",
    );

    // AC3: base + Σ(displayed deltas) reconciles to the final subtotal column.
    const base = lastCellAmount(rowFor("Base premium"));
    const deltaCells = region.querySelectorAll(".quote-waterfall__delta");
    const subtotalCells = region.querySelectorAll(".quote-waterfall__subtotal");
    expect(deltaCells).toHaveLength(6);
    const deltaSum = Array.from(deltaCells).reduce(
      (sum, cell) => sum + parseShekel(cell.textContent ?? ""),
      0,
    );
    const lastSubtotal = parseShekel(
      subtotalCells[subtotalCells.length - 1]?.textContent ?? "",
    );
    expect(base + deltaSum).toBe(lastSubtotal);
    // No floor applies here, so the reconciled subtotal equals the premium.
    expect(lastSubtotal).toBe(rated.finalPremium);
  });
});

describe("quote flow — a ×1.00 factor is a no-op (AC4)", () => {
  it("shows +₪0 and an unchanged subtotal for the driver-age band", () => {
    render(<App />);
    submitQuote(SAMPLE); // driverAge 35 → band 35–59 → ×1.00

    const ageRow = rowFor("Driver age");
    expect(within(ageRow).getByText("×1.00")).toBeDefined();
    const cells = ageRow.querySelectorAll("td");
    // [multiplier, delta, subtotal]; delta is +₪0 and subtotal == base (₪2,400).
    expect(cells[1]?.textContent).toBe("+₪0");
    const ageSubtotal = parseShekel(cells[2]?.textContent ?? "");
    const base = lastCellAmount(rowFor("Base premium"));
    expect(ageSubtotal).toBe(base);
  });
});

describe("quote flow — validation blocks submit (AC5, AC6)", () => {
  it("blocks submit and shows the field message for an out-of-range age", () => {
    render(<App />);
    submitQuote({ ...SAMPLE, driverAge: 10 });

    expect(screen.getByText(MESSAGES.driverAge)).toBeDefined();
    expect(screen.queryByLabelText("Estimated annual premium")).toBeNull();
  });

  it("enforces the years-licensed cross-field rule (AC6)", () => {
    render(<App />);
    // age 20 ⇒ max licensed years is 3; 10 violates the cross-field cap.
    submitQuote({ ...SAMPLE, driverAge: 20, yearsLicensed: 10 });

    expect(screen.getByText(MESSAGES.yearsLicensedCrossField)).toBeDefined();
    expect(screen.queryByLabelText("Estimated annual premium")).toBeNull();
  });

  it("accepts the boundary case age 17 with 0 years licensed (AC5)", () => {
    render(<App />);
    submitQuote({ ...SAMPLE, driverAge: 17, yearsLicensed: 0 });

    expect(screen.getByLabelText("Estimated annual premium")).toBeDefined();
  });

  it("accepts the boundary inputs ₪2,000,000 / 100,000 km / 10 claims (AC5)", () => {
    const boundary: QuoteInput = {
      driverAge: 40,
      yearsLicensed: 15,
      vehicleValue: 2_000_000,
      annualMileage: 100_000,
      priorClaims: 10,
      coverageTier: "premium",
    };
    render(<App />);
    submitQuote(boundary);

    const region = resultRegion();
    expect(region.textContent).toContain(
      formatCurrency(rateQuote(boundary).finalPremium),
    );
  });
});

describe("quote flow — re-edit and resubmit (FR10)", () => {
  it("replaces the prior result with a freshly computed one", () => {
    render(<App />);

    submitQuote(SAMPLE);
    const first = formatCurrency(rateQuote(SAMPLE).finalPremium);
    expect(resultRegion().textContent).toContain(first);

    const changed: QuoteInput = { ...SAMPLE, priorClaims: 3 };
    submitQuote(changed);
    const second = formatCurrency(rateQuote(changed).finalPremium);

    expect(second).not.toBe(first);
    expect(resultRegion().textContent).toContain(second);
    // The stale premium is gone — the result is replaced, not appended.
    expect(screen.queryByText(first)).toBeNull();
  });
});

describe("quote flow — no network, no persistence (AC9)", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;
  let xhrOpenSpy: ReturnType<typeof vi.spyOn>;
  let setItemSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    fetchSpy = vi.fn(() =>
      Promise.reject(new Error("network blocked in test")),
    );
    vi.stubGlobal("fetch", fetchSpy);
    xhrOpenSpy = vi.spyOn(XMLHttpRequest.prototype, "open");
    setItemSpy = vi.spyOn(Storage.prototype, "setItem");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    xhrOpenSpy.mockRestore();
    setItemSpy.mockRestore();
  });

  it("computes a quote without any network call or storage write", () => {
    render(<App />);
    submitQuote(SAMPLE);
    // Recompute too, to cover the recalculation path.
    submitQuote({ ...SAMPLE, coverageTier: "basic" });

    expect(resultRegion()).toBeDefined();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(xhrOpenSpy).not.toHaveBeenCalled();
    expect(setItemSpy).not.toHaveBeenCalled();
    // Nothing is persisted, so a reload would start from a blank form (AC9).
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });
});
