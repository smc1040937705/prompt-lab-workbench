import { describe, it, expect } from "vitest";
import { toDate, startOfDay, diffInDays, isOverdue, formatDate } from "@/utils/date";

describe("toDate", () => {
  it("should convert string to Date", () => {
    const result = toDate("2026-03-23");
    expect(result instanceof Date).toBe(true);
    expect(result.toISOString().startsWith("2026-03-23")).toBe(true);
  });

  it("should convert timestamp to Date", () => {
    const timestamp = new Date("2026-03-23").getTime();
    const result = toDate(timestamp);
    expect(result instanceof Date).toBe(true);
    expect(result.toISOString().startsWith("2026-03-23")).toBe(true);
  });

  it("should clone Date object", () => {
    const original = new Date("2026-03-23T10:30:00");
    const result = toDate(original);
    expect(result).not.toBe(original);
    expect(result.getTime()).toBe(original.getTime());
  });

  it("should throw for invalid date input", () => {
    expect(() => toDate("invalid")).toThrow("Invalid date input");
    expect(() => toDate("")).toThrow("Invalid date input");
    expect(() => toDate(NaN)).toThrow("Invalid date input");
  });
});

describe("startOfDay", () => {
  it("should reset time to midnight", () => {
    const result = startOfDay("2026-03-23T15:30:45.123");
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
    expect(result.getMilliseconds()).toBe(0);
  });

  it("should preserve date", () => {
    const result = startOfDay("2026-03-23T15:30:00");
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(2);
    expect(result.getDate()).toBe(23);
  });
});

describe("diffInDays", () => {
  it("should calculate positive difference when from < to", () => {
    expect(diffInDays("2026-03-20", "2026-03-23")).toBe(3);
    expect(diffInDays("2026-03-01", "2026-03-31")).toBe(30);
  });

  it("should calculate negative difference when from > to", () => {
    expect(diffInDays("2026-03-23", "2026-03-20")).toBe(-3);
    expect(diffInDays("2026-03-31", "2026-03-01")).toBe(-30);
  });

  it("should return 0 for same day", () => {
    expect(diffInDays("2026-03-23", "2026-03-23")).toBe(0);
    expect(diffInDays("2026-03-23T10:00", "2026-03-23T20:00")).toBe(0);
  });

  it("should handle month boundaries", () => {
    expect(diffInDays("2026-02-28", "2026-03-01")).toBe(1);
    expect(diffInDays("2026-12-31", "2027-01-01")).toBe(1);
  });

  it("should handle year boundaries", () => {
    expect(diffInDays("2025-12-31", "2026-01-01")).toBe(1);
    expect(diffInDays("2026-01-01", "2025-12-31")).toBe(-1);
  });
});

describe("isOverdue", () => {
  it("should return true for past dates", () => {
    const today = new Date("2026-03-23");
    expect(isOverdue("2026-03-22", today)).toBe(true);
    expect(isOverdue("2026-03-20", today)).toBe(true);
    expect(isOverdue("2026-01-01", today)).toBe(true);
  });

  it("should return false for today", () => {
    const today = new Date("2026-03-23");
    expect(isOverdue("2026-03-23", today)).toBe(false);
  });

  it("should return false for future dates", () => {
    const today = new Date("2026-03-23");
    expect(isOverdue("2026-03-24", today)).toBe(false);
    expect(isOverdue("2026-04-01", today)).toBe(false);
    expect(isOverdue("2027-01-01", today)).toBe(false);
  });

  it("should use current date when today not provided", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = formatDate(yesterday);
    expect(isOverdue(yesterdayStr)).toBe(true);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = formatDate(tomorrow);
    expect(isOverdue(tomorrowStr)).toBe(false);
  });
});

describe("formatDate", () => {
  it("should format Date object to YYYY-MM-DD", () => {
    expect(formatDate(new Date("2026-03-23"))).toBe("2026-03-23");
    expect(formatDate(new Date("2026-12-05"))).toBe("2026-12-05");
  });

  it("should format string date to YYYY-MM-DD", () => {
    expect(formatDate("2026-03-23T15:30:00")).toBe("2026-03-23");
    expect(formatDate("2026-12-05")).toBe("2026-12-05");
  });

  it("should pad single-digit month and day", () => {
    expect(formatDate("2026-1-5")).toBe("2026-01-05");
    expect(formatDate(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("should handle edge dates", () => {
    expect(formatDate("2026-01-01")).toBe("2026-01-01");
    expect(formatDate("2026-12-31")).toBe("2026-12-31");
  });
});
