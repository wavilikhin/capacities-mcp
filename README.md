# capacities-mcp

TypeScript MCP stdio server for the Capacities public API.

## Requirements

- Node.js 20+
- npm
- `CAPACITIES_API_TOKEN` (required)
- `CAPACITIES_SPACE_ID` (optional default space UUID)

## Install

From npm (package consumers):

```bash
npm install capacities-mcp
```

Run without local install:

```bash
npx -y capacities-mcp
```

From source (this repository root):

```bash
npm install
npm run build
npm run start
```

## MCP Usage by AI Agents

Example MCP client config (stdio):

```json
{
  "mcpServers": {
    "capacities": {
      "command": "npx",
      "args": ["-y", "capacities-mcp"],
      "env": {
        "CAPACITIES_API_TOKEN": "YOUR_TOKEN",
        "CAPACITIES_SPACE_ID": "OPTIONAL_SPACE_UUID"
      }
    }
  }
}
```

If you run from local source instead of npm:

```json
{
  "mcpServers": {
    "capacities": {
      "command": "node",
      "args": ["dist/index.js"],
      "env": {
        "CAPACITIES_API_TOKEN": "YOUR_TOKEN",
        "CAPACITIES_SPACE_ID": "OPTIONAL_SPACE_UUID"
      }
    }
  }
}
```
