import { describe, expect, it } from "vitest";

import { computeFinalPremium, PREMIUM_FLOOR_ILS } from "./model.js";
import { rateQuote } from "./rateQuote.js";
import {
  COVERAGE_TIERS,
  FACTOR_ORDER,
  type CoverageTier,
  type FactorKey,
  type QuoteInput,
} from "./types.js";

/**
 * A mid-range, fully-valid baseline. Individual tests spread over it to vary one
 * factor at a time. Chosen so each factor sits on a ×1.00 (or known) band unless
 * overridden: age 35 (×1.00), 12,000 km (×1.00), standard tier (×1.00).
 */
const BASELINE: QuoteInput = {
  driverAge: 35,
  yearsLicensed: 10,
  vehicleValue: 150_000,
  annualMileage: 12_000,
  priorClaims: 0,
  coverageTier: "standard",
};

/** Looks up a rated factor by key in a result's ordered factor list. */
function factor(input: QuoteInput, key: FactorKey) {
  const found = rateQuote(input).factors.find((f) => f.key === key);
  if (!found) {
    throw new Error(`factor ${key} missing from result`);
  }
  return found;
}

describe("rateQuote — result shape & ordering (AC2)", () => {
  it("returns base ₪2,400 and exactly six factors", () => {
    const result = rateQuote(BASELINE);
    expect(result.base).toBe(2400);
    expect(result.factors).toHaveLength(6);
  });

  it("emits factors in the fixed order age→…→coverageTier", () => {
    const keys = rateQuote(BASELINE).factors.map((f) => f.key);
    expect(keys).toEqual([...FACTOR_ORDER]);
    expect(keys).toEqual([
      "driverAge",
      "yearsLicensed",
      "vehicleValue",
      "annualMileage",
      "priorClaims",
      "coverageTier",
    ]);
  });

  it("never carries presentation deltas — only key/label/multiplier", () => {
    for (const f of rateQuote(BASELINE).factors) {
      expect(Object.keys(f).sort()).toEqual(["key", "label", "multiplier"]);
    }
  });
});

describe("rateQuote — determinism (AC: identical in → identical out)", () => {
  it("produces deeply-equal output for identical inputs", () => {
    expect(rateQuote(BASELINE)).toEqual(rateQuote(BASELINE));
  });

  it("does not mutate the input", () => {
    const input = { ...BASELINE };
    rateQuote(input);
    expect(input).toEqual(BASELINE);
  });
});

describe("driver-age bands (FR3)", () => {
  const cases: ReadonlyArray<[age: number, band: string, mult: number]> = [
    [17, "17–24", 1.6],
    [24, "17–24", 1.6],
    [25, "25–34", 1.2],
    [34, "25–34", 1.2],
    [35, "35–59", 1.0],
    [59, "35–59", 1.0],
    [60, "60–69", 1.1],
    [69, "60–69", 1.1],
    [70, "70+", 1.35],
    [99, "70+", 1.35],
  ];
  it.each(cases)("age %i → %s ×%f", (age, band, mult) => {
    const f = factor({ ...BASELINE, driverAge: age }, "driverAge");
    expect(f.label).toBe(`Driver age (${band})`);
    expect(f.multiplier).toBe(mult);
  });
});

describe("years-licensed bands (FR3)", () => {
  const cases: ReadonlyArray<[years: number, band: string, mult: number]> = [
    [0, "0–2", 1.25],
    [2, "0–2", 1.25],
    [3, "3–9", 1.05],
    [9, "3–9", 1.05],
    [10, "10+", 0.95],
    [40, "10+", 0.95],
  ];
  it.each(cases)("yearsLicensed %i → %s ×%f", (years, band, mult) => {
    const f = factor({ ...BASELINE, yearsLicensed: years }, "yearsLicensed");
    expect(f.label).toBe(`Years licensed (${band})`);
    expect(f.multiplier).toBe(mult);
  });
});

describe("annual-mileage bands (FR3)", () => {
  const cases: ReadonlyArray<[km: number, band: string, mult: number]> = [
    [0, "0–9,999", 0.9],
    [9_999, "0–9,999", 0.9],
    [10_000, "10,000–19,999", 1.0],
    [19_999, "10,000–19,999", 1.0],
    [20_000, "20,000+", 1.2],
    [100_000, "20,000+", 1.2],
  ];
  it.each(cases)("mileage %i → %s ×%f", (km, band, mult) => {
    const f = factor({ ...BASELINE, annualMileage: km }, "annualMileage");
    expect(f.label).toBe(`Annual mileage (${band})`);
    expect(f.multiplier).toBe(mult);
  });
});

describe("prior-claims map (FR3)", () => {
  const cases: ReadonlyArray<[claims: number, band: string, mult: number]> = [
    [0, "0", 0.9],
    [1, "1", 1.2],
    [2, "2+", 1.6],
    [10, "2+", 1.6],
  ];
  it.each(cases)("priorClaims %i → %s ×%f", (claims, band, mult) => {
    const f = factor({ ...BASELINE, priorClaims: claims }, "priorClaims");
    expect(f.label).toBe(`Prior claims (${band})`);
    expect(f.multiplier).toBe(mult);
  });
});

