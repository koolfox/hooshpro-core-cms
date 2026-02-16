import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import type { Page } from '@/lib/types';
import type { PageBuilderState, PageNode } from '@/lib/page-builder';
import { parsePageBuilderState } from '@/lib/page-builder';
import type { PublicContentEntryListOut } from '@/lib/types';
import { fetchFrontPageSlug, fetchPublicTheme } from '@/lib/site-options';
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

async function fetchPublicTemplate(slug: string) {
	const res = await fetch(`${API_ORIGIN}/api/public/templates/${encodeURIComponent(slug)}`, {
		cache: 'no-store',
	});
	if (!res.ok) return null;
	return res.json();
}

async function fetchInitialCollections(states: PageBuilderState[]): Promise<Record<string, PublicContentEntryListOut>> {
	const requests: Array<{
		nodeId: string;
		typeSlug: string;
		limit: number;
		sort: string;
		dir: 'asc' | 'desc';
	}> = [];

	function walk(nodes: PageNode[]) {
		for (const n of nodes) {
			if (n.type === 'collection-list') {
				const typeSlug = (n.data.type_slug || '').trim();
				if (typeSlug) {
					const limit = Number.isFinite(n.data.limit) ? Math.max(1, Math.min(100, Math.round(n.data.limit as number))) : 20;
					const sort = (n.data.sort || 'published_at').trim();
					const dir = n.data.dir === 'asc' ? 'asc' : 'desc';
					requests.push({ nodeId: n.id, typeSlug, limit, sort, dir });
				}
			}
			if (Array.isArray(n.nodes)) walk(n.nodes);
		}
	}

	for (const s of states) walk(s.nodes);

	const out: Record<string, PublicContentEntryListOut> = {};
	if (requests.length === 0) return out;

	const results = await Promise.all(
		requests.map(async (r) => {
			const params = new URLSearchParams();
			params.set('limit', String(r.limit));
			params.set('offset', '0');
			params.set('sort', r.sort);
			params.set('dir', r.dir);

			const res = await fetch(`${API_ORIGIN}/api/public/entries/${encodeURIComponent(r.typeSlug)}?${params.toString()}`, {
				cache: 'no-store',
			});
			if (!res.ok) return null;
			const data = (await res.json()) as PublicContentEntryListOut;
			return [r.nodeId, data] as const;
		})
	);

	for (const r of results) {
		if (!r) continue;
		out[r[0]] = r[1];
	}
	return out;
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

	const footerValue = Array.isArray(sp.footer) ? sp.footer[0] : sp.footer;
	const footerOverride =
		typeof footerValue === 'string' && footerValue.trim() ? footerValue.trim() : null;

	// Canonicalize homepage: `/<front-page>` -> `/`
	const frontPageSlug = await fetchFrontPageSlug();
	if (slug.trim().toLowerCase() === frontPageSlug.trim().toLowerCase()) {
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

	const theme = await fetchPublicTheme();

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

	const pageState = parsePageBuilderState(p.blocks);
	const templateSlug = pageState.template.id;
	const t = templateSlug ? await fetchPublicTemplate(templateSlug) : null;
	const templateState = t && typeof t === 'object' ? parsePageBuilderState((t as { definition?: unknown }).definition) : null;
	const initialCollections = await fetchInitialCollections(templateState ? [pageState, templateState] : [pageState]);

	return (
		<PublicPageClient
			initialPage={p}
			initialTemplate={t}
			initialCollections={initialCollections}
			isAdmin={isAdmin}
			defaultEdit={edit}
			siteTheme={theme.slug}
			siteThemeVars={theme.vars}
			menuOverride={menuOverride}
			footerOverride={footerOverride}
		/>
	);
}
