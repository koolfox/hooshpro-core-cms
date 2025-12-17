import type { Metadata } from 'next';
import { sanitizeRichHtml } from '@/lib/sanitize';

type PageOut = {
	id: number;
	title: string;
	slug: string;
	status: 'draft' | 'published';
	seo_title?: string | null;
	seo_description?: string | null;
	body?: string;
	created_at: string;
	updated_at: string;
};

const API_ORIGIN = process.env.API_ORIGIN ?? 'http://127.0.0.1:8000';

async function fetchPublicPage(slug: string): Promise<PageOut | null> {
	const res = await fetch(`${API_ORIGIN}/api/public/pages/${slug}`, {
		cache: 'no-store',
	});
	if (!res.ok) return null;
	return res.json();
}

export async function generateMetadata({
	params,
}: {
	params: Promise<{ slug: string }> | { slug: string };
}): Promise<Metadata> {
	const p = await fetchPublicPage(
		'slug' in params ? params.slug : (await params).slug
	);
	if (!p) return { title: 'Not found' };

	return {
		title: p.seo_title || p.title,
		description: p.seo_description || undefined,
	};
}

export default async function PublicPage({
	params,
}: {
	params: Promise<{ slug: string }> | { slug: string };
}) {
	const { slug } = 'slug' in params ? params : await params;

	const p = await fetchPublicPage(slug);
	if (!p) {
		return (
			<main className='p-10'>
				<h1 className='text-2xl font-semibold'>404</h1>
				<p className='text-sm text-muted-foreground'>Page not found.</p>
			</main>
		);
	}

	const safe = sanitizeRichHtml(p.body || '');

	return (
		<main className='max-w-3xl mx-auto p-10 space-y-6'>
			<h1 className='text-4xl font-bold tracking-tight'>{p.title}</h1>

			{safe ? (
				<div
					className='prose prose-sm max-w-none dark:prose-invert'
					dangerouslySetInnerHTML={{ __html: safe }}
				/>
			) : null}
		</main>
	);
}
