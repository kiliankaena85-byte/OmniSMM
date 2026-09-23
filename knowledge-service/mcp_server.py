import os
import hmac
import logging
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, HTTPException, Body, Security, Depends
from fastapi.security import APIKeyHeader
from pydantic import BaseModel, Field
from contextlib import asynccontextmanager

from engine import GraphRAGEngine
from schema import init_neo4j_schema

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("graphrag-mcp")

engine: Optional[GraphRAGEngine] = None

# Optional API Key guard for Write endpoints
api_key_header = APIKeyHeader(name="X-Knowledge-API-Key", auto_error=False)

def verify_knowledge_api_key(api_key: Optional[str] = Security(api_key_header)):
    expected = os.getenv("KNOWLEDGE_API_KEY")
    if not expected:
        if os.getenv("KNOWLEDGE_ENV") == "production" or os.getenv("NODE_ENV") == "production":
            raise HTTPException(status_code=500, detail="KNOWLEDGE_API_KEY not configured in production")
        return True
    if not api_key or not hmac.compare_digest(api_key.encode(), expected.encode()):
        raise HTTPException(status_code=403, detail="Forbidden: Invalid or missing X-Knowledge-API-Key")
    return True


# List of all knowledge base collections
KNOWLEDGE_COLLECTIONS = [
    'architecture_decisions',
    'coding_conventions',
    'business_rules',
    'tech_debt',
    'domain_knowledge',
    'codebase',
    'decisions_log',
    'incidents'
]

@asynccontextmanager
async def lifespan(app: FastAPI):
    global engine
    logger.info("Starting up GraphRAG MCP Server...")
    
    qdrant_url = os.getenv("QDRANT_URL", "http://localhost:6333")
    qdrant_api_key = os.getenv("QDRANT_API_KEY")
    neo4j_uri = os.getenv("NEO4J_URI", "bolt://localhost:7687")
    neo4j_user = os.getenv("NEO4J_USER", "neo4j")
    neo4j_password = os.getenv("NEO4J_PASSWORD", "changeme")
    
    # Initialize Engine
    engine = GraphRAGEngine(
        qdrant_url=qdrant_url,
        qdrant_api_key=qdrant_api_key,
        neo4j_uri=neo4j_uri,
        neo4j_user=neo4j_user,
        neo4j_password=neo4j_password
    )
    
    # 1. Bootstrap Neo4j Schema
    try:
        init_neo4j_schema(engine.neo4j_driver)
    except Exception as e:
        logger.error(f"Failed to bootstrap Neo4j: {e}")
        
        # 2. Bootstrap Qdrant Collections
    try:
        # Get embedder dimension
        dim = getattr(engine.embedder, "dimension", 384)
        from qdrant_client.http.models import (
            Distance, VectorParams, ScalarQuantization,
            ScalarQuantizationConfig, ScalarType, PayloadSchemaType
        )
        
        quant_config = ScalarQuantization(
            scalar=ScalarQuantizationConfig(
                type=ScalarType.INT8,
                always_ram=True
            )
        )
        
        for collection in KNOWLEDGE_COLLECTIONS:
            # Check if exists
            try:
                exists = engine.qdrant.collection_exists(collection_name=collection)
                if not exists:
                    logger.info(f"Creating Qdrant collection: {collection} (dim: {dim}) with INT8 quantization")
                    engine.qdrant.create_collection(
                        collection_name=collection,
                        vectors_config=VectorParams(size=dim, distance=Distance.COSINE),
                        quantization_config=quant_config
                    )
                else:
                    # Update quantization config on existing collection
                    logger.info(f"Updating quantization parameters for collection: {collection}")
                    engine.qdrant.update_collection(
                        collection_name=collection,
                        quantization_config=quant_config
                    )
            except Exception as e:
                # Fallback check/creation
                try:
                    engine.qdrant.get_collection(collection_name=collection)
                    engine.qdrant.update_collection(
                        collection_name=collection,
                        quantization_config=quant_config
                    )
                except Exception:
                    logger.info(f"Creating Qdrant collection (fallback): {collection} (dim: {dim}) with INT8 quantization")
                    engine.qdrant.create_collection(
                        collection_name=collection,
                        vectors_config=VectorParams(size=dim, distance=Distance.COSINE),
                        quantization_config=quant_config
                    )
            
            # Create payload indexes for category and tags
            try:
                engine.qdrant.create_payload_index(
                    collection_name=collection,
                    field_name="category",
                    field_schema=PayloadSchemaType.KEYWORD
                )
                engine.qdrant.create_payload_index(
                    collection_name=collection,
                    field_name="tags",
                    field_schema=PayloadSchemaType.KEYWORD
                )
            except Exception as pe:
                logger.warning(f"Could not create payload index for collection '{collection}': {pe}")
    except Exception as e:
        logger.error(f"Failed to bootstrap Qdrant collections: {e}")
        
    yield
    
    if engine:
        engine.close()
    logger.info("Shutdown GraphRAG MCP Server.")

