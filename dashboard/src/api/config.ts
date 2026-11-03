import { getAppLocation, isEmbeddedApp } from "../utils/appRuntime";

declare const BASE_URL: string;

/**
 * Get the full API URL with /api prefix
 * @param path - API path (e.g., "/models", "/skills")
 * @returns Full API URL (e.g., "http://localhost:8088/api/models" or "/api/models")
 */
export function getApiUrl(path: string): string {
  const base = BASE_URL || (isEmbeddedApp() ? getAppLocation().origin : "");
  const apiPrefix = "/api";
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${apiPrefix}${normalizedPath}`;
}

/**
 * Get a WebSocket URL derived from the same origin as the API.
 * Converts http:// → ws:// and https:// → wss://.
 * If BASE_URL is empty, uses the application location (including Wujie).
 * @param path - API path (e.g., "/browser-stream/ws")
 * @returns Full WebSocket URL
 */
export function getWsUrl(path: string): string {
  const url = new URL(getApiUrl(path), getAppLocation().href);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.href;
}
