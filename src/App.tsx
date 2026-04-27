import { HashRouter, Routes, Route, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ReaderProvider } from './contexts/ReaderContext';
import { LibraryScreen } from './screens/LibraryScreen';
import { ChapterListScreen } from './screens/ChapterListScreen';
import { ReaderScreen } from './screens/ReaderScreen';
import { ToastContainer } from './components/Toast';

export type AppView = 
  | { type: 'library', tab?: 'books' | 'history' | 'ai' }
  | { type: 'book', bookId: string, filterState?: 'all' | 'PENDING', rootTab: string }
  | { type: 'reader', bookId: string, chapterId: string, rootTab: string };

function BookProxy({ onNavigate }: { onNavigate: (v: AppView) => void }) {
  const { bookId , rootTab } = useParams<{ bookId: string, rootTab: string }>();
  const [searchParams] = useSearchParams();
  if (!bookId) return null;
  const filterState = searchParams.get('filterState') === 'PENDING' ? 'PENDING' : 'all';
  return <ChapterListScreen bookId={bookId} filterState={filterState} rootTab={rootTab} onNavigate={onNavigate} />;
}

function ReaderProxy({ onNavigate }: { onNavigate: (v: AppView) => void }) {
  const { bookId, chapterId, rootTab } = useParams<{ bookId: string, chapterId: string, rootTab: string }>();
  if (!bookId || !chapterId) return null;
  return <ReaderScreen bookId={bookId} chapterId={chapterId} rootTab={rootTab} onNavigate={onNavigate} />;
}

function AppContent() {
  const navigate = useNavigate();

  const handleNavigate = (view: AppView) => {
    if (view.type === 'library') {
      navigate(`/${view.tab ? `?tab=${view.tab}` : ''}`);
    } else if (view.type === 'book') {
      navigate(`/${view.rootTab ?? 'NONE'}/${view.bookId}${view.filterState === 'PENDING' ? '?filterState=PENDING' : ''}`);
    } else if (view.type === 'reader') {
      navigate(`/${view.rootTab ?? 'NONE'}/${view.bookId}/${view.chapterId}`);
    }
  };

  return (
    <div className="min-h-screen bg-background text-on-background flex flex-col">
      <Routes>
        <Route path="/" element={<LibraryScreen onNavigate={handleNavigate} />} />
        <Route path="/:rootTab/:bookId" element={<BookProxy onNavigate={handleNavigate} />} />
        <Route path="/:rootTab/:bookId/:chapterId" element={<ReaderProxy onNavigate={handleNavigate} />} />
      </Routes>
    </div>
  );
}

export default function App() {
  return (
    <ReaderProvider>
      <HashRouter>
        <AppContent />
        <ToastContainer />
      </HashRouter>
    </ReaderProvider>
  );
}

