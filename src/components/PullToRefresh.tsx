import React, { memo, useState, useEffect } from 'react';

import { isBrowserFullscreen } from '@/hooks/useFullscreen';
import { usePullToRefresh, type UsePullToRefreshOptions } from '@/hooks/usePullToRefresh';

import { PullToRefreshIndicator } from './PullToRefreshIndicator';

export interface PullToRefreshProps extends UsePullToRefreshOptions {
	topOffset?: string;
	showIndicator?: boolean;
}

export const PullToRefresh = memo(function PullToRefresh({
	onRefresh,
	enabled,
	disabled,
	threshold,
	maxPull,
	minDisplayTime,
	containerRef,
	targetRef,
	topOffset,
	showIndicator = true,
}: PullToRefreshProps) {
	const { pullDistance, isRefreshing, isPulling, hasTriggeredThreshold } = usePullToRefresh({
		onRefresh,
		enabled,
		disabled,
		threshold,
		maxPull,
		minDisplayTime,
		containerRef,
		targetRef,
	});

	const [isFullscreen, setIsFullscreen] = useState(isBrowserFullscreen);

	useEffect(() => {
		if (typeof document === 'undefined') return;
		const handler = () => {
			setIsFullscreen(isBrowserFullscreen());
		};
		document.addEventListener('fullscreenchange', handler);
		document.addEventListener('webkitfullscreenchange', handler);
		document.addEventListener('mozfullscreenchange', handler);
		document.addEventListener('MSFullscreenChange', handler);
		return () => {
			document.removeEventListener('fullscreenchange', handler);
			document.removeEventListener('webkitfullscreenchange', handler);
			document.removeEventListener('mozfullscreenchange', handler);
			document.removeEventListener('MSFullscreenChange', handler);
		};
	}, []);

	const shouldShowIndicator = showIndicator || isFullscreen;

	if (!shouldShowIndicator) {
		return null;
	}

	return (
		<PullToRefreshIndicator
			pullDistance={pullDistance}
			isRefreshing={isRefreshing}
			isPulling={isPulling}
			hasTriggeredThreshold={hasTriggeredThreshold}
			threshold={threshold}
			topOffset={topOffset}
		/>
	);
});
