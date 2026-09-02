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

    const processOfflineBatch = async (
      startChapterId: string,
      targetBatchSize: number
    ): Promise<ChapterContent> => {
      const chapMeta = await offlineDb.getChapterMeta(startChapterId);
      const startContent = await offlineDb.getChapterContent(startChapterId);
      if (!startContent) {
        throw new Error('Chương này chưa được tải xuống để đọc offline');
      }

      const bookId = chapMeta?.bookId || (startContent.chapter as any)?.bookId;
      const rawChapterItems: ChapterContent[] = [startContent];
      let allBookChapters: (Chapter & { bookId: string })[] = [];
      let currentIdx = -1;

      if (bookId) {
        allBookChapters = await offlineDb.getChapters(bookId);
        allBookChapters.sort((a, b) => a.chapterNumber - b.chapterNumber);
        currentIdx = allBookChapters.findIndex((c) => c.chapterId === startChapterId);

        if (targetBatchSize > 1 && currentIdx !== -1) {
          const maxLookahead = Math.min(allBookChapters.length, currentIdx + targetBatchSize);
          for (let i = currentIdx + 1; i < maxLookahead; i++) {
            const nextChap = allBookChapters[i];
            const nextContent = await offlineDb.getChapterContent(nextChap.chapterId);
            if (nextContent) {
              rawChapterItems.push(nextContent);
            } else {
              // Contiguous batch stops if a chapter is not downloaded
              break;
            }
          }
        }
      }

      // Replacements setup
      let reps: any[] = [];
      if (isEnabledReplace) {
        try {
          reps = await offlineDb.getReplacements();
          if (bookId) {
            const chapterIds = new Set(rawChapterItems.map((c) => c.chapter?.chapterId));
            reps = reps.filter(
              (r) => r.scope === 'global' || r.bookId === bookId || (r.chapterId && chapterIds.has(r.chapterId))
            );
          } else {
            reps = reps.filter((r) => r.scope === 'global');
          }
          reps.sort((a, b) => (b.match?.length || 0) - (a.match?.length || 0));
        } catch {
          reps = [];
        }
      }

      // Process each chapter
      const formattedChapters = rawChapterItems.map((item) => {
        let lines = Array.isArray(item.chapter?.content) ? [...item.chapter.content] : [];

        // 1. Replacements
        if (isEnabledReplace && reps.length > 0 && lines.length > 0) {
          lines = lines.map((line) => {
            let res = line;
            for (const r of reps) {
              if (r.match) res = res.split(r.match).join(r.replacement);
            }
            return res;
          });
        }

        // 2. GroupLines
        if (groupLines > 1 && lines.length > 0) {
          const grouped: string[] = [];
          let currentGroup: string[] = [];
          for (const line of lines) {
            if (!line.trim()) continue;
            currentGroup.push(line);
            if (currentGroup.length >= groupLines) {
              grouped.push(currentGroup.join(' '));
              currentGroup = [];
            }
          }
          if (currentGroup.length > 0) grouped.push(currentGroup.join(' '));
          lines = grouped;
        }

        return {
          chapterId: item.chapter?.chapterId || '',
          bookId: item.chapter?.bookId,
          bookName: item.chapter?.bookName,
          chapterNumber: item.chapter?.chapterNumber || 0,
          title: item.chapter?.title || (item.chapter as any)?.titleVN || (item.chapter as any)?.titleRaw || '',
          createdAt: item.chapter?.createdAt,
          updatedAt: item.chapter?.updatedAt,
          content: lines,
          state: item.chapter?.state,
          chapterPlan: item.chapter?.chapterPlan,
          qaReports: item.chapter?.qaReports,
          continuitySnapshot: item.chapter?.continuitySnapshot,
        };
      });

      // 3. Dynamic navigation calculation
      let prevNav: { chapterId: string | null; chapterNumber?: number; title?: string } = { chapterId: null };
      let nextNav: { chapterId: string | null; chapterNumber?: number; title?: string } = { chapterId: null };

      if (currentIdx !== -1 && allBookChapters.length > 0) {
        // Prev: jump back targetBatchSize chapters
        if (currentIdx > 0) {
          const targetPrevIdx = Math.max(0, currentIdx - targetBatchSize);
          const prevChap = allBookChapters[targetPrevIdx];
          prevNav = {
            chapterId: prevChap.chapterId,
            chapterNumber: prevChap.chapterNumber,
            title: prevChap.title || (prevChap as any)?.titleVN || '',
          };
        }

        // Next: chapter right after the batch
        const nextIdx = currentIdx + rawChapterItems.length;
        if (nextIdx < allBookChapters.length) {
          const nextChap = allBookChapters[nextIdx];
          nextNav = {
            chapterId: nextChap.chapterId,
            chapterNumber: nextChap.chapterNumber,
            title: nextChap.title || (nextChap as any)?.titleVN || '',
          };
        }
      }

      return {
        chapter: formattedChapters[0],
        chapters: formattedChapters,
        navigation: {
          prev: prevNav.chapterId ? prevNav : null,
          next: nextNav.chapterId ? nextNav : null,
        },
      };
    };

    if (isOffline) {
      return await processOfflineBatch(chapterId, batchSize);
    }

    try {
      const url = `/api/chapters/${chapterId}?groupLines=${groupLines}&isEnabledReplace=${isEnabledReplace}&rootTab=${rootTab}&batchSize=${batchSize}`;
      const res = await apiClient.get<any>(url);
      return res;
    } catch (e) {
      return await processOfflineBatch(chapterId, batchSize);
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
