import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { mix, setProperty } from "@/utils";
import { useTabsStore } from "@/store/tabs";

describe("project smoke checks", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("mix should blend two colors with default weight", () => {
    expect(mix("#ffffff", "#000000")).toBe("#808080");
  });

  it("setProperty should call style.setProperty", () => {
    const setPropertyMock = vi.fn();
    const target = {
      style: {
        setProperty: setPropertyMock
      }
    } as unknown as HTMLElement;

    setProperty("brand-primary", "#1f8a70", target);

    expect(setPropertyMock).toHaveBeenCalledWith("--brand-primary", "#1f8a70");
  });

  it("tabs store should remove current tag and route to next one", () => {
    const store = useTabsStore();
    const push = vi.fn();
    store.$router = { push };
    store.$route = { path: "/tasks" };

    store.setTabsItem({ path: "/tasks", name: "tasks", title: "Task Board" });
    store.setTabsItem({ path: "/reports", name: "reports", title: "Reports" });
    store.activePath = "/tasks";

    const nextPath = store.closeCurrentTag("/tasks");

    expect(nextPath).toBe("/reports");
    expect(store.tabs.map((item) => item.path)).toEqual(["/dashboard", "/reports"]);
    expect(push).toHaveBeenCalledWith("/reports");
  });
});
