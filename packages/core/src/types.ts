/**
 * Frozen public contract for the CORE rating engine (WEB↔CORE boundary).
 *
 * This is the single typed surface WEB builds against (design §5): a pure
 * function `rateQuote(input)` returning a {@link QuoteResult}. Swapping the
 * illustrative numbers for a real Harel service later changes `model.ts` only,
 * never these types, the factor ordering, or the result shape.
 *
 * No business logic lives here. The base premium, the per-factor bands and
 * multipliers, the rounding rule, and the ₪600 floor are all owned by
 * `model.ts`. This file is types plus the two frozen ordering/key constants
 * they reference.
 */

/**
 * Coverage tiers as OPAQUE illustrative identifiers (FR2).
 *
 * These are product-internal pricing keys and are intentionally NOT the Israeli
 * legal categories (Chova / Tzad Gimmel / Makif). WEB sends one of these
 * identifiers; the model maps it to a label and multiplier
 * (`basic → ×0.60 / standard → ×1.00 / premium → ×1.40`). WEB never restates
 * those multipliers (AC7 / AC10).
 */
export const COVERAGE_TIERS = ["basic", "standard", "premium"] as const;

/** A coverage tier identifier. One of {@link COVERAGE_TIERS}. */
export type CoverageTier = (typeof COVERAGE_TIERS)[number];

/**
 * Already-validated quote inputs the engine rates against (FR1).
 *
 * The engine does NOT re-validate these: range, integer, and cross-field checks
 * are the form's responsibility upstream. All monetary values are in ₪.
 */
export interface QuoteInput {
  /** Driver age in years. */
  readonly driverAge: number;
  /** Years the driver has held a licence. */
  readonly yearsLicensed: number;
  /** Vehicle value in ₪. */
  readonly vehicleValue: number;
  /** Annual mileage in kilometres. */
  readonly annualMileage: number;
  /** Number of prior claims in the last 3 years. */
  readonly priorClaims: number;
  /** Coverage tier as an opaque illustrative identifier. */
  readonly coverageTier: CoverageTier;
}

/**
 * The six rating factors in their frozen application order (FR7 / AC2):
 * driverAge → yearsLicensed → vehicleValue → annualMileage → priorClaims →
 * coverageTier.
 *
 * This tuple is BOTH the runtime ordering `rateQuote` iterates over AND the
 * source of the {@link FactorKey} union. The order is part of the public
 * contract and must not change. The keys deliberately mirror the
 * {@link QuoteInput} field names so a factor is traceable to its input.
 */
export const FACTOR_ORDER = [
  "driverAge",
  "yearsLicensed",
  "vehicleValue",
  "annualMileage",
  "priorClaims",
  "coverageTier",
] as const;

/** Identifier for one rating factor. One of {@link FACTOR_ORDER}. */
export type FactorKey = (typeof FACTOR_ORDER)[number];

/**
 * One rated factor in the {@link QuoteResult}: which factor, a human-readable
 * matched-band label, and the multiplier that band applied.
 *
 * Per design §5 the engine emits ONLY the multiplier and label here — it does
 * not emit per-step ₪ deltas or running subtotals. WEB derives the waterfall
 * deltas and running subtotals for display from `base` + these multipliers; the
 * arithmetic of presentation is not a model constant, so deriving it in WEB
 * does not duplicate the model (AC10).
 */
export interface RatedFactor {
  /** Which factor this is. */
  readonly key: FactorKey;
  /** Human-readable matched-band label, e.g. "Driver age (35–59)". */
  readonly label: string;
  /** The matched band's multiplier, e.g. 1.3. */
  readonly multiplier: number;
}

/**
 * The engine's authoritative output (FR6 / FR7): the base premium, the ordered
 * six rated factors, and the single authoritative final premium.
 *
 * `finalPremium` is computed from the EXACT (unrounded) multiplier product,
 * rounded to the nearest ₪1, then floored at ₪600 — it is authoritative and is
 * NOT derived from summing any displayed deltas (AC1 / AC3).
 */
export interface QuoteResult {
  /** Base annual premium in ₪ (model-owned; ₪2,400 in v1). */
  readonly base: number;
  /** Authoritative final annual premium in ₪. */
  readonly finalPremium: number;
  /** The six rated factors, in {@link FACTOR_ORDER}. Exactly six. */
  readonly factors: readonly RatedFactor[];
}
