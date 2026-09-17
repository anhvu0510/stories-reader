export class DomWordHighlighter {
  private readonly className: string;
  private marks: HTMLElement[] = [];

  constructor(className: string) {
    this.className = className;
  }

  public highlight(rootElement: HTMLElement, startOffset: number, length: number): void {
    this.clear();
    if (length <= 0) return;

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
  }

  public clear(): void {
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
}
