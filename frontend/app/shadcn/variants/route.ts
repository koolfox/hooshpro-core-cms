import { NextResponse, type NextRequest } from 'next/server';
import path from 'node:path';
import { readFile } from 'node:fs/promises';

import { shadcnDocsUrl } from '@/lib/shadcn-docs';
import { extractShadcnVariantsFromMarkdown } from '@/lib/shadcn-variants';

type RadixLinks = { doc: string | null; api: string | null };
type ShadcnFrontmatter = {
	title: string | null;
	description: string | null;
	radix: RadixLinks | null;
};

function normalizeSlug(value: string | null): string {
	return (value ?? '').trim().toLowerCase();
}

function isSafeSlug(slug: string): boolean {
	return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

async function readLocalDocsMarkdown(slug: string): Promise<string | null> {
	const filename = `${slug}.md`;
	const candidates = [
		path.resolve(process.cwd(), '..', 'docs', 'shadcn', 'components', filename),
		path.resolve(process.cwd(), 'docs', 'shadcn', 'components', filename),
	];

	for (const p of candidates) {
		try {
			return await readFile(p, 'utf8');
		} catch {
			// ignore
		}
	}

	return null;
}

function extractFrontmatterFromMarkdown(markdown: string): ShadcnFrontmatter | null {
	const normalized = markdown.replaceAll('\r\n', '\n');
	if (!normalized.startsWith('---\n')) return null;

	const end = normalized.indexOf('\n---\n', 4);
	if (end === -1) return null;

	const fm = normalized.slice(4, end);
	const lines = fm.split('\n');

	let title: string | null = null;
	let description: string | null = null;

	let inLinks = false;
	let linksIndent = 0;

	let doc: string | null = null;
	let api: string | null = null;

	for (const rawLine of lines) {
		const line = rawLine.replace(/\s+$/, '');
		if (!inLinks) {
			const titleMatch = line.match(/^\s*title:\s*(.+)\s*$/);
			if (titleMatch) {
				title = titleMatch[1]!.trim().replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
				continue;
			}

			const descMatch = line.match(/^\s*description:\s*(.+)\s*$/);
			if (descMatch) {
				description = descMatch[1]!.trim().replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
				continue;
			}

			if (line.trim() === 'links:') {
				inLinks = true;
				linksIndent = (line.match(/^\s*/)?.[0] ?? '').length;
			}
			continue;
		}

		if (!line.trim()) continue;

		const indent = (line.match(/^\s*/)?.[0] ?? '').length;
		if (indent <= linksIndent) break;

		const m = line.trim().match(/^(doc|api):\s*(.+)\s*$/);
		if (!m) continue;

		const key = m[1];
		const value = m[2].trim().replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
		if (key === 'doc') doc = value;
		if (key === 'api') api = value;
	}

	const radix = doc || api ? ({ doc, api } satisfies RadixLinks) : null;
	if (!title && !description && !radix) return null;
	return { title, description, radix };
}

function extractShadcnUiExports(markdown: string, slug: string): string[] {
	const normalized = markdown.replaceAll('\r\n', '\n');
	const fences: string[] = [];
	const re = /```[a-zA-Z0-9_-]*\n([\s\S]*?)\n```/g;
	let m: RegExpExecArray | null;
	while ((m = re.exec(normalized)) !== null) fences.push(m[1] ?? '');

	const out = new Set<string>();
	const importRe = new RegExp(
		`import\\s*\\{([\\s\\S]*?)\\}\\s*from\\s*[\"']@/components/ui/${slug}[\"']`,
		'g'
	);

	for (const code of fences) {
		let im: RegExpExecArray | null;
		while ((im = importRe.exec(code)) !== null) {
			const body = im[1] ?? '';
			const parts = body
				.split(',')
				.map((s) => s.trim())
				.filter(Boolean)
				.map((s) => s.replace(/\s+as\s+.+$/, '').trim())
				.filter((s) => /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(s));
			for (const p of parts) out.add(p);
		}
	}

	return Array.from(out);
}

function extractInstallPackages(markdown: string): string[] {
	const normalized = markdown.replaceAll('\r\n', '\n');
	const fences: string[] = [];
	const re = /```[a-zA-Z0-9_-]*\n([\s\S]*?)\n```/g;
	let m: RegExpExecArray | null;
	while ((m = re.exec(normalized)) !== null) fences.push(m[1] ?? '');

	const out = new Set<string>();
	for (const code of fences) {
		for (const line of code.split('\n')) {
			const trimmed = line.trim();
			if (!trimmed) continue;
			const npm = trimmed.match(/^(npm\s+install)\s+(.+)$/);
			const pnpm = trimmed.match(/^(pnpm\s+add)\s+(.+)$/);
			const yarn = trimmed.match(/^(yarn\s+add)\s+(.+)$/);
			const args = (npm?.[2] ?? pnpm?.[2] ?? yarn?.[2])?.trim();
			if (!args) continue;
			for (const token of args.split(/\s+/)) {
				if (!token) continue;
				if (token.startsWith('-')) continue;
				out.add(token);
			}
		}
	}
	return Array.from(out);
}

export async function GET(req: NextRequest) {
	const slug = normalizeSlug(req.nextUrl.searchParams.get('slug'));
	if (!slug) {
		return NextResponse.json({ error: 'Missing `slug` query param.' }, { status: 400 });
	}

	if (!isSafeSlug(slug)) {
		return NextResponse.json({ error: 'Invalid `slug`.' }, { status: 400 });
	}

	const url = shadcnDocsUrl(slug);

	try {
		const localMarkdown = await readLocalDocsMarkdown(slug);
		if (typeof localMarkdown === 'string') {
			const meta = extractShadcnVariantsFromMarkdown(localMarkdown);
			const fm = extractFrontmatterFromMarkdown(localMarkdown);
			const exports = extractShadcnUiExports(localMarkdown, slug);
			const install = extractInstallPackages(localMarkdown);
			return NextResponse.json({
				slug,
				url,
				source: 'local',
				title: fm?.title ?? null,
				description: fm?.description ?? null,
				radix: fm?.radix ?? null,
				exports,
				install,
				...meta,
			});
		}

		const res = await fetch(url, {
			headers: { accept: 'text/markdown,text/plain,*/*' },
			next: { revalidate: 60 * 60 * 24 },
		});

		if (!res.ok) {
			return NextResponse.json(
				{ error: `Failed to fetch docs (${res.status}).`, slug, url },
				{ status: 502 }
			);
		}

		const markdown = await res.text();
		const meta = extractShadcnVariantsFromMarkdown(markdown);
		const fm = extractFrontmatterFromMarkdown(markdown);
		const exports = extractShadcnUiExports(markdown, slug);
		const install = extractInstallPackages(markdown);

		return NextResponse.json({
			slug,
			url,
			source: 'remote',
			title: fm?.title ?? null,
			description: fm?.description ?? null,
			radix: fm?.radix ?? null,
			exports,
			install,
			...meta,
		});
	} catch (e) {
		return NextResponse.json(
			{ error: e instanceof Error ? e.message : String(e), slug, url },
			{ status: 502 }
		);
	}
}
