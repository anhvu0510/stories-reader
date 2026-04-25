import { useState } from 'react';
import { ReaderProvider } from './contexts/ReaderContext';
import { LibraryScreen } from './screens/LibraryScreen';
import { ChapterListScreen } from './screens/ChapterListScreen';
import { ReaderScreen } from './screens/ReaderScreen';

export type AppView = 
  | { type: 'library' }
  | { type: 'book', bookId: string }
  | { type: 'reader', bookId: string, chapterId: string };

export default function App() {
  const [view, setView] = useState<AppView>({ type: 'library' });

  return (
    <ReaderProvider>
      <div className="min-h-screen bg-background text-on-background flex flex-col">
        {view.type === 'library' && <LibraryScreen onNavigate={setView} />}
        {view.type === 'book' && <ChapterListScreen bookId={view.bookId} onNavigate={setView} />}
        {view.type === 'reader' && <ReaderScreen bookId={view.bookId} chapterId={view.chapterId} onNavigate={setView} />}
      </div>
    </ReaderProvider>
  );
}

