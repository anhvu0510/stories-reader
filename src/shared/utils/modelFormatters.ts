/**
 * Chuẩn hóa tên hiển thị ngắn gọn cho các model AI trên UI (tránh bị tràn hoặc cắt ngang).
 * - deepseek-ai/deepseek-v4.1-flash -> DS 4.1 FLASH
 * - deepseek-ai/deepseek-v4.1-flash-1017 -> DS 4.1 FLASH (1017)
 * - gemini-2.5-flash -> 2.5 FLASH
 */
export function formatModelDisplayName(model: string): string {
	if (!model) {
		return '';
	}

	const withSnapshotParen = model.replace(/-(\d{4})$/, ' ($1)');

	return withSnapshotParen
		.replace(/^deepseek-ai\/deepseek-v?/, 'DS ')
		.replace(/^deepseek-ai\//, 'DS ')
		.replace(/^deepseek-v?/, 'DS ')
		.replace(/^gemini-/, '')
		.replace(/-/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
		.toUpperCase();
}
