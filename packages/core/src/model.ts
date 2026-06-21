/**
 * The illustrative v1 rating model: the deterministic numeric source of truth
 * for every constant the engine uses (FR5 / FR6 / AC10).
 *
 * This module owns the base premium, the per-factor bands and multipliers, the
 * coverage-tier map, the continuous vehicle-value formula, the nearest-₪1
 * rounding rule, and the ₪600 floor. `rateQuote.ts` orchestrates a walk over
 * these; it holds no constants of its own. WEB consumes the engine's output and
 * never restates any number here.
 *
 * Everything is pure, deterministic, and offline — no I/O, no persistence, no
 * PII. Identical inputs always yield identical output.
 *
 * Figures are ILLUSTRATIVE — not real Harel rates and not a binding quote. The
 * coverage-tier identifiers (`basic` / `standard` / `premium`) are abstract
 * pricing bands chosen deliberately so they do NOT imply Israel's legal
 * categories (Chova / Tzad Gimmel / Makif).
 */

import {
  type CoverageTier,
  type FactorKey,
  type QuoteInput,
  type RatedFactor,
} from "./types.js";

/** Base annual premium in ₪ (FR7). The product of all six multipliers scales it. */
export const BASE_PREMIUM_ILS = 2400;

/**
 * Defensive floor in ₪ (FR6). Any computed premium below this is raised to
 * exactly this value. Unreachable under the v1 table by design (the cheapest
 * valid combination yields ≈ ₪1,108); it guards against future cheaper bands or
 * a misconfigured model.
 */
export const PREMIUM_FLOOR_ILS = 600;

// Vehicle value is a continuous factor, not a banded one (see vehicleValueBand).
const VEHICLE_VALUE_MIN_ILS = 1;
const VEHICLE_VALUE_MAX_ILS = 2_000_000;
const VEHICLE_VALUE_DIVISOR_ILS = 500_000;

/**
 * Engine-owned, human-readable factor names. Combined with the matched band to
 * form a {@link RatedFactor.label}, e.g. "Driver age" + "35–59" →
 * "Driver age (35–59)".
 */
const FACTOR_NAMES: Record<FactorKey, string> = {
  driverAge: "Driver age",
  yearsLicensed: "Years licensed",
  vehicleValue: "Vehicle value",
  annualMileage: "Annual mileage",
  priorClaims: "Prior claims",
  coverageTier: "Coverage tier",
};

/** The band label + multiplier the model resolves for a single factor. */
interface Band {
  /** Lower-inclusive bound. */
  readonly min: number;
  /** Upper-exclusive bound (top band uses `Infinity`). */
  readonly max: number;
  /** Human-readable band display label, e.g. "35–59". */
  readonly label: string;
  /** The band's multiplier. */
  readonly multiplier: number;
}

/** What resolving one factor yields before the factor name is prefixed. */
interface ResolvedBand {
  readonly label: string;
  readonly multiplier: number;
}

// --- Banded factor tables (locked display strings) --------------------------

/** Driver age in years (FR3). */
const AGE_BANDS: readonly Band[] = [
  { min: 17, max: 25, label: "17–24", multiplier: 1.6 },
  { min: 25, max: 35, label: "25–34", multiplier: 1.2 },
  { min: 35, max: 60, label: "35–59", multiplier: 1.0 },
  { min: 60, max: 70, label: "60–69", multiplier: 1.1 },
  { min: 70, max: Infinity, label: "70+", multiplier: 1.35 },
];

/** Years the driver has held a licence (FR3). */
const YEARS_LICENSED_BANDS: readonly Band[] = [
  { min: 0, max: 3, label: "0–2", multiplier: 1.25 },
  { min: 3, max: 10, label: "3–9", multiplier: 1.05 },
  { min: 10, max: Infinity, label: "10+", multiplier: 0.95 },
];

/** Annual mileage in km (FR3). */
const MILEAGE_BANDS: readonly Band[] = [
  { min: 0, max: 10_000, label: "0–9,999", multiplier: 0.9 },
  { min: 10_000, max: 20_000, label: "10,000–19,999", multiplier: 1.0 },
  { min: 20_000, max: Infinity, label: "20,000+", multiplier: 1.2 },
];

/**
 * Selects the band whose `[min, max)` interval contains `value` — uniformly
 * lower-inclusive / upper-exclusive with an unbounded top band. This is the
 * single place the boundary convention lives, so every banded factor shares the
 * same edge semantics and there are no per-factor edge bugs.
 *
 * The tables cover their whole valid domain with no gaps, so any value at or
 * above the first band's `min` matches. A value below it can only come from
 * input that should have been rejected upstream; we throw rather than silently
 * mis-band it.
 */
