import os
import json
import logging
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
import numpy as np

from qdrant_client import QdrantClient
from qdrant_client.http import models as qmodels
from neo4j import GraphDatabase

from embeddings import get_embedder

logger = logging.getLogger(__name__)

@dataclass
class GraphNode:
    id: str
    label: str
    name: str
    properties: Dict[str, Any] = field(default_factory=dict)

@dataclass
class GraphEdge:
    source_id: str
    target_id: str
    relation: str
    properties: Dict[str, Any] = field(default_factory=dict)

@dataclass
class GraphRAGResult:
    vector_chunks: List[Dict]
    graph_context: Dict
    graph_paths: List[str]
    assembled_context: str
    retrieval_method: str
    confidence: float

class GraphRAGEngine:
    """
    Main GraphRAG engine combining Qdrant (vectors) and Neo4j (relationships).
    """
    def __init__(
        self,
        qdrant_url: str = "http://localhost:6333",
        qdrant_api_key: str = None,
        neo4j_uri: str = "bolt://localhost:7687",
        neo4j_user: str = "neo4j",
        neo4j_password: str = "changeme",
        embedding_model: str = "all-MiniLM-L6-v2",
    ):
        self.qdrant = QdrantClient(url=qdrant_url, api_key=qdrant_api_key)
        self.neo4j_driver = GraphDatabase.driver(
            neo4j_uri, auth=(neo4j_user, neo4j_password)
        )
        self.embedder = get_embedder()
        
    def close(self):
        try:
            self.neo4j_driver.close()
        except Exception as e:
            logger.warning(f"Error closing Neo4j driver: {e}")

    # ============================================
    # INGESTION
    # ============================================

    def ingest_knowledge_entry(self, entry: Dict):
        """
        Ingests a knowledge entry into Qdrant & Neo4j using a shared ID.
        """
        import uuid
        entry_id = entry.get('id') or str(hash(entry['content']))
        point_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, entry_id))
        
        # 1. Embed text & save in Qdrant
        vector = self.embedder.encode(entry['content']).tolist()
        category = entry.get('category', 'knowledge')
        
        try:
            self.qdrant.upsert(
                collection_name=category,
                points=[qmodels.PointStruct(
                    id=point_id,
                    vector=vector,
                    payload={
                        'content': entry['content'],
                        'title': entry.get('title', ''),
                        'category': category,
                        'tags': entry.get('tags', []),
                        'neo4j_node_id': entry_id,
                    }
                )]
            )
        except Exception as e:
            logger.error(f"Failed to upsert to Qdrant: {e}")

        # 2. Add to Neo4j
        try:
            self._create_graph_node(entry_id, entry)
            self._create_graph_relations(entry_id, entry)
        except Exception as e:
            logger.error(f"Failed to ingest node/relationships in Neo4j: {e}")

    def _create_graph_node(self, entry_id: str, entry: Dict):
        category = entry.get('category', 'Knowledge')
        label_map = {
            'architecture_decisions': 'ADR',
            'business_rules': 'BusinessRule',
            'coding_conventions': 'Convention',
            'api_contracts': 'APIContract',
            'tech_debt': 'TechDebt',
            'domain_knowledge': 'DomainKnowledge',
            'codebase': 'CodeEntity',
            'decisions_log': 'Decision',
            'incidents': 'Incident',
        }
        label = label_map.get(category, 'Knowledge')
        
        with self.neo4j_driver.session() as session:
            session.run(
                f"""
                MERGE (n:{label} {{id: $id}})
                SET n.title = $title,
                    n.category = $category,
                    n.tags = $tags,
                    n.content_preview = $preview,
                    n.qdrant_id = $id
                """,
                id=entry_id,
                title=entry.get('title', ''),
                category=category,
                tags=entry.get('tags', []),
                preview=entry['content'][:500],
            )

    def _create_graph_relations(self, entry_id: str, entry: Dict):
        with self.neo4j_driver.session() as session:
            # Connect by sharing tags
            tags = entry.get('tags', [])
            for tag in tags:
                session.run(
                    """
                    MATCH (source {id: $source_id})
                    MATCH (target)
                    WHERE target.id <> $source_id
                      AND $tag IN target.tags
                    MERGE (source)-[:RELATES_TO {tag: $tag}]->(target)
                    """,
                    source_id=entry_id,
                    tag=tag,
                )
            
            # Explicit dependencies in metadata
            metadata = entry.get('metadata', {})
            if 'depends_on' in metadata:
                for dep in metadata['depends_on']:
                    session.run(
                        """
                        MATCH (source {id: $source_id})
                        MATCH (target)
                        WHERE target.title CONTAINS $dep
                           OR target.id = $dep
                        MERGE (source)-[:DEPENDS_ON]->(target)
                        """,
                        source_id=entry_id,
                        dep=dep,
                    )
            
            if 'supersedes' in metadata:
                session.run(
                    """
                    MATCH (source {id: $source_id})
                    MATCH (target {id: $superseded_id})
                    MERGE (source)-[:SUPERSEDES]->(target)
                    """,
                    source_id=entry_id,
                    superseded_id=metadata['supersedes'],
                )

    # ============================================
    # RETRIEVAL
    # ============================================

    def query(
        self,
        question: str,
        collections: List[str] = None,
        vector_top_k: int = 5,
        graph_depth: int = 2,
        strategy: str = "hybrid",
    ) -> GraphRAGResult:
        """
        Hybrid Vector + Graph query retrieval pipeline.
        """
        # Stage 1: Vector Search
        vector_results = []
        if strategy in ("vector_only", "hybrid"):
            vector_results = self._vector_search(question, collections, vector_top_k)
        
        # Stage 2: Graph Traversal
        graph_context = {"nodes": [], "edges": [], "paths": []}
        if strategy in ("graph_only", "hybrid"):
            seed_ids = [r['neo4j_node_id'] for r in vector_results if 'neo4j_node_id' in r]
            
            # Fallback keyword search
            keyword_nodes = self._graph_keyword_search(question)
            seed_ids.extend(keyword_nodes)
            
            if seed_ids:
                graph_context = self._graph_traverse(list(set(seed_ids)), depth=graph_depth)
        
        # Stage 3: Context Assembly
        assembled_context = self._assemble_context(question, vector_results, graph_context)
        
        return GraphRAGResult(
            vector_chunks=vector_results,
            graph_context=graph_context,
            graph_paths=graph_context.get("paths", []),
            assembled_context=assembled_context,
            retrieval_method=strategy,
            confidence=self._estimate_confidence(vector_results, graph_context),
        )

    def _vector_search(self, question: str, collections: List[str], top_k: int) -> List[Dict]:
        try:
            vector = self.embedder.encode(question).tolist()
        except Exception as e:
            logger.error(f"Failed to generate embeddings for query: {e}")
            return []
            
        if not collections:
            collections = [
                'architecture_decisions', 'coding_conventions',
                'business_rules', 'tech_debt', 'domain_knowledge',
                'codebase', 'decisions_log',
            ]
        
        all_results = []
        for collection in collections:
            try:
                # Check collection exists
                hits_response = self.qdrant.query_points(
                    collection_name=collection,
                    query=vector,
                    limit=top_k,
                    score_threshold=0.3,
                )
                for hit in hits_response.points:
                    all_results.append({
                        'content': hit.payload.get('content', ''),
                        'title': hit.payload.get('title', ''),
                        'category': collection,
                        'score': hit.score,
                        'neo4j_node_id': hit.payload.get('neo4j_node_id', str(hit.id)),
                        'tags': hit.payload.get('tags', []),
                    })
            except Exception as e:
                logger.warning(f"Vector search failed in collection '{collection}': {e}")
        
        all_results.sort(key=lambda r: r['score'], reverse=True)
        return all_results[:top_k]

    def _graph_keyword_search(self, question: str) -> List[str]:
        try:
            with self.neo4j_driver.session() as session:
                result = session.run(
                    """
                    CALL db.index.fulltext.queryNodes('knowledge_search', $search_term)
                    YIELD node, score
                    WHERE score > 0.4
                    RETURN node.id AS id
                    LIMIT 5
                    """,
                    search_term=question,
                )
                return [record['id'] for record in result]
        except Exception as e:
            logger.warning(f"Neo4j keyword search failed: {e}")
            return []

    def _graph_traverse(self, seed_ids: List[str], depth: int = 2) -> Dict:
        nodes = []
        edges = []
        paths = []
        
        try:
            with self.neo4j_driver.session() as session:
                for seed_id in seed_ids[:5]:
                    result = session.run(
                        """
                        MATCH path = (start {id: $seed_id})-[*1..$depth]-(connected)
                        RETURN 
                            start.id AS start_id,
                            start.title AS start_title,
                            labels(start) AS start_labels,
                            start.content_preview AS start_content,
                            connected.id AS connected_id,
                            connected.title AS connected_title,
                            labels(connected) AS connected_labels,
                            connected.content_preview AS connected_content,
                            [r IN relationships(path) | type(r)] AS rel_types,
                            length(path) AS path_length
                        LIMIT 15
                        """,
                        seed_id=seed_id,
                        depth=depth,
                    )
                    
                    for record in result:
                        nodes.append({
                            'id': record['connected_id'],
                            'title': record['connected_title'] or record['connected_id'],
                            'labels': record['connected_labels'],
                            'content': record['connected_content'],
                        })
                        
                        edges.append({
                            'from': record['start_id'],
                            'to': record['connected_id'],
                            'relations': record['rel_types'],
                            'depth': record['path_length'],
                        })
                        
                        paths.append(
                            f"'{record['start_title'] or record['start_id']}' "
                            f"-[{'/'.join(record['rel_types'])}]-> "
                            f"'{record['connected_title'] or record['connected_id']}'"
                        )
                
                # Check contradictions/superseded decisions
                contradictions = self._find_contradictions(session, seed_ids)
                if contradictions:
                    paths.extend([f"⚠️ CONTRADICTION: {c}" for c in contradictions])
        except Exception as e:
            logger.warning(f"Neo4j graph traversal failed: {e}")
            
        # Deduplicate nodes
        seen_ids = set()
        unique_nodes = []
        for node in nodes:
            if node['id'] not in seen_ids:
                seen_ids.add(node['id'])
                unique_nodes.append(node)
                
        return {
            "nodes": unique_nodes,
            "edges": edges,
            "paths": list(set(paths)),
        }

    def _find_contradictions(self, session, seed_ids: List[str]) -> List[str]:
        contradictions = []
        for seed_id in seed_ids[:5]:
            try:
                result = session.run(
                    """
                    MATCH (a {id: $seed_id})-[:SUPERSEDES]->(old)
                    RETURN a.title AS new_title, old.title AS old_title
                    """,
                    seed_id=seed_id,
                )
                for record in result:
                    contradictions.append(
                        f"'{record['new_title']}' supersedes "
                        f"'{record['old_title']}'"
                    )
            except Exception:
                pass
        return contradictions

    def _assemble_context(self, question: str, vector_results: List[Dict], graph_context: Dict) -> str:
        context_parts = []
        
        if vector_results:
            context_parts.append("## Directly Relevant Knowledge\n")
            for i, r in enumerate(vector_results[:5], 1):
                context_parts.append(
                    f"### [{i}] {r['title']} (relevance: {r['score']:.2f})\n"
                    f"{r['content']}\n"
                )
        
        graph_nodes = graph_context.get("nodes", [])
        if graph_nodes:
            vector_ids = {r['neo4j_node_id'] for r in vector_results}
            new_nodes = [n for n in graph_nodes if n['id'] not in vector_ids]
            
            if new_nodes:
                context_parts.append("\n## Related Knowledge (via graph connections)\n")
                for node in new_nodes[:5]:
                    context_parts.append(
                        f"### {node['title']} (labels: {', '.join(node['labels'])})\n"
                        f"{node.get('content') or 'No content available.'}\n"
                    )
        
        paths = graph_context.get("paths", [])
        if paths:
            context_parts.append("\n## Knowledge Connections\n")
            for path in paths[:10]:
                context_parts.append(f"- {path}\n")
                
        return "\n".join(context_parts)

    def _estimate_confidence(self, vector_results: List[Dict], graph_context: Dict) -> float:
        if not vector_results and not graph_context.get("nodes"):
            return 0.0
        vector_score = max((r['score'] for r in vector_results), default=0.0)
        graph_coverage = min(len(graph_context.get("nodes", [])) / 5, 1.0)
        return round(0.6 * vector_score + 0.4 * graph_coverage, 2)

    # ============================================
    # SPECIALIZED QUERIES
    # ============================================

    def trace_decision_chain(self, topic: str) -> Dict:
        try:
            with self.neo4j_driver.session() as session:
                result = session.run(
                    """
                    MATCH (adr:ADR)
                    WHERE toLower(adr.title) CONTAINS toLower($topic)
                       OR ANY(tag IN adr.tags WHERE toLower(tag) CONTAINS toLower($topic))
                    OPTIONAL MATCH chain = (adr)-[*1..2]-(related)
                    WHERE related:Convention OR related:TechDebt 
                       OR related:Decision OR related:BusinessRule
                    RETURN adr.title AS decision,
                           adr.content_preview AS content,
                           collect(DISTINCT {
                               title: related.title,
                               labels: labels(related),
                               relation: [r IN relationships(chain) | type(r)]
                           }) AS related_items
                    LIMIT 5
                    """,
                    topic=topic,
                )
                
                chains = []
                for record in result:
                    chains.append({
                        'decision': record['decision'],
                        'content': record['content'],
                        'related': record['related_items'],
                    })
                return {'topic': topic, 'decision_chains': chains}
        except Exception as e:
            logger.error(f"Error tracing decision chain: {e}")
            return {'topic': topic, 'error': str(e)}

    def find_impact_of_change(self, module_name: str) -> Dict:
        try:
            with self.neo4j_driver.session() as session:
                result = session.run(
                    """
                    MATCH (module:CodeEntity)
                    WHERE module.name CONTAINS $name
                       OR module.id CONTAINS $name
                    OPTIONAL MATCH (dependent)-[:CALLS|IMPORTS]->(module)
                    OPTIONAL MATCH (module)-[:RELATES_TO]-(knowledge)
                    WHERE knowledge:ADR OR knowledge:Convention OR knowledge:BusinessRule
                    OPTIONAL MATCH (debt:TechDebt)-[:AFFECTS]->(module)
                    RETURN module.id AS module_id,
                           module.name AS module_name,
                           collect(DISTINCT dependent.id) AS dependents,
                           collect(DISTINCT {
                               title: knowledge.title,
                               type: labels(knowledge)[0]
                           }) AS related_knowledge,
                           collect(DISTINCT debt.title) AS tech_debt
                    LIMIT 1
                    """,
                    name=module_name,
                )
                
                for record in result:
                    return {
                        'module_id': record['module_id'],
                        'module': record['module_name'],
                        'dependents': record['dependents'],
                        'related_knowledge': record['related_knowledge'],
                        'tech_debt': record['tech_debt'],
                    }
            return {'module': module_name, 'error': 'Not found'}
        except Exception as e:
            logger.error(f"Error finding impact: {e}")
            return {'module': module_name, 'error': str(e)}

    def get_full_context_for_task(self, task_description: str) -> str:
        result = self.query(
            question=task_description,
            strategy="hybrid",
            vector_top_k=5,
            graph_depth=2,
        )
        
        # Pull decision chains for keywords
        keywords = [
            w for w in task_description.lower().split()
            if len(w) > 4 and w not in ('should', 'create', 'verify', 'update', 'delete', 'integrate')
        ]
        
        decision_info = ""
        for kw in keywords[:3]:
            chain = self.trace_decision_chain(kw)
            if chain.get('decision_chains'):
                decision_info += f"\n### Decision chain for '{kw}':\n"
                for c in chain['decision_chains']:
                    decision_info += f"- {c['decision']}\n"
                    for r in c['related'][:3]:
                        labels = r.get('labels', ['Unknown'])
                        relation = r.get('relation', ['RELATED'])
                        decision_info += f"  → [{'/'.join(relation)}] {r['title']} ({'/'.join(labels)})\n"
                        
        full_context = result.assembled_context
        if decision_info:
            full_context += f"\n## Decision Chains\n{decision_info}"
            
        full_context += f"\n\n---\nConfidence Score: {result.confidence} | Method: {result.retrieval_method}"
        return full_context
