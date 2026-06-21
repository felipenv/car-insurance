/**
 * Presentation arithmetic for the price waterfall (FR7 / AC3 / AC4).
 *
 * Turns a CORE {@link QuoteResult} into the row data the result UI renders: the
 * base premium, then one step per factor (in the engine's frozen order) with
 * the cumulative ₪ delta against the running subtotal and the running subtotal
 * after that step, ending at the engine's authoritative `finalPremium`.
 *
 * This module owns NO model constants (AC10). It only re-applies the
 * multipliers CORE already resolved to the base CORE already owns; the deltas
 * and running subtotals are display values, not pricing. The single source of
 * truth for the total remains `QuoteResult.finalPremium`.
 *
 * Rounding: each running subtotal is rounded to the nearest whole ₪ for display
 * and the per-step delta is the difference between consecutive rounded
 * subtotals. So the displayed deltas always sum EXACTLY to (last subtotal −
 * base), with no drift between the numbers a reader can see (AC3). The exact
 * (unrounded) value is carried forward between steps so this matches CORE's
 * "round once, at the end" total in the normal (un-floored) case.
 *
 * Pure and deterministic: identical input always yields identical output.
 */

import { type FactorKey, type QuoteResult } from "@car-insurance/core";

/** One rendered waterfall step: a factor, its multiplier, and the ₪ movement. */
export interface WaterfallStep {
  /** Which factor this step applies. */
  readonly key: FactorKey;
  /** Human-readable matched-band label from CORE, e.g. "Driver age (35–59)". */
  readonly label: string;
  /** The factor's multiplier, e.g. 1.3. */
  readonly multiplier: number;
  /**
   * Signed integer ₪ change this step makes to the running subtotal: positive
   * when the factor raised the price, negative when it lowered it, and exactly
   * 0 for a ×1.00 factor (AC4).
   */
  readonly delta: number;
  /** The integer ₪ running subtotal after this step is applied. */
  readonly runningSubtotal: number;
}

/** The full waterfall: base, the ordered steps, and the authoritative total. */
export interface Waterfall {
  /** The base annual premium in ₪ (CORE-owned). */
  readonly base: number;
  /** One step per factor, in {@link QuoteResult.factors} order. Exactly six. */
  readonly steps: readonly WaterfallStep[];
  /**
   * The authoritative final premium in ₪, taken verbatim from
   * {@link QuoteResult.finalPremium} — NOT re-derived from the steps. The total
   * line renders this so a ₪600-floor (or any future rounding nuance) always
   * shows CORE's number, never the summed-delta approximation.
   */
  readonly finalPremium: number;
}

/**
 * Builds the {@link Waterfall} for a rated quote.
 *
 * Walks the factors in the order CORE returned them (the frozen FACTOR_ORDER),
 * compounding each multiplier onto an exact running value and recording the
 * rounded running subtotal plus the delta versus the previous rounded subtotal.
 *
 * @param result The engine output to render.
 * @returns The base, the six ordered steps, and the authoritative final premium.
 */
export function buildWaterfall(result: QuoteResult): Waterfall {
  // `exactRunning` carries the unrounded value forward so rounding never
  // compounds; `prevSubtotal` is the last DISPLAYED (rounded) subtotal, so each
  // delta is a difference of integers and the column reconciles exactly.
  let exactRunning = result.base;
  let prevSubtotal = result.base;

  const steps = result.factors.map((factor): WaterfallStep => {
    exactRunning *= factor.multiplier;
    const runningSubtotal = Math.round(exactRunning);
    const delta = runningSubtotal - prevSubtotal;
    prevSubtotal = runningSubtotal;
    return {
      key: factor.key,
      label: factor.label,
      multiplier: factor.multiplier,
      delta,
      runningSubtotal,
    };
  });

  return {
    base: result.base,
    steps,
    finalPremium: result.finalPremium,
  };
}
