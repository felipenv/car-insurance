import { describe, expect, it } from "vitest";

import {
  EMPTY_FORM_VALUES,
  MESSAGES,
  validateQuoteForm,
  type QuoteFormValues,
} from "./validation.js";

/** A fully-valid baseline; spread-override one field per case. */
const VALID: QuoteFormValues = {
  driverAge: "35",
  yearsLicensed: "10",
  vehicleValue: "150000",
  annualMileage: "12000",
  priorClaims: "0",
  coverageTier: "standard",
};

const valuesWith = (overrides: Partial<QuoteFormValues>): QuoteFormValues => ({
  ...VALID,
  ...overrides,
});

describe("validateQuoteForm — valid input", () => {
  it("returns no errors and the assembled QuoteInput for a valid form", () => {
    const { errors, input } = validateQuoteForm(VALID);
    expect(errors).toEqual({});
    expect(input).toEqual({
      driverAge: 35,
      yearsLicensed: 10,
      vehicleValue: 150000,
      annualMileage: 12000,
      priorClaims: 0,
      coverageTier: "standard",
    });
  });

  it("coerces numeric strings to numbers (not strings) in the input", () => {
    const { input } = validateQuoteForm(VALID);
    expect(typeof input?.driverAge).toBe("number");
    expect(typeof input?.vehicleValue).toBe("number");
  });
});

describe("validateQuoteForm — empty form (FR4)", () => {
  it("flags every field and yields no input", () => {
    const { errors, input } = validateQuoteForm(EMPTY_FORM_VALUES);
    expect(input).toBeNull();
    expect(errors.driverAge).toBe(MESSAGES.driverAge);
    expect(errors.yearsLicensed).toBe(MESSAGES.yearsLicensedRange);
    expect(errors.vehicleValue).toBe(MESSAGES.vehicleValue);
    expect(errors.annualMileage).toBe(MESSAGES.annualMileage);
    expect(errors.priorClaims).toBe(MESSAGES.priorClaims);
    expect(errors.coverageTier).toBe(MESSAGES.coverageTier);
  });
});

describe("driver age (FR3)", () => {
  it.each(["17", "99", "35"])("accepts in-range age %s", (driverAge) => {
    expect(
      validateQuoteForm(valuesWith({ driverAge })).errors.driverAge,
    ).toBeUndefined();
  });

  it.each(["16", "100", "0", "-5", "", "35.5", "abc", "3e1"])(
    "rejects invalid age %s with the exact message",
    (driverAge) => {
      const { errors, input } = validateQuoteForm(valuesWith({ driverAge }));
      expect(errors.driverAge).toBe(MESSAGES.driverAge);
      expect(input).toBeNull();
    },
  );
});

describe("years licensed — own range (FR3)", () => {
  it("accepts 0", () => {
    expect(
      validateQuoteForm(valuesWith({ driverAge: "30", yearsLicensed: "0" }))
        .errors.yearsLicensed,
    ).toBeUndefined();
  });

  it.each(["-1", "", "2.5", "x"])(
    "rejects non-integer/negative %s with the range message",
    (yearsLicensed) => {
      expect(
        validateQuoteForm(valuesWith({ yearsLicensed })).errors.yearsLicensed,
      ).toBe(MESSAGES.yearsLicensedRange);
    },
  );
});

