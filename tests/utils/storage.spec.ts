import { describe, it, expect, beforeEach, vi } from "vitest";
import { createDraftManager, type DraftManager } from "@/utils/storage";

interface TestData {
  title: string;
  content: string;
}

describe("存储工具函数", () => {
  let mockStorage: Map<string, string>;
  let storageImpl: Storage;
  let draftManager: DraftManager<TestData>;

  beforeEach(() => {
    mockStorage = new Map<string, string>();
    storageImpl = {
      getItem: (key: string) => mockStorage.get(key) ?? null,
      setItem: (key: string, value: string) => mockStorage.set(key, value),
      removeItem: (key: string) => mockStorage.delete(key),
      clear: () => mockStorage.clear(),
      key: (index: number) => Array.from(mockStorage.keys())[index] ?? null,
      get length() {
        return mockStorage.size;
      }
    };

    draftManager = createDraftManager<TestData>({
      namespace: "test",
      version: "v1",
      ttlMs: 1000 * 60 * 60,
      storage: storageImpl
    });
  });

  describe("createDraftManager", () => {
    it("应创建草稿管理器实例", () => {
      expect(draftManager).toBeDefined();
      expect(draftManager.save).toBeDefined();
      expect(draftManager.load).toBeDefined();
      expect(draftManager.remove).toBeDefined();
      expect(draftManager.listIds).toBeDefined();
      expect(draftManager.clearNamespace).toBeDefined();
    });

    it("应使用默认值创建草稿管理器", () => {
      const manager = createDraftManager<TestData>({
        namespace: "test-defaults",
        storage: storageImpl
      });
      expect(manager).toBeDefined();
    });
  });

  describe("save", () => {
    it("应保存草稿数据", () => {
      const data: TestData = { title: "Test", content: "Content" };
      draftManager.save("draft-1", data);
      
      const saved = storageImpl.getItem("test:draft-1");
      expect(saved).toBeDefined();
      
      const parsed = JSON.parse(saved!);
      expect(parsed.value).toEqual(data);
      expect(parsed.version).toBe("v1");
      expect(parsed.updatedAt).toBeDefined();
      expect(parsed.expireAt).toBeDefined();
    });

    it("应使用自定义TTL保存草稿", () => {
      const data: TestData = { title: "Test", content: "Content" };
      const customTtl = 1000 * 60 * 30;
      draftManager.save("draft-1", data, customTtl);
      
      const saved = storageImpl.getItem("test:draft-1");
      const parsed = JSON.parse(saved!);
      expect(parsed.expireAt - parsed.updatedAt).toBe(customTtl);
    });

    it("应覆盖现有草稿", () => {
      const data1: TestData = { title: "Test 1", content: "Content 1" };
      const data2: TestData = { title: "Test 2", content: "Content 2" };
      
      draftManager.save("draft-1", data1);
      draftManager.save("draft-1", data2);
      
      const loaded = draftManager.load("draft-1");
      expect(loaded).toEqual(data2);
    });
  });

  describe("load", () => {
    it("应加载现有草稿", () => {
      const data: TestData = { title: "Test", content: "Content" };
      draftManager.save("draft-1", data);
      
      const loaded = draftManager.load("draft-1");
      expect(loaded).toEqual(data);
    });

    it("应在草稿不存在时返回null", () => {
      const loaded = draftManager.load("non-existent");
      expect(loaded).toBeNull();
    });

    it("应在版本不匹配时返回null", () => {
      const data: TestData = { title: "Test", content: "Content" };
      const envelope = {
        version: "v2",
        updatedAt: Date.now(),
        expireAt: Date.now() + 1000 * 60 * 60,
        value: data
      };
      storageImpl.setItem("test:draft-1", JSON.stringify(envelope));
      
      const loaded = draftManager.load("draft-1");
      expect(loaded).toBeNull();
    });

    it("应在草稿过期时返回null并清除存储", () => {
      const data: TestData = { title: "Test", content: "Content" };
      const envelope = {
        version: "v1",
        updatedAt: Date.now() - 1000 * 60 * 60 * 2,
        expireAt: Date.now() - 1000 * 60 * 60,
        value: data
      };
      storageImpl.setItem("test:draft-1", JSON.stringify(envelope));
      
      const loaded = draftManager.load("draft-1");
      expect(loaded).toBeNull();
      expect(storageImpl.getItem("test:draft-1")).toBeNull();
    });

    it("应在JSON无效时返回null", () => {
      storageImpl.setItem("test:draft-1", "invalid json");
      
      const loaded = draftManager.load("draft-1");
      expect(loaded).toBeNull();
    });
  });

  describe("remove", () => {
    it("应删除现有草稿", () => {
      const data: TestData = { title: "Test", content: "Content" };
      draftManager.save("draft-1", data);
      
      expect(draftManager.load("draft-1")).toEqual(data);
      
      draftManager.remove("draft-1");
      expect(draftManager.load("draft-1")).toBeNull();
    });

    it("应在草稿不存在时静默处理", () => {
      expect(() => draftManager.remove("non-existent")).not.toThrow();
    });
  });

  describe("listIds", () => {
    it("应返回命名空间内所有草稿ID", () => {
      draftManager.save("draft-1", { title: "Test 1", content: "Content 1" });
      draftManager.save("draft-2", { title: "Test 2", content: "Content 2" });
      
      const ids = draftManager.listIds();
      expect(ids).toEqual(["draft-1", "draft-2"]);
    });

    it("应按排序顺序返回ID", () => {
      draftManager.save("draft-3", { title: "Test 3", content: "Content 3" });
      draftManager.save("draft-1", { title: "Test 1", content: "Content 1" });
      draftManager.save("draft-2", { title: "Test 2", content: "Content 2" });
      
      const ids = draftManager.listIds();
      expect(ids).toEqual(["draft-1", "draft-2", "draft-3"]);
    });

    it("应只返回当前命名空间的ID", () => {
      draftManager.save("draft-1", { title: "Test 1", content: "Content 1" });
      
      const otherManager = createDraftManager<TestData>({
        namespace: "other",
        storage: storageImpl
      });
      otherManager.save("other-1", { title: "Other", content: "Other Content" });
      
      const ids = draftManager.listIds();
      expect(ids).toEqual(["draft-1"]);
      expect(otherManager.listIds()).toEqual(["other-1"]);
    });

    it("应在无草稿时返回空数组", () => {
      const ids = draftManager.listIds();
      expect(ids).toEqual([]);
    });
  });

  describe("clearNamespace", () => {
    it("应清除当前命名空间内所有草稿", () => {
      draftManager.save("draft-1", { title: "Test 1", content: "Content 1" });
      draftManager.save("draft-2", { title: "Test 2", content: "Content 2" });
      
      const otherManager = createDraftManager<TestData>({
        namespace: "other",
        storage: storageImpl
      });
      otherManager.save("other-1", { title: "Other", content: "Other Content" });
      
      draftManager.clearNamespace();
      
      expect(draftManager.listIds()).toEqual([]);
      expect(otherManager.listIds()).toEqual(["other-1"]);
    });

    it("应在命名空间为空时静默处理", () => {
      expect(() => draftManager.clearNamespace()).not.toThrow();
    });
  });

  describe("命名空间隔离", () => {
    it("应在不同命名空间间隔离草稿", () => {
      const manager1 = createDraftManager<TestData>({
        namespace: "ns1",
        storage: storageImpl
      });
      const manager2 = createDraftManager<TestData>({
        namespace: "ns2",
        storage: storageImpl
      });

      manager1.save("draft-1", { title: "NS1 Draft", content: "Content" });
      manager2.save("draft-1", { title: "NS2 Draft", content: "Content" });

      expect(manager1.load("draft-1")?.title).toBe("NS1 Draft");
      expect(manager2.load("draft-1")?.title).toBe("NS2 Draft");
    });
  });

  describe("版本控制", () => {
    it("应在版本变更时使旧草稿失效", () => {
      const oldManager = createDraftManager<TestData>({
        namespace: "version-test",
        version: "v1",
        storage: storageImpl
      });
      
      oldManager.save("draft-1", { title: "Old Version", content: "Content" });
      expect(oldManager.load("draft-1")?.title).toBe("Old Version");

      const newManager = createDraftManager<TestData>({
        namespace: "version-test",
        version: "v2",
        storage: storageImpl
      });
      
      expect(newManager.load("draft-1")).toBeNull();
    });
  });
});
