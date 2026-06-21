import { describe, expect, it } from "vitest";

// Imported from the package's PUBLIC entry point — the same surface the engine
// and WEB build against — never a locally redefined contract (AC9).
import {
  FACTOR_ORDER,
  IllustrativeRatingProvider,
  rate,
  type CoverageTier,
  type QuoteInputs,
  type RatingProvider,
} from "../index.js";
import { fixedProvider } from "./__fixtures__/fakeProvider.js";

// Vehicle-value assertions compare floats, so use a tolerance rather than exact
// equality (R5).
const EPSILON = 1e-9;

// A realistic, mid-table set of inputs. Individual tests override one field to
// isolate the factor under test.
const BASE_INPUTS: QuoteInputs = {
  driverAge: 40,
  yearsLicensed: 12,
  vehicleValue: 500_000,
  annualMileage: 12_000,
  priorClaims: 0,
  coverageTier: "standard",
};

function inputs(overrides: Partial<QuoteInputs> = {}): QuoteInputs {
  return { ...BASE_INPUTS, ...overrides };
}

const provider = new IllustrativeRatingProvider();

describe("interface conformance and public surface (AC9)", () => {
  it("is assignable to the imported RatingProvider interface", () => {
    // Type-level conformance: this only compiles if the class satisfies the
    // frozen contract exactly. The annotation is the assertion.
    const conforming: RatingProvider = provider;
    expect(typeof conforming.resolve).toBe("function");
  });

  it("exposes no public surface beyond resolve()", () => {
    // The provider holds no instance fields...
    expect(Object.keys(provider)).toEqual([]);
    // ...and its prototype carries exactly `resolve` (plus the constructor).
    const methods = Object.getOwnPropertyNames(
      IllustrativeRatingProvider.prototype,
    ).filter((name) => name !== "constructor");
    expect(methods).toEqual(["resolve"]);
  });
});

describe("base premium (AC1)", () => {
  it("the engine rates this provider against a ₪2,400 base", () => {
    expect(rate(inputs(), provider).base).toBe(2400);
  });
});

describe("factor order and entry shape (AC7)", () => {
  it("the engine walks the provider in the fixed factor order", () => {
    const lines = rate(inputs(), provider).lines;
    expect(lines.map((line) => line.factorId)).toEqual([...FACTOR_ORDER]);
  });

  it("resolves every factor to a non-empty band label and finite multiplier", () => {
    for (const factorId of FACTOR_ORDER) {
      const { band, multiplier } = provider.resolve(factorId, inputs());
      expect(typeof band).toBe("string");
      expect(band.length).toBeGreaterThan(0);
      expect(Number.isFinite(multiplier)).toBe(true);
    }
  });

  it("each resolution carries exactly the FactorResolution fields", () => {
    for (const factorId of FACTOR_ORDER) {
      const resolution = provider.resolve(factorId, inputs());
      expect(Object.keys(resolution).sort()).toEqual(["band", "multiplier"]);
    }
  });
});

describe("driver-age bands and locked edges (AC2 / AC3)", () => {
  const ageMultiplier = (driverAge: number) =>
    provider.resolve("age", inputs({ driverAge })).multiplier;

  it("returns the in-band multiplier and locked label for each band", () => {
    expect(provider.resolve("age", inputs({ driverAge: 20 }))).toEqual({
      band: "17–24",
      multiplier: 1.6,
    });
    expect(provider.resolve("age", inputs({ driverAge: 30 }))).toEqual({
      band: "25–34",
      multiplier: 1.2,
    });
    expect(provider.resolve("age", inputs({ driverAge: 45 }))).toEqual({
      band: "35–59",
      multiplier: 1.0,
    });
    expect(provider.resolve("age", inputs({ driverAge: 65 }))).toEqual({
      band: "60–69",
      multiplier: 1.1,
    });
    expect(provider.resolve("age", inputs({ driverAge: 80 }))).toEqual({
      band: "70+",
      multiplier: 1.35,
    });
  });

  it("is lower-inclusive / upper-exclusive at every edge", () => {
    expect(ageMultiplier(24)).toBe(1.6);
    expect(ageMultiplier(25)).toBe(1.2); // locked edge
    expect(ageMultiplier(34)).toBe(1.2);
    expect(ageMultiplier(35)).toBe(1.0); // locked edge
    expect(ageMultiplier(59)).toBe(1.0);
    expect(ageMultiplier(60)).toBe(1.1); // locked edge
    expect(ageMultiplier(69)).toBe(1.1);
    expect(ageMultiplier(70)).toBe(1.35); // locked edge
  });

  it("locks the pinned edges age 25→1.20, 35→1.00, 60→1.10, 70→1.35", () => {
    expect(ageMultiplier(25)).toBe(1.2);
    expect(ageMultiplier(35)).toBe(1.0);
    expect(ageMultiplier(60)).toBe(1.1);
    expect(ageMultiplier(70)).toBe(1.35);
  });
});

