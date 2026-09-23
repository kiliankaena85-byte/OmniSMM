import os
import hashlib
import re
from dataclasses import dataclass, field
from typing import List, Optional

try:
    from tree_sitter_languages import get_language, get_parser
except ImportError:
    get_language = None
    get_parser = None

@dataclass
class CodeChunk:
    id: str
    content: str
    contextualized_content: str
    file_path: str
    chunk_type: str  # "module", "class", "function", "document_section", "block"
    language: str
    start_line: int
    end_line: int
    content_hash: str
    module_name: str = ""
    class_name: str = ""
    function_name: str = ""
    imports: List[str] = field(default_factory=list)
    calls: List[str] = field(default_factory=list)
    docstring: str = ""

class ASTCodeChunker:
    """
    AST-based code chunker.
    Parses TS, TSX, JS, PY files using Tree-Sitter.
    """
    def __init__(self, max_chunk_tokens: int = 512):
        self.max_chunk_tokens = max_chunk_tokens

    def _get_hash(self, text: str) -> str:
        return hashlib.sha256(text.encode('utf-8', errors='ignore')).hexdigest()[:16]

    def chunk_file(self, filepath: str, content: str) -> List[CodeChunk]:
        suffix = os.path.splitext(filepath)[1].lower()
        if suffix == '.py':
            return self.chunk_python_file(filepath, content)
        elif suffix in ('.ts', '.tsx', '.js', '.jsx'):
            return self.chunk_ts_file(filepath, content)
        else:
            return self._fallback_chunk(filepath, content)

    def chunk_python_file(self, filepath: str, content: str) -> List[CodeChunk]:
        if not get_parser:
            return self._fallback_chunk(filepath, content)
        
        try:
            parser = get_parser("python")
            tree = parser.parse(bytes(content, "utf8"))
        except Exception:
            return self._fallback_chunk(filepath, content)
        
        chunks = []
        root = tree.root_node
        
        # Simple walk to extract functions & classes
        def walk(node, current_class=""):
            if node.type == "class_definition":
                name_node = node.child_by_field_name("name")
                class_name = name_node.text.decode("utf8") if name_node else "Unknown"
                
                # Extract chunk
                start_line = node.start_point[0] + 1
                end_line = node.end_point[0] + 1
                node_content = content.splitlines()[start_line-1:end_line]
                node_text = "\n".join(node_content)
                
                chunks.append(CodeChunk(
                    id=f"{filepath}::class::{class_name}",
                    content=node_text,
                    contextualized_content=f"# File: {filepath}\n# Class: {class_name}\n\n{node_text}",
                    file_path=filepath,
                    chunk_type="class",
                    language="python",
                    start_line=start_line,
                    end_line=end_line,
                    content_hash=self._get_hash(node_text),
                    class_name=class_name
                ))
                
                for child in node.children:
                    walk(child, class_name)
                    
            elif node.type in ("function_definition", "async_function_definition"):
                name_node = node.child_by_field_name("name")
                func_name = name_node.text.decode("utf8") if name_node else "Unknown"
                
                start_line = node.start_point[0] + 1
                end_line = node.end_point[0] + 1
                node_content = content.splitlines()[start_line-1:end_line]
                node_text = "\n".join(node_content)
                
                chunks.append(CodeChunk(
                    id=f"{filepath}::func::{current_class + '.' if current_class else ''}{func_name}",
                    content=node_text,
                    contextualized_content=f"# File: {filepath}\n# Function: {func_name}\n# Class: {current_class or 'None'}\n\n{node_text}",
                    file_path=filepath,
                    chunk_type="function",
                    language="python",
                    start_line=start_line,
                    end_line=end_line,
                    content_hash=self._get_hash(node_text),
                    class_name=current_class,
                    function_name=func_name
                ))
            else:
                for child in node.children:
                    walk(child, current_class)

        walk(root)
        
        # Add a module-level chunk if no chunks were extracted, or just as a summary
        if not chunks:
            return self._fallback_chunk(filepath, content)
            
        return chunks

    def chunk_ts_file(self, filepath: str, content: str) -> List[CodeChunk]:
        if not get_parser:
            return self._fallback_chunk(filepath, content)
        
        suffix = os.path.splitext(filepath)[1].lower()
        lang = "tsx" if suffix in (".tsx", ".jsx") else "typescript"
        
        try:
            parser = get_parser(lang)
            tree = parser.parse(bytes(content, "utf8"))
        except Exception:
            try:
                parser = get_parser("typescript")
                tree = parser.parse(bytes(content, "utf8"))
            except Exception:
                return self._fallback_chunk(filepath, content)
        
        chunks = []
        root = tree.root_node
        
        # Tree traversal to extract functions, classes, interfaces
        def walk(node, current_class=""):
            if node.type in ("class_declaration", "interface_declaration"):
                name_node = node.child_by_field_name("name")
                class_name = name_node.text.decode("utf8") if name_node else "Unknown"
                
                start_line = node.start_point[0] + 1
                end_line = node.end_point[0] + 1
                node_content = content.splitlines()[start_line-1:end_line]
                node_text = "\n".join(node_content)
                
                chunks.append(CodeChunk(
                    id=f"{filepath}::class::{class_name}",
                    content=node_text,
                    contextualized_content=f"// File: {filepath}\n// Class/Interface: {class_name}\n\n{node_text}",
                    file_path=filepath,
                    chunk_type="class",
                    language="typescript",
                    start_line=start_line,
                    end_line=end_line,
                    content_hash=self._get_hash(node_text),
                    class_name=class_name
                ))
                
                for child in node.children:
                    walk(child, class_name)
                    
            elif node.type in ("function_declaration", "arrow_function", "method_definition"):
                # Method definitions might not have a direct name child, arrow functions can be inside const declarator
                func_name = "anonymous"
                if node.type == "function_declaration":
                    name_node = node.child_by_field_name("name")
                    if name_node:
                        func_name = name_node.text.decode("utf8")
                elif node.type == "method_definition":
                    name_node = node.child_by_field_name("name")
                    if name_node:
                        func_name = name_node.text.decode("utf8")
                
                start_line = node.start_point[0] + 1
                end_line = node.end_point[0] + 1
                node_content = content.splitlines()[start_line-1:end_line]
                node_text = "\n".join(node_content)
                
                chunks.append(CodeChunk(
                    id=f"{filepath}::func::{current_class + '.' if current_class else ''}{func_name}::{start_line}",
                    content=node_text,
                    contextualized_content=f"// File: {filepath}\n// Function: {func_name}\n// Class: {current_class or 'None'}\n\n{node_text}",
                    file_path=filepath,
                    chunk_type="function",
                    language="typescript",
                    start_line=start_line,
                    end_line=end_line,
                    content_hash=self._get_hash(node_text),
                    class_name=current_class,
                    function_name=func_name
                ))
            else:
                for child in node.children:
                    walk(child, current_class)

        walk(root)
        
        if not chunks:
            return self._fallback_chunk(filepath, content)
            
        return chunks

    def _fallback_chunk(self, filepath: str, content: str) -> List[CodeChunk]:
        """
        Regex and line-based fallback chunker for other formats (markdown, json, yaml)
        or when AST parsing fails.
        """
        lines = content.splitlines()
        chunks = []
        chunk_size = 50  # lines
        overlap = 10     # lines
        
        i = 0
        while i < len(lines):
            end = min(i + chunk_size, len(lines))
            chunk_content = "\n".join(lines[i:end])
            
            chunks.append(CodeChunk(
                id=f"{filepath}::line::{i+1}",
                content=chunk_content,
                contextualized_content=f"# File: {filepath}\n# Lines: {i+1}-{end}\n\n{chunk_content}",
                file_path=filepath,
                chunk_type="block",
                language=os.path.splitext(filepath)[1].lstrip('.'),
                start_line=i+1,
                end_line=end,
                content_hash=self._get_hash(chunk_content),
            ))
            
            i += (chunk_size - overlap)
            if i >= len(lines) - overlap:
                break
                
        return chunks
