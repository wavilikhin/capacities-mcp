export type CapacitiesErrorCode =
  | "config_error"
  | "validation_error"
  | "network_error"
  | "api_error"
  | "rate_limit"
  | "unsupported";

export class CapacitiesError extends Error {
  readonly code: CapacitiesErrorCode;
  readonly status?: number;
  readonly actionableMessage: string;

  constructor(
    message: string,
    {
      code,
      status,
      actionableMessage
    }: {
      code: CapacitiesErrorCode;
      status?: number;
      actionableMessage: string;
    }
  ) {
    super(message);
    this.name = "CapacitiesError";
    this.code = code;
    this.status = status;
    this.actionableMessage = actionableMessage;
  }
}

export function createConfigError(message: string): CapacitiesError {
  return new CapacitiesError(message, {
    code: "config_error",
    actionableMessage:
      "Set required environment variables and restart the server."
  });
}

export function createValidationError(message: string): CapacitiesError {
  return new CapacitiesError(message, {
    code: "validation_error",
    actionableMessage: "Fix input values and retry."
  });
}

export function createUnsupportedError(message: string): CapacitiesError {
  return new CapacitiesError(message, {
    code: "unsupported",
    actionableMessage:
      "Use a supported Capacities API endpoint documented in https://api.capacities.io/docs."
  });
}

export function createNetworkError(message: string): CapacitiesError {
  return new CapacitiesError(message, {
    code: "network_error",
    actionableMessage:
      "Check network connectivity and retry. If this persists, verify api.capacities.io reachability."
  });
}

export function createApiError(
  message: string,
  {
    status,
    actionableMessage = "Retry the request. If it persists, verify the upstream API response."
  }: { status?: number; actionableMessage?: string } = {}
): CapacitiesError {
  return new CapacitiesError(message, {
    code: "api_error",
    status,
    actionableMessage
  });
}

export async function createHttpError(response: Response): Promise<CapacitiesError> {
  const responseBody = (await response.text()).trim();
  const status = response.status;
  const statusPrefix = `Capacities API request failed with status ${status}.`;
  const responseHint = responseBody ? ` Response: ${responseBody}` : "";

  if (status === 401) {
    return new CapacitiesError(`${statusPrefix} Unauthorized.${responseHint}`, {
      code: "api_error",
      status,
      actionableMessage:
        "Verify CAPACITIES_API_TOKEN is valid for your Capacities account."
    });
  }

  if (status === 404) {
    return new CapacitiesError(`${statusPrefix} Not found.${responseHint}`, {
      code: "api_error",
      status,
      actionableMessage:
        "Verify endpoint and identifiers (for example space ID) and retry."
    });
  }

  if (status === 429) {
    const retryAfter = response.headers.get("retry-after");
    const reset = response.headers.get("ratelimit-reset");
    const retryHint = retryAfter
      ? ` Retry after ${retryAfter} seconds.`
      : reset
        ? ` Retry when rate limit resets (${reset}).`
        : " Retry after a short delay.";

    return new CapacitiesError(
      `${statusPrefix} Rate limit exceeded.${retryHint}${responseHint}`,
      {
        code: "rate_limit",
        status,
        actionableMessage:
          "Back off and retry with lower request frequency. Respect RateLimit headers when present."
      }
    );
  }

  if (status === 503 || status === 555 || status >= 500) {
    return new CapacitiesError(`${statusPrefix} Server error.${responseHint}`, {
      code: "api_error",
      status,
      actionableMessage:
        "Retry with exponential backoff. If repeated, treat as temporary upstream outage."
    });
  }

  if (status >= 400) {
    return new CapacitiesError(`${statusPrefix}${responseHint}`, {
      code: "api_error",
      status,
      actionableMessage:
        "Check request parameters and payload shape against Capacities API docs, then retry."
    });
  }

  return new CapacitiesError(`${statusPrefix}${responseHint}`, {
    code: "api_error",
    status,
    actionableMessage: "Retry the request."
  });
}

export function normalizeCapacitiesError(error: unknown): CapacitiesError {
  if (error instanceof CapacitiesError) {
    return error;
  }

  if (error instanceof Error) {
    return createNetworkError(`Network request to Capacities API failed: ${error.message}`);
  }

  return createNetworkError("Network request to Capacities API failed with an unknown error.");
}
