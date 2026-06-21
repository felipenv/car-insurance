/**
 * Framework-agnostic core for the car-insurance estimator.
 *
 * Public entry point. It re-exports the frozen WEB↔CORE rating contract (the
 * `QuoteInput` / `RatedFactor` / `QuoteResult` types and the ordering/key
 * constants) plus the `rateQuote()` engine that computes the authoritative
 * premium and the ordered factor breakdown WEB renders.
 */

// The rating engine: rateQuote(input) -> QuoteResult.
export { rateQuote } from "./rateQuote.js";

// Frozen rating contract. Value exports (the ordering/identifier tuples) and
// type exports are split because `verbatimModuleSyntax` forbids mixing them.
export { COVERAGE_TIERS, FACTOR_ORDER } from "./types.js";
export type {
  CoverageTier,
  FactorKey,
  QuoteInput,
  QuoteResult,
  RatedFactor,
} from "./types.js";

/** Scoped package name; placeholder export consumed by the WEB baseline. */
export const CORE_PACKAGE_NAME = "@car-insurance/core" as const;

/** Returns the CORE package name. Kept as a stable smoke-test export for WEB. */
export function corePackageName(): string {
  return CORE_PACKAGE_NAME;
}