describe("years-licensed bands and locked edges (AC2 / AC3)", () => {
  const licensedMultiplier = (yearsLicensed: number) =>
    provider.resolve("yearsLicensed", inputs({ yearsLicensed })).multiplier;

  it("returns the in-band multiplier and locked label for each band", () => {
    expect(
      provider.resolve("yearsLicensed", inputs({ yearsLicensed: 1 })),
    ).toEqual({ band: "0–2", multiplier: 1.25 });
    expect(
      provider.resolve("yearsLicensed", inputs({ yearsLicensed: 5 })),
    ).toEqual({ band: "3–9", multiplier: 1.05 });
    expect(
      provider.resolve("yearsLicensed", inputs({ yearsLicensed: 15 })),
    ).toEqual({ band: "10+", multiplier: 0.95 });
  });

  it("is lower-inclusive / upper-exclusive at every edge", () => {
    expect(licensedMultiplier(2)).toBe(1.25);
    expect(licensedMultiplier(3)).toBe(1.05); // locked edge
    expect(licensedMultiplier(9)).toBe(1.05);
    expect(licensedMultiplier(10)).toBe(0.95); // locked edge
  });
});

describe("annual-mileage bands and locked edges (AC2 / AC3)", () => {
  const mileageMultiplier = (annualMileage: number) =>
    provider.resolve("mileage", inputs({ annualMileage })).multiplier;

  it("returns the in-band multiplier and locked label for each band", () => {
    expect(
      provider.resolve("mileage", inputs({ annualMileage: 5_000 })),
    ).toEqual({ band: "0–9,999", multiplier: 0.9 });
    expect(
      provider.resolve("mileage", inputs({ annualMileage: 15_000 })),
    ).toEqual({ band: "10,000–19,999", multiplier: 1.0 });
    expect(
      provider.resolve("mileage", inputs({ annualMileage: 25_000 })),
    ).toEqual({ band: "20,000+", multiplier: 1.2 });
  });

  it("is lower-inclusive / upper-exclusive at every edge", () => {
    expect(mileageMultiplier(9_999)).toBe(0.9);
    expect(mileageMultiplier(10_000)).toBe(1.0); // locked edge
    expect(mileageMultiplier(19_999)).toBe(1.0);
    expect(mileageMultiplier(20_000)).toBe(1.2); // locked edge
  });
});

describe("vehicle-value continuous factor (AC4)", () => {
  const valueMultiplier = (vehicleValue: number) =>
    provider.resolve("vehicleValue", inputs({ vehicleValue })).multiplier;

  it("computes 1 + clamped/500,000 at the pinned points", () => {
    expect(valueMultiplier(1)).toBeCloseTo(1.000002, 6);
    expect(valueMultiplier(500_000)).toBeCloseTo(2.0, 9);
    expect(valueMultiplier(2_000_000)).toBeCloseTo(5.0, 9);
  });

  it("clamps an over-cap value to ×5.000", () => {
    expect(Math.abs(valueMultiplier(5_000_000) - 5.0)).toBeLessThan(EPSILON);
  });

  it("clamps a below-floor value up to the ₪1 minimum", () => {
    expect(valueMultiplier(0)).toBeCloseTo(1.000002, 6);
    expect(valueMultiplier(-1_000)).toBeCloseTo(1.000002, 6);
  });
});

