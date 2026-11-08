import { RotateCw } from 'lucide-react';
import React from 'react';

export interface PullToRefreshIndicatorProps {
	pullDistance: number;
	isRefreshing: boolean;
	isPulling?: boolean;
	hasTriggeredThreshold?: boolean;
	threshold?: number;
	topOffset?: string;
}

function getPullTranslateY(pullDistance: number, isRefreshing: boolean, threshold: number): number {
	if (isRefreshing) {
		return Math.min(threshold, 48);
	}
	if (pullDistance > 0) {
		return Math.min(threshold + 15, pullDistance * 0.75);
	}
	return -60;
}

function getIndicatorMetrics(pullDistance: number, isRefreshing: boolean, threshold: number) {
	const isVisible = pullDistance > 0 || isRefreshing;
	const progress = Math.min(1, pullDistance / threshold);

	if (isRefreshing) {
		return { isVisible, rotation: 0, scale: 1, opacity: 1 };
	}
	if (!isVisible) {
		return { isVisible: false, rotation: 0, scale: 0.5, opacity: 0 };
	}
	return {
		isVisible: true,
		rotation: progress * 360,
		scale: 0.6 + progress * 0.45,
		opacity: Math.min(1, progress * 1.2),
	};
}

function getTransitionClass(isPulling: boolean, isRefreshing: boolean): string {
	if (isPulling) {
		return 'transition-none';
	}
	if (isRefreshing) {
		return 'transition-all duration-300 ease-out';
	}
	return 'transition-all duration-200 ease-in';
}

export function PullToRefreshIndicator({
	pullDistance,
	isRefreshing,
	isPulling = false,
	threshold = 65,
	topOffset = 'calc(max(env(safe-area-inset-top), 0.75rem) + 4px)',
}: PullToRefreshIndicatorProps) {
	const translateY = getPullTranslateY(pullDistance, isRefreshing, threshold);
	const { isVisible, rotation, scale, opacity } = getIndicatorMetrics(pullDistance, isRefreshing, threshold);
	const transitionClass = getTransitionClass(isPulling, isRefreshing);

	return (
		<div
			data-testid="pull-to-refresh-indicator"
			aria-hidden={!isVisible}
			className={`fixed left-1/2 -translate-x-1/2 z-50 pointer-events-none flex items-center justify-center will-change-transform ${transitionClass}`}
			style={{
				top: topOffset,
				transform: `translate3d(-50%, ${translateY}px, 0) scale(${scale})`,
				opacity,
			}}
		>
			{/* Pure native vector icon without any circular background */}
			<RotateCw
				size={26}
				strokeWidth={2.6}
				className={`text-primary drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)] transition-transform ${isRefreshing ? 'animate-spin' : ''}`}
				style={isRefreshing ? undefined : { transform: `rotate(${rotation}deg)` }}
			/>
		</div>
	);
}
