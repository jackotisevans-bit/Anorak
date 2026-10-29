/** Trims text and turns empty strings into null. */
export function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function year(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value !== 0 ? value : null;
}

const UNKNOWN_ARTIST = /^(unknown|anonymous|unidentified)\b/i;

/** Drops placeholder names so the game never asks players to guess "Unknown artist". */
export function artistName(value: unknown): string | null {
  const name = text(value);
  if (!name || UNKNOWN_ARTIST.test(name)) return null;
  return name;
}
