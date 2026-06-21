import { describe, expect, it } from "vitest";

import { formatCurrency } from "./formatCurrency.js";

describe("formatCurrency — FR8/AC1", () => {
  it("puts ₪ immediately before a comma-grouped integer", () => {
    expect(formatCurrency(2400)).toBe("₪2,400");
  });

  it("formats zero as ₪0", () => {
    expect(formatCurrency(0)).toBe("₪0");
  });

  it("groups large values into thousands", () => {
    expect(formatCurrency(2000000)).toBe("₪2,000,000");
    expect(formatCurrency(3156)).toBe("₪3,156");
  });

  it("renders negative deltas with a leading minus, e.g. −₪120", () => {
    expect(formatCurrency(-120)).toBe("−₪120");
    expect(formatCurrency(-1500)).toBe("−₪1,500");
  });

  it("rounds non-integers to the nearest whole ₪", () => {
    expect(formatCurrency(2399.4)).toBe("₪2,399");
    expect(formatCurrency(2399.5)).toBe("₪2,400");
    expect(formatCurrency(-120.6)).toBe("−₪121");
  });

  it("does not render a minus for values that round to zero", () => {
    expect(formatCurrency(-0.4)).toBe("₪0");
  });
});
