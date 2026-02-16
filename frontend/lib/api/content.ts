import { apiFetch } from '@/lib/http';
import type {
	ContentEntry,
	ContentEntryListOut,
	ContentField,
	ContentFieldListOut,
	ContentType,
	ContentTypeListOut,
} from '@/lib/types';

export type SortDir = 'asc' | 'desc';

export const CONTENT_TYPE_SORT_FIELDS = ['updated_at', 'created_at', 'title', 'slug', 'id'] as const;
export type ContentTypeSort = (typeof CONTENT_TYPE_SORT_FIELDS)[number];

export const ENTRY_SORT_FIELDS = [
	'updated_at',
	'created_at',
	'published_at',
	'title',
	'slug',
	'status',
	'order_index',
	'id',
] as const;
export type EntrySort = (typeof ENTRY_SORT_FIELDS)[number];

export type AdminContentTypesListParams = {
	limit: number;
	offset: number;
	q?: string;
	sort?: ContentTypeSort;
	dir?: SortDir;
};

export type ContentTypeUpsertPayload = {
	title: string;
	slug: string;
	description?: string | null;
};

export type ContentFieldUpsertPayload = {
	slug: string;
	label: string;
	field_type: string;
	required: boolean;
	options?: Record<string, unknown>;
};

export type AdminEntriesListParams = {
	limit: number;
	offset: number;
	q?: string;
	type?: string;
	status?: 'all' | 'draft' | 'published';
	sort?: EntrySort;
	dir?: SortDir;
};

export type ContentEntryCreatePayload = {
	content_type_slug: string;
	title: string;
	slug: string;
	status: 'draft' | 'published';
	order_index: number;
	data: Record<string, unknown>;
};

export type ContentEntryUpdatePayload = {
	title?: string;
	slug?: string;
	status?: 'draft' | 'published';
	order_index?: number;
	data?: Record<string, unknown>;
};

export function buildAdminContentTypesListUrl(params: AdminContentTypesListParams): string {
	const sp = new URLSearchParams();
	sp.set('limit', String(params.limit));
	sp.set('offset', String(params.offset));
	if (params.q?.trim()) sp.set('q', params.q.trim());
	if (params.sort) sp.set('sort', params.sort);
	if (params.dir) sp.set('dir', params.dir);
	return `/api/admin/content-types?${sp.toString()}`;
}

export function listAdminContentTypes(
	params: AdminContentTypesListParams,
	nextPath = '/admin/collections'
) {
	return apiFetch<ContentTypeListOut>(buildAdminContentTypesListUrl(params), {
		cache: 'no-store',
		nextPath,
	});
}

export function createAdminContentType(
	payload: ContentTypeUpsertPayload,
	nextPath = '/admin/collections'
) {
	return apiFetch<ContentType>('/api/admin/content-types', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(payload),
		nextPath,
	});
}

export function getAdminContentType(typeId: number, nextPath = `/admin/collections/${typeId}`) {
	return apiFetch<ContentType>(`/api/admin/content-types/${typeId}`, {
		cache: 'no-store',
		nextPath,
	});
}

export function deleteAdminContentType(typeId: number, nextPath = '/admin/collections') {
	return apiFetch<{ ok: boolean }>(`/api/admin/content-types/${typeId}`, {
		method: 'DELETE',
		nextPath,
	});
}

export function listAdminContentFields(typeId: number, nextPath = `/admin/collections/${typeId}`) {
	return apiFetch<ContentFieldListOut>(`/api/admin/content-types/${typeId}/fields`, {
		cache: 'no-store',
		nextPath,
	});
}

export function createAdminContentField(
	typeId: number,
	payload: ContentFieldUpsertPayload,
	nextPath = `/admin/collections/${typeId}`
) {
	return apiFetch<ContentField>(`/api/admin/content-types/${typeId}/fields`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(payload),
		nextPath,
	});
}

export function updateAdminContentField(
	typeId: number,
	fieldId: number,
	payload: ContentFieldUpsertPayload,
	nextPath = `/admin/collections/${typeId}`
) {
	return apiFetch<ContentField>(`/api/admin/content-types/${typeId}/fields/${fieldId}`, {
		method: 'PUT',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(payload),
		nextPath,
	});
}

export function deleteAdminContentField(
	typeId: number,
	fieldId: number,
	nextPath = `/admin/collections/${typeId}`
) {
	return apiFetch<{ ok: boolean }>(`/api/admin/content-types/${typeId}/fields/${fieldId}`, {
		method: 'DELETE',
		nextPath,
	});
}

export function buildAdminEntriesListUrl(params: AdminEntriesListParams): string {
	const sp = new URLSearchParams();
	sp.set('limit', String(params.limit));
	sp.set('offset', String(params.offset));
	if (params.q?.trim()) sp.set('q', params.q.trim());
	if (params.type?.trim()) sp.set('type', params.type.trim());
	if (params.status && params.status !== 'all') sp.set('status', params.status);
	if (params.sort) sp.set('sort', params.sort);
	if (params.dir) sp.set('dir', params.dir);
	return `/api/admin/entries?${sp.toString()}`;
}

export function listAdminEntries(params: AdminEntriesListParams, nextPath = '/admin/entries') {
	return apiFetch<ContentEntryListOut>(buildAdminEntriesListUrl(params), {
		cache: 'no-store',
		nextPath,
	});
}

export function createAdminEntry(
	payload: ContentEntryCreatePayload,
	nextPath = '/admin/entries'
) {
	return apiFetch<ContentEntry>('/api/admin/entries', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(payload),
		nextPath,
	});
}

export function updateAdminEntry(
	entryId: number,
	payload: ContentEntryUpdatePayload,
	nextPath = '/admin/entries'
) {
	return apiFetch<ContentEntry>(`/api/admin/entries/${entryId}`, {
		method: 'PUT',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(payload),
		nextPath,
	});
}

export function deleteAdminEntry(entryId: number, nextPath = '/admin/entries') {
	return apiFetch<{ ok: boolean }>(`/api/admin/entries/${entryId}`, {
		method: 'DELETE',
		nextPath,
	});
}
