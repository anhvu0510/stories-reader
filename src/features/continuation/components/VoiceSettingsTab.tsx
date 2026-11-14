import { Sparkles, Ban, BookOpenCheck, Feather } from 'lucide-react';
import React from 'react';

import type { StyleFingerprintRecord } from '../types';

interface VoiceSettingsTabProps {
	styleFingerprint?: StyleFingerprintRecord;
}

export function VoiceSettingsTab({ styleFingerprint }: VoiceSettingsTabProps) {
	if (!styleFingerprint) {
		return <div className="p-8 text-center text-xs text-on-surface-variant">Chưa có dữ liệu vân tay văn phong của tác giả.</div>;
	}

	const antiSlopRules = styleFingerprint.antiSlopRules || [];
	const exemplars = styleFingerprint.styleExemplars || [];

	return (
		<div className="space-y-4 pb-12">
			{/* Voice Fingerprint Attributes */}
			<div className="rounded-2xl bg-surface-container/50 border border-outline-variant/30 p-3.5 space-y-3">
				<div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
					<Feather size={14} />
					<h4>Vân Tay Văn Phong Nguyên Tác</h4>
				</div>

				<div className="space-y-2 text-xs">
					<div>
						<span className="font-semibold text-primary">Giọng văn:</span>{' '}
						<span className="text-on-surface">{styleFingerprint.voice || 'Tự nhiên, sắc sảo'}</span>
					</div>
					<div>
						<span className="font-semibold text-primary">Nhịp điệu:</span>{' '}
						<span className="text-on-surface">{styleFingerprint.pacing || 'Chi tiết, giàu chiều sâu'}</span>
					</div>
					{styleFingerprint.sensoryTone && (
						<div>
							<span className="font-semibold text-primary">Sắc thái miêu tả:</span>{' '}
							<span className="text-on-surface">{styleFingerprint.sensoryTone}</span>
						</div>
					)}
				</div>
			</div>

			{/* Voice Standard Rules Banner */}
			<div className="rounded-2xl bg-primary/10 border border-primary/30 p-3.5 space-y-2 text-xs">
				<div className="flex items-center gap-1.5 font-bold text-primary">
					<Sparkles size={14} />
					<h4>Quy Chuẩn Viết Tiếp (Voice Standard)</h4>
				</div>
				<ul className="space-y-1.5 text-[11px] text-on-surface leading-relaxed list-disc pl-4">
					<li>
						<b>Show, Don&apos;t Tell:</b> Khắc họa tâm lý qua cử chỉ, ánh mắt và phản xạ sinh lý thay vì dán nhãn cảm xúc đơn điệu.
					</li>
					<li>
						<b>Nhịp Thở Câu Văn:</b> Đan xen câu ngắn và câu dài, tránh tuyệt đối nhịp điệu đều đều vô hồn của AI.
					</li>
					<li>
						<b>Chiều Sâu Trưởng Thành:</b> Giữ trọn vẹn cảnh tình cảm/sắc thái nghệ thuật của tác phẩm, không tự kiểm duyệt cắt cụt.
					</li>
					<li>
						<b>Chapter Contract:</b> Hiện thực hóa đúng mục tiêu cảm xúc (emotionTarget) và điểm móc (hookGoal).
					</li>
				</ul>
			</div>

			{/* Banned AI Slop Phrases */}
			<div className="rounded-2xl bg-surface-container/50 border border-outline-variant/30 p-3.5 space-y-2">
				<div className="flex items-center gap-1.5 text-xs font-bold text-rose-400">
					<Ban size={14} />
					<h4>Cụm Từ Văn Mẫu AI Bị Cấm ({antiSlopRules.length})</h4>
				</div>

				<div className="flex flex-wrap gap-1.5 pt-1">
					{antiSlopRules.map((phrase) => (
						<span
							key={phrase}
							className="px-2 py-0.5 rounded-lg bg-rose-500/10 border border-rose-500/25 text-rose-300 text-[11px] font-medium"
						>
							&ldquo;{phrase}&rdquo;
						</span>
					))}
				</div>
			</div>

			{/* Style Exemplars */}
			{exemplars.length > 0 && (
				<div className="rounded-2xl bg-surface-container/50 border border-outline-variant/30 p-3.5 space-y-2">
					<div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
						<BookOpenCheck size={14} />
						<h4>Đoạn Văn Mẫu Đối Chiếu ({exemplars.length})</h4>
					</div>

					<div className="space-y-2 pt-1">
						{exemplars.map((ex) => (
							<div
								key={ex.slice(0, 30)}
								className="p-2.5 rounded-xl bg-black/20 border border-outline-variant/15 text-[11px] text-on-surface-variant italic leading-relaxed"
							>
								{ex}
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	);
}
