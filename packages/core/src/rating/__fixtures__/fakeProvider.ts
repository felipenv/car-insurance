/**
 * Reusable synthetic {@link RatingProvider}s for engine tests.
 *
 * The engine owns no bands or multipliers, so every behavioural test injects a
 * provider here:
 *
 *  - {@link fixedProvider} returns a CONSTANT multiplier per factor, independent
 *    of the inputs. It is the workhorse for the total formula, the exact-vs-
 *    rounded divergence case, the sub-floor clamp, determinism, and the
 *    no-re-validation test.
 *  - {@link bandedProvider} implements the illustrative v1 band selection for
 *    the three numeric factors (age, years licensed, mileage) with
 *    lower-inclusive / upper-exclusive edges and an unbounded top band, so band
 *    boundary behaviour can be asserted through the engine.
 *
 * These are test doubles only. The real v1 table lives in feature #3; this file
 * deliberately keeps the non-banded factors at a neutral ×1.0 so tests reason
 * about exactly the multipliers the spec pins.
 */

import type {
  FactorId,
  FactorResolution,
  QuoteInputs,
  RatingProvider,
} from "../types.js";

/** Per-factor multiplier overrides. Omitted factors fall back to a default. */
export type FactorMultipliers = Partial<Record<FactorId, number>>;

export interface FixedProviderConfig {
  /** Multiplier to return per factor. Missing factors use `defaultMultiplier`. */
  readonly multipliers?: FactorMultipliers;
  /** Fallback multiplier for any factor not in `multipliers`. Defaults to 1. */
  readonly defaultMultiplier?: number;
}

/**
 * A provider that returns a fixed multiplier per factor, ignoring the inputs.
 *
 * Lets a test pin the exact product the engine sees so the authoritative total
 * and the waterfall are fully predictable.
 */
export function fixedProvider(
  config: FixedProviderConfig = {},
): RatingProvider {
  const { multipliers = {}, defaultMultiplier = 1 } = config;
  return {
    resolve(factorId: FactorId): FactorResolution {
      const multiplier = multipliers[factorId] ?? defaultMultiplier;
      return { band: `fixed:${factorId}=${multiplier}`, multiplier };
    },
  };
}

/** One band: lower-inclusive `min`, upper-exclusive `max` (top band uses ∞). */
interface Band {
  readonly min: number;
  readonly max: number;
  readonly label: string;
  readonly multiplier: number;
}

// Illustrative v1 bands for the numeric factors, exactly as the spec pins them.
// Selection is lower-inclusive / upper-exclusive; the top band is unbounded.
const AGE_BANDS: readonly Band[] = [
  { min: 17, max: 25, label: "17–24", multiplier: 1.6 },
  { min: 25, max: 35, label: "25–34", multiplier: 1.2 },
  { min: 35, max: 60, label: "35–59", multiplier: 1.0 },
  { min: 60, max: 70, label: "60–69", multiplier: 1.1 },
  { min: 70, max: Infinity, label: "70+", multiplier: 1.35 },
];

const YEARS_LICENSED_BANDS: readonly Band[] = [
  { min: 0, max: 3, label: "0–2", multiplier: 1.25 },
  { min: 3, max: 10, label: "3–9", multiplier: 1.05 },
  { min: 10, max: Infinity, label: "10+", multiplier: 0.95 },
];

const MILEAGE_BANDS: readonly Band[] = [
  { min: 0, max: 10_000, label: "0–9,999", multiplier: 0.9 },
  { min: 10_000, max: 20_000, label: "10,000–19,999", multiplier: 1.0 },
  { min: 20_000, max: Infinity, label: "20,000+", multiplier: 1.2 },
];

/**
 * Selects the band whose [min, max) interval contains `value` and returns it as
 * a {@link FactorResolution} (band label + multiplier).
 */
function selectBand(bands: readonly Band[], value: number): FactorResolution {
  const band = bands.find((b) => value >= b.min && value < b.max);
  if (!band) {
    // Bands cover [0, ∞) for any valid input, so this is unreachable in tests.
    throw new Error(`No band matches value ${value}`);
  }
  return { band: band.label, multiplier: band.multiplier };
}

/**
 * A provider that selects v1 bands for the numeric factors (age, years
 * licensed, mileage) from the inputs, and returns a neutral ×1.0 for the
 * remaining factors. Use it to assert band-edge selection through the engine.
 */
export function bandedProvider(): RatingProvider {
  return {
    resolve(factorId: FactorId, inputs: QuoteInputs): FactorResolution {
      switch (factorId) {
        case "age":
          return selectBand(AGE_BANDS, inputs.driverAge);
        case "yearsLicensed":
          return selectBand(YEARS_LICENSED_BANDS, inputs.yearsLicensed);
        case "mileage":
          return selectBand(MILEAGE_BANDS, inputs.annualMileage);
        default:
          // vehicleValue, priorClaims, coverageTier: neutral in this fixture.
          // The full v1 table for these lives in feature #3.
          return { band: `v1:${factorId}`, multiplier: 1.0 };
      }
    },
  };
}
