import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import React, { useState, useEffect, useRef } from 'react';

import { useHaptic, type HapticFeedbackType } from '@/hooks/useHaptic';
import { unlockSecretServer, isValidTimePasscode, type SecretServerConfig } from '@/services/secretServerService';
import { useAppLockStore } from '@/stores/useAppLockStore';
import { useToastStore } from '@/stores/useToastStore';

import { PasscodeKeypad, PasscodePinSection } from './passcode-modal/PasscodeKeypad';

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

interface PasscodeSubmitHandlers {
	mode: 'secret_server' | 'app_unlock';
	triggerHaptic: (style?: HapticFeedbackType) => void;
	showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
	onUnlockSuccess?: () => void;
	onSuccess?: (server: SecretServerConfig) => void;
	onClose: () => void;
	setIsSuccess: (v: boolean) => void;
	setIsShaking: (v: boolean) => void;
	setDigits: (v: string[]) => void;
	setIsSubmitting: (v: boolean) => void;
}

function executePasscodeSubmit(code: string, handlers: PasscodeSubmitHandlers) {
	const { mode, triggerHaptic, showToast, onUnlockSuccess, onSuccess, onClose, setIsSuccess, setIsShaking, setDigits, setIsSubmitting } =
		handlers;

	const failAttempt = () => {
		triggerHaptic('error');
		setIsShaking(true);
		showToast('Mã Passcode không chính xác hoặc đã hết hạn!', 'error');
		setTimeout(() => {
			setIsShaking(false);
			setDigits([]);
			setIsSubmitting(false);
		}, 500);
	};

	if (mode === 'app_unlock') {
		if (!isValidTimePasscode(code)) {
			failAttempt();
			return;
		}
		setIsSuccess(true);
		triggerHaptic('success');
		useAppLockStore.getState().unlock();
		useAppLockStore.getState().enableLockAfterPasscode();
		showToast('Mở khóa ứng dụng thành công!', 'success');
		setTimeout(() => {
			onUnlockSuccess?.();
			onClose();
		}, 500);
		return;
	}

	const server = unlockSecretServer(code);
	if (!server) {
		failAttempt();
		return;
	}

	setIsSuccess(true);
	triggerHaptic('success');
	useAppLockStore.getState().enableLockAfterPasscode();
	const isLockActive = useAppLockStore.getState().isLockEnabled;
	const successMessage = isLockActive
		? `Mở khóa máy chủ ${server.name} & kích hoạt sinh trắc học thành công!`
		: `Mở khóa máy chủ ${server.name} thành công!`;
	showToast(successMessage, 'success');
	setTimeout(() => {
		onSuccess?.(server);
		onClose();
	}, 600);
}

function usePasscodeInputState({
	isOpen,
	onClose,
	onSuccess,
	mode,
	onUnlockSuccess,
}: {
	isOpen: boolean;
	onClose: () => void;
	onSuccess?: (server: SecretServerConfig) => void;
	mode: 'secret_server' | 'app_unlock';
	onUnlockSuccess?: () => void;
}) {
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
			setIsSubmitting(true);
			executePasscodeSubmit(nextDigits.join(''), {
				mode,
				triggerHaptic,
				showToast,
				onUnlockSuccess,
				onSuccess,
				onClose,
				setIsSuccess,
				setIsShaking,
				setDigits,
				setIsSubmitting,
			});
		}
	};

	const handleDelete = () => {
		if (digits.length === 0 || isSubmitting) return;
		triggerHaptic('selection');
		setDigits((prev) => prev.slice(0, -1));
	};

	const handleKeyDownRef = useRef<(e: KeyboardEvent) => void>(() => {});
	handleKeyDownRef.current = (e: KeyboardEvent) => {
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

	useEffect(() => {
		if (!isOpen || isSubmitting) return;
		const onKeyDown = (e: KeyboardEvent) => handleKeyDownRef.current(e);
		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	}, [isOpen, isSubmitting]);

	return {
		digits,
		isShaking,
		isSuccess,
		isSubmitting,
		handleNumberPress,
		handleDelete,
	};
}

export function PasscodeModal({
	isOpen,
	onClose,
	onSuccess,
	mode = 'secret_server',
	title,
	subtitle,
	onUnlockSuccess,
	onRequestBiometric,
}: PasscodeModalProps) {
	const { digits, isShaking, isSuccess, isSubmitting, handleNumberPress, handleDelete } = usePasscodeInputState({
		isOpen,
		onClose,
		onSuccess,
		mode,
		onUnlockSuccess,
	});

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
					<div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-primary/25 blur-[120px] pointer-events-none" />
					<div className="absolute -bottom-24 right-1/4 w-80 h-80 rounded-full bg-primary/10 blur-[100px] pointer-events-none" />

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

					<PasscodePinSection
						mode={mode}
						title={title}
						subtitle={subtitle}
						digits={digits}
						isShaking={isShaking}
						isSuccess={isSuccess}
						isSubmitting={isSubmitting}
					/>

					<PasscodeKeypad
						digitsCount={digits.length}
						isSubmitting={isSubmitting}
						onRequestBiometric={onRequestBiometric}
						onPointerDownNumber={onPointerDownNumber}
						onPointerDownDelete={onPointerDownDelete}
						onPointerDownClose={onPointerDownClose}
					/>
				</motion.div>
			)}
		</AnimatePresence>
	);
}
