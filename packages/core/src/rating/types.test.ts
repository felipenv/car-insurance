import { describe, expect, it } from "vitest";

import {
  COVERAGE_TIERS,
  FACTOR_ORDER,
  type FactorLine,
  type QuoteInputs,
  type RatingProvider,
  type RatingResult,
} from "./types.js";

const SAMPLE_INPUTS: QuoteInputs = {
  driverAge: 30,
  yearsLicensed: 8,
  vehicleValue: 120_000,
  annualMileage: 12_000,
  priorClaims: 0,
  coverageTier: "comprehensive",
};

// Two DIFFERENT conforming providers. They return different band labels and
// multipliers but satisfy the same engine-owned interface. This is the
// swap-stability contract (FR7 / A10): a provider swap may change the numbers,
// never the shape or the factor ordering.
const providerA: RatingProvider = {
  resolve(factorId) {
    return { band: `A:${factorId}`, multiplier: 1.1 };
  },
};

const providerB: RatingProvider = {
  resolve(factorId) {
    return { band: `B:${factorId}`, multiplier: 0.9 };
  },
};

// Build a breakdown skeleton from the frozen ordering. This is NOT the engine
// (no premium math here); it only exercises the contract — that a provider can
// be walked in FACTOR_ORDER to produce FactorLine-shaped objects. The deltaIls
// / runningSubtotalIls fields are stubbed, since the waterfall math belongs to
// the engine in a later feature.
function buildSkeleton(provider: RatingProvider): FactorLine[] {
  return FACTOR_ORDER.map((factorId) => {
    const { band, multiplier } = provider.resolve(factorId, SAMPLE_INPUTS);
    return {
      factorId,
      label: factorId,
      band,
      multiplier,
      deltaIls: 0,
      runningSubtotalIls: 0,
    };
  });
}

const FACTOR_LINE_KEYS = [
  "band",
  "deltaIls",
  "factorId",
  "label",
  "multiplier",
  "runningSubtotalIls",
];

describe("rating contract: frozen constants", () => {
  it("pins the six factors in the fixed application order (A4)", () => {
    expect([...FACTOR_ORDER]).toEqual([
      "age",
      "yearsLicensed",
      "vehicleValue",
      "mileage",
      "priorClaims",
      "coverageTier",
    ]);
  });

  it("exposes the three opaque coverage-tier keys", () => {
    // Opaque illustrative keys — deliberately not Chova / Tzad Gimmel / Makif.
    expect([...COVERAGE_TIERS]).toEqual([
      "third-party",
      "standard",
      "comprehensive",
    ]);
  });
});

describe("rating contract: breakdown shape (A4)", () => {
  it("produces exactly six lines in FACTOR_ORDER", () => {
    const lines = buildSkeleton(providerA);
    expect(lines).toHaveLength(6);
    expect(lines.map((line) => line.factorId)).toEqual([...FACTOR_ORDER]);
  });

  it("exposes exactly the FactorLine fields on every line", () => {
    for (const line of buildSkeleton(providerA)) {
      expect(Object.keys(line).sort()).toEqual(FACTOR_LINE_KEYS);
    }
  });

  it("exposes base, lines, and totalIls on the result", () => {
    const result: RatingResult = {
      base: 2400,
      lines: buildSkeleton(providerA),
      totalIls: 2400,
    };
    expect(Object.keys(result).sort()).toEqual(["base", "lines", "totalIls"]);
  });
});

describe("rating contract: swap stability (FR7 / A10)", () => {
  it("keeps identical shape and ordering across different providers", () => {
    const a = buildSkeleton(providerA);
    const b = buildSkeleton(providerB);

    // Same ordering and same per-line field set, regardless of provider.
    expect(a.map((line) => line.factorId)).toEqual(
      b.map((line) => line.factorId),
    );
    expect(b.map((line) => Object.keys(line).sort())).toEqual(
      a.map((line) => Object.keys(line).sort()),
    );

    // Only the numbers / labels differ between providers.
    expect(a[0]?.band).not.toEqual(b[0]?.band);
    expect(a[0]?.multiplier).not.toEqual(b[0]?.multiplier);
  });
});
