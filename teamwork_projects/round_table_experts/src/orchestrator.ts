import { writeFileSync } from "fs";
import { join } from "path";
import {
  ArchitectOutputSchema,
  SecurityAuditorOutputSchema,
  QAEngineerOutputSchema,
  DeepResearcherOutputSchema,
  DiscussionLog,
  DiscussionTurn,
  FactToIngest
} from "./types";

export interface OrchestratorConfig {
  logPath?: string;
  graphRagSearchUrl?: string;
  graphRagKnowledgeUrl?: string;
  llmUrl?: string;
}

export class RoundTableOrchestrator {
  private config: Required<OrchestratorConfig>;

  constructor(config?: OrchestratorConfig) {
    this.config = {
      logPath: config?.logPath || join(process.cwd(), "DISCUSSION_LOG.json"),
      graphRagSearchUrl: config?.graphRagSearchUrl || "http://localhost:8100/api/search",
      graphRagKnowledgeUrl: config?.graphRagKnowledgeUrl || "http://localhost:8100/api/knowledge",
      llmUrl: config?.llmUrl || "https://api.gemini.local/v1/models/gemini-3-flash:generateContent",
    };
  }

  // Context compression utility: strips full logs to concise summaries of previous turns
  public compressContext(turns: DiscussionTurn[]): string {
    return turns
      .map((t) => {
        if (t.expert === "Architect") {
          return `Architect Summary: ${t.output.architectureSummary}. Assumptions: ${t.output.assumptions.join(", ")}.`;
        } else if (t.expert === "SecurityAuditor") {
          return `Security Auditor: approved=${t.output.approved}, feedback="${t.output.securityFeedback}", vulnerabilities=[${t.output.vulnerabilities.join(", ")}].`;
        } else if (t.expert === "QAEngineer") {
          return `QA Engineer: approved=${t.output.approved}, feedback="${t.output.qaFeedback}", edgeCases=[${t.output.edgeCasesIdentified.join(", ")}].`;
        } else if (t.expert === "DeepResearcher") {
          return `Deep Researcher: findings="${t.output.findings}".`;
        }
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }

  // Validate that a fact has at least 2 independent sources
  public validateSources(sources: string[]): boolean {
    const unique = new Set(sources.map((s) => s.trim().toLowerCase()));
    return unique.size >= 2;
  }

  // Call the mocked/stubbed LLM
  private async callLLM(expert: string, systemPrompt: string, userMessage: string, schema: any): Promise<any> {
    const response = await fetch(this.config.llmUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Expert": expert,
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: `${systemPrompt}\n\nContext:\n${userMessage}` }],
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM call failed with status ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error("Invalid response format from LLM");
    }

    const parsed = JSON.parse(text);
    return schema.parse(parsed);
  }

  // Main orchestration method
  public async execute(requestId: string, requestPayload: string): Promise<DiscussionLog> {
    const turns: DiscussionTurn[] = [];
    const factsIngested: FactToIngest[] = [];

    // Step 1: Query GraphRAG search to check for existing knowledge and detect gaps
    let hasKnowledgeGap = false;
    try {
      const searchRes = await fetch(this.config.graphRagSearchUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: requestPayload, top_k: 3 }),
      });
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        hasKnowledgeGap = !!searchData.hasKnowledgeGap;
      }
    } catch (e) {
      hasKnowledgeGap = true;
    }

    // Step 2: Run Self-Correction Loop for Architect and Security Auditor
    let architectApproved = false;
    let correctionAttempts = 0;
    const maxCorrectionAttempts = 3;

    let proposal = "";
    let lastSecurityFeedback = "Initial review";

    while (!architectApproved && correctionAttempts < maxCorrectionAttempts) {
      correctionAttempts++;

      // Compress context for the Architect turn
      const context = this.compressContext(turns);
      const architectPrompt = `You are the Lead Architect. Design a solution. Previous context summaries:\n${context}`;
      const architectInput = correctionAttempts === 1 
        ? requestPayload 
        : `Please revise the proposal. Feedback: ${lastSecurityFeedback}`;

      const architectOutput = await this.callLLM(
        "Architect",
        architectPrompt,
        architectInput,
        ArchitectOutputSchema
      );

      turns.push({
        expert: "Architect",
        input: architectInput,
        output: architectOutput,
        timestamp: new Date().toISOString(),
        compressedContext: context,
      });

      proposal = architectOutput.proposal;

      // Call Security Auditor
      const secContext = this.compressContext(turns);
      const securityPrompt = `You are the Security Auditor. Review the proposal for vulnerabilities. Previous context:\n${secContext}`;
      const securityOutput = await this.callLLM(
        "SecurityAuditor",
        securityPrompt,
        proposal,
        SecurityAuditorOutputSchema
      );

      turns.push({
        expert: "SecurityAuditor",
        input: proposal,
        output: securityOutput,
        timestamp: new Date().toISOString(),
        compressedContext: secContext,
      });

      if (securityOutput.approved) {
        architectApproved = true;
      } else {
        lastSecurityFeedback = securityOutput.securityFeedback;
      }
    }

    // Call QA Engineer if architect and security approved
    let finalStatus: "approved" | "rejected" = "rejected";
    if (architectApproved) {
      const qaContext = this.compressContext(turns);
      const qaPrompt = `You are the QA Engineer. Identify edge cases. Previous context:\n${qaContext}`;
      const qaOutput = await this.callLLM(
        "QAEngineer",
        qaPrompt,
        proposal,
        QAEngineerOutputSchema
      );

      turns.push({
        expert: "QAEngineer",
        input: proposal,
        output: qaOutput,
        timestamp: new Date().toISOString(),
        compressedContext: qaContext,
      });

      if (qaOutput.approved) {
        finalStatus = "approved";
      }
    }

    // Step 3: Trigger Deep Researcher if knowledge gap detected
    if (hasKnowledgeGap) {
      const researcherContext = this.compressContext(turns);
      const researcherPrompt = `You are the Deep Researcher. Look up facts. Previous context:\n${researcherContext}`;
      const researcherOutput = await this.callLLM(
        "DeepResearcher",
        researcherPrompt,
        requestPayload,
        DeepResearcherOutputSchema
      );

      turns.push({
        expert: "DeepResearcher",
        input: requestPayload,
        output: researcherOutput,
        timestamp: new Date().toISOString(),
        compressedContext: researcherContext,
      });

      // Filter facts: only ingest facts with >= 2 independent sources
      for (const fact of researcherOutput.factsToIngest) {
        if (this.validateSources(fact.sources)) {
          // Post to GraphRAG knowledge API
          try {
            await fetch(this.config.graphRagKnowledgeUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                title: `Ingested Fact: ${fact.fact.substring(0, 40)}`,
                content: fact.fact,
                category: "architecture",
                confidence_score: fact.confidence_score,
              }),
            });
            factsIngested.push(fact);
          } catch (e) {
            // Error handling ignored in mock or caught
          }
        }
      }
    }

    const log: DiscussionLog = {
      requestId,
      requestPayload,
      request: requestPayload,
      turns,
      steps: turns.map((t) => ({
        expert: t.expert,
        input: t.input,
        output: t.output,
        timestamp: t.timestamp,
        compressedContext: t.compressedContext,
      })),
      citations: factsIngested.flatMap((f) => f.sources) || [],
      finalStatus,
      factsIngested,
      createdAt: new Date().toISOString(),
    };

    // Write DISCUSSION_LOG.json
    writeFileSync(this.config.logPath, JSON.stringify(log, null, 2), "utf8");

    return log;
  }
}
export default RoundTableOrchestrator;
