import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHttpClient, type HttpResult } from "@/utils/http-client";

function createMockFetch() {
  return vi.fn();
}

describe("createHttpClient", () => {
  let mockFetch: ReturnType<typeof createMockFetch>;
  let client: ReturnType<typeof createHttpClient>;

  beforeEach(() => {
    mockFetch = createMockFetch();
    client = createHttpClient({
      baseUrl: "https://api.example.com",
      fetcher: mockFetch
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("request", () => {
    describe("successful requests", () => {
      it("should make GET request with correct URL", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ data: "test" }),
          headers: new Headers()
        });

        await client.request({ path: "/users" });

        expect(mockFetch).toHaveBeenCalledWith(
          "https://api.example.com/users",
          expect.objectContaining({
            method: "GET"
          })
        );
      });

      it("should normalize URL without leading slash", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({}),
          headers: new Headers()
        });

        await client.request({ path: "users" });

        expect(mockFetch).toHaveBeenCalledWith(
          "https://api.example.com/users",
          expect.any(Object)
        );
      });

      it("should handle baseUrl with trailing slash", async () => {
        const trailingClient = createHttpClient({
          baseUrl: "https://api.example.com/",
          fetcher: mockFetch
        });

        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({}),
          headers: new Headers()
        });

        await trailingClient.request({ path: "/users" });

        expect(mockFetch).toHaveBeenCalledWith(
          "https://api.example.com/users",
          expect.any(Object)
        );
      });

      it("should build query string from object", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({}),
          headers: new Headers()
        });

        await client.request({
          path: "/search",
          query: { q: "test", limit: 10, active: true }
        });

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("?q=test&limit=10&active=true"),
          expect.any(Object)
        );
      });

      it("should skip null and undefined query values", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({}),
          headers: new Headers()
        });

        await client.request({
          path: "/search",
          query: { q: "test", skip: null, ignore: undefined }
        });

        const calledUrl = mockFetch.mock.calls[0][0];
        expect(calledUrl).toContain("q=test");
        expect(calledUrl).not.toContain("skip");
        expect(calledUrl).not.toContain("ignore");
      });

      it("should return success result with data", async () => {
        const responseData = { id: 1, name: "Test" };
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => responseData,
          headers: new Headers({ "content-type": "application/json" })
        });

        const result = (await client.request<{ id: number; name: string }>({
          path: "/users/1"
        })) as HttpResult<{ id: number; name: string }>;

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.status).toBe(200);
          expect(result.data).toEqual(responseData);
          expect(result.headers).toBeInstanceOf(Headers);
        }
      });

      it("should handle 204 No Content", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 204,
          json: async () => undefined,
          headers: new Headers()
        });

        const result = await client.request({ path: "/users/1", method: "DELETE" });

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.status).toBe(204);
          expect(result.data).toBeUndefined();
        }
      });
    });

    describe("request methods", () => {
      it("should use POST method", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 201,
          json: async () => ({ id: 1 }),
          headers: new Headers()
        });

        await client.request({ path: "/users", method: "POST", body: { name: "Test" } });

        expect(mockFetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({ method: "POST" })
        );
      });

      it("should use PUT method", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({}),
          headers: new Headers()
        });

        await client.request({ path: "/users/1", method: "PUT", body: { name: "Updated" } });

        expect(mockFetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({ method: "PUT" })
        );
      });

      it("should use PATCH method", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({}),
          headers: new Headers()
        });

        await client.request({ path: "/users/1", method: "PATCH", body: { name: "Patched" } });

        expect(mockFetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({ method: "PATCH" })
        );
      });

      it("should use DELETE method", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 204,
          json: async () => undefined,
          headers: new Headers()
        });

        await client.request({ path: "/users/1", method: "DELETE" });

        expect(mockFetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({ method: "DELETE" })
        );
      });
    });

    describe("headers", () => {
      it("should include default Content-Type header", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({}),
          headers: new Headers()
        });

        await client.request({ path: "/users" });

        const options = mockFetch.mock.calls[0][1];
        expect(options.headers["Content-Type"]).toBe("application/json");
      });

      it("should merge custom headers", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({}),
          headers: new Headers()
        });

        await client.request({
          path: "/users",
          headers: { "X-Custom-Header": "custom-value" }
        });

        const options = mockFetch.mock.calls[0][1];
        expect(options.headers["X-Custom-Header"]).toBe("custom-value");
        expect(options.headers["Content-Type"]).toBe("application/json");
      });

      it("should include Authorization header when token is provided", async () => {
        const authClient = createHttpClient({
          baseUrl: "https://api.example.com",
          fetcher: mockFetch,
          getAuthToken: () => "test-token-123"
        });

        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({}),
          headers: new Headers()
        });

        await authClient.request({ path: "/users" });

        const options = mockFetch.mock.calls[0][1];
        expect(options.headers["Authorization"]).toBe("Bearer test-token-123");
      });

      it("should not include Authorization header when token is null", async () => {
        const authClient = createHttpClient({
          baseUrl: "https://api.example.com",
          fetcher: mockFetch,
          getAuthToken: () => null
        });

        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({}),
          headers: new Headers()
        });

        await authClient.request({ path: "/users" });

        const options = mockFetch.mock.calls[0][1];
        expect(options.headers["Authorization"]).toBeUndefined();
      });

      it("should use custom default headers", async () => {
        const customClient = createHttpClient({
          baseUrl: "https://api.example.com",
          fetcher: mockFetch,
          defaultHeaders: { "X-Api-Key": "key-123" }
        });

        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({}),
          headers: new Headers()
        });

        await customClient.request({ path: "/users" });

        const options = mockFetch.mock.calls[0][1];
        expect(options.headers["X-Api-Key"]).toBe("key-123");
      });
    });

    describe("body handling", () => {
      it("should JSON stringify body object", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 201,
          json: async () => ({}),
          headers: new Headers()
        });

        await client.request({
          path: "/users",
          method: "POST",
          body: { name: "Test", count: 42 }
        });

        const options = mockFetch.mock.calls[0][1];
        expect(options.body).toBe('{"name":"Test","count":42}');
      });

      it("should pass string body as-is", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 201,
          json: async () => ({}),
          headers: new Headers()
        });

        await client.request({
          path: "/users",
          method: "POST",
          body: "raw string body"
        });

        const options = mockFetch.mock.calls[0][1];
        expect(options.body).toBe("raw string body");
      });

      it("should not include body for GET requests", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({}),
          headers: new Headers()
        });

        await client.request({ path: "/users", method: "GET", body: { data: "test" } });

        const options = mockFetch.mock.calls[0][1];
        expect(options.body).toBeUndefined();
      });
    });

    describe("error handling", () => {
      it("should return http_error for non-ok response", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: "Not Found",
          text: async () => "Resource not found"
        });

        const result = await client.request({ path: "/users/999" });

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.code).toBe("http_error");
          expect(result.status).toBe(404);
          expect(result.message).toBe("Resource not found");
        }
      });

      it("should return http_error with statusText when no body", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: "Internal Server Error",
          text: async () => ""
        });

        const result = await client.request({ path: "/error" });

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.message).toBe("Internal Server Error");
        }
      });

      it("should return invalid_json for JSON parse error", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => {
            throw new Error("Unexpected token");
          },
          headers: new Headers()
        });

        const result = await client.request({ path: "/users" });

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.code).toBe("invalid_json");
          expect(result.status).toBe(200);
        }
      });

      it("should return network_error for fetch failure", async () => {
        mockFetch.mockRejectedValueOnce(new Error("Network failure"));

        const result = await client.request({ path: "/users" });

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.code).toBe("network_error");
          expect(result.status).toBe(0);
          expect(result.message).toBe("Network failure");
        }
      });

      it("should return timeout for abort error", async () => {
        const abortError = new Error("The operation was aborted");
        abortError.name = "AbortError";
        mockFetch.mockRejectedValueOnce(abortError);

        const result = await client.request({ path: "/users" });

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.code).toBe("timeout");
        }
      });
    });

    describe("401 handling", () => {
      it("should call onUnauthorized for 401 response", async () => {
        const onUnauthorized = vi.fn();
        const authClient = createHttpClient({
          baseUrl: "https://api.example.com",
          fetcher: mockFetch,
          onUnauthorized
        });

        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 401,
          statusText: "Unauthorized",
          text: async () => "Token expired"
        });

        await authClient.request({ path: "/protected" });

        expect(onUnauthorized).toHaveBeenCalled();
      });
    });

    describe("retry logic", () => {
      it("should retry on retryable status codes", async () => {
        mockFetch
          .mockResolvedValueOnce({
            ok: false,
            status: 503,
            statusText: "Service Unavailable",
            text: async () => "Temporarily unavailable"
          })
          .mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({ success: true }),
            headers: new Headers()
          });

        const result = await client.request({ path: "/users", retry: 1 });

        expect(mockFetch).toHaveBeenCalledTimes(2);
        expect(result.ok).toBe(true);
      });

      it("should not retry on non-retryable status codes", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 400,
          statusText: "Bad Request",
          text: async () => "Invalid input"
        });

        await client.request({ path: "/users", retry: 2 });

        expect(mockFetch).toHaveBeenCalledTimes(1);
      });

      it("should retry on network error", async () => {
        mockFetch
          .mockRejectedValueOnce(new Error("Network error"))
          .mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({ success: true }),
            headers: new Headers()
          });

        const result = await client.request({ path: "/users", retry: 1 });

        expect(mockFetch).toHaveBeenCalledTimes(2);
        expect(result.ok).toBe(true);
      });

      it("should return error after all retries exhausted", async () => {
        mockFetch.mockResolvedValue({
          ok: false,
          status: 503,
          statusText: "Service Unavailable",
          text: async () => "Still unavailable"
        });

        const result = await client.request({ path: "/users", retry: 2 });

        expect(mockFetch).toHaveBeenCalledTimes(3);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.code).toBe("http_error");
        }
      });
    });

    describe("parse modes", () => {
      it("should return raw Response when parseAs is raw", async () => {
        const mockResponse = {
          ok: true,
          status: 200,
          json: async () => ({}),
          headers: new Headers()
        };
        mockFetch.mockResolvedValueOnce(mockResponse);

        const result = await client.request({ path: "/users", parseAs: "raw" });

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.data).toBe(mockResponse);
        }
      });

      it("should return text when parseAs is text", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => "plain text response",
          headers: new Headers()
        });

        const result = await client.request({ path: "/text", parseAs: "text" });

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.data).toBe("plain text response");
        }
      });
    });

    describe("timeout", () => {
      it("should use custom timeout", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({}),
          headers: new Headers()
        });

        await client.request({ path: "/users", timeoutMs: 5000 });

        expect(mockFetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            signal: expect.any(AbortSignal)
          })
        );
      });
    });

    describe("external abort signal", () => {
      it("should respect external abort signal", async () => {
        const controller = new AbortController();
        controller.abort();

        const result = await client.request({
          path: "/users",
          signal: controller.signal
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(["timeout", "network_error"]).toContain(result.code);
        }
      });
    });
  });
});
