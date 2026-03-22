export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface HttpRequestConfig {
  method?: HttpMethod;
  path: string;
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  headers?: Record<string, string>;
  retry?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
  parseAs?: "json" | "text" | "raw";
  signal?: AbortSignal;
}

export interface HttpClientOptions {
  baseUrl: string;
  fetcher?: typeof fetch;
  defaultHeaders?: Record<string, string>;
  getAuthToken?: () => string | null;
  onUnauthorized?: () => void;
}

export interface HttpSuccess<T> {
  ok: true;
  status: number;
  data: T;
  headers: Headers;
}

export interface HttpFailure {
  ok: false;
  status: number;
  code: "network_error" | "timeout" | "http_error" | "invalid_json";
  message: string;
  details?: unknown;
}

export type HttpResult<T> = HttpSuccess<T> | HttpFailure;

const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

function buildQuery(
  query: HttpRequestConfig["query"]
): string {
  if (!query) {
    return "";
  }
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return;
    }
    params.set(key, String(value));
  });
  const output = params.toString();
  return output ? `?${output}` : "";
}

function normalizeUrl(baseUrl: string, path: string, query?: HttpRequestConfig["query"]): string {
  const prefix = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${prefix}${normalizedPath}${buildQuery(query)}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function createTimeoutController(
  timeoutMs: number,
  external?: AbortSignal
): { signal: AbortSignal; cancel: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort("timeout"), timeoutMs);

  if (external) {
    if (external.aborted) {
      controller.abort(external.reason);
    } else {
      external.addEventListener(
        "abort",
        () => {
          controller.abort(external.reason);
        },
        { once: true }
      );
    }
  }

  const cancel = (): void => {
    clearTimeout(timer);
  };

  controller.signal.addEventListener("abort", cancel, { once: true });

  return {
    signal: controller.signal,
    cancel
  };
}

async function parseBody<T>(response: Response, mode: HttpRequestConfig["parseAs"]): Promise<T> {
  if (mode === "raw") {
    return response as T;
  }
  if (mode === "text") {
    return (await response.text()) as T;
  }
  if (response.status === 204) {
    return undefined as T;
  }
  try {
    return (await response.json()) as T;
  } catch (error) {
    throw new Error(
      `invalid_json:${error instanceof Error ? error.message : "Unknown parsing error"}`
    );
  }
}

function isTimeoutError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return error.name === "AbortError" || error.message.includes("timeout");
}

export function createHttpClient(options: HttpClientOptions) {
  const fetcher = options.fetcher ?? fetch;
  const defaultHeaders = options.defaultHeaders ?? {
    "Content-Type": "application/json"
  };

  async function request<T>(config: HttpRequestConfig): Promise<HttpResult<T>> {
    const retry = config.retry ?? 0;
    const retryDelayMs = config.retryDelayMs ?? 120;
    const parseAs = config.parseAs ?? "json";
    const timeoutMs = config.timeoutMs ?? 8000;
    let attempt = 0;

    while (attempt <= retry) {
      let cancelTimeout: (() => void) | null = null;
      try {
        const timeout = createTimeoutController(timeoutMs, config.signal);
        cancelTimeout = timeout.cancel;
        const url = normalizeUrl(options.baseUrl, config.path, config.query);
        const token = options.getAuthToken?.();
        const headers: Record<string, string> = {
          ...defaultHeaders,
          ...config.headers
        };
        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }

        const method = config.method ?? "GET";
        const body =
          config.body === undefined || method === "GET"
            ? undefined
            : typeof config.body === "string"
              ? config.body
              : JSON.stringify(config.body);

        const response = await fetcher(url, {
          method,
          headers,
          body,
          signal: timeout.signal
        });
        timeout.cancel();

        if (response.status === 401) {
          options.onUnauthorized?.();
        }

        if (!response.ok) {
          if (attempt < retry && RETRYABLE_STATUS.has(response.status)) {
            attempt += 1;
            await sleep(retryDelayMs * attempt);
            continue;
          }
          const message = await response.text();
          return {
            ok: false,
            status: response.status,
            code: "http_error",
            message: message || response.statusText
          };
        }

        let data: T;
        try {
          data = await parseBody<T>(response, parseAs);
        } catch (error) {
          return {
            ok: false,
            status: response.status,
            code: "invalid_json",
            message: error instanceof Error ? error.message : "Invalid JSON payload.",
            details: error
          };
        }
        return {
          ok: true,
          status: response.status,
          data,
          headers: response.headers
        };
      } catch (error) {
        cancelTimeout?.();
        const timeout = isTimeoutError(error);
        if (attempt < retry) {
          attempt += 1;
          await sleep(retryDelayMs * attempt);
          continue;
        }
        return {
          ok: false,
          status: 0,
          code: timeout ? "timeout" : "network_error",
          message:
            error instanceof Error ? error.message : "Unexpected network exception.",
          details: error
        };
      }
    }

    return {
      ok: false,
      status: 0,
      code: "network_error",
      message: "Request failed after retry attempts."
    };
  }

  return {
    request
  };
}
