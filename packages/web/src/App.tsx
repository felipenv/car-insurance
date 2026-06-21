/**
 * The application shell that assembles the primary flow (FR5 / FR10): it wires
 * the {@link QuoteForm} to the CORE rating engine and renders the
 * {@link QuoteResult} for the most recent valid submit.
 *
 * This is the single WEB↔CORE call site. The form owns collection, validation,
 * and submit gating (FR1–FR4) and only ever hands up a fully-valid
 * {@link QuoteInput}; this component turns that input into a rated quote by
 * calling `rateQuote` in-process and stores the authoritative result in React
 * state. Each valid submit recomputes fresh and replaces any prior result
 * (FR10); the result lives only in component state, so nothing is persisted and
 * no network is touched (AC9). No model constants are restated here — every
 * number on screen originates from the engine (AC10).
 */

import { useState } from "react";

import {
  rateQuote,
  type QuoteInput,
  type QuoteResult as RatedQuote,
} from "@car-insurance/core";

import { QuoteForm } from "./components/QuoteForm.js";
import { QuoteResult } from "./components/QuoteResult.js";

export function App(): JSX.Element {
  // The rated quote for the latest valid submit, or null before the first one.
  // Holding it in state (and nowhere else) is what makes the flow deterministic
  // and stateless across reloads: there is no storage, cache, or network.
  const [result, setResult] = useState<RatedQuote | null>(null);

  const handleQuote = (input: QuoteInput): void => {
    // FR10: rate fresh on every valid submit and replace the prior result.
    // `rateQuote` is a pure, in-process call — no I/O, no persistence (AC9).
    setResult(rateQuote(input));
  };

  return (
    <main className="quote-app">
      <h1 className="quote-app__title">Car insurance premium estimate</h1>
      <QuoteForm onSubmit={handleQuote} />
      {result ? <QuoteResult result={result} /> : null}
    </main>
  );
}
