export class ApiError extends Error {
  code: string;
  statusCode: number;
  details?: any;

  constructor(message: string, code = 'UNKNOWN_ERROR', statusCode = 500, details?: any) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export async function apiFetch<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = endpoint.startsWith('http') ? endpoint : `/api${endpoint}`;

  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include', // Ensure cookies are sent
  });

  // Try parsing JSON
  let data: any = null;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const errorPayload = data?.error;
    throw new ApiError(
      errorPayload?.message || response.statusText || 'Request failed',
      errorPayload?.code || `HTTP_${response.status}`,
      response.status,
      errorPayload?.details
    );
  }

  return data as T;
}
