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

## Manual Publish

Run from repository root:

```bash
npm run build
npm pack --dry-run
npm publish
```

Current root package metadata:

- `"name": "capacities-mcp"`
- `bin` points to built CLI entrypoint (for `npx capacities-mcp`)
- `"publishConfig": { "access": "public" }`

## Auto-Publish by Tag (GitHub Actions)

Expected release flow:

1. Configure repository secret `NPM_TOKEN`.
2. Ensure `package.json` version matches tag (workflow enforces this).
3. Create and push a `v*` release tag:

```bash
git tag v0.1.0
git push origin v0.1.0
```

Workflow file: `.github/workflows/publish.yml`

- Triggers on `push.tags: "v*"` (and manual `workflow_dispatch`)
- Verifies package name is `capacities-mcp`
- Verifies version is not already published
- Runs `npm ci`, `npm run build`, `npm pack --dry-run`, then `npm publish`
