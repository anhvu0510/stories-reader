// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNativeReadAloud } from '@/hooks/useNativeReadAloud';
import { useReaderConfigStore } from '@/stores/useReaderConfigStore';
import { DomWordHighlighter } from '@/services/domWordHighlighter';

describe('useNativeReadAloud Hook', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		localStorage.clear();
	});

	afterEach(() => {
		vi.restoreAllMocks();
		localStorage.clear();
	});

	it('bắt đầu đọc và truyền metadata sách/chương xuống EdgeTTSNativeStreamService', async () => {
		useReaderConfigStore.setState({ ttsEngine: 'edge', edgeVoiceUri: 'vi-VN-HoaiMyNeural' });
		const { EdgeTTSNativeStreamService } = await import('@/services/edgeTtsNativeStream');
		vi.spyOn(EdgeTTSNativeStreamService, 'isAvailable').mockReturnValue(true);
		const startPlaybackSpy = vi.spyOn(EdgeTTSNativeStreamService, 'startPlayback').mockResolvedValue(undefined);

		const paragraphs = ['Đoạn văn thứ nhất trên app Android.', 'Đoạn văn thứ hai.'];
		const { result, unmount } = renderHook(() =>
			useNativeReadAloud(paragraphs, { bookId: 'b123', chapterId: 'c456', chapterNumber: 10 })
		);

		await act(async () => {
			result.current.startReading();
		});

		expect(startPlaybackSpy).toHaveBeenCalledWith(
			expect.objectContaining({
				chunks: expect.arrayContaining(['Đoạn văn thứ nhất trên app Android.', 'Đoạn văn thứ hai.']),
				startIndex: 0,
				voice: 'vi-VN-HoaiMyNeural',
				bookTitle: 'Truyện #b123',
				chapterTitle: 'Chương 10'
			})
		);

		unmount();
	});

	it('điều khiển tạm dừng (pause) và dừng (stop) luồng phát native', async () => {
		useReaderConfigStore.setState({ ttsEngine: 'edge', edgeVoiceUri: 'vi-VN-HoaiMyNeural' });
		const { EdgeTTSNativeStreamService } = await import('@/services/edgeTtsNativeStream');
		vi.spyOn(EdgeTTSNativeStreamService, 'isAvailable').mockReturnValue(true);
		vi.spyOn(EdgeTTSNativeStreamService, 'startPlayback').mockResolvedValue(undefined);
		const pauseSpy = vi.spyOn(EdgeTTSNativeStreamService, 'pause').mockResolvedValue(undefined);
		const stopSpy = vi.spyOn(EdgeTTSNativeStreamService, 'stop').mockResolvedValue(undefined);

		const paragraphs = ['Câu kiểm tra tạm dừng.'];
		const { result, unmount } = renderHook(() =>
			useNativeReadAloud(paragraphs, { bookId: 'b1', chapterId: 'c1', chapterNumber: 1 })
		);

		await act(async () => {
			result.current.startReading();
		});

		act(() => {
			result.current.pauseReading();
		});
		expect(pauseSpy).toHaveBeenCalled();
		expect(result.current.isPaused).toBe(true);

		act(() => {
			result.current.stopReading();
		});
		expect(stopSpy).toHaveBeenCalled();
		expect(result.current.isPlaying).toBe(false);

		unmount();
	});

	it('ủy quyền sang NativeTTSStreamService khi chọn engine thiết bị (browser) trên Android', async () => {
		useReaderConfigStore.setState({ ttsEngine: 'browser', voiceUri: 'vi-vn-x-gda-network' });
		const { NativeTTSStreamService } = await import('@/services/nativeTtsStream');
		vi.spyOn(NativeTTSStreamService, 'isAvailable').mockReturnValue(true);
		const startPlaybackSpy = vi.spyOn(NativeTTSStreamService, 'startPlayback').mockResolvedValue(undefined);

		const paragraphs = ['Câu kiểm tra giọng đọc máy thiết bị.'];
		const { result, unmount } = renderHook(() =>
			useNativeReadAloud(paragraphs, { bookId: 'b2', chapterId: 'c2', chapterNumber: 2 })
		);

		await act(async () => {
			result.current.startReading();
		});

		expect(startPlaybackSpy).toHaveBeenCalledWith(
			expect.objectContaining({
				chunks: ['Câu kiểm tra giọng đọc máy thiết bị.'],
				startIndex: 0,
				voice: 'vi-vn-x-gda-network',
				bookTitle: 'Truyện #b2',
				chapterTitle: 'Chương 2'
			})
		);

		unmount();
	});

	it('tô sáng từ khi nhận sự kiện onWordBoundary và không xóa highlight khi onChunkStart chuyển câu', async () => {
		useReaderConfigStore.setState({ ttsEngine: 'edge', edgeVoiceUri: 'vi-VN-HoaiMyNeural' });
		const { EdgeTTSNativeStreamService } = await import('@/services/edgeTtsNativeStream');
		vi.spyOn(EdgeTTSNativeStreamService, 'isAvailable').mockReturnValue(true);
		vi.spyOn(EdgeTTSNativeStreamService, 'startPlayback').mockResolvedValue(undefined);

		const highlightSpy = vi.spyOn(DomWordHighlighter.prototype, 'highlight').mockReturnValue({} as any);
		const clearSpy = vi.spyOn(DomWordHighlighter.prototype, 'clear');

		const container = document.createElement('div');
		const article = document.createElement('article');
		const pDiv = document.createElement('div');
		pDiv.setAttribute('data-paragraph-index', '0');
		pDiv.textContent = 'Một hai ba.';
		article.appendChild(pDiv);
		container.appendChild(article);
		document.body.appendChild(container);

		const paragraphs = ['Một hai ba.'];
		const { result, unmount } = renderHook(() =>
			useNativeReadAloud(paragraphs, { bookId: 'b3', chapterId: 'c3', chapterNumber: 3 })
		);

		await act(async () => {
			result.current.startReading();
		});

		// Giả lập sự kiện onWordBoundary từ native
		act(() => {
			EdgeTTSNativeStreamService['wordBoundaryListeners'].forEach((cb) =>
				cb({ chunkIndex: 0, charIndex: 0, charLength: 3, text: 'Một' })
			);
		});
		expect(highlightSpy).toHaveBeenCalled();

		clearSpy.mockClear();

		// Giả lập sự kiện onChunkStart khi câu kế tiếp phát gối đầu
		act(() => {
			EdgeTTSNativeStreamService['chunkStartListeners'].forEach((cb) => cb(0));
		});

		// Đảm bảo không clear để tránh nháy trắng màn hình (zero flicker)
		expect(clearSpy).not.toHaveBeenCalled();

		document.body.removeChild(container);
		unmount();
	});

	it('hỗ trợ chuyển câu tiếp theo (nextSection), câu trước (prevSection) và nhảy tới nội dung (jumpToContent)', async () => {
		useReaderConfigStore.setState({ ttsEngine: 'edge', edgeVoiceUri: 'vi-VN-HoaiMyNeural' });
		const { EdgeTTSNativeStreamService } = await import('@/services/edgeTtsNativeStream');
		vi.spyOn(EdgeTTSNativeStreamService, 'isAvailable').mockReturnValue(true);
		vi.spyOn(EdgeTTSNativeStreamService, 'startPlayback').mockResolvedValue(undefined);
		const seekSpy = vi.spyOn(EdgeTTSNativeStreamService, 'seekToChunk').mockResolvedValue(undefined);

		const paragraphs = ['Câu 1.', 'Câu 2.', 'Câu 3.'];
		const { result, unmount } = renderHook(() =>
			useNativeReadAloud(paragraphs, { bookId: 'b4', chapterId: 'c4', chapterNumber: 4 })
		);

		await act(async () => {
			result.current.startReading();
		});

		// Chuyển sang câu kế tiếp
		act(() => {
			result.current.nextSection();
		});
		expect(seekSpy).toHaveBeenCalledWith(1);

		// Chuyển lùi câu trước
		act(() => {
			result.current.prevSection();
		});
		expect(seekSpy).toHaveBeenCalledWith(0);

		// Nhảy tới câu cụ thể
		act(() => {
			result.current.jumpToContent(2);
		});
		expect(seekSpy).toHaveBeenCalledWith(2);

		unmount();
	});
});
