import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';

import type { Page } from '@/lib/types';
import { PublicPageClient } from './[slug]/page-client';

const API_ORIGIN = process.env.API_ORIGIN ?? 'http://127.0.0.1:8000';
const COOKIE_NAME = 'hooshpro_session';
const HOMEPAGE_SLUG = 'home';

type SearchParams = Record<string, string | string[] | undefined>;

async function fetchPublicPage(slug: string): Promise<Page | null> {
	const res = await fetch(`${API_ORIGIN}/api/public/pages/${slug}`, {
		cache: 'no-store',
	});
	if (!res.ok) return null;
	return res.json();
}

async function fetchAdminPage(slug: string, token: string): Promise<Page | null> {
	const res = await fetch(`${API_ORIGIN}/api/admin/pages/by-slug/${slug}`, {
		cache: 'no-store',
		headers: { cookie: `${COOKIE_NAME}=${token}` },
	});
	if (!res.ok) return null;
	return res.json();
}

async function isAdminSession(token: string): Promise<boolean> {
	const res = await fetch(`${API_ORIGIN}/api/auth/me`, {
		method: 'GET',
		cache: 'no-store',
		headers: {
			cookie: `${COOKIE_NAME}=${token}`,
			accept: 'application/json',
		},
	});
	return res.ok;
}

function resolveSearchParams(
	searchParams?: SearchParams | Promise<SearchParams>
): Promise<SearchParams> {
	if (!searchParams) return Promise.resolve({});
	if (typeof (searchParams as Promise<SearchParams>).then === 'function') {
		return searchParams as Promise<SearchParams>;
	}
	return Promise.resolve(searchParams as SearchParams);
}

export async function generateMetadata(): Promise<Metadata> {
	const p = await fetchPublicPage(HOMEPAGE_SLUG);
	if (!p) return { title: 'HooshPro' };
	return {
		title: p.seo_title || p.title,
		description: p.seo_description || undefined,
	};
}

export default async function Home({
	searchParams,
}: {
	searchParams?: SearchParams | Promise<SearchParams>;
}) {
	const sp = await resolveSearchParams(searchParams);
	const editValue = Array.isArray(sp.edit) ? sp.edit[0] : sp.edit;
	const edit = editValue === '1' || editValue === 'true';

	const menuValue = Array.isArray(sp.menu) ? sp.menu[0] : sp.menu;
	const menuOverride = typeof menuValue === 'string' && menuValue.trim() ? menuValue.trim() : null;

	const token = (await cookies()).get(COOKIE_NAME)?.value ?? '';
	const isAdmin = token ? await isAdminSession(token) : false;

	const p = isAdmin ? await fetchAdminPage(HOMEPAGE_SLUG, token) : await fetchPublicPage(HOMEPAGE_SLUG);

	if (!p) {
		return (
			<main className='max-w-3xl mx-auto p-10 space-y-4'>
				<h1 className='text-2xl font-semibold'>Homepage not found</h1>
				<p className='text-sm text-muted-foreground'>
					Create a page with slug <code>home</code> (and publish it) to render the site root <code>/</code>.
				</p>
				<div className='flex items-center gap-3'>
					<Link
						href='/admin/pages'
						className='text-sm underline underline-offset-4'>
						Go to Admin → Pages
					</Link>
					<Link
						href='/auth/login'
						className='text-sm underline underline-offset-4'>
						Login
					</Link>
				</div>
				{isAdmin ? (
					<p className='text-xs text-muted-foreground'>
						Tip: after creating it, edit at <code>/?edit=1</code>.
					</p>
				) : null}
			</main>
		);
	}

	return (
		<PublicPageClient
			initialPage={p}
			isAdmin={isAdmin}
			defaultEdit={edit}
			menuOverride={menuOverride}
		/>
	);
}
