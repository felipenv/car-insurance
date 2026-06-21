import { describe, expect, it } from "vitest";

import { corePackageName } from "@car-insurance/core";

import { describesCore, WEB_PACKAGE_NAME } from "./index.js";

describe("@car-insurance/web baseline", () => {
  it("describes its CORE dependency", () => {
    expect(describesCore()).toContain(WEB_PACKAGE_NAME);
    expect(describesCore()).toContain(corePackageName());
  });
});
