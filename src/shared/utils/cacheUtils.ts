import { EdgeTTSNativeStreamService } from '@/services/edgeTtsNativeStream';
import { NativeTTSStreamService } from '@/services/nativeTtsStream';

async function clearCacheStorage(): Promise<void> {
	if (!('caches' in window)) return;
	try {
		const cacheKeys = await window.caches.keys();
		await Promise.all(cacheKeys.map((key) => window.caches.delete(key)));
	} catch (err) {
		console.warn('[CacheUtils] Error clearing CacheStorage:', err);
	}
}

function clearTtsResumePositions(): void {
	try {
		for (let i = localStorage.length - 1; i >= 0; i--) {
			const key = localStorage.key(i);
			if (key?.startsWith('stories_tts_pos_')) {
				localStorage.removeItem(key);
			}
		}
	} catch (err) {
		console.warn('[CacheUtils] Error clearing TTS resume cache:', err);
	}
}

async function clearNativeCache(service: { isAvailable(): boolean; clearCache(): Promise<unknown> }, label: string): Promise<void> {
	try {
		if (service.isAvailable()) {
			await service.clearCache();
		}
	} catch (err) {
		console.warn(`[CacheUtils] Error clearing ${label}:`, err);
	}
}

/**
 * Cache management utilities for force-refreshing data and clearing stored caches.
 */
export async function clearAllCaches(): Promise<void> {
	if (typeof window === 'undefined') return;

	// 1. Purge CacheStorage (Service Worker / PWA / HTTP fetch cache)
	await clearCacheStorage();

	// 2. Clear TTS reading resume positions
	clearTtsResumePositions();

	// 3. Clear Native Android Edge TTS and Native Device TTS audio caches
	await clearNativeCache(EdgeTTSNativeStreamService, 'EdgeTTS native cache');
	await clearNativeCache(NativeTTSStreamService, 'NativeTTS device cache');
}
