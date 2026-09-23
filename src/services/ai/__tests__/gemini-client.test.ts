import { describe, it, expect, vi, beforeEach } from "vitest";
import { GeminiClient } from "../gemini-client";

describe("GeminiClient", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should return model from env if explicitly set", async () => {
    process.env.GEMINI_MODEL = "gemini-3.7-flash";
    const model = await GeminiClient.resolveLatestModel("mock-api-key");
    expect(model).toBe("gemini-3.7-flash");
    delete process.env.GEMINI_MODEL;
  });

  it("should correctly extract multiple API keys from GEMINI_API_KEYS", () => {
    process.env.GEMINI_API_KEYS = "key_one_12345, key_two_67890, key_three_abcdef";
    const keys = GeminiClient.getAvailableApiKeys();
    expect(keys).toHaveLength(3);
    expect(keys[0]).toBe("key_one_12345");
    expect(keys[1]).toBe("key_two_67890");
    expect(keys[2]).toBe("key_three_abcdef");
    delete process.env.GEMINI_API_KEYS;
  });

  it("should construct ProxyAgent dispatcher when GEMINI_PROXY is provided", () => {
    process.env.GEMINI_PROXY = "http://127.0.0.1:7890";
    const dispatcher = GeminiClient.getDispatcher();
    expect(dispatcher).toBeDefined();
    delete process.env.GEMINI_PROXY;
  });

  it("should fail gracefully and throw when GEMINI_API_KEY is missing", async () => {
    const originalKey = process.env.GEMINI_API_KEY;
    const originalKeys = process.env.GEMINI_API_KEYS;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEYS;

    await expect(
      GeminiClient.generateContent({
        contents: [{ role: "user", parts: [{ text: "Hello" }] }],
      })
    ).rejects.toThrow("GEMINI_API_KEY / GEMINI_API_KEYS is not configured");

    if (originalKey) process.env.GEMINI_API_KEY = originalKey;
    if (originalKeys) process.env.GEMINI_API_KEYS = originalKeys;
  });
});
