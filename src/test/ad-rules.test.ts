import { describe, expect, it } from "vitest";
import { AD_CONFIG, REWARDED_STARS_ENABLED } from "../components/fly/ads";

describe("Ad rules", () => {
  it("gives no stars for watching an ad", () => {
    expect(REWARDED_STARS_ENABLED).toBe(false);
  });

  it("counts down 5 seconds before an ad can be skipped", () => {
    expect(AD_CONFIG.skipSeconds).toBe(5);
  });
});
