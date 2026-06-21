/**
 * The result UI (FR6 / FR7 / FR9): the estimated annual premium, the ordered
 * price waterfall that explains it, and the verbatim illustrative disclaimer.
 *
 * It consumes a CORE {@link QuoteResult} and renders, in order: a base-premium
 * line (₪2,400), one line per factor in the engine's frozen order — each with
 * the matched-band label, the multiplier (×1.30), the cumulative ₪ delta
 * against the running subtotal (+₪684 / −₪120 / +₪0), and the running subtotal
 * after that step (→ ₪2,964) — and a final "Total annual premium" line using
 * the authoritative `finalPremium`. The disclaimer renders inside the same
 * region so the premium cannot reasonably be read without it (brand/legal).
 *
 * This file owns presentation only. The waterfall numbers come from
 * {@link buildWaterfall}; every ₪ value is formatted through the shared
 * {@link formatCurrency} util (FR8). No model constants are restated (AC10).
 */

import { type QuoteResult } from "@car-insurance/core";

import { formatCurrency } from "../lib/formatCurrency.js";
import { buildWaterfall } from "../lib/waterfall.js";

/**
 * Verbatim illustrative-estimate disclaimer (FR9 / AC8). Exported so tests can
 * assert the rendered copy matches the contractually-required text exactly.
 */
export const DISCLAIMER =
  "Illustrative estimate only — not a real Harel quote. " +
  "Figures use a sample rating model for demonstration purposes.";

export interface QuoteResultProps {
  /** The rated quote to display. */
  readonly result: QuoteResult;
}

/** Formats a factor multiplier as `×1.30` (always two decimals, leading ×). */
function formatMultiplier(multiplier: number): string {
  return `×${multiplier.toFixed(2)}`;
}

/**
 * Formats a signed ₪ delta for the waterfall: negatives keep the `−₪120` the
 * currency util produces; zero and positives gain an explicit leading `+`, so
 * a no-op factor reads `+₪0` (AC4) and a raise reads `+₪684` (FR7).
 */
function formatDelta(delta: number): string {
  const formatted = formatCurrency(delta);
  return delta < 0 ? formatted : `+${formatted}`;
}

export function QuoteResult({ result }: QuoteResultProps): JSX.Element {
  const { base, steps, finalPremium } = buildWaterfall(result);

  return (
    <section className="quote-result" aria-label="Estimated annual premium">
      <p className="quote-result__premium">
        <span className="quote-result__premium-label">
          Estimated annual premium
        </span>{" "}
        <strong className="quote-result__premium-amount">
          {formatCurrency(finalPremium)}
        </strong>
      </p>

      <table className="quote-waterfall">
        <caption className="quote-waterfall__caption">
          How this estimate is built
        </caption>
        <thead>
          <tr>
            <th scope="col">Factor</th>
            <th scope="col">Multiplier</th>
            <th scope="col">Change</th>
            <th scope="col">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          <tr className="quote-waterfall__base">
            <th scope="row">Base premium</th>
            <td aria-hidden="true">—</td>
            <td aria-hidden="true">—</td>
            <td>{formatCurrency(base)}</td>
          </tr>
          {steps.map((step) => (
            <tr key={step.key} className="quote-waterfall__step">
              <th scope="row">{step.label}</th>
              <td className="quote-waterfall__multiplier">
                {formatMultiplier(step.multiplier)}
              </td>
              <td className="quote-waterfall__delta">
                {formatDelta(step.delta)}
              </td>
              <td className="quote-waterfall__subtotal">
                → {formatCurrency(step.runningSubtotal)}
              </td>
            </tr>
          ))}
          <tr className="quote-waterfall__total">
            <th scope="row">Total annual premium</th>
            <td aria-hidden="true">—</td>
            <td aria-hidden="true">—</td>
            <td>{formatCurrency(finalPremium)}</td>
          </tr>
        </tbody>
      </table>

      <p className="quote-result__disclaimer" role="note">
        {DISCLAIMER}
      </p>
    </section>
  );
}
