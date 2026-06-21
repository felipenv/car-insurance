/**
 * The illustrative v1 rate table: the deterministic numeric source of truth for
 * the rating model, as pure data + pure functions (feature #3, t1).
 *
 * This module owns the bands, multipliers, the base premium, the claims/tier
 * maps, and the continuous vehicle-value formula. It is intentionally
 * independent of the engine's {@link RatingProvider} interface (it imports
 * nothing from `./types.js`): it is the replaceable pricing data that the
 * provider (t2) composes into the interface-conforming breakdown. Keeping the
 * table free of the interface lets it be unit-tested and swapped on its own.
 *
 * Everything here is pure, deterministic, and offline — no I/O, no persistence,
 * no PII (A10). Identical inputs always yield identical output.
 *
 * Figures are ILLUSTRATIVE — not real Harel rates and not a binding quote. The
 * coverage-tier keys here (`basic`/`standard`/`premium`) are abstract pricing
 * bands chosen deliberately so they do NOT imply Israel's legal categories
 * (Chova / Tzad Gimmel / Makif). Currency is ₪ (ILS); this module emits bare
 * numeric multipliers and the base only — no ₪ formatting, totals, or floor
 * (those are owned by the engine and the result UI).
 */

/**
 * Base annual premium in ₪ (FR1 / AC1). The engine multiplies the per-factor
 * multipliers against this; the table is its numeric source of truth.
 */
export const BASE_PREMIUM_ILS = 2400;

/**
 * Inclusive bounds the vehicle value is clamped to before the formula runs
 * (FR5 / AC4). The lower clamp makes the zero/negative input case impossible
 * here (it is rejected upstream at the form); the upper clamp makes the
 * unbounded high-value case unreachable, capping the factor at ×5.
 */
export const VEHICLE_VALUE_MIN_ILS = 1;
export const VEHICLE_VALUE_MAX_ILS = 2_000_000;

/** Divisor for the continuous vehicle-value factor: `1 + clamped / 500_000`. */
export const VEHICLE_VALUE_DIVISOR_ILS = 500_000;

/**
 * What the table resolves for one factor: the selected band's display label and
 * its multiplier. Structurally identical to the engine's `FactorResolution`, so
 * the provider (t2) can return these values directly while this module stays
 * independent of the interface.
 */
export interface FactorBand {
  /** Human-readable label of the selected band (e.g. "35–59", "Standard"). */
  readonly band: string;
  /** The band's multiplier. */
  readonly multiplier: number;
}

/**
 * One banded interval: lower-inclusive `min`, upper-exclusive `max`; the top
 * band uses `Infinity` for `max` so it is unbounded above (FR2). Adjacent bands
 * share an edge (`max` of one == `min` of the next), so there are no gaps.
 */
