import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MESSAGES } from "../validation.js";
import { QuoteForm, TIER_NOTE } from "./QuoteForm.js";

/** Fills the form with a fully-valid set of values. */
function fillValidForm(): void {
  fireEvent.change(screen.getByLabelText("Driver age"), {
    target: { value: "35" },
  });
  fireEvent.change(screen.getByLabelText("Years licensed"), {
    target: { value: "10" },
  });
  fireEvent.change(screen.getByLabelText("Vehicle value (₪)"), {
    target: { value: "150000" },
  });
  fireEvent.change(screen.getByLabelText("Annual mileage (km)"), {
    target: { value: "12000" },
  });
  fireEvent.change(screen.getByLabelText("Prior claims (last 3 years)"), {
    target: { value: "0" },
  });
  fireEvent.click(screen.getByLabelText("Standard"));
}

const submit = (): void =>
  fireEvent.click(screen.getByRole("button", { name: "Get estimate" }));

describe("QuoteForm — rendering (FR1 / FR2)", () => {
  it("renders all six inputs", () => {
    render(<QuoteForm onSubmit={vi.fn()} />);
    expect(screen.getByLabelText("Driver age")).toBeDefined();
    expect(screen.getByLabelText("Years licensed")).toBeDefined();
    expect(screen.getByLabelText("Vehicle value (₪)")).toBeDefined();
    expect(screen.getByLabelText("Annual mileage (km)")).toBeDefined();
    expect(screen.getByLabelText("Prior claims (last 3 years)")).toBeDefined();
    expect(screen.getByLabelText("Basic")).toBeDefined();
    expect(screen.getByLabelText("Standard")).toBeDefined();
    expect(screen.getByLabelText("Premium")).toBeDefined();
  });

  it("shows the verbatim tier note (FR2)", () => {
    render(<QuoteForm onSubmit={vi.fn()} />);
    expect(screen.getByText(TIER_NOTE)).toBeDefined();
    expect(TIER_NOTE).toBe(
      "Illustrative tiers, not legal insurance categories.",
    );
  });

  it("does not show any error messages before interaction", () => {
    render(<QuoteForm onSubmit={vi.fn()} />);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("QuoteForm — submit gating (FR4 / AC5)", () => {
  it("blocks submit and reveals messages when the form is empty", () => {
    const onSubmit = vi.fn();
    render(<QuoteForm onSubmit={onSubmit} />);

    submit();

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(MESSAGES.driverAge)).toBeDefined();
    expect(screen.getByText(MESSAGES.vehicleValue)).toBeDefined();
    expect(screen.getByText(MESSAGES.annualMileage)).toBeDefined();
    expect(screen.getByText(MESSAGES.priorClaims)).toBeDefined();
    expect(screen.getByText(MESSAGES.coverageTier)).toBeDefined();
  });

  it("emits the validated QuoteInput on a valid submit (FR4/FR5)", () => {
    const onSubmit = vi.fn();
    render(<QuoteForm onSubmit={onSubmit} />);

    fillValidForm();
    submit();

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({
      driverAge: 35,
      yearsLicensed: 10,
      vehicleValue: 150000,
      annualMileage: 12000,
      priorClaims: 0,
      coverageTier: "standard",
    });
  });

  it("clears a field error once it is corrected and then submits", () => {
    const onSubmit = vi.fn();
    render(<QuoteForm onSubmit={onSubmit} />);

    fillValidForm();
    // Break the age, attempt submit → blocked with message.
    fireEvent.change(screen.getByLabelText("Driver age"), {
      target: { value: "5" },
    });
    submit();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(MESSAGES.driverAge)).toBeDefined();

    // Fix it → message clears and submit goes through.
    fireEvent.change(screen.getByLabelText("Driver age"), {
      target: { value: "40" },
    });
    expect(screen.queryByText(MESSAGES.driverAge)).toBeNull();
    submit();
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});

describe("QuoteForm — cross-field rule (AC6)", () => {
  it("shows the cross-field message and blocks submit when years > age - 17", () => {
    const onSubmit = vi.fn();
    render(<QuoteForm onSubmit={onSubmit} />);

    fillValidForm();
    fireEvent.change(screen.getByLabelText("Driver age"), {
      target: { value: "20" },
    });
    fireEvent.change(screen.getByLabelText("Years licensed"), {
      target: { value: "10" }, // max is 3
    });
    submit();

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(MESSAGES.yearsLicensedCrossField)).toBeDefined();
  });

  it("accepts age 17 with 0 years licensed (boundary)", () => {
    const onSubmit = vi.fn();
    render(<QuoteForm onSubmit={onSubmit} />);

    fillValidForm();
    fireEvent.change(screen.getByLabelText("Driver age"), {
      target: { value: "17" },
    });
    fireEvent.change(screen.getByLabelText("Years licensed"), {
      target: { value: "0" },
    });
    submit();

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      driverAge: 17,
      yearsLicensed: 0,
    });
  });
});

describe("QuoteForm — coverage tier identifiers (AC7)", () => {
  it.each([
    ["Basic", "basic"],
    ["Standard", "standard"],
    ["Premium", "premium"],
  ])("sends the engine identifier for %s", (label, identifier) => {
    const onSubmit = vi.fn();
    render(<QuoteForm onSubmit={onSubmit} />);

    fillValidForm();
    fireEvent.click(screen.getByLabelText(label));
    submit();

    expect(onSubmit.mock.calls[0]?.[0]?.coverageTier).toBe(identifier);
  });
});

describe("QuoteForm — boundary values accepted (AC5)", () => {
  it("accepts vehicle ₪2,000,000, mileage 0 and 100,000, claims 10", () => {
    const onSubmit = vi.fn();
    render(<QuoteForm onSubmit={onSubmit} />);

    fillValidForm();
    fireEvent.change(screen.getByLabelText("Vehicle value (₪)"), {
      target: { value: "2000000" },
    });
    fireEvent.change(screen.getByLabelText("Annual mileage (km)"), {
      target: { value: "100000" },
    });
    fireEvent.change(screen.getByLabelText("Prior claims (last 3 years)"), {
      target: { value: "10" },
    });
    submit();

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      vehicleValue: 2000000,
      annualMileage: 100000,
      priorClaims: 10,
    });
  });
});
