export type ShadcnVariantGroup = {
	name: string;
	options: string[];
};

export type ShadcnVariantsMeta = {
	groups: ShadcnVariantGroup[];
	defaults: Record<string, string>;
};

function isIdentifierStart(ch: string): boolean {
	return /[A-Za-z_$]/.test(ch);
}

function isIdentifierChar(ch: string): boolean {
	return /[A-Za-z0-9_$]/.test(ch);
}

function skipWhitespace(source: string, index: number): number {
	let i = index;
	while (i < source.length && /\s/.test(source[i]!)) i++;
	return i;
}

function skipWhitespaceAndCommas(source: string, index: number): number {
	let i = index;
	while (i < source.length) {
		const ch = source[i]!;
		if (ch === ',' || /\s/.test(ch)) {
			i++;
			continue;
		}
		return i;
	}
	return i;
}

function readStringLiteral(source: string, index: number): { value: string; next: number } | null {
	const quote = source[index];
	if (quote !== "'" && quote !== '"') return null;
	let i = index + 1;
	let out = '';
	while (i < source.length) {
		const ch = source[i]!;
		if (ch === '\\') {
			const next = source[i + 1];
			if (next) out += next;
			i += 2;
			continue;
		}
		if (ch === quote) return { value: out, next: i + 1 };
		out += ch;
		i++;
	}
	return null;
}

function readIdentifier(source: string, index: number): { value: string; next: number } | null {
	if (!isIdentifierStart(source[index] ?? '')) return null;
	let i = index;
	let out = source[i]!;
	i++;
	while (i < source.length && isIdentifierChar(source[i]!)) {
		out += source[i]!;
		i++;
	}
	return { value: out, next: i };
}

function extractBalancedBraces(
	source: string,
	startIndex: number
): { text: string; end: number } | null {
	if (source[startIndex] !== '{') return null;

	let i = startIndex;
	let depth = 0;
	let inSingle = false;
	let inDouble = false;
	let inTemplate = false;
	let inLineComment = false;
	let inBlockComment = false;

	while (i < source.length) {
		const ch = source[i]!;
		const next = source[i + 1] ?? '';

		if (inLineComment) {
			if (ch === '\n') inLineComment = false;
			i++;
			continue;
		}

		if (inBlockComment) {
			if (ch === '*' && next === '/') {
				inBlockComment = false;
				i += 2;
				continue;
			}
			i++;
			continue;
		}

		if (inSingle) {
			if (ch === '\\') {
				i += 2;
				continue;
			}
			if (ch === "'") inSingle = false;
			i++;
			continue;
		}

		if (inDouble) {
			if (ch === '\\') {
				i += 2;
				continue;
			}
			if (ch === '"') inDouble = false;
			i++;
			continue;
		}

		if (inTemplate) {
			if (ch === '\\') {
				i += 2;
				continue;
			}
			if (ch === '`') {
				inTemplate = false;
				i++;
				continue;
			}
			i++;
			continue;
		}

		if (ch === '/' && next === '/') {
			inLineComment = true;
			i += 2;
			continue;
		}
		if (ch === '/' && next === '*') {
			inBlockComment = true;
			i += 2;
			continue;
		}

		if (ch === "'") {
			inSingle = true;
			i++;
			continue;
		}
		if (ch === '"') {
			inDouble = true;
			i++;
			continue;
		}
		if (ch === '`') {
			inTemplate = true;
			i++;
			continue;
		}

		if (ch === '{') depth++;
		if (ch === '}') {
			depth--;
			if (depth === 0) return { text: source.slice(startIndex, i + 1), end: i + 1 };
		}

		i++;
	}

	return null;
}

function skipValue(source: string, index: number): number {
	let i = index;
	let brace = 0;
	let bracket = 0;
	let paren = 0;
	let inSingle = false;
	let inDouble = false;
	let inTemplate = false;
	let inLineComment = false;
	let inBlockComment = false;

	while (i < source.length) {
		const ch = source[i]!;
		const next = source[i + 1] ?? '';

		if (inLineComment) {
			if (ch === '\n') inLineComment = false;
			i++;
			continue;
		}
		if (inBlockComment) {
			if (ch === '*' && next === '/') {
				inBlockComment = false;
				i += 2;
				continue;
			}
			i++;
			continue;
		}

		if (inSingle) {
			if (ch === '\\') {
				i += 2;
				continue;
			}
			if (ch === "'") inSingle = false;
			i++;
			continue;
		}

		if (inDouble) {
			if (ch === '\\') {
				i += 2;
				continue;
			}
			if (ch === '"') inDouble = false;
			i++;
			continue;
		}

		if (inTemplate) {
			if (ch === '\\') {
				i += 2;
				continue;
			}
			if (ch === '`') {
				inTemplate = false;
				i++;
				continue;
			}
			i++;
			continue;
		}

		if (ch === '/' && next === '/') {
			inLineComment = true;
			i += 2;
			continue;
		}
		if (ch === '/' && next === '*') {
			inBlockComment = true;
			i += 2;
			continue;
		}

		if (ch === "'") {
			inSingle = true;
			i++;
			continue;
		}
		if (ch === '"') {
			inDouble = true;
			i++;
			continue;
		}
		if (ch === '`') {
			inTemplate = true;
			i++;
			continue;
		}

		if (ch === '{') brace++;
		else if (ch === '}') {
			if (brace === 0 && bracket === 0 && paren === 0) return i;
			brace = Math.max(0, brace - 1);
		} else if (ch === '[') bracket++;
		else if (ch === ']') bracket = Math.max(0, bracket - 1);
		else if (ch === '(') paren++;
		else if (ch === ')') paren = Math.max(0, paren - 1);

		if (ch === ',' && brace === 0 && bracket === 0 && paren === 0) return i;

		i++;
	}

	return i;
}

