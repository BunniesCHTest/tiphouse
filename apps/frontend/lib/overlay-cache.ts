const embeddedMediaFields = ["alertImageUrl", "customSoundUrl", "soundUrl"] as const;

function isEmbeddedMedia(value: unknown) {
  return typeof value === "string" && value.startsWith("data:");
}

function cacheableOverlay<T extends Record<string, unknown>>(settings: T): T {
  const cacheable = { ...settings };
  for (const field of embeddedMediaFields) {
    if (isEmbeddedMedia(cacheable[field])) delete cacheable[field];
  }
  return cacheable;
}

export function readOverlayCache<T extends Record<string, unknown>>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as T;
    if (embeddedMediaFields.some((field) => isEmbeddedMedia(parsed[field]))) {
      writeOverlayCache(key, parsed);
    }
    return cacheableOverlay(parsed);
  } catch {
    localStorage.removeItem(key);
    return null;
  }
}

export function writeOverlayCache<T extends Record<string, unknown>>(key: string, settings: T) {
  try {
    localStorage.removeItem(key);
    localStorage.setItem(key, JSON.stringify(cacheableOverlay(settings)));
  } catch {
    // Browser cache is optional. PostgreSQL remains the source of truth.
    localStorage.removeItem(key);
  }
}
