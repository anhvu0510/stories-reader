import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Fingerprint, KeyRound } from 'lucide-react';
import { useAppLockStore, isAndroidApp } from '@/stores/useAppLockStore';
import { PasscodeModal } from '@/components/PasscodeModal';
import { useHaptic } from '@/hooks/useHaptic';

/**
 * Component màn hình khóa bảo mật toàn ứng dụng.
 * Chỉ áp dụng cho thiết bị di động Android, không áp dụng trên Web.
 * Tự động kích hoạt khi ứng dụng bị sleep hoặc mở lại sau 30s, yêu cầu xác thực
 * sinh trắc học (vân tay / khuôn mặt), nếu không đúng hoặc huỷ thì cho phép nhập Passcode.
 */
export function AppLockOverlay() {
	const isAndroid = isAndroidApp();
	const { isLocked, showPasscodeFallback, isAuthenticating, setShowPasscodeFallback, triggerBiometricPrompt, unlock } = useAppLockStore();
	const { trigger: triggerHaptic } = useHaptic();

	// Tự động kích hoạt quét sinh trắc học khi màn hình khóa xuất hiện (chỉ khi app đang hiển thị trên màn hình)
	useEffect(() => {
		if (isAndroid && isLocked && !showPasscodeFallback && typeof document !== 'undefined' && document.visibilityState === 'visible') {
			const timer = setTimeout(() => {
				if (document.visibilityState === 'visible') {
					triggerBiometricPrompt();
				}
			}, 350);
			return () => clearTimeout(timer);
		}
	}, [isAndroid, isLocked, showPasscodeFallback, triggerBiometricPrompt]);

	// Passcode và màn hình khóa bảo mật chỉ áp dụng cho mobile Android khi đang ở trạng thái locked
	if (!isAndroid || !isLocked) return null;

	const handleManualTrigger = () => {
		triggerHaptic('light');
		// Reset cờ nếu đang bị kẹt để kích hoạt lại hộp thoại
		useAppLockStore.setState({ isAuthenticating: false });
		triggerBiometricPrompt();
	};

	return (
		<>
			<AnimatePresence>
				{isLocked && !showPasscodeFallback && (
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.2 }}
						className="fixed inset-0 z-[99999] bg-background/95 backdrop-blur-3xl text-on-surface flex flex-col justify-between items-center p-6 sm:p-8 select-none overflow-hidden touch-none"
					>
						{/* Ambient Glows */}
						<div className="absolute -top-32 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-primary/20 blur-[130px] pointer-events-none" />
						<div className="absolute -bottom-32 right-1/4 w-80 h-80 rounded-full bg-primary/10 blur-[110px] pointer-events-none" />

						{/* Top Placeholder */}
						<div className="w-full max-w-[360px] h-6" />

						{/* Center Branding & Biometric Trigger */}
						<motion.div
							initial={{ scale: 0.9, opacity: 0, y: 15 }}
							animate={{ scale: 1, opacity: 1, y: 0 }}
							transition={{ type: 'spring', damping: 25, stiffness: 300, delay: 0.05 }}
							className="relative z-10 flex flex-col items-center text-center max-w-[340px] w-full"
						>
							<motion.button
								whileTap={{ scale: 0.92 }}
								onClick={handleManualTrigger}
								className="relative w-24 h-24 rounded-3xl bg-gradient-to-br from-primary/30 to-primary/10 text-primary flex items-center justify-center mb-6 shadow-[0_12px_32px_rgba(0,0,0,0.35),_inset_0_1.5px_1px_rgba(255,255,255,0.4)] border border-primary/40 backdrop-blur-xl cursor-pointer group active:scale-95 transition-all"
								aria-label="Nhấn để quét sinh trắc học"
							>
								<div className="absolute inset-0 rounded-3xl bg-primary/20 animate-ping opacity-30 pointer-events-none" />
								<Fingerprint
									size={46}
									strokeWidth={1.8}
									className={`drop-shadow-md transition-transform group-hover:scale-105 ${isAuthenticating ? 'animate-pulse text-primary' : 'text-primary'}`}
								/>
							</motion.button>

							<h1 className="text-2xl sm:text-3xl font-black text-on-surface tracking-tight mb-2">Stories Reader</h1>
							<p className="text-xs sm:text-[14px] text-on-surface-variant leading-relaxed">
								Ứng dụng đang được khóa bảo vệ. Vui lòng quét sinh trắc học hoặc nhập Passcode để tiếp tục.
							</p>
						</motion.div>

						{/* Bottom Actions */}
						<motion.div
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.25, delay: 0.1 }}
							className="relative z-10 w-full max-w-[340px] flex flex-col gap-3 pb-4"
						>
							<button
								type="button"
								onClick={handleManualTrigger}
								className="w-full h-13 rounded-2xl bg-primary text-on-primary font-bold text-sm sm:text-base flex items-center justify-center gap-2 shadow-[0_4px_16px_rgba(0,0,0,0.25),_inset_0_1.5px_1px_rgba(255,255,255,0.4)] active:scale-[0.98] transition-all cursor-pointer"
							>
								<Fingerprint size={20} />
								<span>{isAuthenticating ? 'Đang mở hộp thoại...' : 'Quét Sinh trắc học'}</span>
							</button>

							<button
								type="button"
								onClick={() => {
									triggerHaptic('selection');
									setShowPasscodeFallback(true);
								}}
								className="w-full h-12 rounded-2xl bg-surface-container-high/60 hover:bg-surface-container-high/80 border border-outline-variant/50 text-on-surface font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 backdrop-blur-md active:scale-[0.98] transition-all cursor-pointer"
							>
								<KeyRound size={17} className="text-primary" />
								<span>Passcode</span>
							</button>
						</motion.div>
					</motion.div>
				)}
			</AnimatePresence>

			{/* Modal nhập Passcode khi sinh trắc học không đúng hoặc người dùng chọn nhập Passcode */}
			<PasscodeModal
				isOpen={isLocked && showPasscodeFallback}
				mode="app_unlock"
				title="Mở khóa Ứng dụng"
				subtitle="Nhập mã Passcode"
				onClose={() => setShowPasscodeFallback(false)}
				onUnlockSuccess={() => unlock()}
				onRequestBiometric={() => {
					setShowPasscodeFallback(false);
					triggerBiometricPrompt();
				}}
			/>
		</>
	);
}
