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
	topOffset = 'calc(max(env(safe-area-inset-top), 0.75rem) + 4px)'
}: PullToRefreshIndicatorProps) {
	const isVisible = pullDistance > 0 || isRefreshing;
	const progress = Math.min(1, pullDistance / threshold);

	// Damped translateY positioning centered horizontally with GPU translate3d
	const translateY = isRefreshing
		? Math.min(threshold, 48)
		: pullDistance > 0
		? Math.min(threshold + 15, pullDistance * 0.75)
		: -60;

	const rotation = isRefreshing ? 0 : progress * 360;
	const scale = isVisible ? (isRefreshing ? 1 : 0.6 + progress * 0.45) : 0.5;
	const opacity = isVisible ? (isRefreshing ? 1 : Math.min(1, progress * 1.2)) : 0;

	return (
		<div
			data-testid="pull-to-refresh-indicator"
			aria-hidden={!isVisible}
			className={`fixed left-1/2 -translate-x-1/2 z-50 pointer-events-none flex items-center justify-center will-change-transform ${
				isPulling
					? 'transition-none'
					: isRefreshing
					? 'transition-all duration-300 ease-out'
					: 'transition-all duration-200 ease-in'
			}`}
			style={{
				top: topOffset,
				transform: `translate3d(-50%, ${translateY}px, 0) scale(${scale})`,
				opacity
			}}
		>
			{/* Pure native vector icon without any circular background */}
			<RotateCw
				size={26}
				strokeWidth={2.6}
				className={`text-primary drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)] transition-transform ${
					isRefreshing ? 'animate-spin' : ''
				}`}
				style={!isRefreshing ? { transform: `rotate(${rotation}deg)` } : undefined}
			/>
		</div>
	);
}
