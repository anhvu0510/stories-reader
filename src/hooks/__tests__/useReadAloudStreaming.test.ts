import { describe, expect, it } from 'vitest';
import { splitParagraphIntoSentences } from '../../services/gaplessTtsPlayer';

describe('splitParagraphIntoSentences', () => {
  it('splits a paragraph while preserving paragraph and text offsets', () => {
    const text =
      'Hai bóng người vô cùng cường đại. Thời đại này có mấy kẻ thấy chí bảo mà không hoảng sợ? Nữ nhân lên tiếng!';

    const sentences = splitParagraphIntoSentences(text, 4);

    expect(sentences).toHaveLength(3);
    expect(sentences[0]).toEqual({
      pIdx: 4,
      text: 'Hai bóng người vô cùng cường đại.',
      startOffset: 0,
      length: 'Hai bóng người vô cùng cường đại.'.length,
    });
    expect(sentences[1].startOffset).toBe(text.indexOf('Thời đại'));
    expect(sentences[2].text).toBe('Nữ nhân lên tiếng!');
  });

  it('merges a tiny trailing fragment into the preceding sentence', () => {
    const sentences = splitParagraphIntoSentences(
      'Một câu văn dài và đầy đủ ý nghĩa ở đây. Ồ!',
      1
    );

    expect(sentences).toEqual([
      {
        pIdx: 1,
        text: 'Một câu văn dài và đầy đủ ý nghĩa ở đây. Ồ!',
        startOffset: 0,
        length: 'Một câu văn dài và đầy đủ ý nghĩa ở đây. Ồ!'.length,
      },
    ]);
  });

  it('never merges sentences across paragraph boundaries', () => {
    const sentences = [
      ...splitParagraphIntoSentences('Chương một bắt đầu. Mọi thứ yên lặng.', 0),
      ...splitParagraphIntoSentences('Chương hai nối tiếp. Sấm sét đùng đùng!', 1),
    ];

    expect(sentences.map((sentence) => sentence.pIdx)).toEqual([0, 0, 1, 1]);
  });
});
