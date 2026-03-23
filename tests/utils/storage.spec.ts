import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDraftManager } from "@/utils/storage";

function createMockStorage() {
  const store = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
    key: vi.fn((index: number) => {
      const keys = Array.from(store.keys());
      return keys[index] ?? null;
    }),
    get length() {
      return store.size;
    },
    _store: store
  };
}

describe("createDraftManager", () => {
  let mockStorage: ReturnType<typeof createMockStorage>;
  let manager: ReturnType<typeof createDraftManager<{ title: string; content: string }>>;

  beforeEach(() => {
    mockStorage = createMockStorage();
    manager = createDraftManager({
      namespace: "test_draft",
      version: "v1",
      ttlMs: 1000 * 60 * 60,
      storage: mockStorage
    });
  });

  describe("save", () => {
    it("should save draft with envelope structure", () => {
      manager.save("task-1", { title: "Test", content: "Content" });

      expect(mockStorage.setItem).toHaveBeenCalledWith(
        "test_draft:task-1",
        expect.any(String)
      );

      const savedValue = mockStorage._store.get("test_draft:task-1");
      const parsed = JSON.parse(savedValue!);
      expect(parsed).toHaveProperty("version", "v1");
      expect(parsed).toHaveProperty("value");
      expect(parsed.value).toEqual({ title: "Test", content: "Content" });
    });

    it("should include timestamp and expiry", () => {
      const beforeSave = Date.now();
      manager.save("task-1", { title: "Test", content: "Content" });

      const savedValue = mockStorage._store.get("test_draft:task-1");
      const parsed = JSON.parse(savedValue!);

      expect(parsed.updatedAt).toBeGreaterThanOrEqual(beforeSave);
      expect(parsed.expireAt).toBeGreaterThan(parsed.updatedAt);
    });

    it("should use custom TTL when provided", () => {
      const customTtl = 1000 * 60 * 30;
      manager.save("task-1", { title: "Test", content: "Content" }, customTtl);

      const savedValue = mockStorage._store.get("test_draft:task-1");
      const parsed = JSON.parse(savedValue!);

      expect(parsed.expireAt - parsed.updatedAt).toBe(customTtl);
    });
  });

  describe("load", () => {
    it("should load saved draft", () => {
      manager.save("task-1", { title: "Test", content: "Content" });

      const result = manager.load("task-1");

      expect(result).toEqual({ title: "Test", content: "Content" });
    });

    it("should return null for non-existent draft", () => {
      const result = manager.load("non-existent");

      expect(result).toBeNull();
    });

    it("should return null for invalid JSON", () => {
      mockStorage._store.set("test_draft:task-1", "invalid json");

      const result = manager.load("task-1");

      expect(result).toBeNull();
    });

    it("should return null for version mismatch", () => {
      const envelope = {
        version: "v0",
        updatedAt: Date.now(),
        expireAt: Date.now() + 10000,
        value: { title: "Old", content: "Old content" }
      };
      mockStorage._store.set("test_draft:task-1", JSON.stringify(envelope));

      const result = manager.load("task-1");

      expect(result).toBeNull();
    });

    it("should return null and remove expired draft", () => {
      const envelope = {
        version: "v1",
        updatedAt: Date.now() - 20000,
        expireAt: Date.now() - 10000,
        value: { title: "Expired", content: "Content" }
      };
      mockStorage._store.set("test_draft:task-1", JSON.stringify(envelope));

      const result = manager.load("task-1");

      expect(result).toBeNull();
      expect(mockStorage.removeItem).toHaveBeenCalledWith("test_draft:task-1");
    });
  });

  describe("remove", () => {
    it("should remove draft by id", () => {
      manager.save("task-1", { title: "Test", content: "Content" });
      manager.remove("task-1");

      expect(mockStorage.removeItem).toHaveBeenCalledWith("test_draft:task-1");
      expect(manager.load("task-1")).toBeNull();
    });
  });

  describe("listIds", () => {
    it("should return empty array when no drafts", () => {
      expect(manager.listIds()).toEqual([]);
    });

    it("should list all draft ids in namespace", () => {
      manager.save("task-1", { title: "A", content: "A" });
      manager.save("task-2", { title: "B", content: "B" });

      const ids = manager.listIds();

      expect(ids).toEqual(["task-1", "task-2"]);
    });

    it("should not include drafts from other namespaces", () => {
      manager.save("task-1", { title: "A", content: "A" });
      mockStorage._store.set("other_namespace:task-2", "{}");

      const ids = manager.listIds();

      expect(ids).toEqual(["task-1"]);
    });

    it("should return sorted ids", () => {
      manager.save("task-c", { title: "C", content: "C" });
      manager.save("task-a", { title: "A", content: "A" });
      manager.save("task-b", { title: "B", content: "B" });

      const ids = manager.listIds();

      expect(ids).toEqual(["task-a", "task-b", "task-c"]);
    });
  });

  describe("clearNamespace", () => {
    it("should remove all drafts in namespace", () => {
      manager.save("task-1", { title: "A", content: "A" });
      manager.save("task-2", { title: "B", content: "B" });
      mockStorage._store.set("other_namespace:task-3", "{}");

      manager.clearNamespace();

      expect(manager.listIds()).toEqual([]);
      expect(mockStorage._store.has("other_namespace:task-3")).toBe(true);
    });
  });

  describe("default options", () => {
    it("should use default version when not specified", () => {
      const defaultManager = createDraftManager<{ value: number }>({
        namespace: "default_test",
        storage: mockStorage
      });

      defaultManager.save("item-1", { value: 42 });

      const savedValue = mockStorage._store.get("default_test:item-1");
      const parsed = JSON.parse(savedValue!);
      expect(parsed.version).toBe("v1");
    });

    it("should use default TTL when not specified", () => {
      const defaultManager = createDraftManager<{ value: number }>({
        namespace: "default_test",
        storage: mockStorage
      });

      const beforeSave = Date.now();
      defaultManager.save("item-1", { value: 42 });

      const savedValue = mockStorage._store.get("default_test:item-1");
      const parsed = JSON.parse(savedValue!);
      const expectedTtl = 1000 * 60 * 60 * 24;
      expect(parsed.expireAt - parsed.updatedAt).toBeLessThanOrEqual(expectedTtl + 10);
    });
  });
});
