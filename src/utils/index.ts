export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

const HEX_COLOR_REG = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function clamp(value: number, min: number, max: number): number {
  if (min > max) {
    return value;
  }
  return Math.min(Math.max(value, min), max);
}

export function normalizeHex(color: string): `#${string}` {
  const input = color.trim();
  const matches = HEX_COLOR_REG.exec(input);
  if (!matches) {
    throw new Error(`Invalid hex color: ${color}`);
  }

  const compactValue = matches[1].toLowerCase();
  const fullValue =
    compactValue.length === 3
      ? compactValue
          .split("")
          .map((char) => `${char}${char}`)
          .join("")
      : compactValue;
  return `#${fullValue}`;
}

export function hexToRgb(color: string): RgbColor {
  const normalized = normalizeHex(color).slice(1);
  const intValue = Number.parseInt(normalized, 16);
  return {
    r: (intValue >> 16) & 255,
    g: (intValue >> 8) & 255,
    b: intValue & 255
  };
}

export function rgbToHex(r: number, g: number, b: number): `#${string}` {
  const values = [r, g, b]
    .map((channel) => Math.round(clamp(channel, 0, 255)))
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("");

  return `#${values}`;
}

export function mix(color1: string, color2: string, weight = 50): `#${string}` {
  const safeWeight = clamp(weight, 0, 100) / 100;
  const primary = hexToRgb(color1);
  const secondary = hexToRgb(color2);

  const r = primary.r * safeWeight + secondary.r * (1 - safeWeight);
  const g = primary.g * safeWeight + secondary.g * (1 - safeWeight);
  const b = primary.b * safeWeight + secondary.b * (1 - safeWeight);

  return rgbToHex(r, g, b);
}

export function withAlpha(color: string, alpha = 1): string {
  const safeAlpha = clamp(alpha, 0, 1);
  const rgb = hexToRgb(color);
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${safeAlpha})`;
}

export function isDark(color: string): boolean {
  const { r, g, b } = hexToRgb(color);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance < 0.55;
}

export function toCssVar(token: string): string {
  const normalized = token.trim().replace(/^--/, "");
  return `--${normalized}`;
}

export function setProperty(
  name: string,
  value: string,
  target: Pick<HTMLElement, "style"> = document.documentElement
): void {
  target.style.setProperty(toCssVar(name), value);
}

export function setProperties(
  variables: Record<string, string>,
  target: Pick<HTMLElement, "style"> = document.documentElement
): void {
  Object.entries(variables).forEach(([name, value]) => {
    setProperty(name, value, target);
  });
}
