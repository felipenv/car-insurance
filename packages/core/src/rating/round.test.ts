import { describe, expect, it } from "vitest";

import { roundHalfUp } from "./round.js";

describe("roundHalfUp", () => {
  it("rounds an exact .50 up to the next integer (half-up tie-break)", () => {
    // FR3 / A2: the defining cases. Each is exactly x.50 and must round to x+1.
    expect(roundHalfUp(0.5)).toBe(1);
    expect(roundHalfUp(2.5)).toBe(3);
    expect(roundHalfUp(1199.5)).toBe(1200);
  });

  it("does NOT use half-to-even (banker's) rounding", () => {
    // Under banker's rounding 2.5 → 2 (round to even) and 0.5 → 0. Half-up must
    // instead round both up. This pins that the engine never uses banker's.
    expect(roundHalfUp(2.5)).not.toBe(2);
    expect(roundHalfUp(0.5)).not.toBe(0);
    expect(roundHalfUp(4.5)).toBe(5);
  });

  it("rounds down values just below the .50 tie-point", () => {
    expect(roundHalfUp(0.49)).toBe(0);
    expect(roundHalfUp(2.499)).toBe(2);
    expect(roundHalfUp(1199.4999)).toBe(1199);
  });

  it("rounds up values just above the .50 tie-point", () => {
    expect(roundHalfUp(0.51)).toBe(1);
    expect(roundHalfUp(2.501)).toBe(3);
  });

  it("leaves already-integer values unchanged (determinism)", () => {
    expect(roundHalfUp(0)).toBe(0);
    expect(roundHalfUp(1)).toBe(1);
    expect(roundHalfUp(2400)).toBe(2400);
    expect(roundHalfUp(600)).toBe(600);
  });

  it("is deterministic: identical inputs yield identical outputs", () => {
    expect(roundHalfUp(2.5)).toBe(roundHalfUp(2.5));
    expect(roundHalfUp(1108.5)).toBe(roundHalfUp(1108.5));
  });
});