app = FastAPI(title="GraphRAG MCP Server", lifespan=lifespan)

# Pydantic Schemas
class SearchRequest(BaseModel):
    query: str
    collections: Optional[List[str]] = None
    top_k: int = 5

class KnowledgeEntry(BaseModel):
    content: str
    category: str = Field(..., description="E.g., coding_conventions, architecture_decisions")
    title: str
    tags: List[str] = []
    metadata: Dict[str, Any] = {}

class DecisionLog(BaseModel):
    decision: str
    rationale: str
    alternatives: List[str] = []
    context: str = ""
    tags: List[str] = ["decision"]

# ============================================
# MCP Endpoint (JSON-RPC tool router)
# ============================================

@app.post("/mcp/tools/call")
def mcp_tool_call(payload: Dict[str, Any] = Body(...)):
    """
    Main Model Context Protocol Endpoint routing calls to appropriate query actions.
    """
    name = payload.get("name")
    args = payload.get("arguments", {})
    
    logger.info(f"MCP Call received: '{name}' with args: {args}")
    
    if not engine:
        return {"content": [{"type": "text", "text": "Engine is not initialized."}], "isError": True}
        
    try:
        if name == "search_knowledge":
            query = args.get("query")
            collections = args.get("collections")
            top_k = args.get("top_k", 5)
            res = engine.query(question=query, collections=collections, vector_top_k=top_k, strategy="hybrid")
            return {"content": [{"type": "text", "text": res.assembled_context}]}
            
        elif name == "search_code":
            query = args.get("query")
            top_k = args.get("top_k", 5)
            res = engine.query(question=query, collections=["codebase"], vector_top_k=top_k, strategy="vector_only")
            return {"content": [{"type": "text", "text": res.assembled_context}]}
            
        elif name == "get_full_context":
            task = args.get("task")
            res = engine.get_full_context_for_task(task)
            return {"content": [{"type": "text", "text": res}]}
            
        elif name == "trace_decisions":
            topic = args.get("topic")
            chain = engine.trace_decision_chain(topic)
            output = f"## Decision Chain for topic: '{topic}'\n\n"
            for c in chain.get('decision_chains', []):
                output += f"### {c['decision']}\n{c['content']}\n"
                for r in c['related']:
                    output += f"  → [{r.get('relation')}] {r.get('title')} ({r.get('labels')})\n"
            if not chain.get('decision_chains'):
                output += "No decisions found."
            return {"content": [{"type": "text", "text": output}]}
            
        elif name == "find_impact":
            module = args.get("module")
            impact = engine.find_impact_of_change(module)
            output = f"## Impact Analysis: '{module}'\n\n"
            output += f"### Dependents ({len(impact.get('dependents', []))} modules):\n"
            for d in impact.get('dependents', []):
                output += f"- {d}\n"
            output += f"\n### Related Knowledge:\n"
            for k in impact.get('related_knowledge', []):
                output += f"- [{k.get('type')}] {k.get('title')}\n"
            if impact.get('tech_debt'):
                output += f"\n### Known Tech Debt:\n"
                for td in impact['tech_debt']:
                    output += f"- {td}\n"
            return {"content": [{"type": "text", "text": output}]}
            
        elif name == "add_knowledge":
            content = args.get("content")
            category = args.get("category")
            title = args.get("title")
            tags = args.get("tags", [])
            metadata = args.get("metadata", {})
            engine.ingest_knowledge_entry({
                "content": content,
                "category": category,
                "title": title,
                "tags": tags,
                "metadata": metadata
            })
            return {"content": [{"type": "text", "text": f"✅ Knowledge saved successfully: '{title}'"}]}
            
        elif name == "log_decision":
            decision = args.get("decision")
            rationale = args.get("rationale")
            alternatives = args.get("alternatives", [])
            context = args.get("context", "")
            tags = args.get("tags", ["decision"])
            
            content = f"## Decision: {decision}\n\n### Rationale\n{rationale}\n\n### Alternatives\n"
            content += "\n".join(f"- {alt}" for alt in alternatives) if alternatives else "- None"
            content += f"\n\n### Context\n{context or 'Not specified'}"
            
            engine.ingest_knowledge_entry({
                "content": content,
                "category": "decisions_log",
                "title": f"Decision: {decision}",
                "tags": tags,
                "metadata": {"alternatives": alternatives, "context": context}
            })
            return {"content": [{"type": "text", "text": f"✅ Decision logged: '{decision}'"}]}
            
        else:
            return {"content": [{"type": "text", "text": f"Unknown tool name: {name}"}], "isError": True}
            
    except Exception as e:
        logger.error(f"Error handling tool call '{name}': {e}")
        return {"content": [{"type": "text", "text": f"Error executing tool: {str(e)}"}], "isError": True}

