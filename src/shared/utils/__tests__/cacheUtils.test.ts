// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAllCaches } from '../cacheUtils';

describe('clearAllCaches', () => {
	beforeEach(() => {
		localStorage.clear();
		vi.restoreAllMocks();
	});

	it('clears all stories_tts_pos_ entries from localStorage', async () => {
		localStorage.setItem('stories_tts_pos_chap1', JSON.stringify({ chunkIndex: 5, charOffset: 0 }));
		localStorage.setItem('stories_tts_pos_chap2', JSON.stringify({ chunkIndex: 2, charOffset: 12 }));
		localStorage.setItem('unrelated_key', 'keep_me');

		await clearAllCaches();

		expect(localStorage.getItem('stories_tts_pos_chap1')).toBeNull();
		expect(localStorage.getItem('stories_tts_pos_chap2')).toBeNull();
		expect(localStorage.getItem('unrelated_key')).toBe('keep_me');
	});

	it('safely handles window.caches deletion if available', async () => {
		const deleteMock = vi.fn().mockResolvedValue(true);
		const keysMock = vi.fn().mockResolvedValue(['cache-v1', 'cache-v2']);
		Object.defineProperty(window, 'caches', {
			configurable: true,
			value: {
				keys: keysMock,
				delete: deleteMock
			}
		});

		await clearAllCaches();

		expect(keysMock).toHaveBeenCalled();
		expect(deleteMock).toHaveBeenCalledWith('cache-v1');
		expect(deleteMock).toHaveBeenCalledWith('cache-v2');
	});
});
