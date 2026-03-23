import { describe, it, expect } from "vitest";
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

describe("颜色工具函数", () => {
  describe("clamp", () => {
    it("应在值小于最小值时返回最小值", () => {
      expect(clamp(5, 10, 20)).toBe(10);
    });

    it("应在值大于最大值时返回最大值", () => {
      expect(clamp(25, 10, 20)).toBe(20);
    });

    it("应在值在范围内时返回原值", () => {
      expect(clamp(15, 10, 20)).toBe(15);
    });

    it("应在最小值大于最大值时返回原值", () => {
      expect(clamp(15, 20, 10)).toBe(15);
    });

    it("应正确处理边界值", () => {
      expect(clamp(10, 10, 20)).toBe(10);
      expect(clamp(20, 10, 20)).toBe(20);
    });
  });

  describe("normalizeHex", () => {
    it("应标准化6位十六进制颜色", () => {
      expect(normalizeHex("#FFFFFF")).toBe("#ffffff");
      expect(normalizeHex("FFFFFF")).toBe("#ffffff");
      expect(normalizeHex("#000000")).toBe("#000000");
    });

    it("应标准化3位十六进制颜色为6位", () => {
      expect(normalizeHex("#FFF")).toBe("#ffffff");
      expect(normalizeHex("FFF")).toBe("#ffffff");
      expect(normalizeHex("#000")).toBe("#000000");
    });

    it("应处理混合大小写", () => {
      expect(normalizeHex("#aBcDeF")).toBe("#abcdef");
    });

    it("应对无效格式抛出错误", () => {
      expect(() => normalizeHex("invalid")).toThrow("Invalid hex color: invalid");
      expect(() => normalizeHex("#GGG")).toThrow("Invalid hex color: #GGG");
    });
  });

  describe("hexToRgb", () => {
    it("应正确转换白色", () => {
      expect(hexToRgb("#FFFFFF")).toEqual({ r: 255, g: 255, b: 255 });
    });

    it("应正确转换黑色", () => {
      expect(hexToRgb("#000000")).toEqual({ r: 0, g: 0, b: 0 });
    });

    it("应正确转换红色", () => {
      expect(hexToRgb("#FF0000")).toEqual({ r: 255, g: 0, b: 0 });
    });

    it("应正确转换绿色", () => {
      expect(hexToRgb("#00FF00")).toEqual({ r: 0, g: 255, b: 0 });
    });

    it("应正确转换蓝色", () => {
      expect(hexToRgb("#0000FF")).toEqual({ r: 0, g: 0, b: 255 });
    });

    it("应正确转换灰色", () => {
      expect(hexToRgb("#808080")).toEqual({ r: 128, g: 128, b: 128 });
    });
  });

  describe("rgbToHex", () => {
    it("应正确转换白色", () => {
      expect(rgbToHex(255, 255, 255)).toBe("#ffffff");
    });

    it("应正确转换黑色", () => {
      expect(rgbToHex(0, 0, 0)).toBe("#000000");
    });

    it("应正确转换红色", () => {
      expect(rgbToHex(255, 0, 0)).toBe("#ff0000");
    });

    it("应在值超出范围时进行钳制", () => {
      expect(rgbToHex(300, -10, 128)).toBe("#ff0080");
    });

    it("应正确四舍五入小数值", () => {
      expect(rgbToHex(128.5, 64.3, 32.7)).toBe("#814021");
    });
  });

  describe("mix", () => {
    it("应按50%权重混合白色和黑色", () => {
      const result = mix("#FFFFFF", "#000000", 50);
      expect(result).toBe("#808080");
    });

    it("应按100%权重返回第一种颜色", () => {
      expect(mix("#FF0000", "#0000FF", 100)).toBe("#ff0000");
    });

    it("应按0%权重返回第二种颜色", () => {
      expect(mix("#FF0000", "#0000FF", 0)).toBe("#0000ff");
    });

    it("应钳制超出范围的权重", () => {
      expect(mix("#FF0000", "#0000FF", 150)).toBe("#ff0000");
      expect(mix("#FF0000", "#0000FF", -50)).toBe("#0000ff");
    });

    it("应正确混合红色和蓝色", () => {
      const result = mix("#FF0000", "#0000FF", 50);
      expect(result).toBe("#800080");
    });
  });

  describe("withAlpha", () => {
    it("应正确添加alpha通道", () => {
      expect(withAlpha("#FFFFFF", 0.5)).toBe("rgba(255, 255, 255, 0.5)");
    });

    it("应默认使用alpha=1", () => {
      expect(withAlpha("#FFFFFF")).toBe("rgba(255, 255, 255, 1)");
    });

    it("应钳制超出范围的alpha值", () => {
      expect(withAlpha("#FFFFFF", 1.5)).toBe("rgba(255, 255, 255, 1)");
      expect(withAlpha("#FFFFFF", -0.5)).toBe("rgba(255, 255, 255, 0)");
    });
  });

  describe("isDark", () => {
    it("应识别黑色为暗色", () => {
      expect(isDark("#000000")).toBe(true);
    });

    it("应识别白色为亮色", () => {
      expect(isDark("#FFFFFF")).toBe(false);
    });

    it("应识别深蓝色为暗色", () => {
      expect(isDark("#000080")).toBe(true);
    });

    it("应识别浅黄色为亮色", () => {
      expect(isDark("#FFFFE0")).toBe(false);
    });

    it("应正确判断临界值", () => {
      expect(isDark("#808080")).toBe(true);
    });
  });

  describe("toCssVar", () => {
    it("应正确格式化CSS变量", () => {
      expect(toCssVar("primary-color")).toBe("--primary-color");
      expect(toCssVar("--primary-color")).toBe("--primary-color");
      expect(toCssVar("  primary-color  ")).toBe("--primary-color");
    });
  });

  describe("setProperty", () => {
    it("应在documentElement上设置CSS变量", () => {
      const mockElement = { style: { setProperty: vi.fn() } };
      setProperty("test-var", "red", mockElement);
      expect(mockElement.style.setProperty).toHaveBeenCalledWith("--test-var", "red");
    });
  });

  describe("setProperties", () => {
    it("应批量设置CSS变量", () => {
      const mockElement = { style: { setProperty: vi.fn() } };
      const variables = { "var1": "value1", "var2": "value2" };
      setProperties(variables, mockElement);
      expect(mockElement.style.setProperty).toHaveBeenCalledTimes(2);
      expect(mockElement.style.setProperty).toHaveBeenCalledWith("--var1", "value1");
      expect(mockElement.style.setProperty).toHaveBeenCalledWith("--var2", "value2");
    });
  });
});
