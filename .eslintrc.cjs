module.exports = {
	root: true,
	env: {
		browser: true,
		es2022: true,
		node: true
	},
	parser: '@typescript-eslint/parser',
	parserOptions: {
		ecmaVersion: 'latest',
		sourceType: 'module',
		ecmaFeatures: {
			jsx: true
		}
	},
	plugins: ['@typescript-eslint', 'react-hooks'],
	extends: [
		'eslint:recommended',
		'plugin:@typescript-eslint/recommended'
	],
	rules: {
		// Clean Control Flow & Zero Nested Logic
		'max-depth': ['error', 3],
		'no-else-return': ['error', { allowElseIf: false }],
		'no-lonely-if': 'error',

		// React Hooks Discipline
		'react-hooks/rules-of-hooks': 'error',
		'react-hooks/exhaustive-deps': 'warn',

		// TypeScript Strictness
		'@typescript-eslint/no-explicit-any': 'warn',
		'@typescript-eslint/no-unused-vars': [
			'warn',
			{ argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
		],

		// Code Safety
		'no-empty': ['warn', { allowEmptyCatch: false }]
	},
	ignorePatterns: [
		'dist',
		'node_modules',
		'android',
		'coverage',
		'*.d.ts'
	]
};