describe("coverage-tier mapping (FR2 / AC7)", () => {
  const cases: ReadonlyArray<[tier: CoverageTier, band: string, mult: number]> =
    [
      ["basic", "Basic", 0.6],
      ["standard", "Standard", 1.0],
      ["premium", "Premium", 1.4],
    ];
  it.each(cases)("tier %s → %s ×%f", (tier, band, mult) => {
    const f = factor({ ...BASELINE, coverageTier: tier }, "coverageTier");
    expect(f.label).toBe(`Coverage tier (${band})`);
    expect(f.multiplier).toBe(mult);
  });

  it("the exported tier identifiers are exactly basic/standard/premium", () => {
    expect([...COVERAGE_TIERS]).toEqual(["basic", "standard", "premium"]);
  });
});

describe("continuous vehicle-value factor (FR3)", () => {
  it("uses 1 + value/500,000 with a ₪-prefixed grouped label", () => {
    const f = factor({ ...BASELINE, vehicleValue: 150_000 }, "vehicleValue");
    expect(f.label).toBe("Vehicle value (₪150,000)");
    expect(f.multiplier).toBeCloseTo(1.3, 10);
  });

  it("accepts the ₪2,000,000 boundary → ×5.0", () => {
    const f = factor({ ...BASELINE, vehicleValue: 2_000_000 }, "vehicleValue");
    expect(f.label).toBe("Vehicle value (₪2,000,000)");
    expect(f.multiplier).toBeCloseTo(5.0, 10);
  });

  it("clamps values above the cap to ₪2,000,000 (×5.0)", () => {
    const f = factor({ ...BASELINE, vehicleValue: 9_000_000 }, "vehicleValue");
    expect(f.label).toBe("Vehicle value (₪2,000,000)");
    expect(f.multiplier).toBeCloseTo(5.0, 10);
  });

  it("clamps non-positive values up to ₪1 (≈×1.0)", () => {
    const f = factor({ ...BASELINE, vehicleValue: 0 }, "vehicleValue");
    expect(f.label).toBe("Vehicle value (₪1)");
    expect(f.multiplier).toBeCloseTo(1.000002, 10);
  });
});

describe("final premium (FR6 / AC1)", () => {
  it("is base × product of all six multipliers, rounded to ₪1", () => {
    // 1.0 × 0.95 × 1.30 × 1.0 × 0.90 × 1.0 = 1.1115 → ×2400 = 2667.6 → 2668.
    expect(rateQuote(BASELINE).finalPremium).toBe(2668);
  });

  it("rounds a fractional total to the nearest ₪1 (down case)", () => {
    // age35(1.0)·years10(0.95)·veh100000(1.2)·mileage12000(1.0)·claims0(0.9)
    //   ·standard(1.0) = 1.026 → ×2400 = 2462.4 → 2462.
    const result = rateQuote({ ...BASELINE, vehicleValue: 100_000 });
    expect(result.finalPremium).toBe(2462);
  });

  it("matches the documented round(base × Π) formula across many inputs", () => {
    const samples: QuoteInput[] = [
      { ...BASELINE, driverAge: 22, priorClaims: 3, coverageTier: "premium" },
      { ...BASELINE, driverAge: 68, yearsLicensed: 1, annualMileage: 45_000 },
      { ...BASELINE, vehicleValue: 1, coverageTier: "basic" },
      { ...BASELINE, vehicleValue: 777_777, priorClaims: 1 },
    ];
    for (const input of samples) {
      const result = rateQuote(input);
      const product = result.factors.reduce((p, f) => p * f.multiplier, 1);
      const expected = Math.max(
        Math.floor(2400 * product + 0.5),
        PREMIUM_FLOOR_ILS,
      );
      expect(result.finalPremium).toBe(expected);
    }
  });

  it("never produces a fractional premium", () => {
    expect(Number.isInteger(rateQuote(BASELINE).finalPremium)).toBe(true);
  });
});

describe("×1.00 factors leave the running product unchanged (AC4)", () => {
  it("age 35–59, mileage 10k–20k, and standard tier are all ×1.00", () => {
    const result = rateQuote({
      ...BASELINE,
      driverAge: 40,
      annualMileage: 15_000,
      coverageTier: "standard",
    });
    const byKey = Object.fromEntries(result.factors.map((f) => [f.key, f]));
    expect(byKey.driverAge?.multiplier).toBe(1.0);
    expect(byKey.annualMileage?.multiplier).toBe(1.0);
    expect(byKey.coverageTier?.multiplier).toBe(1.0);
  });
});

describe("₪600 floor (FR6)", () => {
  it("is unreachable under the real table — cheapest valid quote exceeds it", () => {
    // Cheapest combination the bands allow: age 35–59 (1.0), 10+ yrs (0.95),
    // ₪1 vehicle (≈1.0), <10k km (0.9), 0 claims (0.9), basic tier (0.6).
    const cheapest = rateQuote({
      driverAge: 40,
      yearsLicensed: 12,
      vehicleValue: 1,
      annualMileage: 5_000,
      priorClaims: 0,
      coverageTier: "basic",
    });
    expect(cheapest.finalPremium).toBeGreaterThan(PREMIUM_FLOOR_ILS);
    expect(cheapest.finalPremium).toBe(1108); // 2400 × 0.4617009 ≈ 1108
  });

  it("clamps a sub-floor product up to exactly ₪600 (defensive)", () => {
    // Drives computeFinalPremium below the floor directly: 2400 × 0.01 = 24.
    expect(computeFinalPremium(0.01)).toBe(PREMIUM_FLOOR_ILS);
  });

  it("does not clamp a product that lands above the floor", () => {
    expect(computeFinalPremium(0.3)).toBe(720); // 2400 × 0.3, above ₪600
  });
});
