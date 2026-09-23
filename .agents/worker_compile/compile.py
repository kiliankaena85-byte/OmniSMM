import re
import os

draft_paths = [
    r"d:\SMM_plan_2\.agents\worker_cat1\cat1_draft.md",
    r"d:\SMM_plan_2\.agents\worker_cat2\cat2_draft.md",
    r"d:\SMM_plan_2\.agents\worker_cat3\cat3_draft.md",
    r"d:\SMM_plan_2\.agents\worker_cat4\cat4_draft.md",
    r"d:\SMM_plan_2\.agents\worker_cat5\cat5_draft.md"
]

target_path = r"d:\SMM_plan_2\artifacts\smmplan_support_examples_library.md"

# Let's define the categories and read their content
categories = []

for idx, path in enumerate(draft_paths, 1):
    if not os.path.exists(path):
        print(f"Error: path does not exist: {path}")
        continue
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    categories.append((idx, path, content))

print(f"Loaded {len(categories)} categories.")

# Let's inspect placeholders in each file
# Placeholder patterns: [...], <...>, [TBD], {placeholder}, etc.
placeholder_regex = re.compile(r'\[\s*\.\.\.\s*\]|<\s*\.\.\.\s*>|\[\s*TBD\s*\]|\{\s*placeholder\s*\}|\[\s*\]|<\s*>')

for idx, path, content in categories:
    matches = placeholder_regex.findall(content)
    if matches:
        print(f"WARNING: File {path} contains placeholders: {matches}")
    else:
        print(f"File {path} has no basic placeholders.")

# Let's parse cases from each file.
# Each case has format like '## Кейс X.Y' or '### Кейс X.Y'
# Let's split content by cases.
case_regex = re.compile(r'^(?:##|###)\s*(Кейс\s+\d+\.\d+[:\s].*?)(?=(?:^(?:##|###)\s*Кейс\s+\d+\.\d+[:\s])|\Z)', re.MULTILINE | re.DOTALL)

compiled_categories = []

for idx, path, content in categories:
    cases = case_regex.findall(content)
    print(f"Category {idx} ({os.path.basename(path)}): found {len(cases)} cases.")
    compiled_categories.append((idx, cases))

# Let's do a deep check on each case:
# 1. Normalize the case headers to '###' so they look consistent in the markdown document
# 2. Extract title of each case for TOC
# 3. Double check each case for placeholders.

all_cases = {}
toc = []

# Map index to category titles
cat_titles = {
    1: "Telegram (Накрутка, бусты, списания, гарантии)",
    2: "VK / Instagram / TikTok (Списания, лимиты, блокировки)",
    3: "Ошибки платежного шлюза (Задержки, возвраты, СБП, чарджбэки)",
    4: "Сложные претензии (Угрозы ФНС, Роскомнадзора, блокировки доменов)",
    5: "Юридический экстремизм (Судебные угрозы, вымогательство, шантаж)"
}

manual_content = []
manual_content.append("# Библиотека конфликтных кейсов службы поддержки Smmplan\n")
manual_content.append("## Введение\n")
manual_content.append("Настоящая библиотека содержит 50 детализированных сценариев разрешения конфликтных ситуаций с пользователями платформы Smmplan. Все кейсы разработаны на стыке правовой защиты сервиса (согласно законодательству РФ, условиям Публичной оферты и регламентам платежных систем) и маркетинговых инструментов удержания клиентов (компенсационные бонусы, промокоды, техническое консультирование). Сценарии разделены на 5 ключевых категорий, по 10 уникальных кейсов в каждой.\n")

# Build Table of Contents
manual_content.append("## Содержание\n")
for cat_num in range(1, 6):
    manual_content.append(f"- **[Категория {cat_num}: {cat_titles[cat_num]}](#категория-{cat_num})**")
    # We will populate the list of cases in the loop below
    cat_cases_list = []
    # Let's find the cases for this category
    for idx, cases in compiled_categories:
        if idx == cat_num:
            for case_text in cases:
                first_line = case_text.strip().split("\n")[0]
                # Clean up header formatting (e.g. 'Кейс 1.1: Title')
                title_match = re.search(r'Кейс\s+(\d+\.\d+)[:\s]*(.*)', first_line)
                if title_match:
                    case_num = title_match.group(1)
                    case_title = title_match.group(2).strip()
                    anchor = f"кейс-{case_num.replace('.', '')}"
                    manual_content.append(f"  - [{case_num}: {case_title}](#{anchor})")

manual_content.append("\n---\n")

for cat_num in range(1, 6):
    manual_content.append(f"## <a name=\"категория-{cat_num}\"></a>Категория {cat_num}: {cat_titles[cat_num]}\n")
    for idx, cases in compiled_categories:
        if idx == cat_num:
            for case_text in cases:
                lines = case_text.strip().split("\n")
                first_line = lines[0]
                body = "\n".join(lines[1:])
                
                title_match = re.search(r'Кейс\s+(\d+\.\d+)[:\s]*(.*)', first_line)
                if title_match:
                    case_num = title_match.group(1)
                    case_title = title_match.group(2).strip()
                    anchor = f"кейс-{case_num.replace('.', '')}"
                    
                    # We write heading with anchor and normalize to h3
                    manual_content.append(f"### <a name=\"{anchor}\"></a>Кейс {case_num}: {case_title}\n")
                    
                    # Normalize subheadings inside the body: Message, Legal Qualification, Response
                    # Ensure they use consistent markdown styles (e.g. bold or h4)
                    body_normalized = body
                    # Some files use '### Сообщение клиента (Message):'
                    # Let's replace '### Сообщение клиента ...' with '#### Сообщение клиента'
                    body_normalized = re.sub(r'###\s*(Сообщение клиента.*?):?', r'#### \1', body_normalized, flags=re.IGNORECASE)
                    body_normalized = re.sub(r'###\s*(Юридическая квалификация.*?):?', r'#### \1', body_normalized, flags=re.IGNORECASE)
                    body_normalized = re.sub(r'###\s*(Маркетингово-юридический ответ.*?):?', r'#### \1', body_normalized, flags=re.IGNORECASE)
                    body_normalized = re.sub(r'###\s*(Симбиоз-ответ.*?):?', r'#### \1', body_normalized, flags=re.IGNORECASE)
                    body_normalized = re.sub(r'###\s*(Шаблон ответа.*?):?', r'#### \1', body_normalized, flags=re.IGNORECASE)
                    
                    # Also replace '**Сообщение клиента:**' or similar formatting to keep it nice if needed
                    # Let's keep the markdown formatting clean
                    manual_content.append(body_normalized.strip() + "\n")
                    manual_content.append("---\n")

# Write to file
os.makedirs(os.path.dirname(target_path), exist_ok=True)
full_text = "\n".join(manual_content)

# Let's perform a final check on the generated text for placeholders
placeholder_matches = placeholder_regex.findall(full_text)
if placeholder_matches:
    print(f"ERROR: Target content has placeholders: {placeholder_matches}")
else:
    print("SUCCESS: Target content has zero basic placeholders.")

with open(target_path, "w", encoding="utf-8") as f:
    f.write(full_text)

print(f"Successfully compiled to {target_path}")
