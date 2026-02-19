import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { CapacitiesConfig } from "./config.js";
import { resolveSpaceId } from "./config.js";
import type { CapacitiesLookupResult, CapacitiesStructureInfo } from "./capacities-client.js";
import { CapacitiesApiClient } from "./capacities-client.js";
import { normalizeDateInput } from "./date.js";
import { createUnsupportedError, createValidationError, normalizeCapacitiesError } from "./errors.js";

const DEFAULT_LIMIT = 20;

interface SearchEntitiesFilters {
  spaceId?: string;
  text?: string;
  type?: string;
  date?: string;
  dateFrom?: string;
  dateTo?: string;
  limit: number;
}

interface ListTasksFilters {
  spaceId?: string;
  status?: "open" | "completed" | "all";
  date?: string;
  dateFrom?: string;
  dateTo?: string;
}

export function registerReadQueryTools(
  server: McpServer,
  dependencies: {
    client: CapacitiesApiClient;
    config: CapacitiesConfig;
  }
): void {
  const { client, config } = dependencies;

  server.registerTool(
    "get_space_info",
    {
      title: "Get Space Info",
      description:
        "Return space metadata and structure definitions for the selected Capacities space.",
      inputSchema: {
        spaceId: z
          .string()
          .trim()
          .optional()
          .describe("Optional UUID for the space. Falls back to CAPACITIES_SPACE_ID.")
      }
    },
    async ({ spaceId }) => {
      try {
        const resolvedSpaceId = resolveSpaceId(spaceId, config);
        const [spacesResponse, spaceInfoResponse] = await Promise.all([
          client.getSpaces(),
          client.getSpaceInfo(resolvedSpaceId)
        ]);
        const selectedSpace = spacesResponse.spaces.find((space) => space.id === resolvedSpaceId);
        const markdown = renderSpaceInfoMarkdown({
          spaceId: resolvedSpaceId,
          spaceTitle: selectedSpace?.title,
          spacesCount: spacesResponse.spaces.length,
          structures: spaceInfoResponse.structures
        });

        return {
          content: toTextContent(markdown),
          structuredContent: {
            tool: "get_space_info",
            spaceId: resolvedSpaceId,
            spaceTitle: selectedSpace?.title ?? null,
            spacesCount: spacesResponse.spaces.length,
            structures: spaceInfoResponse.structures
          }
        };
      } catch (error) {
        return errorResult("get_space_info", error);
      }
    }
  );

  server.registerTool(
    "search_entities",
    {
      title: "Search Entities",
      description:
        "Search Capacities entities via /lookup with best-effort filters and explicit unsupported notes.",
      inputSchema: {
        spaceId: z
          .string()
          .trim()
          .optional()
          .describe("Optional UUID for the space. Falls back to CAPACITIES_SPACE_ID."),
        text: z
          .string()
          .trim()
          .optional()
          .describe("Text query for Capacities lookup. Required for native API search."),
        type: z
          .string()
          .trim()
          .optional()
          .describe(
            "Best-effort filter by structure. Matches structure ID, title, or plural name."
          ),
        date: z
          .string()
          .trim()
          .optional()
          .describe("Optional date filter (YYYY-MM-DD or 'yesterday'). Not natively supported."),
        dateFrom: z
          .string()
          .trim()
          .optional()
          .describe("Optional range start (YYYY-MM-DD or 'yesterday'). Not natively supported."),
        dateTo: z
          .string()
          .trim()
          .optional()
          .describe("Optional range end (YYYY-MM-DD or 'yesterday'). Not natively supported."),
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe("Maximum entities to return after filtering. Default: 20.")
      }
    },
    async (input) => {
      try {
        const filters = normalizeSearchEntitiesFilters(input);
        const resolvedSpaceId = resolveSpaceId(filters.spaceId, config);

        if (!filters.text) {
          return unsupportedResult(
            "search_entities",
            "Capacities /lookup requires a non-empty text query. Date-only or type-only search is not supported by the public API.",
            {
              requestedFilters: filters,
              supported: {
                text: true,
                type: "best-effort (via structureId/title mapping)",
                date: false,
                dateRange: false
              }
            }
          );
        }

        const lookupResponse = await client.lookup(filters.text, resolvedSpaceId);
        const notes: string[] = [];
        let filteredResults = lookupResponse.results;

        if (filters.type) {
          const typeFilter = filters.type;
          const spaceInfoResponse = await client.getSpaceInfo(resolvedSpaceId);
          const allowedStructureIds = resolveStructureIdsByType(
            typeFilter,
            spaceInfoResponse.structures
          );
          filteredResults = filteredResults.filter((result) =>
            matchesTypeFilter(result, typeFilter, allowedStructureIds)
          );
          if (!filteredResults.length) {
            notes.push(
              `No results matched type filter \`${filters.type}\` using structure metadata from \`/space-info\`.`
            );
          }
        }

        if (filters.date || filters.dateFrom || filters.dateTo) {
          notes.push(
            "Date filters are accepted for compatibility but not applied because /lookup does not return entity date fields."
          );
        }

        const limitedResults = filteredResults.slice(0, filters.limit);
        const markdown = renderSearchEntitiesMarkdown({
          filters,
          results: limitedResults,
          totalBeforeLimit: filteredResults.length,
          notes
        });

        return {
          content: toTextContent(markdown),
          structuredContent: {
            tool: "search_entities",
            query: filters,
            totalResultsBeforeLimit: filteredResults.length,
            returnedResults: limitedResults.length,
            unsupportedNotes: notes,
            results: limitedResults
          }
        };
      } catch (error) {
        return errorResult("search_entities", error);
      }
    }
  );

  server.registerTool(
    "get_entity_by_id",
    {
      title: "Get Entity By ID",
      description:
        "Return a deterministic unsupported response. Capacities public API does not expose entity-by-id retrieval.",
      inputSchema: {
        entityId: z
          .string()
          .trim()
          .min(1)
          .describe("Entity ID to fetch. Public Capacities API currently does not support this lookup."),
        structureId: z
          .string()
          .trim()
          .min(1)
          .describe("Structure identifier for the entity. Required for request contract compatibility."),
        spaceId: z
          .string()
          .trim()
          .optional()
          .describe("Optional UUID for the space. Falls back to CAPACITIES_SPACE_ID.")
      }
    },
    async ({ entityId, structureId, spaceId }) =>
      unsupportedResult(
        "get_entity_by_id",
        "Capacities public API does not provide a documented endpoint to fetch an entity by ID and structure.",
        {
          requestedEntity: {
            entityId,
            structureId,
            spaceId: spaceId ?? config.defaultSpaceId ?? null
          },
          availableEndpoints: ["/spaces", "/space-info", "/lookup", "/save-weblink", "/save-to-daily-note"]
        }
      )
  );

  server.registerTool(
    "list_tasks",
    {
      title: "List Tasks",
      description:
        "Return a deterministic unsupported response. Capacities public API does not expose task listing.",
      inputSchema: {
        spaceId: z
          .string()
          .trim()
          .optional()
          .describe("Optional UUID for the space. Falls back to CAPACITIES_SPACE_ID."),
        status: z
          .enum(["open", "completed", "all"])
          .optional()
          .describe("Requested task status filter."),
        date: z
          .string()
          .trim()
          .optional()
          .describe("Optional date filter (YYYY-MM-DD or 'yesterday')."),
        dateFrom: z
          .string()
          .trim()
          .optional()
          .describe("Optional range start (YYYY-MM-DD or 'yesterday')."),
        dateTo: z
          .string()
          .trim()
          .optional()
          .describe("Optional range end (YYYY-MM-DD or 'yesterday').")
      }
    },
    async (input) => {
      try {
        const filters = normalizeListTasksFilters(input);
        return unsupportedResult(
          "list_tasks",
          "Capacities public API does not provide a documented endpoint for listing tasks or filtering by task status/date.",
          {
            requestedFilters: filters,
            availableEndpoints: ["/spaces", "/space-info", "/lookup", "/save-weblink", "/save-to-daily-note"]
          }
        );
      } catch (error) {
        return errorResult("list_tasks", error);
      }
    }
  );
}

