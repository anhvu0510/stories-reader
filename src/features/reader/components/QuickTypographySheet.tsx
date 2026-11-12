import { X, Type, Minus, Plus, Palette, AlignJustify, Layers, Sliders, Check } from 'lucide-react';
import { motion } from 'motion/react';
import React from 'react';

import { BottomSheet } from '@/components/BottomSheet';
import { triggerHaptic } from '@/hooks/useHaptic';
import { useReaderConfigStore } from '@/stores/useReaderConfigStore';

import type { FontType, ThemeType } from '@/shared/types';

interface QuickTypographySheetProps {
	onClose: () => void;
}

const THEMES: { id: ThemeType; name: string; bg: string; text: string }[] = [
	{ id: 'royal-vn', name: 'Royal VN', bg: '#040e2b', text: '#e2e8f0' },
	{ id: 'default', name: 'Amoled', bg: '#000000', text: '#f4f4f5' },
	{ id: 'midnight', name: 'Midnight', bg: '#0f172a', text: '#f8fafc' },
	{ id: 'obsidian', name: 'Obsidian', bg: '#0c0a14', text: '#f3e8ff' },
];

const FONTS: { id: FontType; name: string }[] = [
	{ id: 'bookerly', name: 'Bookerly' },
	{ id: 'merriweather', name: 'Merriweather' },
	{ id: 'lora', name: 'Lora' },
	{ id: 'charter', name: 'Charter' },
	{ id: 'palatino', name: 'Palatino' },
	{ id: 'default', name: 'Sans-Serif' },
	{ id: 'font_viet_tay', name: 'Monospace' },
];

const FONT_STYLE_MAP: Record<string, string> = {
	bookerly: 'font-bookerly',
	merriweather: 'font-merriweather',
	lora: 'font-lora',
	charter: 'font-charter',
	palatino: 'font-palatino',
	font_viet_tay: 'font-viet-tay',
};

function FontSizeControlRow({ fontSize, setFontSize }: { fontSize: number; setFontSize: (size: number) => void }) {
	return (
		<div className="flex items-center justify-between gap-2 bg-white/10 p-2 px-3 rounded-xl border border-white/20 shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.3)]">
			<div className="text-[10px] font-mono font-bold text-on-surface-variant/80 uppercase tracking-wider flex items-center gap-1">
				<Type size={11} className="text-primary" /> CỠ CHỮ: <div className="text-primary font-black inline-block">{fontSize}px</div>
			</div>
			<div className="flex items-center gap-1.5 shrink-0">
				<motion.button
					whileTap={{ scale: 0.9 }}
					onClick={() => {
						triggerHaptic('light');
						setFontSize(Math.max(12, fontSize - 1));
					}}
					className="h-8 px-2.5 rounded-lg bg-white/10 border border-white/20 text-on-surface font-bold text-xs shadow-xs hover:bg-white/20 transition-all flex items-center gap-1 cursor-pointer"
					title="Giảm cỡ chữ"
				>
					<Minus size={12} /> A-
				</motion.button>
				<input
					type="range"
					min="12"
					max="32"
					value={fontSize}
					onChange={(e) => setFontSize(Number(e.target.value))}
					className="w-20 accent-primary bg-white/10 h-1.5 rounded-lg cursor-pointer"
				/>
				<motion.button
					whileTap={{ scale: 0.9 }}
					onClick={() => {
						triggerHaptic('light');
						setFontSize(Math.min(36, fontSize + 1));
					}}
					className="h-8 px-2.5 rounded-lg bg-white/10 border border-white/20 text-on-surface font-bold text-xs shadow-xs hover:bg-white/20 transition-all flex items-center gap-1 cursor-pointer"
					title="Tăng cỡ chữ"
				>
					<Plus size={12} /> A+
				</motion.button>
			</div>
		</div>
	);
}

