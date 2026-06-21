import { type QuoteResult } from "@car-insurance/core";
import { describe, expect, it } from "vitest";

import { buildWaterfall } from "./waterfall.js";

/**
 * A representative rated result matching the spec's illustrative layout:
 * base ₪2,400, age ×1.00, years ×0.95, vehicle ×1.30, then mileage/claims/tier.
 * `finalPremium` is the authoritative 2400 × Πmultipliers, rounded once.
 */
function sampleResult(overrides: Partial<QuoteResult> = {}): QuoteResult {
  const base = 2400;
  const factors = [
    { key: "driverAge", label: "Driver age (35–59)", multiplier: 1.0 },
    { key: "yearsLicensed", label: "Years licensed (10+)", multiplier: 0.95 },
    { key: "vehicleValue", label: "Vehicle value (₪150,000)", multiplier: 1.3 },
    {
      key: "annualMileage",
      label: "Annual mileage (10,000–19,999)",
      multiplier: 1.0,
    },
    { key: "priorClaims", label: "Prior claims (0)", multiplier: 0.9 },
    { key: "coverageTier", label: "Standard", multiplier: 1.0 },
  ] as const;
  const product = factors.reduce((p, f) => p * f.multiplier, 1);
  return {
    base,
    finalPremium: Math.round(base * product),
    factors,
    ...overrides,
  };
}

describe("buildWaterfall — structure (AC2)", () => {
  it("carries the base and authoritative finalPremium straight through", () => {
    const result = sampleResult();
    const waterfall = buildWaterfall(result);
    expect(waterfall.base).toBe(2400);
    expect(waterfall.finalPremium).toBe(result.finalPremium);
  });

  it("produces exactly one step per factor, in the engine's order", () => {
    const waterfall = buildWaterfall(sampleResult());
    expect(waterfall.steps.map((s) => s.key)).toEqual([
      "driverAge",
      "yearsLicensed",
      "vehicleValue",
      "annualMileage",
      "priorClaims",
      "coverageTier",
    ]);
  });

  it("preserves each factor's label and multiplier", () => {
    const [age, years, vehicle] = buildWaterfall(sampleResult()).steps;
    expect(age).toMatchObject({ label: "Driver age (35–59)", multiplier: 1.0 });
    expect(years).toMatchObject({
      label: "Years licensed (10+)",
      multiplier: 0.95,
    });
    expect(vehicle).toMatchObject({ multiplier: 1.3 });
  });
});

describe("buildWaterfall — arithmetic (AC3)", () => {
  it("computes running subtotals by compounding the multipliers onto base", () => {
    const steps = buildWaterfall(sampleResult()).steps;
    // 2400 → ×1.00=2400 → ×0.95=2280 → ×1.30=2964 → ×1.00=2964 → ×0.90=2667.6
    // (round 2668) → ×1.00=2668.
    expect(steps[0].runningSubtotal).toBe(2400);
    expect(steps[1].runningSubtotal).toBe(2280);
    expect(steps[2].runningSubtotal).toBe(2964);
    expect(steps[3].runningSubtotal).toBe(2964);
  });

  it("derives each delta as the change vs the previous running subtotal", () => {
    const steps = buildWaterfall(sampleResult()).steps;
    expect(steps[0].delta).toBe(0); // 2400 - 2400
    expect(steps[1].delta).toBe(-120); // 2280 - 2400
    expect(steps[2].delta).toBe(684); // 2964 - 2280
  });

  it("deltas sum from base exactly to the last running subtotal", () => {
    const { base, steps } = buildWaterfall(sampleResult());
    const deltaSum = steps.reduce((sum, s) => sum + s.delta, 0);
    const lastSubtotal = steps[steps.length - 1].runningSubtotal;
    expect(base + deltaSum).toBe(lastSubtotal);
  });

  it("matches the authoritative finalPremium in the normal (un-floored) case", () => {
    const { steps, finalPremium } = buildWaterfall(sampleResult());
    expect(steps[steps.length - 1].runningSubtotal).toBe(finalPremium);
  });
});

describe("buildWaterfall — ×1.00 factor (AC4)", () => {
  it("shows a zero delta and an unchanged running subtotal", () => {
    const steps = buildWaterfall(sampleResult()).steps;
    // The driver-age factor is ×1.00 here.
    expect(steps[0].multiplier).toBe(1.0);
    expect(steps[0].delta).toBe(0);
    expect(steps[0].runningSubtotal).toBe(2400);
  });
});
