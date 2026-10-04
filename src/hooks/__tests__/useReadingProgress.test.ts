// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useReadingProgress, resetReadingProgressModuleState } from '@/hooks/useReadingProgress';

describe('useReadingProgress Hook', () => {
	const bookId = 'book_123';
	const chapterId = 'chap_1';

	beforeEach(() => {
		localStorage.clear();
		resetReadingProgressModuleState();
		vi.restoreAllMocks();
		window.scrollTo = vi.fn();
	});

	afterEach(() => {
		localStorage.clear();
	});

	it('QC-1 [Happy Path]: Lưu thông tin scrollY khi scroll và khi tab hidden', () => {
		const { unmount } = renderHook(() => useReadingProgress(bookId, chapterId, true));

		// Mock scrollY
		Object.defineProperty(window, 'scrollY', {
			value: 1250,
			writable: true,
			configurable: true
		});

		// Trigger visibilitychange hidden
		act(() => {
			Object.defineProperty(document, 'visibilityState', {
				value: 'hidden',
				writable: true,
				configurable: true
			});
			document.dispatchEvent(new Event('visibilitychange'));
		});

		const stored = localStorage.getItem(`reading_progress_${bookId}_${chapterId}`);
		expect(stored).not.toBeNull();
		const data = JSON.parse(stored!);
		expect(data.chapterId).toBe('chap_1');
		expect(data.scrollY).toBe(1250);

		unmount();
	});

	it('QC-2 [Next Chapter]: Reset scroll = 0 khi đổi sang chapterId mới', () => {
		// Preset old chapter cache
		localStorage.setItem(`reading_progress_${bookId}_chap_1`, JSON.stringify({ chapterId: 'chap_1', scrollY: 800, updatedAt: Date.now() }));

		const { rerender } = renderHook(({ cId }) => useReadingProgress(bookId, cId, true), {
			initialProps: { cId: 'chap_1' }
		});

		// Change chapter to chap_2
		act(() => {
			rerender({ cId: 'chap_2' });
		});

		expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'instant' });
		expect(localStorage.getItem(`reading_progress_${bookId}_chap_1`)).toBeNull();
	});

	it('QC-3 [Auto Restore]: Tự động scroll đến vị trí đọc cũ khi content ready', async () => {
		// Preset saved position for chap_1
		localStorage.setItem(`reading_progress_${bookId}_${chapterId}`, JSON.stringify({ chapterId, scrollY: 1500, updatedAt: Date.now() }));

		renderHook(() => useReadingProgress(bookId, chapterId, true));

		// Wait for animation frame / timeout
		await new Promise((resolve) => setTimeout(resolve, 150));

		expect(window.scrollTo).toHaveBeenCalledWith({ top: 1500, behavior: 'instant' });
	});

	it('QC-4 [Auto Cleanup]: Tự động dọn dẹp các cache quá giới hạn maxItems', () => {
		// Fill 25 items
		for (let i = 1; i <= 25; i++) {
			localStorage.setItem(
				`reading_progress_book_${i}_chap_1`,
				JSON.stringify({
					chapterId: 'chap_1',
					scrollY: 100,
					updatedAt: Date.now() - (25 - i) * 1000
				})
			);
		}

		renderHook(() => useReadingProgress('new_book', 'new_chap', true));

		// Trigger save to run cleanup
		act(() => {
			Object.defineProperty(document, 'visibilityState', {
				value: 'hidden',
				writable: true,
				configurable: true
			});
			document.dispatchEvent(new Event('visibilitychange'));
		});

		// Count reading_progress_ keys
		const progressKeys = Object.keys(localStorage).filter((k) => k.startsWith('reading_progress_'));
		expect(progressKeys.length).toBeLessThanOrEqual(21);
	});

	it('QC-5 [Resilience]: Xử lý an toàn khi localStorage bị lỗi', () => {
		vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
			throw new Error('Storage error');
		});

		expect(() => {
			renderHook(() => useReadingProgress(bookId, chapterId, true));
		}).not.toThrow();
	});

	it('QC-6 [Paragraph Level Restore]: Cuộn chính xác theo đoạn văn khi có paragraphIndex', async () => {
		const mockScrollIntoView = vi.fn();
		const sectionEl = document.createElement('section');
		sectionEl.id = 'chapter-section-chap_3';
		const paraEl = document.createElement('div');
		paraEl.setAttribute('data-paragraph-index', '5');
		paraEl.scrollIntoView = mockScrollIntoView;
		sectionEl.appendChild(paraEl);
		document.body.appendChild(sectionEl);

		localStorage.setItem(
			`reading_progress_${bookId}_${chapterId}`,
			JSON.stringify({
				chapterId,
				activeChapterId: 'chap_3',
				paragraphIndex: 5,
				scrollY: 2000,
				updatedAt: Date.now()
			})
		);

		renderHook(() => useReadingProgress(bookId, chapterId, true));

		await new Promise((resolve) => setTimeout(resolve, 150));

		expect(mockScrollIntoView).toHaveBeenCalledWith({ behavior: 'instant', block: 'start' });
		expect(paraEl.className).toContain('bg-primary/20');

		document.body.removeChild(sectionEl);
	});

	it('QC-7 [Cross-Unmount Navigation]: Reset scroll = 0 khi chuyển chapter qua unmount/remount', async () => {
		// Giả lập đọc chap_1 đến cuối (scrollY = 3500)
		Object.defineProperty(window, 'scrollY', {
			value: 3500,
			writable: true,
			configurable: true
		});
		const hook1 = renderHook(() => useReadingProgress(bookId, 'chap_1', true));

		// Lưu tiến độ chap_1
		act(() => {
			Object.defineProperty(document, 'visibilityState', {
				value: 'hidden',
				writable: true,
				configurable: true
			});
			document.dispatchEvent(new Event('visibilitychange'));
		});
		hook1.unmount();

		// Giả lập mở chap_2 (chưa có saved progress) trong instance mới
		(window.scrollTo as any).mockClear();
		renderHook(() => useReadingProgress(bookId, 'chap_2', true));

		await new Promise((resolve) => setTimeout(resolve, 150));

		// Phải reset về 0, không được để scroll ở 3500
		expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'instant' });
	});

	it('QC-8 [No Saved Progress]: Luôn reset scroll = 0 khi mở chapter mới toanh', async () => {
		Object.defineProperty(window, 'scrollY', {
			value: 2400,
			writable: true,
			configurable: true
		});
		(window.scrollTo as any).mockClear();

		renderHook(() => useReadingProgress(bookId, 'chap_brand_new', true));

		await new Promise((resolve) => setTimeout(resolve, 150));

		expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'instant' });
	});

	it('QC-9 [Completed Chapter]: Chapter đã đọc xong khi mở lại sẽ reset về đầu và xóa cache cũ', async () => {
		localStorage.setItem(
			`reading_progress_${bookId}_chap_done`,
			JSON.stringify({
				chapterId: 'chap_done',
				scrollY: 4000,
				isCompleted: true,
				updatedAt: Date.now()
			})
		);

		(window.scrollTo as any).mockClear();
		renderHook(() => useReadingProgress(bookId, 'chap_done', true));

		await new Promise((resolve) => setTimeout(resolve, 150));

		expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'instant' });
		expect(localStorage.getItem(`reading_progress_${bookId}_chap_done`)).toBeNull();
	});

	it('QC-10 [Batch Mode Dual Save]: Lưu đồng thời base chapter và active chapter trong batch', () => {
		const sectionEl = document.createElement('section');
		sectionEl.id = 'chapter-section-chap_2';
		sectionEl.setAttribute('data-chapter-id', 'chap_2');
		const paraEl = document.createElement('div');
		paraEl.setAttribute('data-paragraph-index', '12');
		sectionEl.appendChild(paraEl);
		document.body.appendChild(sectionEl);

		// Mock elementFromPoint để trỏ vào đoạn văn thuộc chap_2
		document.elementFromPoint = vi.fn().mockReturnValue(paraEl);

		const { unmount } = renderHook(() => useReadingProgress(bookId, 'chap_1', true));

		// Đợi restore xong mới cho phép lưu
		act(() => {
			Object.defineProperty(document, 'visibilityState', {
				value: 'hidden',
				writable: true,
				configurable: true
			});
			document.dispatchEvent(new Event('visibilitychange'));
		});

		const baseSaved = localStorage.getItem(`reading_progress_${bookId}_chap_1`);
		const activeSaved = localStorage.getItem(`reading_progress_${bookId}_chap_2`);

		expect(baseSaved).not.toBeNull();
		expect(activeSaved).not.toBeNull();
		const activeData = JSON.parse(activeSaved!);
		expect(activeData.activeChapterId).toBe('chap_2');
		expect(activeData.paragraphIndex).toBe(12);

		unmount();
		document.body.removeChild(sectionEl);
	});

	it('QC-11 [Batch Mode Relative Scroll]: Lưu toạ độ tương đối so với section của active chapter thay vì toạ độ toàn trang', () => {
		const sectionEl = document.createElement('section');
		sectionEl.id = 'chapter-section-chap_2';
		sectionEl.setAttribute('data-chapter-id', 'chap_2');
		// Giả lập section chap_2 bắt đầu tại offset 3000px
		Object.defineProperty(sectionEl, 'offsetTop', { value: 3000, configurable: true });
		const paraEl = document.createElement('div');
		paraEl.setAttribute('data-paragraph-index', '3');
		sectionEl.appendChild(paraEl);
		document.body.appendChild(sectionEl);

		document.elementFromPoint = vi.fn().mockReturnValue(paraEl);

		// Giả lập window.scrollY đang ở 3200px (tức là 200px sau khi vào chap_2)
		Object.defineProperty(window, 'scrollY', { value: 3200, writable: true, configurable: true });

		const { unmount } = renderHook(() => useReadingProgress(bookId, 'chap_1', true));

		act(() => {
			Object.defineProperty(document, 'visibilityState', {
				value: 'hidden',
				writable: true,
				configurable: true
			});
			document.dispatchEvent(new Event('visibilitychange'));
		});

		const activeSaved = localStorage.getItem(`reading_progress_${bookId}_chap_2`);
		expect(activeSaved).not.toBeNull();
		const activeData = JSON.parse(activeSaved!);
		// Toạ độ lưu cho chap_2 phải là toạ độ tương đối (3200 - 3000 = 200), KHÔNG PHẢI 3200 toàn trang
		expect(activeData.scrollY).toBe(200);

		unmount();
		document.body.removeChild(sectionEl);
	});

	it('QC-12 [Explicit Next Chapter Zero Scroll]: Khi chuyển sang chapter mới, vị trí đọc luôn bắt đầu từ đỉnh trang 0', async () => {
		// Giả lập chap_2 từng có progress ở cuối chương (scrollY = 5000 do lỗi cũ hoặc đọc dở)
		localStorage.setItem(
			`reading_progress_${bookId}_chap_2`,
			JSON.stringify({
				chapterId: 'chap_2',
				scrollY: 5000,
				isCompleted: false,
				updatedAt: Date.now()
			})
		);

		// Giả lập đang ở chap_1 với scrollY = 3500
		Object.defineProperty(window, 'scrollY', { value: 3500, writable: true, configurable: true });
		(window.scrollTo as any).mockClear();

		const { rerender } = renderHook(({ cId }) => useReadingProgress(bookId, cId, true), {
			initialProps: { cId: 'chap_1' }
		});

		// Người dùng chuyển sang chap_2
		act(() => {
			rerender({ cId: 'chap_2' });
		});

		// Ngay khi chuyển chương, phải lập tức cuộn về top 0
		expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'instant' });

		// Đợi thêm một khoảng thời gian sau khi content ready, không được tự ý cuộn xuống 5000
		await new Promise((resolve) => setTimeout(resolve, 150));
		expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 0, left: 0, behavior: 'instant' });
	});
});
