/**
 * Framework-free input validation for the quote form (FR1–FR4).
 *
 * This module is the single source of truth for the form's field-level rules:
 * it parses the six raw string inputs, produces verbatim per-field error
 * messages (FR3), enforces the cross-field years-licensed rule, and — only when
 * every field is valid — assembles the already-validated {@link QuoteInput} the
 * engine rates against.
 *
 * It deliberately holds NO rating-model numbers: base premium, band/tier
 * multipliers, rounding, and the floor all live in CORE (AC10). The constants
 * here are input-domain bounds (the FR3 ranges), not model constants — they
 * gate what the engine is allowed to receive, they do not price anything.
 *
 * Pure and deterministic: identical values always yield identical results, with
 * no DOM, network, or persistence.
 */

import {
  COVERAGE_TIERS,
  type CoverageTier,
  type QuoteInput,
} from "@car-insurance/core";

/** The six form fields, in display order (FR1). */
export const FORM_FIELDS = [
  "driverAge",
  "yearsLicensed",
  "vehicleValue",
  "annualMileage",
  "priorClaims",
  "coverageTier",
] as const;

/** Identifier for one form field. One of {@link FORM_FIELDS}. */
export type QuoteFieldKey = (typeof FORM_FIELDS)[number];

/**
 * The raw, unparsed form state. Numeric fields are kept as strings (exactly
 * what an `<input>` yields) so the validator owns all parsing; the tier is a
 * {@link CoverageTier} identifier or `""` when nothing is selected yet.
 */
export interface QuoteFormValues {
  readonly driverAge: string;
  readonly yearsLicensed: string;
  readonly vehicleValue: string;
  readonly annualMileage: string;
  readonly priorClaims: string;
  readonly coverageTier: CoverageTier | "";
}

/** A blank form: every field empty, no tier selected. */
export const EMPTY_FORM_VALUES: QuoteFormValues = {
  driverAge: "",
  yearsLicensed: "",
  vehicleValue: "",
  annualMileage: "",
  priorClaims: "",
  coverageTier: "",
};

/** Per-field error messages, keyed by field; absent key ⇒ that field is valid. */
export type FieldErrors = Partial<Record<QuoteFieldKey, string>>;

/**
 * The outcome of validating a whole form: the field errors (empty object ⇒ all
 * valid) and the assembled {@link QuoteInput}, which is non-null IFF `errors` is
 * empty. The engine is only ever called with a non-null `input` (FR4 / FR5).
 */
export interface ValidationResult {
  readonly errors: FieldErrors;
  readonly input: QuoteInput | null;
}

// --- Input-domain bounds (FR3). Not rating-model constants (see file header). -

/** Driver age: integer 17–99 inclusive. */
export const DRIVER_AGE_MIN = 17;
export const DRIVER_AGE_MAX = 99;
/** The legal licensing age; the cross-field cap is `age − LICENSING_AGE`. */
export const LICENSING_AGE = 17;
/** Vehicle value: integer ₪, 1–2,000,000 inclusive. */
export const VEHICLE_VALUE_MIN = 1;
export const VEHICLE_VALUE_MAX = 2_000_000;
/** Annual mileage: integer km, 0–100,000 inclusive. */
export const ANNUAL_MILEAGE_MIN = 0;
export const ANNUAL_MILEAGE_MAX = 100_000;
/** Prior claims (last 3 years): integer 0–10 inclusive. */
export const PRIOR_CLAIMS_MIN = 0;
export const PRIOR_CLAIMS_MAX = 10;

/**
 * Verbatim user-facing messages. The four FR3-specified strings (vehicle value,
 * mileage, prior claims, and the cross-field rule) are reproduced exactly; the
 * others are written in the same voice for the fields FR3 left unspecified.
 */
export const MESSAGES = {
  driverAge: `Enter a driver age between ${DRIVER_AGE_MIN} and ${DRIVER_AGE_MAX}.`,
  /** Years licensed fails its own range (empty, non-integer, or negative). */
  yearsLicensedRange: "Enter years licensed as a whole number (0 or more).",
  /** Years licensed exceeds the cross-field cap of (age − 17). */
  yearsLicensedCrossField:
    "Years licensed can't be more than your years since age 17.",
  vehicleValue: "Enter a vehicle value between ₪1 and ₪2,000,000.",
  annualMileage: "Enter annual mileage between 0 and 100,000 km.",
  priorClaims: "Enter the number of claims (0 or more).",
  coverageTier: "Select a coverage tier.",
} as const;

