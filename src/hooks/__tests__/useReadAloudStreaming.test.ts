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
});
