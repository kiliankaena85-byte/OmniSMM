import { expect, test, describe, beforeEach, afterAll, vi } from "vitest";
import { existsSync, readFileSync, unlinkSync } from "fs";
import { join } from "path";
import { RoundTableOrchestrator } from "./src/orchestrator";
import { DiscussionLog } from "./src/types";

describe("Round Table E2E Test Suite", () => {
  const logPath = join(__dirname, "DISCUSSION_LOG.json");

  // Keep track of all intercepted fetch calls
  const fetchCalls: { url: string; options: any }[] = [];

  beforeEach(() => {
    fetchCalls.length = 0;
    // Clean up old log if exists
    if (existsSync(logPath)) {
      try { unlinkSync(logPath); } catch {}
    }

    // Mock global fetch
    const mockFetch = vi.fn().mockImplementation(async (url: string, options: any) => {
      fetchCalls.push({ url, options });

      const body = options?.body ? JSON.parse(options.body) : {};

      // 1. Intercept GraphRAG Search
      if (url === "http://localhost:8100/api/search") {
        return {
          ok: true,
          status: 200,
          json: async () => ({ hasKnowledgeGap: true }),
        } as unknown as Response;
      }

      // 2. Intercept GraphRAG Ingestion
      if (url === "http://localhost:8100/api/knowledge") {
        return {
          ok: true,
          status: 200,
          json: async () => ({ status: "success" }),
        } as unknown as Response;
      }

      // 3. Intercept LLM calls
      if (url.includes("mock-llm") || url.includes("gemini.local") || url === "https://api.gemini.local/v1/models/gemini-3-flash:generateContent") {
        const expert = options?.headers?.["X-Expert"] || options?.headers?.["x-expert"];

        if (expert === "Architect") {
          // Detect if it is the first or second turn of Architect
          const userText = body.contents?.[0]?.parts?.[0]?.text || "";
          if (userText.includes("Feedback:")) {
            // Second turn (Revised)
            return {
              ok: true,
              status: 200,
              json: async () => ({
                candidates: [
                  {
                    content: {
                      parts: [
                        {
                          text: JSON.stringify({
                            proposal: "Use Server Actions with Prisma ORM and Zod input validation",
                            architectureSummary: "Secure Server Actions architecture",
                            assumptions: ["Prisma protects against SQL injection", "Server Actions guard access"]
                          })
                        }
                      ]
                    }
                  }
                ]
              }),
            } as unknown as Response;
          } else {
            // First turn (Vulnerable)
            return {
              ok: true,
              status: 200,
              json: async () => ({
                candidates: [
                  {
                    content: {
                      parts: [
                        {
                          text: JSON.stringify({
                            proposal: "Use raw connection string on client to run SQL",
                            architectureSummary: "Direct DB connection on frontend",
                            assumptions: ["Client-side is secure"]
                          })
                        }
                      ]
                    }
                  }
                ]
              }),
            } as unknown as Response;
          }
        }

        if (expert === "SecurityAuditor") {
          const userText = body.contents?.[0]?.parts?.[0]?.text || "";
          if (userText.includes("raw connection string")) {
            // Reject first turn
            return {
              ok: true,
              status: 200,
              json: async () => ({
                candidates: [
                  {
                    content: {
                      parts: [
                        {
                          text: JSON.stringify({
                            approved: false,
                            vulnerabilities: ["SQL Injection", "Exposed Database Credentials"],
                            securityFeedback: "Proposal exposes database credentials to client and allows raw SQL queries."
                          })
                        }
                      ]
                    }
                  }
                ]
              }),
            } as unknown as Response;
          } else {
            // Approve second turn
            return {
              ok: true,
              status: 200,
              json: async () => ({
                candidates: [
                  {
                    content: {
                      parts: [
                        {
                          text: JSON.stringify({
                            approved: true,
                            vulnerabilities: [],
                            securityFeedback: "Secure design using Server Actions."
                          })
                        }
                      ]
                    }
                  }
                ]
              }),
            } as unknown as Response;
          }
        }

        if (expert === "QAEngineer") {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              candidates: [
                {
                  content: {
                    parts: [
                      {
                        text: JSON.stringify({
                          approved: true,
                          edgeCasesIdentified: ["Network failure during Server Action execution", "Rate limit on actions"],
                          qaFeedback: "Approved with edge cases to handle."
                        })
                      }
                    ]
                  }
                }
              ]
            }),
          } as unknown as Response;
        }

        if (expert === "DeepResearcher") {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              candidates: [
                {
                  content: {
                    parts: [
                      {
                        text: JSON.stringify({
                          factsToIngest: [
                            {
                              fact: "Next.js 16 supports standard ES modules directly",
                              sources: ["https://nextjs.org", "https://react.dev"],
                              confidence_score: 0.95
                            },
                            {
                              fact: "Next.js 16 completely deprecates React",
                              sources: ["http://fakesource.org"],
                              confidence_score: 0.1
                            },
                            {
                              fact: "Identical sources fact should be rejected",
                              sources: ["https://react.dev", "https://react.dev"],
                              confidence_score: 0.5
                            }
                          ],
                          findings: "Verified that Next.js 16 maintains compatibility with React 19."
                        })
                      }
                    ]
                  }
                }
              ]
            }),
          } as unknown as Response;
        }
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({ candidates: [] })
      } as unknown as Response;
    });

    global.fetch = mockFetch;
    vi.stubGlobal("fetch", mockFetch);
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  test("runs the full self-correction, fact-checking, and context compression loop", async () => {
    const orchestrator = new RoundTableOrchestrator({
      logPath,
      llmUrl: "http://localhost:8100/mock-llm",
    });

    const result = await orchestrator.execute(
      "req-123",
      "Decompose and implement a new Next.js 16 component with safe DB query layer"
    );

    // 1. Assert that the final DISCUSSION_LOG.json is created and populated
    expect(existsSync(logPath)).toBe(true);
    const logContent: DiscussionLog = JSON.parse(readFileSync(logPath, "utf8"));
    expect(logContent.requestId).toBe("req-123");
    expect(logContent.finalStatus).toBe("approved");

    // Check turns: should contain Architect (1st), Security (1st rejection), Architect (2nd), Security (2nd approval), QA, DeepResearcher
    const turns = logContent.turns || [];
    expect(turns.length).toBe(6);
    expect(turns[0].expert).toBe("Architect");
    expect(turns[1].expert).toBe("SecurityAuditor");
    expect(turns[1].output.approved).toBe(false);

    expect(turns[2].expert).toBe("Architect");
    expect(turns[3].expert).toBe("SecurityAuditor");
    expect(turns[3].output.approved).toBe(true);

    expect(turns[4].expert).toBe("QAEngineer");
    expect(turns[5].expert).toBe("DeepResearcher");

    // 2. Assert that the orchestrator correctly queried http://localhost:8100/api/search with top_k: 3
    const searchQuery = fetchCalls.find((c) => c.url === "http://localhost:8100/api/search");
    expect(searchQuery).toBeDefined();
    const searchBody = JSON.parse(searchQuery!.options.body);
    expect(searchBody.top_k).toBe(3);

    // 3. Assert that only the Valid Fact (>= 2 independent sources) was POSTed, and Fake Facts were rejected
    const knowledgePosts = fetchCalls.filter((c) => c.url === "http://localhost:8100/api/knowledge");
    expect(knowledgePosts.length).toBe(1); // Only 1 fact ingested
    const ingestedFact = JSON.parse(knowledgePosts[0].options.body);
    expect(ingestedFact.content).toBe("Next.js 16 supports standard ES modules directly");
    expect(ingestedFact.confidence_score).toBeGreaterThanOrEqual(0.0);
    expect(ingestedFact.confidence_score).toBeLessThanOrEqual(1.0);

    // Fake facts should not be found in knowledge posts
    const fakeFactPost1 = knowledgePosts.find((c) => {
      const b = JSON.parse(c.options.body);
      return b.content.includes("deprecates React");
    });
    expect(fakeFactPost1).toBeUndefined();

    const fakeFactPost2 = knowledgePosts.find((c) => {
      const b = JSON.parse(c.options.body);
      return b.content.includes("Identical sources");
    });
    expect(fakeFactPost2).toBeUndefined();

    // 4. Assert context compression: subsequent turns pass summaries or filtered messages instead of full conversation logs
    const architect2Call = fetchCalls.find((c) => {
      if (!c.url.includes("mock-llm") && c.url !== "https://api.gemini.local/v1/models/gemini-3-flash:generateContent") return false;
      const headers = c.options.headers;
      if (headers?.["X-Expert"] !== "Architect" && headers?.["x-expert"] !== "Architect") return false;
      const body = JSON.parse(c.options.body);
      const text = body.contents?.[0]?.parts?.[0]?.text || "";
      return text.includes("Feedback:");
    });
    expect(architect2Call).toBeDefined();
    const bodyText = JSON.parse(architect2Call!.options.body).contents[0].parts[0].text;
    
    // The prompt should NOT contain the verbatim previous JSON of turns[0] and turns[1]
    expect(bodyText).not.toContain('"proposal": "Use raw connection string on client to run SQL"');
    // Instead it should contain the compressed summary
    expect(bodyText).toContain("Architect Summary:");
    expect(bodyText).toContain("Security Auditor:");
  });
});
