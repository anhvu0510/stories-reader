import { useEffect } from 'react';

export const DEFAULT_APP_TITLE = 'Reader Stories App';

/**
 * Custom hook to dynamically update document.title
 * and cleanly restore the default title upon unmounting.
 */
export function useDocumentTitle(
  title?: string | null,
  fallbackTitle: string = DEFAULT_APP_TITLE,
  restoreOnUnmount: boolean = true
) {
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const formattedTitle = title?.trim();
    if (formattedTitle) {
      document.title = formattedTitle;
    } else if (fallbackTitle) {
      document.title = fallbackTitle;
    }

    return () => {
      if (restoreOnUnmount && typeof document !== 'undefined') {
        document.title = fallbackTitle;
      }
    };
  }, [title, fallbackTitle, restoreOnUnmount]);
}
