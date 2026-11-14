import { Users, GitCommit, Scroll } from 'lucide-react';
import React from 'react';

import type { StoryStateRecord } from '../types';

interface WorldModelTabProps {
	storyState: StoryStateRecord | null;
}

export function WorldModelTab({ storyState }: WorldModelTabProps) {
	if (!storyState) {
		return <div className="p-8 text-center text-xs text-on-surface-variant">Chưa có dữ liệu mô hình thế giới cho bộ truyện này.</div>;
	}

	const entities = storyState.entities || [];
	const threads = storyState.plotThreads || [];
	const rules = storyState.worldRules || [];

	return (
		<div className="space-y-4 pb-12">
			{/* Entities Section */}
			<div className="space-y-2">
				<div className="flex items-center gap-1.5 px-1 text-xs font-bold text-primary">
					<Users size={14} />
					<h4>Hồ Sơ Nhân Vật ({entities.length})</h4>
				</div>

				<div className="space-y-1.5">
					{entities.map((ent) => {
						const isDead = ent.status === 'DEAD';
						return (
							<div
								key={ent.name}
								className={`p-3 rounded-xl border text-xs space-y-1 ${
									isDead
										? 'bg-rose-500/10 border-rose-500/30 text-rose-200'
										: 'bg-surface-container/50 border-outline-variant/30 text-on-surface'
								}`}
							>
								<div className="flex items-center justify-between">
									<span className="font-bold text-xs">{ent.name}</span>
									<span
										className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${
											isDead ? 'bg-rose-500/20 text-rose-300' : 'bg-emerald-500/20 text-emerald-300'
										}`}
									>
										{ent.status}
									</span>
								</div>

								{ent.powerLevel && (
									<div className="text-[11px] text-on-surface-variant">
										<span className="font-semibold text-primary">Cảnh giới:</span> {ent.powerLevel}
									</div>
								)}

								{ent.knownSecrets && ent.knownSecrets.length > 0 && (
									<div className="text-[10.5px] text-on-surface-variant/80 pt-1 border-t border-outline-variant/15">
										<span className="font-semibold text-amber-400">Bí mật nắm giữ:</span> {ent.knownSecrets.join(', ')}
									</div>
								)}
							</div>
						);
					})}
				</div>
			</div>

			{/* Plot Threads Section */}
			<div className="space-y-2 pt-2">
				<div className="flex items-center gap-1.5 px-1 text-xs font-bold text-amber-400">
					<GitCommit size={14} />
					<h4>Tuyến Truyện & Phục Bút ({threads.length})</h4>
				</div>

				<div className="space-y-1.5">
					{threads.map((thread) => (
						<div
							key={thread.threadId}
							className="p-3 rounded-xl bg-surface-container/50 border border-outline-variant/30 text-xs space-y-1.5"
						>
							<div className="flex items-center justify-between">
								<h5 className="font-bold text-on-surface">{thread.title}</h5>
								<span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-500/20 text-amber-300">{thread.status}</span>
							</div>

							<p className="text-[11px] text-on-surface-variant leading-relaxed">
								<span className="font-semibold text-primary">Nghi vấn mở:</span> {thread.openQuestion}
							</p>
						</div>
					))}
				</div>
			</div>

			{/* World Rules Section */}
			{rules.length > 0 && (
				<div className="space-y-2 pt-2">
					<div className="flex items-center gap-1.5 px-1 text-xs font-bold text-cyan-400">
						<Scroll size={14} />
						<h4>Quy Tắc Thế Giới ({rules.length})</h4>
					</div>

					<div className="p-3 rounded-xl bg-surface-container/50 border border-outline-variant/30 space-y-1 text-xs text-on-surface-variant">
						{rules.map((rule) => (
							<div key={rule} className="flex items-start gap-1.5">
								<span className="text-primary font-mono text-[10px] mt-0.5">•</span>
								<span className="leading-relaxed">{rule}</span>
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	);
}
