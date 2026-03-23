import { describe, it, expect, vi, beforeEach } from "vitest";
import { createDraftManager } from "@/utils/storage";

// Mock localStorage for tests
class MockStorage implements Storage {
  private store: Map<string, string> = new Map();

  get length(): number {
    return this.store.size;
  }

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  key(index: number): string | null {
    const keys = Array.from(this.store.keys());
    return keys[index] ?? null;
  }
}

describe("createDraftManager", () => {
  let mockStorage: MockStorage;
  const now = 1000000000000;

  beforeEach(() => {
    mockStorage = new MockStorage();
    vi.useFakeTimers();
    vi.setSystemTime(now);
  });

  it("should save and load draft", () => {
    const manager = createDraftManager<{ title: string }>({
      namespace: "test",
      version: "v1",
      storage: mockStorage
    });

    manager.save("doc1", { title: "Hello" });
    const loaded = manager.load("doc1");

    expect(loaded).toEqual({ title: "Hello" });
  });

  it("should return null for non-existent draft", () => {
    const manager = createDraftManager<{ title: string }>({
      namespace: "test",
      version: "v1",
      storage: mockStorage
    });

    const loaded = manager.load("non-existent");
    expect(loaded).toBeNull();
  });

  it("should return null for expired draft", () => {
    const manager = createDraftManager<{ title: string }>({
      namespace: "test",
      version: "v1",
      ttlMs: 1000,
      storage: mockStorage
    });

    manager.save("doc1", { title: "Hello" });

    vi.advanceTimersByTime(1001);

    const loaded = manager.load("doc1");
    expect(loaded).toBeNull();
  });

  it("should remove expired draft when loading", () => {
    const manager = createDraftManager<{ title: string }>({
      namespace: "test",
      version: "v1",
      ttlMs: 1000,
      storage: mockStorage
    });

    manager.save("doc1", { title: "Hello" });
    vi.advanceTimersByTime(1001);
    manager.load("doc1");

    expect(mockStorage.getItem("test:doc1")).toBeNull();
  });

  it("should return null for version mismatch", () => {
    const managerV1 = createDraftManager<{ title: string }>({
      namespace: "test",
      version: "v1",
      storage: mockStorage
    });

    managerV1.save("doc1", { title: "Hello" });

    const managerV2 = createDraftManager<{ title: string }>({
      namespace: "test",
      version: "v2",
      storage: mockStorage
    });

    const loaded = managerV2.load("doc1");
    expect(loaded).toBeNull();
  });

  it("should remove draft", () => {
    const manager = createDraftManager<{ title: string }>({
      namespace: "test",
      version: "v1",
      storage: mockStorage
    });

    manager.save("doc1", { title: "Hello" });
    manager.remove("doc1");

    expect(manager.load("doc1")).toBeNull();
    expect(mockStorage.getItem("test:doc1")).toBeNull();
  });

  it("should list all draft IDs in namespace", () => {
    const manager = createDraftManager<{ title: string }>({
      namespace: "test",
      version: "v1",
      storage: mockStorage
    });

    manager.save("doc1", { title: "First" });
    manager.save("doc2", { title: "Second" });
    manager.save("doc3", { title: "Third" });

    const ids = manager.listIds();
    expect(ids).toEqual(["doc1", "doc2", "doc3"]);
  });

  it("should only list IDs from own namespace", () => {
    const managerA = createDraftManager<{ title: string }>({
      namespace: "namespaceA",
      version: "v1",
      storage: mockStorage
    });

    const managerB = createDraftManager<{ title: string }>({
      namespace: "namespaceB",
      version: "v1",
      storage: mockStorage
    });

    managerA.save("doc1", { title: "A1" });
    managerB.save("doc1", { title: "B1" });

    expect(managerA.listIds()).toEqual(["doc1"]);
    expect(managerB.listIds()).toEqual(["doc1"]);
  });

  it("should clear all drafts in namespace", () => {
    const manager = createDraftManager<{ title: string }>({
      namespace: "test",
      version: "v1",
      storage: mockStorage
    });

    manager.save("doc1", { title: "First" });
    manager.save("doc2", { title: "Second" });

    manager.clearNamespace();

    expect(manager.listIds()).toEqual([]);
    expect(manager.load("doc1")).toBeNull();
    expect(manager.load("doc2")).toBeNull();
  });

  it("should use custom TTL when saving", () => {
    const manager = createDraftManager<{ title: string }>({
      namespace: "test",
      version: "v1",
      ttlMs: 1000,
      storage: mockStorage
    });

    manager.save("doc1", { title: "Hello" }, 5000);

    vi.advanceTimersByTime(1001);
    expect(manager.load("doc1")).toEqual({ title: "Hello" });

    vi.advanceTimersByTime(4000);
    expect(manager.load("doc1")).toBeNull();
  });

  it("should handle corrupted JSON gracefully", () => {
    mockStorage.setItem("test:doc1", "not-valid-json");

    const manager = createDraftManager<{ title: string }>({
      namespace: "test",
      version: "v1",
      storage: mockStorage
    });

    const loaded = manager.load("doc1");
    expect(loaded).toBeNull();
  });

  it("should use default TTL when not specified", () => {
    const manager = createDraftManager<{ title: string }>({
      namespace: "test",
      version: "v1",
      ttlMs: 1000 * 60 * 60 * 24, // 24 hours
      storage: mockStorage
    });

    manager.save("doc1", { title: "Hello" });

    vi.advanceTimersByTime(1000 * 60 * 60 * 23); // 23 hours
    expect(manager.load("doc1")).toEqual({ title: "Hello" });

    vi.advanceTimersByTime(1000 * 60 * 60 * 2); // +2 hours = 25 hours total
    expect(manager.load("doc1")).toBeNull();
  });

  it("should use default version when not specified", () => {
    const manager = createDraftManager<{ title: string }>({
      namespace: "test",
      storage: mockStorage
    });

    manager.save("doc1", { title: "Hello" });

    const raw = mockStorage.getItem("test:doc1");
    expect(raw).toContain('"version":"v1"');
  });
});
