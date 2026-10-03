// @vitest-environment jsdom
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor, cleanup } from '@testing-library/react';
import 'fake-indexeddb/auto';

import { LibraryScreen } from '@/features/library/LibraryScreen';
import { BookRepository } from '@/repositories/BookRepository';
import { useLibraryStore } from '@/stores/useLibraryStore';

vi.mock('../../../repositories/BookRepository', () => ({
	BookRepository: {
		getBooks: vi.fn().mockResolvedValue({
			books: [],
			pagination: { currentPage: 1, totalPages: 1, total: 0 }
		})
	}
}));

describe('LibraryScreen - Swipe Gesture Tab Switching', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		localStorage.clear();
		useLibraryStore.getState().resetLibraryState();
	});

	afterEach(() => {
		cleanup();
	});

	it('swiping left advances from ALL to HISTORY tab', async () => {
		render(
			<MemoryRouter>
				<LibraryScreen />
			</MemoryRouter>
		);

		await waitFor(() => {
			expect(useLibraryStore.getState().savedTab).toBe('ALL');
		});

		// Swipe left (from 240px to 100px)
		act(() => {
			window.dispatchEvent(
				new TouchEvent('touchstart', {
					touches: [{ clientX: 240, clientY: 200 } as any]
				})
			);
			window.dispatchEvent(
				new TouchEvent('touchend', {
					changedTouches: [{ clientX: 100, clientY: 205 } as any]
				})
			);
		});

		await waitFor(() => {
			expect(useLibraryStore.getState().savedTab).toBe('HISTORY');
		});
	});

	it('swiping right goes back from HISTORY to ALL tab', async () => {
		useLibraryStore.getState().setLibraryState(1, 'HISTORY', '', [], 'createdAt', 'DESC');

		render(
			<MemoryRouter>
				<LibraryScreen />
			</MemoryRouter>
		);

		await waitFor(() => {
			expect(useLibraryStore.getState().savedTab).toBe('HISTORY');
		});

		// Swipe right (from 80px to 220px)
		act(() => {
			window.dispatchEvent(
				new TouchEvent('touchstart', {
					touches: [{ clientX: 80, clientY: 200 } as any]
				})
			);
			window.dispatchEvent(
				new TouchEvent('touchend', {
					changedTouches: [{ clientX: 220, clientY: 205 } as any]
				})
			);
		});

		await waitFor(() => {
			expect(useLibraryStore.getState().savedTab).toBe('ALL');
		});
	});

	it('does not trigger tab swipe if touch duration exceeds maxDuration (long press / slow scroll)', async () => {
		render(
			<MemoryRouter>
				<LibraryScreen />
			</MemoryRouter>
		);

		await waitFor(() => {
			expect(useLibraryStore.getState().savedTab).toBe('ALL');
		});

		const now = Date.now();
		vi.spyOn(Date, 'now').mockReturnValue(now);

		act(() => {
			window.dispatchEvent(
				new TouchEvent('touchstart', {
					touches: [{ clientX: 240, clientY: 200 } as any]
				})
			);
		});

		// 1000ms later (simulating long press or slow drag)
		vi.spyOn(Date, 'now').mockReturnValue(now + 1000);

		act(() => {
			window.dispatchEvent(
				new TouchEvent('touchend', {
					changedTouches: [{ clientX: 100, clientY: 205 } as any]
				})
			);
		});

		// Should NOT change tab
		expect(useLibraryStore.getState().savedTab).toBe('ALL');
	});
});
