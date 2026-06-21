/**
 * Deterministic nearest-₪1 rounding primitive for the CORE rating engine.
 *
 * This is the single rounding rule reused by both the authoritative total and
 * the waterfall running subtotals (FR3 / A2). It is intentionally
 * business-logic-free: it knows nothing about premiums, the base value, or the
 * ₪600 floor.
 */

/**
 * Rounds `value` to the nearest whole ₪1 using a HALF-UP tie-break: an exact
 * x.50 always rounds up to x+1 (e.g. 0.5 → 1, 2.5 → 3, 1199.5 → 1200).
 *
 * Half-to-even ("banker's rounding") is explicitly NOT used: 2.5 yields 3, not
 * 2. `Math.floor(value + 0.5)` gives exactly this half-up behaviour for the
 * non-negative premium values the engine deals with.
 */
export function roundHalfUp(value: number): number {
  return Math.floor(value + 0.5);
}
