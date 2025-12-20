import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import type { Page } from '@/lib/types';
import { PublicPageClient } from './page-client';

const API_ORIGIN = process.env.API_ORIGIN ?? 'http://127.0.0.1:8000';
const COOKIE_NAME = 'hooshpro_session';

type SearchParams = Record<string, string | string[] | undefined>;

async function fetchPublicPage(slug: string): Promise<Page | null> {
	const res = await fetch(`${API_ORIGIN}/api/public/pages/${slug}`, {
		cache: 'no-store',
	});
	if (!res.ok) return null;
	return res.json();
}

async function fetchAdminPage(
	slug: string,
	token: string
): Promise<Page | null> {
	const res = await fetch(`${API_ORIGIN}/api/admin/pages/by-slug/${slug}`, {
		cache: 'no-store',
		headers: {
			cookie: `${COOKIE_NAME}=${token}`,
		},
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
	searchParams,
}: {
	params: Promise<{ slug: string }> | { slug: string };
	searchParams?: SearchParams | Promise<SearchParams>;
}) {
	const { slug } = 'slug' in params ? params : await params;
	const sp = await resolveSearchParams(searchParams);
	const editValue = Array.isArray(sp.edit) ? sp.edit[0] : sp.edit;
	const edit = editValue === '1' || editValue === 'true';

	const menuValue = Array.isArray(sp.menu) ? sp.menu[0] : sp.menu;
	const menuOverride = typeof menuValue === 'string' && menuValue.trim() ? menuValue.trim() : null;

	// Canonicalize homepage: `/home` -> `/`
	if (slug.trim().toLowerCase() === 'home') {
		const params = new URLSearchParams();
		for (const [k, v] of Object.entries(sp)) {
			if (typeof v === 'string' && v) params.set(k, v);
			if (Array.isArray(v)) {
				for (const vv of v) {
					if (vv) params.append(k, vv);
				}
			}
		}
		const qs = params.toString();
		redirect(qs ? `/?${qs}` : '/');
	}

	const token = (await cookies()).get(COOKIE_NAME)?.value ?? '';
	const isAdmin = token ? await isAdminSession(token) : false;

	const p = isAdmin
		? await fetchAdminPage(slug, token)
		: await fetchPublicPage(slug);
	if (!p) {
		return (
			<main className='p-10'>
				<h1 className='text-2xl font-semibold'>404</h1>
				<p className='text-sm text-muted-foreground'>Page not found.</p>
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
