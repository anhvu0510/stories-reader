import { Clock, Calendar } from 'lucide-react';
import React from 'react';

import { type SortByField, type SortOrderDirection } from '@/stores/useLibraryStore';

export interface SortOption {
	id: string;
	sortBy: SortByField;
	sortOrder: SortOrderDirection;
	label: string;
	description: string;
	icon: React.ReactNode;
}

export const SORT_OPTIONS: SortOption[] = [
	{
		id: 'createdAt-DESC',
		sortBy: 'createdAt',
		sortOrder: 'DESC',
		label: 'Mới thêm vào thư viện',
		description: 'Truyện mới được tạo / thêm gần đây',
		icon: <Calendar size={16} />,
	},
	{
		id: 'updatedAt-DESC',
		sortBy: 'updatedAt',
		sortOrder: 'DESC',
		label: 'Mới cập nhật gần nhất',
		description: 'Ưu tiên truyện có chương dịch mới cập nhật',
		icon: <Clock size={16} />,
	},
];
