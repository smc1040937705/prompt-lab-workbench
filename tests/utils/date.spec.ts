import { describe, it, expect, vi } from "vitest";
import { toDate, startOfDay, diffInDays, isOverdue, formatDate } from "@/utils/date";

describe("日期工具函数", () => {
  describe("toDate", () => {
    it("应正确转换Date对象", () => {
      const input = new Date("2024-01-15");
      const result = toDate(input);
      expect(result).toBeInstanceOf(Date);
      expect(result.getTime()).toBe(input.getTime());
    });

    it("应正确转换字符串日期", () => {
      const result = toDate("2024-01-15");
      expect(result).toBeInstanceOf(Date);
      expect(result.getFullYear()).toBe(2024);
      expect(result.getMonth()).toBe(0);
      expect(result.getDate()).toBe(15);
    });

    it("应正确转换时间戳", () => {
      const timestamp = new Date("2024-01-15").getTime();
      const result = toDate(timestamp);
      expect(result).toBeInstanceOf(Date);
      expect(result.getTime()).toBe(timestamp);
    });

    it("应对无效输入抛出错误", () => {
      expect(() => toDate("invalid-date")).toThrow("Invalid date input: invalid-date");
    });
  });

  describe("startOfDay", () => {
    it("应将时间设置为一天的开始", () => {
      const input = new Date("2024-01-15T14:30:45.123");
      const result = startOfDay(input);
      expect(result.getHours()).toBe(0);
      expect(result.getMinutes()).toBe(0);
      expect(result.getSeconds()).toBe(0);
      expect(result.getMilliseconds()).toBe(0);
      expect(result.getFullYear()).toBe(2024);
      expect(result.getMonth()).toBe(0);
      expect(result.getDate()).toBe(15);
    });

    it("应接受字符串输入", () => {
      const result = startOfDay("2024-01-15");
      expect(result.getHours()).toBe(0);
      expect(result.getFullYear()).toBe(2024);
    });

    it("应返回新的Date对象而非修改原对象", () => {
      const input = new Date("2024-01-15T14:30:45.123");
      const result = startOfDay(input);
      expect(result).not.toBe(input);
      expect(input.getHours()).toBe(14);
    });
  });

  describe("diffInDays", () => {
    it("应计算两个日期之间的天数差", () => {
      const from = "2024-01-15";
      const to = "2024-01-20";
      expect(diffInDays(from, to)).toBe(5);
    });

    it("应返回负数表示from在to之后", () => {
      const from = "2024-01-20";
      const to = "2024-01-15";
      expect(diffInDays(from, to)).toBe(-5);
    });

    it("应在日期相同时返回0", () => {
      const date = "2024-01-15";
      expect(diffInDays(date, date)).toBe(0);
    });

    it("应忽略时间部分只比较日期", () => {
      const from = "2024-01-15T23:59:59";
      const to = "2024-01-16T00:00:01";
      expect(diffInDays(from, to)).toBe(1);
    });

    it("应正确处理跨月情况", () => {
      const from = "2024-01-31";
      const to = "2024-02-01";
      expect(diffInDays(from, to)).toBe(1);
    });

    it("应正确处理闰年", () => {
      const from = "2024-02-28";
      const to = "2024-03-01";
      expect(diffInDays(from, to)).toBe(2);
    });
  });

  describe("isOverdue", () => {
    it("应在日期已过时返回true", () => {
      const today = new Date("2024-01-15");
      expect(isOverdue("2024-01-14", today)).toBe(true);
    });

    it("应在日期是今天时返回false", () => {
      const today = new Date("2024-01-15");
      expect(isOverdue("2024-01-15", today)).toBe(false);
    });

    it("应在日期是未来时返回false", () => {
      const today = new Date("2024-01-15");
      expect(isOverdue("2024-01-16", today)).toBe(false);
    });

    it("应在未提供today参数时使用当前日期", () => {
      const realDateNow = Date.now.bind(global.Date);
      const fixedDate = new Date("2024-01-15");
      vi.setSystemTime(fixedDate);
      
      expect(isOverdue("2024-01-14")).toBe(true);
      expect(isOverdue("2024-01-15")).toBe(false);
      expect(isOverdue("2024-01-16")).toBe(false);
      
      vi.setSystemTime(realDateNow());
    });
  });

  describe("formatDate", () => {
    it("应将Date对象格式化为YYYY-MM-DD字符串", () => {
      const date = new Date("2024-01-15");
      expect(formatDate(date)).toBe("2024-01-15");
    });

    it("应将字符串日期格式化为标准格式", () => {
      expect(formatDate("2024/1/15")).toBe("2024-01-15");
    });

    it("应正确补零月份和日期", () => {
      const date = new Date("2024-03-05");
      expect(formatDate(date)).toBe("2024-03-05");
    });

    it("应正确格式化12月", () => {
      const date = new Date("2024-12-25");
      expect(formatDate(date)).toBe("2024-12-25");
    });

    it("应正确格式化一月", () => {
      const date = new Date("2024-01-01");
      expect(formatDate(date)).toBe("2024-01-01");
    });
  });
});
