import React, { useState, useEffect, useRef } from 'react';
import { HashRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { BookOpen, KeyRound } from 'lucide-react';

import { GlobalApiLoading } from './components/GlobalApiLoading';
import { GlobalDownloadProgress } from './components/GlobalDownloadProgress';
import { ToastContainer } from './components/Toast';
import { AppUpdateOverlay } from './components/AppUpdateOverlay';
import { PasscodeModal } from './components/PasscodeModal';
import { type SecretServerConfig } from './services/secretServerService';
import { useAppUpdate } from './hooks/useAppUpdate';
import { useRouteRestoration } from './hooks/useRouteRestoration';
import { ChapterListScreen } from './features/chapter-list/ChapterListScreen';
import { LibraryScreen } from './features/library/LibraryScreen';
import { ReaderScreen } from './features/reader/ReaderScreen';
import { useAppStore } from './stores/useAppStore';
import { useModalStore } from './stores/useModalStore';
import { useReaderConfigStore } from './stores/useReaderConfigStore';
import { useToastStore } from './stores/useToastStore';

/**
 * Xác định độ sâu phân cấp của route để tính toán hướng trượt Cupertino:
 * 0: / (Thư viện)
 * 1: /book/:bookId (Danh sách chương)
 * 2: /book/:bookId/chapter/:chapterId (Màn hình đọc truyện)
 */
function getRouteDepth(pathname: string): number {
	if (pathname.includes('/chapter/')) return 2;
	if (pathname.startsWith('/book/')) return 1;
	return 0;
}

/** Biến thể chuyển trang chuẩn iOS Cupertino (Parallax Slide + Shadow) */
const cupertinoVariants = {
	initial: (dir: 'forward' | 'back') => ({
		x: dir === 'forward' ? '100%' : '-25%',
		opacity: dir === 'forward' ? 1 : 0.85,
		boxShadow: dir === 'forward' ? '-12px 0 28px rgba(0, 0, 0, 0.18)' : 'none',
		zIndex: dir === 'forward' ? 2 : 1
	}),
	animate: {
		x: 0,
		opacity: 1,
		boxShadow: 'none',
		transition: {
			duration: 0.32,
			ease: [0.32, 0.72, 0, 1] // Chuẩn iOS Cupertino Easing curve
		}
	},
	exit: (dir: 'forward' | 'back') => ({
		x: dir === 'forward' ? '-25%' : '100%',
		opacity: dir === 'forward' ? 0.85 : 1,
		boxShadow: dir === 'back' ? '-12px 0 28px rgba(0, 0, 0, 0.18)' : 'none',
		zIndex: dir === 'back' ? 2 : 1,
		transition: {
			duration: 0.28,
			ease: [0.32, 0.72, 0, 1]
		}
	})
};

function AppContent() {
	const location = useLocation();
	const navigate = useNavigate();

	// Tự động lưu và khôi phục trang hoạt động gần nhất khi App bị kill hoặc sleep vào lại
	useRouteRestoration({ location, navigate });

	const prevPathRef = useRef(location.pathname);
	const [direction, setDirection] = useState<'forward' | 'back'>('forward');

	useEffect(() => {
		const prevDepth = getRouteDepth(prevPathRef.current);
		const currDepth = getRouteDepth(location.pathname);
		setDirection(currDepth < prevDepth ? 'back' : 'forward');
		prevPathRef.current = location.pathname;
	}, [location.pathname]);

	useEffect(() => {
		if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
			window.history.scrollRestoration = 'manual';
		}
	}, []);

	useEffect(() => {
		if (typeof window !== 'undefined' && window.scrollTo) {
			window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
		}
	}, [location.pathname]);

	return (
		<div className="min-h-screen w-full max-w-full overflow-x-hidden bg-background text-on-background flex flex-col box-border hide-scrollbar no-scrollbar relative">
			<AnimatePresence mode="popLayout" custom={direction} initial={false}>
				<motion.div
					key={location.pathname.startsWith('/book/') && location.pathname.includes('/chapter/') ? 'reader-screen' : location.pathname}
					custom={direction}
					variants={cupertinoVariants}
					initial="initial"
					animate="animate"
					exit="exit"
					className="flex-1 flex flex-col w-full min-h-screen"
				>
					<Routes location={location}>
						<Route path="/" element={<LibraryScreen />} />
						<Route path="/book/:bookId" element={<ChapterListScreen />} />
						<Route path="/book/:bookId/chapter/:chapterId" element={<ReaderScreen />} />
					</Routes>
				</motion.div>
			</AnimatePresence>
		</div>
	);
}

