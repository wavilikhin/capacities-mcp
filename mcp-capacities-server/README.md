# mcp-capacities-server

TypeScript MCP stdio server for Capacities API.

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

## Build and Start

```bash
cd mcp-capacities-server
npm run build
npm run start
```

Notes:
- Transport is stdio only.
- `npm run start` is intended to be launched by an MCP client over stdio.
- If started directly without a client (stdin EOF), process exits cleanly.

## Tools and API Limits

Implemented tools:

- `get_space_info`
- `search_entities`
- `get_entity_by_id`
- `list_tasks`
- `create_task`
- `update_task`
- `complete_task`

Current Capacities public API endpoints used/known:

- `/spaces`
- `/space-info`
- `/lookup`
- `/save-weblink`
- `/save-to-daily-note`

Unsupported due to current public API limits (deterministic explicit `supported: false` result):

- `get_entity_by_id`
- `list_tasks`
- `create_task`
- `update_task`
- `complete_task`

`search_entities` constraints:

- Native API requires non-empty `text` (`/lookup`)
- `date` / `dateFrom` / `dateTo` are accepted for contract compatibility but not applied server-side because `/lookup` does not return date fields for filtering
- `type` is best-effort, mapped against `/space-info` structure metadata

## Workflow Example: Daily Notes For Yesterday

Today is `2026-02-19`, so yesterday is `2026-02-18`.

Because `search_entities` requires `text`, use text + date together:

```json
{
  "name": "search_entities",
  "arguments": {
    "text": "daily note 2026-02-18",
    "date": "yesterday",
    "type": "daily note",
    "limit": 10
  }
}
```

Interpretation with current API limits:

- `text` drives the actual lookup
- `date: "yesterday"` normalizes to `2026-02-18` but is informational only (not API-filtered)
- `type` is applied best-effort via structure mapping

If you call `search_entities` with only `date` and no `text`, server returns deterministic unsupported guidance.

## Verification Results (2026-02-19)

Executed in this workspace:

1. Build

```bash
cd mcp-capacities-server && npm run build
```

Result: pass.

2. Startup smoke

```bash
cd mcp-capacities-server
CAPACITIES_API_TOKEN="smoke-test-token" \
CAPACITIES_SPACE_ID="11111111-1111-4111-8111-111111111111" \
npm run start
```

Result: process initializes; with no attached stdio MCP client it exits cleanly on EOF.

3. Tool-level checks via SDK stdio client

- `tools/list` returned all 7 tools.
- `get_space_info` and `search_entities` (with text) reached Capacities API and returned API error for invalid auth test token (`notLoggedIn`, surfaced as `api_error`).
- `search_entities` with date-only returned deterministic unsupported response (expected).
- `get_entity_by_id`, `list_tasks`, `create_task`, `update_task`, `complete_task` returned deterministic unsupported responses (expected under current API limits).
- Validation checks:
  - `update_task` with no update fields returned `validation_error` (expected)
  - `create_task` with blank title failed input validation (expected)

## Residual Risks

- No verification with a real Capacities token/real space in this workspace, so live success-path behavior for `get_space_info` and text-based `search_entities` is unconfirmed here.
- Date-based entity filtering cannot be guaranteed until Capacities exposes date-filterable entity lookup.
