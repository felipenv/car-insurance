import { describe, expect, it } from "vitest";

import { rate } from "./engine.js";
import { roundHalfUp } from "./round.js";
import { FACTOR_ORDER, type QuoteInputs } from "./types.js";
import {
  bandedProvider,
  fixedProvider,
  type FactorMultipliers,
} from "./__fixtures__/fakeProvider.js";

const BASE = 2400;

// A neutral, mid-range set of inputs. Individual tests override the fields the
// banded provider keys off of (age, years licensed, mileage); the fixed
// provider ignores inputs entirely.
const INPUTS: QuoteInputs = {
  driverAge: 40,
  yearsLicensed: 12,
  vehicleValue: 120_000,
  annualMileage: 15_000,
  priorClaims: 0,
  coverageTier: "comprehensive",
};

/**
 * Recomputes the expected waterfall independently from the engine and asserts
 * the result reconciles (A5): every `runningSubtotalIls` is the exact running
 * product rounded half-up, every `deltaIls` is the difference of consecutive
 * rounded subtotals, and base + Σ deltas lands exactly on the breakdown total.
 */
function assertReconciles(result: ReturnType<typeof rate>, base: number): void {
  let exactRunning = base;
  let prevRounded = base;
  for (const line of result.lines) {
    exactRunning *= line.multiplier;
    const expectedRunning = roundHalfUp(exactRunning);
    expect(line.runningSubtotalIls).toBe(expectedRunning);
    expect(line.deltaIls).toBe(expectedRunning - prevRounded);
    prevRounded = expectedRunning;
  }

  const breakdownTotal =
    base + result.lines.reduce((sum, line) => sum + line.deltaIls, 0);
  const lastSubtotal = result.lines.at(-1)?.runningSubtotalIls;
  expect(breakdownTotal).toBe(lastSubtotal);
}

describe("rate(): authoritative total (A1)", () => {
  it("returns max(roundHalfUp(base × Π multipliers), 600)", () => {
    const multipliers: FactorMultipliers = {
      age: 1.2,
      yearsLicensed: 0.95,
      vehicleValue: 1.1,
      mileage: 1.0,
      priorClaims: 1.3,
      coverageTier: 1.05,
    };
    const product = 1.2 * 0.95 * 1.1 * 1.0 * 1.3 * 1.05;
    const expected = Math.max(roundHalfUp(BASE * product), 600);

    const result = rate(INPUTS, fixedProvider({ multipliers }));

    expect(result.base).toBe(BASE);
    expect(result.totalIls).toBe(expected);
    // The line multipliers are exactly what the provider resolved.
    expect(result.lines.map((l) => l.multiplier)).toEqual([
      1.2, 0.95, 1.1, 1.0, 1.3, 1.05,
    ]);
  });
});

describe("rate(): band-edge selection (A3)", () => {
  // Lower-inclusive / upper-exclusive, top band unbounded. Each edge value must
  // land in the UPPER band at the boundary. Asserted through the engine via the
  // banded test provider; band selection itself is the provider's job.
  const ageCases: ReadonlyArray<[number, number]> = [
    [25, 1.2],
    [35, 1.0],
    [60, 1.1],
    [70, 1.35],
  ];
  it.each(ageCases)("age %i selects multiplier %f", (driverAge, multiplier) => {
    const result = rate({ ...INPUTS, driverAge }, bandedProvider());
    const ageLine = result.lines.find((l) => l.factorId === "age");
    expect(ageLine?.multiplier).toBe(multiplier);
  });

  const yearsCases: ReadonlyArray<[number, number]> = [
    [3, 1.05],
    [10, 0.95],
  ];
  it.each(yearsCases)(
    "yearsLicensed %i selects multiplier %f",
    (yearsLicensed, multiplier) => {
      const result = rate({ ...INPUTS, yearsLicensed }, bandedProvider());
      const line = result.lines.find((l) => l.factorId === "yearsLicensed");
      expect(line?.multiplier).toBe(multiplier);
    },
  );

  const mileageCases: ReadonlyArray<[number, number]> = [
    [10_000, 1.0],
    [20_000, 1.2],
  ];
  it.each(mileageCases)(
    "mileage %i selects multiplier %f",
    (annualMileage, multiplier) => {
      const result = rate({ ...INPUTS, annualMileage }, bandedProvider());
      const line = result.lines.find((l) => l.factorId === "mileage");
      expect(line?.multiplier).toBe(multiplier);
    },
  );
});

describe("rate(): breakdown order & shape (A4-adjacent guardrail)", () => {
  it("emits exactly six lines in FACTOR_ORDER with the full FactorLine shape", () => {
    const result = rate(INPUTS, fixedProvider());

    expect(result.lines).toHaveLength(6);
    expect(result.lines.map((l) => l.factorId)).toEqual([...FACTOR_ORDER]);
    for (const line of result.lines) {
      expect(Object.keys(line).sort()).toEqual([
        "band",
        "deltaIls",
        "factorId",
        "label",
        "multiplier",
        "runningSubtotalIls",
      ]);
      // Engine-owned human-readable label, distinct from the provider band.
      expect(typeof line.label).toBe("string");
      expect(line.label.length).toBeGreaterThan(0);
    }
    expect(Object.keys(result).sort()).toEqual(["base", "lines", "totalIls"]);
  });
});

describe("rate(): waterfall reconciliation (A5)", () => {
  it("reconciles base + Σ deltas to the breakdown total under rounding", () => {
    // Multipliers chosen so exact subtotals carry fractions and the rounded
    // deltas must still telescope to the breakdown total.
    const result = rate(
      INPUTS,
      fixedProvider({
        multipliers: {
          age: 1.07,
          yearsLicensed: 0.93,
          vehicleValue: 1.111,
          mileage: 0.97,
          priorClaims: 1.23,
          coverageTier: 1.04,
        },
      }),
    );
    assertReconciles(result, BASE);
  });
});

