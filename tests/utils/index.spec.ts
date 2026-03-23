import { describe, expect, it } from "vitest";
import {
  clamp,
  hexToRgb,
  isDark,
  mix,
  normalizeHex,
  rgbToHex,
  setProperties,
  setProperty,
  toCssVar,
  withAlpha
} from "@/utils/index";

describe("clamp", () => {
  it("should return value when min > max", () => {
    expect(clamp(50, 100, 10)).toBe(50);
  });

  it("should return min when value < min", () => {
    expect(clamp(5, 10, 100)).toBe(10);
  });

  it("should return max when value > max", () => {
    expect(clamp(150, 10, 100)).toBe(100);
  });

  it("should return value when within range", () => {
    expect(clamp(50, 0, 100)).toBe(50);
  });

  it("should handle boundary values", () => {
    expect(clamp(0, 0, 100)).toBe(0);
    expect(clamp(100, 0, 100)).toBe(100);
  });
});

describe("normalizeHex", () => {
  it("should normalize 3-digit hex without #", () => {
    expect(normalizeHex("fff")).toBe("#ffffff");
  });

  it("should normalize 3-digit hex with #", () => {
    expect(normalizeHex("#fff")).toBe("#ffffff");
  });

  it("should normalize 6-digit hex without #", () => {
    expect(normalizeHex("ffffff")).toBe("#ffffff");
  });

  it("should normalize 6-digit hex with #", () => {
    expect(normalizeHex("#ffffff")).toBe("#ffffff");
  });

  it("should handle uppercase input", () => {
    expect(normalizeHex("FFF")).toBe("#ffffff");
    expect(normalizeHex("#ABCDEF")).toBe("#abcdef");
  });

  it("should trim whitespace", () => {
    expect(normalizeHex("  #fff  ")).toBe("#ffffff");
  });

  it("should throw for invalid hex format", () => {
    expect(() => normalizeHex("invalid")).toThrow("Invalid hex color");
    expect(() => normalizeHex("#gggggg")).toThrow("Invalid hex color");
    expect(() => normalizeHex("#ff")).toThrow("Invalid hex color");
    expect(() => normalizeHex("#fffff")).toThrow("Invalid hex color");
  });
});

describe("hexToRgb", () => {
  it("should convert black to rgb", () => {
    const result = hexToRgb("#000000");
    expect(result).toEqual({ r: 0, g: 0, b: 0 });
  });

  it("should convert white to rgb", () => {
    const result = hexToRgb("#ffffff");
    expect(result).toEqual({ r: 255, g: 255, b: 255 });
  });

  it("should convert red to rgb", () => {
    const result = hexToRgb("#ff0000");
    expect(result).toEqual({ r: 255, g: 0, b: 0 });
  });

  it("should convert green to rgb", () => {
    const result = hexToRgb("#00ff00");
    expect(result).toEqual({ r: 0, g: 255, b: 0 });
  });

  it("should convert blue to rgb", () => {
    const result = hexToRgb("#0000ff");
    expect(result).toEqual({ r: 0, g: 0, b: 255 });
  });

  it("should handle 3-digit shorthand", () => {
    const result = hexToRgb("#fff");
    expect(result).toEqual({ r: 255, g: 255, b: 255 });
  });

  it("should convert arbitrary color correctly", () => {
    const result = hexToRgb("#1f8a70");
    expect(result).toEqual({ r: 31, g: 138, b: 112 });
  });
});

describe("rgbToHex", () => {
  it("should convert black rgb to hex", () => {
    expect(rgbToHex(0, 0, 0)).toBe("#000000");
  });

  it("should convert white rgb to hex", () => {
    expect(rgbToHex(255, 255, 255)).toBe("#ffffff");
  });

  it("should clamp values below 0", () => {
    expect(rgbToHex(-10, 0, 0)).toBe("#000000");
  });

  it("should clamp values above 255", () => {
    expect(rgbToHex(300, 0, 0)).toBe("#ff0000");
  });

  it("should round decimal values", () => {
    expect(rgbToHex(127.6, 0, 0)).toBe("#800000");
  });

  it("should pad single digit hex values", () => {
    expect(rgbToHex(15, 15, 15)).toBe("#0f0f0f");
  });
});

