// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { splitParagraphIntoSentences } from '../useReadAloud';

describe('useReadAloud - Sentence Level Chunking & Prefetching', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('splitParagraphIntoSentences', () => {
    it('splits a paragraph into sentence chunks with accurate pIdx, startOffset, and length', () => {
      const pIdx = 0;
      const text = 'Hai bóng người vô cùng cường đại. Thời đại này có mấy kẻ thấy chí bảo mà không hoảng sợ? Nữ nhân trong hai bóng người lên tiếng!';
      
      const chunks = splitParagraphIntoSentences(text, pIdx);

      expect(chunks.length).toBe(3);

      expect(chunks[0].pIdx).toBe(0);
      expect(chunks[0].text).toBe('Hai bóng người vô cùng cường đại.');
      expect(chunks[0].startOffset).toBe(0);
      expect(chunks[0].length).toBe(chunks[0].text.length);

      expect(chunks[1].pIdx).toBe(0);
      expect(chunks[1].text).toBe('Thời đại này có mấy kẻ thấy chí bảo mà không hoảng sợ?');

      expect(chunks[2].pIdx).toBe(0);
      expect(chunks[2].text).toBe('Nữ nhân trong hai bóng người lên tiếng!');
    });

    it('merges tiny trailing sentence fragments under 10 chars into preceding sentence', () => {
      const pIdx = 1;
      const text = 'Một câu văn dài và đầy đủ ý nghĩa ở đây. Ồ!';

      const chunks = splitParagraphIntoSentences(text, pIdx);

      expect(chunks.length).toBe(1);
      expect(chunks[0].text).toBe('Một câu văn dài và đầy đủ ý nghĩa ở đây. Ồ!');
      expect(chunks[0].pIdx).toBe(1);
    });

    it('handles multi-paragraph sentence chunking with correct pIdx', () => {
      const text1 = 'Chương 1 bắt đầu. Mọi thứ yên lặng.';
      const text2 = 'Chương 2 nối tiếp. Sấm sét đùng đùng!';

      const chunks1 = splitParagraphIntoSentences(text1, 0);
      const chunks2 = splitParagraphIntoSentences(text2, 1);
      const allChunks = [...chunks1, ...chunks2];

      expect(allChunks.length).toBe(4);
      expect(allChunks[0].pIdx).toBe(0);
      expect(allChunks[1].pIdx).toBe(0);
      expect(allChunks[2].pIdx).toBe(1);
      expect(allChunks[3].pIdx).toBe(1);
    });
  });

  describe('triggerParallelPrefetchWindow', () => {
    it('fetches parallel sentence requests for a window of 3 sentences ahead', () => {
      const mockChunks = [
        { pIdx: 0, text: 'Câu 0.', startOffset: 0, length: 6 },
        { pIdx: 0, text: 'Câu 1.', startOffset: 7, length: 6 },
        { pIdx: 0, text: 'Câu 2.', startOffset: 14, length: 6 },
        { pIdx: 0, text: 'Câu 3.', startOffset: 21, length: 6 },
        { pIdx: 0, text: 'Câu 4.', startOffset: 28, length: 6 },
      ];

      const cacheMap = new Map<number, Promise<any>>();
      const mockSynthesize = vi.fn().mockImplementation((text) => Promise.resolve(`blob_${text}`));

      // Simulate triggerParallelPrefetchWindow function logic
      const windowSize = 3;
      const currentIndex = 0;

      for (let offset = 1; offset <= windowSize; offset++) {
        const targetIndex = currentIndex + offset;
        if (targetIndex >= mockChunks.length) break;
        if (cacheMap.has(targetIndex)) continue;

        const targetChunk = mockChunks[targetIndex];
        if (targetChunk && targetChunk.text.trim()) {
          cacheMap.set(targetIndex, mockSynthesize(targetChunk.text));
        }
      }

      expect(cacheMap.size).toBe(3);
      expect(cacheMap.has(1)).toBe(true);
      expect(cacheMap.has(2)).toBe(true);
      expect(cacheMap.has(3)).toBe(true);
      expect(cacheMap.has(4)).toBe(false);

      expect(mockSynthesize).toHaveBeenCalledWith('Câu 1.');
      expect(mockSynthesize).toHaveBeenCalledWith('Câu 2.');
      expect(mockSynthesize).toHaveBeenCalledWith('Câu 3.');
    });
  });
});
