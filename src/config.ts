import { createConfigError, createValidationError } from "./errors.js";

export const CAPACITIES_API_BASE_URL = "https://api.capacities.io";
export const CAPACITIES_API_TOKEN_ENV = "CAPACITIES_API_TOKEN";
export const CAPACITIES_SPACE_ID_ENV = "CAPACITIES_SPACE_ID";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type EnvSource = Record<string, string | undefined>;

export interface CapacitiesConfig {
  baseUrl: string;
  apiToken: string;
  defaultSpaceId?: string;
}

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function loadCapacitiesConfig(env: EnvSource): CapacitiesConfig {
  const apiToken = getRequiredTrimmedEnv(env, CAPACITIES_API_TOKEN_ENV);
  const defaultSpaceIdRaw = getOptionalTrimmedEnv(env, CAPACITIES_SPACE_ID_ENV);

  if (defaultSpaceIdRaw !== undefined && !isUuid(defaultSpaceIdRaw)) {
    throw createValidationError(
      `${CAPACITIES_SPACE_ID_ENV} must be a UUID when provided. Received: "${defaultSpaceIdRaw}".`
    );
  }

  return {
    baseUrl: CAPACITIES_API_BASE_URL,
    apiToken,
    defaultSpaceId: defaultSpaceIdRaw
  };
}

export function resolveSpaceId(
  explicitSpaceId: string | undefined,
  config: Pick<CapacitiesConfig, "defaultSpaceId">
): string {
  const candidate = explicitSpaceId?.trim() || config.defaultSpaceId;

  if (!candidate) {
    throw createConfigError(
      `Missing space ID. Provide a space ID in the request or set ${CAPACITIES_SPACE_ID_ENV}.`
    );
  }

  if (!isUuid(candidate)) {
    throw createValidationError(`Space ID must be a UUID. Received: "${candidate}".`);
  }

  return candidate;
}

function getRequiredTrimmedEnv(env: EnvSource, name: string): string {
  const value = getOptionalTrimmedEnv(env, name);
  if (!value) {
    throw createConfigError(`${name} is required and must be a non-empty string.`);
  }
  return value;
}

function getOptionalTrimmedEnv(env: EnvSource, name: string): string | undefined {
  const raw = env[name];
  if (raw === undefined) {
    return undefined;
  }
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
