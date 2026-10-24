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

async function executeTokenRefresh(): Promise<boolean> {
  try {
    const res = await fetch("/api/auth/refresh", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    });
    return res.ok;
  } catch {
    return false;
  }
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

  const response = await fetch(url, {
    ...fetchOptions,
    headers,
    credentials: "include", // Ensure cookies are sent
  });

  // Handle silent token refresh on 401 Unauthorized
  if (response.status === 401 && !isAuthEndpoint(url) && !_isRetry) {
    if (!refreshPromise) {
      refreshPromise = executeTokenRefresh().finally(() => {
        refreshPromise = null;
      });
    }

    const refreshed = await refreshPromise;
    if (refreshed) {
      return apiFetch<T>(endpoint, {
        ...options,
        _isRetry: true,
      });
    }

    // Refresh failed - redirect to login in browser environment
    if (
      typeof window !== "undefined" &&
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
