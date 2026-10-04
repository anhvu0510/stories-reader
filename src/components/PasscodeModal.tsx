import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Delete, X, BookOpen, CheckCircle2, Fingerprint } from 'lucide-react';
import { useHaptic } from '@/hooks/useHaptic';
import { unlockSecretServer, isValidTimePasscode, type SecretServerConfig } from '@/services/secretServerService';
import { useAppLockStore } from '@/stores/useAppLockStore';
import { useToastStore } from '@/stores/useToastStore';

interface PasscodeModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSuccess?: (server: SecretServerConfig) => void;
	mode?: 'secret_server' | 'app_unlock';
	title?: string;
	subtitle?: string;
	onUnlockSuccess?: () => void;
	onRequestBiometric?: () => void;
}

const KEYPAD_LETTERS: Record<string, string> = {
	'2': 'ABC',
	'3': 'DEF',
	'4': 'GHI',
	'5': 'JKL',
	'6': 'MNO',
	'7': 'PQRS',
	'8': 'TUV',
	'9': 'WXYZ'
};

export function PasscodeModal({
	isOpen,
	onClose,
	onSuccess,
	mode = 'secret_server',
	title,
	subtitle,
	onUnlockSuccess,
	onRequestBiometric
}: PasscodeModalProps) {
	const [digits, setDigits] = useState<string[]>([]);
	const [isShaking, setIsShaking] = useState(false);
	const [isSuccess, setIsSuccess] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const { trigger: triggerHaptic } = useHaptic();
	const showToast = useToastStore((state) => state.showToast);

	useEffect(() => {
		if (isOpen) {
			setDigits([]);
			setIsShaking(false);
			setIsSuccess(false);
			setIsSubmitting(false);
		}
	}, [isOpen]);

	const handleNumberPress = (num: string) => {
		if (digits.length >= 8 || isSubmitting) return;
		triggerHaptic('light');

		const nextDigits = [...digits, num];
		setDigits(nextDigits);

		if (nextDigits.length === 8) {
			submitPasscode(nextDigits.join(''));
		}
	};

	const handleDelete = () => {
		if (digits.length === 0 || isSubmitting) return;
		triggerHaptic('selection');
		setDigits((prev) => prev.slice(0, -1));
	};

	const onPointerDownNumber = (e: React.PointerEvent, num: string) => {
		if (e.button !== 0 && e.pointerType === 'mouse') return;
		e.preventDefault();
		handleNumberPress(num);
	};

	const onPointerDownDelete = (e: React.PointerEvent) => {
		if (e.button !== 0 && e.pointerType === 'mouse') return;
		e.preventDefault();
		handleDelete();
	};

	const onPointerDownClose = (e: React.PointerEvent) => {
		if (e.button !== 0 && e.pointerType === 'mouse') return;
		e.preventDefault();
		onClose();
	};

	// Hardware keyboard support for high responsiveness
	useEffect(() => {
		if (!isOpen || isSubmitting) return;

		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key >= '0' && e.key <= '9') {
				e.preventDefault();
				handleNumberPress(e.key);
			} else if (e.key === 'Backspace' || e.key === 'Delete') {
				e.preventDefault();
				handleDelete();
			} else if (e.key === 'Escape') {
				e.preventDefault();
				onClose();
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [isOpen, digits, isSubmitting]);

	const submitPasscode = (code: string) => {
		setIsSubmitting(true);

		if (mode === 'app_unlock') {
			const isValid = isValidTimePasscode(code);
			if (isValid) {
				setIsSuccess(true);
				triggerHaptic('success');
				useAppLockStore.getState().unlock();
				// Đảm bảo bảo mật sinh trắc học luôn được bật
				useAppLockStore.getState().enableLockAfterPasscode();
				showToast('Mở khóa ứng dụng thành công!', 'success');
				setTimeout(() => {
					onUnlockSuccess?.();
					onClose();
				}, 500);
			} else {
				triggerHaptic('error');
				setIsShaking(true);
				showToast('Mã Passcode không chính xác hoặc đã hết hạn!', 'error');
				setTimeout(() => {
					setIsShaking(false);
					setDigits([]);
					setIsSubmitting(false);
				}, 500);
			}
			return;
		}

		// Chế độ mở khóa máy chủ bí mật (mode === 'secret_server')
		const server = unlockSecretServer(code);

		if (server) {
			setIsSuccess(true);
			triggerHaptic('success');
			// Tự động kích hoạt chế độ bảo vệ sinh trắc học trên ứng dụng Android
			useAppLockStore.getState().enableLockAfterPasscode();
			showToast(`Mở khóa máy chủ ${server.name} & kích hoạt sinh trắc học thành công!`, 'success');
			setTimeout(() => {
				onSuccess?.(server);
				onClose();
			}, 600);
		} else {
			triggerHaptic('error');
			setIsShaking(true);
			showToast('Mã Passcode không chính xác hoặc đã hết hạn!', 'error');

			setTimeout(() => {
				setIsShaking(false);
				setDigits([]);
				setIsSubmitting(false);
			}, 500);
		}
	};

	return (
		<AnimatePresence>
			{isOpen && (
				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					role="dialog"
					aria-modal="true"
					data-modal="true"
					className="fixed inset-0 z-50 bg-[color-mix(in_srgb,var(--bg)_85%,transparent)] backdrop-blur-2xl backdrop-saturate-150 text-on-surface flex flex-col justify-between p-4 sm:p-6 pb-6 select-none overflow-hidden max-h-[100dvh]"
				>
					{/* Background Glow */}
					<div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-primary/25 blur-[120px] pointer-events-none" />
					<div className="absolute -bottom-24 right-1/4 w-80 h-80 rounded-full bg-primary/10 blur-[100px] pointer-events-none" />

					{/* 1. Top Bar: Close Button */}
					<motion.div
						initial={{ opacity: 0, y: -10 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.2, delay: 0.05 }}
						className="relative z-10 flex items-center justify-end w-full max-w-[390px] mx-auto pt-1"
					>
						<button
							onClick={onClose}
							className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high/60 active:scale-90 transition-all cursor-pointer backdrop-blur-md"
							aria-label="Đóng"
						>
							<X size={22} />
						</button>
					</motion.div>

					{/* 2. Middle Section: Exact ApplicationGate Branding Header + 8 PIN Boxes */}
					<motion.div
						initial={{ opacity: 0, y: 22, scale: 0.95 }}
						animate={{ opacity: 1, y: 0, scale: 1 }}
						exit={{ opacity: 0, y: 15, scale: 0.96 }}
						transition={{ type: 'spring', damping: 25, stiffness: 280, mass: 0.8, delay: 0.04 }}
						className="relative z-10 flex flex-col items-center justify-center w-full max-w-[390px] mx-auto py-1"
					>
						<div className="flex flex-col items-center text-center gap-2 mb-4">
							<motion.div
								initial={{ scale: 0.7, opacity: 0 }}
								animate={{ scale: 1, opacity: 1 }}
								transition={{ type: 'spring', damping: 18, stiffness: 320, delay: 0.08 }}
								className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary/25 to-primary/5 text-primary flex items-center justify-center mb-2 shadow-[0_8px_24px_rgba(0,0,0,0.25),_inset_0_1.5px_1px_rgba(255,255,255,0.4)] border border-primary/30 backdrop-blur-md"
							>
								{isSuccess ? (
									<CheckCircle2 size={32} className="text-emerald-400 animate-in zoom-in-75 duration-200" />
								) : (
									<BookOpen size={28} strokeWidth={2.5} className="drop-shadow-sm" />
								)}
							</motion.div>
							<div>
								<h1 className="text-2xl sm:text-3xl font-black text-on-surface tracking-tight mb-1">
									{title || (mode === 'app_unlock' ? 'Mở khóa Ứng dụng' : 'Stories Reader')}
								</h1>
								<p className="text-[13px] sm:text-[14px] text-on-surface-variant max-w-[280px] mx-auto leading-relaxed">
									{subtitle ||
										(mode === 'app_unlock'
											? 'Nhập mã Passcode (HHMMDDMM) để mở khóa Stories Reader.'
											: 'Thiết lập máy chủ trích xuất và đọc truyện của bạn để bắt đầu.')}
								</p>
							</div>
						</div>

						{/* 8 Digit Boxes with 4 + 4 Layout */}
						<motion.div
							animate={
								isShaking
									? { x: [-14, 14, -10, 10, -5, 5, 0] }
									: isSuccess
										? { scale: [1, 1.04, 1] }
										: {}
							}
							transition={{ duration: 0.4 }}
							className="flex items-center justify-center gap-1.5 sm:gap-2 w-full px-1"
						>
							{/* First Group of 4 */}
							<div className="flex items-center gap-1.5 sm:gap-2">
								{[0, 1, 2, 3].map((idx) => {
									const digit = digits[idx];
									const isFilled = digit !== undefined;
									const isCurrent = idx === digits.length && !isSubmitting;

									return (
										<div
											key={idx}
											className={`relative w-[36px] h-[50px] sm:w-[42px] sm:h-[56px] rounded-2xl flex items-center justify-center font-mono font-black text-xl sm:text-2xl transition-all duration-150 overflow-hidden backdrop-blur-xl ${
												isSuccess
													? 'bg-emerald-500/20 border-2 border-emerald-400 text-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.5),_inset_0_1px_1px_rgba(255,255,255,0.4)]'
													: isFilled
														? 'bg-primary/20 border-2 border-primary text-primary shadow-[0_0_16px_rgba(var(--primary),0.35),_inset_0_1.5px_1px_rgba(255,255,255,0.4)] scale-105'
														: isCurrent
															? 'bg-surface-container-high/60 border-2 border-primary/90 text-transparent shadow-[0_0_12px_rgba(var(--primary),0.25),_inset_0_1px_1px_rgba(255,255,255,0.3)] animate-pulse'
															: 'bg-surface-container-high/40 border border-outline-variant/60 dark:border-white/15 text-transparent shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]'
											}`}
										>
											<div className="absolute top-0 inset-x-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent pointer-events-none rounded-t-2xl" />
											<span className="relative z-10">{digit ?? ''}</span>
										</div>
									);
								})}
							</div>

							{/* Subtle Middle Divider */}
							<div className="w-1.5 h-1.5 rounded-full bg-outline-variant/80 dark:bg-white/30 mx-1" />

							{/* Second Group of 4 */}
							<div className="flex items-center gap-1.5 sm:gap-2">
								{[4, 5, 6, 7].map((idx) => {
									const digit = digits[idx];
									const isFilled = digit !== undefined;
									const isCurrent = idx === digits.length && !isSubmitting;

									return (
										<div
											key={idx}
											className={`relative w-[36px] h-[50px] sm:w-[42px] sm:h-[56px] rounded-2xl flex items-center justify-center font-mono font-black text-xl sm:text-2xl transition-all duration-150 overflow-hidden backdrop-blur-xl ${
												isSuccess
													? 'bg-emerald-500/20 border-2 border-emerald-400 text-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.5),_inset_0_1px_1px_rgba(255,255,255,0.4)]'
													: isFilled
														? 'bg-primary/20 border-2 border-primary text-primary shadow-[0_0_16px_rgba(var(--primary),0.35),_inset_0_1.5px_1px_rgba(255,255,255,0.4)] scale-105'
														: isCurrent
															? 'bg-surface-container-high/60 border-2 border-primary/90 text-transparent shadow-[0_0_12px_rgba(var(--primary),0.25),_inset_0_1px_1px_rgba(255,255,255,0.3)] animate-pulse'
															: 'bg-surface-container-high/40 border border-outline-variant/60 dark:border-white/15 text-transparent shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]'
											}`}
										>
											<div className="absolute top-0 inset-x-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent pointer-events-none rounded-t-2xl" />
											<span className="relative z-10">{digit ?? ''}</span>
										</div>
									);
								})}
							</div>
						</motion.div>
					</motion.div>

					{/* 3. Bottom Keypad: Sized Perfectly for Mobile Screen Heights */}
					<motion.div
						initial={{ opacity: 0, y: 35 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: 25 }}
						transition={{ type: 'spring', damping: 24, stiffness: 260, mass: 0.9, delay: 0.08 }}
						className="relative z-10 w-full max-w-[360px] mx-auto flex flex-col gap-2.5 pb-1 touch-none select-none"
					>
						<div className="grid grid-cols-3 gap-2.5 w-full">
							{['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
								<button
									key={num}
									type="button"
									onPointerDown={(e) => onPointerDownNumber(e, num)}
									disabled={isSubmitting}
									className="relative h-14 sm:h-16 rounded-2xl bg-surface-container-high/55 hover:bg-surface-container-high/75 active:bg-primary/25 border-t border-t-white/25 border-x border-x-white/10 border-b border-b-black/40 text-on-surface flex flex-col items-center justify-center shadow-[0_3px_0_rgba(0,0,0,0.25),_inset_0_1px_1px_rgba(255,255,255,0.25)] active:shadow-none active:translate-y-[2px] active:scale-[0.93] transition-all duration-75 ease-out select-none cursor-pointer overflow-hidden touch-manipulation transform-gpu will-change-transform disabled:opacity-40"
								>
									<div className="absolute top-0 inset-x-0 h-1/2 bg-gradient-to-b from-white/15 to-transparent pointer-events-none rounded-t-2xl" />
									<span className="font-black text-2xl sm:text-[26px] leading-none tracking-tight text-on-surface pointer-events-none">
										{num}
									</span>
									{KEYPAD_LETTERS[num] && (
										<span className="text-[10px] font-bold text-on-surface-variant/70 tracking-widest mt-0.5 leading-none pointer-events-none">
											{KEYPAD_LETTERS[num]}
										</span>
									)}
								</button>
							))}

							{/* Bottom Row */}
							{onRequestBiometric ? (
								<button
									type="button"
									onPointerDown={(e) => {
										if (e.button !== 0 && e.pointerType === 'mouse') return;
										e.preventDefault();
										onRequestBiometric();
									}}
									className="h-14 sm:h-16 rounded-2xl bg-primary/15 hover:bg-primary/25 border border-primary/30 text-primary active:scale-90 text-xs sm:text-sm font-bold flex flex-col items-center justify-center gap-1 transition-all duration-75 ease-out select-none cursor-pointer touch-manipulation transform-gpu will-change-transform"
									title="Quét lại vân tay hoặc khuôn mặt"
								>
									<Fingerprint size={20} />
									<span className="text-[10px] uppercase font-black tracking-wider">VÂN TAY</span>
								</button>
							) : (
								<button
									type="button"
									onPointerDown={onPointerDownClose}
									className="h-14 sm:h-16 rounded-2xl text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high/40 active:scale-90 text-xs sm:text-sm font-bold flex items-center justify-center transition-all duration-75 ease-out select-none cursor-pointer touch-manipulation transform-gpu will-change-transform"
								>
									HỦY
								</button>
							)}

							<button
								type="button"
								onPointerDown={(e) => onPointerDownNumber(e, '0')}
								disabled={isSubmitting}
								className="relative h-14 sm:h-16 rounded-2xl bg-surface-container-high/55 hover:bg-surface-container-high/75 active:bg-primary/25 border-t border-t-white/25 border-x border-x-white/10 border-b border-b-black/40 text-on-surface flex flex-col items-center justify-center shadow-[0_3px_0_rgba(0,0,0,0.25),_inset_0_1px_1px_rgba(255,255,255,0.25)] active:shadow-none active:translate-y-[2px] active:scale-[0.93] transition-all duration-75 ease-out select-none cursor-pointer overflow-hidden touch-manipulation transform-gpu will-change-transform disabled:opacity-40"
							>
								<div className="absolute top-0 inset-x-0 h-1/2 bg-gradient-to-b from-white/15 to-transparent pointer-events-none rounded-t-2xl" />
								<span className="font-black text-2xl sm:text-[26px] leading-none tracking-tight text-on-surface pointer-events-none">
									0
								</span>
							</button>

							<button
								type="button"
								onPointerDown={onPointerDownDelete}
								disabled={isSubmitting || digits.length === 0}
								className="relative h-14 sm:h-16 rounded-2xl bg-surface-container-high/45 hover:bg-surface-container-high/65 active:bg-rose-500/25 border-t border-t-white/20 border-x border-x-white/10 border-b border-b-black/40 text-on-surface-variant active:text-rose-300 flex items-center justify-center shadow-[0_3px_0_rgba(0,0,0,0.25),_inset_0_1px_1px_rgba(255,255,255,0.2)] active:shadow-none active:translate-y-[2px] active:scale-[0.93] transition-all duration-75 ease-out disabled:opacity-20 select-none cursor-pointer overflow-hidden touch-manipulation transform-gpu will-change-transform"
								aria-label="Xóa số"
							>
								<div className="absolute top-0 inset-x-0 h-1/2 bg-gradient-to-b from-white/15 to-transparent pointer-events-none rounded-t-2xl" />
								<Delete size={22} className="drop-shadow-sm pointer-events-none" />
							</button>
						</div>
					</motion.div>
				</motion.div>
			)}
		</AnimatePresence>
	);
}