describe("mix", () => {
  it("should blend white and black equally by default", () => {
    expect(mix("#ffffff", "#000000")).toBe("#808080");
  });

  it("should return first color when weight is 100", () => {
    expect(mix("#ff0000", "#0000ff", 100)).toBe("#ff0000");
  });

  it("should return second color when weight is 0", () => {
    expect(mix("#ff0000", "#0000ff", 0)).toBe("#0000ff");
  });

  it("should clamp weight above 100", () => {
    expect(mix("#ff0000", "#0000ff", 150)).toBe("#ff0000");
  });

  it("should clamp weight below 0", () => {
    expect(mix("#ff0000", "#0000ff", -50)).toBe("#0000ff");
  });

  it("should blend with custom weight", () => {
    const result = mix("#ff0000", "#0000ff", 75);
    expect(result.startsWith("#")).toBe(true);
    expect(result.length).toBe(7);
  });
});

describe("withAlpha", () => {
  it("should create rgba string with default alpha 1", () => {
    expect(withAlpha("#ff0000")).toBe("rgba(255, 0, 0, 1)");
  });

  it("should create rgba string with custom alpha", () => {
    expect(withAlpha("#ff0000", 0.5)).toBe("rgba(255, 0, 0, 0.5)");
  });

  it("should clamp alpha above 1", () => {
    expect(withAlpha("#ff0000", 2)).toBe("rgba(255, 0, 0, 1)");
  });

  it("should clamp alpha below 0", () => {
    expect(withAlpha("#ff0000", -0.5)).toBe("rgba(255, 0, 0, 0)");
  });
});

describe("isDark", () => {
  it("should identify black as dark", () => {
    expect(isDark("#000000")).toBe(true);
  });

  it("should identify white as light", () => {
    expect(isDark("#ffffff")).toBe(false);
  });

  it("should identify dark gray as dark", () => {
    expect(isDark("#333333")).toBe(true);
  });

  it("should identify light gray as light", () => {
    expect(isDark("#cccccc")).toBe(false);
  });

  it("should use luminance formula correctly", () => {
    expect(isDark("#1f8a70")).toBe(true);
    expect(isDark("#87ceeb")).toBe(false);
  });
});

describe("toCssVar", () => {
  it("should add -- prefix if missing", () => {
    expect(toCssVar("brand-primary")).toBe("--brand-primary");
  });

  it("should not duplicate -- prefix", () => {
    expect(toCssVar("--brand-primary")).toBe("--brand-primary");
  });

  it("should trim whitespace", () => {
    expect(toCssVar("  brand-primary  ")).toBe("--brand-primary");
  });
});

describe("setProperty", () => {
  it("should set CSS variable on target element", () => {
    const setPropertyMock = vi.fn();
    const target = {
      style: { setProperty: setPropertyMock }
    } as unknown as HTMLElement;

    setProperty("brand-primary", "#1f8a70", target);

    expect(setPropertyMock).toHaveBeenCalledWith("--brand-primary", "#1f8a70");
  });

  it("should normalize token name", () => {
    const setPropertyMock = vi.fn();
    const target = {
      style: { setProperty: setPropertyMock }
    } as unknown as HTMLElement;

    setProperty("--brand-primary", "#1f8a70", target);

    expect(setPropertyMock).toHaveBeenCalledWith("--brand-primary", "#1f8a70");
  });
});

describe("setProperties", () => {
  it("should set multiple CSS variables", () => {
    const setPropertyMock = vi.fn();
    const target = {
      style: { setProperty: setPropertyMock }
    } as unknown as HTMLElement;

    setProperties(
      {
        "brand-primary": "#1f8a70",
        "brand-secondary": "#2d9cdb"
      },
      target
    );

    expect(setPropertyMock).toHaveBeenCalledTimes(2);
    expect(setPropertyMock).toHaveBeenCalledWith("--brand-primary", "#1f8a70");
    expect(setPropertyMock).toHaveBeenCalledWith("--brand-secondary", "#2d9cdb");
  });

  it("should handle empty object", () => {
    const setPropertyMock = vi.fn();
    const target = {
      style: { setProperty: setPropertyMock }
    } as unknown as HTMLElement;

    setProperties({}, target);

    expect(setPropertyMock).not.toHaveBeenCalled();
  });
});
