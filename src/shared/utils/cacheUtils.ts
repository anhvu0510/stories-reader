/**
 * Cache management utilities for force-refreshing data and clearing stored caches.
 */
export async function clearAllCaches(): Promise<void> {
	if (typeof window === 'undefined') return;

	// 1. Purge CacheStorage (Service Worker / PWA / HTTP fetch cache)
	if ('caches' in window) {
		try {
			const cacheKeys = await window.caches.keys();
			await Promise.all(cacheKeys.map((key) => window.caches.delete(key)));
		} catch (err) {
			console.warn('[CacheUtils] Error clearing CacheStorage:', err);
		}
	}
}
