// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { openChapter, openNextChapter, openPrevChapter } from '@/shared/utils/openChapter';

describe('openChapter utility', () => {
	const originalLocation = window.location;

	beforeEach(() => {
		localStorage.clear();
		window.scrollTo = vi.fn();
		// Mock window.location reload
		Object.defineProperty(window, 'location', {
			writable: true,
			value: {
				...originalLocation,
				hash: '',
				reload: vi.fn(),
			},
		});
	});

	afterEach(() => {
		localStorage.clear();
		Object.defineProperty(window, 'location', {
			writable: true,
			value: originalLocation,
		});
	});

	it('updates URL via pushState without firing hashchange or scrolling before forceReload', () => {
		const hashChangeSpy = vi.fn();
		const pushStateSpy = vi.spyOn(window.history, 'pushState');
		window.addEventListener('hashchange', hashChangeSpy);

		openNextChapter('b1', 'c1', 'c2');

		expect(pushStateSpy).toHaveBeenCalledWith(null, '', '#/book/b1/chapter/c2');
		expect(hashChangeSpy).not.toHaveBeenCalled();
		expect(window.scrollTo).not.toHaveBeenCalled();
		expect(window.location.reload).toHaveBeenCalledTimes(1);

		window.removeEventListener('hashchange', hashChangeSpy);
		pushStateSpy.mockRestore();
	});

	it('updates URL via pushState and forces reload by default when bookId and chapterId are valid', () => {
		const pushStateSpy = vi.spyOn(window.history, 'pushState');

		openChapter('b123', 'c456');

		expect(pushStateSpy).toHaveBeenCalledWith(null, '', '#/book/b123/chapter/c456');
		expect(window.location.reload).toHaveBeenCalledTimes(1);

		pushStateSpy.mockRestore();
	});

	it('skips reload only when forceReload is explicitly false', () => {
		openChapter('b123', 'c456', { forceReload: false });

		expect(window.location.hash).toBe('#/book/b123/chapter/c456');
		expect(window.location.reload).not.toHaveBeenCalled();
	});

	it('does nothing if bookId or chapterId is missing', () => {
		openChapter('', 'c456');
		expect(window.location.hash).toBe('');
		expect(window.location.reload).not.toHaveBeenCalled();

		openChapter('b123', '');
		expect(window.location.hash).toBe('');
		expect(window.location.reload).not.toHaveBeenCalled();
	});

	it('openNextChapter clears previous and next chapter progress and forces page reload without pre-reload scroll', () => {
		const pushStateSpy = vi.spyOn(window.history, 'pushState');
		localStorage.setItem('reading_progress_b1_c1', JSON.stringify({ chapterId: 'c1', scrollY: 3000 }));
		localStorage.setItem('reading_progress_b1_c2', JSON.stringify({ chapterId: 'c2', scrollY: 2000 }));

		openNextChapter('b1', 'c1', 'c2');

		expect(localStorage.getItem('reading_progress_b1_c1')).toBeNull();
		expect(localStorage.getItem('reading_progress_b1_c2')).toBeNull();
		expect(window.scrollTo).not.toHaveBeenCalled();
		expect(pushStateSpy).toHaveBeenCalledWith(null, '', '#/book/b1/chapter/c2');
		expect(window.location.reload).toHaveBeenCalledTimes(1);

		pushStateSpy.mockRestore();
	});

	it('openPrevChapter navigates to previous chapter and forces page reload without pre-reload scroll', () => {
		const pushStateSpy = vi.spyOn(window.history, 'pushState');

		openPrevChapter('b1', 'c2', 'c1');

		expect(window.scrollTo).not.toHaveBeenCalled();
		expect(pushStateSpy).toHaveBeenCalledWith(null, '', '#/book/b1/chapter/c1');
		expect(window.location.reload).toHaveBeenCalledTimes(1);

		pushStateSpy.mockRestore();
	});
});
