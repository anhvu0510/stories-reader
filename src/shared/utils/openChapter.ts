export function openChapter(bookId: string, chapterId: string) {
  if (!bookId || !chapterId) return;

  const targetHash = `#/book/${bookId}/chapter/${chapterId}`;
  if (typeof window !== 'undefined') {
    if (window.location.hash !== targetHash) {
      window.location.hash = targetHash;
    }
  }
}
