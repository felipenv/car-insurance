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
