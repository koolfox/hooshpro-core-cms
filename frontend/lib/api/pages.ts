import { apiFetch } from '@/lib/http';
import type { Page, PageListOut } from '@/lib/types';

export type SortDir = 'asc' | 'desc';
export type PageStatus = 'draft' | 'published';

export type AdminPagesListParams = {
	limit: number;
	offset: number;
	q?: string;
	status?: 'all' | PageStatus;
	sort?: string;
	dir?: SortDir;
};

export type PageUpsertPayload = {
	title: string;
	slug: string;
	status?: PageStatus;
	seo_title?: string | null;
	seo_description?: string | null;
	body?: string;
	blocks?: Record<string, unknown>;
};

export function buildAdminPagesListUrl(params: AdminPagesListParams): string {
	const sp = new URLSearchParams();
	sp.set('limit', String(params.limit));
	sp.set('offset', String(params.offset));
	if (params.q?.trim()) sp.set('q', params.q.trim());
	if (params.status && params.status !== 'all') sp.set('status', params.status);
	if (params.sort) sp.set('sort', params.sort);
	if (params.dir) sp.set('dir', params.dir);
	return `/api/admin/pages?${sp.toString()}`;
}

export function listAdminPages(params: AdminPagesListParams, nextPath = '/admin/pages') {
	return apiFetch<PageListOut>(buildAdminPagesListUrl(params), {
		cache: 'no-store',
		nextPath,
	});
}

export function createAdminPage(payload: PageUpsertPayload, nextPath = '/admin/pages') {
	return apiFetch<Page>('/api/admin/pages', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(payload),
		nextPath,
	});
}

export function getAdminPage(pageId: number, nextPath = `/admin/pages/${pageId}`) {
	return apiFetch<Page>(`/api/admin/pages/${pageId}`, {
		cache: 'no-store',
		nextPath,
	});
}

export function updateAdminPage(
	pageId: number,
	payload: Partial<PageUpsertPayload>,
	nextPath = '/admin/pages'
) {
	return apiFetch<Page>(`/api/admin/pages/${pageId}`, {
		method: 'PUT',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(payload),
		nextPath,
	});
}

export function deleteAdminPage(pageId: number, nextPath = '/admin/pages') {
	return apiFetch<{ ok: boolean }>(`/api/admin/pages/${pageId}`, {
		method: 'DELETE',
		nextPath,
	});
}
