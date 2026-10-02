import React from 'react';
import { RotateCw } from 'lucide-react';

export interface PullToRefreshIndicatorProps {
	pullDistance: number;
	isRefreshing: boolean;
	isPulling?: boolean;
	hasTriggeredThreshold?: boolean;
	threshold?: number;
	topOffset?: string;
}

export function PullToRefreshIndicator({
	pullDistance,
	isRefreshing,
	isPulling = false,
	threshold = 65,
	topOffset = 'calc(max(env(safe-area-inset-top), 0.75rem) + 8px)'
}: PullToRefreshIndicatorProps) {
	const isVisible = pullDistance > 0 || isRefreshing;
	const progress = Math.min(1, pullDistance / threshold);

	// Damped translateY positioning centered horizontally with GPU translate3d
	const translateY = isRefreshing
		? Math.min(threshold, 52)
		: pullDistance > 0
		? pullDistance
		: -70;

	const rotation = isRefreshing ? 0 : progress * 360;

	return (
		<div
			data-testid="pull-to-refresh-indicator"
			aria-hidden={!isVisible}
			className={`fixed left-1/2 -translate-x-1/2 z-50 pointer-events-none flex items-center justify-center will-change-transform ${
				isPulling
					? 'transition-none'
					: isRefreshing
					? 'transition-all duration-300 ease-out'
					: 'transition-all duration-250 ease-out'
			}`}
			style={{
				top: topOffset,
				transform: `translate3d(-50%, ${translateY}px, 0) scale(${isVisible ? (isRefreshing ? 1 : 0.85 + progress * 0.15) : 0.7})`,
				opacity: isVisible ? (isRefreshing ? 1 : Math.min(1, 0.4 + progress * 0.6)) : 0
			}}
		>
			{/* Native mobile floating round reload circle with 0 text */}
			<div className="w-10 h-10 rounded-full flex items-center justify-center bg-surface-container-highest/98 dark:bg-surface-container-high/98 border border-outline-variant/30 shadow-2xl backdrop-blur-md ring-1 ring-black/10 dark:ring-white/10">
				<RotateCw
					size={20}
					strokeWidth={2.4}
					className={`text-primary transition-transform ${isRefreshing ? 'animate-spin' : ''}`}
					style={!isRefreshing ? { transform: `rotate(${rotation}deg)` } : undefined}
				/>
			</div>
		</div>
	);
}
