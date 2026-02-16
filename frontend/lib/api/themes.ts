import { apiFetch } from '@/lib/http';
import type { Theme, ThemeListOut } from '@/lib/types';

export type SortDir = 'asc' | 'desc';
export const THEME_SORT_FIELDS = ['updated_at', 'created_at', 'title', 'slug', 'id'] as const;
export type ThemeSort = (typeof THEME_SORT_FIELDS)[number];

export const DEFAULT_THEME_SORT: ThemeSort = 'updated_at';
export const DEFAULT_THEME_DIR: SortDir = 'desc';

export type AdminThemesListParams = {
	limit: number;
	offset: number;
	q?: string;
	sort?: ThemeSort;
	dir?: SortDir;
};

export type ThemeUpsertPayload = {
	slug: string;
	title: string;
	description?: string | null;
	vars: Record<string, string>;
};

export function buildAdminThemesListUrl(params: AdminThemesListParams): string {
	const sp = new URLSearchParams();
	sp.set('limit', String(params.limit));
	sp.set('offset', String(params.offset));
	if (params.q?.trim()) sp.set('q', params.q.trim());
	sp.set('sort', params.sort ?? DEFAULT_THEME_SORT);
	sp.set('dir', params.dir ?? DEFAULT_THEME_DIR);
	return `/api/admin/themes?${sp.toString()}`;
}

export function listAdminThemes(params: AdminThemesListParams, nextPath = '/admin/themes') {
	return apiFetch<ThemeListOut>(buildAdminThemesListUrl(params), {
		cache: 'no-store',
		nextPath,
	});
}

export function createAdminTheme(payload: ThemeUpsertPayload, nextPath = '/admin/themes') {
	return apiFetch<Theme>('/api/admin/themes', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(payload),
		cache: 'no-store',
		nextPath,
	});
}

export function updateAdminTheme(themeId: number, payload: ThemeUpsertPayload, nextPath = '/admin/themes') {
	return apiFetch<Theme>(`/api/admin/themes/${themeId}`, {
		method: 'PUT',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(payload),
		cache: 'no-store',
		nextPath,
	});
}

export function deleteAdminTheme(themeId: number, nextPath = '/admin/themes') {
	return apiFetch<{ ok: boolean }>(`/api/admin/themes/${themeId}`, {
		method: 'DELETE',
		cache: 'no-store',
		nextPath,
	});
}
