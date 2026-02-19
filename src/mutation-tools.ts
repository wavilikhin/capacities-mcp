import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { CapacitiesConfig } from "./config.js";
import { resolveSpaceId } from "./config.js";
import { normalizeDateInput } from "./date.js";
import { createUnsupportedError, createValidationError, normalizeCapacitiesError } from "./errors.js";

interface CreateTaskInput {
  spaceId?: string;
  title: string;
  description?: string;
  dueDate?: string;
}

interface UpdateTaskInput {
  taskId: string;
  spaceId?: string;
  title?: string;
  description?: string | null;
  dueDate?: string | null;
  status?: "open" | "completed";
}

interface CompleteTaskInput {
  taskId: string;
  spaceId?: string;
  completed: boolean;
}

const AVAILABLE_ENDPOINTS = [
  "/spaces",
  "/space-info",
  "/lookup",
  "/save-weblink",
  "/save-to-daily-note"
] as const;

export function registerMutationTools(
  server: McpServer,
  dependencies: {
    config: CapacitiesConfig;
  }
): void {
  const { config } = dependencies;

  server.registerTool(
    "create_task",
    {
      title: "Create Task",
      description:
        "Validate task-create inputs and return deterministic unsupported guidance because Capacities public API has no documented task-create endpoint.",
      inputSchema: {
        spaceId: z
          .string()
          .trim()
          .optional()
          .describe("Optional UUID for the space. Falls back to CAPACITIES_SPACE_ID."),
        title: z
          .string()
          .trim()
          .min(1)
          .max(500)
          .describe("Task title."),
        description: z
          .string()
          .trim()
          .optional()
          .describe("Optional task description."),
        dueDate: z
          .string()
          .trim()
          .optional()
          .describe("Optional due date (YYYY-MM-DD or 'yesterday').")
      }
    },
    async (input) => {
      try {
        const payload = normalizeCreateTaskInput(input, config);
        return unsupportedResult(
          "create_task",
          "Capacities public API does not provide a documented endpoint for creating tasks.",
          {
            requestedTask: payload,
            availableEndpoints: AVAILABLE_ENDPOINTS
          }
        );
      } catch (error) {
        return errorResult("create_task", error);
      }
    }
  );

  server.registerTool(
    "update_task",
    {
      title: "Update Task",
      description:
        "Validate task-update inputs and return deterministic unsupported guidance because Capacities public API has no documented task-update endpoint.",
      inputSchema: {
        taskId: z
          .string()
          .trim()
          .min(1)
          .describe("Task identifier."),
        spaceId: z
          .string()
          .trim()
          .optional()
          .describe("Optional UUID for the space. Falls back to CAPACITIES_SPACE_ID."),
        title: z
          .string()
          .trim()
          .min(1)
          .max(500)
          .optional()
          .describe("Optional updated task title."),
        description: z
          .string()
          .trim()
          .nullable()
          .optional()
          .describe("Optional updated description. Use null to clear."),
        dueDate: z
          .string()
          .trim()
          .nullable()
          .optional()
          .describe("Optional updated due date (YYYY-MM-DD or 'yesterday'). Use null to clear."),
        status: z
          .enum(["open", "completed"])
          .optional()
          .describe("Optional task status update.")
      }
    },
    async (input) => {
      try {
        const payload = normalizeUpdateTaskInput(input, config);
        return unsupportedResult(
          "update_task",
          "Capacities public API does not provide a documented endpoint for updating task fields or status.",
          {
            requestedUpdate: payload,
            availableEndpoints: AVAILABLE_ENDPOINTS
          }
        );
      } catch (error) {
        return errorResult("update_task", error);
      }
    }
  );

  server.registerTool(
    "complete_task",
    {
      title: "Complete Task",
      description:
        "Validate completion-toggle inputs and return deterministic unsupported guidance because Capacities public API has no documented task-complete endpoint.",
      inputSchema: {
        taskId: z
          .string()
          .trim()
          .min(1)
          .describe("Task identifier."),
        spaceId: z
          .string()
          .trim()
          .optional()
          .describe("Optional UUID for the space. Falls back to CAPACITIES_SPACE_ID."),
        completed: z
          .boolean()
          .optional()
          .describe("Set to true to complete, false to uncomplete. Default: true.")
      }
    },
    async (input) => {
      try {
        const payload = normalizeCompleteTaskInput(input, config);
        return unsupportedResult(
          "complete_task",
          "Capacities public API does not provide a documented endpoint for completing or uncompleting tasks.",
          {
            requestedAction: payload,
            availableEndpoints: AVAILABLE_ENDPOINTS
          }
        );
      } catch (error) {
        return errorResult("complete_task", error);
      }
    }
  );
}

