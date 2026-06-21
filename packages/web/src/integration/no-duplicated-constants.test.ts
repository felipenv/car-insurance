/**
 * AC10 guard: WEB must not duplicate or re-derive the model's numeric
 * constants. All premium and breakdown numbers originate from the CORE engine;
 * WEB only formats and lays out what `rateQuote` returns.
 *
 * This is a grep-style regression test over the WEB *production* source (test
 * files are excluded — they legitimately call the engine and assert its
 * numbers). It strips comments and string/template literals, then scans the
 * remaining code tokens for any of the model's pricing constants: the base
 * premium, the ₪600 floor, the vehicle-value divisor, and every band/tier
 * multiplier. A match means a model number has leaked into WEB as a literal —
 * exactly the duplication AC10 forbids.
 *
 * The model's *input-domain bounds* (age 17–99, ₪2,000,000, 100,000 km, 10
 * claims) are NOT pricing constants — they gate what the engine may receive and
 * legitimately live in WEB's validation, so they are intentionally not flagged.
 */

import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/** packages/web/src — Vitest runs with cwd at the WEB package root. */
const SRC_DIR = resolve(process.cwd(), "src");

/** The model's pricing constants (model.ts). None may appear as a WEB literal. */
const FORBIDDEN_MODEL_NUMBERS: readonly number[] = [
  2400, // BASE_PREMIUM_ILS
  600, // PREMIUM_FLOOR_ILS
  500_000, // VEHICLE_VALUE_DIVISOR_ILS
  // Band + tier multipliers (age, years-licensed, mileage, claims, coverage).
  1.6,
  1.2,
  1.1,
  1.35,
  1.25,
  1.05,
  0.95,
  0.9,
  0.6,
  1.4,
];

/** Recursively collects production .ts/.tsx files (excludes *.test.*). */
function productionSourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      files.push(...productionSourceFiles(full));
    } else if (
      /\.tsx?$/.test(entry.name) &&
      !/\.test\.tsx?$/.test(entry.name)
    ) {
      files.push(full);
    }
  }
  return files;
}

/**
 * Removes comments and string/template literals so only executable code tokens
 * remain. Over-stripping is safe here: a duplicated pricing constant that
 * matters is a code literal, never prose or message text.
 */
function stripCommentsAndStrings(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ") // block comments
    .replace(/\/\/[^\n]*/g, " ") // line comments
    .replace(/"(?:[^"\\]|\\.)*"/g, " ") // double-quoted strings
    .replace(/'(?:[^'\\]|\\.)*'/g, " ") // single-quoted strings
    .replace(/`(?:[^`\\]|\\.)*`/g, " "); // template literals
}

/** Extracts numeric literals (underscores normalized) from code. */
function numericLiterals(code: string): number[] {
  const matches = code.match(/(?<![\w$.])\d[\d_]*(?:\.\d+)?/g) ?? [];
  return matches.map((raw) => Number(raw.replace(/_/g, "")));
}

describe("AC10 — WEB does not duplicate CORE model constants", () => {
  const files = productionSourceFiles(SRC_DIR);

  it("finds production source to scan", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it("contains no model pricing constant as a code literal", () => {
    const forbidden = new Set(FORBIDDEN_MODEL_NUMBERS);
    const offenders: string[] = [];

    for (const file of files) {
      const code = stripCommentsAndStrings(readFileSync(file, "utf8"));
      const leaked = numericLiterals(code).filter((n) => forbidden.has(n));
      if (leaked.length > 0) {
        const rel = file.slice(SRC_DIR.length + 1);
        offenders.push(`${rel}: ${[...new Set(leaked)].join(", ")}`);
      }
    }

    expect(
      offenders,
      `Model pricing constants must come from CORE, not be restated in WEB ` +
        `(AC10). Offending files:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  it("sources the premium from the engine at the WEB↔CORE call site", () => {
    // Positive check: the assembly imports rateQuote from CORE rather than
    // computing a premium itself.
    const app = readFileSync(`${SRC_DIR}/App.tsx`, "utf8");
    expect(app).toMatch(
      /import\s*\{[\s\S]*rateQuote[\s\S]*\}\s*from\s*["']@car-insurance\/core["']/,
    );
  });
});
