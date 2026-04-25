// API Types
export interface Book {
  bookId: string;
  bookName: string;
  chapterCount: number;
  totalTranslated: number;
  totalPending: number;
  createdAt: string;
  coverUrl?: string;
  author?: string;
  source?: string;
}

export interface Chapter {
  chapterId: string;
  chapterNumber: number;
  title: string;
  state: 'SUCCEEDED' | 'PENDING' | 'FAILED';
  updatedAt: string;
}

export interface ChapterContent {
  chapter: {
    chapterId: string;
    chapterNumber: number;
    title: string;
    bookName: string;
    state: string;
    totalTokens: number;
    content: string[];
  };
  navigation?: {
    prev?: { chapterId: string | null };
    next?: { chapterId: string | null; chapterNumber?: number; title?: string };
  };
}

export interface Replacement {
  id: string;
  match: string;
  replacement: string;
  scope: 'chapter' | 'book' | 'global';
  bookId?: string;
  chapterId?: string;
}

// Fallback Mock Data
const MOCK_REPLACEMENTS: Replacement[] = [
  { id: '1', match: 'tiểu tử', replacement: 'nhóc con', scope: 'global' },
  { id: '2', match: 'lão đại', replacement: 'đại ca', scope: 'book', bookId: 'b1' },
  { id: '3', match: 'nữ tử', replacement: 'cô gái', scope: 'chapter', chapterId: 'c1' },
];

const MOCK_BOOKS: Book[] = [
  {
    bookId: 'b1',
    bookName: 'Bóng Tối Rừng Sâu',
    chapterCount: 42,
    totalTranslated: 9,
    totalPending: 33,
    createdAt: '2024-01-15',
    source: 'AUDINO.APP',
    author: 'Khuyết Danh',
    coverUrl: 'https://images.unsplash.com/photo-1542201991-306ce597621c?q=80&w=300&auto=format&fit=crop'
  },
  {
    bookId: 'b2',
    bookName: 'Hành Trình Cô Độc',
    chapterCount: 120,
    totalTranslated: 42,
    totalPending: 78,
    createdAt: '2024-02-01',
    source: 'NGUONTRUYEN.VN',
    author: 'Vô Danh',
    coverUrl: 'https://images.unsplash.com/photo-1455390582262-044cdead2708?q=80&w=300&auto=format&fit=crop'
  },
  {
    bookId: 'b3',
    bookName: 'Đêm Trường Ca',
    chapterCount: 5,
    totalTranslated: 4,
    totalPending: 1,
    createdAt: '2024-03-10',
    source: 'THUVIEN.SO',
    author: 'Nam Cao',
    coverUrl: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?q=80&w=300&auto=format&fit=crop'
  }
];

const MOCK_CHAPTERS: Record<string, Chapter[]> = {
  'b3': [
    { chapterId: 'c1', chapterNumber: 1, title: 'Đêm trăng đầu tiên', state: 'SUCCEEDED', updatedAt: '2024-03-15T10:00:00Z' },
    { chapterId: 'c2', chapterNumber: 2, title: 'Tiếng gọi trong gió', state: 'PENDING', updatedAt: '2024-03-16T10:00:00Z' },
    { chapterId: 'c3', chapterNumber: 3, title: 'Bóng hình mờ ảo', state: 'PENDING', updatedAt: '2024-03-17T10:00:00Z' },
    { chapterId: 'c4', chapterNumber: 4, title: 'Quyết định cuối cùng', state: 'PENDING', updatedAt: '2024-03-17T12:00:00Z' },
    { chapterId: 'c5', chapterNumber: 5, title: 'Vực sâu (Sắp ra mắt)', state: 'FAILED', updatedAt: '2024-03-18T10:00:00Z' },
  ],
  'b1': [
    { chapterId: 'b1c8', chapterNumber: 8, title: 'Tiếng thét', state: 'SUCCEEDED', updatedAt: '2024-03-15T10:00:00Z' },
    { chapterId: 'b1c9', chapterNumber: 9, title: 'Kẻ săn mộng', state: 'SUCCEEDED', updatedAt: '2024-03-15T10:00:00Z' },
  ]
};

