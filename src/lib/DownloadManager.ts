import oboe from 'oboe';

import { useAppStore } from '@/stores/useAppStore';

import { offlineDb } from './offlineDb';

import type { Book, Chapter, ChapterContent } from '@/shared/types';

interface RawStreamBook {
	bookId?: string;
	_id?: string;
	id?: string;
	bookName?: string;
	chapterCount?: number;
	totalChapters?: number;
	[key: string]: unknown;
}

interface RawStreamChapter {
	chapterId?: string;
	_id?: string;
	id?: string;
	chapterNumber?: number | string;
	title?: string;
	state?: Chapter['state'];
	bookName?: string;
	totalTokens?: number;
	content?: string[];
	rootTab?: string;
	[key: string]: unknown;
}

function formatStreamError(err: unknown): string {
	if (typeof err === 'string') return err;
	if (err && typeof err === 'object') {
		const obj = err as { error?: { message?: string }; statusCode?: number; message?: string };
		return obj.error?.message || (obj.statusCode ? String(obj.statusCode) : obj.message) || 'Unknown';
	}
	return 'Unknown';
}

function buildOfflineChapterData(chap: RawStreamChapter, task: DownloadTask, chapterId: string, chapterNumber: number) {
	const title = chap.title || `Chương ${chapterNumber}`;
	const state = chap.state ?? 'SUCCEEDED';
	const bookName = chap.bookName || task.bookName;
	const totalTokens = typeof chap.totalTokens === 'number' ? chap.totalTokens : 0;
	const content = Array.isArray(chap.content) ? chap.content : [];
	const rootTab = typeof chap.rootTab === 'string' ? chap.rootTab : '';

	const chapterRecord: Chapter & { bookId: string } = {
		...(chap as unknown as Chapter),
		chapterId,
		chapterNumber,
		title,
		bookId: task.bookId,
		state,
		updatedAt: typeof chap.updatedAt === 'string' ? chap.updatedAt : new Date().toISOString(),
	};

	const chapterContent: ChapterContent = {
		chapter: {
			chapterId,
			chapterNumber,
			title,
			bookName,
			state,
			totalTokens,
			content,
			rootTab,
		},
	};

	return { chapterRecord, chapterContent };
}

// Suppress Oboe's attempt to set Content-Length which causes an ugly red browser warning
const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
XMLHttpRequest.prototype.setRequestHeader = function (header: string, value: string) {
	if (header.toLowerCase() === 'content-length') {
		return; // Ignore to prevent "Refused to set unsafe header" warning
	}
	return originalSetRequestHeader.apply(this, [header, value]);
};

export type DownloadStatus = 'waiting' | 'downloading' | 'completed' | 'error';

export interface DownloadTask {
	bookId: string;
	bookName: string;
	status: DownloadStatus;
	progress: number;
	totalChapters: number;
	completedChapters: number;
	error?: string;
}

type Listener = () => void;

class DownloadManager {
	private queue: string[] = [];
	private tasks: Map<string, DownloadTask> = new Map();
	private activeCount: number = 0;
	private concurrency: number = 2; // Process 2 books at a time
	private listeners: Set<Listener> = new Set();
	private stopMap: Map<string, boolean> = new Map();

	public batchTotal: number = 0;
	public batchCompleted: number = 0;
	public lastProcessedBookName: string = '';

	subscribe(listener: Listener) {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	private notify() {
		for (const listener of this.listeners) {
			listener();
		}
		// Also dispatch global event for older components if needed
		window.dispatchEvent(new CustomEvent('download-queue-updated'));
	}

	getTasks(): DownloadTask[] {
		return Array.from(this.tasks.values());
	}

	getTask(bookId: string): DownloadTask | undefined {
		return this.tasks.get(bookId);
	}

	addBook(bookId: string, bookName: string = 'Đang tải...') {
		if (this.tasks.has(bookId)) {
			const task = this.tasks.get(bookId)!;
			if (task.status === 'downloading' || task.status === 'waiting') {
				return; // already in queue
			}
		}

		if (this.queue.length === 0 && this.activeCount === 0) {
			this.batchTotal = 0;
			this.batchCompleted = 0;
			this.lastProcessedBookName = '';
		}

		const newTask: DownloadTask = {
			bookId,
			bookName,
			status: 'waiting',
			progress: 0,
			totalChapters: 0,
			completedChapters: 0,
		};

		this.tasks.set(bookId, newTask);
		this.queue.push(bookId);
		this.stopMap.set(bookId, false);
		this.batchTotal++;

		this.notify();
		this.processQueue();
	}

	cancelBook(bookId: string) {
		this.stopMap.set(bookId, true);
		if (this.tasks.has(bookId)) {
			const task = this.tasks.get(bookId)!;
			if (task.status === 'waiting') {
				this.queue = this.queue.filter((id) => id !== bookId);
				this.tasks.delete(bookId);
				this.batchTotal--;
			}
			this.notify();
		}
	}

	private handleTaskSuccess(task: DownloadTask, bookId: string) {
		task.status = 'completed';
		this.batchCompleted++;
		this.lastProcessedBookName = task.bookName;
		if (this.batchTotal <= 1) {
			window.dispatchEvent(
				new CustomEvent('app-toast', {
					detail: { message: `Đã tải xong: ${task.bookName}`, type: 'success' },
				})
			);
		}
		this.tasks.delete(bookId);
		this.notify();
	}

	private async handleTaskError(task: DownloadTask, bookId: string, error: unknown) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		task.status = 'error';
		task.error = errorMessage;

		// Rollback: clear the book and any partially downloaded chapters
		try {
			await offlineDb.deleteBook(bookId);
		} catch (err) {
			console.error('Failed to rollback book:', err);
		}

		this.batchCompleted++; // Count as processed for batch tracking
		this.lastProcessedBookName = task.bookName;

		if (this.batchTotal <= 1) {
			const isCancelled = errorMessage === 'Đã hủy';
			window.dispatchEvent(
				new CustomEvent('app-toast', {
					detail: {
						message: isCancelled
							? `Đã ngừng tải ${task.bookName}. Dữ liệu tải dở đã được dọn dẹp.`
							: `Lỗi tải ${task.bookName}. Dữ liệu tải dở đã được dọn dẹp.`,
						type: isCancelled ? 'info' : 'error',
					},
				})
			);
		}
		this.tasks.delete(bookId);
		this.notify();
	}

