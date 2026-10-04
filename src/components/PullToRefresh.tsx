import React, { memo } from 'react';

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
	showIndicator = true
}: PullToRefreshProps) {
	const {
		pullDistance,
		isRefreshing,
		isPulling,
		hasTriggeredThreshold
	} = usePullToRefresh({
		onRefresh,
		enabled,
		disabled,
		threshold,
		maxPull,
		minDisplayTime,
		containerRef,
		targetRef
	});

	if (!showIndicator) {
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