function normalizeCreateTaskInput(
  input: {
    spaceId?: string;
    title: string;
    description?: string;
    dueDate?: string;
  },
  config: CapacitiesConfig
): CreateTaskInput {
  const title = trimToUndefined(input.title);
  if (!title) {
    throw createValidationError("title must be a non-empty string.");
  }

  return {
    spaceId: resolveSpaceId(input.spaceId, config),
    title,
    description: trimToUndefined(input.description),
    dueDate: normalizeOptionalDate(input.dueDate)
  };
}

function normalizeUpdateTaskInput(
  input: {
    taskId: string;
    spaceId?: string;
    title?: string;
    description?: string | null;
    dueDate?: string | null;
    status?: "open" | "completed";
  },
  config: CapacitiesConfig
): UpdateTaskInput {
  const taskId = trimToUndefined(input.taskId);
  if (!taskId) {
    throw createValidationError("taskId must be a non-empty string.");
  }

  const title = input.title === undefined ? undefined : trimToUndefined(input.title);
  if (input.title !== undefined && !title) {
    throw createValidationError("title must be a non-empty string when provided.");
  }

  const description = normalizeNullableText(input.description, "description");
  const dueDate = normalizeNullableDate(input.dueDate);
  const status = input.status;

  if (
    title === undefined &&
    description === undefined &&
    dueDate === undefined &&
    status === undefined
  ) {
    throw createValidationError(
      "Provide at least one update field: title, description, dueDate, or status."
    );
  }

  return {
    taskId,
    spaceId: resolveSpaceId(input.spaceId, config),
    title,
    description,
    dueDate,
    status
  };
}

function normalizeCompleteTaskInput(
  input: {
    taskId: string;
    spaceId?: string;
    completed?: boolean;
  },
  config: CapacitiesConfig
): CompleteTaskInput {
  const taskId = trimToUndefined(input.taskId);
  if (!taskId) {
    throw createValidationError("taskId must be a non-empty string.");
  }

  return {
    taskId,
    spaceId: resolveSpaceId(input.spaceId, config),
    completed: input.completed ?? true
  };
}

function normalizeNullableText(
  value: string | null | undefined,
  fieldName: string
): string | null | undefined {
  if (value === undefined || value === null) {
    return value;
  }
  const trimmed = trimToUndefined(value);
  if (!trimmed) {
    throw createValidationError(`${fieldName} must be a non-empty string when provided.`);
  }
  return trimmed;
}

function normalizeOptionalDate(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  const trimmed = trimToUndefined(value);
  if (!trimmed) {
    throw createValidationError("dueDate must be a non-empty date string when provided.");
  }
  return normalizeDateInput(trimmed);
}

function normalizeNullableDate(value: string | null | undefined): string | null | undefined {
  if (value === undefined || value === null) {
    return value;
  }
  const trimmed = trimToUndefined(value);
  if (!trimmed) {
    throw createValidationError("dueDate must be a non-empty date string when provided.");
  }
  return normalizeDateInput(trimmed);
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

function toTextContent(text: string): [{ type: "text"; text: string }] {
  return [{ type: "text", text }];
}