	private async processQueue() {
		if (this.activeCount >= this.concurrency || this.queue.length === 0) {
			return;
		}

		const bookId = this.queue.shift()!;
		if (this.stopMap.get(bookId)) {
			this.tasks.delete(bookId);
			this.stopMap.delete(bookId);
			this.notify();
			this.processQueue();
			return;
		}

		this.activeCount++;
		const task = this.tasks.get(bookId)!;
		task.status = 'downloading';
		this.notify();

		try {
			await this.downloadBookFlow(task);
			this.handleTaskSuccess(task, bookId);
		} catch (e: unknown) {
			await this.handleTaskError(task, bookId, e);
		} finally {
			this.activeCount--;
			this.notify();

			// dispatch success to reload ui
			window.dispatchEvent(new CustomEvent('app-refresh'));

			this.processQueue();
		}
	}

	private async downloadBookFlow(task: DownloadTask) {
		const isOfflineBackup = localStorage.getItem('offlineMode');
		localStorage.setItem('offlineMode', 'false');

		try {
			task.progress = 5;
			this.notify();

			const domain = useAppStore.getState().activeDomain;
			if (!domain) {
				throw new Error('Không có kết nối API. Vui lòng cấu hình API Domain.');
			}
			const baseUrl = domain.url.replace(/\/$/, '');

			await new Promise<void>((resolve, reject) => {
				let isBookSaved = false;
				let bookSavePromise: Promise<void> | null = null;
				const chapterPromises: Promise<void>[] = [];

				const handleBookNode = (book: RawStreamBook) => {
					const rawId = book.bookId ?? book._id ?? book.id ?? task.bookId;
					const bookId = String(rawId);
					const normalizedBook: Book = {
						...(book as unknown as Book),
						bookId,
						bookName: book.bookName || task.bookName,
						chapterCount: typeof book.chapterCount === 'number' ? book.chapterCount : book.totalChapters || task.totalChapters || 0,
					};

					task.bookName = normalizedBook.bookName;
					task.totalChapters = normalizedBook.chapterCount;
					task.progress = 5;
					this.notify();

					bookSavePromise = offlineDb.saveBook(normalizedBook).then(() => {
						isBookSaved = true;
					});

					return oboe.drop;
				};

				const handleChapterNode = (chap: RawStreamChapter) => {
					if (this.stopMap.get(task.bookId)) {
						stream.abort();
						reject(new Error('Đã hủy'));
						return oboe.drop;
					}

					const chapterId = String(chap.chapterId ?? chap._id ?? chap.id ?? `chap-${chap.chapterNumber}`);
					const chapterNumber = typeof chap.chapterNumber === 'number' ? chap.chapterNumber : parseInt(String(chap.chapterNumber), 10) || 0;

					const saveAction = async () => {
						if (bookSavePromise && !isBookSaved) {
							await bookSavePromise;
						}
						const { chapterRecord, chapterContent } = buildOfflineChapterData(chap, task, chapterId, chapterNumber);
						await offlineDb.saveChapter(chapterRecord);
						await offlineDb.saveChapterContent(chapterContent);

						task.completedChapters++;
						task.progress = 5 + Math.round((task.completedChapters / Math.max(1, task.totalChapters)) * 90);
						this.notify();
					};

					chapterPromises.push(saveAction());
					return oboe.drop;
				};

				const stream = oboe({
					url: `${baseUrl}/api/books/download`,
					method: 'POST',
					headers: {
						'ngrok-skip-browser-warning': 'true',
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({ bookIds: [task.bookId] }),
					cached: false,
				})
					.node('data.*.book', handleBookNode)
					.node('data.book', handleBookNode)
					.node('!data.*.book', handleBookNode)
					.node('data.*.chapters.*', handleChapterNode)
					.node('data.chapters.*', handleChapterNode)
					.node('!data.*.chapters.*', handleChapterNode)
					.done(async () => {
						try {
							await Promise.all(chapterPromises);
							resolve();
						} catch (e) {
							reject(e);
						}
					})
					.fail((err: unknown) => {
						if (this.stopMap.get(task.bookId)) {
							reject(new Error('Đã hủy'));
						} else {
							reject(new Error(`Lỗi luồng dữ liệu (Stream Error): ${formatStreamError(err)}`));
						}
					});
			});

			if (this.stopMap.get(task.bookId)) throw new Error('Đã hủy');

			task.progress = 100;
			this.notify();
		} finally {
			if (isOfflineBackup) {
				localStorage.setItem('offlineMode', isOfflineBackup);
			}
		}
	}
}

export const downloadManager = new DownloadManager();
