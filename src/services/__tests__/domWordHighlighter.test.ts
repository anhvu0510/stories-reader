// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { DomWordHighlighter } from '../domWordHighlighter';

describe('DomWordHighlighter', () => {
  it('moves the highlight without rebuilding unrelated formatted DOM', () => {
    const root = document.createElement('div');
    root.innerHTML = '<strong>Xin</strong> chào bạn';
    const strong = root.querySelector('strong');
    const highlighter = new DomWordHighlighter('active-word');

    highlighter.highlight(root, 4, 4);
    expect(root.querySelector('msreadoutspan')?.textContent).toBe('chào');

    highlighter.highlight(root, 9, 3);

    expect(root.querySelector('strong')).toBe(strong);
    expect(root.querySelectorAll('msreadoutspan')).toHaveLength(1);
    expect(root.querySelector('msreadoutspan')?.textContent).toBe('bạn');
    expect(root.textContent).toBe('Xin chào bạn');
  });

  it('restores the original text when cleared', () => {
    const root = document.createElement('div');
    root.textContent = 'Xin chào';
    const highlighter = new DomWordHighlighter('active-word');

    highlighter.highlight(root, 4, 4);
    highlighter.clear();

    expect(root.querySelector('msreadoutspan')).toBeNull();
    expect(root.textContent).toBe('Xin chào');
  });

  it('keeps one reusable highlight on the rendered line containing the active word', () => {
    const root = document.createElement('div');
    root.textContent = 'Dòng đầu tiên và dòng thứ hai';
    document.body.appendChild(root);

    const originalCreateRange = document.createRange.bind(document);
    const createRange = vi.spyOn(document, 'createRange').mockImplementation(() => {
      const range = originalCreateRange();
      Object.defineProperty(range, 'getClientRects', {
        value: () => [
          new DOMRect(24, 20, 210, 32),
          new DOMRect(24, 52, 178, 32),
        ],
      });
      return range;
    });
    const getBoundingClientRect = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function () {
        return this.tagName === 'MSREADOUTSPAN'
          ? new DOMRect(96, 52, 42, 32)
          : new DOMRect();
      });
    const highlighter = new DomWordHighlighter('active-word');

    highlighter.highlight(root, 19, 4);

    const firstLineHighlight = document.querySelector<HTMLElement>('.msreadout-line-highlight');
    expect(firstLineHighlight).not.toBeNull();
    expect(firstLineHighlight?.style.transform).toBe('translate3d(24px, 52px, 0)');
    expect(firstLineHighlight?.style.width).toBe('178px');
    expect(firstLineHighlight?.style.height).toBe('32px');

    highlighter.highlight(root, 24, 3);

    expect(document.querySelectorAll('.msreadout-line-highlight')).toHaveLength(1);
    expect(document.querySelector('.msreadout-line-highlight')).toBe(firstLineHighlight);

    highlighter.clear();
    expect(document.querySelector('.msreadout-line-highlight')).toBeNull();

    getBoundingClientRect.mockRestore();
    createRange.mockRestore();
    root.remove();
  });
});
