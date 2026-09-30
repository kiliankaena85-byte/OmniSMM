# Loop State Schema: `.stitch/workspace.json`

The autonomous Stitch loop tracks application progress using a strict JSON manifest located at `.stitch/workspace.json`.

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "StitchLoopWorkspace",
  "type": "object",
  "required": ["projectId", "brand", "designDna", "screens", "status"],
  "properties": {
    "projectId": { "type": "string" },
    "brand": { "type": "string", "enum": ["smmflux", "smmplan"] },
    "designDna": { "type": "string" },
    "viewport": { "type": "string", "enum": ["desktop", "mobile", "tablet"] },
    "status": { "type": "string", "enum": ["INITIALIZING", "IN_PROGRESS", "COMPLETED", "FAILED"] },
    "activeScreenIndex": { "type": "integer" },
    "maxIterations": { "type": "integer", "default": 8 },
    "screens": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "route", "title", "status"],
        "properties": {
          "id": { "type": "string" },
          "route": { "type": "string" },
          "title": { "type": "string" },
          "status": { "type": "string", "enum": ["PENDING", "GENERATING", "APPROVED", "REJECTED"] },
          "screenFile": { "type": "string" },
          "componentFile": { "type": "string" },
          "layaScore": { "type": "number" },
          "nextBaton": { "type": "string" }
        }
      }
    }
  }
}
```

---

## Baton File: `.stitch/next-prompt.md` Format

```markdown
# Baton: Screen 02 - Catalog View
Target Route: `/services`
Previous Screen: `01-landing.html`
Shared Design Tokens: `.stitch/DESIGN.md`

## Required Elements
- Sticky navigation header with site switcher.
- High-density 2-tier service grid (top CIS platforms + compact search filter).
- Interactive price cards with 1-click order triggers routing to `/order?serviceId=:id`.
```
