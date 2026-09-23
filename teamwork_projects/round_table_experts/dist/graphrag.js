"use strict";
/**
 * GraphRAG client operations and context compression utility.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GraphRAGClient = void 0;
exports.search = search;
exports.ingest = ingest;
exports.compressContext = compressContext;
/**
 * Searches the GraphRAG knowledge base.
 * Sends a POST to http://localhost:8100/api/search.
 * Strict limits: Must pass top_k: 3.
 * Collections to query: ["architecture_decisions", "business_rules", "coding_conventions"].
 */
async function search(query) {
    const url = "http://localhost:8100/api/search";
    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            query,
            top_k: 3,
            collections: ["architecture_decisions", "business_rules", "coding_conventions"],
        }),
    });
    if (!response.ok) {
        throw new Error(`GraphRAG search failed: ${response.statusText}`);
    }
    return response.json();
}
/**
 * Ingests a verified fact into the GraphRAG knowledge base.
 * Performs multi-source validation: must verify the fact in 2+ independent sources.
 * Calculates confidence score based on the validation (e.g. scale 0.0 to 1.0).
 * Sends a POST to http://localhost:8100/api/knowledge.
 */
async function ingest(title, content, category, sources) {
    // Validate that we have at least 2 independent sources
    if (!sources || sources.length < 2) {
        throw new Error("Validation failed: must provide at least 2 sources.");
    }
    // Deduplicate and trim sources (case-insensitive)
    const uniqueSources = Array.from(new Set(sources.map((s) => s.trim().toLowerCase()).filter(Boolean)));
    if (uniqueSources.length < 2) {
        throw new Error("Validation failed: must verify the fact in at least 2 independent sources.");
    }
    // Calculate confidence score (scale 0.0 to 1.0 depending on count of unique sources)
    let confidence_score = 0.5;
    if (uniqueSources.length === 2) {
        confidence_score = 0.7;
    }
    else if (uniqueSources.length === 3) {
        confidence_score = 0.85;
    }
    else if (uniqueSources.length >= 4) {
        confidence_score = 1.0;
    }
    const url = "http://localhost:8100/api/knowledge";
    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            title,
            content,
            category,
            confidence_score,
        }),
    });
    if (!response.ok) {
        throw new Error(`GraphRAG ingest failed: ${response.statusText}`);
    }
    return response.json();
}
/**
 * Performs summary passing, conversational filtering, and enforces strict RAG limit.
 * Filters out system or greeting boilerplates and truncates or summarizes to fit maxLimit.
 */
function compressContext(messages, maxLimit) {
    const boilerplateRegex = /^(hello|hi|hey|greetings|system:|assistant:|user:|i'm a teamwork agent|what task can i help you with)/i;
    const filtered = messages
        .map((msg) => msg.trim())
        .filter((msg) => {
        if (!msg)
            return false;
        // Filter out boilerplate
        if (boilerplateRegex.test(msg))
            return false;
        return true;
    });
    // Summary passing: parse JSON where applicable or compress long text
    const summaries = filtered.map((msg) => {
        try {
            const parsed = JSON.parse(msg);
            if (parsed && typeof parsed === "object") {
                const parts = [];
                if (parsed.proposal)
                    parts.push(`Proposal: ${parsed.proposal}`);
                if (parsed.architectureSummary)
                    parts.push(`Summary: ${parsed.architectureSummary}`);
                if (parsed.vulnerabilities && Array.isArray(parsed.vulnerabilities)) {
                    parts.push(`Vulnerabilities: ${parsed.vulnerabilities.join(", ")}`);
                }
                if (parsed.securityFeedback)
                    parts.push(`Security: ${parsed.securityFeedback}`);
                if (parsed.qaFeedback)
                    parts.push(`QA: ${parsed.qaFeedback}`);
                if (parsed.findings)
                    parts.push(`Findings: ${parsed.findings}`);
                if (parts.length > 0) {
                    return parts.join(" | ");
                }
            }
        }
        catch (e) {
            // Not JSON, fall back to text compression
        }
        if (msg.length > 300) {
            return msg.substring(0, 150) + " ... [compressed] ... " + msg.substring(msg.length - 100);
        }
        return msg;
    });
    let result = summaries.join("\n");
    if (result.length > maxLimit) {
        result = result.substring(0, maxLimit);
    }
    return result;
}
/**
 * Client class wrapping the GraphRAG operations.
 */
class GraphRAGClient {
    static async search(query) {
        return search(query);
    }
    static async ingest(title, content, category, sources) {
        return ingest(title, content, category, sources);
    }
    static compressContext(messages, maxLimit) {
        return compressContext(messages, maxLimit);
    }
}
exports.GraphRAGClient = GraphRAGClient;
