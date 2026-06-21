import { describe, expect, it } from "vitest";

import { CORE_PACKAGE_NAME, corePackageName } from "./index.js";

describe("@car-insurance/core baseline", () => {
  it("exposes its package name", () => {
    expect(corePackageName()).toBe(CORE_PACKAGE_NAME);
  });
});
