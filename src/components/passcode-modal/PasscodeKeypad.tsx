import { BookOpen, CheckCircle2, Delete, Fingerprint } from 'lucide-react';
import { motion } from 'motion/react';
import React from 'react';

const KEYPAD_LETTERS: Record<string, string> = {
	'2': 'ABC',
	'3': 'DEF',
	'4': 'GHI',
	'5': 'JKL',
	'6': 'MNO',
	'7': 'PQRS',
	'8': 'TUV',
	'9': 'WXYZ',
};

function getDigitBoxClass(isSuccess: boolean, isFilled: boolean, isCurrent: boolean): string {
	if (isSuccess) {
		return 'bg-emerald-500/20 border-2 border-emerald-400 text-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.5),_inset_0_1px_1px_rgba(255,255,255,0.4)]';
	}
	if (isFilled) {
		return 'bg-primary/20 border-2 border-primary text-primary shadow-[0_0_16px_rgba(var(--primary),0.35),_inset_0_1.5px_1px_rgba(255,255,255,0.4)] scale-105';
	}
	if (isCurrent) {
		return 'bg-surface-container-high/60 border-2 border-primary/90 text-transparent shadow-[0_0_12px_rgba(var(--primary),0.25),_inset_0_1px_1px_rgba(255,255,255,0.3)] animate-pulse';
	}
	return 'bg-surface-container-high/40 border border-outline-variant/60 dark:border-white/15 text-transparent shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]';
}

function getMotionAnimate(isShaking: boolean, isSuccess: boolean) {
	if (isShaking) return { x: [-14, 14, -10, 10, -5, 5, 0] };
	if (isSuccess) return { scale: [1, 1.04, 1] };
	return {};
}

export interface PasscodePinSectionProps {
	mode: 'secret_server' | 'app_unlock';
	title?: string;
	subtitle?: string;
	digits: string[];
	isShaking: boolean;
	isSuccess: boolean;
	isSubmitting: boolean;
}

export function PasscodePinSection({ mode, title, subtitle, digits, isShaking, isSuccess, isSubmitting }: PasscodePinSectionProps) {
	const renderDigitGroup = (indices: number[]) => (
		<div className="flex items-center gap-1.5 sm:gap-2">
			{indices.map((idx) => {
				const digit = digits[idx];
				const isFilled = digit !== undefined;
				const isCurrent = idx === digits.length && !isSubmitting;

				return (
					<div
						key={idx}
						className={`relative w-[36px] h-[50px] sm:w-[42px] sm:h-[56px] rounded-2xl flex items-center justify-center font-mono font-black text-xl sm:text-2xl transition-all duration-150 overflow-hidden backdrop-blur-xl ${getDigitBoxClass(isSuccess, isFilled, isCurrent)}`}
					>
						<div className="absolute top-0 inset-x-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent pointer-events-none rounded-t-2xl" />
						<span className="relative z-10">{digit ?? ''}</span>
					</div>
				);
			})}
		</div>
	);

	return (
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
						{subtitle || (mode === 'app_unlock' ? 'Nhập mã Passcode' : 'Thiết lập máy chủ trích xuất và đọc truyện của bạn để bắt đầu.')}
					</p>
				</div>
			</div>

			{/* 8 Digit Boxes with 4 + 4 Layout */}
			<motion.div
				animate={getMotionAnimate(isShaking, isSuccess)}
				transition={{ duration: 0.4 }}
				className="flex items-center justify-center gap-1.5 sm:gap-2 w-full px-1"
			>
				{renderDigitGroup([0, 1, 2, 3])}
				<div className="w-1.5 h-1.5 rounded-full bg-outline-variant/80 dark:bg-white/30 mx-1" />
				{renderDigitGroup([4, 5, 6, 7])}
			</motion.div>
		</motion.div>
	);
}

export interface PasscodeKeypadProps {
	digitsCount: number;
	isSubmitting: boolean;
	onRequestBiometric?: () => void;
	onPointerDownNumber: (e: React.PointerEvent, num: string) => void;
	onPointerDownDelete: (e: React.PointerEvent) => void;
	onPointerDownClose: (e: React.PointerEvent) => void;
}

export function PasscodeKeypad({
	digitsCount,
	isSubmitting,
	onRequestBiometric,
	onPointerDownNumber,
	onPointerDownDelete,
	onPointerDownClose,
}: PasscodeKeypadProps) {
	return (
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
					<span className="font-black text-2xl sm:text-[26px] leading-none tracking-tight text-on-surface pointer-events-none">0</span>
				</button>

				<button
					type="button"
					onPointerDown={onPointerDownDelete}
					disabled={isSubmitting || digitsCount === 0}
					className="relative h-14 sm:h-16 rounded-2xl bg-surface-container-high/45 hover:bg-surface-container-high/65 active:bg-rose-500/25 border-t border-t-white/20 border-x border-x-white/10 border-b border-b-black/40 text-on-surface-variant active:text-rose-300 flex items-center justify-center shadow-[0_3px_0_rgba(0,0,0,0.25),_inset_0_1px_1px_rgba(255,255,255,0.2)] active:shadow-none active:translate-y-[2px] active:scale-[0.93] transition-all duration-75 ease-out disabled:opacity-20 select-none cursor-pointer overflow-hidden touch-manipulation transform-gpu will-change-transform"
					aria-label="Xóa số"
				>
					<div className="absolute top-0 inset-x-0 h-1/2 bg-gradient-to-b from-white/15 to-transparent pointer-events-none rounded-t-2xl" />
					<Delete size={22} className="drop-shadow-sm pointer-events-none" />
				</button>
			</div>
		</motion.div>
	);
}
