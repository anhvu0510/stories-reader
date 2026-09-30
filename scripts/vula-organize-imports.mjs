import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(process.cwd() + '/');
const ts = require('typescript');
const srcDir = path.resolve(process.cwd(), 'src');

function getAllSourceFiles(dir, fileList = []) {
	const entries = fs.readdirSync(dir, { withFileTypes: true });
	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			getAllSourceFiles(fullPath, fileList);
		} else if (/\.(ts|tsx)$/.test(entry.name)) {
			fileList.push(fullPath);
		}
	}
	return fileList;
}

function organizeFile(filePath) {
	let content = fs.readFileSync(filePath, 'utf8');
	const fileDir = path.dirname(filePath);

	// 1. Chuyển đổi ../ sang @/
	content = content.replace(/(from\s+['"])(\.\.[^'"]+)(['"])/g, (match, p1, p2, p3) => {
		const targetAbs = path.resolve(fileDir, p2);
		if (targetAbs.startsWith(srcDir)) {
			return `${p1}@/${path.relative(srcDir, targetAbs).replace(/\\/g, '/')}${p3}`;
		}
		return match;
	});

	// 2. Phân loại AST
	const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);
	const importNodes = [];
	let firstImportStart = -1;
	let lastImportEnd = 0;

	for (const stmt of sourceFile.statements) {
		if (ts.isImportDeclaration(stmt)) {
			if (firstImportStart === -1) firstImportStart = stmt.getStart(sourceFile);
			lastImportEnd = stmt.getEnd();
			importNodes.push(stmt);
		} else {
			break;
		}
	}

	if (importNodes.length === 0) return;

	const imports = importNodes.map((node) => {
		let rawText = content.substring(node.getStart(sourceFile), node.getEnd()).trim();
		const spec = node.moduleSpecifier.text;
		let isType = Boolean(node.importClause?.isTypeOnly);
		if ((spec === '@/shared/types' || spec.endsWith('/types')) && rawText.startsWith('import {')) {
			rawText = rawText.replace(/^import\s*\{/, 'import type {');
			isType = true;
		}
		return { rawText, spec, isType };
	});

	const groups = { 1: [], 2: [], 3: [], 4: [] };
	for (const imp of imports) {
		if (imp.isType || imp.rawText.startsWith('import type')) groups[4].push(imp);
		else if (imp.spec.startsWith('.')) groups[3].push(imp);
		else if (imp.spec.startsWith('@/')) groups[2].push(imp);
		else groups[1].push(imp);
	}

	const getExtPri = (s) => (s === 'react' ? 1 : s.startsWith('react-dom') ? 2 : s === 'react-router-dom' ? 3 : s.startsWith('motion') ? 4 : s === 'lucide-react' ? 5 : 10);
	groups[1].sort((a, b) => getExtPri(a.spec) - getExtPri(b.spec) || a.spec.localeCompare(b.spec));
	groups[2].sort((a, b) => a.spec.localeCompare(b.spec));
	groups[3].sort((a, b) => a.spec.localeCompare(b.spec));
	groups[4].sort((a, b) => a.spec.localeCompare(b.spec));

	const blocks = [1, 2, 3, 4]
		.map((c) => Array.from(new Set(groups[c].map((i) => i.rawText))).join('\n'))
		.filter(Boolean)
		.join('\n\n');

	const prefix = content.substring(0, firstImportStart);
	const suffix = content.substring(lastImportEnd).replace(/^(\r?\n)+/, '\n\n');
	fs.writeFileSync(filePath, prefix + blocks + suffix, 'utf8');
}

const files = getAllSourceFiles(srcDir);
files.forEach(organizeFile);
console.log(`Hoàn tất chuẩn hóa ${files.length} files.`);