function ApplicationGate({ children }: { children: React.ReactNode }) {
	const [isInitializing, setIsInitializing] = useState(true);
	const [showSettings, setShowSettings] = useState(false);
	const [showPasscodeModal, setShowPasscodeModal] = useState(false);
	const [domainInput, setDomainInput] = useState('');
	const [nameInput, setNameInput] = useState('');
	const [isTesting, setIsTesting] = useState(false);

	const handlePasscodeSuccess = (server: SecretServerConfig) => {
		useAppStore.getState().addDomain({
			id: Date.now().toString(),
			name: server.name,
			url: server.url
		});
		setShowSettings(false);
		window.location.reload();
	};

	useEffect(() => {
		useAppStore.getState().loadAppConfig();
		useReaderConfigStore.getState().fetchServerConfig();

		const checkConnection = async () => {
			const isOffline = useAppStore.getState().isOfflineMode;
			const domain = useAppStore.getState().activeDomain;

			if (isOffline) {
				setIsInitializing(false);
				return;
			}

			if (!domain || !domain.url) {
				setShowSettings(true);
				setIsInitializing(false);
				return;
			}

			try {
				const controller = new AbortController();
				const timeoutId = setTimeout(() => controller.abort(), 2000);
				await fetch(domain.url, {
					signal: controller.signal,
					headers: { 'ngrok-skip-browser-warning': 'true' }
				}).catch(() => null);
				clearTimeout(timeoutId);
			} catch {
				// Safe fallback without intrusive modal popup
			} finally {
				setIsInitializing(false);
			}
		};

		checkConnection();
	}, []);

	const handleSave = async () => {
		if (domainInput.trim()) {
			setIsTesting(true);
			try {
				const res = await fetch(domainInput.trim(), {
					headers: { 'ngrok-skip-browser-warning': 'true' }
				}).catch(() => null);

				if (!res || !res.ok) {
					useToastStore.getState().showToast('Máy chủ không phản hồi hoặc URL không hợp lệ.', 'error');
					setIsTesting(false);
					return;
				}

				useAppStore.getState().addDomain({
					id: Date.now().toString(),
					name: nameInput.trim() || 'Server Mặc định',
					url: domainInput.trim()
				});
				setShowSettings(false);
				window.location.reload();
			} catch {
				useToastStore.getState().showToast('Có lỗi xảy ra khi lưu máy chủ.', 'error');
			} finally {
				setIsTesting(false);
			}
		}
	};

	if (isInitializing) {
		return (
			<div className="min-h-screen bg-background flex flex-col items-center justify-center font-sans gap-6">
				<div className="flex flex-col items-center justify-center">
					<div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-primary/20 to-primary/5 text-primary flex items-center justify-center mb-6 shadow-sm ring-1 ring-primary/20 relative">
						<BookOpen size={24} className="animate-pulse" />
						<div className="absolute inset-0 border-2 border-primary/30 rounded-3xl animate-ping opacity-50" />
					</div>
					<div className="text-on-surface-variant font-medium text-[15px] animate-pulse">Đang kết nối máy chủ...</div>
				</div>

				<button
					onClick={() => {
						useAppStore.getState().setOfflineMode(true);
						window.location.reload();
					}}
					className="mt-8 px-5 py-2.5 rounded-full bg-surface-container border border-outline-variant/30 text-[14px] font-medium text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-all"
				>
					Vào chế độ Ngoại tuyến
				</button>
			</div>
		);
	}

	if (showSettings) {
		return (
			<div className="min-h-screen bg-background text-on-background flex flex-col justify-center p-5 sm:p-6 font-sans relative overflow-hidden select-none">
				{/* Ambient Background Glow for theme immersion */}
				<div className="absolute -top-32 left-1/2 -translate-x-1/2 w-96 h-96 bg-primary/20 blur-[130px] pointer-events-none rounded-full" />
				<div className="absolute -bottom-32 right-1/4 w-80 h-80 bg-primary/10 blur-[120px] pointer-events-none rounded-full" />

				<div className="w-full max-w-[400px] mx-auto flex flex-col gap-8 relative z-10">
					<div className="flex flex-col items-center text-center gap-4">
						<div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary/25 to-primary/5 text-primary flex items-center justify-center mb-2 shadow-[0_8px_24px_rgba(0,0,0,0.25),_inset_0_1.5px_1px_rgba(255,255,255,0.4)] border border-primary/30 backdrop-blur-md">
							<BookOpen size={28} strokeWidth={2.5} className="drop-shadow-sm" />
						</div>
						<div>
							<h1 className="text-3xl sm:text-4xl font-black text-on-surface tracking-tight mb-2">Stories Reader</h1>
							<p className="text-[14px] text-on-surface-variant max-w-[280px] mx-auto leading-relaxed">Thiết lập máy chủ trích xuất và đọc truyện của bạn để bắt đầu.</p>
						</div>
					</div>

					<div className="bg-surface/50 dark:bg-surface/40 backdrop-blur-2xl p-6 sm:p-7 rounded-[32px] shadow-[0_16px_40px_rgba(0,0,0,0.4),_inset_0_1.5px_1.5px_0_rgba(255,255,255,0.3)] border border-white/20 dark:border-white/15 flex flex-col gap-6 relative z-10">
						<div className="flex flex-col gap-5">
							<div className="flex flex-col gap-2">
								<label className="text-[12px] font-bold text-on-surface-variant uppercase tracking-wider ml-1">
									Tên máy chủ <span className="normal-case font-normal opacity-70">(Tùy chọn)</span>
								</label>
								<input
									type="text"
									value={nameInput}
									onChange={(e) => setNameInput(e.target.value)}
									placeholder="Ví dụ: Server Nhà, Ngrok..."
									className="w-full h-12 px-4 rounded-2xl bg-surface-container-high/40 hover:bg-surface-container-high/60 focus:bg-surface-container-high/80 backdrop-blur-md border border-outline-variant/60 focus:border-primary/80 focus:ring-2 focus:ring-primary/20 text-[14px] font-medium text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none transition-all shadow-[inset_0_1.5px_1px_rgba(0,0,0,0.15)]"
								/>
							</div>

							<div className="flex flex-col gap-2">
								<label className="text-[12px] font-bold text-on-surface-variant uppercase tracking-wider ml-1">
									URL Máy chủ API <span className="text-error">*</span>
								</label>
								<input
									type="text"
									value={domainInput}
									onChange={(e) => setDomainInput(e.target.value)}
									placeholder="https://..."
									className="w-full h-12 px-4 rounded-2xl bg-surface-container-high/40 hover:bg-surface-container-high/60 focus:bg-surface-container-high/80 backdrop-blur-md border border-outline-variant/60 focus:border-primary/80 focus:ring-2 focus:ring-primary/20 text-[14px] font-medium text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none transition-all shadow-[inset_0_1.5px_1px_rgba(0,0,0,0.15)]"
								/>
							</div>
						</div>

						<button
							onClick={handleSave}
							disabled={isTesting || !domainInput.trim()}
							className="w-full h-12 rounded-2xl bg-primary text-on-primary font-bold text-[14px] shadow-[0_4px_16px_rgba(0,0,0,0.25),_inset_0_1.5px_1px_rgba(255,255,255,0.45)] hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer"
						>
							{isTesting ? 'Đang kiểm tra...' : 'Kết nối & Bắt đầu'}
						</button>

						<div className="flex items-center gap-3">
							<div className="flex-1 h-px bg-outline-variant/40" />
							<span className="text-[12px] text-on-surface-variant font-medium">hoặc</span>
							<div className="flex-1 h-px bg-outline-variant/40" />
						</div>

						<button
							type="button"
							onClick={() => setShowPasscodeModal(true)}
							className="w-full h-12 rounded-2xl bg-primary/15 hover:bg-primary/25 border border-primary/40 text-primary font-bold text-[14px] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer backdrop-blur-md shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]"
						>
							<KeyRound size={16} />
							Mở khóa nhanh bằng Passcode
						</button>

						<button
							onClick={() => {
								useAppStore.getState().setOfflineMode(true);
								setShowSettings(false);
							}}
							className="w-full h-10 rounded-2xl bg-surface-container-high/30 hover:bg-surface-container-high/60 border border-outline-variant/40 text-on-surface-variant font-semibold text-[13px] backdrop-blur-md transition-all cursor-pointer"
						>
							Vào Chế độ Ngoại tuyến (Offline Mode)
						</button>
					</div>

					<PasscodeModal
						isOpen={showPasscodeModal}
						onClose={() => setShowPasscodeModal(false)}
						onSuccess={handlePasscodeSuccess}
					/>
				</div>
			</div>
		);
	}

	return <>{children}</>;
}

function AppUpdateManager() {
	const { isUpdating, progress, statusMessage } = useAppUpdate();

	return (
		<AppUpdateOverlay
			isUpdating={isUpdating}
			progress={progress}
			statusMessage={statusMessage}
		/>
	);
}

export default function App() {
	return (
		<Router>
			<ApplicationGate>
				<GlobalApiLoading />
				<AppContent />
				<GlobalDownloadProgress />
				<ToastContainer />
				<AppUpdateManager />
			</ApplicationGate>
		</Router>
	);
}