const MOCK_CONTENT: Record<string, ChapterContent> = {
  'c1': {
    chapter: {
      chapterId: 'c1',
      chapterNumber: 1,
      title: 'Đêm trăng đầu tiên',
      bookName: 'Đêm Trường Ca',
      state: 'SUCCEEDED',
      totalTokens: 1500,
      content: [
        'Bóng tối bao trùm lấy không gian tĩnh lặng của thư viện. Chút ánh sáng lờ mờ từ những ngọn đèn dầu hắt lên những kệ sách gỗ sồi già nua, tạo ra những hình thù kỳ dị nhảy múa trên tường.',
        'Anh lật từng trang sách cũ kỹ, cảm nhận mùi hương quen thuộc của giấy và mực in.',
        'Đây không phải là một đêm bình thường. Gió rít ngoài cửa sổ mang theo những âm thanh xào xạc của khu rừng già.'
      ]
    },
    navigation: {
      next: { chapterId: 'c2', chapterNumber: 2, title: 'Tiếng gọi trong gió' }
    }
  },
  'b1c9': {
    chapter: {
      chapterId: 'b1c9',
      chapterNumber: 9,
      title: 'Kẻ săn mộng',
      bookName: 'Bóng Tối Rừng Sâu',
      state: 'SUCCEEDED',
      totalTokens: 2500,
      content: [
        'Đêm buông xuống trên thành phố xa hoa, những ánh đèn neon nhấp nháy không đủ để xua tan màn sương mù mờ ảo bao phủ các con phố. Orion đứng trên sân thượng của tòa nhà chọc trời cao nhất, ánh mắt đăm chiêu nhìn xuống dòng xe cộ hối hả bên dưới.',
        'Anh không phải là một cư dân bình thường của nơi này. Anh là một "Kẻ săn mộng".',
        'Công việc của anh bắt đầu khi mọi người chìm vào giấc ngủ. Những giấc mơ không chỉ là ảo ảnh sinh ra từ tiềm thức; trong thế giới này, chúng có thể bị đánh cắp, bị bán trộm trên chợ đen, hoặc bị biến đổi thành những cơn ác mộng kinh hoàng để khủng bố tâm trí người khác.',
        'Tối nay, mục tiêu của anh là một giấc mơ đặc biệt. Nó được mô tả là chứa đựng chìa khóa mở ra cánh cửa đến "Kho lưu trữ vĩnh hằng", một truyền thuyết cổ xưa về nơi cất giữ ký ức của toàn nhân loại từ thuở hồng hoang.',
        '*  *  *',
        'Orion kéo cổ áo khoác da cao lên, che đi nửa khuôn mặt. Anh chạm nhẹ vào một thiết bị nhỏ gắn sau tai - thiết bị khuếch đại sóng não cho phép anh xâm nhập vào tầng không gian của giấc mơ. Không gian xung quanh bắt đầu gợn sóng như mặt nước bị ném đá.',
        '"Bắt đầu kết nối," một giọng nói cơ khí lạnh lẽo vang lên trong tai anh. "Mục tiêu: Khu phức hợp Aurora. Đối tượng: Kỹ sư trưởng Elara."',
        'Cảnh vật thành phố nhòa đi. Orion cảm thấy mình đang rơi tự do qua một đường hầm của những mảng màu rực rỡ và những âm thanh hỗn tạp. Khi mở mắt ra, anh thấy mình đang đứng giữa một thư viện khổng lồ. Sách ở đây không bay lơ lửng, cũng không xếp gọn gàng trên kệ; chúng trôi nổi trong không gian như những hòn đảo nhỏ.',
        'Đây là tâm trí của Elara.',
        'Anh phải tìm ra ký ức cốt lõi trước khi hệ thống phòng thủ tinh thần của cô kích hoạt. Những Kẻ săn mộng khác có thể đã theo dõi tín hiệu của anh. Thời gian không có nhiều.',
        'Đột nhiên, một bóng đen xẹt qua khóe mắt anh. Không phải là phòng thủ của Elara. Là một kẻ ngoại đạo khác.',
        '"Tìm thấy mày rồi," Orion lẩm bẩm, rút vũ khí của mình ra - một thanh kiếm năng lượng phát ra ánh sáng xanh mờ ảo. Cuộc chiến thực sự bây giờ mới bắt đầu.'
      ]
    },
    navigation: {
      prev: { chapterId: 'b1c8' },
      next: { chapterId: 'b1c10', chapterNumber: 10, title: 'Chương 10' }
    }
  }
};


