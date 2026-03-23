import { describe, it, expect, vi } from "vitest";
import {
  clamp,
  normalizeHex,
  hexToRgb,
  rgbToHex,
  mix,
  withAlpha,
  isDark,
  toCssVar,
  setProperty,
  setProperties
} from "@/utils/index";

describe("clamp", () => {
  it("should clamp value within range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it("should return value when min > max (edge case)", () => {
    expect(clamp(5, 10, 0)).toBe(5);
  });

  it("should handle boundary values", () => {
    expect(clamp(0, 0, 10)).toBe(0);
    expect(clamp(10, 0, 10)).toBe(10);
  });
});

describe("normalizeHex", () => {
  it("should normalize 6-digit hex colors", () => {
    expect(normalizeHex("#1f8a70")).toBe("#1f8a70");
    expect(normalizeHex("1f8a70")).toBe("#1f8a70");
    expect(normalizeHex("#1F8A70")).toBe("#1f8a70");
  });

  it("should expand 3-digit shorthand hex", () => {
    expect(normalizeHex("#abc")).toBe("#aabbcc");
    expect(normalizeHex("ABC")).toBe("#aabbcc");
    expect(normalizeHex("#f0f")).toBe("#ff00ff");
  });

  it("should trim whitespace", () => {
    expect(normalizeHex("  #1f8a70  ")).toBe("#1f8a70");
  });

  it("should throw for invalid hex colors", () => {
    expect(() => normalizeHex("")).toThrow("Invalid hex color");
    expect(() => normalizeHex("#12")).toThrow("Invalid hex color");
    expect(() => normalizeHex("#12345")).toThrow("Invalid hex color");
    expect(() => normalizeHex("#1234567")).toThrow("Invalid hex color");
    expect(() => normalizeHex("not-a-color")).toThrow("Invalid hex color");
  });
});

describe("hexToRgb", () => {
  it("should convert hex to RGB correctly", () => {
    expect(hexToRgb("#ffffff")).toEqual({ r: 255, g: 255, b: 255 });
    expect(hexToRgb("#000000")).toEqual({ r: 0, g: 0, b: 0 });
    expect(hexToRgb("#ff0000")).toEqual({ r: 255, g: 0, b: 0 });
    expect(hexToRgb("#00ff00")).toEqual({ r: 0, g: 255, b: 0 });
    expect(hexToRgb("#0000ff")).toEqual({ r: 0, g: 0, b: 255 });
  });

  it("should handle 3-digit shorthand", () => {
    expect(hexToRgb("#fff")).toEqual({ r: 255, g: 255, b: 255 });
    expect(hexToRgb("#abc")).toEqual({ r: 170, g: 187, b: 204 });
  });
});

describe("rgbToHex", () => {
  it("should convert RGB to hex correctly", () => {
    expect(rgbToHex(255, 255, 255)).toBe("#ffffff");
    expect(rgbToHex(0, 0, 0)).toBe("#000000");
    expect(rgbToHex(255, 0, 0)).toBe("#ff0000");
  });

  it("should clamp out-of-range values", () => {
    expect(rgbToHex(-10, 300, 128)).toBe("#00ff80");
    expect(rgbToHex(0, 0, 0)).toBe("#000000");
    expect(rgbToHex(255, 255, 255)).toBe("#ffffff");
  });

  it("should round decimal values", () => {
    expect(rgbToHex(128.4, 128.6, 128)).toBe("#808180");
  });
});

describe("mix", () => {
  it("should mix colors with default 50% weight", () => {
    expect(mix("#ffffff", "#000000")).toBe("#808080");
    expect(mix("#ff0000", "#0000ff")).toBe("#800080");
  });

  it("should respect custom weight", () => {
    expect(mix("#ffffff", "#000000", 0)).toBe("#000000");
    expect(mix("#ffffff", "#000000", 100)).toBe("#ffffff");
    expect(mix("#ffffff", "#000000", 25)).toBe("#404040");
    expect(mix("#ffffff", "#000000", 75)).toBe("#bfbfbf");
  });

  it("should clamp weight to valid range", () => {
    expect(mix("#ffffff", "#000000", -10)).toBe("#000000");
    expect(mix("#ffffff", "#000000", 110)).toBe("#ffffff");
  });
});

describe("withAlpha", () => {
  it("should create rgba string with default alpha", () => {
    expect(withAlpha("#ff0000")).toBe("rgba(255, 0, 0, 1)");
    expect(withAlpha("#00ff00")).toBe("rgba(0, 255, 0, 1)");
  });

  it("should apply custom alpha", () => {
    expect(withAlpha("#ff0000", 0.5)).toBe("rgba(255, 0, 0, 0.5)");
    expect(withAlpha("#000000", 0)).toBe("rgba(0, 0, 0, 0)");
  });

  it("should clamp alpha to valid range", () => {
    expect(withAlpha("#ff0000", -0.5)).toBe("rgba(255, 0, 0, 0)");
    expect(withAlpha("#ff0000", 1.5)).toBe("rgba(255, 0, 0, 1)");
  });
});

describe("isDark", () => {
  it("should identify dark colors", () => {
    expect(isDark("#000000")).toBe(true);
    expect(isDark("#1a1a1a")).toBe(true);
    expect(isDark("#333333")).toBe(true);
  });

  it("should identify light colors", () => {
    expect(isDark("#ffffff")).toBe(false);
    expect(isDark("#f0f0f0")).toBe(false);
    expect(isDark("#cccccc")).toBe(false);
  });

  it("should handle medium gray around threshold", () => {
    expect(isDark("#808080")).toBe(true);
    expect(isDark("#909090")).toBe(false);
  });
});

describe("toCssVar", () => {
  it("should normalize CSS variable names", () => {
    expect(toCssVar("brand-primary")).toBe("--brand-primary");
    expect(toCssVar("--brand-primary")).toBe("--brand-primary");
  });

  it("should trim whitespace", () => {
    expect(toCssVar("  brand-primary  ")).toBe("--brand-primary");
  });
});

describe("setProperty", () => {
  it("should set CSS custom property on target", () => {
    const setPropertyMock = vi.fn();
    const target = {
      style: { setProperty: setPropertyMock }
    } as unknown as HTMLElement;

    setProperty("brand-primary", "#1f8a70", target);

    expect(setPropertyMock).toHaveBeenCalledWith("--brand-primary", "#1f8a70");
  });

  it("should default to document.documentElement", () => {
    const originalSetProperty = document.documentElement.style.setProperty;
    const setPropertyMock = vi.fn();
    document.documentElement.style.setProperty = setPropertyMock;

    setProperty("brand-primary", "#1f8a70");

    expect(setPropertyMock).toHaveBeenCalledWith("--brand-primary", "#1f8a70");

    document.documentElement.style.setProperty = originalSetProperty;
  });
});

describe("setProperties", () => {
  it("should set multiple CSS properties", () => {
    const setPropertyMock = vi.fn();
    const target = {
      style: { setProperty: setPropertyMock }
    } as unknown as HTMLElement;

    setProperties(
      {
        "brand-primary": "#1f8a70",
        "brand-secondary": "#2c3e50"
      },
      target
    );

    expect(setPropertyMock).toHaveBeenCalledTimes(2);
    expect(setPropertyMock).toHaveBeenCalledWith("--brand-primary", "#1f8a70");
    expect(setPropertyMock).toHaveBeenCalledWith("--brand-secondary", "#2c3e50");
  });
});
