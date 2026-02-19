import { resolveSpaceId } from "./config.js";
import {
  createApiError,
  createHttpError,
  createValidationError,
  normalizeCapacitiesError
} from "./errors.js";
import type { CapacitiesConfig } from "./config.js";

export interface CapacitiesSpace {
  id: string;
  title: string;
  icon?: string;
}

export interface CapacitiesStructureInfo extends Record<string, unknown> {
  id: string;
  title: string;
}

export interface CapacitiesLookupResult {
  id: string;
  structureId: string;
  title: string;
}

export interface CapacitiesLookupResponse {
  results: CapacitiesLookupResult[];
}

export interface CapacitiesSpacesResponse {
  spaces: CapacitiesSpace[];
}

export interface CapacitiesSpaceInfoResponse {
  structures: CapacitiesStructureInfo[];
}

export interface SaveWeblinkRequest {
  spaceId?: string;
  url: string;
  titleOverwrite?: string;
  descriptionOverwrite?: string;
  tags?: string[];
  mdText?: string;
}

export interface SaveToDailyNoteRequest {
  spaceId?: string;
  mdText: string;
  origin?: string;
  noTimeStamp?: boolean;
}

export class CapacitiesApiClient {
  private readonly fetchImpl: typeof fetch;
  private readonly config: CapacitiesConfig;

  constructor(config: CapacitiesConfig, fetchImpl: typeof fetch = fetch) {
    this.config = config;
    this.fetchImpl = fetchImpl;
  }

  async getSpaces(): Promise<CapacitiesSpacesResponse> {
    return this.requestJson<CapacitiesSpacesResponse>({ method: "GET", path: "/spaces" });
  }

  async getSpaceInfo(spaceId?: string): Promise<CapacitiesSpaceInfoResponse> {
    const resolvedSpaceId = resolveSpaceId(spaceId, this.config);
    return this.requestJson<CapacitiesSpaceInfoResponse>({
      method: "GET",
      path: "/space-info",
      query: { spaceid: resolvedSpaceId }
    });
  }

  async lookup(searchTerm: string, spaceId?: string): Promise<CapacitiesLookupResponse> {
    const trimmedSearchTerm = searchTerm.trim();
    if (!trimmedSearchTerm) {
      throw createValidationError("lookup searchTerm must be a non-empty string.");
    }

    const resolvedSpaceId = resolveSpaceId(spaceId, this.config);

    return this.requestJson<CapacitiesLookupResponse>({
      method: "POST",
      path: "/lookup",
      body: {
        searchTerm: trimmedSearchTerm,
        spaceId: resolvedSpaceId
      }
    });
  }

  async saveWeblink(payload: SaveWeblinkRequest): Promise<Record<string, unknown>> {
    const resolvedSpaceId = resolveSpaceId(payload.spaceId, this.config);
    return this.requestJson<Record<string, unknown>>({
      method: "POST",
      path: "/save-weblink",
      body: {
        ...payload,
        spaceId: resolvedSpaceId
      }
    });
  }

  async saveToDailyNote(payload: SaveToDailyNoteRequest): Promise<Record<string, unknown>> {
    const resolvedSpaceId = resolveSpaceId(payload.spaceId, this.config);
    return this.requestJson<Record<string, unknown>>({
      method: "POST",
      path: "/save-to-daily-note",
      body: {
        ...payload,
        spaceId: resolvedSpaceId
      }
    });
  }

  private async requestJson<T>({
    method,
    path,
    query,
    body
  }: {
    method: "GET" | "POST";
    path: string;
    query?: Record<string, string | undefined>;
    body?: unknown;
  }): Promise<T> {
    const url = new URL(path, this.config.baseUrl);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined) {
          url.searchParams.set(key, value);
        }
      }
    }

    try {
      const response = await this.fetchImpl(url, {
        method,
        headers: {
          Authorization: `Bearer ${this.config.apiToken}`,
          ...(body ? { "Content-Type": "application/json" } : {})
        },
        body: body ? JSON.stringify(body) : undefined
      });

      if (!response.ok) {
        throw await createHttpError(response);
      }

      const rawBody = await response.text();
      if (!rawBody.trim()) {
        throw createApiError(
          `Capacities API returned an empty response body for ${method} ${url.pathname}.`,
          {
            status: response.status,
            actionableMessage:
              "Check endpoint behavior in Capacities docs. Use only endpoints with documented response bodies."
          }
        );
      }

      try {
        return JSON.parse(rawBody) as T;
      } catch {
        throw createApiError(
          `Capacities API returned invalid JSON for ${method} ${url.pathname}.`,
          {
            status: response.status
          }
        );
      }
    } catch (error) {
      throw normalizeCapacitiesError(error);
    }
  }
}