function selectBand(bands: readonly Band[], value: number): ResolvedBand {
  const band = bands.find((b) => value >= b.min && value < b.max);
  if (!band) {
    throw new RangeError(`No band matches value ${value}`);
  }
  return { label: band.label, multiplier: band.multiplier };
}

/**
 * Resolves the prior-claims factor (FR3): 0 → ×0.90, 1 → ×1.20, and any integer
 * ≥ 2 → ×1.60. Negatives and non-integers are rejected defensively even though
 * the form validates upstream.
 */
function priorClaimsBand(priorClaims: number): ResolvedBand {
  if (!Number.isInteger(priorClaims) || priorClaims < 0) {
    throw new RangeError(
      `priorClaims must be a non-negative integer, got ${priorClaims}`,
    );
  }
  if (priorClaims === 0) {
    return { label: "0", multiplier: 0.9 };
  }
  if (priorClaims === 1) {
    return { label: "1", multiplier: 1.2 };
  }
  return { label: "2+", multiplier: 1.6 };
}

/**
 * Coverage-tier map (FR2 / AC7): identifier → label + multiplier. The labels
 * are neutral and illustrative; they do NOT imply Israel's legal categories.
 */
const COVERAGE_TIER_BANDS: Record<CoverageTier, ResolvedBand> = {
  basic: { label: "Basic", multiplier: 0.6 },
  standard: { label: "Standard", multiplier: 1.0 },
  premium: { label: "Premium", multiplier: 1.4 },
};

/** Clamps `value` into the inclusive `[min, max]` range. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Groups an integer with thousands separators (e.g. 150000 → "150,000") for the
 * vehicle-value band label. Deterministic and locale-free.
 */
function groupThousands(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * Resolves the continuous vehicle-value factor (FR3): clamp the value to
 * `[1, 2,000,000]` ₪, then `multiplier = 1 + clamped / 500,000` (≈ ×1.0 at ₪1
 * up to ×5.0 at ₪2,000,000). The clamp runs before the formula so an unbounded
 * high value can never be produced; zero/negative input is rejected upstream
 * and clamped here defensively. The label is the clamped value formatted with a
 * leading ₪, e.g. "₪150,000".
 */
function vehicleValueBand(vehicleValueIls: number): ResolvedBand {
  const clamped = clamp(
    vehicleValueIls,
    VEHICLE_VALUE_MIN_ILS,
    VEHICLE_VALUE_MAX_ILS,
  );
  return {
    label: `₪${groupThousands(clamped)}`,
    multiplier: 1 + clamped / VEHICLE_VALUE_DIVISOR_ILS,
  };
}

/** Resolves the matched band (label + multiplier) for one factor. */
function bandFor(key: FactorKey, input: QuoteInput): ResolvedBand {
  switch (key) {
    case "driverAge":
      return selectBand(AGE_BANDS, input.driverAge);
    case "yearsLicensed":
      return selectBand(YEARS_LICENSED_BANDS, input.yearsLicensed);
    case "vehicleValue":
      return vehicleValueBand(input.vehicleValue);
    case "annualMileage":
      return selectBand(MILEAGE_BANDS, input.annualMileage);
    case "priorClaims":
      return priorClaimsBand(input.priorClaims);
    case "coverageTier":
      return COVERAGE_TIER_BANDS[input.coverageTier];
  }
}

/**
 * Resolves one rating factor to a {@link RatedFactor}: the factor key, the
 * human-readable matched-band label (factor name + band, e.g.
 * "Driver age (35–59)"), and the band's multiplier.
 */
export function resolveFactor(key: FactorKey, input: QuoteInput): RatedFactor {
  const { label, multiplier } = bandFor(key, input);
  return { key, label: `${FACTOR_NAMES[key]} (${label})`, multiplier };
}

/**
 * Rounds to the nearest whole ₪1 with a HALF-UP tie-break (x.50 → x+1, e.g.
 * 2667.5 → 2668). `Math.floor(value + 0.5)` gives exactly this for the
 * non-negative premium values the engine deals with; banker's rounding is
 * explicitly NOT used.
 */
function roundToNearestShekel(value: number): number {
  return Math.floor(value + 0.5);
}

/**
 * Computes the authoritative final premium from the EXACT product of all six
 * multipliers (FR6): `base × product`, rounded to the nearest ₪1, then floored
 * at ₪600. This is the single source of the authoritative total — it never
 * derives from summed displayed deltas.
 */
export function computeFinalPremium(multiplierProduct: number): number {
  const rounded = roundToNearestShekel(BASE_PREMIUM_ILS * multiplierProduct);
  return Math.max(rounded, PREMIUM_FLOOR_ILS);
}