/** Matches an optionally-signed run of digits — a whole number and nothing else. */
const INTEGER_PATTERN = /^[+-]?\d+$/;

/**
 * Parses a raw field value to an integer, or `null` when it is not a clean
 * whole number (empty, blank, decimal, or non-numeric). Trimming surrounding
 * whitespace is the only normalisation; "3.0", "3e1", and "abc" all reject so
 * the form never silently coerces a non-integer into a band.
 */
function parseInteger(raw: string): number | null {
  const trimmed = raw.trim();
  if (!INTEGER_PATTERN.test(trimmed)) {
    return null;
  }
  return Number(trimmed);
}

/** True when `value` is an integer within the inclusive `[min, max]` range. */
function inRange(value: number | null, min: number, max: number): boolean {
  return value !== null && value >= min && value <= max;
}

/** True when `tier` is one of the engine's coverage-tier identifiers. */
function isCoverageTier(tier: string): tier is CoverageTier {
  return (COVERAGE_TIERS as readonly string[]).includes(tier);
}

/**
 * Validates the whole form (FR3 / FR4).
 *
 * Each field is checked against its FR3 range; years-licensed additionally
 * carries the cross-field rule (≤ age − 17), applied only when both its own
 * value and the age are otherwise valid so a bad age never masquerades as a
 * cross-field error. At age 17 the cap is 0, so 0 years is accepted and 1+ is
 * rejected (the documented boundary).
 *
 * Returns the field errors and, only when there are none, the assembled
 * {@link QuoteInput}.
 */
export function validateQuoteForm(values: QuoteFormValues): ValidationResult {
  const errors: FieldErrors = {};

  const driverAge = parseInteger(values.driverAge);
  const ageValid = inRange(driverAge, DRIVER_AGE_MIN, DRIVER_AGE_MAX);
  if (!ageValid) {
    errors.driverAge = MESSAGES.driverAge;
  }

  const yearsLicensed = parseInteger(values.yearsLicensed);
  if (yearsLicensed === null || yearsLicensed < 0) {
    errors.yearsLicensed = MESSAGES.yearsLicensedRange;
  } else if (
    ageValid &&
    driverAge !== null &&
    yearsLicensed > driverAge - LICENSING_AGE
  ) {
    errors.yearsLicensed = MESSAGES.yearsLicensedCrossField;
  }

  const vehicleValue = parseInteger(values.vehicleValue);
  if (!inRange(vehicleValue, VEHICLE_VALUE_MIN, VEHICLE_VALUE_MAX)) {
    errors.vehicleValue = MESSAGES.vehicleValue;
  }

  const annualMileage = parseInteger(values.annualMileage);
  if (!inRange(annualMileage, ANNUAL_MILEAGE_MIN, ANNUAL_MILEAGE_MAX)) {
    errors.annualMileage = MESSAGES.annualMileage;
  }

  const priorClaims = parseInteger(values.priorClaims);
  if (!inRange(priorClaims, PRIOR_CLAIMS_MIN, PRIOR_CLAIMS_MAX)) {
    errors.priorClaims = MESSAGES.priorClaims;
  }

  const tier = values.coverageTier;
  if (tier === "" || !isCoverageTier(tier)) {
    errors.coverageTier = MESSAGES.coverageTier;
  }

  // The engine receives an input only when every field passed. The extra
  // non-null guards re-narrow the parsed values for the type checker; they are
  // always satisfied once `errors` is empty.
  let input: QuoteInput | null = null;
  if (
    Object.keys(errors).length === 0 &&
    driverAge !== null &&
    yearsLicensed !== null &&
    vehicleValue !== null &&
    annualMileage !== null &&
    priorClaims !== null &&
    tier !== ""
  ) {
    input = {
      driverAge,
      yearsLicensed,
      vehicleValue,
      annualMileage,
      priorClaims,
      coverageTier: tier,
    };
  }

  return { errors, input };
}
