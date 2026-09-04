import { fetchFavourites, fetchQueue } from "./src/api";
import { getPreferenceValues } from "@raycast/api";

// Mock Raycast API
jest.mock("@raycast/api", () => ({
  getPreferenceValues: () => ({ haUrl: "...", haToken: "..." }),
  Cache: class { get() {} set() {} has() {} }
}));

async function run() {
  // Wait, I can't easily mock this without proper config.
}
