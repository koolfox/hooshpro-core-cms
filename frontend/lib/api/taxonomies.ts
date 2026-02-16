import { apiFetch } from '@/lib/http';
import type { Taxonomy, TaxonomyListOut, Term, TermListOut } from '@/lib/types';

export type SortDir = 'asc' | 'desc';

export const TAXONOMY_SORT_FIELDS = ['updated_at', 'created_at', 'title', 'slug', 'id'] as const;
export type TaxonomySort = (typeof TAXONOMY_SORT_FIELDS)[number];

export const TERM_SORT_FIELDS = ['title', 'slug', 'updated_at', 'created_at', 'id'] as const;
export type TermSort = (typeof TERM_SORT_FIELDS)[number];

export type AdminTaxonomiesListParams = {
	limit: number;
	offset: number;
	q?: string;
	sort?: TaxonomySort;
	dir?: SortDir;
};

export type TaxonomyUpsertPayload = {
	title: string;
	slug: string;
	description?: string | null;
	hierarchical: boolean;
};

export type AdminTermsListParams = {
	limit: number;
	offset: number;
	q?: string;
	sort?: TermSort;
	dir?: SortDir;
};

export type TermUpsertPayload = {
	title: string;
	slug: string;
	description?: string | null;
	parent_id?: number | null;
};

export function buildAdminTaxonomiesListUrl(params: AdminTaxonomiesListParams): string {
	const sp = new URLSearchParams();
	sp.set('limit', String(params.limit));
	sp.set('offset', String(params.offset));
	if (params.q?.trim()) sp.set('q', params.q.trim());
	if (params.sort) sp.set('sort', params.sort);
	if (params.dir) sp.set('dir', params.dir);
	return `/api/admin/taxonomies?${sp.toString()}`;
}

export function listAdminTaxonomies(
	params: AdminTaxonomiesListParams,
	nextPath = '/admin/taxonomies'
) {
	return apiFetch<TaxonomyListOut>(buildAdminTaxonomiesListUrl(params), {
		cache: 'no-store',
		nextPath,
	});
}

export function createAdminTaxonomy(
	payload: TaxonomyUpsertPayload,
	nextPath = '/admin/taxonomies'
) {
	return apiFetch<Taxonomy>('/api/admin/taxonomies', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(payload),
		nextPath,
	});
}

export function getAdminTaxonomy(
	taxonomyId: number,
	nextPath = `/admin/taxonomies/${taxonomyId}`
) {
	return apiFetch<Taxonomy>(`/api/admin/taxonomies/${taxonomyId}`, {
		cache: 'no-store',
		nextPath,
	});
}

export function deleteAdminTaxonomy(taxonomyId: number, nextPath = '/admin/taxonomies') {
	return apiFetch<{ ok: boolean }>(`/api/admin/taxonomies/${taxonomyId}`, {
		method: 'DELETE',
		nextPath,
	});
}

export function buildAdminTermsListUrl(
	taxonomyId: number,
	params: AdminTermsListParams
): string {
	const sp = new URLSearchParams();
	sp.set('limit', String(params.limit));
	sp.set('offset', String(params.offset));
	if (params.q?.trim()) sp.set('q', params.q.trim());
	if (params.sort) sp.set('sort', params.sort);
	if (params.dir) sp.set('dir', params.dir);
	return `/api/admin/taxonomies/${taxonomyId}/terms?${sp.toString()}`;
}

export function listAdminTerms(
	taxonomyId: number,
	params: AdminTermsListParams,
	nextPath = `/admin/taxonomies/${taxonomyId}`
) {
	return apiFetch<TermListOut>(buildAdminTermsListUrl(taxonomyId, params), {
		cache: 'no-store',
		nextPath,
	});
}

export function createAdminTerm(
	taxonomyId: number,
	payload: TermUpsertPayload,
	nextPath = `/admin/taxonomies/${taxonomyId}`
) {
	return apiFetch<Term>(`/api/admin/taxonomies/${taxonomyId}/terms`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(payload),
		nextPath,
	});
}

export function updateAdminTerm(
	taxonomyId: number,
	termId: number,
	payload: TermUpsertPayload,
	nextPath = `/admin/taxonomies/${taxonomyId}`
) {
	return apiFetch<Term>(`/api/admin/taxonomies/${taxonomyId}/terms/${termId}`, {
		method: 'PUT',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(payload),
		nextPath,
	});
}

export function deleteAdminTerm(
	taxonomyId: number,
	termId: number,
	nextPath = `/admin/taxonomies/${taxonomyId}`
) {
	return apiFetch<{ ok: boolean }>(`/api/admin/taxonomies/${taxonomyId}/terms/${termId}`, {
		method: 'DELETE',
		nextPath,
	});
}
