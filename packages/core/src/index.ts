/**
 * Framework-agnostic core for the car-insurance estimator.
 *
 * Intentionally trivial baseline: it proves the package compiles and can be
 * consumed by WEB through a TypeScript project reference. The real rating
 * engine, swappable provider interface, and model factors land in later
 * features — nothing here should anticipate them.
 */

/** Scoped package name; placeholder export until the rating engine exists. */
export const CORE_PACKAGE_NAME = "@car-insurance/core" as const;

/** Returns the CORE package name. Exists only to give WEB something to import. */
export function corePackageName(): string {
  return CORE_PACKAGE_NAME;
}
