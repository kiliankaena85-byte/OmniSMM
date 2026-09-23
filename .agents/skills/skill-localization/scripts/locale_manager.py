#!/usr/bin/env python3
"""
locale_manager.py
Manages language and locale preferences for different agent generation scopes.
Stores configuration at the workspace level under .agent/config/locale_prefs.json.

Commands:
  init   — Create default configuration
  show   — Print current configuration (supports --json for parsing)
  set    — Update a specific scope's language

Scopes:
  - chat
  - code_comments
  - commit_messages
  - documentation
"""

import os
import sys
import json
import argparse
from pathlib import Path

# Premium Terminal Colors
COLOR_GREEN = "\033[92m"
COLOR_YELLOW = "\033[93m"
COLOR_CYAN = "\033[96m"
COLOR_RED = "\033[91m"
COLOR_BOLD = "\033[1m"
COLOR_RESET = "\033[0m"

def supports_color() -> bool:
    """Check if the current terminal supports color output."""
    plat = sys.platform
    supported_platform = plat != "win32" or "ANSICON" in os.environ or "WT_SESSION" in os.environ
    is_a_tty = hasattr(sys.stdout, "isatty") and sys.stdout.isatty()
    return supported_platform and is_a_tty

def colorize(text: str, color_code: str) -> str:
    if supports_color():
        return f"{color_code}{text}{COLOR_RESET}"
    return text

# Config stored at workspace level so it persists and can be committed to git if desired
CONFIG_DIR = ".agent/config"
CONFIG_FILE = "locale_prefs.json"

DEFAULT_CONFIG = {
    "chat": "auto",           # Respond in the user's language
    "code_comments": "en",    # English is standard for code
    "commit_messages": "en",  # Default English
    "documentation": "auto"   # Match project default or user prompt
}

VALID_SCOPES = list(DEFAULT_CONFIG.keys())

def get_config_path() -> Path:
    # Resolve workspace root by looking for .agent dir upwards, fallback to cwd
    workspace_root = Path.cwd()
    for parent in Path(__file__).resolve().parents:
        if (parent / ".agent").exists():
            workspace_root = parent
            break
            
    config_dir = workspace_root / CONFIG_DIR
    config_dir.mkdir(parents=True, exist_ok=True)
    return config_dir / CONFIG_FILE

def load_config() -> dict:
    path = get_config_path()
    if not path.exists():
        return DEFAULT_CONFIG.copy()
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
            # Merge with defaults to ensure all keys exist
            merged = DEFAULT_CONFIG.copy()
            merged.update(data)
            return merged
    except json.JSONDecodeError:
        print(colorize(f"⚠️ Warning: Corrupted config at {path}. Using defaults.", COLOR_YELLOW), file=sys.stderr)
        return DEFAULT_CONFIG.copy()

def save_config(config: dict) -> None:
    path = get_config_path()
    with open(path, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2)

def cmd_init(args: argparse.Namespace) -> int:
    path = get_config_path()
    if path.exists() and not args.force:
        print(colorize(f"❌ Configuration already exists at {path}. Use --force to overwrite.", COLOR_RED))
        return 1
        
    save_config(DEFAULT_CONFIG)
    print(colorize("✨ [locale_manager] Initialized default locale preferences:", COLOR_GREEN))
    print(json.dumps(DEFAULT_CONFIG, indent=2))
    return 0

def cmd_show(args: argparse.Namespace) -> int:
    config = load_config()
    if args.json:
        # Crucial: return raw JSON with no styling for clean machine readability
        print(json.dumps(config, indent=2))
    else:
        title = "🌐 Workspace Locale Preferences"
        print(colorize(f"\n{COLOR_BOLD}{title}{COLOR_RESET}", COLOR_CYAN))
        print(colorize("═" * 45, COLOR_CYAN))
        for scope, lang in config.items():
            formatted_scope = f"  {scope:<18}"
            formatted_lang = f"{lang:<8}"
            # Give en and auto clean colors
            if lang == "en":
                lang_color = COLOR_GREEN
            elif lang == "auto":
                lang_color = COLOR_YELLOW
            else:
                lang_color = COLOR_CYAN
            print(f"{formatted_scope} : {colorize(formatted_lang, lang_color)}")
        print(colorize("═" * 45, COLOR_CYAN))
        print(colorize("Note: 'auto' means matching user input or default project language.", COLOR_YELLOW))
    return 0

def cmd_set(args: argparse.Namespace) -> int:
    config = load_config()
    
    if args.scope not in VALID_SCOPES:
        print(colorize(f"❌ Error: Invalid scope '{args.scope}'. Valid scopes: {', '.join(VALID_SCOPES)}", COLOR_RED), file=sys.stderr)
        return 2

    lang_val = args.lang.lower()
    config[args.scope] = lang_val
    save_config(config)
    
    success_msg = f"✨ [locale_manager] Updated preferences: '{args.scope}' is now set to '{lang_val}'."
    print(colorize(success_msg, COLOR_GREEN))
    return 0

def main():
    parser = argparse.ArgumentParser(description="Agent Locale & Language Manager")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # init
    p_init = subparsers.add_parser("init", help="Initialize default configuration")
    p_init.add_argument("--force", action="store_true", help="Overwrite existing config")

    # show
    p_show = subparsers.add_parser("show", help="Show current preferences")
    p_show.add_argument("--json", action="store_true", help="Output raw JSON")

    # set
    p_set = subparsers.add_parser("set", help="Set language for a specific scope")
    p_set.add_argument("--scope", choices=VALID_SCOPES, required=True, help="Artifact scope to update")
    p_set.add_argument("--lang", required=True, help="Language code or name (e.g., 'es', 'fr', 'en', 'auto')")

    args = parser.parse_args()

    try:
        if args.command == "init":
            sys.exit(cmd_init(args))
        elif args.command == "show":
            sys.exit(cmd_show(args))
        elif args.command == "set":
            sys.exit(cmd_set(args))
    except Exception as e:
        print(colorize(f"locale_manager ⚠️ Unexpected error: {e}", COLOR_RED), file=sys.stderr)
        sys.exit(2)

if __name__ == "__main__":
    main()
