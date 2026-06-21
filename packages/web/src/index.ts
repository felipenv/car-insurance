/**
 * Web package for the car-insurance estimator.
 *
 * Baseline only: it imports a CORE export to prove the project reference
 * resolves end to end. The real quote form, ₪ formatting, validation, and
 * per-factor breakdown UI land in a later feature.
 */
import { corePackageName } from "@car-insurance/core";

/** Scoped package name for WEB. */
export const WEB_PACKAGE_NAME = "@car-insurance/web" as const;

/** Proves the CORE project reference resolves at compile time. */
export function describesCore(): string {
  return `${WEB_PACKAGE_NAME} depends on ${corePackageName()}`;
}

// The quote form and its validation surface (FR1–FR4).
export { QuoteForm, TIER_NOTE } from "./components/QuoteForm.js";
export type { QuoteFormProps } from "./components/QuoteForm.js";

// The result UI: premium, ordered price waterfall, and disclaimer (FR6/FR7/FR9).
export { DISCLAIMER, QuoteResult } from "./components/QuoteResult.js";
export type { QuoteResultProps } from "./components/QuoteResult.js";
export { buildWaterfall } from "./lib/waterfall.js";
export type { Waterfall, WaterfallStep } from "./lib/waterfall.js";
export {
  EMPTY_FORM_VALUES,
  FORM_FIELDS,
  MESSAGES,
  validateQuoteForm,
} from "./validation.js";
export type {
  FieldErrors,
  QuoteFieldKey,
  QuoteFormValues,
  ValidationResult,
} from "./validation.js";
