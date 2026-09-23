#!/usr/bin/env python3
"""
estimate_tokens.py
Lightweight token estimator for skill content and conversation history.
Uses character-based heuristics (±15% accuracy) with optional exact mode.
"""

import re
import sys
import json
import argparse
from pathlib import Path
from dataclasses import dataclass, asdict


# ── Content type classifier ───────────────────────────────────────────────────

@dataclass
class TokenEstimate:
    content_type: str
    char_count:   int
    token_estimate: int
    method:       str   # "heuristic" | "exact"


CHARS_PER_TOKEN: dict[str, float] = {
    "prose":    4.0,
    "code":     3.5,
    "json":     3.0,
    "yaml":     3.0,
    "markdown": 3.8,
    "mixed":    3.7,
}


def classify_content(text: str) -> str:
    """Heuristically classify content type for token ratio selection."""
    lines = text.splitlines()
    if not lines:
        return "prose"

    code_indicators   = sum(1 for l in lines if re.match(r"\s*(def |class |import |from |#|//|{|}|;)", l))
    json_indicators   = text.strip().startswith(("{", "["))
    yaml_indicators   = sum(1 for l in lines if re.match(r"^[a-z_]+\s*:", l))
    md_indicators     = sum(1 for l in lines if re.match(r"^#{1,6} |^\s*[-*] |\*\*|```", l))

    total = max(len(lines), 1)

    if json_indicators:
        return "json"
    if yaml_indicators / total > 0.3:
        return "yaml"
    if code_indicators / total > 0.3:
        return "code"
    if md_indicators / total > 0.2:
        return "markdown"
    return "prose"


def estimate_tokens_heuristic(text: str) -> TokenEstimate:
    content_type = classify_content(text)
    ratio        = CHARS_PER_TOKEN[content_type]
    char_count   = len(text)
    tokens       = int(char_count / ratio)
    return TokenEstimate(
        content_type=content_type,
        char_count=char_count,
        token_estimate=tokens,
        method="heuristic",
    )


def estimate_tokens_exact(text: str) -> TokenEstimate | None:
    """Try to use tiktoken for exact counts. Falls back to None if unavailable."""
    try:
        import tiktoken  # type: ignore
        enc    = tiktoken.get_encoding("cl100k_base")
        tokens = len(enc.encode(text))
        return TokenEstimate(
            content_type=classify_content(text),
            char_count=len(text),
            token_estimate=tokens,
            method="exact",
        )
    except ImportError:
        return None


def estimate(text: str, exact: bool = False) -> TokenEstimate:
    if exact:
        result = estimate_tokens_exact(text)
        if result:
            return result
    return estimate_tokens_heuristic(text)


# ── CLI ───────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Token Estimator")
    parser.add_argument("--stdin",   action="store_true", help="Read from stdin")
    parser.add_argument("--file",    help="Path to file to estimate")
    parser.add_argument("--exact",   action="store_true",
                        help="Use tiktoken for exact count (requires pip install tiktoken)")
    parser.add_argument("--json",    action="store_true", help="JSON output")
    args = parser.parse_args()

    if args.stdin:
        text = sys.stdin.read()
    elif args.file:
        text = Path(args.file).read_text(errors="replace")
    else:
        print("Error: provide --stdin or --file <path>", file=sys.stderr)
        sys.exit(1)

    result = estimate(text, exact=args.exact)

    if args.json:
        print(json.dumps(asdict(result), indent=2))
    else:
        print(f"Content type   : {result.content_type}")
        print(f"Characters     : {result.char_count:,}")
        print(f"Token estimate : {result.token_estimate:,}  [{result.method}]")


if __name__ == "__main__":
    main()
