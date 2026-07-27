import { Book, Chapter, Replacement } from '../shared/types';

export const MOCK_BOOKS: Book[] = [
  {
    bookId: 'b1',
    bookName: 'Thần Thoại Thất Lạc',
    chapterCount: 120,
    totalTranslated: 85,
    totalPending: 35,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-03-15T10:00:00Z',
    author: 'Tác Giả Mẫu',
    lastReadChapter: { chapterId: 'b1c8', chapterNumber: '8', title: 'Tiếng thét' },
  },
  {
    bookId: 'b3',
    bookName: 'Đêm Trăng Thất Lạc',
    chapterCount: 50,
    totalTranslated: 28,
    totalPending: 22,
    createdAt: '2024-02-01T00:00:00Z',
    updatedAt: '2024-03-18T10:00:00Z',
    author: 'Vô Danh',
    lastReadChapter: { chapterId: 'c1', chapterNumber: '1', title: 'Đêm trăng đầu tiên' },
  },
];

export const MOCK_REPLACEMENTS: Replacement[] = [
  { id: '1', match: 'tiểu tử', replacement: 'nhóc con', scope: 'global' },
  { id: '2', match: 'lão đại', replacement: 'đại ca', scope: 'book', bookId: 'b1' },
  { id: '3', match: 'nữ tử', replacement: 'cô gái', scope: 'chapter', chapterId: 'c1' },
];

export const MOCK_CHAPTERS: Record<string, Chapter[]> = {
  b3: [
    { chapterId: 'c1', chapterNumber: 1, title: 'Đêm trăng đầu tiên', state: 'SUCCEEDED', updatedAt: '2024-03-15T10:00:00Z' },
    { chapterId: 'c2', chapterNumber: 2, title: 'Tiếng gọi trong gió', state: 'PENDING', updatedAt: '2024-03-16T10:00:00Z' },
    { chapterId: 'c3', chapterNumber: 3, title: 'Bóng hình mờ ảo', state: 'PENDING', updatedAt: '2024-03-17T10:00:00Z' },
    { chapterId: 'c4', chapterNumber: 4, title: 'Quyết định cuối cùng', state: 'PENDING', updatedAt: '2024-03-17T12:00:00Z' },
    { chapterId: 'c5', chapterNumber: 5, title: 'Vực sâu (Sắp ra mắt)', state: 'FAILED', updatedAt: '2024-03-18T10:00:00Z' },
  ],
  b1: [
    { chapterId: 'b1c8', chapterNumber: 8, title: 'Tiếng thét', state: 'SUCCEEDED', updatedAt: '2024-03-15T10:00:00Z' },
    { chapterId: 'b1c9', chapterNumber: 9, title: 'Kẻ săn mộng', state: 'SUCCEEDED', updatedAt: '2024-03-15T10:00:00Z' },
  ],
};