function ThemeSwatchesRow({
	theme,
	setTheme,
	font,
	setFont,
}: {
	theme: ThemeType;
	setTheme: (theme: ThemeType) => void;
	font: FontType;
	setFont: (font: FontType) => void;
}) {
	const currentThemeObj = THEMES.find((t) => t.id === theme) || THEMES[0];

	return (
		<>
			<div className="flex items-center justify-between gap-2 bg-white/5 p-1.5 px-3 rounded-xl border border-white/10">
				<div className="flex items-center gap-1 shrink-0">
					<Palette size={11} className="text-primary" />
					<div className="text-[10px] font-mono font-bold text-on-surface-variant/80 uppercase tracking-wider">
						MÀU NỀN: <div className="text-primary font-black inline-block">{currentThemeObj.name}</div>
					</div>
				</div>

				<div className="flex items-center gap-2 shrink-0">
					{THEMES.map((t) => {
						const isSelected = theme === t.id;
						return (
							<motion.button
								key={t.id}
								whileTap={{ scale: 0.85 }}
								onClick={() => {
									triggerHaptic('selection');
									setTheme(t.id);
								}}
								title={t.name}
								aria-label={t.name}
								className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border border-white/30 transition-all cursor-pointer relative ${isSelected ? 'ring-2 ring-primary ring-offset-2 ring-offset-slate-900 shadow-xs' : 'opacity-70 hover:opacity-100'}`}
								style={{ backgroundColor: t.bg, color: t.text }}
							>
								{isSelected && <Check size={13} strokeWidth={3} />}
							</motion.button>
						);
					})}
				</div>
			</div>

			<div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar py-0.5">
				{FONTS.map((f) => {
					const isSelected = font === f.id;
					const fontStyleClass = FONT_STYLE_MAP[f.id] || 'font-default';
					return (
						<motion.button
							key={f.id}
							whileTap={{ scale: 0.94 }}
							onClick={() => {
								triggerHaptic('selection');
								setFont(f.id);
							}}
							className={`px-3 py-2 rounded-xl border text-[11px] font-bold shrink-0 transition-all flex items-center gap-1 cursor-pointer ${fontStyleClass} ${isSelected ? 'bg-gradient-to-b from-primary via-primary-fixed to-primary-fixed-dim text-on-primary border-primary/70 shadow-[0_2px_8px_var(--primary)] font-black' : 'bg-white/10 border-white/20 text-on-surface-variant hover:text-on-surface hover:bg-white/20 shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.3)]'}`}
						>
							{f.name}
							{isSelected && <Check size={11} strokeWidth={3} />}
						</motion.button>
					);
				})}
			</div>
		</>
	);
}

function TypographySteppersAndReplaceSection({
	lineHeight,
	setLineHeight,
	groupLines,
	setGroupLines,
	isEnabledReplace,
	setIsEnabledReplace,
}: {
	lineHeight: number;
	setLineHeight: (val: number) => void;
	groupLines: number;
	setGroupLines: (val: number) => void;
	isEnabledReplace: boolean;
	setIsEnabledReplace: (val: boolean) => void;
}) {
	return (
		<>
			<div className="grid grid-cols-2 gap-2">
				<div className="bg-white/5 p-2 rounded-xl border border-white/10 flex items-center justify-between gap-1">
					<div className="text-[10px] font-mono font-bold text-on-surface-variant/80 uppercase tracking-wider flex items-center gap-1">
						<AlignJustify size={11} className="text-primary" /> DÒNG:{' '}
						<div className="text-primary font-black inline-block">{lineHeight}</div>
					</div>
					<div className="flex items-center gap-1.5 shrink-0">
						<motion.button
							type="button"
							whileTap={{ scale: 0.88 }}
							onClick={() => {
								triggerHaptic('light');
								setLineHeight(Math.max(1.0, Number((lineHeight - 0.1).toFixed(1))));
							}}
							disabled={lineHeight <= 1.0}
							className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:pointer-events-none text-on-surface font-bold text-xs flex items-center justify-center transition-all cursor-pointer"
							title="Giảm khoảng cách dòng"
						>
							<Minus size={13} />
						</motion.button>
						<motion.button
							type="button"
							whileTap={{ scale: 0.88 }}
							onClick={() => {
								triggerHaptic('light');
								setLineHeight(Math.min(2.4, Number((lineHeight + 0.1).toFixed(1))));
							}}
							disabled={lineHeight >= 2.4}
							className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:pointer-events-none text-on-surface font-bold text-xs flex items-center justify-center transition-all cursor-pointer"
							title="Tăng khoảng cách dòng"
						>
							<Plus size={13} />
						</motion.button>
					</div>
				</div>

				<div className="bg-white/5 p-2 rounded-xl border border-white/10 flex items-center justify-between gap-1">
					<div className="text-[10px] font-mono font-bold text-on-surface-variant/80 uppercase tracking-wider flex items-center gap-1">
						<Layers size={11} className="text-primary" /> GỘP: <div className="text-primary font-black inline-block">{groupLines}</div>
					</div>
					<div className="flex items-center gap-1.5 shrink-0">
						<motion.button
							type="button"
							whileTap={{ scale: 0.88 }}
							onClick={() => {
								triggerHaptic('light');
								setGroupLines(Math.max(1, groupLines - 1));
							}}
							disabled={groupLines <= 1}
							className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:pointer-events-none text-on-surface font-bold text-xs flex items-center justify-center transition-all cursor-pointer"
							title="Giảm gộp dòng"
						>
							<Minus size={13} />
						</motion.button>
						<motion.button
							type="button"
							whileTap={{ scale: 0.88 }}
							onClick={() => {
								triggerHaptic('light');
								setGroupLines(Math.min(10, groupLines + 1));
							}}
							disabled={groupLines >= 10}
							className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:pointer-events-none text-on-surface font-bold text-xs flex items-center justify-center transition-all cursor-pointer"
							title="Tăng gộp dòng"
						>
							<Plus size={13} />
						</motion.button>
					</div>
				</div>
			</div>

			<div className="bg-white/5 p-2.5 px-3 rounded-xl border border-white/10 flex items-center justify-between gap-2">
				<div className="flex items-center gap-1.5">
					<Sliders size={14} className="text-primary shrink-0" />
					<div className="text-xs font-bold text-on-surface">Bộ Thay Thế Từ Ngữ</div>
				</div>

				<motion.button
					whileTap={{ scale: 0.94 }}
					onClick={() => {
						triggerHaptic('selection');
						setIsEnabledReplace(!isEnabledReplace);
					}}
					className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-200 ease-in-out shrink-0 cursor-pointer ${isEnabledReplace ? 'bg-gradient-to-b from-primary to-primary-fixed' : 'bg-white/10 border border-white/20'}`}
					title="Bật/tắt bộ thay thế từ ngữ"
					aria-label="Bật/tắt bộ thay thế từ ngữ"
				>
					<div
						className={`w-5 h-5 rounded-full bg-white transition-transform duration-200 ease-in-out shadow-xs ${isEnabledReplace ? 'translate-x-5' : 'translate-x-0'}`}
					/>
				</motion.button>
			</div>
		</>
	);
}

export function QuickTypographySheet({ onClose }: QuickTypographySheetProps) {
	const {
		fontSize,
		setFontSize,
		lineHeight,
		setLineHeight,
		groupLines,
		setGroupLines,
		theme,
		setTheme,
		font,
		setFont,
		isEnabledReplace,
		setIsEnabledReplace,
	} = useReaderConfigStore();

	return (
		<BottomSheet isOpen={true} onClose={onClose} ariaLabel="Giao Diện Đọc" maxHeight="max-h-[85vh]" showDragHandle={false}>
			<div className="pt-2.5 px-4 pb-2 border-b border-white/10 flex-shrink-0 bg-transparent relative z-20">
				<div className="w-10 h-1 rounded-full bg-white/25 dark:bg-white/20 mx-auto mb-2 flex-shrink-0" />
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-1.5">
						<Type size={15} className="text-primary" />
						<h3 className="text-xs font-black tracking-tight text-on-surface uppercase font-mono">Giao Diện Đọc ({fontSize}px)</h3>
					</div>
					<motion.button
						whileTap={{ scale: 0.88 }}
						onClick={() => {
							triggerHaptic('light');
							onClose();
						}}
						className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-on-surface-variant hover:text-on-surface transition-colors flex items-center justify-center cursor-pointer"
						title="Đóng"
						aria-label="Đóng"
					>
						<X size={16} />
					</motion.button>
				</div>
			</div>

			<div className="p-3.5 sm:p-4 space-y-3 max-h-[50dvh] overflow-y-auto hide-scrollbar box-border flex-1">
				<FontSizeControlRow fontSize={fontSize} setFontSize={setFontSize} />
				<ThemeSwatchesRow theme={theme} setTheme={setTheme} font={font} setFont={setFont} />
				<TypographySteppersAndReplaceSection
					lineHeight={lineHeight}
					setLineHeight={setLineHeight}
					groupLines={groupLines}
					setGroupLines={setGroupLines}
					isEnabledReplace={isEnabledReplace}
					setIsEnabledReplace={setIsEnabledReplace}
				/>
			</div>
		</BottomSheet>
	);
}
