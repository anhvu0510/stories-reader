import { Chapter, ChapterContent } from '../shared/types';
import { apiClient } from '../services/apiClient';
import { offlineDb } from '../lib/offlineDb';
import { useAppStore } from '../stores/useAppStore';

export const ChapterRepository = {
  async getChapters(
    bookId: string,
    page: number = 1,
    limit: number = 50,
    sortBy: string = 'chapterNumber',
    sortOrder: string = 'ASC',
    state?: string,
    search?: string,
    fromChapterNumber?: number,
    toChapterNumber?: number
  ): Promise<{ chapters: Chapter[]; pagination: any }> {
    const isOffline = useAppStore.getState().isOfflineMode;

    if (!isOffline) {
      try {
        const query = new URLSearchParams({
          page: page.toString(),
          limit: limit.toString(),
          sortBy,
          sortOrder,
        });
        if (state && state !== 'all') query.append('state', state);
        if (search) query.append('search', search);
        if (fromChapterNumber !== undefined) query.append('fromChapterNumber', fromChapterNumber.toString());
        if (toChapterNumber !== undefined) query.append('toChapterNumber', toChapterNumber.toString());

        const res = await apiClient.get<any>(`/api/books/${bookId}/chapters?${query.toString()}`);
        if (res) {
          const rawItems = res.chapters || res.data || res.items || (Array.isArray(res) ? res : []);
          const rawChapters: Chapter[] = rawItems.map((c: any, idx: number) => ({
            chapterId: String(c.chapterId || c._id || c.id || `chap-${c.chapterNumber || idx + 1}`),
            chapterNumber: typeof c.chapterNumber === 'number' ? c.chapterNumber : (parseInt(c.chapterNumber, 10) || idx + 1),
            title: c.title || `Chương ${c.chapterNumber || idx + 1}`,
            state: c.state || 'SUCCEEDED',
            updatedAt: c.updatedAt || new Date().toISOString(),
            bookId: c.bookId || bookId,
          }));
          const pag = res.pagination || res.meta || {};

          let totalPages: number;
          let total: number;

          if (pag.totalPages !== undefined || pag.total_pages !== undefined) {
            totalPages = pag.totalPages ?? pag.total_pages;
            total = pag.total ?? pag.totalItems ?? pag.total_count ?? (totalPages * limit);
          } else if (pag.total !== undefined || pag.totalItems !== undefined || pag.total_count !== undefined) {
            total = pag.total ?? pag.totalItems ?? pag.total_count;
            totalPages = Math.ceil(total / limit) || 1;
          } else {
            total = rawChapters.length;
            totalPages = rawChapters.length >= limit ? page + 1 : page;
          }

          const currentPage = pag.currentPage ?? pag.page ?? page;

          return {
            chapters: rawChapters,
            pagination: {
              currentPage,
              totalPages,
              total,
            },
          };
        }
      } catch (e) {
        console.warn('Failed to fetch chapters online, falling back to offlineDb:', e);
      }
    }

    let chapters: Chapter[] = await offlineDb.getChapters(bookId);

    if (state && state !== 'all') {
      chapters = chapters.filter((c) => c.state === state);
    }
    if (search) {
      const queryStr = search.toLowerCase();
      chapters = chapters.filter(
        (c) => c.title.toLowerCase().includes(queryStr) || c.chapterNumber.toString().includes(queryStr)
      );
    }

    if (sortBy === 'chapterNumber') {
      chapters.sort((a, b) =>
        sortOrder === 'ASC' ? a.chapterNumber - b.chapterNumber : b.chapterNumber - a.chapterNumber
      );
    }

    const total = chapters.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const paginated = chapters.slice((page - 1) * limit, page * limit);

    return {
      chapters: paginated,
      pagination: { currentPage: page, totalPages, total },
    };
  },

  async getChapterContent(
    chapterId: string,
    groupLines: number = 1,
    isEnabledReplace: boolean = true,
    rootTab = '',
    batchSize: number = 1
  ): Promise<ChapterContent> {
    const isOffline = useAppStore.getState().isOfflineMode;

    const processOfflineContent = async (rawContent: ChapterContent): Promise<ChapterContent> => {
      const content = JSON.parse(JSON.stringify(rawContent)) as ChapterContent;
      try {
        const chapMeta = await offlineDb.getChapterMeta(chapterId);
        const bookId = chapMeta?.bookId || (content.chapter as any)?.bookId;

        // 1. Offline replacements
        if (isEnabledReplace && content.chapter?.content && Array.isArray(content.chapter.content)) {
          let reps = await offlineDb.getReplacements();
          if (bookId) {
            reps = reps.filter((r) => r.scope === 'global' || r.bookId === bookId || r.chapterId === chapterId);
          } else {
            reps = reps.filter((r) => r.scope === 'global');
          }
          reps.sort((a, b) => (b.match?.length || 0) - (a.match?.length || 0));

          if (reps.length > 0) {
            content.chapter.content = content.chapter.content.map((line) => {
              let res = line;
              for (const r of reps) {
                if (r.match) res = res.split(r.match).join(r.replacement);
              }
              return res;
            });
          }
        }

        // 2. Offline groupLines
        if (groupLines > 1 && content.chapter?.content && Array.isArray(content.chapter.content)) {
          const grouped: string[] = [];
          let currentGroup: string[] = [];
          for (const line of content.chapter.content) {
            if (!line.trim()) continue;
            currentGroup.push(line);
            if (currentGroup.length >= groupLines) {
              grouped.push(currentGroup.join(' '));
              currentGroup = [];
            }
          }
          if (currentGroup.length > 0) grouped.push(currentGroup.join(' '));
          content.chapter.content = grouped;
        }

        // 3. Offline dynamic navigation (prev & next)
        if (bookId) {
          const chapters = await offlineDb.getChapters(bookId);
          chapters.sort((a, b) => a.chapterNumber - b.chapterNumber);
          const idx = chapters.findIndex((c) => c.chapterId === chapterId);
          if (idx !== -1) {
            content.navigation = {
              prev: idx > 0 ? { chapterId: chapters[idx - 1].chapterId } : { chapterId: null },
              next:
                idx < chapters.length - 1
                  ? {
                      chapterId: chapters[idx + 1].chapterId,
                      chapterNumber: chapters[idx + 1].chapterNumber,
                      title: chapters[idx + 1].title,
                    }
                  : { chapterId: null },
            };
          }
        }
      } catch (e) {
        console.error('Failed to process offline chapter content', e);
      }
      return content;
    };

    if (isOffline) {
      const content = await offlineDb.getChapterContent(chapterId);
      if (content) return await processOfflineContent(content);
      throw new Error('Chương này chưa được tải xuống để đọc offline');
    }

    try {
      const url = `/api/chapters/${chapterId}?groupLines=${groupLines}&isEnabledReplace=${isEnabledReplace}&rootTab=${rootTab}&batchSize=${batchSize}`;
      const res = await apiClient.get<any>(url);
      return res;
    } catch (e) {
      const offline = await offlineDb.getChapterContent(chapterId);
      if (offline) return await processOfflineContent(offline);
      throw e;
    }
  },

  async saveChapterOffline(chapter: Chapter & { bookId: string }, content: ChapterContent): Promise<void> {
    await offlineDb.saveChapter(chapter);
    await offlineDb.saveChapterContent(content);
  },

  async translate(data: any): Promise<any> {
    return apiClient.post('/stories/gemini-ai/translate', data);
  },

  async getPoolStatus(model: string, platform?: string): Promise<any> {
    const platformQuery = platform ? `&platform=${encodeURIComponent(platform)}` : '';
    return apiClient.get(`/api/ai-token/pool-status?model=${encodeURIComponent(model)}${platformQuery}`);
  },
};
