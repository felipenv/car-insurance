/**
 * Shekel (₪) currency formatting for the result UI (FR8/AC1).
 *
 * Single source of truth for turning a number into the app's money string:
 * the ₪ symbol immediately before the amount, comma thousands separators, and
 * no decimals. Negative values render with a leading minus so per-step deltas
 * read as `−₪120`; zero renders as `₪0`.
 *
 * This is a presentation concern, not a model constant (AC10): it formats
 * numbers the engine produces, it does not price anything. Pure and
 * deterministic — identical input always yields identical output.
 */

/** The shekel sign used throughout the result UI. */
const SHEKEL = "₪";

/**
 * Format a number as an integer shekel amount.
 *
 * Non-integers are rounded to the nearest whole ₪ (FR8 amounts are integers).
 * Negatives are prefixed with a real minus sign (U+2212) before the symbol,
 * e.g. `formatCurrency(-120)` → `"−₪120"`, for delta display in the waterfall.
 *
 * @param amount - the value to format (may be fractional or negative)
 * @returns the formatted string, e.g. `"₪2,400"`, `"₪0"`, `"−₪120"`
 */
export function formatCurrency(amount: number): string {
  const rounded = Math.round(amount);
  const sign = rounded < 0 ? "−" : "";
  const grouped = Math.abs(rounded).toLocaleString("en-US");
  return `${sign}${SHEKEL}${grouped}`;
}
