import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHttpClient, type HttpResult } from "@/utils/http-client";

describe("HTTP客户端工具函数", () => {
  let mockFetcher: ReturnType<typeof vi.fn>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    mockFetcher = vi.fn();
    mockResponse = {
      ok: true,
      status: 200,
      statusText: "OK",
      headers: new Headers(),
      json: () => Promise.resolve({ data: "test" }),
      text: () => Promise.resolve("text response")
    };
  });

  describe("createHttpClient", () => {
    it("应创建HTTP客户端实例", () => {
      const client = createHttpClient({
        baseUrl: "https://api.example.com",
        fetcher: mockFetcher
      });
      expect(client).toBeDefined();
      expect(client.request).toBeDefined();
    });
  });

  describe("request", () => {
    it("应发送GET请求", async () => {
      mockFetcher.mockResolvedValue(mockResponse);
      const client = createHttpClient({
        baseUrl: "https://api.example.com",
        fetcher: mockFetcher
      });

      const result = await client.request({ path: "/users" });

      expect(mockFetcher).toHaveBeenCalledWith(
        "https://api.example.com/users",
        expect.objectContaining({
          method: "GET"
        })
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual({ data: "test" });
      }
    });

    it("应发送POST请求", async () => {
      mockFetcher.mockResolvedValue(mockResponse);
      const client = createHttpClient({
        baseUrl: "https://api.example.com",
        fetcher: mockFetcher
      });

      const result = await client.request({
        method: "POST",
        path: "/users",
        body: { name: "John" }
      });

      expect(mockFetcher).toHaveBeenCalledWith(
        "https://api.example.com/users",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ name: "John" })
        })
      );
      expect(result.ok).toBe(true);
    });

    it("应添加查询参数", async () => {
      mockFetcher.mockResolvedValue(mockResponse);
      const client = createHttpClient({
        baseUrl: "https://api.example.com",
        fetcher: mockFetcher
      });

      await client.request({
        path: "/users",
        query: { page: 1, limit: 10, filter: "active" }
      });

      expect(mockFetcher).toHaveBeenCalledWith(
        "https://api.example.com/users?page=1&limit=10&filter=active",
        expect.any(Object)
      );
    });

    it("应忽略null和undefined的查询参数", async () => {
      mockFetcher.mockResolvedValue(mockResponse);
      const client = createHttpClient({
        baseUrl: "https://api.example.com",
        fetcher: mockFetcher
      });

      await client.request({
        path: "/users",
        query: { page: 1, limit: null, filter: undefined }
      });

      expect(mockFetcher).toHaveBeenCalledWith(
        "https://api.example.com/users?page=1",
        expect.any(Object)
      );
    });

    it("应添加认证令牌", async () => {
      mockFetcher.mockResolvedValue(mockResponse);
      const client = createHttpClient({
        baseUrl: "https://api.example.com",
        fetcher: mockFetcher,
        getAuthToken: () => "test-token-123"
      });

      await client.request({ path: "/protected" });

      expect(mockFetcher).toHaveBeenCalledWith(
        "https://api.example.com/protected",
        expect.objectContaining({
          headers: expect.objectContaining({
            "Authorization": "Bearer test-token-123"
          })
        })
      );
    });

    it("应合并自定义请求头", async () => {
      mockFetcher.mockResolvedValue(mockResponse);
      const client = createHttpClient({
        baseUrl: "https://api.example.com",
        fetcher: mockFetcher,
        defaultHeaders: { "X-Default": "default-value" }
      });

      await client.request({
        path: "/users",
        headers: { "X-Custom": "custom-value" }
      });

      expect(mockFetcher).toHaveBeenCalledWith(
        "https://api.example.com/users",
        expect.objectContaining({
          headers: expect.objectContaining({
            "X-Default": "default-value",
            "X-Custom": "custom-value"
          })
        })
      );
    });

    it("应处理204无内容响应", async () => {
      mockFetcher.mockResolvedValue({
        ...mockResponse,
        status: 204,
        json: () => Promise.reject(new Error("No content"))
      });
      const client = createHttpClient({
        baseUrl: "https://api.example.com",
        fetcher: mockFetcher
      });

      const result = await client.request({ path: "/no-content" });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toBeUndefined();
      }
    });

    it("应处理HTTP错误响应", async () => {
      mockFetcher.mockResolvedValue({
        ...mockResponse,
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: () => Promise.resolve("Resource not found")
      });
      const client = createHttpClient({
        baseUrl: "https://api.example.com",
        fetcher: mockFetcher
      });

      const result = await client.request({ path: "/not-found" });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.status).toBe(404);
        expect(result.code).toBe("http_error");
        expect(result.message).toBe("Resource not found");
      }
    });

    it("应处理网络错误", async () => {
      mockFetcher.mockRejectedValue(new Error("Network failure"));
      const client = createHttpClient({
        baseUrl: "https://api.example.com",
        fetcher: mockFetcher
      });

      const result = await client.request({ path: "/users" });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("network_error");
        expect(result.message).toContain("Network failure");
      }
    });

    it("应处理无效JSON响应", async () => {
      mockFetcher.mockResolvedValue({
        ...mockResponse,
        json: () => Promise.reject(new Error("Invalid JSON"))
      });
      const client = createHttpClient({
        baseUrl: "https://api.example.com",
        fetcher: mockFetcher
      });

      const result = await client.request({ path: "/bad-json" });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("invalid_json");
      }
    });

    it("应返回文本响应", async () => {
      mockFetcher.mockResolvedValue(mockResponse);
      const client = createHttpClient({
        baseUrl: "https://api.example.com",
        fetcher: mockFetcher
      });

      const result = await client.request<string>({
        path: "/text",
        parseAs: "text"
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toBe("text response");
      }
    });

    it("应返回原始响应", async () => {
      mockFetcher.mockResolvedValue(mockResponse);
      const client = createHttpClient({
        baseUrl: "https://api.example.com",
        fetcher: mockFetcher
      });

      const result = await client.request<Response>({
        path: "/raw",
        parseAs: "raw"
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toBeDefined();
      }
    });

    it("应在401未授权时调用onUnauthorized", async () => {
      const onUnauthorized = vi.fn();
      mockFetcher.mockResolvedValue({
        ...mockResponse,
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        text: () => Promise.resolve("Unauthorized")
      });
      const client = createHttpClient({
        baseUrl: "https://api.example.com",
        fetcher: mockFetcher,
        onUnauthorized
      });

      await client.request({ path: "/protected" });

      expect(onUnauthorized).toHaveBeenCalled();
    });

    it("应规范化基础URL和路径", async () => {
      mockFetcher.mockResolvedValue(mockResponse);
      const client = createHttpClient({
        baseUrl: "https://api.example.com/",
        fetcher: mockFetcher
      });

      await client.request({ path: "users" });
      expect(mockFetcher).toHaveBeenCalledWith(
        "https://api.example.com/users",
        expect.any(Object)
      );

      await client.request({ path: "/users" });
      expect(mockFetcher).toHaveBeenCalledWith(
        "https://api.example.com/users",
        expect.any(Object)
      );
    });

    it("应在GET请求中忽略body", async () => {
      mockFetcher.mockResolvedValue(mockResponse);
      const client = createHttpClient({
        baseUrl: "https://api.example.com",
        fetcher: mockFetcher
      });

      await client.request({
        path: "/users",
        body: { should: "be-ignored" }
      });

      expect(mockFetcher).toHaveBeenCalledWith(
        "https://api.example.com/users",
        expect.objectContaining({
          body: undefined
        })
      );
    });
  });

  describe("重试机制", () => {
    it("应在可重试状态码下重试请求", async () => {
      mockFetcher
        .mockResolvedValueOnce({
          ...mockResponse,
          ok: false,
          status: 500,
          statusText: "Internal Server Error",
          text: () => Promise.resolve("Server error")
        })
        .mockResolvedValueOnce({
          ...mockResponse,
          ok: true,
          status: 200
        });

      const client = createHttpClient({
        baseUrl: "https://api.example.com",
        fetcher: mockFetcher
      });

      const result = await client.request({
        path: "/unstable",
        retry: 1,
        retryDelayMs: 10
      });

      expect(mockFetcher).toHaveBeenCalledTimes(2);
      expect(result.ok).toBe(true);
    });

    it("应在网络错误时重试请求", async () => {
      mockFetcher
        .mockRejectedValueOnce(new Error("Network failure"))
        .mockResolvedValueOnce(mockResponse);

      const client = createHttpClient({
        baseUrl: "https://api.example.com",
        fetcher: mockFetcher
      });

      const result = await client.request({
        path: "/unstable",
        retry: 1,
        retryDelayMs: 10
      });

      expect(mockFetcher).toHaveBeenCalledTimes(2);
      expect(result.ok).toBe(true);
    });

    it("应在重试次数用尽后返回失败", async () => {
      mockFetcher.mockRejectedValue(new Error("Network failure"));

      const client = createHttpClient({
        baseUrl: "https://api.example.com",
        fetcher: mockFetcher
      });

      const result = await client.request({
        path: "/failing",
        retry: 2,
        retryDelayMs: 10
      });

      expect(mockFetcher).toHaveBeenCalledTimes(3);
      expect(result.ok).toBe(false);
    });

    it("不应重试400错误", async () => {
      mockFetcher.mockResolvedValue({
        ...mockResponse,
        ok: false,
        status: 400,
        statusText: "Bad Request",
        text: () => Promise.resolve("Invalid request")
      });

      const client = createHttpClient({
        baseUrl: "https://api.example.com",
        fetcher: mockFetcher
      });

      const result = await client.request({
        path: "/bad-request",
        retry: 2,
        retryDelayMs: 10
      });

      expect(mockFetcher).toHaveBeenCalledTimes(1);
      expect(result.ok).toBe(false);
    });
  });

  describe("超时处理", () => {
    it("应在超时后中止请求", async () => {
      mockFetcher.mockImplementation((_url: string, options: RequestInit) => 
        new Promise((resolve, reject) => {
          const signal = options.signal;
          
          const abortHandler = () => {
            const error = new Error("timeout");
            error.name = "AbortError";
            reject(error);
          };
          
          signal?.addEventListener("abort", abortHandler, { once: true });
          
          setTimeout(() => {
            signal?.removeEventListener("abort", abortHandler);
            resolve(mockResponse);
          }, 100);
        })
      );

      const client = createHttpClient({
        baseUrl: "https://api.example.com",
        fetcher: mockFetcher
      });

      const result = await client.request({
        path: "/slow",
        timeoutMs: 50
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("timeout");
      }
    });

    it("应支持外部AbortSignal", async () => {
      const controller = new AbortController();
      mockFetcher.mockImplementation((_url: string, options: RequestInit) => 
        new Promise((resolve, reject) => {
          const signal = options.signal;
          
          const abortHandler = () => {
            const error = new Error("aborted");
            error.name = "AbortError";
            reject(error);
          };
          
          signal?.addEventListener("abort", abortHandler, { once: true });
          
          setTimeout(() => {
            signal?.removeEventListener("abort", abortHandler);
            resolve(mockResponse);
          }, 100);
        })
      );

      const client = createHttpClient({
        baseUrl: "https://api.example.com",
        fetcher: mockFetcher
      });

      setTimeout(() => controller.abort(), 30);

      const result = await client.request({
        path: "/abort",
        signal: controller.signal
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        // 外部中止信号会被识别为超时类型的中止
        expect(result.code).toBe("timeout");
      }
    });
  });
});
