import { NextResponse, type NextRequest } from 'next/server';

import { shadcnDocsUrl } from '@/lib/shadcn-docs';
import { extractShadcnVariantsFromMarkdown } from '@/lib/shadcn-variants';

function normalizeSlug(value: string | null): string {
	return (value ?? '').trim().toLowerCase();
}

export async function GET(req: NextRequest) {
	const slug = normalizeSlug(req.nextUrl.searchParams.get('slug'));
	if (!slug) {
		return NextResponse.json({ error: 'Missing `slug` query param.' }, { status: 400 });
	}

	const url = shadcnDocsUrl(slug);

	try {
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

		return NextResponse.json({
			slug,
			url,
			...meta,
		});
	} catch (e) {
		return NextResponse.json(
			{ error: e instanceof Error ? e.message : String(e), slug, url },
			{ status: 502 }
		);
	}
}