function normalizeSearchEntitiesFilters(input: {
  spaceId?: string;
  text?: string;
  type?: string;
  date?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
}): SearchEntitiesFilters {
  const date = input.date ? normalizeDateInput(input.date) : undefined;
  const dateFrom = input.dateFrom ? normalizeDateInput(input.dateFrom) : undefined;
  const dateTo = input.dateTo ? normalizeDateInput(input.dateTo) : undefined;

  validateDateInputs(date, dateFrom, dateTo);

  return {
    spaceId: trimToUndefined(input.spaceId),
    text: trimToUndefined(input.text),
    type: trimToUndefined(input.type),
    date,
    dateFrom,
    dateTo,
    limit: input.limit ?? DEFAULT_LIMIT
  };
}

function normalizeListTasksFilters(input: {
  spaceId?: string;
  status?: "open" | "completed" | "all";
  date?: string;
  dateFrom?: string;
  dateTo?: string;
}): ListTasksFilters {
  const date = input.date ? normalizeDateInput(input.date) : undefined;
  const dateFrom = input.dateFrom ? normalizeDateInput(input.dateFrom) : undefined;
  const dateTo = input.dateTo ? normalizeDateInput(input.dateTo) : undefined;
  validateDateInputs(date, dateFrom, dateTo);

  return {
    spaceId: trimToUndefined(input.spaceId),
    status: input.status ?? "all",
    date,
    dateFrom,
    dateTo
  };
}

function validateDateInputs(
  date: string | undefined,
  dateFrom: string | undefined,
  dateTo: string | undefined
): void {
  if (date && (dateFrom || dateTo)) {
    throw createValidationError("Use either date or dateFrom/dateTo, not both.");
  }
  if ((dateFrom && !dateTo) || (!dateFrom && dateTo)) {
    throw createValidationError("dateFrom and dateTo must be provided together.");
  }
  if (dateFrom && dateTo && dateFrom > dateTo) {
    throw createValidationError("dateFrom must be earlier than or equal to dateTo.");
  }
}