describe("rate(): authoritative-total independence (A6)", () => {
  // Every factor ×1.0002. The exact running product creeps just past successive
  // x.50 tie-points, so the EXACT-product total diverges from a naive
  // "round after each multiplication, then keep multiplying the rounded value"
  // accumulator — which gets stuck at the base because 2400 × 1.0002 = 2400.48
  // rounds back to 2400 every step.
  const PER_FACTOR = 1.0002;

  it("computes totalIls from the exact product, not summed/accumulated rounding", () => {
    const result = rate(
      INPUTS,
      fixedProvider({ defaultMultiplier: PER_FACTOR }),
    );

    const exactProduct = PER_FACTOR ** 6;
    const authoritative = Math.max(roundHalfUp(BASE * exactProduct), 600);
    expect(result.totalIls).toBe(authoritative);
    expect(result.totalIls).toBe(2403); // pin the concrete value

    // The naive round-then-remultiply accumulator diverges and stays at base.
    let naive = BASE;
    for (let k = 0; k < 6; k++) {
      naive = roundHalfUp(naive * PER_FACTOR);
    }
    expect(naive).toBe(2400);
    expect(result.totalIls).not.toBe(naive);

    // Displayed deltas still reconcile to the breakdown total, which here
    // equals the authoritative total (no floor active).
    assertReconciles(result, BASE);
    expect(result.lines.at(-1)?.runningSubtotalIls).toBe(result.totalIls);
    expect(result.lines.map((l) => l.deltaIls)).toEqual([0, 1, 0, 1, 0, 1]);
  });
});

describe("rate(): ₪600 floor clamp (A7)", () => {
  it("clamps a sub-floor premium up to exactly ₪600", () => {
    // NOTE: unreachable under the v1 table by design — the lowest realistic v1
    // multiplier product yields ≈ ₪1,108. Only a synthetic/misconfigured
    // provider like this one can drive the premium below the floor.
    const result = rate(INPUTS, fixedProvider({ defaultMultiplier: 0.5 }));

    // 2400 × 0.5^6 = 37.5 → roundHalfUp → 38, well below the floor.
    expect(roundHalfUp(BASE * 0.5 ** 6)).toBe(38);
    expect(result.totalIls).toBe(600);

    // The displayed breakdown reflects the true (sub-floor) math and so
    // diverges from the clamped authoritative total — the clamp is the one
    // place the two can differ.
    assertReconciles(result, BASE);
    expect(result.lines.at(-1)?.runningSubtotalIls).toBe(38);
    expect(result.lines.at(-1)?.runningSubtotalIls).toBeLessThan(
      result.totalIls,
    );
  });
});

describe("rate(): representative end-to-end case (A8)", () => {
  it("rates a young driver, low mileage, comprehensive cover", () => {
    const result = rate(
      {
        driverAge: 20, // 17–24 → ×1.60
        yearsLicensed: 1, // 0–2  → ×1.25
        vehicleValue: 90_000, // neutral ×1.00 in this fixture
        annualMileage: 5_000, // 0–9,999 → ×0.90
        priorClaims: 0, // neutral ×1.00
        coverageTier: "comprehensive", // neutral ×1.00
      },
      bandedProvider(),
    );

    // Product = 1.60 × 1.25 × 1.00 × 0.90 × 1.00 × 1.00 = 1.8 → 2400 × 1.8.
    expect(result.totalIls).toBe(4320);
    expect(result.lines.map((l) => l.multiplier)).toEqual([
      1.6, 1.25, 1.0, 0.9, 1.0, 1.0,
    ]);
    expect(result.lines.map((l) => l.deltaIls)).toEqual([
      1440, 960, 0, -480, 0, 0,
    ]);
    expect(result.lines.map((l) => l.runningSubtotalIls)).toEqual([
      3840, 4800, 4800, 4320, 4320, 4320,
    ]);
    expect(result.lines.map((l) => l.band)).toEqual([
      "17–24",
      "0–2",
      "v1:vehicleValue",
      "0–9,999",
      "v1:priorClaims",
      "v1:coverageTier",
    ]);
    assertReconciles(result, BASE);
  });
});

describe("rate(): determinism & purity (A9)", () => {
  it("returns identical results for identical inputs and provider", () => {
    const provider = bandedProvider();
    const a = rate(INPUTS, provider);
    const b = rate(INPUTS, provider);
    expect(a).toEqual(b);
  });

  it("does not mutate its inputs", () => {
    const inputs: QuoteInputs = { ...INPUTS };
    const snapshot = { ...inputs };
    rate(inputs, fixedProvider());
    expect(inputs).toEqual(snapshot);
  });
});

describe("rate(): no input re-validation (A11)", () => {
  it("rates blatantly out-of-range inputs without rejecting or transforming them", () => {
    // The engine assumes pre-validated inputs; range/format checks belong to
    // the form and provider. Its only defensive behaviours are half-up rounding
    // and the ₪600 clamp.
    const absurd: QuoteInputs = {
      driverAge: -5,
      yearsLicensed: 999,
      vehicleValue: -1,
      annualMileage: Number.MAX_SAFE_INTEGER,
      priorClaims: -10,
      coverageTier: "comprehensive",
    };

    const provider = fixedProvider({ defaultMultiplier: 1.0 });
    expect(() => rate(absurd, provider)).not.toThrow();

    const result = rate(absurd, provider);
    // Output depends purely on the provider's multipliers, not on input ranges.
    expect(result.totalIls).toBe(BASE);
    expect(result.lines).toHaveLength(6);
  });
});
