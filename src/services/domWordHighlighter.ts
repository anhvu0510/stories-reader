export class DomWordHighlighter {
  private readonly className: string;
  private marks: HTMLElement[] = [];
  private lineHighlight: HTMLElement | null = null;

  constructor(className: string) {
    this.className = className;
  }

  public highlight(rootElement: HTMLElement, startOffset: number, length: number): void {
    this.clearWordMarks();
    if (length <= 0) {
      this.removeLineHighlight();
      return;
    }

    const walker = document.createTreeWalker(rootElement, NodeFilter.SHOW_TEXT, null);
    const targetNodes: Array<{ node: Text; nodeStart: number }> = [];
    const endOffset = startOffset + length;
    let currentOffset = 0;
    let node: Node | null;

    while ((node = walker.nextNode())) {
      const textNode = node as Text;
      const nodeLength = textNode.data.length;

      if (currentOffset + nodeLength > startOffset && currentOffset < endOffset) {
        targetNodes.push({ node: textNode, nodeStart: currentOffset });
      }

      currentOffset += nodeLength;
      if (currentOffset >= endOffset) break;
    }

    targetNodes.forEach(({ node: textNode, nodeStart }) => {
      const overlapStart = Math.max(0, startOffset - nodeStart);
      const overlapEnd = Math.min(textNode.data.length, endOffset - nodeStart);
      const range = document.createRange();
      range.setStart(textNode, overlapStart);
      range.setEnd(textNode, overlapEnd);

      const mark = document.createElement('msreadoutspan');
      mark.className = this.className;
      mark.appendChild(range.extractContents());
      range.insertNode(mark);
      this.marks.push(mark);
    });

    this.updateLineHighlight(rootElement);
  }

  public clear(): void {
    this.clearWordMarks();
    this.removeLineHighlight();
  }

  private clearWordMarks(): void {
    const parents = new Set<Node>();

    this.marks.forEach((mark) => {
      const parent = mark.parentNode;
      if (!parent) return;

      parents.add(parent);
      mark.replaceWith(document.createTextNode(mark.textContent ?? ''));
    });

    parents.forEach((parent) => parent.normalize());
    this.marks = [];
  }

  private updateLineHighlight(rootElement: HTMLElement): void {
    const wordRects = this.marks
      .map((mark) => mark.getBoundingClientRect())
      .filter((rect) => rect.width > 0 && rect.height > 0);
    if (wordRects.length === 0) {
      this.removeLineHighlight();
      return;
    }

    const wordRect = this.unionRects(wordRects);
    const wordMiddleY = wordRect.top + wordRect.height / 2;
    const contentRange = document.createRange();
    contentRange.selectNodeContents(rootElement);
    const lineRects = Array.from(contentRange.getClientRects()).filter(
      (rect) =>
        rect.width > 0 &&
        rect.height > 0 &&
        wordMiddleY >= rect.top - 1 &&
        wordMiddleY <= rect.bottom + 1
    );
    const lineRect = lineRects.length > 0 ? this.unionRects(lineRects) : wordRect;

    if (!this.lineHighlight) {
      this.lineHighlight = document.createElement('span');
      this.lineHighlight.className = 'msreadout-line-highlight';
      this.lineHighlight.setAttribute('aria-hidden', 'true');
      document.body.appendChild(this.lineHighlight);
    }

    const scrollX = window.scrollX || document.documentElement.scrollLeft || 0;
    const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
    this.lineHighlight.style.transform = `translate3d(${lineRect.left + scrollX}px, ${
      lineRect.top + scrollY
    }px, 0)`;
    this.lineHighlight.style.width = `${lineRect.width}px`;
    this.lineHighlight.style.height = `${lineRect.height}px`;
  }

  private unionRects(rects: DOMRect[]): DOMRect {
    const left = Math.min(...rects.map((rect) => rect.left));
    const top = Math.min(...rects.map((rect) => rect.top));
    const right = Math.max(...rects.map((rect) => rect.right));
    const bottom = Math.max(...rects.map((rect) => rect.bottom));

    return new DOMRect(left, top, right - left, bottom - top);
  }

  private removeLineHighlight(): void {
    this.lineHighlight?.remove();
    this.lineHighlight = null;
  }
}
