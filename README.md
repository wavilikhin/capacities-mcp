# mcp-capacities-server

TypeScript MCP stdio server for the Capacities public API.

## Goal

Provide MCP tools for Capacities space info and entity search, with explicit deterministic unsupported responses for operations not exposed by the current public API.

## Requirements

- Node.js 20+
- npm
- Capacities API token
- Optional default space UUID

## Configuration

Set env vars before start:

- `CAPACITIES_API_TOKEN` (required): bearer token for `https://api.capacities.io`
- `CAPACITIES_SPACE_ID` (optional): default space UUID used when a tool input omits `spaceId`

Example:

```bash
export CAPACITIES_API_TOKEN="<token>"
export CAPACITIES_SPACE_ID="11111111-1111-4111-8111-111111111111"
```

## Setup and Run

```bash
npm install
npm run build
npm run start
```

Notes:
- Transport is stdio only.
- `npm run start` is intended to be launched by an MCP client over stdio.
- If started directly without a client (stdin EOF), process exits cleanly.

## Tool Behavior and API Limits

Implemented tools:

- `get_space_info`
- `search_entities`
- `get_entity_by_id`
- `list_tasks`
- `create_task`
- `update_task`
- `complete_task`

Supported behavior:

- `get_space_info` calls `/space-info`.
- `search_entities` calls `/lookup` and supports:
  - required `text` search
  - optional best-effort `type` mapping via `/space-info`
  - accepted but non-filtering `date` / `dateFrom` / `dateTo` inputs (informational only)

Unsupported due to current public API limits (deterministic explicit `supported: false` result):

- `get_entity_by_id`
- `list_tasks`
- `create_task`
- `update_task`
- `complete_task`

Current documented Capacities public endpoints:

- `/spaces`
- `/space-info`
- `/lookup`
- `/save-weblink`
- `/save-to-daily-note`
