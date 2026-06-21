/**
 * The pure, deterministic premium-calculation core (FR6 / A9).
 *
 * `rate()` turns already-validated {@link QuoteInputs} plus an injected
 * {@link RatingProvider} into a single authoritative annual premium and an
 * ordered, layperson-readable waterfall breakdown whose displayed deltas
 * reconcile exactly from base to total.
 *
 * The math is split into two intentionally independent passes:
 *
 *  1. Authoritative total — from the EXACT (unrounded) multiplier product,
 *     rounded half-up once, then floored at ₪600 (FR2 / FR4 / A6).
 *  2. Displayed waterfall — each line's running subtotal is the exact running
 *     product rounded half-up, and each delta is the difference between this
 *     line's rounded subtotal and the previous one (FR5 / A5).
 *
 * Keeping the passes separate is the subtle correctness guarantee (A6): the
 * total never derives from summed rounded deltas, and the displayed deltas
 * never derive from the total.
 *
 * The engine owns the base value, the rounding rule, the ₪600 floor, and the
 * per-factor display labels. It owns NO band thresholds or multipliers — those
 * come from the provider (FR1 / FR7). It performs no input re-validation; its
 * only defensive behaviours are half-up rounding and the ₪600 clamp (A11).
 */

import { roundHalfUp } from "./round.js";
import {
  FACTOR_ORDER,
  type FactorId,
  type FactorLine,
  type QuoteInputs,
  type RatingProvider,
  type RatingResult,
} from "./types.js";

/**
 * Engine-owned base annual premium in ₪ (₪2,400 in v1).
 *
 * Injected into the math as a value rather than branched on: the engine does
 * not reason about what the base "means", it only multiplies factors against
 * it. A future base change is a one-line edit here.
 */
const BASE_PREMIUM_ILS = 2400;

/**
 * Defensive floor in ₪ (FR4 / A7). Any computed premium below this is raised to
 * exactly this value. Unreachable under the illustrative v1 table by design
 * (the lowest realistic multiplier product yields ≈ ₪1,108); it exists to guard
 * against future cheaper bands or a misconfigured provider.
 */
const PREMIUM_FLOOR_ILS = 600;

/**
 * Engine-owned, human-readable display name per factor.
 *
 * These are the stable factor NAMES the breakdown shows (e.g. "Driver age"),
 * distinct from the provider-resolved band labels (e.g. "25–34"). The engine
 * owns the names; the provider owns the bands.
 */
const FACTOR_LABELS: Record<FactorId, string> = {
  age: "Driver age",
  yearsLicensed: "Years licensed",
  vehicleValue: "Vehicle value",
  mileage: "Annual mileage",
  priorClaims: "Prior claims",
  coverageTier: "Coverage tier",
};

/**
 * Computes the authoritative premium and the reconciling explainable breakdown.
 *
 * @param inputs   Already-validated quote inputs. NOT re-validated here (A11).
 * @param provider Conforming rate-table boundary that resolves each factor's
 *                 band label and multiplier. The engine never defines these.
 * @returns The base premium, the ordered six {@link FactorLine}s, and the
 *          authoritative `totalIls`.
 */
export function rate(
  inputs: QuoteInputs,
  provider: RatingProvider,
): RatingResult {
  const base = BASE_PREMIUM_ILS;

  // FR1: single resolution loop over the six factors in their frozen order.
  // Band labels and multipliers are owned by the provider.
  const resolved = FACTOR_ORDER.map((factorId) => {
    const { band, multiplier } = provider.resolve(factorId, inputs);
    return { factorId, band, multiplier };
  });

  // Pass 1 — authoritative total. Computed from the EXACT product of all six
  // multipliers, rounded half-up once, then clamped to the floor (FR2 / FR4).
  // This never reads the rounded subtotals below (A6).
  const exactProduct = resolved.reduce((acc, { multiplier }) => {
    return acc * multiplier;
  }, 1);
  const totalIls = Math.max(
    roundHalfUp(base * exactProduct),
    PREMIUM_FLOOR_ILS,
  );

  // Pass 2 — displayed waterfall. The running subtotal after factor k is the
  // EXACT running product (base × Π₁..ₖ) rounded half-up; the displayed delta
  // is this rounded subtotal minus the previous one, with line 0 = base. The
  // deltas therefore telescope and reconcile exactly to the breakdown total
  // (FR5 / A5).
  let exactRunning = base;
  let prevRoundedSubtotal = base;
  const lines: FactorLine[] = resolved.map(({ factorId, band, multiplier }) => {
    exactRunning *= multiplier;
    const runningSubtotalIls = roundHalfUp(exactRunning);
    const deltaIls = runningSubtotalIls - prevRoundedSubtotal;
    prevRoundedSubtotal = runningSubtotalIls;
    return {
      factorId,
      label: FACTOR_LABELS[factorId],
      band,
      multiplier,
      deltaIls,
      runningSubtotalIls,
    };
  });

  return { base, lines, totalIls };
}