describe("prior-claims map (AC5)", () => {
  const claimsMultiplier = (priorClaims: number) =>
    provider.resolve("priorClaims", inputs({ priorClaims })).multiplier;

  it("maps 0→0.90, 1→1.20, 2→1.60, and a large value→1.60", () => {
    expect(claimsMultiplier(0)).toBe(0.9);
    expect(claimsMultiplier(1)).toBe(1.2);
    expect(claimsMultiplier(2)).toBe(1.6);
    expect(claimsMultiplier(1_000)).toBe(1.6);
  });

  it("rejects negative and non-integer claim counts", () => {
    expect(() =>
      provider.resolve("priorClaims", inputs({ priorClaims: -1 })),
    ).toThrow(RangeError);
    expect(() =>
      provider.resolve("priorClaims", inputs({ priorClaims: 2.5 })),
    ).toThrow(RangeError);
  });
});

describe("coverage-tier map (AC6)", () => {
  const resolveTier = (coverageTier: CoverageTier) =>
    provider.resolve("coverageTier", inputs({ coverageTier }));

  it("maps the engine's tier keys onto the illustrative pricing tiers", () => {
    expect(resolveTier("third-party")).toEqual({
      band: "Basic",
      multiplier: 0.6,
    });
    expect(resolveTier("standard")).toEqual({
      band: "Standard",
      multiplier: 1.0,
    });
    expect(resolveTier("comprehensive")).toEqual({
      band: "Premium",
      multiplier: 1.4,
    });
  });
});

describe("₪600 floor as a defensive clamp (AC8)", () => {
  // The floor is owned by the engine's final math (FR10): a synthetic provider
  // whose multipliers drive the premium below ₪600 must clamp UP to exactly
  // ₪600. It is UNREACHABLE under the current illustrative table by design —
  // the cheapest real combination still lands far above it (asserted below).
  it("clamps a synthetic sub-floor premium to exactly ₪600", () => {
    const subFloor = fixedProvider({ defaultMultiplier: 0.1 });
    expect(rate(inputs(), subFloor).totalIls).toBe(600);
  });

  it("is unreachable under the real table — the cheapest combination floors well above ₪600", () => {
    // Cheapest band of every factor: age 35–59 (×1.0), licensed 10+ (×0.95),
    // vehicle value ₪1 (≈×1.0), mileage 0–9,999 (×0.9), claims 0 (×0.9),
    // tier third-party→Basic (×0.6) ⇒ ≈ ₪1,108 ≫ ₪600.
    const cheapest = inputs({
      driverAge: 45,
      yearsLicensed: 15,
      vehicleValue: 1,
      annualMileage: 5_000,
      priorClaims: 0,
      coverageTier: "third-party",
    });
    expect(rate(cheapest, provider).totalIls).toBeGreaterThan(600);
  });
});

describe("determinism and purity (AC10)", () => {
  it("returns deep-equal resolutions for identical inputs", () => {
    for (const factorId of FACTOR_ORDER) {
      const first = provider.resolve(factorId, inputs());
      const second = provider.resolve(factorId, inputs());
      expect(first).toEqual(second);
    }
  });

  it("does not mutate the inputs it is given", () => {
    const original = inputs({ driverAge: 25, vehicleValue: 750_000 });
    const snapshot = { ...original };
    for (const factorId of FACTOR_ORDER) {
      provider.resolve(factorId, original);
    }
    expect(original).toEqual(snapshot);
  });

  it("produces an identical full breakdown across repeated engine runs", () => {
    const sample = inputs({ driverAge: 22, coverageTier: "comprehensive" });
    expect(rate(sample, provider)).toEqual(rate(sample, provider));
  });
});
