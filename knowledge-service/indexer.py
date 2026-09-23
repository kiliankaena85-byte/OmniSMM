import os
import time
import hashlib
import json
import logging
from pathlib import Path
from typing import Set, Dict, List, Tuple
import uuid


from qdrant_client import QdrantClient
from qdrant_client.http import models as qmodels
from neo4j import GraphDatabase

from chunker import ASTCodeChunker, CodeChunk
from embeddings import get_embedder

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("graphrag-indexer")

class IncrementalIndexer:
    """
    Incremental indexer using AST chunking.
    Tracks SHA256 hashes of files to only index changes.
    """
    SUPPORTED_CODE = {'.py', '.js', '.ts', '.jsx', '.tsx', '.java', '.go', '.rs'}
    SUPPORTED_DOCS = {'.md', '.mdx', '.txt', '.yaml', '.yml'}
    IGNORE_DIRS = {
        'node_modules', '.git', '__pycache__', 'dist', 'build', 
        '.venv', 'venv', '.next', 'coverage', '.gemini', '.planning'
    }
    
    def __init__(
        self,
        qdrant_url: str = "http://localhost:6333",
        qdrant_api_key: str = None,
        neo4j_uri: str = "bolt://localhost:7687",
        neo4j_user: str = "neo4j",
        neo4j_password: str = "changeme",
        state_file: str = "/app/data/indexer_state.json"
    ):
        self.qdrant = QdrantClient(url=qdrant_url, api_key=qdrant_api_key)
        self.neo4j_driver = GraphDatabase.driver(
            neo4j_uri, auth=(neo4j_user, neo4j_password)
        )
        self.embedder = get_embedder()
        self.chunker = ASTCodeChunker(max_chunk_tokens=512)
        self.state_file = state_file
        self.file_hashes: Dict[str, str] = self._load_state()

    def close(self):
        try:
            self.neo4j_driver.close()
        except Exception:
            pass

    def _load_state(self) -> Dict[str, str]:
        if os.path.exists(self.state_file):
            try:
                with open(self.state_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception as e:
                logger.warning(f"Failed to load indexer state: {e}. Starting fresh.")
        return {}

    def _save_state(self):
        try:
            os.makedirs(os.path.dirname(self.state_file), exist_ok=True)
            with open(self.state_file, 'w', encoding='utf-8') as f:
                json.dump(self.file_hashes, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save indexer state: {e}")

    def _file_hash(self, path: str) -> str:
        h = hashlib.sha256()
        with open(path, 'rb') as f:
            while chunk := f.read(8192):
                h.update(chunk)
        return h.hexdigest()[:16]

    def _get_changed_files(self, root_paths: List[str]) -> Tuple[Set[str], Set[str], Set[str]]:
        current_files: Dict[str, str] = {}
        
        for rpath in root_paths:
            if not os.path.exists(rpath):
                continue
                
            for dirpath, dirnames, filenames in os.walk(rpath):
                # Filter ignore dirs in-place
                dirnames[:] = [d for d in dirnames if d not in self.IGNORE_DIRS]
                
                for filename in filenames:
                    filepath = os.path.join(dirpath, filename)
                    suffix = Path(filepath).suffix.lower()
                    
                    if suffix in self.SUPPORTED_CODE or suffix in self.SUPPORTED_DOCS:
                        try:
                            current_files[filepath] = self._file_hash(filepath)
                        except (OSError, PermissionError):
                            continue

        new_files = set()
        changed_files = set()
        deleted_files = set()
        
        for filepath, fhash in current_files.items():
            if filepath not in self.file_hashes:
                new_files.add(filepath)
            elif self.file_hashes[filepath] != fhash:
                changed_files.add(filepath)
                
        for filepath in self.file_hashes:
            if filepath not in current_files:
                deleted_files.add(filepath)
                
        return new_files, changed_files, deleted_files

    def index_file(self, filepath: str):
        suffix = Path(filepath).suffix.lower()
        
        try:
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
        except Exception as e:
            logger.error(f"Cannot read file {filepath}: {e}")
            return
            
        if not content.strip():
            return
            
        # Determine collection and strategy
        if suffix in self.SUPPORTED_CODE:
            collection = "codebase"
            chunks = self.chunker.chunk_file(filepath, content)
        else:
            collection = "domain_knowledge"
            chunks = self._chunk_document(filepath, content)
            
        if not chunks:
            return
            
        # 1. Delete old vector mappings
        self._delete_file_vectors(collection, filepath)
        
        # 2. Embed & Save to Qdrant
        texts = [c.contextualized_content for c in chunks]
        vectors = self.embedder.encode_batch(texts)
        
        points = []
        for chunk, vector in zip(chunks, vectors):
            points.append(qmodels.PointStruct(
                id=str(uuid.uuid5(uuid.NAMESPACE_DNS, chunk.id)),
                vector=vector.tolist(),

                payload={
                    "content": chunk.content,
                    "contextualized": chunk.contextualized_content,
                    "file_path": chunk.file_path,
                    "chunk_type": chunk.chunk_type,
                    "language": chunk.language,
                    "module_name": chunk.module_name,
                    "class_name": chunk.class_name,
                    "function_name": chunk.function_name,
                    "start_line": chunk.start_line,
                    "end_line": chunk.end_line,
                    "content_hash": chunk.content_hash,
                    "neo4j_node_id": chunk.id
                }
            ))
            
        self.qdrant.upsert(collection_name=collection, points=points)
        
        # 3. Create Node/Edge structure in Neo4j
        self._sync_neo4j_codebase(chunks, filepath)
        
        logger.info(f"Indexed file: {filepath} ({len(chunks)} chunks)")

    def _sync_neo4j_codebase(self, chunks: List[CodeChunk], filepath: str):
        """
        Creates nodes and hierarchy relations in Neo4j for a parsed file.
        """
        with self.neo4j_driver.session() as session:
            # First clean up old codebase nodes for this file
            session.run(
                "MATCH (n:CodeEntity {file_path: $filepath}) DETACH DELETE n",
                filepath=filepath
            )
            
            # Module node (file itself)
            module_id = filepath.replace("/", ".").replace("\\", ".")
            session.run(
                """
                MERGE (m:CodeEntity:module {id: $id})
                SET m.name = $name,
                    m.file_path = $filepath,
                    m.entity_type = 'module'
                """,
                id=module_id,
                name=os.path.basename(filepath),
                filepath=filepath
            )
            
            for chunk in chunks:
                if chunk.chunk_type == "class":
                    session.run(
                        """
                        MERGE (c:CodeEntity:class {id: $id})
                        SET c.name = $name,
                            c.file_path = $filepath,
                            c.entity_type = 'class',
                            c.start_line = $start,
                            c.end_line = $end
                        WITH c
                        MATCH (m:CodeEntity:module {id: $mod_id})
                        MERGE (c)-[:DEFINED_IN]->(m)
                        """,
                        id=chunk.id,
                        name=chunk.class_name,
                        filepath=filepath,
                        start=chunk.start_line,
                        end=chunk.end_line,
                        mod_id=module_id
                    )
                elif chunk.chunk_type == "function":
                    # Determine parent (module or class) with allowlist validation
                    parent_id = f"{filepath}::class::{chunk.class_name}" if chunk.class_name else module_id
                    safe_label = "class" if chunk.class_name else "module"
                    
                    if safe_label == "class":
                        session.run(
                            """
                            MERGE (f:CodeEntity:function {id: $id})
                            SET f.name = $name,
                                f.file_path = $filepath,
                                f.entity_type = 'function',
                                f.start_line = $start,
                                f.end_line = $end
                            WITH f
                            MATCH (p:CodeEntity:class {id: $parent_id})
                            MERGE (f)-[:DEFINED_IN]->(p)
                            """,
                            id=chunk.id,
                            name=chunk.function_name,
                            filepath=filepath,
                            start=chunk.start_line,
                            end=chunk.end_line,
                            parent_id=parent_id
                        )
                    else:
                        session.run(
                            """
                            MERGE (f:CodeEntity:function {id: $id})
                            SET f.name = $name,
                                f.file_path = $filepath,
                                f.entity_type = 'function',
                                f.start_line = $start,
                                f.end_line = $end
                            WITH f
                            MATCH (p:CodeEntity:module {id: $parent_id})
                            MERGE (f)-[:DEFINED_IN]->(p)
                            """,
                            id=chunk.id,
                            name=chunk.function_name,
                            filepath=filepath,
                            start=chunk.start_line,
                            end=chunk.end_line,
                            parent_id=parent_id
                        )

    def _delete_file_vectors(self, collection: str, filepath: str):
        try:
            self.qdrant.delete(
                collection_name=collection,
                points_selector=qmodels.Filter(
                    must=[qmodels.FieldCondition(
                        key="file_path",
                        match=qmodels.MatchValue(value=filepath)
                    )]
                )
            )
        except Exception as e:
            logger.warning(f"Could not delete vectors for {filepath} in collection {collection}: {e}")

    def _chunk_document(self, filepath: str, content: str) -> List[CodeChunk]:
        chunks = []
        sections = content.split('\n## ')
        current_line = 1
        
        for i, section in enumerate(sections):
            if not section.strip():
                continue
                
            if i == 0 and section.startswith('# '):
                title = section.split('\n')[0].strip('# ')
            elif i > 0:
                section = '## ' + section
                title = section.split('\n')[0].strip('# ')
            else:
                title = f"Section {i}"
                
            lines_count = len(section.splitlines())
            start_line = current_line
            end_line = current_line + lines_count - 1
            
            chunks.append(CodeChunk(
                id=f"{filepath}::section_{i}",
                content=section,
                contextualized_content=f"# Document: {filepath}\n# Section: {title}\n\n{section}",
                file_path=filepath,
                language="markdown",
                chunk_type="document_section",
                start_line=start_line,
                end_line=end_line,
                module_name=filepath,
                docstring=title,
                content_hash=hashlib.sha256(section.encode('utf-8', errors='ignore')).hexdigest()[:16]
            ))
            current_line += lines_count
            
        return chunks

    def run_incremental(self, watch_paths: List[str]):
        logger.info("Scanning files for changes...")
        new, changed, deleted = self._get_changed_files(watch_paths)
        
        if not new and not changed and not deleted:
            logger.info("No file changes detected.")
            return

        logger.info(f"Detected changes: {len(new)} new, {len(changed)} changed, {len(deleted)} deleted files.")
        
        # 1. Handle deleted files
        for filepath in deleted:
            try:
                self._delete_file_vectors("codebase", filepath)
                self._delete_file_vectors("domain_knowledge", filepath)
                # Clean up graph nodes
                with self.neo4j_driver.session() as session:
                    session.run("MATCH (n:CodeEntity {file_path: $fp}) DETACH DELETE n", fp=filepath)
                    session.run("MATCH (n {qdrant_id: $fp}) DETACH DELETE n", fp=filepath)
                del self.file_hashes[filepath]
                logger.info(f"Cleaned deleted file: {filepath}")
            except Exception as e:
                logger.error(f"Error deleting state for {filepath}: {e}")

        # 2. Index new and changed files
        for filepath in new | changed:
            try:
                self.index_file(filepath)
                self.file_hashes[filepath] = self._file_hash(filepath)
            except Exception as e:
                logger.error(f"Failed to index file {filepath}: {e}")

        self._save_state()
        logger.info("Sync complete. State saved.")

    def run_daemon(self, watch_paths: List[str], interval: int = 300):
        logger.info(f"Starting GraphRAG indexer daemon. Watch paths: {watch_paths}. Check interval: {interval}s")
        
        # Initial boot scan
        try:
            self.run_incremental(watch_paths)
        except Exception as e:
            logger.error(f"Initial scan failed: {e}")
            
        while True:
            time.sleep(interval)
            try:
                self.run_incremental(watch_paths)
            except Exception as e:
                logger.error(f"Indexing scan loop failed: {e}")

if __name__ == "__main__":
    q_url = os.getenv("QDRANT_URL", "http://localhost:6333")
    q_key = os.getenv("QDRANT_API_KEY")
    n_uri = os.getenv("NEO4J_URI", "bolt://localhost:7687")
    n_user = os.getenv("NEO4J_USER", "neo4j")
    n_pass = os.getenv("NEO4J_PASSWORD", "changeme")
    s_file = os.getenv("INDEXER_STATE_FILE", "/app/data/indexer_state.json")
    
    # Wait for service readiness
    time.sleep(10)
    
    indexer = IncrementalIndexer(
        qdrant_url=q_url,
        qdrant_api_key=q_key,
        neo4j_uri=n_uri,
        neo4j_user=n_user,
        neo4j_password=n_pass,
        state_file=s_file
    )
    
    w_paths = os.getenv("WATCH_PATHS", "/app/codebase,/app/docs").split(",")
    idx_interval = int(os.getenv("INDEX_INTERVAL", "300"))
    
    try:
        indexer.run_daemon(w_paths, idx_interval)
    finally:
        indexer.close()
