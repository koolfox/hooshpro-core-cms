import { apiFetch } from '@/lib/http';
import type { ComponentDef, ComponentListOut } from '@/lib/types';

export type SortDir = 'asc' | 'desc';

export const COMPONENT_SORT_FIELDS = [
	'updated_at',
	'created_at',
	'title',
	'slug',
	'type',
] as const;
export type ComponentSort = (typeof COMPONENT_SORT_FIELDS)[number];

export type AdminComponentsListParams = {
	limit: number;
	offset: number;
	q?: string;
	type?: string;
	sort?: ComponentSort;
	dir?: SortDir;
};

export type ComponentUpsertPayload = {
	title: string;
	slug: string;
	type: string;
	description?: string | null;
	data?: Record<string, unknown>;
};

export function buildAdminComponentsListUrl(params: AdminComponentsListParams): string {
	const sp = new URLSearchParams();
	sp.set('limit', String(params.limit));
	sp.set('offset', String(params.offset));
	if (params.q?.trim()) sp.set('q', params.q.trim());
	if (params.type?.trim() && params.type.trim() !== 'all') sp.set('type', params.type.trim());
	if (params.sort) sp.set('sort', params.sort);
	if (params.dir) sp.set('dir', params.dir);
	return `/api/admin/components?${sp.toString()}`;
}

export function listAdminComponents(
	params: AdminComponentsListParams,
	nextPath = '/admin/components'
) {
	return apiFetch<ComponentListOut>(buildAdminComponentsListUrl(params), {
		cache: 'no-store',
		nextPath,
	});
}

export function createAdminComponent(
	payload: ComponentUpsertPayload,
	nextPath = '/admin/components'
) {
	return apiFetch<ComponentDef>('/api/admin/components', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(payload),
		nextPath,
	});
}

export function getAdminComponent(
	componentId: number,
	nextPath = `/admin/components/${componentId}`
) {
	return apiFetch<ComponentDef>(`/api/admin/components/${componentId}`, {
		cache: 'no-store',
		nextPath,
	});
}

export function updateAdminComponent(
	componentId: number,
	payload: Partial<ComponentUpsertPayload>,
	nextPath = '/admin/components'
) {
	return apiFetch<ComponentDef>(`/api/admin/components/${componentId}`, {
		method: 'PUT',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(payload),
		nextPath,
	});
}

export function deleteAdminComponent(
	componentId: number,
	nextPath = '/admin/components'
) {
	return apiFetch<{ ok: boolean }>(`/api/admin/components/${componentId}`, {
		method: 'DELETE',
		nextPath,
	});
}
