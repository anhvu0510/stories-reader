import { EdgeTTSNativeStreamService } from '@/services/edgeTtsNativeStream';

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

	// 2. Clear TTS reading resume positions
	try {
		for (let i = localStorage.length - 1; i >= 0; i--) {
			const key = localStorage.key(i);
			if (key && key.startsWith('stories_tts_pos_')) {
				localStorage.removeItem(key);
			}
		}
	} catch (err) {
		console.warn('[CacheUtils] Error clearing TTS resume cache:', err);
	}

	// 3. Clear Native Android Edge TTS audio cache
	try {
		if (EdgeTTSNativeStreamService.isAvailable()) {
			await EdgeTTSNativeStreamService.clearCache();
		}
	} catch (err) {
		console.warn('[CacheUtils] Error clearing EdgeTTS native cache:', err);
	}
}
