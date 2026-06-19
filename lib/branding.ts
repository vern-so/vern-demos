// Brand identity for a demo, resolved server-side from configuration.

export type Brand = {
  product: string;
  color: string;
  logo: string | null;
  source: string | null;
};

// Relative luminance to pick readable foreground (black/white) on the brand color.
export function readableFg(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.62 ? "#0a0a0a" : "#ffffff";
}

export function softTint(hex: string, alpha = 0.1): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