function resolveStructureIdsByType(
  typeFilter: string,
  structures: CapacitiesStructureInfo[]
): Set<string> {
  const normalizedType = typeFilter.toLowerCase();
  const structureIds = new Set<string>();

  for (const structure of structures) {
    const titleMatches = structure.title.toLowerCase() === normalizedType;
    const idMatches = structure.id.toLowerCase() === normalizedType;
    const pluralName = getOptionalStringField(structure, "pluralName");
    const pluralMatches = pluralName?.toLowerCase() === normalizedType;

    if (titleMatches || idMatches || pluralMatches) {
      structureIds.add(structure.id);
    }
  }

  return structureIds;
}

function matchesTypeFilter(
  result: CapacitiesLookupResult,
  typeFilter: string,
  allowedStructureIds: Set<string>
): boolean {
  if (allowedStructureIds.size > 0) {
    return allowedStructureIds.has(result.structureId);
  }

  return result.structureId.toLowerCase() === typeFilter.toLowerCase();
}

function renderSpaceInfoMarkdown(payload: {
  spaceId: string;
  spaceTitle?: string;
  spacesCount: number;
  structures: CapacitiesStructureInfo[];
}): string {
  const structureLines = payload.structures.length
    ? payload.structures
        .map((structure) => `- \`${structure.id}\` - ${structure.title}`)
        .join("\n")
    : "- No structures returned by Capacities API.";

  return [
    "## Space Info",
    "",
    `- Space ID: \`${payload.spaceId}\``,
    `- Space title: ${payload.spaceTitle ?? "_Unknown in /spaces response_"}`,
    `- Accessible spaces in token scope: ${payload.spacesCount}`,
    `- Structures returned: ${payload.structures.length}`,
    "",
    "### Structures",
    structureLines
  ].join("\n");
}

function renderSearchEntitiesMarkdown(payload: {
  filters: SearchEntitiesFilters;
  results: CapacitiesLookupResult[];
  totalBeforeLimit: number;
  notes: string[];
}): string {
  const resultsLines = payload.results.length
    ? payload.results
        .map(
          (result) =>
            `- **${result.title}**  \n  ID: \`${result.id}\`  \n  Structure: \`${result.structureId}\``
        )
        .join("\n")
    : "- No matching entities.";

  const notesLines = payload.notes.length
    ? payload.notes.map((note) => `- ${note}`).join("\n")
    : "- None.";

  return [
    "## Search Entities",
    "",
    `- Text query: ${payload.filters.text ? `\`${payload.filters.text}\`` : "_Not provided_"}`,
    `- Type filter: ${payload.filters.type ? `\`${payload.filters.type}\`` : "_Not provided_"}`,
    `- Date filter: ${renderDateFilter(payload.filters)}`,
    `- Matches before limit: ${payload.totalBeforeLimit}`,
    `- Returned after limit (${payload.filters.limit}): ${payload.results.length}`,
    "",
    "### Results",
    resultsLines,
    "",
    "### Notes",
    notesLines
  ].join("\n");
}

function renderDateFilter(filters: SearchEntitiesFilters): string {
  if (filters.date) {
    return `\`${filters.date}\``;
  }
  if (filters.dateFrom && filters.dateTo) {
    return `\`${filters.dateFrom}\` to \`${filters.dateTo}\``;
  }
  return "_Not provided_";
}

function unsupportedResult(toolName: string, message: string, details: Record<string, unknown>) {
  const unsupportedError = createUnsupportedError(message);
  const markdown = [
    `## ${toolName}`,
    "",
    `- Supported: **no**`,
    `- Error code: \`${unsupportedError.code}\``,
    `- Message: ${unsupportedError.message}`,
    `- Action: ${unsupportedError.actionableMessage}`,
    "",
    "### Details",
    "```json",
    JSON.stringify(details, null, 2),
    "```"
  ].join("\n");

  return {
    content: toTextContent(markdown),
    structuredContent: {
      tool: toolName,
      supported: false,
      error: {
        code: unsupportedError.code,
        message: unsupportedError.message,
        actionableMessage: unsupportedError.actionableMessage
      },
      details
    }
  };
}

function errorResult(toolName: string, error: unknown) {
  const normalizedError = normalizeCapacitiesError(error);
  const statusLine = normalizedError.status !== undefined ? `- Status: ${normalizedError.status}` : "";

  const markdown = [
    `## ${toolName} error`,
    "",
    `- Code: \`${normalizedError.code}\``,
    `- Message: ${normalizedError.message}`,
    statusLine,
    `- Action: ${normalizedError.actionableMessage}`
  ]
    .filter((line) => line.length > 0)
    .join("\n");

  return {
    content: toTextContent(markdown),
    structuredContent: {
      tool: toolName,
      ok: false,
      error: {
        code: normalizedError.code,
        message: normalizedError.message,
        status: normalizedError.status ?? null,
        actionableMessage: normalizedError.actionableMessage
      }
    },
    isError: true
  };
}

function trimToUndefined(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function getOptionalStringField(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
}

function toTextContent(text: string): [{ type: "text"; text: string }] {
  return [{ type: "text", text }];
}
