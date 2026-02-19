# capacities-mcp

TypeScript stdio MCP server for Capacities with `get_space_info` and `search_entities`, plus explicit unsupported results for operations the public API does not expose.

## Quick Start

```bash
cd mcp-capacities-server
npm install
export CAPACITIES_API_TOKEN="<token>"
# optional:
export CAPACITIES_SPACE_ID="11111111-1111-4111-8111-111111111111"
npm run build
npm run start
```

See `mcp-capacities-server/README.md` for tool behavior and API limitations.
