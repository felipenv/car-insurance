/**
 * The illustrative v1 {@link RatingProvider} (feature #3, t2).
 *
 * A thin, interface-conformant assembler: it implements the engine-owned
 * {@link RatingProvider} contract EXACTLY by composing the pure rate-table core
 * (t1, `./rate-table.js`). It holds no bands or multipliers of its own — those
 * are the table's — and adds no public surface beyond `resolve` (AC9). The
 * interface is imported from the frozen contract module, never redefined: if
 * feature #2's exported names ever drift, this file fails to compile (R2).
 *
 * Everything here is pure, deterministic, and offline — no I/O, persistence, or
 * PII (AC10). Identical inputs always yield identical output.
 *
 * Contract-drift reconciliation (R2). The product/STRUCTURE drafts sketched an
 * idealized provider — a `factorsFor()` returning `RatingFactor[]`, a
 * `basePremiumIls` field, and a provider-held ₪600 floor. The contract feature
 * #2 actually froze in `types.ts` is narrower: a single
 * `resolve(factorId, inputs)` returning `{ band, multiplier }`. The engine
 * (see `engine.ts`) owns the fixed factor ordering (`FACTOR_ORDER`), the base
 * premium (₪2,400), the half-up rounding, AND the ₪600 floor. Per AC9 this
 * provider conforms to the REAL interface and adds nothing to it; the ordered
 * breakdown, the base premium, and the floor are produced by the engine walking
 * this provider, and are asserted there in the test suite.
 *
 * Figures are ILLUSTRATIVE — not real Harel rates and not a binding quote.
 */

import {
  ageFactor,
  coverageTierFactor,
  mileageFactor,
  priorClaimsFactor,
  vehicleValueFactor,
  yearsLicensedFactor,
  type CoverageTierKey,
} from "./rate-table.js";
import type {
  CoverageTier,
  FactorId,
  FactorResolution,
  QuoteInputs,
  RatingProvider,
} from "./types.js";

/**
 * Maps the engine's opaque coverage-tier keys
 * (`third-party` / `standard` / `comprehensive`) onto the rate table's
 * illustrative pricing tiers (`basic` / `standard` / `premium`), ordered
 * cheapest to richest. The engine's enum is the frozen contract; the rate table
 * adopted the abstract Basic/Standard/Premium relabel, so the provider is the
 * single place the two vocabularies meet. Neither set implies Israel's legal
 * categories (Chova / Tzad Gimmel / Makif).
 */
const COVERAGE_TIER_TO_KEY: Record<CoverageTier, CoverageTierKey> = {
  "third-party": "basic",
  standard: "standard",
  comprehensive: "premium",
};

/** Narrows an exhaustive switch: a compile error if a `FactorId` is unhandled. */
function assertNever(value: never): never {
  throw new RangeError(`Unhandled factor id: ${String(value)}`);
}

/**
 * The illustrative v1 rating provider. Stateless and pure: resolving a factor
 * delegates to the matching rate-table function, reading only the relevant
 * field of {@link QuoteInputs}. Construct once and reuse, or per call — the
 * result is identical either way.
 */
export class IllustrativeRatingProvider implements RatingProvider {
  /**
   * Resolves one rating factor to its selected band label and multiplier, as
   * the engine iterates {@link FactorId}s in their frozen order. The provider
   * computes no totals, deltas, or rounding — that is the engine's math.
   */
  resolve(factorId: FactorId, inputs: QuoteInputs): FactorResolution {
    switch (factorId) {
      case "age":
        return ageFactor(inputs.driverAge);
      case "yearsLicensed":
        return yearsLicensedFactor(inputs.yearsLicensed);
      case "vehicleValue":
        return vehicleValueFactor(inputs.vehicleValue);
      case "mileage":
        return mileageFactor(inputs.annualMileage);
      case "priorClaims":
        return priorClaimsFactor(inputs.priorClaims);
      case "coverageTier":
        return coverageTierFactor(COVERAGE_TIER_TO_KEY[inputs.coverageTier]);
      default:
        // Exhaustive over the frozen six factors; guards against a new factor
        // being added to FACTOR_ORDER without a matching branch here.
        return assertNever(factorId);
    }
  }
}
