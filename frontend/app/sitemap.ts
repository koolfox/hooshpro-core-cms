import type { MetadataRoute } from 'next';

import { fetchFrontPageSlug } from '@/lib/site-options';

const API_ORIGIN = process.env.API_ORIGIN ?? 'http://127.0.0.1:8000';
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL ?? 'http://localhost:3000').replace(/\/+$/, '');

type PublicPageItem = {
	slug?: unknown;
	updated_at?: unknown;
};

type PublicPageListResponse = {
	items?: unknown;
	total?: unknown;
	limit?: unknown;
	offset?: unknown;
};

function asDate(value: unknown): Date | undefined {
	if (typeof value !== 'string' || !value.trim()) return undefined;
	const d = new Date(value);
	if (Number.isNaN(d.getTime())) return undefined;
	return d;
}

function normalizePage(item: unknown): { slug: string; updatedAt?: Date } | null {
	if (!item || typeof item !== 'object') return null;
	const rec = item as PublicPageItem;
	if (typeof rec.slug !== 'string' || !rec.slug.trim()) return null;
	return { slug: rec.slug.trim().toLowerCase(), updatedAt: asDate(rec.updated_at) };
}

async function fetchPublishedPages(): Promise<Array<{ slug: string; updatedAt?: Date }>> {
	const out: Array<{ slug: string; updatedAt?: Date }> = [];
	const limit = 200;
	let offset = 0;
	let total = Number.POSITIVE_INFINITY;

	while (offset < total) {
		const qs = new URLSearchParams({
			limit: String(limit),
			offset: String(offset),
		});
		const res = await fetch(`${API_ORIGIN}/api/public/pages?${qs.toString()}`, {
			cache: 'no-store',
		});
		if (!res.ok) break;

		const data = (await res.json()) as PublicPageListResponse;
		const rawItems = Array.isArray(data.items) ? data.items : [];
		for (const raw of rawItems) {
			const normalized = normalizePage(raw);
			if (normalized) out.push(normalized);
		}

		total = typeof data.total === 'number' && Number.isFinite(data.total) ? data.total : out.length;
		offset += rawItems.length;
		if (rawItems.length === 0) break;
	}

	return out;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
	const frontPageSlug = (await fetchFrontPageSlug()).trim().toLowerCase();
	const pages = await fetchPublishedPages();

	let rootLastModified: Date | undefined;
	const rest: MetadataRoute.Sitemap = [];

	for (const p of pages) {
		if (p.slug === frontPageSlug) {
			rootLastModified = p.updatedAt;
			continue;
		}
		rest.push({
			url: `${SITE_URL}/${encodeURIComponent(p.slug)}`,
			lastModified: p.updatedAt,
			changeFrequency: 'weekly',
			priority: 0.7,
		});
	}

	return [
		{
			url: `${SITE_URL}/`,
			lastModified: rootLastModified,
			changeFrequency: 'daily',
			priority: 1,
		},
		...rest,
	];
}
