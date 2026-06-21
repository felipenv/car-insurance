/**
 * The quote form (FR1–FR4): six required inputs, per-field + cross-field
 * validation, and submit gating.
 *
 * The form is a controlled React component holding raw string values; all
 * parsing and the FR3 rules live in {@link validateQuoteForm}, so this file
 * owns presentation only. On every render it re-validates the current values
 * and shows a field's message once the user has interacted with it (blurred) or
 * once a submit has been attempted — so messages appear when they are useful,
 * not while the user is still typing the first character.
 *
 * Submission is gated by the validator: a submit attempt reveals every error
 * and, only when the form is fully valid, hands the assembled {@link QuoteInput}
 * to `onSubmit`. This component does NOT call the CORE engine — wiring the
 * result/waterfall is a later ticket.
 */

import { useState, type FormEvent } from "react";

import { type CoverageTier, type QuoteInput } from "@car-insurance/core";

import {
  EMPTY_FORM_VALUES,
  validateQuoteForm,
  type QuoteFieldKey,
  type QuoteFormValues,
} from "../validation.js";

/** Neutral, illustrative tier labels (FR2 / AC7). Order is the display order. */
const TIER_OPTIONS: readonly {
  readonly value: CoverageTier;
  readonly label: string;
}[] = [
  { value: "basic", label: "Basic" },
  { value: "standard", label: "Standard" },
  { value: "premium", label: "Premium" },
];

/** Verbatim FR2 note shown attached to the coverage-tier control. */
export const TIER_NOTE = "Illustrative tiers, not legal insurance categories.";

/** A numeric field's static presentation config. */
interface NumericFieldDef {
  readonly key: Exclude<QuoteFieldKey, "coverageTier">;
  readonly label: string;
  /** Native `min`/`max` hints (validation itself is authoritative). */
  readonly min: number;
  readonly max: number;
}

/** The five numeric fields, in display order; labels carry the unit (FR1). */
const NUMERIC_FIELDS: readonly NumericFieldDef[] = [
  { key: "driverAge", label: "Driver age", min: 17, max: 99 },
  { key: "yearsLicensed", label: "Years licensed", min: 0, max: 99 },
  { key: "vehicleValue", label: "Vehicle value (₪)", min: 1, max: 2_000_000 },
  { key: "annualMileage", label: "Annual mileage (km)", min: 0, max: 100_000 },
  { key: "priorClaims", label: "Prior claims (last 3 years)", min: 0, max: 10 },
];

export interface QuoteFormProps {
  /** Called with the validated input when a valid form is submitted (FR4/FR5). */
  readonly onSubmit: (input: QuoteInput) => void;
}

/** Tracks which fields the user has interacted with (blurred). */
type TouchedFields = Partial<Record<QuoteFieldKey, boolean>>;

export function QuoteForm({ onSubmit }: QuoteFormProps): JSX.Element {
  const [values, setValues] = useState<QuoteFormValues>(EMPTY_FORM_VALUES);
  const [touched, setTouched] = useState<TouchedFields>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const { errors, input } = validateQuoteForm(values);

  /** A field's error is shown once it is touched or after a submit attempt. */
  const visibleError = (key: QuoteFieldKey): string | undefined =>
    submitAttempted || touched[key] ? errors[key] : undefined;

  const setField = (key: QuoteFieldKey, value: string): void => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const markTouched = (key: QuoteFieldKey): void => {
    setTouched((prev) => ({ ...prev, [key]: true }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    setSubmitAttempted(true);
    // Gate on the validator's assembled input; never call CORE when invalid.
    if (input) {
      onSubmit(input);
    }
  };

  return (
    <form noValidate onSubmit={handleSubmit} aria-label="Car insurance quote">
      {NUMERIC_FIELDS.map((field) => {
        const error = visibleError(field.key);
        const errorId = `${field.key}-error`;
        return (
          <div key={field.key} className="quote-field">
            <label htmlFor={field.key}>{field.label}</label>
            <input
              id={field.key}
              name={field.key}
              type="number"
              inputMode="numeric"
              step={1}
              min={field.min}
              max={field.max}
              value={values[field.key]}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              onChange={(e) => setField(field.key, e.target.value)}
              onBlur={() => markTouched(field.key)}
            />
            {error ? (
              <p id={errorId} className="quote-field__error" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        );
      })}

      {(() => {
        const error = visibleError("coverageTier");
        const errorId = "coverageTier-error";
        const noteId = "coverageTier-note";
        return (
          <fieldset
            className="quote-field"
            aria-invalid={error ? true : undefined}
            aria-describedby={`${noteId}${error ? ` ${errorId}` : ""}`}
          >
            <legend>Coverage tier</legend>
            {TIER_OPTIONS.map((option) => (
              <label key={option.value} className="quote-tier-option">
                <input
                  type="radio"
                  name="coverageTier"
                  value={option.value}
                  checked={values.coverageTier === option.value}
                  onChange={() => {
                    setField("coverageTier", option.value);
                    markTouched("coverageTier");
                  }}
                />
                {option.label}
              </label>
            ))}
            <p id={noteId} className="quote-field__note">
              {TIER_NOTE}
            </p>
            {error ? (
              <p id={errorId} className="quote-field__error" role="alert">
                {error}
              </p>
            ) : null}
          </fieldset>
        );
      })()}

      <button type="submit">Get estimate</button>
    </form>
  );
}
