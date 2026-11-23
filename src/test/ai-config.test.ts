import { describe, expect, it } from "vitest";
import { AI_NOT_CONFIGURED, aiNotConfigured, aiNotConfiguredJson } from "../lib/ai-config";

describe("AI not-configured state", () => {
  it("reports the missing key as unavailable, not as a server crash", async () => {
    const res = aiNotConfigured();
    expect(res.status).toBe(503);
    expect(res.ok).toBe(false);
    expect(await res.text()).toBe(AI_NOT_CONFIGURED);
  });

  it("never shows the old developer string to users", () => {
    expect(AI_NOT_CONFIGURED).not.toContain("Server is not configured.");
    expect(AI_NOT_CONFIGURED).toContain("AI is not configured yet.");
  });

  it("keeps the voice endpoints on the same readable message", async () => {
    const res = aiNotConfiguredJson();
    expect(res.status).toBe(503);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBe(AI_NOT_CONFIGURED);
  });
});
