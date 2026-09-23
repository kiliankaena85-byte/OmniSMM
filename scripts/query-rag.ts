import fs from 'fs';

async function main() {
  const query = process.argv[2];
  if (!query) {
    console.error("Usage: npx tsx scripts/query-rag.ts \"<your question>\"");
    process.exit(1);
  }

  try {
    console.log(`🔍 Querying GraphRAG for: "${query}"...`);
    const res = await fetch("http://127.0.0.1:8100/api/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        query,
        top_k: 5
      })
    });
    
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status} - ${await res.text()}`);
    }
    
    const data = await res.json();
    console.log("\n================ GRAPH RAG CONTEXT ================\n");
    if (data.assembled_context) {
      console.log(data.assembled_context);
    } else {
      console.log(JSON.stringify(data, null, 2));
    }
    console.log("\n===================================================\n");
  } catch (e) {
    console.error("Failed to query GraphRAG API:", e);
    console.log("Hint: Make sure the GraphRAG containers are running (docker-compose -f docker-compose.graphrag.yml up -d)");
  }
}

main();