interface Band {
  readonly min: number;
  readonly max: number;
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

/** Years the driver has held a licence (FR4). */
const YEARS_LICENSED_BANDS: readonly Band[] = [
  { min: 0, max: 3, label: "0–2", multiplier: 1.25 },
  { min: 3, max: 10, label: "3–9", multiplier: 1.05 },
  { min: 10, max: Infinity, label: "10+", multiplier: 0.95 },
];

/** Annual mileage in km (FR6). */
const MILEAGE_BANDS: readonly Band[] = [
  { min: 0, max: 10_000, label: "0–9,999", multiplier: 0.9 },
  { min: 10_000, max: 20_000, label: "10,000–19,999", multiplier: 1.0 },
  { min: 20_000, max: Infinity, label: "20,000+", multiplier: 1.2 },
];

/**
 * Selects the band whose `[min, max)` interval contains `value` — uniformly
 * lower-inclusive / upper-exclusive with an unbounded top band (FR2). This is
 * the single place the boundary convention lives; every banded factor reuses
 * it, so there are no per-factor edge bugs.
 *
 * The tables cover their whole valid domain with no gaps, so a value at or
 * above the first band's `min` always matches. A value below it can only arise
 * from input that should have been rejected upstream (A11); we throw rather
 * than silently mis-band it.
 */
function selectBand(bands: readonly Band[], value: number): FactorBand {
  const band = bands.find((b) => value >= b.min && value < b.max);
  if (!band) {
    throw new RangeError(`No band matches value ${value}`);
  }
  return { band: band.label, multiplier: band.multiplier };
}

/** Resolves the driver-age factor (FR3). */
export function ageFactor(ageYears: number): FactorBand {
  return selectBand(AGE_BANDS, ageYears);
}

/** Resolves the years-licensed factor (FR4). */
export function yearsLicensedFactor(yearsLicensed: number): FactorBand {
  return selectBand(YEARS_LICENSED_BANDS, yearsLicensed);
}

/** Resolves the annual-mileage factor (FR6). */
export function mileageFactor(annualMileageKm: number): FactorBand {
  return selectBand(MILEAGE_BANDS, annualMileageKm);
}

// --- Prior claims (discrete map) --------------------------------------------

/**
 * Resolves the prior-claims factor (FR7): 0 → ×0.90, 1 → ×1.20, and any integer
 * ≥ 2 → ×1.60 (arbitrarily large values included). The accepted domain is a
 * non-negative integer; negatives and non-integers are rejected here defensively
 * even though the form validates upstream (A11).
 */
export function priorClaimsFactor(priorClaims: number): FactorBand {
  if (!Number.isInteger(priorClaims) || priorClaims < 0) {
    throw new RangeError(
      `priorClaims must be a non-negative integer, got ${priorClaims}`,
    );
  }
  if (priorClaims === 0) {
    return { band: "0", multiplier: 0.9 };
  }
  if (priorClaims === 1) {
    return { band: "1", multiplier: 1.2 };
  }
  return { band: "2+", multiplier: 1.6 };
}

// --- Coverage tier (discrete enum, no boundaries) ---------------------------

/**
 * Illustrative coverage-tier keys (FR8). Abstract pricing bands, deliberately
 * NOT Israel's legal categories. The display labels are locked for tests.
 */
export type CoverageTierKey = "basic" | "standard" | "premium";

/** Coverage-tier map: label + multiplier per tier (FR8 / AC6). */
const COVERAGE_TIER_BANDS: Record<CoverageTierKey, FactorBand> = {
  basic: { band: "Basic", multiplier: 0.6 },
  standard: { band: "Standard", multiplier: 1.0 },
  premium: { band: "Premium", multiplier: 1.4 },
};

/** Resolves the coverage-tier factor (FR8). */
export function coverageTierFactor(tier: CoverageTierKey): FactorBand {
  return COVERAGE_TIER_BANDS[tier];
}

// --- Vehicle value (continuous) ---------------------------------------------

/** Clamps `value` into the inclusive `[min, max]` range. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Groups an integer-valued number with thousands separators (e.g. 500000 →
 * "500,000") for the band display string. Deterministic and locale-free.
 */
function groupThousands(n: number): string {
  const [intPart = "", fracPart] = String(n).split(".");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return fracPart === undefined ? grouped : `${grouped}.${fracPart}`;
}

/**
 * Resolves the continuous vehicle-value factor (FR5 / AC4): clamp the value to
 * `[1, 2_000_000]` ₪, then `factor = 1 + clamped / 500_000` (range ≈ ×1.000002
 * at ₪1 to ×5.000 at ₪2,000,000). The clamp runs before the formula so the
 * unbounded high-value case can never be produced; zero/negative input is
 * rejected upstream and clamped to ₪1 here defensively (A11).
 *
 * The band display string is the clamped value grouped with separators; the
 * provider/UI prefixes ₪. There are no discrete bands for this factor.
 */
export function vehicleValueFactor(vehicleValueIls: number): FactorBand {
  const clamped = clamp(
    vehicleValueIls,
    VEHICLE_VALUE_MIN_ILS,
    VEHICLE_VALUE_MAX_ILS,
  );
  const multiplier = 1 + clamped / VEHICLE_VALUE_DIVISOR_ILS;
  return { band: groupThousands(clamped), multiplier };
}
