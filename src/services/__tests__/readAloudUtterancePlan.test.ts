import { describe, expect, it } from 'vitest';

import { buildReadAloudUtterancePlan } from '@/services/readAloudUtterancePlan';

describe('buildReadAloudUtterancePlan', () => {
	it('creates source-mapped Vietnamese utterances within the hard limit', () => {
		const paragraphs = [
			'Người đàn ông khẽ nói: “Chúng ta đi thôi.” Sau đó, họ bước qua cánh cửa lớn. '.repeat(5).trim(),
			'Một đoạn ngắn khác.'
		];

		const utterances = buildReadAloudUtterancePlan(paragraphs);

		expect(utterances.length).toBeGreaterThan(2);
		for (const utterance of utterances) {
			expect(utterance.text.length).toBeLessThanOrEqual(220);
			expect(paragraphs[utterance.paragraphIndex].slice(utterance.sourceStart, utterance.sourceStart + utterance.sourceLength)).toBe(
				utterance.text
			);
		}
	});

	it('uses stable ids and skips empty paragraphs without losing paragraph indexes', () => {
		const utterances = buildReadAloudUtterancePlan(['', '  ', 'Xin chào. Tạm biệt.']);

		expect(utterances.map((utterance) => utterance.id)).toEqual(['p2-u0']);
		expect(utterances[0]).toMatchObject({ paragraphIndex: 2, sourceStart: 0, sourceLength: 19 });
	});
});
