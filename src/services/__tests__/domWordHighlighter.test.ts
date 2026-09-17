// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
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
});
