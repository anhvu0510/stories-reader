import { HashRouter, Routes, Route, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ReaderProvider } from './contexts/ReaderContext';
import { LibraryScreen } from './screens/LibraryScreen';
import { ChapterListScreen } from './screens/ChapterListScreen';
import { ReaderScreen } from './screens/ReaderScreen';
import { ToastContainer } from './components/Toast';

export type AppView = 
  | { type: 'library' }
  | { type: 'book', bookId: string, filterState?: 'all' | 'PENDING' }
  | { type: 'reader', bookId: string, chapterId: string };

function BookProxy({ onNavigate }: { onNavigate: (v: AppView) => void }) {
  const { bookId } = useParams<{ bookId: string }>();
  const [searchParams] = useSearchParams();
  if (!bookId) return null;
  const filterState = searchParams.get('filterState') === 'PENDING' ? 'PENDING' : 'all';
  return <ChapterListScreen bookId={bookId} filterState={filterState} onNavigate={onNavigate} />;
}

function ReaderProxy({ onNavigate }: { onNavigate: (v: AppView) => void }) {
  const { bookId, chapterId } = useParams<{ bookId: string, chapterId: string }>();
  if (!bookId || !chapterId) return null;
  return <ReaderScreen bookId={bookId} chapterId={chapterId} onNavigate={onNavigate} />;
}

function AppContent() {
  const navigate = useNavigate();

  const handleNavigate = (view: AppView) => {
    if (view.type === 'library') {
      navigate('/');
    } else if (view.type === 'book') {
      navigate(`/book/${view.bookId}${view.filterState === 'PENDING' ? '?filterState=PENDING' : ''}`);
    } else if (view.type === 'reader') {
      navigate(`/book/${view.bookId}/chapter/${view.chapterId}`);
    }
  };

  return (
    <div className="min-h-screen bg-background text-on-background flex flex-col">
      <Routes>
        <Route path="/" element={<LibraryScreen onNavigate={handleNavigate} />} />
        <Route path="/book/:bookId" element={<BookProxy onNavigate={handleNavigate} />} />
        <Route path="/book/:bookId/chapter/:chapterId" element={<ReaderProxy onNavigate={handleNavigate} />} />
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

