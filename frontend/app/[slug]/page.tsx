import type { Metadata } from 'next';

type Page = {
	id: number;
	title: string;
	slug: string;
	status: 'draft' | 'published';
	seo_title?: string | null;
	seo_description?: string | null;
	blocks: any;
};

const API_ORIGIN = process.env.API_ORIGIN ?? 'http://127.0.0.1:8000';
const RESERVED = new Set(['admin', 'login', 'logout', 'api', 'auth']);

async function fetchPage(slug: string): Promise<Page | null> {
	const res = await fetch(`${API_ORIGIN}/api/public/pages/${slug}`, {
		cache: 'no-store',
	});
	if (!res.ok) return null;
	return res.json();
}

export async function generateMetadata({
	params,
}: {
	params: Promise<{ slug: string }>;
}): Promise<Metadata> {
	const { slug } = await params;

	if (RESERVED.has(slug)) return { title: 'Not found' };

	const p = await fetchPage(slug);
	if (!p) return { title: 'Not found' };

	return {
		title: p.seo_title || p.title,
		description: p.seo_description || undefined,
	};
}

export default async function PublicPage({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const { slug } = await params;

	if (RESERVED.has(slug)) {
		return (
			<main className='p-10'>
				<h1 className='text-2xl font-semibold'>404</h1>
				<p className='text-sm text-muted-foreground'>Page not found.</p>
			</main>
		);
	}

	const p = await fetchPage(slug);
	if (!p) {
		return (
			<main className='p-10'>
				<h1 className='text-2xl font-semibold'>404</h1>
				<p className='text-sm text-muted-foreground'>Page not found.</p>
			</main>
		);
	}

	const bodyBlock = p.blocks?.blocks?.find(
		(b: any) => b.type === 'paragraph'
	);
	const bodyText = bodyBlock?.data?.text ?? '';

	return (
		<main className='max-w-3xl mx-auto p-10 space-y-6'>
			<h1 className='text-4xl font-bold tracking-tight'>{p.title}</h1>
			{bodyText ? (
				<p className='text-base leading-7'>{bodyText}</p>
			) : null}
		</main>
	);
}
