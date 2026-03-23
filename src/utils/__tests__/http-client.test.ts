import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHttpClient, type HttpRequestConfig } from "@/utils/http-client";

// Mock fetch
const createMockFetch = (responses: Array<{ ok: boolean; status: number; data?: unknown; text?: string }>) => {
  let callIndex = 0;
  return vi.fn().mockImplementation(() => {
    const response = responses[callIndex++] ?? responses[responses.length - 1];
    return Promise.resolve({
      ok: response.ok,
      status: response.status,
      statusText: response.ok ? "OK" : "Error",
      headers: new Headers(),
      json: () => Promise.resolve(response.data),
      text: () => Promise.resolve(response.text ?? JSON.stringify(response.data))
    });
  });
};

describe("createHttpClient", () => {
  const baseUrl = "https://api.example.com";

  beforeEach(() => {
    vi.clearAllTimers();
  });

  describe("basic requests", () => {
    it("should make GET request with correct URL", async () => {
      const mockFetch = createMockFetch([{ ok: true, status: 200, data: { id: 1 } }]);
      const client = createHttpClient({ baseUrl, fetcher: mockFetch });

      const result = await client.request({ path: "/users" });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.example.com/users",
        expect.objectContaining({ method: "GET" })
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual({ id: 1 });
        expect(result.status).toBe(200);
      }
    });

    it("should make POST request with body", async () => {
      const mockFetch = createMockFetch([{ ok: true, status: 201, data: { id: 1 } }]);
      const client = createHttpClient({ baseUrl, fetcher: mockFetch });

      await client.request({
        method: "POST",
        path: "/users",
        body: { name: "John" }
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.example.com/users",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ name: "John" })
        })
      );
    });

    it("should handle query parameters", async () => {
      const mockFetch = createMockFetch([{ ok: true, status: 200, data: [] }]);
      const client = createHttpClient({ baseUrl, fetcher: mockFetch });

      await client.request({
        path: "/users",
        query: { page: 1, limit: 10, search: "john", active: true }
      });

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("page=1");
      expect(url).toContain("limit=10");
      expect(url).toContain("search=john");
      expect(url).toContain("active=true");
    });

    it("should skip undefined and null query values", async () => {
      const mockFetch = createMockFetch([{ ok: true, status: 200, data: [] }]);
      const client = createHttpClient({ baseUrl, fetcher: mockFetch });

      await client.request({
        path: "/users",
        query: { page: 1, limit: undefined, search: null, active: true }
      });

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("page=1");
      expect(url).toContain("active=true");
      expect(url).not.toContain("limit");
      expect(url).not.toContain("search");
    });
  });

  describe("headers", () => {
    it("should include default headers", async () => {
      const mockFetch = createMockFetch([{ ok: true, status: 200, data: {} }]);
      const client = createHttpClient({
        baseUrl,
        fetcher: mockFetch,
        defaultHeaders: { "X-Custom": "value" }
      });

      await client.request({ path: "/test" });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            "X-Custom": "value"
          })
        })
      );
    });

    it("should include default Content-Type when no custom headers", async () => {
      const mockFetch = createMockFetch([{ ok: true, status: 200, data: {} }]);
      const client = createHttpClient({
        baseUrl,
        fetcher: mockFetch
      });

      await client.request({ path: "/test" });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            "Content-Type": "application/json"
          })
        })
      );
    });

    it("should merge request headers with defaults", async () => {
      const mockFetch = createMockFetch([{ ok: true, status: 200, data: {} }]);
      const client = createHttpClient({
        baseUrl,
        fetcher: mockFetch,
        defaultHeaders: { "X-Default": "default" }
      });

      await client.request({
        path: "/test",
        headers: { "X-Custom": "custom" }
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            "X-Default": "default",
            "X-Custom": "custom"
          })
        })
      );
    });

    it("should add Authorization header when token provided", async () => {
      const mockFetch = createMockFetch([{ ok: true, status: 200, data: {} }]);
      const client = createHttpClient({
        baseUrl,
        fetcher: mockFetch,
        getAuthToken: () => "my-token"
      });

      await client.request({ path: "/test" });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer my-token"
          })
        })
      );
    });

    it("should not add Authorization when token is null", async () => {
      const mockFetch = createMockFetch([{ ok: true, status: 200, data: {} }]);
      const client = createHttpClient({
        baseUrl,
        fetcher: mockFetch,
        getAuthToken: () => null
      });

      await client.request({ path: "/test" });

      const callArgs = mockFetch.mock.calls[0][1] as { headers: Record<string, string> };
      expect(callArgs.headers.Authorization).toBeUndefined();
    });
  });

  describe("error handling", () => {
    it("should handle HTTP error responses", async () => {
      const mockFetch = createMockFetch([{ ok: false, status: 404, text: "Not Found" }]);
      const client = createHttpClient({ baseUrl, fetcher: mockFetch });

      const result = await client.request({ path: "/users/999" });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.status).toBe(404);
        expect(result.code).toBe("http_error");
      }
    });

    it("should trigger onUnauthorized for 401", async () => {
      const onUnauthorized = vi.fn();
      const mockFetch = createMockFetch([{ ok: false, status: 401, text: "Unauthorized" }]);
      const client = createHttpClient({
        baseUrl,
        fetcher: mockFetch,
        onUnauthorized
      });

      await client.request({ path: "/protected" });

      expect(onUnauthorized).toHaveBeenCalled();
    });

    it("should handle network errors", async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error("Network error"));
      const client = createHttpClient({ baseUrl, fetcher: mockFetch });

      const result = await client.request({ path: "/test" });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("network_error");
        expect(result.message).toContain("Network error");
      }
    });

    it("should handle timeout errors", async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error("timeout"));
      const client = createHttpClient({ baseUrl, fetcher: mockFetch });

      const result = await client.request({ path: "/test" });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("timeout");
      }
    });

    it("should handle invalid JSON responses", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: () => Promise.reject(new Error("Invalid JSON")),
        text: () => Promise.resolve("not json")
      });
      const client = createHttpClient({ baseUrl, fetcher: mockFetch });

      const result = await client.request({ path: "/test" });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("invalid_json");
      }
    });

    it("should handle 204 No Content", async () => {
      const mockFetch = createMockFetch([{ ok: true, status: 204 }]);
      const client = createHttpClient({ baseUrl, fetcher: mockFetch });

      const result = await client.request<undefined>({ path: "/test" });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toBeUndefined();
      }
    });
  });

  describe("retry logic", () => {
    it("should retry on retryable status codes", async () => {
      const mockFetch = createMockFetch([
        { ok: false, status: 500 },
        { ok: false, status: 503 },
        { ok: true, status: 200, data: { success: true } }
      ]);
      const client = createHttpClient({ baseUrl, fetcher: mockFetch });

      const result = await client.request({
        path: "/test",
        retry: 2,
        retryDelayMs: 10
      });

      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(result.ok).toBe(true);
    });

    it("should not retry on non-retryable status codes", async () => {
      const mockFetch = createMockFetch([{ ok: false, status: 400, text: "Bad Request" }]);
      const client = createHttpClient({ baseUrl, fetcher: mockFetch });

      const result = await client.request({
        path: "/test",
        retry: 2
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result.ok).toBe(false);
    });

    it("should retry on network errors", async () => {
      const mockFetch = vi.fn()
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: () => Promise.resolve({ success: true }),
          text: () => Promise.resolve("{}")
        });

      const client = createHttpClient({ baseUrl, fetcher: mockFetch });

      const result = await client.request({
        path: "/test",
        retry: 1,
        retryDelayMs: 10
      });

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result.ok).toBe(true);
    });
  });

  describe("response parsing", () => {
    it("should parse JSON by default", async () => {
      const mockFetch = createMockFetch([{ ok: true, status: 200, data: { name: "John" } }]);
      const client = createHttpClient({ baseUrl, fetcher: mockFetch });

      const result = await client.request<{ name: string }>({ path: "/test" });

      if (result.ok) {
        expect(result.data).toEqual({ name: "John" });
      }
    });

    it("should parse as text when specified", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        text: () => Promise.resolve("plain text response")
      });
      const client = createHttpClient({ baseUrl, fetcher: mockFetch });

      const result = await client.request({ path: "/test", parseAs: "text" });

      if (result.ok) {
        expect(result.data).toBe("plain text response");
      }
    });

    it("should return raw response when specified", async () => {
      const rawResponse = {
        ok: true,
        status: 200,
        headers: new Headers()
      };
      const mockFetch = vi.fn().mockResolvedValue(rawResponse);
      const client = createHttpClient({ baseUrl, fetcher: mockFetch });

      const result = await client.request({ path: "/test", parseAs: "raw" });

      if (result.ok) {
        expect(result.data).toBe(rawResponse);
      }
    });
  });

  describe("URL normalization", () => {
    it("should handle baseUrl with trailing slash", async () => {
      const mockFetch = createMockFetch([{ ok: true, status: 200, data: {} }]);
      const client = createHttpClient({ baseUrl: "https://api.example.com/", fetcher: mockFetch });

      await client.request({ path: "/users" });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.example.com/users",
        expect.any(Object)
      );
    });

    it("should handle path without leading slash", async () => {
      const mockFetch = createMockFetch([{ ok: true, status: 200, data: {} }]);
      const client = createHttpClient({ baseUrl, fetcher: mockFetch });

      await client.request({ path: "users" });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.example.com/users",
        expect.any(Object)
      );
    });
  });

  describe("body handling", () => {
    it("should not send body for GET requests", async () => {
      const mockFetch = createMockFetch([{ ok: true, status: 200, data: {} }]);
      const client = createHttpClient({ baseUrl, fetcher: mockFetch });

      await client.request({
        method: "GET",
        path: "/test",
        body: { data: "should be ignored" }
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ body: undefined })
      );
    });

    it("should send string body as-is", async () => {
      const mockFetch = createMockFetch([{ ok: true, status: 200, data: {} }]);
      const client = createHttpClient({ baseUrl, fetcher: mockFetch });

      await client.request({
        method: "POST",
        path: "/test",
        body: "raw string"
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ body: "raw string" })
      );
    });
  });
});
