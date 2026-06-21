/**
 * Framework-agnostic core for the car-insurance estimator.
 *
 * Public entry point. It re-exports the frozen rating contract (the types and
 * provider interface that the rating model in feature #3 and the WEB UI in
 * feature #4 build against). The `rate()` engine itself lands in a later
 * feature; this package currently ships the contract surface only.
 */

// Frozen rating contract. Value exports (the ordering/key tuples) and type
// exports are split because `verbatimModuleSyntax` forbids mixing them.
export { COVERAGE_TIERS, FACTOR_ORDER } from "./rating/types.js";
export type {
  CoverageTier,
  FactorId,
  FactorLine,
  FactorResolution,
  QuoteInputs,
  RatingProvider,
  RatingResult,
} from "./rating/types.js";

/** Scoped package name; placeholder export retained until the engine ships. */
export const CORE_PACKAGE_NAME = "@car-insurance/core" as const;

/** Returns the CORE package name. Exists only to give WEB something to import. */
export function corePackageName(): string {
  return CORE_PACKAGE_NAME;
}
