import type { z } from "zod";
import {
  apiErrorSchema,
  batteryHealthResponseSchema,
  carsResponseSchema,
  chargeDetailResponseSchema,
  chargesResponseSchema,
  driveDetailResponseSchema,
  drivesResponseSchema,
  globalSettingsResponseSchema,
  pingSchema,
  statusResponseSchema,
  updatesResponseSchema,
} from "./schemas";

export class ApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/**
 * Every call is same-origin (`/api/...`) — the dev server (vite.config.ts)
 * and the production image (nginx.conf) both proxy that path to
 * TESLAMATE_API_URL and attach the bearer token server-side, so the token
 * never has to ship inside client JS and the browser never hits CORS.
 */
const REQUEST_TIMEOUT_MS = 10_000;

async function request<S extends z.ZodTypeAny>(
  path: string,
  schema: S,
  init?: RequestInit
): Promise<z.infer<S>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      ...init,
      signal: controller.signal,
      headers: { Accept: "application/json", ...init?.headers },
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ApiError("Timed out — TeslaMateAPI didn't respond in time");
    }
    throw new ApiError("Network error — TeslaMateAPI is unreachable");
  } finally {
    clearTimeout(timeout);
  }

  if (res.status === 401 || res.status === 403) {
    throw new ApiError("Unauthorized — check the API token", res.status);
  }
  if (!res.ok) {
    throw new ApiError(`HTTP ${res.status}`, res.status);
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new ApiError("Invalid JSON response from TeslaMateAPI");
  }

  // TeslaMateAPI's handler-level failures respond 200 OK with { error }.
  const asError = apiErrorSchema.safeParse(json);
  if (asError.success) throw new ApiError(asError.data.error);

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    console.error(`[api] response validation failed for ${path}`, parsed.error.issues);
    throw new ApiError("Unexpected response shape from TeslaMateAPI");
  }
  return parsed.data;
}

function qs(params: object): string {
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(params as Record<string, string | number | boolean | undefined>)) {
    if (value !== undefined && value !== "") usp.set(key, String(value));
  }
  const s = usp.toString();
  return s ? `?${s}` : "";
}

export interface DateRangeParams {
  startDate?: string;
  endDate?: string;
}

export interface PageParams {
  page?: number;
  show?: number;
}

export const api = {
  ping: () => request("/ping", pingSchema),

  cars: () => request("/v1/cars", carsResponseSchema),
  car: (carId: number) => request(`/v1/cars/${carId}`, carsResponseSchema),

  status: (carId: number) => request(`/v1/cars/${carId}/status`, statusResponseSchema),

  drives: (
    carId: number,
    opts: DateRangeParams & PageParams & { minDistance?: number; maxDistance?: number; location?: string } = {}
  ) => request(`/v1/cars/${carId}/drives${qs(opts)}`, drivesResponseSchema),

  driveDetail: (carId: number, driveId: number) =>
    request(`/v1/cars/${carId}/drives/${driveId}?show_geodata=true`, driveDetailResponseSchema),

  charges: (carId: number, opts: DateRangeParams & PageParams & { location?: string } = {}) =>
    request(`/v1/cars/${carId}/charges${qs(opts)}`, chargesResponseSchema),

  chargeDetail: (carId: number, chargeId: number) =>
    request(`/v1/cars/${carId}/charges/${chargeId}`, chargeDetailResponseSchema),

  batteryHealth: (carId: number) => request(`/v1/cars/${carId}/battery-health`, batteryHealthResponseSchema),

  updates: (carId: number, opts: PageParams = {}) =>
    request(`/v1/cars/${carId}/updates${qs(opts)}`, updatesResponseSchema),

  globalSettings: () => request("/v1/globalsettings", globalSettingsResponseSchema),
};
