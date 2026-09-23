import { parseArgs } from "util";

// PII Scrubber to comply with 152-FZ
function scrubPII(text: string): string {
  if (!text) return text;
  // Redact Emails
  let scrubbed = text.replace(/[\w.-]+@[\w.-]+\.\w+/g, "[REDACTED_EMAIL]");
  // Redact Russian/CIS Phone Numbers (+7/8...)
  scrubbed = scrubbed.replace(/(?:\+7|8)[\s\-]?\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}/g, "[REDACTED_PHONE]");
  return scrubbed;
}

async function main() {
  const { values } = parseArgs({
    options: {
      ingest: { type: "boolean" },
      deprecate: { type: "boolean" },
      title: { type: "string" },
      category: { type: "string" },
      content: { type: "string" },
      id: { type: "string" },
    },
    allowPositionals: true,
  });

  const apiKey = process.env.GRAPHRAG_SECRET;
  if (!apiKey) {
    console.error("❌ CRITICAL ERROR: GRAPHRAG_SECRET environment variable is missing.");
    console.error("Access to Vector Memory denied to prevent Data Poisoning.");
    process.exit(1);
  }

  const headers = {
    "Content-Type": "application/json",
    "X-GraphRAG-API-Key": apiKey,
  };

  if (values.ingest) {
    if (!values.title || !values.category || !values.content) {
      console.error("Usage: tsx graphrag-agent-client.ts --ingest --title <title> --category <category> --content <content>");
      process.exit(1);
    }

    try {
      // Scrub PII before saving to GraphRAG
      const safeContent = scrubPII(values.content as string);
      const safeTitle = scrubPII(values.title as string);

      const response = await fetch("http://localhost:8100/api/knowledge", {
        method: "POST",
        headers,
        body: JSON.stringify({
          title: safeTitle,
          category: values.category,
          content: safeContent,
          confidence_score: 1.0, // Pre-verified by Deep Researcher
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to ingest fact: ${response.statusText}`);
      }
      const data = await response.json();
      console.log(`✅ Fact ingested successfully. ID: ${data.id || 'unknown'}`);
    } catch (error) {
      console.error(`❌ Ingestion error:`, error);
      process.exit(1);
    }
  } else if (values.deprecate) {
    if (!values.id) {
      console.error("Usage: tsx graphrag-agent-client.ts --deprecate --id <id>");
      process.exit(1);
    }

    try {
      const response = await fetch(`http://localhost:8100/api/knowledge/${values.id}`, {
        method: "DELETE",
        headers,
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
           throw new Error("Unauthorized: Invalid GRAPHRAG_SECRET.");
        }
        throw new Error(`Failed to deprecate fact: ${response.statusText}`);
      }
      console.log(`✅ Fact ${values.id} deprecated successfully.`);
    } catch (error) {
      console.error(`❌ Deprecation error:`, error);
      process.exit(1);
    }
  } else {
    console.log("GraphRAG Agent Client");
    console.log("Usage:");
    console.log("  --ingest --title <title> --category <cat> --content <data>");
    console.log("  --deprecate --id <id>");
  }
}

main();