// API Implementation
const NGROK_BASE_URL = 'https://vocal-apparently-spaniel.ngrok-free.app';
const LOCAL_BASE_URL = 'http://localhost:3200';

const fetchWithRetry = async (path: string, options: RequestInit = {}, retries = 3): Promise<Response> => {
  const headers = {
    'ngrok-skip-browser-warning': 'true',
    'Content-Type': 'application/json',
    ...options.headers,
  };

  try {
    const res = await fetch(`${NGROK_BASE_URL}${path}`, { ...options, headers });
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    return res;
  } catch (err) {
    if (retries > 0) {
      console.warn(`Request failed, retrying local (${retries} retries left)...`, err);
      try {
        const localRes = await fetch(`${LOCAL_BASE_URL}${path}`, { ...options, headers });
        if (!localRes.ok) throw new Error(`Local HTTP error! status: ${localRes.status}`);
        return localRes;
      } catch (localErr) {
        if (retries > 1) {
           return fetchWithRetry(path, options, retries - 1);
        }
        throw localErr;
      }
    }
    throw err;
  }
};

export const api = {
  getBooks: async (page = 1, search = ''): Promise<{ data: Book[], pagination: any }> => {
    try {
      const res = await fetchWithRetry(`/api/books?page=${page}&limit=100&search=${search}`);
      return await res.json();
    } catch (e) {
      console.warn("Failed to fetch from API, using mock data", e);
      return {
        data: MOCK_BOOKS.filter(b => b.bookName.toLowerCase().includes(search.toLowerCase())),
        pagination: { currentPage: 1, totalPages: 1, total: MOCK_BOOKS.length }
      };
    }
  },

  getChapters: async (bookId: string): Promise<{ chapters: Chapter[], pagination: any }> => {
    try {
      const res = await fetchWithRetry(`/api/books/${bookId}/chapters?page=1&limit=500&sortBy=chapterNumber&sortOrder=ASC`);
      return await res.json();
    } catch (e) {
      console.warn("Failed to fetch chapters, using mock data", e);
      return {
        chapters: MOCK_CHAPTERS[bookId] || [],
        pagination: { currentPage: 1, totalPages: 1, total: MOCK_CHAPTERS[bookId]?.length || 0 }
      };
    }
  },

  getChapterContent: async (chapterId: string): Promise<ChapterContent> => {
    try {
      const res = await fetchWithRetry(`/api/chapters/${chapterId}?groupLines=1`);
      return await res.json();
    } catch (e) {
      console.warn("Failed to fetch chapter content, using mock data", e);
      if (MOCK_CONTENT[chapterId]) {
        return MOCK_CONTENT[chapterId];
      }
      throw new Error("Chapter not found in mock data");
    }
  },

  getReplacements: async (bookId?: string, chapterId?: string): Promise<{ data: Replacement[] }> => {
    try {
      const query = new URLSearchParams();
      if (bookId) query.append('bookId', bookId);
      if (chapterId) query.append('chapterId', chapterId);
      const res = await fetchWithRetry(`/api/replacements?${query.toString()}`);
      return await res.json();
    } catch (e) {
      console.warn("Failed to fetch replacements, using mock data", e);
      return { data: MOCK_REPLACEMENTS };
    }
  },

  saveReplacement: async (data: Partial<Replacement>): Promise<Replacement> => {
    try {
      const isEditing = !!data.id;
      const url = isEditing ? `/api/replacements/${data.id}` : `/api/replacements`;
      const method = isEditing ? 'PUT' : 'POST';
      const res = await fetchWithRetry(url, {
        method,
        body: JSON.stringify(data)
      });
      return await res.json();
    } catch (e) {
      console.warn("Failed to save replacement, mocking...", e);
      return {
        id: data.id || Date.now().toString(),
        match: data.match || '',
        replacement: data.replacement || '',
        scope: data.scope || 'global',
        bookId: data.bookId,
        chapterId: data.chapterId,
      };
    }
  },

  deleteReplacement: async (id: string): Promise<void> => {
    try {
      await fetchWithRetry(`/api/replacements/${id}`, { method: 'DELETE' });
    } catch (e) {
      console.warn("Failed to delete replacement, mocking...", e);
    }
  }
};
