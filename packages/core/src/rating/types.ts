/**
 * Frozen public contract for the CORE rating engine.
 *
 * This module defines the engine-owned surface that the rating provider
 * (feature #3) and the WEB quote UI (feature #4) build against. It is a
 * deliberate freeze (FR7 / A10): swapping a conforming provider — the
 * illustrative v1 table today, a real Harel rating service later — changes the
 * numbers only, never these types, the factor ordering, or the breakdown shape.
 *
 * No business logic lives here. Bands, multipliers, the base value, the
 * rounding rule, and the ₪600 floor are all owned elsewhere (the engine and the
 * provider). This file is types plus the single frozen ordering/key constants
 * they reference.
 */

/**
 * Coverage tiers as OPAQUE illustrative keys.
 *
 * These are product-internal labels and are intentionally NOT the Israeli legal
 * categories (Chova / Tzad Gimmel / Makif). The engine never reasons about what
 * a tier means; it forwards `coverageTier` to the provider, which maps it to a
 * band and multiplier. Do not conflate these keys with regulated categories.
 */
export const COVERAGE_TIERS = [
  "third-party",
  "standard",
  "comprehensive",
] as const;

/** A coverage tier key. One of {@link COVERAGE_TIERS}. */
export type CoverageTier = (typeof COVERAGE_TIERS)[number];

/**
 * Already-validated quote inputs the engine rates against.
 *
 * The engine does NOT re-validate these: range and format checks are the form's
 * (UI) and provider's responsibility (A11). All monetary values are in ₪.
 */
export interface QuoteInputs {
  /** Driver age in years. */
  readonly driverAge: number;
  /** Years the driver has held a licence. */
  readonly yearsLicensed: number;
  /** Vehicle value in ₪. The ₪2,000,000 / ×5 cap is enforced upstream. */
  readonly vehicleValue: number;
  /** Annual mileage in kilometres. */
  readonly annualMileage: number;
  /** Number of at-fault/claimable prior claims in the last 3 years. */
  readonly priorClaims: number;
  /** Coverage tier as an opaque illustrative key. */
  readonly coverageTier: CoverageTier;
}

/**
 * The six rating factors in their frozen application order
 * (age → yearsLicensed → vehicleValue → mileage → priorClaims → coverageTier).
 *
 * This tuple is BOTH the runtime ordering the engine iterates over AND the
 * source of the {@link FactorId} union. The order is part of the public
 * contract (A4) and must not change.
 *
 * Note the factor ids (`age`, `mileage`) are deliberately distinct from the
 * corresponding {@link QuoteInputs} field names (`driverAge`, `annualMileage`):
 * factor ids are the stable identifiers consumers key off of.
 */
export const FACTOR_ORDER = [
  "age",
  "yearsLicensed",
  "vehicleValue",
  "mileage",
  "priorClaims",
  "coverageTier",
] as const;

/** Identifier for one rating factor. One of {@link FACTOR_ORDER}. */
export type FactorId = (typeof FACTOR_ORDER)[number];

/**
 * What a provider resolves for a single factor given the inputs: the selected
 * band's human-readable display label and its multiplier. Band labels and
 * multipliers are owned entirely by the provider — never by the engine.
 */
export interface FactorResolution {
  /** Display label of the selected band (e.g. "25–34"). Provider-defined. */
  readonly band: string;
  /** The band's multiplier applied to the running premium. Provider-defined. */
  readonly multiplier: number;
}

/**
 * The swappable rate-table boundary the engine owns and depends on.
 *
 * Given a factor id and the inputs, a provider returns the selected band label
 * and multiplier. The engine defines this interface; feature #3 implements it
 * with the illustrative v1 table, and a real service can replace it later with
 * no change to engine code (FR7 / A10).
 */
export interface RatingProvider {
  resolve(factorId: FactorId, inputs: QuoteInputs): FactorResolution;
}

/**
 * One line of the explainable waterfall breakdown, emitted in
 * {@link FACTOR_ORDER}.
 *
 * `deltaIls` and `runningSubtotalIls` are integer-₪ DISPLAY values: the running
 * subtotal is the exact subtotal rounded half-up to ₪1, and the delta is this
 * line's rounded subtotal minus the previous line's (with line 0 = base). The
 * displayed deltas therefore reconcile exactly from base to the breakdown total
 * (FR5 / A5).
 */
export interface FactorLine {
  /** Which factor this line reports. */
  readonly factorId: FactorId;
  /** Human-readable factor name for display (e.g. "Driver age"). */
  readonly label: string;
  /** Selected band display label, as resolved by the provider. */
  readonly band: string;
  /** The factor's multiplier, as resolved by the provider. */
  readonly multiplier: number;
  /** Displayed running-subtotal delta contributed by this line, in whole ₪. */
  readonly deltaIls: number;
  /** Displayed running subtotal after this line, in whole ₪. */
  readonly runningSubtotalIls: number;
}

/**
 * The engine's authoritative output: the base premium, the ordered six-line
 * breakdown, and the single authoritative final premium.
 *
 * `totalIls` is computed from the exact (unrounded) multiplier product, rounded
 * half-up, then floored at ₪600 — NOT from summing the displayed deltas (A6).
 */
export interface RatingResult {
  /** Base annual premium in ₪ (engine-owned; ₪2,400 in v1). */
  readonly base: number;
  /** The six factor lines, in {@link FACTOR_ORDER}. */
  readonly lines: readonly FactorLine[];
  /** Authoritative final annual premium in ₪. */
  readonly totalIls: number;
}