function parseObjectKeys(objectText: string): string[] {
	const out: string[] = [];
	if (!objectText.startsWith('{')) return out;

	let i = 1;
	while (i < objectText.length - 1) {
		i = skipWhitespaceAndCommas(objectText, i);
		if (i >= objectText.length - 1) break;

		const stringKey = readStringLiteral(objectText, i);
		const identKey = stringKey ? null : readIdentifier(objectText, i);
		const key = stringKey?.value ?? identKey?.value;
		const nextAfterKey = stringKey?.next ?? identKey?.next;
		if (!key || nextAfterKey == null) {
			i++;
			continue;
		}

		i = skipWhitespace(objectText, nextAfterKey);
		if (objectText[i] !== ':') {
			i++;
			continue;
		}
		i++;
		i = skipWhitespace(objectText, i);

		i = skipValue(objectText, i);
		out.push(key);

		if (objectText[i] === ',') i++;
	}

	return out;
}

function parseObjectOfObjects(objectText: string): Map<string, string> {
	const out = new Map<string, string>();
	if (!objectText.startsWith('{')) return out;

	let i = 1;
	while (i < objectText.length - 1) {
		i = skipWhitespaceAndCommas(objectText, i);
		if (i >= objectText.length - 1) break;

		const stringKey = readStringLiteral(objectText, i);
		const identKey = stringKey ? null : readIdentifier(objectText, i);
		const key = stringKey?.value ?? identKey?.value;
		const nextAfterKey = stringKey?.next ?? identKey?.next;
		if (!key || nextAfterKey == null) {
			i++;
			continue;
		}

		i = skipWhitespace(objectText, nextAfterKey);
		if (objectText[i] !== ':') {
			i++;
			continue;
		}
		i++;
		i = skipWhitespace(objectText, i);

		if (objectText[i] === '{') {
			const balanced = extractBalancedBraces(objectText, i);
			if (!balanced) break;
			out.set(key, balanced.text);
			i = balanced.end;
		} else {
			i = skipValue(objectText, i);
		}

		if (objectText[i] === ',') i++;
	}

	return out;
}

function parseObjectOfStringValues(objectText: string): Record<string, string> {
	const out: Record<string, string> = {};
	if (!objectText.startsWith('{')) return out;

	let i = 1;
	while (i < objectText.length - 1) {
		i = skipWhitespaceAndCommas(objectText, i);
		if (i >= objectText.length - 1) break;

		const stringKey = readStringLiteral(objectText, i);
		const identKey = stringKey ? null : readIdentifier(objectText, i);
		const key = stringKey?.value ?? identKey?.value;
		const nextAfterKey = stringKey?.next ?? identKey?.next;
		if (!key || nextAfterKey == null) {
			i++;
			continue;
		}

		i = skipWhitespace(objectText, nextAfterKey);
		if (objectText[i] !== ':') {
			i++;
			continue;
		}
		i++;
		i = skipWhitespace(objectText, i);

		const stringValue = readStringLiteral(objectText, i);
		if (stringValue) {
			out[key] = stringValue.value;
			i = stringValue.next;
		} else {
			const identValue = readIdentifier(objectText, i);
			if (identValue) {
				out[key] = identValue.value;
				i = identValue.next;
			} else {
				i = skipValue(objectText, i);
			}
		}

		if (objectText[i] === ',') i++;
	}

	return out;
}

function extractCodeFences(markdown: string): string[] {
	const out: string[] = [];
	const re = /```[a-zA-Z0-9_-]*\n([\s\S]*?)\n```/g;
	let m: RegExpExecArray | null;
	while ((m = re.exec(markdown)) !== null) out.push(m[1] ?? '');
	return out;
}

function findAllObjectLiteralsAfterKey(
	source: string,
	key: string
): Array<{ text: string; start: number; end: number }> {
	const out: Array<{ text: string; start: number; end: number }> = [];
	const re = new RegExp(`\\b${key}\\b\\s*:\\s*\\{`, 'g');
	let m: RegExpExecArray | null;
	while ((m = re.exec(source)) !== null) {
		const braceStart = m.index + m[0].length - 1;
		const balanced = extractBalancedBraces(source, braceStart);
		if (!balanced) continue;
		out.push({ text: balanced.text, start: braceStart, end: balanced.end });
		re.lastIndex = balanced.end;
	}
	return out;
}

export function extractShadcnVariantsFromMarkdown(markdown: string): ShadcnVariantsMeta {
	const groups = new Map<string, Set<string>>();
	const defaults: Record<string, string> = {};

	for (const code of extractCodeFences(markdown)) {
		for (const v of findAllObjectLiteralsAfterKey(code, 'variants')) {
			const top = parseObjectOfObjects(v.text);
			for (const [groupName, groupObject] of top.entries()) {
				const options = parseObjectKeys(groupObject);
				if (!groups.has(groupName)) groups.set(groupName, new Set());
				const bucket = groups.get(groupName)!;
				for (const opt of options) bucket.add(opt);
			}
		}

		for (const dv of findAllObjectLiteralsAfterKey(code, 'defaultVariants')) {
			const entries = parseObjectOfStringValues(dv.text);
			for (const [k, v] of Object.entries(entries)) defaults[k] = v;
		}
	}

	const outGroups: ShadcnVariantGroup[] = Array.from(groups.entries())
		.map(([name, opts]) => ({ name, options: Array.from(opts).sort() }))
		.sort((a, b) => a.name.localeCompare(b.name));

	return { groups: outGroups, defaults };
}

