import { describe, expect, it } from "vitest";

import {
  ageFactor,
  BASE_PREMIUM_ILS,
  coverageTierFactor,
  mileageFactor,
  priorClaimsFactor,
  vehicleValueFactor,
  yearsLicensedFactor,
  VEHICLE_VALUE_DIVISOR_ILS,
} from "./rate-table.js";

// Vehicle-value assertions compare floats, so use a tolerance rather than exact
// equality (R5).
const EPSILON = 1e-9;

describe("BASE_PREMIUM_ILS (AC1)", () => {
  it("is ₪2,400", () => {
    expect(BASE_PREMIUM_ILS).toBe(2400);
  });
});

describe("ageFactor — bands, edges, and convention (FR3 / AC2 / AC3)", () => {
  it("returns the in-band multiplier and locked label for each band", () => {
    expect(ageFactor(20)).toEqual({ band: "17–24", multiplier: 1.6 });
    expect(ageFactor(30)).toEqual({ band: "25–34", multiplier: 1.2 });
    expect(ageFactor(45)).toEqual({ band: "35–59", multiplier: 1.0 });
    expect(ageFactor(65)).toEqual({ band: "60–69", multiplier: 1.1 });
    expect(ageFactor(80)).toEqual({ band: "70+", multiplier: 1.35 });
  });

  // Both-side boundary tests: the lower edge is inclusive (lands in the upper
  // band), one below stays in the lower band.
  it("is lower-inclusive / upper-exclusive at every edge", () => {
    expect(ageFactor(24).multiplier).toBe(1.6);
    expect(ageFactor(25).multiplier).toBe(1.2); // locked edge
    expect(ageFactor(34).multiplier).toBe(1.2);
    expect(ageFactor(35).multiplier).toBe(1.0);
    expect(ageFactor(59).multiplier).toBe(1.0);
    expect(ageFactor(60).multiplier).toBe(1.1); // locked edge
    expect(ageFactor(69).multiplier).toBe(1.1);
    expect(ageFactor(70).multiplier).toBe(1.35); // locked edge
  });

  it("locks the pinned edges age 25→1.20, 60→1.10, 70→1.35 (AC2)", () => {
    expect(ageFactor(25).multiplier).toBe(1.2);
    expect(ageFactor(60).multiplier).toBe(1.1);
    expect(ageFactor(70).multiplier).toBe(1.35);
  });
});

describe("yearsLicensedFactor — bands, edges, and convention (FR4 / AC2 / AC3)", () => {
  it("returns the in-band multiplier and locked label for each band", () => {
    expect(yearsLicensedFactor(1)).toEqual({ band: "0–2", multiplier: 1.25 });
    expect(yearsLicensedFactor(5)).toEqual({ band: "3–9", multiplier: 1.05 });
    expect(yearsLicensedFactor(15)).toEqual({ band: "10+", multiplier: 0.95 });
  });

  it("is lower-inclusive / upper-exclusive at every edge", () => {
    expect(yearsLicensedFactor(0).multiplier).toBe(1.25);
    expect(yearsLicensedFactor(2).multiplier).toBe(1.25);
    expect(yearsLicensedFactor(3).multiplier).toBe(1.05); // locked edge
    expect(yearsLicensedFactor(9).multiplier).toBe(1.05);
    expect(yearsLicensedFactor(10).multiplier).toBe(0.95); // locked edge
  });

  it("locks the pinned edges licensed 3→1.05, 10→0.95 (AC2)", () => {
    expect(yearsLicensedFactor(3).multiplier).toBe(1.05);
    expect(yearsLicensedFactor(10).multiplier).toBe(0.95);
  });
});