# ============================================
# REST API (Debugging endpoints)
# ============================================

@app.post("/api/search")
def api_search(request: SearchRequest):
    if not engine:
        raise HTTPException(status_code=500, detail="Engine not initialized")
    return engine.query(question=request.query, collections=request.collections, vector_top_k=request.top_k)

@app.post("/api/knowledge")
def api_add_knowledge(entry: KnowledgeEntry, _: bool = Depends(verify_knowledge_api_key)):
    if not engine:
        raise HTTPException(status_code=500, detail="Engine not initialized")
    engine.ingest_knowledge_entry(entry.model_dump())
    return {"status": "created", "title": entry.title}

@app.post("/api/decision")
def api_log_decision(log: DecisionLog, _: bool = Depends(verify_knowledge_api_key)):
    if not engine:
        raise HTTPException(status_code=500, detail="Engine not initialized")
    
    content = f"## Decision: {log.decision}\n\n### Rationale\n{log.rationale}\n\n### Alternatives\n"
    content += "\n".join(f"- {alt}" for alt in log.alternatives) if log.alternatives else "- None"
    content += f"\n\n### Context\n{log.context or 'Not specified'}"
    
    engine.ingest_knowledge_entry({
        "content": content,
        "category": "decisions_log",
        "title": f"Decision: {log.decision}",
        "tags": log.tags,
        "metadata": {"alternatives": log.alternatives, "context": log.context}
    })
    return {"status": "logged", "decision": log.decision}

@app.get("/api/stats")
async def api_stats():
    if not engine:
        raise HTTPException(status_code=500, detail="Engine not initialized")
    stats = {}
    for collection in KNOWLEDGE_COLLECTIONS:
        try:
            info = engine.qdrant.get_collection(collection_name=collection)
            stats[collection] = {
                "points_count": info.points_count,
                "status": info.status.value if hasattr(info.status, "value") else str(info.status)
            }
        except Exception as e:
            stats[collection] = {"status": "error", "message": str(e)}
    return stats

@app.get("/health")
async def health():
    if not engine:
        raise HTTPException(status_code=500, detail="Engine offline")
    try:
        engine.qdrant.get_collections()
        neo4j_status = "disabled"
        if os.getenv("NEO4J_ENABLED", "false").lower() == "true":
            try:
                with engine.neo4j_driver.session() as session:
                    session.run("RETURN 1")
                neo4j_status = "healthy"
            except Exception as e:
                neo4j_status = f"unhealthy: {e}"
        return {"status": "healthy", "qdrant": "healthy", "neo4j": neo4j_status}
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Service unhealthy: {e}")

@app.get("/status")
async def status():
    if not engine:
        raise HTTPException(status_code=500, detail="Engine offline")
    try:
        cols = engine.qdrant.get_collections()
        return {
            "status": "online",
            "profile": "8GB_DDR3_LOW_MEMORY",
            "qdrant": "connected",
            "collections_count": len(cols.collections) if cols else 0,
            "embedder": "all-MiniLM-L6-v2",
            "max_memory_limit": "1.28GB"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Status check failed: {e}")
