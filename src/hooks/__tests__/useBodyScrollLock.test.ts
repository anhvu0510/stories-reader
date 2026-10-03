// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';

import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';

describe('useBodyScrollLock', () => {
	beforeEach(() => {
		document.body.style.overflow = '';
		document.body.style.touchAction = '';
	});

	afterEach(() => {
		document.body.style.overflow = '';
		document.body.style.touchAction = '';
	});

	it('locks body scroll and sets data-modal-open when active is true', () => {
		const { unmount } = renderHook(() => useBodyScrollLock(true));

		expect(document.body.style.overflow).toBe('hidden');
		expect(document.body.style.touchAction).toBe('none');
		expect(document.body.getAttribute('data-modal-open')).toBe('true');

		unmount();

		expect(document.body.style.overflow).toBe('');
		expect(document.body.style.touchAction).toBe('');
		expect(document.body.getAttribute('data-modal-open')).toBeNull();
	});

	it('does not lock body scroll when active is false', () => {
		renderHook(() => useBodyScrollLock(false));

		expect(document.body.style.overflow).toBe('');
		expect(document.body.style.touchAction).toBe('');
		expect(document.body.getAttribute('data-modal-open')).toBeNull();
	});

	it('maintains lock across nested sheets until the last sheet unmounts', () => {
		const sheet1 = renderHook(() => useBodyScrollLock(true));
		const sheet2 = renderHook(() => useBodyScrollLock(true));

		expect(document.body.style.overflow).toBe('hidden');
		expect(document.body.getAttribute('data-modal-open')).toBe('true');

		// Unmount inner sheet: outer sheet should keep lock active
		sheet2.unmount();
		expect(document.body.style.overflow).toBe('hidden');
		expect(document.body.getAttribute('data-modal-open')).toBe('true');

		// Unmount outer sheet: lock should now be released
		sheet1.unmount();
		expect(document.body.style.overflow).toBe('');
		expect(document.body.getAttribute('data-modal-open')).toBeNull();
	});
});
