// Unmount any rendered React tree after each test so the jsdom document starts
// clean for the next case (Testing Library's standard cleanup hook).
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});
