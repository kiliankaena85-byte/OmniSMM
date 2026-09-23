import re
import sys

filepath = r"d:\SMM_plan_2\artifacts\smmplan_support_examples_library.md"

with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# Patterns of placeholders
patterns = [
    r"\[\s*\.\.\.\s*\]",          # [...]
    r"<\s*\.\.\.\s*>",            # <...>
    r"\{\s*\.\.\.\s*\}",          # {...}
    r"\(\s*\.\.\.\s*\)",          # (...)
    r"\[\s*TBD\s*\]",             # [TBD]
    r"\[\s*тбд\s*\]",             # [тбд]
    r"\[\s*placeholder\s*\]",     # [placeholder]
    r"\[\s*insert\s*\]",          # [insert]
    r"\[\s*имя\s*\]",             # [имя]
    r"\[\s*ссылка\s*\]",          # [ссылка]
    r"\[\s*дата\s*\]",            # [дата]
    r"\[\s*сумма\s*\]",           # [сумма]
    r"\[\s*номер\s*\]",           # [номер]
    r"\[\s*код\s*\]",             # [код]
    r"\[\s*промокод\s*\]",        # [промокод]
    r"\[\s*название\s*\]",        # [название]
    r"\[\s*аккаунт\s*\]",         # [аккаунт]
    r"\[\s*канал\s*\]",           # [канал]
    r"\[\s*клиент\s*\]",          # [клиент]
]

found_any = False

print("Scanning for placeholders...")
for pattern in patterns:
    matches = list(re.finditer(pattern, content, re.IGNORECASE))
    if matches:
        found_any = True
        print(f"Pattern '{pattern}' matched {len(matches)} times:")
        for m in matches:
            # Print surrounding context
            start = max(0, m.start() - 40)
            end = min(len(content), m.end() + 40)
            snippet = content[start:end].replace('\n', ' ')
            print(f"  Pos {m.start()}: ...{snippet}...")

# Check for generic bracketed placeholders that are not markdown links
# e.g., [Some text in Russian or English] where it's not [text](link) and not [text][ref] and not a table of contents item.
# We can find all [...] sequences and check if they are followed by ( or [ or if they are just stand-alone brackets.
# If they are stand-alone brackets, we inspect them.
bracket_matches = list(re.finditer(r"\[([^\]]+)\]", content))
standalone_brackets = []
for m in bracket_matches:
    start_pos = m.start()
    end_pos = m.end()
    # Check if followed by (
    if end_pos < len(content) and content[end_pos] == '(':
        continue
    # Check if followed by : (which means markdown reference link like [1]: http...)
    if end_pos < len(content) and content[end_pos] == ':':
        continue
    # Check if part of markdown checkbox like [ ] or [x]
    text = m.group(1).strip()
    if text in (' ', 'x', 'X', ''):
        continue
    
    # If not a link, let's look at the content. If it contains placeholders words:
    placeholder_words = ['имя', 'ссылка', 'дата', 'сумма', 'номер', 'код', 'промокод', 'название', 'аккаунт', 'канал', 'клиент', 'tbd', 'тбд', 'insert', 'enter', 'fill', 'yymmdd', 'yyyy']
    is_placeholder = any(w in text.lower() for w in placeholder_words)
    if is_placeholder:
        standalone_brackets.append((m.start(), m.group(0)))

if standalone_brackets:
    found_any = True
    print(f"\nFound {len(standalone_brackets)} suspicious standalone brackets:")
    for pos, text in standalone_brackets:
        start = max(0, pos - 40)
        end = min(len(content), pos + len(text) + 40)
        snippet = content[start:end].replace('\n', ' ')
        print(f"  Pos {pos}: ...{snippet}...")

if not found_any:
    print("SUCCESS: No placeholders found!")
    sys.exit(0)
else:
    print("FAILURE: Placeholders found!")
    sys.exit(1)
