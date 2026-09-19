export function openChapter(bookId: string, chapterId: string) {
  if (!bookId || !chapterId) return;

  const targetHash = `#/book/${bookId}/chapter/${chapterId}`;
  if (typeof window !== 'undefined') {
    window.location.hash = `#/book/${bookId}/chapter/${chapterId}`;
    if (typeof window.location.reload === 'function') {
      try {
        window.location.reload();
      } catch {
        // Safe handling for test environments
      }
    }
  }
}