describe("mileageFactor — bands, edges, and convention (FR6 / AC2 / AC3)", () => {
  it("returns the in-band multiplier and locked label for each band", () => {
    expect(mileageFactor(5_000)).toEqual({ band: "0–9,999", multiplier: 0.9 });
    expect(mileageFactor(15_000)).toEqual({
      band: "10,000–19,999",
      multiplier: 1.0,
    });
    expect(mileageFactor(30_000)).toEqual({ band: "20,000+", multiplier: 1.2 });
  });

  it("is lower-inclusive / upper-exclusive at every edge", () => {
    expect(mileageFactor(0).multiplier).toBe(0.9);
    expect(mileageFactor(9_999).multiplier).toBe(0.9);
    expect(mileageFactor(10_000).multiplier).toBe(1.0); // locked edge
    expect(mileageFactor(19_999).multiplier).toBe(1.0);
    expect(mileageFactor(20_000).multiplier).toBe(1.2); // locked edge
  });

  it("locks the pinned edges mileage 10,000→1.00, 20,000→1.20 (AC2)", () => {
    expect(mileageFactor(10_000).multiplier).toBe(1.0);
    expect(mileageFactor(20_000).multiplier).toBe(1.2);
  });
});

describe("vehicleValueFactor — continuous, clamped (FR5 / AC4)", () => {
  it("uses 1 + clamped / 500,000", () => {
    expect(vehicleValueFactor(250_000).multiplier).toBeCloseTo(1.5, 9);
    expect(VEHICLE_VALUE_DIVISOR_ILS).toBe(500_000);
  });

  it("≈ ×1.000002 at the ₪1 lower clamp", () => {
    expect(vehicleValueFactor(1).multiplier).toBeCloseTo(1 + 1 / 500_000, 12);
  });

  it("= ×2.000 at ₪500,000", () => {
    expect(Math.abs(vehicleValueFactor(500_000).multiplier - 2.0)).toBeLessThan(
      EPSILON,
    );
  });

  it("= ×5.000 at the ₪2,000,000 upper clamp", () => {
    expect(
      Math.abs(vehicleValueFactor(2_000_000).multiplier - 5.0),
    ).toBeLessThan(EPSILON);
  });

  it("clamps an over-cap value (₪5,000,000) to ×5.000", () => {
    expect(
      Math.abs(vehicleValueFactor(5_000_000).multiplier - 5.0),
    ).toBeLessThan(EPSILON);
  });

  it("clamps zero/negative input up to the ₪1 floor defensively", () => {
    expect(vehicleValueFactor(0).multiplier).toBeCloseTo(1 + 1 / 500_000, 12);
    expect(vehicleValueFactor(-1000).multiplier).toBeCloseTo(
      1 + 1 / 500_000,
      12,
    );
  });
});

describe("priorClaimsFactor — discrete map with rejection (FR7 / AC5)", () => {
  it("maps 0→0.90, 1→1.20, 2→1.60, and large→1.60", () => {
    expect(priorClaimsFactor(0)).toEqual({ band: "0", multiplier: 0.9 });
    expect(priorClaimsFactor(1)).toEqual({ band: "1", multiplier: 1.2 });
    expect(priorClaimsFactor(2)).toEqual({ band: "2+", multiplier: 1.6 });
    expect(priorClaimsFactor(1000)).toEqual({ band: "2+", multiplier: 1.6 });
  });

  it("rejects negatives and non-integers", () => {
    expect(() => priorClaimsFactor(-1)).toThrow(RangeError);
    expect(() => priorClaimsFactor(1.5)).toThrow(RangeError);
    expect(() => priorClaimsFactor(Number.NaN)).toThrow(RangeError);
  });
});

describe("coverageTierFactor — discrete enum (FR8 / AC6)", () => {
  it("maps basic→0.60, standard→1.00, premium→1.40 with locked labels", () => {
    expect(coverageTierFactor("basic")).toEqual({
      band: "Basic",
      multiplier: 0.6,
    });
    expect(coverageTierFactor("standard")).toEqual({
      band: "Standard",
      multiplier: 1.0,
    });
    expect(coverageTierFactor("premium")).toEqual({
      band: "Premium",
      multiplier: 1.4,
    });
  });
});
