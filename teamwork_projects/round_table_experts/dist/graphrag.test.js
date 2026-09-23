"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const graphrag_1 = require("./graphrag");
(0, vitest_1.describe)("GraphRAG Context Compression", () => {
    (0, vitest_1.test)("should return empty string when input is empty", () => {
        const result = (0, graphrag_1.compressContext)([], 100);
        (0, vitest_1.expect)(result).toBe("");
    });
    (0, vitest_1.test)("should filter out boilerplate messages starting with greetings or system tags", () => {
        const messages = [
            "Hello, I can help you",
            "greetings, user",
            "system: initializing",
            "Valid message content that we want to keep",
        ];
        const result = (0, graphrag_1.compressContext)(messages, 500);
        (0, vitest_1.expect)(result).toBe("Valid message content that we want to keep");
    });
    (0, vitest_1.test)("should parse and extract key fields from JSON messages", () => {
        const messages = [
            JSON.stringify({
                proposal: "Use Next.js 16 and Tailwind 4",
                architectureSummary: "Next.js RSC layout",
            }),
        ];
        const result = (0, graphrag_1.compressContext)(messages, 500);
        (0, vitest_1.expect)(result).toContain("Proposal: Use Next.js 16 and Tailwind 4");
        (0, vitest_1.expect)(result).toContain("Summary: Next.js RSC layout");
    });
    (0, vitest_1.test)("should truncate long text messages and add compression tag", () => {
        const longMessage = "a".repeat(400);
        const result = (0, graphrag_1.compressContext)([longMessage], 500);
        (0, vitest_1.expect)(result).toContain("[compressed]");
        (0, vitest_1.expect)(result.length).toBeLessThan(300);
    });
    (0, vitest_1.test)("should strictly respect maxLimit constraint on final output", () => {
        const messages = ["message one", "message two", "message three"];
        const result = (0, graphrag_1.compressContext)(messages, 15);
        (0, vitest_1.expect)(result.length).toBeLessThanOrEqual(15);
    });
});
(0, vitest_1.describe)("GraphRAG API Operations", () => {
    const fetchCalls = [];
    (0, vitest_1.beforeAll)(() => {
        vitest_1.vi.stubGlobal("fetch", async (url, options) => {
            fetchCalls.push({ url, options });
            return {
                ok: true,
                status: 200,
                json: async () => ({ status: "mocked_success" }),
            };
        });
    });
    (0, vitest_1.afterAll)(() => {
        vitest_1.vi.restoreAllMocks();
    });
    (0, vitest_1.test)("search should submit top_k: 3 and specific collections to the search API", async () => {
        fetchCalls.length = 0;
        await (0, graphrag_1.search)("react server components");
        (0, vitest_1.expect)(fetchCalls.length).toBe(1);
        (0, vitest_1.expect)(fetchCalls[0].url).toBe("http://localhost:8100/api/search");
        const body = JSON.parse(fetchCalls[0].options.body);
        (0, vitest_1.expect)(body.top_k).toBe(3);
        (0, vitest_1.expect)(body.collections).toContain("architecture_decisions");
        (0, vitest_1.expect)(body.collections).toContain("business_rules");
        (0, vitest_1.expect)(body.collections).toContain("coding_conventions");
    });
    (0, vitest_1.test)("ingest should throw error if less than 2 sources are provided", async () => {
        await (0, vitest_1.expect)((0, graphrag_1.ingest)("Title", "Content", "category", ["only_one_source"])).rejects.toThrow();
        await (0, vitest_1.expect)((0, graphrag_1.ingest)("Title", "Content", "category", [])).rejects.toThrow();
    });
    (0, vitest_1.test)("ingest should throw error if sources are identical or duplicate", async () => {
        await (0, vitest_1.expect)((0, graphrag_1.ingest)("Title", "Content", "category", ["sourceA", "sourceA"])).rejects.toThrow();
    });
    (0, vitest_1.test)("ingest should calculate confidence score and submit fact to API when 2+ unique sources exist", async () => {
        fetchCalls.length = 0;
        const response = await (0, graphrag_1.ingest)("My Title", "My Content", "architecture", ["sourceA", "sourceB"]);
        (0, vitest_1.expect)(response.status).toBe("mocked_success");
        (0, vitest_1.expect)(fetchCalls.length).toBe(1);
        (0, vitest_1.expect)(fetchCalls[0].url).toBe("http://localhost:8100/api/knowledge");
        const body = JSON.parse(fetchCalls[0].options.body);
        (0, vitest_1.expect)(body.title).toBe("My Title");
        (0, vitest_1.expect)(body.content).toBe("My Content");
        (0, vitest_1.expect)(body.category).toBe("architecture");
        (0, vitest_1.expect)(body.confidence_score).toBe(0.7); // 2 unique sources
    });
});