describe("years licensed — cross-field rule (FR3 / AC6)", () => {
  it("allows years licensed == age - 17", () => {
    // age 30 ⇒ max 13
    expect(
      validateQuoteForm(valuesWith({ driverAge: "30", yearsLicensed: "13" }))
        .errors.yearsLicensed,
    ).toBeUndefined();
  });

  it("rejects years licensed > age - 17 with the exact message", () => {
    const { errors, input } = validateQuoteForm(
      valuesWith({ driverAge: "30", yearsLicensed: "14" }),
    );
    expect(errors.yearsLicensed).toBe(MESSAGES.yearsLicensedCrossField);
    expect(input).toBeNull();
  });

  it("at age 17 allows 0 years (boundary) and rejects 1 (AC6 edge)", () => {
    expect(
      validateQuoteForm(valuesWith({ driverAge: "17", yearsLicensed: "0" }))
        .errors.yearsLicensed,
    ).toBeUndefined();
    expect(
      validateQuoteForm(valuesWith({ driverAge: "17", yearsLicensed: "1" }))
        .errors.yearsLicensed,
    ).toBe(MESSAGES.yearsLicensedCrossField);
  });

  it("does not raise the cross-field error when age is itself invalid", () => {
    // Age invalid ⇒ only the age error, no spurious cross-field message.
    const { errors } = validateQuoteForm(
      valuesWith({ driverAge: "abc", yearsLicensed: "40" }),
    );
    expect(errors.driverAge).toBe(MESSAGES.driverAge);
    expect(errors.yearsLicensed).toBeUndefined();
  });
});

describe("vehicle value (FR3)", () => {
  it.each(["1", "2000000", "150000"])(
    "accepts in-range value %s",
    (vehicleValue) => {
      expect(
        validateQuoteForm(valuesWith({ vehicleValue })).errors.vehicleValue,
      ).toBeUndefined();
    },
  );

  it.each(["0", "-1", "2000001", "", "1000.5", "abc"])(
    "rejects out-of-range value %s with the exact message",
    (vehicleValue) => {
      expect(
        validateQuoteForm(valuesWith({ vehicleValue })).errors.vehicleValue,
      ).toBe(MESSAGES.vehicleValue);
    },
  );
});

describe("annual mileage (FR3)", () => {
  it.each(["0", "100000", "12000"])(
    "accepts in-range mileage %s",
    (annualMileage) => {
      expect(
        validateQuoteForm(valuesWith({ annualMileage })).errors.annualMileage,
      ).toBeUndefined();
    },
  );

  it.each(["-1", "100001", "", "1.5", "abc"])(
    "rejects out-of-range mileage %s with the exact message",
    (annualMileage) => {
      expect(
        validateQuoteForm(valuesWith({ annualMileage })).errors.annualMileage,
      ).toBe(MESSAGES.annualMileage);
    },
  );
});

describe("prior claims (FR3)", () => {
  it.each(["0", "10", "3"])("accepts in-range claims %s", (priorClaims) => {
    expect(
      validateQuoteForm(valuesWith({ priorClaims })).errors.priorClaims,
    ).toBeUndefined();
  });

  it.each(["-1", "11", "", "2.5", "abc"])(
    "rejects out-of-range claims %s with the exact message",
    (priorClaims) => {
      expect(
        validateQuoteForm(valuesWith({ priorClaims })).errors.priorClaims,
      ).toBe(MESSAGES.priorClaims);
    },
  );
});

describe("coverage tier (FR2 / AC7)", () => {
  it.each(["basic", "standard", "premium"] as const)(
    "accepts tier identifier %s",
    (coverageTier) => {
      expect(
        validateQuoteForm(valuesWith({ coverageTier })).errors.coverageTier,
      ).toBeUndefined();
    },
  );

  it("rejects an unselected tier with the exact message", () => {
    const { errors, input } = validateQuoteForm(
      valuesWith({ coverageTier: "" }),
    );
    expect(errors.coverageTier).toBe(MESSAGES.coverageTier);
    expect(input).toBeNull();
  });
});

describe("verbatim message text (FR3 / FR2)", () => {
  it("matches the spec strings exactly", () => {
    expect(MESSAGES.vehicleValue).toBe(
      "Enter a vehicle value between ₪1 and ₪2,000,000.",
    );
    expect(MESSAGES.annualMileage).toBe(
      "Enter annual mileage between 0 and 100,000 km.",
    );
    expect(MESSAGES.priorClaims).toBe(
      "Enter the number of claims (0 or more).",
    );
    expect(MESSAGES.yearsLicensedCrossField).toBe(
      "Years licensed can't be more than your years since age 17.",
    );
  });
});
