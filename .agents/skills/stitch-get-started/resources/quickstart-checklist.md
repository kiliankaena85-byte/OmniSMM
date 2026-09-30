# Stitch Quickstart Checklist & Environment Setup

## Prerequisites
1. **Node.js Environment**: Node.js 20+ installed.
2. **Coding Agent**: Antigravity, Claude Code, Cursor, or Gemini CLI.
3. **Stitch Credentials**: Google Account access at `stitch.withgoogle.com`.

---

## 5-Step Project Setup

### 1. Verify Stitch MCP Connectivity
Run the self-test command from project root:
```bash
npx tsx scripts/mcp/stitch-mcp-server.ts --ping
```
Expected output:
```json
{"status":"healthy","server":"StitchMCP","version":"2026.1.0"}
```

### 2. Configure Agent MCP Settings
Add to your agent's MCP configuration (`settings.json` or `claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "StitchMCP": {
      "command": "npx",
      "args": ["tsx", "scripts/mcp/stitch-mcp-server.ts"]
    }
  }
}
```

### 3. Check Design Token Contract
Ensure project has an active `DESIGN.md` in workspace root. If not, generate baseline:
```bash
npx tsx scripts/stitch/stitch-pipeline-runner.ts --init-design
```

### 4. Run First Screen Generation
Invoke via CLI runner or MCP agent prompt:
```bash
npx tsx scripts/stitch/stitch-pipeline-runner.ts --prompt "High-density crypto deposit modal with QR code and transaction history" --brand smmflux --viewport desktop
```

### 5. Validate Output
- Verify generated screen HTML preview in `.stitch/screens/`.
- Inspect Laya NPU candidate evaluation report.
- Verify React 19 component scaffold in `.stitch/components/`.
