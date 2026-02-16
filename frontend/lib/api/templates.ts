import { apiFetch } from '@/lib/http';
import type { PageTemplate, PageTemplateListOut } from '@/lib/types';

export type SortDir = 'asc' | 'desc';

export const TEMPLATE_SORT_FIELDS = [
	'updated_at',
	'created_at',
	'title',
	'slug',
	'menu',
	'footer',
] as const;
export type TemplateSort = (typeof TEMPLATE_SORT_FIELDS)[number];

export type AdminTemplatesListParams = {
	limit: number;
	offset: number;
	q?: string;
	sort?: TemplateSort;
	dir?: SortDir;
};

export type TemplateUpsertPayload = {
	title: string;
	slug?: string;
	description?: string | null;
	menu?: string;
	footer?: string;
	definition?: Record<string, unknown>;
};

export function buildAdminTemplatesListUrl(params: AdminTemplatesListParams): string {
	const sp = new URLSearchParams();
	sp.set('limit', String(params.limit));
	sp.set('offset', String(params.offset));
	if (params.q?.trim()) sp.set('q', params.q.trim());
	if (params.sort) sp.set('sort', params.sort);
	if (params.dir) sp.set('dir', params.dir);
	return `/api/admin/templates?${sp.toString()}`;
}

export function listAdminTemplates(
	params: AdminTemplatesListParams,
	nextPath = '/admin/templates'
) {
	return apiFetch<PageTemplateListOut>(buildAdminTemplatesListUrl(params), {
		cache: 'no-store',
		nextPath,
	});
}

export function createAdminTemplate(
	payload: TemplateUpsertPayload,
	nextPath = '/admin/templates'
) {
	return apiFetch<PageTemplate>('/api/admin/templates', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(payload),
		nextPath,
	});
}

export function getAdminTemplate(
	templateId: number,
	nextPath = `/admin/templates/${templateId}`
) {
	return apiFetch<PageTemplate>(`/api/admin/templates/${templateId}`, {
		cache: 'no-store',
		nextPath,
	});
}

export function updateAdminTemplate(
	templateId: number,
	payload: Partial<TemplateUpsertPayload>,
	nextPath = '/admin/templates'
) {
	return apiFetch<PageTemplate>(`/api/admin/templates/${templateId}`, {
		method: 'PUT',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(payload),
		nextPath,
	});
}

export function deleteAdminTemplate(
	templateId: number,
	nextPath = '/admin/templates'
) {
	return apiFetch<{ ok: boolean }>(`/api/admin/templates/${templateId}`, {
		method: 'DELETE',
		nextPath,
	});
}
