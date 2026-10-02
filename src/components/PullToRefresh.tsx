import React, { memo } from 'react';

import { usePullToRefresh, type UsePullToRefreshOptions } from '@/hooks/usePullToRefresh';

import { PullToRefreshIndicator } from './PullToRefreshIndicator';

export interface PullToRefreshProps extends UsePullToRefreshOptions {
	topOffset?: string;
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
	topOffset
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
