/**
 * The pure, deterministic premium engine (FR5 / FR6 / AC1).
 *
 * `rateQuote(input)` turns already-validated {@link QuoteInput} into the
 * authoritative annual premium plus the ordered six {@link RatedFactor}s WEB
 * renders the waterfall from. It is the single function on the WEB↔CORE
 * boundary (design §5) and takes no provider, no options, and performs no I/O.
 *
 * All constants — the base premium, the per-factor bands and multipliers, the
 * rounding rule, and the ₪600 floor — live in `model.ts`. This module only
 * walks the frozen factor order and combines what the model resolves; it owns
 * no numbers itself (AC10).
 *
 * Determinism: identical inputs always yield identical output. Inputs are NOT
 * re-validated here — that is the form's responsibility upstream.
 */

import {
  BASE_PREMIUM_ILS,
  computeFinalPremium,
  resolveFactor,
} from "./model.js";
import {
  FACTOR_ORDER,
  type QuoteInput,
  type QuoteResult,
  type RatedFactor,
} from "./types.js";

/**
 * Rates a validated quote.
 *
 * @param input Already-validated quote inputs.
 * @returns The base premium, the six rated factors in {@link FACTOR_ORDER}, and
 *          the authoritative `finalPremium` (`round(base × Πmultipliers)`,
 *          floored at ₪600).
 */
export function rateQuote(input: QuoteInput): QuoteResult {
  // Single resolution loop over the six factors in their frozen order; the
  // model owns each band label and multiplier.
  const factors: RatedFactor[] = FACTOR_ORDER.map((key) =>
    resolveFactor(key, input),
  );

  // Authoritative total: from the EXACT product of all six multipliers, rounded
  // once and floored. Never derived from per-step displayed deltas.
  const multiplierProduct = factors.reduce(
    (product, factor) => product * factor.multiplier,
    1,
  );

  return {
    base: BASE_PREMIUM_ILS,
    finalPremium: computeFinalPremium(multiplierProduct),
    factors,
  };
}
