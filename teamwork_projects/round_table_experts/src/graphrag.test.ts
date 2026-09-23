import { describe, expect, test, vi, beforeAll, afterAll } from "vitest";
import { compressContext, ingest, search } from "./graphrag";

describe("GraphRAG Context Compression", () => {
  test("should return empty string when input is empty", () => {
    const result = compressContext([], 100);
    expect(result).toBe("");
  });

  test("should filter out boilerplate messages starting with greetings or system tags", () => {
    const messages = [
      "Hello, I can help you",
      "greetings, user",
      "system: initializing",
      "Valid message content that we want to keep",
    ];
    const result = compressContext(messages, 500);
    expect(result).toBe("Valid message content that we want to keep");
  });

  test("should parse and extract key fields from JSON messages", () => {
    const messages = [
      JSON.stringify({
        proposal: "Use Next.js 16 and Tailwind 4",
        architectureSummary: "Next.js RSC layout",
      }),
    ];
    const result = compressContext(messages, 500);
    expect(result).toContain("Proposal: Use Next.js 16 and Tailwind 4");
    expect(result).toContain("Summary: Next.js RSC layout");
  });

  test("should truncate long text messages and add compression tag", () => {
    const longMessage = "a".repeat(400);
    const result = compressContext([longMessage], 500);
    expect(result).toContain("[compressed]");
    expect(result.length).toBeLessThan(300);
  });

  test("should strictly respect maxLimit constraint on final output", () => {
    const messages = ["message one", "message two", "message three"];
    const result = compressContext(messages, 15);
    expect(result.length).toBeLessThanOrEqual(15);
  });
});
describe("GraphRAG API Operations", () => {
  const fetchCalls: { url: string; options: any }[] = [];
  let fetchSpy: any;

  beforeEach(() => {
    fetchCalls.length = 0;
    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url: any, options: any) => {
      fetchCalls.push({ url: typeof url === 'string' ? url : url.toString(), options });
      return {
        ok: true,
        status: 200,
        json: async () => ({ status: "mocked_success" }),
      } as unknown as Response;
    });
  });

  afterEach(() => {
    fetchSpy?.mockRestore();
  });

  test("search should submit top_k: 3 and specific collections to the search API", async () => {
    fetchCalls.length = 0;
    await search("react server components");
    expect(fetchCalls.length).toBe(1);
    expect(fetchCalls[0].url).toBe("http://localhost:8100/api/search");
    
    const body = JSON.parse(fetchCalls[0].options.body);
    expect(body.top_k).toBe(3);
    expect(body.collections).toContain("architecture_decisions");
    expect(body.collections).toContain("business_rules");
    expect(body.collections).toContain("coding_conventions");
  });

  test("ingest should throw error if less than 2 sources are provided", async () => {
    await expect(ingest("Title", "Content", "category", ["only_one_source"])).rejects.toThrow();
    await expect(ingest("Title", "Content", "category", [])).rejects.toThrow();
  });

  test("ingest should throw error if sources are identical or duplicate", async () => {
    await expect(ingest("Title", "Content", "category", ["sourceA", "sourceA"])).rejects.toThrow();
  });

  test("ingest should calculate confidence score and submit fact to API when 2+ unique sources exist", async () => {
    fetchCalls.length = 0;
    const response = await ingest("My Title", "My Content", "architecture", ["sourceA", "sourceB"]);
    expect(response.status).toBe("mocked_success");
    expect(fetchCalls.length).toBe(1);
    expect(fetchCalls[0].url).toBe("http://localhost:8100/api/knowledge");

    const body = JSON.parse(fetchCalls[0].options.body);
    expect(body.title).toBe("My Title");
    expect(body.content).toBe("My Content");
    expect(body.category).toBe("architecture");
    expect(body.confidence_score).toBe(0.7); // 2 unique sources
  });
});
