/**
 * Caché en memoria con TTL.
 * Los datos se conservan mientras la app esté montada (no al refrescar la página).
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

export const cache = {
  get<T>(key: string): T | null {
    const entry = store.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      store.delete(key);
      return null;
    }
    return entry.data;
  },

  set<T>(key: string, data: T, ttlMs: number): void {
    store.set(key, { data, expiresAt: Date.now() + ttlMs });
  },

  /** Borra una clave específica (usar tras mutations para forzar re-fetch) */
  invalidate(key: string): void {
    store.delete(key);
  },

  /** Borra todas las claves que empiecen con el prefijo dado */
  invalidatePrefix(prefix: string): void {
    for (const key of store.keys()) {
      if (key.startsWith(prefix)) store.delete(key);
    }
  },
};

/**
 * Wrapper: si existe en caché devuelve el dato; si no, ejecuta fetchFn,
 * guarda en caché y retorna el resultado.
 */
export async function withCache<T>(
  key: string,
  ttlMs: number,
  fetchFn: () => Promise<T>,
): Promise<T> {
  const cached = cache.get<T>(key);
  if (cached !== null) return cached;
  const data = await fetchFn();
  cache.set(key, data, ttlMs);
  return data;
}
