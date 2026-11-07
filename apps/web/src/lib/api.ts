export class ApiError extends Error {
  code: string;
  statusCode: number;
  details?: any;

  constructor(
    message: string,
    code = "UNKNOWN_ERROR",
    statusCode = 500,
    details?: any,
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

let refreshPromise: Promise<boolean> | null = null;

function isAuthEndpoint(url: string): boolean {
  return (
    url.includes("/auth/login") ||
    url.includes("/auth/refresh") ||
    url.includes("/auth/set-password") ||
    url.includes("/auth/forgot-password")
  );
}

/**
 * Login tokens live only in httpOnly cookies set by the API, never in browser storage.
 * Older builds kept copies in localStorage; this removes any that are left.
 */
const LEGACY_TOKEN_KEYS = ["accessToken", "refreshToken", "token"];

export function clearLegacyTokens(): void {
  if (typeof window === "undefined") return;
  for (const name of ["localStorage", "sessionStorage"] as const) {
    try {
      const store = window[name];
      for (const key of LEGACY_TOKEN_KEYS) store?.removeItem(key);
    } catch {
      // Storage can be unavailable (private mode, tests); nothing to clear then.
    }
  }
}

async function executeTokenRefresh(): Promise<boolean> {
  try {
    // The refresh cookie is sent automatically; the API answers with new cookies.
    const res = await fetch("/api/auth/refresh", {
      method: "POST",
      credentials: "include",
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Renew the access cookie once, shared by every caller that hits an expired session
 * at the same moment (REST, uploads, the socket).
 */
export function refreshSession(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = executeTokenRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

export async function apiFetch<T = any>(
  endpoint: string,
  options: RequestInit & { _isRetry?: boolean } = {},
): Promise<T> {
  const url = endpoint.startsWith("http")
    ? endpoint
    : endpoint.startsWith("/api")
      ? endpoint
      : `/api${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const { _isRetry, ...fetchOptions } = options;

  const doFetch = () =>
    fetch(url, {
      ...fetchOptions,
      headers,
      credentials: "include", // Ensure cookies are sent
    });

  // While the API is (re)starting, the dev proxy answers 503 SERVER_RESTARTING.
  // Wait and retry quietly for a few seconds instead of surfacing an error.
  // Skipped for FormData/streams, whose bodies can't be re-sent.
  const canRetryBody =
    fetchOptions.body == null || typeof fetchOptions.body === "string";
  let response = await doFetch();
  for (let i = 0; i < 6 && response.status === 503 && canRetryBody; i++) {
    const code = await response
      .clone()
      .json()
      .then((d) => d?.error?.code)
      .catch(() => undefined);
    if (code !== "SERVER_RESTARTING") break;
    await new Promise((r) => setTimeout(r, 1000));
    response = await doFetch();
  }

  // Handle silent token refresh on 401 Unauthorized
  if (response.status === 401 && !isAuthEndpoint(url) && !_isRetry) {
    const refreshed = await refreshSession();
    if (refreshed) {
      return apiFetch<T>(endpoint, { ...options, _isRetry: true });
    }

    // Refresh failed - the session is over; go to login
    if (typeof window !== "undefined") {
      clearLegacyTokens();
      if (
        window.location &&
        !window.location.pathname.startsWith("/login") &&
        !window.location.pathname.startsWith("/set-password")
      ) {
        try {
          const returnUrl = encodeURIComponent(
            window.location.pathname + window.location.search,
          );
          window.location.href = `/login?from=${returnUrl}`;
        } catch {
          // Navigation not implemented in test environments (e.g. jsdom)
        }
      }
    }
  }

  // Try parsing JSON
  let data: any = null;
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const errorPayload = data?.error;
    throw new ApiError(
      errorPayload?.message || response.statusText || "Request failed",
      errorPayload?.code || `HTTP_${response.status}`,
      response.status,
      errorPayload?.details,
    );
  }

  return data as T;
}
