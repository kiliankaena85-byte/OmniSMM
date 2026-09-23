---
name: skill-localization
version: 1.0.0
description: |
  Enforces locale and language preferences for agent-generated artifacts.
  Manages language rules for code comments, commit messages, pull request
  descriptions, and documentation. Use when generating text artifacts,
  activate before writing code comments, and trigger when the user asks to 
  configure the agent's default language settings.
---

# Skill Localization 🌐

In global and regional teams, language requirements vary by context. A team 
might require all code comments and variables to be strictly in English, 
but mandate that Pull Request descriptions, user-facing documentation, and 
commit messages be written in the local team's language (e.g., Spanish, 
Japanese, Russian).

Without this skill, the agent either defaults entirely to English, or 
blindly matches the language of the user's prompt (which might lead to 
accidental Russian code comments). This skill acts as a **language router**.

## When to activate

Activate **silently and automatically** before generating any of the following:

- `git commit` messages
- Code comments and docstrings
- Markdown documentation (READMEs, Wikis)
- Pull Request descriptions
- Direct chat responses (if the user asks to change the agent's language)

## Step-by-step execution protocol

### Step 1 — Check Active Locale Preferences

Before writing prose or code comments, retrieve the workspace's locale 
configuration:

```bash
python {{SKILL_PATH}}/scripts/locale_manager.py show --json
```

This will return a JSON object detailing the target language for various 
scopes, for example:
```json
{
  "chat": "auto",
  "code_comments": "en",
  "commit_messages": "es",
  "documentation": "es"
}
```

### Step 2 — Apply Language Constraints

Once you know the configuration, apply it strictly to your output:

| Scope | Rule |
|---|---|
| **code_comments** | Translate your thoughts into the target language before writing `//` or `#`. Keep variable names, function names, and technical terms in standard English unless explicitly told otherwise. |
| **commit_messages** | Generate the commit subject and body in the target language. Follow conventional commits (`feat:`, `fix:`) in English, but write the description in the target language (e.g., `feat: añadir autenticación de usuarios`). |
| **documentation** | Write all markdown prose in the target language. Ensure technical terms (e.g., "Kubernetes", "API", "JSON") are handled naturally in that language. |
| **chat** | If set to `auto`, respond in the language the user is currently typing in. Otherwise, force responses to the target language. |

### Step 3 — Handling Missing Configuration

If `locale_manager.py` reports that the configuration is missing or uninitialized, 
assume the following Enterprise Safe Defaults:
- **code_comments**: `en` (English)
- **commit_messages**: `en` (English)
- **documentation**: `en` (English)
- **chat**: `auto` (Match user prompt)

If the user complains about the language, offer to initialize their preferences:
```bash
python {{SKILL_PATH}}/scripts/locale_manager.py init
```

### Step 4 — Modifying Preferences

If the user says "From now on, write commit messages in French", update the config:

```bash
python {{SKILL_PATH}}/scripts/locale_manager.py set --scope commit_messages --lang fr
```

## Scope boundaries

When generating code or technical artifacts in a non-English language, you 
**MUST NOT** translate:

1. **Programming keywords:** `if`, `while`, `function`, `class`
2. **Variable/Function names:** `getUser()`, `auth_token` (unless the team explicitly uses non-English code symbols, which is rare).
3. **CLI commands:** `git push`, `npm install`
4. **Standard Library modules:** `import os`, `java.util.*`

*Bad Example (Translating code):*
```javascript
// ❌ INCORRECT:
función obtenerUsuario(identificador) { ... }
```

*Good Example (Translating comments only):*
```javascript
// ✅ CORRECT (Assuming code_comments: es):
// Obtiene el usuario de la base de datos por su ID
function getUser(id) { ... }
```

## Error handling

If the `locale_manager.py` script fails due to permission errors or environment constraints:
1. Fall back gracefully to the "Enterprise Safe Defaults" (English for comments/commits/docs, Auto for chat).
2. Do not fail or crash the active developer task; output a brief diagnostic warning in stdout/stderr to alert the developer.
3. Fallback configuration structure:
   - **chat**: `auto`
   - **code_comments**: `en`
   - **commit_messages**: `en`
   - **documentation**: `en`

## References
- `{{SKILL_PATH}}/scripts/locale_manager.py` — The CLI tool to get/set language preferences.
- Configuration is stored locally in `.agent/config/locale_prefs.json`.
