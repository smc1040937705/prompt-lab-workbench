import { describe, expect, it } from "vitest";
import { diffInDays, formatDate, isOverdue, startOfDay, toDate } from "@/utils/date";

describe("toDate", () => {
  it("should convert string to Date", () => {
    const result = toDate("2024-01-15");
    expect(result instanceof Date).toBe(true);
    expect(result.getFullYear()).toBe(2024);
    expect(result.getMonth()).toBe(0);
    expect(result.getDate()).toBe(15);
  });

  it("should convert number timestamp to Date", () => {
    const timestamp = new Date("2024-06-20").getTime();
    const result = toDate(timestamp);
    expect(result.getFullYear()).toBe(2024);
    expect(result.getMonth()).toBe(5);
    expect(result.getDate()).toBe(20);
  });

  it("should clone Date object", () => {
    const original = new Date("2024-03-15T10:30:00");
    const result = toDate(original);
    expect(result.getTime()).toBe(original.getTime());
    expect(result).not.toBe(original);
  });

  it("should throw for invalid date string", () => {
    expect(() => toDate("invalid")).toThrow("Invalid date input");
  });

  it("should throw for NaN timestamp", () => {
    expect(() => toDate(NaN)).toThrow("Invalid date input");
  });
});

describe("startOfDay", () => {
  it("should set time to midnight", () => {
    const result = startOfDay("2024-03-15T14:30:45");
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
    expect(result.getMilliseconds()).toBe(0);
  });

  it("should preserve the date", () => {
    const result = startOfDay("2024-03-15T23:59:59");
    expect(result.getFullYear()).toBe(2024);
    expect(result.getMonth()).toBe(2);
    expect(result.getDate()).toBe(15);
  });

  it("should handle Date object input", () => {
    const input = new Date("2024-07-20T08:15:30");
    const result = startOfDay(input);
    expect(result.getHours()).toBe(0);
    expect(result.getDate()).toBe(20);
  });
});

describe("diffInDays", () => {
  it("should return 0 for same day", () => {
    expect(diffInDays("2024-03-15", "2024-03-15")).toBe(0);
  });

  it("should return positive for future date", () => {
    expect(diffInDays("2024-03-15", "2024-03-20")).toBe(5);
  });

  it("should return negative for past date", () => {
    expect(diffInDays("2024-03-20", "2024-03-15")).toBe(-5);
  });

  it("should ignore time component", () => {
    expect(diffInDays("2024-03-15T08:00:00", "2024-03-15T20:00:00")).toBe(0);
  });

  it("should handle month boundaries", () => {
    expect(diffInDays("2024-03-31", "2024-04-02")).toBe(2);
  });

  it("should handle year boundaries", () => {
    expect(diffInDays("2024-12-30", "2025-01-02")).toBe(3);
  });

  it("should handle Date objects", () => {
    const from = new Date("2024-03-15");
    const to = new Date("2024-03-18");
    expect(diffInDays(from, to)).toBe(3);
  });
});

describe("isOverdue", () => {
  it("should return true when date is before today", () => {
    const today = new Date("2024-03-15");
    expect(isOverdue("2024-03-10", today)).toBe(true);
  });

  it("should return false when date is today", () => {
    const today = new Date("2024-03-15");
    expect(isOverdue("2024-03-15", today)).toBe(false);
  });

  it("should return false when date is in future", () => {
    const today = new Date("2024-03-15");
    expect(isOverdue("2024-03-20", today)).toBe(false);
  });

  it("should use current date as default", () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 5);
    const pastDateStr = formatDate(pastDate);
    expect(isOverdue(pastDateStr)).toBe(true);
  });
});

describe("formatDate", () => {
  it("should format date as YYYY-MM-DD", () => {
    const result = formatDate(new Date(2024, 2, 15));
    expect(result).toBe("2024-03-15");
  });

  it("should pad single digit month and day", () => {
    const result = formatDate(new Date(2024, 0, 5));
    expect(result).toBe("2024-01-05");
  });

  it("should handle string input", () => {
    const result = formatDate("2024-06-20T14:30:00");
    expect(result).toBe("2024-06-20");
  });

  it("should handle Date object input", () => {
    const date = new Date("2024-12-25");
    const result = formatDate(date);
    expect(result).toBe("2024-12-25");
  });
});
