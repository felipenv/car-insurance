/**
 * Wiring + recalculation tests for the {@link App} shell (FR5 / FR10).
 *
 * These assert the assembly contract: the form's valid submit reaches the CORE
 * engine, the engine's authoritative premium is rendered, a fresh submit
 * replaces the prior result, and an invalid submit produces no result at all.
 * End-to-end acceptance (AC1–AC9) lives in `integration/quote-flow.test.tsx`;
 * here the focus is the App↔engine glue.
 */

import { rateQuote, type QuoteInput } from "@car-insurance/core";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { App } from "./App.js";
import { formatCurrency } from "./lib/formatCurrency.js";

/** Fills the six fields; numeric values are passed as strings the input yields. */
function fillForm(values: {
  driverAge: string;
  yearsLicensed: string;
  vehicleValue: string;
  annualMileage: string;
  priorClaims: string;
  tier: "Basic" | "Standard" | "Premium";
}): void {
  fireEvent.change(screen.getByLabelText("Driver age"), {
    target: { value: values.driverAge },
  });
  fireEvent.change(screen.getByLabelText("Years licensed"), {
    target: { value: values.yearsLicensed },
  });
  fireEvent.change(screen.getByLabelText("Vehicle value (₪)"), {
    target: { value: values.vehicleValue },
  });
  fireEvent.change(screen.getByLabelText("Annual mileage (km)"), {
    target: { value: values.annualMileage },
  });
  fireEvent.change(screen.getByLabelText("Prior claims (last 3 years)"), {
    target: { value: values.priorClaims },
  });
  fireEvent.click(screen.getByLabelText(values.tier));
}

const submit = (): void =>
  fireEvent.click(screen.getByRole("button", { name: "Get estimate" }));

/** The exact ₪ string CORE would render for a given input (no duplicated math). */
function expectedPremium(input: QuoteInput): string {
  return formatCurrency(rateQuote(input).finalPremium);
}

const SAMPLE: QuoteInput = {
  driverAge: 35,
  yearsLicensed: 10,
  vehicleValue: 150_000,
  annualMileage: 12_000,
  priorClaims: 0,
  coverageTier: "standard",
};

describe("App — initial state", () => {
  it("shows the form and no result before any submit", () => {
    render(<App />);
    expect(screen.getByRole("button", { name: "Get estimate" })).toBeDefined();
    // The result region is only present once a quote has been computed.
    expect(screen.queryByLabelText("Estimated annual premium")).toBeNull();
  });
});

describe("App — valid submit reaches the engine (FR5)", () => {
  it("renders the engine's authoritative premium for the submitted input", () => {
    render(<App />);
    fillForm({
      driverAge: "35",
      yearsLicensed: "10",
      vehicleValue: "150000",
      annualMileage: "12000",
      priorClaims: "0",
      tier: "Standard",
    });
    submit();

    const result = screen.getByLabelText("Estimated annual premium");
    expect(result.textContent).toContain(expectedPremium(SAMPLE));
  });
});

describe("App — recalculation replaces the prior result (FR10)", () => {
  it("recomputes fresh on resubmit and shows the new premium, not the old one", () => {
    render(<App />);

    // First quote: Standard tier.
    fillForm({
      driverAge: "35",
      yearsLicensed: "10",
      vehicleValue: "150000",
      annualMileage: "12000",
      priorClaims: "0",
      tier: "Standard",
    });
    submit();
    const first = expectedPremium(SAMPLE);
    expect(
      screen.getByLabelText("Estimated annual premium").textContent,
    ).toContain(first);

    // Change one input (tier → Premium) and resubmit.
    fireEvent.click(screen.getByLabelText("Premium"));
    submit();

    const second = expectedPremium({ ...SAMPLE, coverageTier: "premium" });
    // The premiums must differ, and only the fresh one is on screen.
    expect(second).not.toBe(first);
    const region = screen.getByLabelText("Estimated annual premium");
    expect(region.textContent).toContain(second);
    expect(screen.queryByText(first)).toBeNull();
  });
});

describe("App — invalid submit is gated (FR4)", () => {
  it("does not render a result when a field is invalid", () => {
    render(<App />);
    fillForm({
      driverAge: "10", // below the 17 minimum
      yearsLicensed: "0",
      vehicleValue: "150000",
      annualMileage: "12000",
      priorClaims: "0",
      tier: "Standard",
    });
    submit();

    expect(screen.queryByLabelText("Estimated annual premium")).toBeNull();
  });
});
