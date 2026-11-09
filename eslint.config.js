// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import pluginReact from 'eslint-plugin-react';
import pluginReactHooks from 'eslint-plugin-react-hooks';
import pluginReactRefresh from 'eslint-plugin-react-refresh';
import pluginImport from 'eslint-plugin-import';
import pluginPrettier from 'eslint-plugin-prettier';
import pluginUnicorn from 'eslint-plugin-unicorn';
import pluginSonarjs from 'eslint-plugin-sonarjs';
import prettierConfig from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
	// ─── Global ignores (thay thế .eslintignore) ───────────────────────────────
	{
		ignores: ['dist/**', 'node_modules/**', 'android/**', 'coverage/**', '*.d.ts', 'scripts/**'],
	},

	// ─── Base JS + TypeScript recommended ──────────────────────────────────────
	js.configs.recommended,
	...tseslint.configs.recommended,

	// ─── Main config block: tất cả .ts/.tsx ────────────────────────────────────
	{
		files: ['src/**/*.{ts,tsx}'],

		plugins: {
			react: pluginReact,
			'react-hooks': pluginReactHooks,
			'react-refresh': pluginReactRefresh,
			import: pluginImport,
			prettier: pluginPrettier,
			unicorn: pluginUnicorn,
			sonarjs: pluginSonarjs,
		},

		languageOptions: {
			globals: {
				...globals.browser,
				...globals.es2022,
			},
			parserOptions: {
				ecmaFeatures: { jsx: true },
			},
		},

		settings: {
			react: { version: 'detect' },
			'import/resolver': {
				typescript: {
					project: './tsconfig.json',
				},
			},
		},

		rules: {
			// ── Prettier (format = ESLint error) ──────────────────────────────────
			'prettier/prettier': 'error',

			// ── TypeScript strictness ─────────────────────────────────────────────
			'@typescript-eslint/no-explicit-any': 'error',
			'@typescript-eslint/no-unused-vars': [
				'error',
				{ argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
			],
			'@typescript-eslint/consistent-type-imports': [
				'error',
				{ prefer: 'type-imports', fixStyle: 'inline-type-imports' },
			],
			'@typescript-eslint/no-floating-promises': 'off', // tốn memory type-check, bật sau nếu cần
			'@typescript-eslint/no-require-imports': 'error',
			'@typescript-eslint/ban-ts-comment': [
				'error',
				{ 'ts-ignore': 'allow-with-description', minimumDescriptionLength: 10 },
			],

			// ════════════════════════════════════════════════════════════════════
			// ── CONTROL FLOW — Chống if/else lồng nhau, enforce guard clause ──
			// ════════════════════════════════════════════════════════════════════

			// Cấm else sau return/throw — bắt buộc dùng early return
			// BAD:  if (ok) { return a; } else { return b; }
			// GOOD: if (ok) return a;
			//       return b;
			'no-else-return': ['error', { allowElseIf: false }],

			// Cấm if đứng một mình trong else — merge vào else if
			// BAD:  else { if (x) {} }
			// GOOD: else if (x) {}
			'no-lonely-if': 'error',

			// Cấm điều kiện phủ định — đặt điều kiện positive trước
			// BAD:  if (!isReady) { ... } else { ... }
			// GOOD: if (isReady) { ... } else { ... }
			'unicorn/no-negated-condition': 'error',

			// Cấm nested ternary — khó đọc hơn if/else
			// BAD:  a ? b ? c : d : e
			'no-nested-ternary': 'error',

			// Giới hạn độ sâu lồng block — MIGRATION: warn, sẽ chuyển error sau refactor
			// Max 3: if → try → if là cùng (không được thêm nữa)
			'max-depth': ['warn', 3],

			// Cognitive complexity (SonarJS) — đo độ phức tạp theo cách con người đọc code
			// Khác với cyclomatic: mỗi lần lồng thêm thì hệ số nhân lên
			// BAD score: hàm 150 dòng if/else/try lồng nhau → score 20+
			// GOOD score: flat guard clauses → score thấp
			'sonarjs/cognitive-complexity': ['warn', 15],

			// Cấm duplicate conditions trong if/else if chain
			// BAD: if (a) {} else if (a) {}  — điều kiện lặp lại
			'sonarjs/no-identical-conditions': 'error',

			// Cấm nhánh if/else có cùng logic — dấu hiệu copy-paste error
			// BAD: if (a) { doX(); } else { doX(); }
			'sonarjs/no-duplicated-branches': 'error',

			// Cấm nested ternary trong JSX/logic (sonarjs version)
			'sonarjs/no-nested-conditional': 'warn',

			// Phát hiện code chết không bao giờ chạy
			// BAD: if (true) {} else { dead code here }
			'sonarjs/no-redundant-boolean': 'error',

			// Chống trùng lặp hàm và biểu thức khi tách module
			'sonarjs/no-identical-functions': 'error',
			'sonarjs/no-identical-expressions': 'error',

			// ── Anti-God-File & Function Size Gate ────────────────────────────────
			// Giới hạn tối đa 350 dòng code thực tế / file (bỏ qua dòng trống & comment)
			// để AI Agent luôn đọc trọn file trong 1 lần read_file và giữ module đơn nhiệm
			'max-lines': [
				'error',
				{ max: 350, skipBlankLines: true, skipComments: true },
			],

			// Giới hạn tối đa 120 dòng code thực tế / hàm hoặc React component
			'max-lines-per-function': [
				'error',
				{ max: 120, skipBlankLines: true, skipComments: true },
			],

			// Complexity cyclomatic (backup)
			complexity: ['warn', 10],

			// ── Code safety ───────────────────────────────────────────────────────
			'no-empty': ['error', { allowEmptyCatch: false }],
			'no-console': ['warn', { allow: ['warn', 'error'] }],
			eqeqeq: ['error', 'always'],
			'prefer-const': 'error',
			// Khi re-throw nên wrap { cause: err } để giữ stack trace đầy đủ
			'preserve-caught-error': 'warn',

			// ── Comment discipline ────────────────────────────────────────────────
			'spaced-comment': ['error', 'always', { markers: ['/'] }],
			'multiline-comment-style': ['warn', 'starred-block'],

			// ── Import order ──────────────────────────────────────────────────────
			'import/order': [
				'error',
				{
					groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index', 'type'],
					pathGroups: [
						{
							pattern: '@/**',
							group: 'internal',
							position: 'before',
						},
					],
					pathGroupsExcludedImportTypes: ['type'],
					'newlines-between': 'always',
					alphabetize: { order: 'asc', caseInsensitive: true },
				},
			],
			'import/no-cycle': ['error', { maxDepth: 5 }],
			'import/no-duplicates': 'error',
			'import/no-self-import': 'error',

			// ── React ─────────────────────────────────────────────────────────────
			'react/react-in-jsx-scope': 'off', // React 17+ JSX transform
			'react/prop-types': 'off', // dùng TypeScript interface thay thế
			'react/jsx-key': ['error', { checkFragmentShorthand: true }],
			'react/self-closing-comp': ['error', { component: true, html: true }],
			'react/display-name': 'warn',
			'react/no-array-index-key': 'warn',
			'react/no-unstable-nested-components': 'error',

			// ── React Hooks ───────────────────────────────────────────────────────
			'react-hooks/rules-of-hooks': 'error',
			'react-hooks/exhaustive-deps': 'warn',

			// ── React Refresh (Vite HMR safety) ───────────────────────────────────
			'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
		},
	},

	// ─── Test files — nới lỏng một số rule strict ──────────────────────────────
	{
		files: ['**/__tests__/**', '**/*.test.ts', '**/*.test.tsx'],
		rules: {
			'@typescript-eslint/no-explicit-any': 'off',
			'@typescript-eslint/no-unused-vars': 'off',
			'no-console': 'off',
			'max-depth': ['warn', 4],
			'max-lines': 'off',
			'max-lines-per-function': 'off',
			'sonarjs/cognitive-complexity': 'off',
			'sonarjs/no-identical-functions': 'off',
			'unicorn/no-negated-condition': 'off',
		},
	},

	// ─── Prettier config cuối cùng (tắt format rules conflict) ────────────────
	prettierConfig,
);
